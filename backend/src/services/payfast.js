import crypto from 'crypto';
import fetch from 'node-fetch';
import { log, serializeError } from '../utils/logger.js';
import { config } from '../config.js';

class PayFastService {
  constructor() {
    this.merchantId = config.payfastMerchantId;
    this.merchantKey = config.payfastMerchantKey;
    this.passphrase = config.payfastPassphrase;
    this.sandbox = config.env !== 'production';
    this.baseUrl = this.sandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';
  }

  generateSignature(data) {
    // Create parameter string for signature according to PayFast specs
    // PayFast is very strict about signature generation
    const pfParamString = Object.keys(data)
      .sort()
      .filter(key => key !== 'signature') // Exclude signature from signature generation
      .filter(key => data[key] !== null && data[key] !== undefined && data[key] !== '') // Exclude empty values
      .map(key => {
        // Ensure values are properly formatted for PayFast
        let value = String(data[key]).trim();
        // PayFast expects specific formatting for certain fields
        if (key === 'amount') {
          // Ensure amount has exactly 2 decimal places
          value = parseFloat(value).toFixed(2);
        }
        return `${key}=${value}`;
      })
      .join('&');
    
    // Add passphrase if provided (without URL encoding)
    const signatureString = this.passphrase 
      ? pfParamString + '&passphrase=' + this.passphrase.trim()
      : pfParamString;
    
    const signature = crypto.createHash('md5').update(signatureString).digest('hex');
    
    return signature;
  }

  createPaymentData(amount, userId, userEmail, description, paymentId) {
    // Convert cents to rands for PayFast
    const amountInRands = (amount / 100).toFixed(2);
    
    // Create minimal PayFast data to avoid signature issues
    const data = {
      // Merchant details
      merchant_id: this.merchantId,
      merchant_key: this.merchantKey,
      
      // URLs
      return_url: `${config.frontendUrl}/payment-success.html`,
      cancel_url: `${config.frontendUrl}/payment-cancel.html`,
      notify_url: `${config.apiUrl}/api/payments/payfast/webhook`,
      
      // Customer details
      name_first: 'Test',
      name_last: 'User',
      email_address: userEmail,
      
      // Payment details
      m_payment_id: `CC_${paymentId}_${Date.now()}`,
      amount: amountInRands,
      item_name: description,
      item_description: description,
      
      // Custom fields for our tracking
      custom_str1: userId.toString(),
      custom_str2: 'wallet_topup',
      custom_str3: paymentId.toString(),
    };

    // Generate and add signature
    data.signature = this.generateSignature(data);
    
    return data;
  }

  verifyWebhook(postData) {
    if (!postData.signature) {
      return false;
    }

    const receivedSignature = postData.signature;
    const dataForSignature = { ...postData };
    delete dataForSignature.signature;
    
    const calculatedSignature = this.generateSignature(dataForSignature);
    return receivedSignature === calculatedSignature;
  }

  async validatePayment(paymentData) {
    try {
      // PayFast validation endpoint
      const validationUrl = this.sandbox 
        ? 'https://sandbox.payfast.co.za/eng/query/validate'
        : 'https://www.payfast.co.za/eng/query/validate';

      const response = await fetch(validationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(paymentData).toString(),
      });

      const result = await response.text();
      return result.trim() === 'VALID';
    } catch (error) {
      log('error', 'PayFast validation error', { error: serializeError(error) });
      return false;
    }
  }

  getPaymentStatus(paymentStatus) {
    switch (paymentStatus?.toUpperCase()) {
      case 'COMPLETE':
        return 'COMPLETED';
      case 'FAILED':
        return 'FAILED';
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }
}

export default new PayFastService();