/**
 * Wallet Service - Backend Integration
 * 
 * Provides comprehensive wallet management functionality including:
 * - Real-time balance display and updates
 * - Transaction history retrieval and management
 * - Wallet top-up with PayFast integration
 * - Balance validation and insufficient funds protection
 * - Automatic balance synchronization
 * - Transaction categorization and filtering
 * 
 * Requirements: 3.1, 3.2, 3.4, 3.6, 3.7
 */

import { apiClient } from './api-client.js';
import { EventEmitter } from './event-emitter.js';

class WalletService extends EventEmitter {
    constructor() {
        super();
        this.wallet = null;
        this.transactions = [];
        this.isLoading = false;
        this.lastSyncTime = null;
        this.syncInterval = null;
        this.balanceThreshold = 500; // 5 ZAR in cents for low balance warnings
        
        // Start automatic balance sync every 30 seconds
        this.startAutoSync();
        
        // Listen for authentication changes
        this.on('auth:logout', () => this.clearWalletData());
    }

    /**
     * Get current wallet data with real-time balance
     * @returns {Promise<Object>} Wallet data with balance and transactions
     */
    async getWallet() {
        try {
            this.isLoading = true;
            this.emit('wallet:loading', true);

            const response = await apiClient.get('/wallets/me');
            
            if (response.success) {
                this.wallet = response.data.wallet;
                this.transactions = response.data.transactions || [];
                this.lastSyncTime = new Date();
                
                // Check for low balance and emit warning
                this.checkLowBalance();
                
                this.emit('wallet:updated', {
                    wallet: this.wallet,
                    transactions: this.transactions
                });
                
                return {
                    success: true,
                    wallet: this.wallet,
                    transactions: this.transactions
                };
            } else {
                throw new Error(response.error || 'Failed to fetch wallet data');
            }
        } catch (error) {
            console.error('Wallet fetch error:', error);
            this.emit('wallet:error', error.message);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isLoading = false;
            this.emit('wallet:loading', false);
        }
    }

    /**
     * Get current balance in cents
     * @returns {number} Balance in cents
     */
    getBalance() {
        return this.wallet?.balance_cents || 0;
    }

    /**
     * Get formatted balance in ZAR
     * @returns {string} Formatted balance (e.g., "R 25.50")
     */
    getFormattedBalance() {
        const balance = this.getBalance() / 100;
        return `R ${balance.toFixed(2)}`;
    }

    /**
     * Check if user has sufficient balance for a transaction
     * @param {number} amountCents - Amount in cents to check
     * @returns {boolean} True if sufficient balance
     */
    hasSufficientBalance(amountCents) {
        return this.getBalance() >= amountCents;
    }

