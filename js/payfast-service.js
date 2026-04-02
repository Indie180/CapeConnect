/**
 * PayFast Payment Integration Service
 * 
 * Handles secure payment processing with PayFast for wallet top-ups
 * Provides payment form generation, redirect handling, and webhook processing
 * 
 * Requirements: 3.2, 6.1, 6.2, 6.3, 6.7
 */

import { apiClient } from './api-client.js';
import { EventEmitter } from './event-emitter.js';

class PayFastService extends EventEmitter {
    constructor() {
        super();
        this.isProcessing = false;
        this.currentPayment = null;
        this.paymentWindow = null;
        
        // Listen for payment completion messages
        this.setupMessageListener();
    }

    /**
     * Initiate PayFast payment for wallet top-up
     * @param {number} amountCents - Amount in cents
     * @param {string} description - Payment description
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} Payment initiation result
     */
    async initiatePayment(amountCents, description = 'Wallet Top-up', options = {}) {
        try {
            if (this.isProcessing) {
                throw new Error('Another payment is already in progress');
            }

            if (amountCents <= 0) {
                throw new Error('Payment amount must be greater than zero');
            }

            if (amountCents > 1000000) { // R10,000 limit
                throw new Error('Payment amount exceeds maximum limit of R 10,000');
            }

            this.isProcessing = true;
            this.emit('payment:started', { amountCents, description });

            // Create payment with backend
            const response = await apiClient.post('/payments/create', {
                amountCents,
                description,
                paymentMethod: 'payfast',
                returnUrl: options.returnUrl || `${window.location.origin}/payment-success.html`,
                cancelUrl: options.cancelUrl || `${window.location.origin}/payment-cancel.html`,
                ...options
            });

            if (response.success) {
                this.currentPayment = response.data;
                
                // Generate PayFast form and redirect
                await this.redirectToPayFast(response.data);
                
                return {
                    success: true,
                    paymentId: response.data.paymentId,
                    message: 'Redirecting to PayFast...'
                };
            } else {
                throw new Error(response.error || 'Failed to create payment');
            }
        } catch (error) {
            console.error('PayFast payment initiation error:', error);
            this.emit('payment:error', error.message);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Redirect to PayFast payment page
     * @param {Object} paymentData - Payment data from backend
     */
    async redirectToPayFast(paymentData) {
        try {
            // Create a form with PayFast data
            const form = this.createPayFastForm(paymentData);
            
            // Add form to page and submit
            document.body.appendChild(form);
            
            this.emit('payment:redirecting', paymentData);
            
            // Submit form to redirect to PayFast
            form.submit();
            
            // Clean up form after submission
            setTimeout(() => {
                if (form.parentNode) {
                    form.parentNode.removeChild(form);
                }
            }, 1000);
            
        } catch (error) {
            console.error('PayFast redirect error:', error);
            this.emit('payment:error', 'Failed to redirect to PayFast');
            throw error;
        }
    }

    /**
     * Create PayFast payment form
     * @param {Object} paymentData - Payment data
     * @returns {HTMLFormElement} PayFast form
     */
    createPayFastForm(paymentData) {
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = paymentData.paymentUrl || 'https://sandbox.payfast.co.za/eng/process';
        form.style.display = 'none';

        // Add all PayFast fields
        Object.entries(paymentData.formData || {}).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = String(value);
                form.appendChild(input);
            }
        });

