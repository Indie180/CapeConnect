import express from "express";
import { query, withTransaction } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const walletResult = await query(
      "SELECT * FROM wallets WHERE user_id = $1 LIMIT 1",
      [req.auth.userId]
    );

    if (!walletResult.rows.length) {
      return res.json({ wallet: { user_id: req.auth.userId, balance_cents: 0, currency: "ZAR" }, transactions: [] });
    }

    const wallet = walletResult.rows[0];
    const txResult = await query(
      `
      SELECT *
      FROM wallet_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [req.auth.userId]
    );

    return res.json({ wallet, transactions: txResult.rows });
  } catch (error) {
    return next(error);
  }
});

router.post("/topup", requireAuth, async (req, res, next) => {
  try {
    const amountCents = Number(req.body?.amountCents || 0);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ error: "amountCents must be > 0" });
    }

    const wallet = await withTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO wallets (user_id, balance_cents, currency, created_at, updated_at)
        VALUES ($1, 0, 'ZAR', NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
        `,
        [req.auth.userId]
      );

      const walletResult = await client.query(
        `
        UPDATE wallets
        SET balance_cents = balance_cents + $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING *
        `,
        [amountCents, req.auth.userId]
      );

      await client.query(
        `
        INSERT INTO wallet_transactions (id, user_id, type, amount_cents, note, created_at)
        VALUES (gen_random_uuid(), $1, 'TOPUP', $2, $3, NOW())
        `,
        [req.auth.userId, amountCents, req.body?.note || "Wallet top up"]
      );

      return walletResult.rows[0];
    });

    return res.json({ wallet });
  } catch (error) {
    return next(error);
  }
});

router.post("/spend", requireAuth, async (req, res, next) => {
  try {
    const amountCents = Number(req.body?.amountCents || 0);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ error: "amountCents must be > 0" });
    }

    const wallet = await withTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO wallets (user_id, balance_cents, currency, created_at, updated_at)
        VALUES ($1, 0, 'ZAR', NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING
        `,
        [req.auth.userId]
      );

      const balanceResult = await client.query(
        "SELECT balance_cents FROM wallets WHERE user_id = $1 LIMIT 1",
        [req.auth.userId]
      );
      const currentBalance = Number(balanceResult.rows[0]?.balance_cents || 0);
      if (currentBalance < amountCents) {
        const err = new Error("Insufficient wallet balance");
        err.statusCode = 400;
        throw err;
      }

      const walletResult = await client.query(
        `
        UPDATE wallets
        SET balance_cents = balance_cents - $1, updated_at = NOW()
        WHERE user_id = $2
        RETURNING *
        `,
        [amountCents, req.auth.userId]
      );

      await client.query(
        `
        INSERT INTO wallet_transactions (id, user_id, type, amount_cents, note, created_at)
        VALUES (gen_random_uuid(), $1, 'DEBIT', $2, $3, NOW())
        `,
        [req.auth.userId, -amountCents, req.body?.note || "Wallet spend"]
      );

      return walletResult.rows[0];
    });

    return res.json({ wallet });
  } catch (error) {
    if (error?.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
});

export default router;