    /**
     * Top up wallet with specified amount using PayFast
     * @param {number} amountCents - Amount to top up in cents
     * @param {string} note - Optional note for the transaction
     * @param {Object} options - Payment options
     * @returns {Promise<Object>} Top-up result
     */
    async topUpWallet(amountCents, note = 'Wallet top-up', options = {}) {
        try {
            if (amountCents <= 0) {
                throw new Error('Top-up amount must be greater than zero');
            }

            if (amountCents > 1000000) { // 10,000 ZAR limit
                throw new Error('Top-up amount exceeds maximum limit of R 10,000');
            }

            this.emit('wallet:topup:started', { amountCents, note });

            // For amounts over R50, use PayFast payment gateway
            if (amountCents >= 5000) {
                return await this.topUpWithPayFast(amountCents, note, options);
            } else {
                // For smaller amounts, use direct wallet top-up (for testing/demo)
                return await this.topUpDirect(amountCents, note);
            }
        } catch (error) {
            console.error('Wallet top-up error:', error);
            this.emit('wallet:topup:error', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Top up wallet using PayFast payment gateway
     * @param {number} amountCents - Amount to top up in cents
     * @param {string} note - Transaction note
     * @param {Object} options - Payment options
     * @returns {Promise<Object>} PayFast payment result
     */
    async topUpWithPayFast(amountCents, note, options = {}) {
        try {
            // Import PayFast service dynamically to avoid circular dependencies
            const { payFastService } = await import('./payfast-service.js');
            
            const description = `CapeConnect Wallet Top-up - ${note}`;
            
            const result = await payFastService.initiatePayment(amountCents, description, {
                returnUrl: `${window.location.origin}/payment-success.html`,
                cancelUrl: `${window.location.origin}/payment-cancel.html`,
                ...options
            });

            if (result.success) {
                this.emit('wallet:topup:payfast:initiated', {
                    amountCents,
                    paymentId: result.paymentId,
                    note
                });

                return {
                    success: true,
                    paymentMethod: 'payfast',
                    paymentId: result.paymentId,
                    message: 'Redirecting to PayFast for payment...'
                };
            } else {
                throw new Error(result.error || 'Failed to initiate PayFast payment');
            }
        } catch (error) {
            console.error('PayFast top-up error:', error);
            throw error;
        }
    }

    /**
     * Direct wallet top-up (for smaller amounts or testing)
     * @param {number} amountCents - Amount to top up in cents
     * @param {string} note - Transaction note
     * @returns {Promise<Object>} Direct top-up result
     */
    async topUpDirect(amountCents, note) {
        try {
            const response = await apiClient.post('/wallets/topup', {
                amountCents,
                note
            });

            if (response.success) {
                this.wallet = response.data.wallet;
                
                // Refresh transaction history
                await this.getWallet();
                
                this.emit('wallet:topup:success', {
                    wallet: this.wallet,
                    amountCents,
                    note
                });

                return {
                    success: true,
                    paymentMethod: 'direct',
                    wallet: this.wallet,
                    message: 'Wallet topped up successfully'
                };
            } else {
                throw new Error(response.error || 'Failed to top up wallet');
            }
        } catch (error) {
            console.error('Direct wallet top-up error:', error);
            throw error;
        }
    }

    /**
     * Spend from wallet (used internally by ticket purchases)
     * @param {number} amountCents - Amount to spend in cents
     * @param {string} note - Transaction note
     * @returns {Promise<Object>} Spend result
     */
    async spendFromWallet(amountCents, note = 'Wallet spend') {
        try {
            if (amountCents <= 0) {
                throw new Error('Spend amount must be greater than zero');
            }

            if (!this.hasSufficientBalance(amountCents)) {
                throw new Error('Insufficient wallet balance');
            }

            this.emit('wallet:spend:started', { amountCents, note });

            const response = await apiClient.post('/wallets/spend', {
                amountCents,
                note
            });

            if (response.success) {
                this.wallet = response.data.wallet;
                
                // Refresh transaction history
                await this.getWallet();
                
                this.emit('wallet:spend:success', {
                    wallet: this.wallet,
                    amountCents,
                    note
                });

                return {
                    success: true,
                    wallet: this.wallet,
                    message: 'Payment processed successfully'
                };
            } else {
                throw new Error(response.error || 'Failed to process payment');
            }
        } catch (error) {
            console.error('Wallet spend error:', error);
            this.emit('wallet:spend:error', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get transaction history with filtering and pagination
     * @param {Object} options - Filter options
     * @returns {Array} Filtered transactions
     */
    getTransactionHistory(options = {}) {
        let filteredTransactions = [...this.transactions];

        // Filter by type
        if (options.type) {
            filteredTransactions = filteredTransactions.filter(tx => 
                tx.type.toLowerCase() === options.type.toLowerCase()
            );
        }

        // Filter by date range
        if (options.startDate) {
            const startDate = new Date(options.startDate);
            filteredTransactions = filteredTransactions.filter(tx => 
                new Date(tx.created_at) >= startDate
            );
        }

        if (options.endDate) {
            const endDate = new Date(options.endDate);
            filteredTransactions = filteredTransactions.filter(tx => 
                new Date(tx.created_at) <= endDate
            );
        }

        // Pagination
        if (options.limit) {
            filteredTransactions = filteredTransactions.slice(0, options.limit);
        }

        return filteredTransactions.map(tx => ({
            ...tx,
            formattedAmount: this.formatTransactionAmount(tx),
            formattedDate: this.formatTransactionDate(tx.created_at),
            displayType: this.getTransactionDisplayType(tx.type)
        }));
    }

    /**
     * Format transaction amount for display
     * @param {Object} transaction - Transaction object
     * @returns {string} Formatted amount
     */
    formatTransactionAmount(transaction) {
        const amount = Math.abs(transaction.amount_cents) / 100;
        const sign = transaction.amount_cents >= 0 ? '+' : '-';
        return `${sign}R ${amount.toFixed(2)}`;
    }

    /**
     * Format transaction date for display
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date
     */
    formatTransactionDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return 'Today ' + date.toLocaleTimeString('en-ZA', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else if (diffDays === 1) {
            return 'Yesterday ' + date.toLocaleTimeString('en-ZA', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else if (diffDays < 7) {
            return date.toLocaleDateString('en-ZA', { 
                weekday: 'long',
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else {
            return date.toLocaleDateString('en-ZA', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }

    /**
     * Get user-friendly transaction type display
     * @param {string} type - Transaction type
     * @returns {string} Display type
     */
    getTransactionDisplayType(type) {
        const typeMap = {
            'TOPUP': 'Top-up',
            'DEBIT': 'Payment',
            'REFUND': 'Refund',
            'TICKET_PURCHASE': 'Ticket Purchase',
            'WALLET_TRANSFER': 'Transfer'
        };
        return typeMap[type] || type;
    }

    /**
     * Check for low balance and emit warning
     */
    checkLowBalance() {
        if (this.wallet && this.getBalance() <= this.balanceThreshold) {
            this.emit('wallet:low-balance', {
                balance: this.getBalance(),
                formattedBalance: this.getFormattedBalance(),
                threshold: this.balanceThreshold
            });
        }
    }

    /**
     * Start automatic balance synchronization
     */
    startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(async () => {
            // Only sync if user is authenticated and not currently loading
            if (!this.isLoading && apiClient.isAuthenticated()) {
                try {
                    await this.getWallet();
                } catch (error) {
                    console.warn('Auto-sync failed:', error.message);
                }
            }
        }, 30000); // Sync every 30 seconds
    }

    /**
     * Stop automatic balance synchronization
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Clear wallet data (called on logout)
     */
    clearWalletData() {
        this.wallet = null;
        this.transactions = [];
        this.lastSyncTime = null;
        this.stopAutoSync();
        this.emit('wallet:cleared');
    }

    /**
     * Get wallet statistics
     * @returns {Object} Wallet statistics
     */
    getWalletStats() {
        if (!this.transactions.length) {
            return {
                totalSpent: 0,
                totalTopUps: 0,
                transactionCount: 0,
                averageTransaction: 0
            };
        }

        const spent = this.transactions
            .filter(tx => tx.amount_cents < 0)
            .reduce((sum, tx) => sum + Math.abs(tx.amount_cents), 0);

        const topUps = this.transactions
            .filter(tx => tx.amount_cents > 0)
            .reduce((sum, tx) => sum + tx.amount_cents, 0);

        return {
            totalSpent: spent,
            totalTopUps: topUps,
            transactionCount: this.transactions.length,
            averageTransaction: Math.abs(spent / this.transactions.filter(tx => tx.amount_cents < 0).length) || 0,
            formattedTotalSpent: `R ${(spent / 100).toFixed(2)}`,
            formattedTotalTopUps: `R ${(topUps / 100).toFixed(2)}`,
            formattedAverageTransaction: `R ${((spent / this.transactions.filter(tx => tx.amount_cents < 0).length) / 100 || 0).toFixed(2)}`
        };
    }

    /**
     * Validate wallet operation before execution
     * @param {string} operation - Operation type
     * @param {Object} params - Operation parameters
     * @returns {Object} Validation result
     */
    validateOperation(operation, params) {
        switch (operation) {
            case 'topup':
                if (!params.amountCents || params.amountCents <= 0) {
                    return { valid: false, error: 'Top-up amount must be greater than zero' };
                }
                if (params.amountCents > 1000000) {
                    return { valid: false, error: 'Top-up amount exceeds maximum limit' };
                }
                break;

            case 'spend':
                if (!params.amountCents || params.amountCents <= 0) {
                    return { valid: false, error: 'Spend amount must be greater than zero' };
                }
                if (!this.hasSufficientBalance(params.amountCents)) {
                    return { valid: false, error: 'Insufficient wallet balance' };
                }
                break;

            default:
                return { valid: false, error: 'Unknown operation' };
        }

        return { valid: true };
    }
}

// Create and export singleton instance
export const walletService = new WalletService();
export default walletService;