        return form;
    }

    /**
     * Handle payment completion (called from success/cancel pages)
     * @param {string} status - Payment status
     * @param {Object} data - Payment data
     * @returns {Promise<Object>} Completion result
     */
    async handlePaymentCompletion(status, data = {}) {
        try {
            if (!this.currentPayment) {
                throw new Error('No active payment found');
            }

            const response = await apiClient.post('/payments/complete', {
                paymentId: this.currentPayment.paymentId,
                status,
                ...data
            });

            if (response.success) {
                this.emit('payment:completed', {
                    status,
                    payment: response.data,
                    wallet: response.data.wallet
                });

                // Clear current payment
                this.currentPayment = null;

                return {
                    success: true,
                    payment: response.data,
                    message: status === 'success' ? 'Payment completed successfully' : 'Payment was cancelled'
                };
            } else {
                throw new Error(response.error || 'Failed to complete payment');
            }
        } catch (error) {
            console.error('Payment completion error:', error);
            this.emit('payment:error', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check payment status
     * @param {string} paymentId - Payment ID
     * @returns {Promise<Object>} Payment status
     */
    async checkPaymentStatus(paymentId) {
        try {
            const response = await apiClient.get(`/payments/${paymentId}/status`);
            
            if (response.success) {
                return {
                    success: true,
                    status: response.data.status,
                    payment: response.data
                };
            } else {
                throw new Error(response.error || 'Failed to check payment status');
            }
        } catch (error) {
            console.error('Payment status check error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Cancel current payment
     * @returns {Promise<Object>} Cancellation result
     */
    async cancelPayment() {
        try {
            if (!this.currentPayment) {
                return { success: true, message: 'No active payment to cancel' };
            }

            const response = await apiClient.post('/payments/cancel', {
                paymentId: this.currentPayment.paymentId
            });

            if (response.success) {
                this.emit('payment:cancelled', this.currentPayment);
                this.currentPayment = null;
                
                return {
                    success: true,
                    message: 'Payment cancelled successfully'
                };
            } else {
                throw new Error(response.error || 'Failed to cancel payment');
            }
        } catch (error) {
            console.error('Payment cancellation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Setup message listener for payment completion
     */
    setupMessageListener() {
        window.addEventListener('message', (event) => {
            // Only accept messages from PayFast domains
            const allowedOrigins = [
                'https://sandbox.payfast.co.za',
                'https://www.payfast.co.za',
                window.location.origin
            ];

            if (!allowedOrigins.includes(event.origin)) {
                return;
            }

            if (event.data && event.data.type === 'payfast_payment_complete') {
                this.handlePaymentCompletion(event.data.status, event.data.data);
            }
        });
    }

    /**
     * Get payment history
     * @param {Object} options - Filter options
     * @returns {Promise<Object>} Payment history
     */
    async getPaymentHistory(options = {}) {
        try {
            const queryParams = new URLSearchParams();
            
            if (options.limit) queryParams.append('limit', options.limit);
            if (options.status) queryParams.append('status', options.status);
            if (options.startDate) queryParams.append('startDate', options.startDate);
            if (options.endDate) queryParams.append('endDate', options.endDate);

            const response = await apiClient.get(`/payments/history?${queryParams.toString()}`);
            
            if (response.success) {
                return {
                    success: true,
                    payments: response.data.payments || [],
                    total: response.data.total || 0
                };
            } else {
                throw new Error(response.error || 'Failed to fetch payment history');
            }
        } catch (error) {
            console.error('Payment history error:', error);
            return {
                success: false,
                error: error.message,
                payments: []
            };
        }
    }

    /**
     * Validate payment amount
     * @param {number} amountCents - Amount in cents
     * @returns {Object} Validation result
     */
    validatePaymentAmount(amountCents) {
        if (!amountCents || amountCents <= 0) {
            return {
                valid: false,
                error: 'Payment amount must be greater than zero'
            };
        }

        if (amountCents < 100) { // Minimum R1.00
            return {
                valid: false,
                error: 'Minimum payment amount is R 1.00'
            };
        }

        if (amountCents > 1000000) { // Maximum R10,000
            return {
                valid: false,
                error: 'Maximum payment amount is R 10,000'
            };
        }

        return { valid: true };
    }

    /**
     * Format amount for display
     * @param {number} amountCents - Amount in cents
     * @returns {string} Formatted amount
     */
    formatAmount(amountCents) {
        return `R ${(amountCents / 100).toFixed(2)}`;
    }

    /**
     * Get current payment status
     * @returns {Object} Current payment info
     */
    getCurrentPayment() {
        return {
            isProcessing: this.isProcessing,
            payment: this.currentPayment
        };
    }

    /**
     * Clear current payment data
     */
    clearCurrentPayment() {
        this.currentPayment = null;
        this.isProcessing = false;
        this.emit('payment:cleared');
    }
}

// Create and export singleton instance
export const payFastService = new PayFastService();
export default payFastService;