import QRCode from 'qrcode';
import crypto from 'crypto';
import { log, serializeError } from '../utils/logger.js';
import { config } from '../config.js';

class QRCodeService {
  /**
   * Generate a secure QR code for a ticket
   * @param {Object} ticket - The ticket object
   * @returns {Promise<Object>} QR code data and image
   */
  async generateTicketQR(ticket) {
    try {
      // Create a secure ticket verification payload
      const qrPayload = {
        ticketId: ticket.id,
        userId: ticket.user_id,
        operator: ticket.operator,
        productName: ticket.product_name,
        validFrom: ticket.valid_from,
        validUntil: ticket.valid_until,
        journeysIncluded: ticket.journeys_included,
        journeysUsed: ticket.journeys_used,
        status: ticket.status,
        timestamp: Date.now()
      };

      // Create a verification hash to prevent tampering
      const verificationHash = this.createVerificationHash(qrPayload);
      qrPayload.hash = verificationHash;

      // Convert to JSON string for QR code
      const qrData = JSON.stringify(qrPayload);

      // Generate QR code as data URL (base64 image)
      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      // Also generate as SVG for better scalability
      const qrCodeSVG = await QRCode.toString(qrData, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      return {
        qrData: qrData,
        qrCodeDataURL: qrCodeDataURL,
        qrCodeSVG: qrCodeSVG,
        verificationHash: verificationHash,
        expiresAt: ticket.valid_until
      };

    } catch (error) {
      log('error', 'QR code generation error', { error: serializeError(error) });
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Verify a QR code payload
   * @param {Object} qrPayload - The decoded QR payload
   * @returns {boolean} Whether the QR code is valid
   */
  verifyTicketQR(qrPayload) {
    try {
      if (!qrPayload || !qrPayload.hash) {
        return false;
      }

      const { hash, ...dataToVerify } = qrPayload;
      const expectedHash = this.createVerificationHash(dataToVerify);

      return hash === expectedHash;
    } catch (error) {
      log('error', 'QR code verification error', { error: serializeError(error) });
      return false;
    }
  }

  /**
   * Create a verification hash for QR code security
   * @param {Object} data - Data to hash
   * @returns {string} Verification hash
   */
  createVerificationHash(data) {
    const secret = config.qrSecret;
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHmac('sha256', secret).update(dataString).digest('hex');
  }

  /**
   * Generate a simple QR code for any text/URL
   * @param {string} text - Text to encode
   * @param {Object} options - QR code options
   * @returns {Promise<string>} QR code data URL
   */
  async generateSimpleQR(text, options = {}) {
    const defaultOptions = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256,
      ...options
    };

    return await QRCode.toDataURL(text, defaultOptions);
  }
}

export default new QRCodeService();