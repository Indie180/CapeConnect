import express from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { validateWalletTopup } from '../middleware/validation.js';
import payfast from '../services/payfast.js';
import { log, serializeError } from '../utils/logger.js';

const router = express.Router();

// Initiate wallet top-up payment
router.post('/topup/initiate', requireAuth, validateWalletTopup, async (req, res, next) => {
  try {
    const { amount } = req.body;
    const userId = req.auth.userId;
    const userEmail = req.auth.email;

    // Generate unique payment reference
    const reference = `TOPUP_${userId}_${Date.now()}`;
    const paymentId = crypto.randomBytes(16).toString('hex');
    
    // Create payment record (SQLite compatible)
    await query(`
      INSERT INTO payments (id, user_id, amount_cents, currency, status, payment_method, description, reference)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      paymentId,
      userId, 
      amount, 
      'ZAR', 
      'PENDING', 
      'PAYFAST', 
      `Wallet top-up - R${(amount/100).toFixed(2)}`,
      reference
    ]);

    const payment = {
      id: paymentId,
      reference: reference,
      created_at: new Date().toISOString()
    };

    // Generate PayFast payment data
    const paymentData = payfast.createPaymentData(
      amount,
      userId,
      userEmail,
      `Wallet Top-up - R${(amount/100).toFixed(2)}`,
      payment.id
    );

    // Update payment with PayFast reference (SQLite compatible)
    await query(`
      UPDATE payments 
      SET payfast_payment_id = $1, updated_at = datetime('now')
      WHERE id = $2
    `, [paymentData.m_payment_id, payment.id]);

    res.json({
      success: true,
      paymentId: payment.id,
      paymentUrl: payfast.baseUrl,
      paymentData: paymentData,
      reference: payment.reference
    });

  } catch (error) {
    log('error', 'Payment initiation error', { error: serializeError(error) });
    next(error);
  }
});

// PayFast webhook handler
router.post('/payfast/webhook', async (req, res, next) => {
  try {
    const webhookData = req.body;
    
    // Log webhook for debugging (SQLite compatible)
    const webhookId = crypto.randomBytes(16).toString('hex');
    await query(`
      INSERT INTO payment_webhooks (id, webhook_data, signature_valid, processed)
      VALUES ($1, $2, $3, $4)
    `, [webhookId, JSON.stringify(webhookData), 0, 0]);

    // Verify webhook signature
    const signatureValid = payfast.verifyWebhook(webhookData);
    
    await query(`
      UPDATE payment_webhooks 
      SET signature_valid = $1 
      WHERE id = $2
    `, [signatureValid ? 1 : 0, webhookId]);

    if (!signatureValid) {
      log('error', 'Invalid PayFast webhook signature');
      return res.status(400).send('Invalid signature');
    }

    const { 
      payment_status, 
      m_payment_id, 
      amount_gross, 
      custom_str1: userId, 
      custom_str3: paymentId,
      pf_payment_id 
    } = webhookData;

    // Find payment record
    const paymentResult = await query(`
      SELECT * FROM payments 
      WHERE id = $1 AND user_id = $2 AND payfast_payment_id = $3
    `, [paymentId, userId, m_payment_id]);

    if (paymentResult.rows.length === 0) {
      const errorMsg = `Payment not found: ${m_payment_id}`;
      log('error', errorMsg);
      
      await query(`
        UPDATE payment_webhooks 
        SET error_message = $1 
        WHERE id = $2
      `, [errorMsg, webhookId]);
      
      return res.status(404).send('Payment not found');
    }

    const payment = paymentResult.rows[0];
    const newStatus = payfast.getPaymentStatus(payment_status);

    // Start transaction for atomic updates
    await query('BEGIN');
    
    try {
      // Update payment status (SQLite compatible)
      await query(`
        UPDATE payments 
        SET status = $1, 
            payfast_pf_payment_id = $2,
            completed_at = CASE WHEN $1 IN ('COMPLETED', 'FAILED', 'CANCELLED') THEN datetime('now') ELSE completed_at END,
            updated_at = datetime('now')
        WHERE id = $3
      `, [newStatus, pf_payment_id, payment.id]);

      if (newStatus === 'COMPLETED') {
        // Get current wallet balance
        const walletResult = await query(`
          SELECT balance_cents FROM wallets WHERE user_id = $1
        `, [userId]);

        const currentBalance = walletResult.rows[0]?.balance_cents || 0;
        const newBalance = currentBalance + payment.amount_cents;

        // Update wallet balance (SQLite compatible - use INSERT OR REPLACE)
        if (walletResult.rows.length === 0) {
          // Create new wallet
          await query(`
            INSERT INTO wallets (user_id, balance_cents, currency, created_at, updated_at)
            VALUES ($1, $2, $3, datetime('now'), datetime('now'))
          `, [userId, payment.amount_cents, 'ZAR']);
        } else {
          // Update existing wallet
          await query(`
            UPDATE wallets 
            SET balance_cents = $1, updated_at = datetime('now')
            WHERE user_id = $2
          `, [newBalance, userId]);
        }

        // Create wallet transaction record
        const transactionId = crypto.randomBytes(16).toString('hex');
        await query(`
          INSERT INTO wallet_transactions 
          (id, user_id, amount_cents, type, description, payment_id, balance_before_cents, balance_after_cents, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, datetime('now'))
        `, [
          transactionId,
          userId, 
          payment.amount_cents, 
          'TOPUP', 
          `Wallet top-up via PayFast - R${(payment.amount_cents/100).toFixed(2)}`,
          payment.id,
          currentBalance,
          newBalance
        ]);

        log('info', 'Payment completed', { paymentId: m_payment_id, amount: amount_gross, newBalance: (newBalance/100).toFixed(2) });
      } else {
        log('info', `Payment ${newStatus.toLowerCase()}`, { paymentId: m_payment_id, status: payment_status });
      }

      // Mark webhook as processed
      await query(`
        UPDATE payment_webhooks 
        SET processed = 1, payment_id = $1
        WHERE id = $2
      `, [payment.id, webhookId]);

      await query('COMMIT');
      
    } catch (error) {
      await query('ROLLBACK');
      
      await query(`
        UPDATE payment_webhooks 
        SET error_message = $1 
        WHERE id = $2
      `, [error.message, webhookId]);
      
      throw error;
    }

    res.status(200).send('OK');

  } catch (error) {
    log('error', 'Webhook processing error', { error: serializeError(error) });
    next(error);
  }
});

// Check payment status
router.get('/status/:paymentId', requireAuth, async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const userId = req.auth.userId;

    const result = await query(`
      SELECT 
        id, 
        amount_cents, 
        currency,
        status, 
        description,
        reference,
        payfast_payment_id,
        created_at, 
        completed_at
      FROM payments 
      WHERE id = $1 AND user_id = $2
    `, [paymentId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const payment = result.rows[0];
    
    res.json({
      id: payment.id,
      amount: payment.amount_cents,
      currency: payment.currency,
      status: payment.status,
      description: payment.description,
      reference: payment.reference,
      createdAt: payment.created_at,
      completedAt: payment.completed_at
    });

  } catch (error) {
    log('error', 'Payment status check error', { error: serializeError(error) });
    next(error);
  }
});

// Get payment history
router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const userId = req.auth.userId;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(`
      SELECT 
        id, 
        amount_cents, 
        currency,
        status, 
        description,
        reference,
        created_at, 
        completed_at
      FROM payments 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const payments = result.rows.map(payment => ({
      id: payment.id,
      amount: payment.amount_cents,
      currency: payment.currency,
      status: payment.status,
      description: payment.description,
      reference: payment.reference,
      createdAt: payment.created_at,
      completedAt: payment.completed_at
    }));

    res.json({
      payments,
      pagination: {
        limit,
        offset,
        hasMore: payments.length === limit
      }
    });

  } catch (error) {
    log('error', 'Payment history error', { error: serializeError(error) });
    next(error);
  }
});

export default router;