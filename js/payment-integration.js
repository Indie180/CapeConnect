// PayFast Payment Integration for CapeConnect
// This module handles real payment processing via PayFast

(function() {
    'use strict';

    // Payment state management
    let currentPaymentId = null;
    let paymentStatusInterval = null;

    // Initialize payment integration
    function initPaymentIntegration() {
        // Add event listeners for wallet top-up buttons
        document.addEventListener('click', function(e) {
            if (e.target.matches('#btnTopUp, .btn-topup, [data-action="topup"]')) {
                e.preventDefault();
                showTopUpModal();
            }
        });

        // Handle payment status checking on success page
        if (window.location.pathname.includes('payment-success')) {
            handlePaymentSuccess();
        }
    }

    // Show wallet top-up modal with PayFast integration
    function showTopUpModal() {
        const modal = createTopUpModal();
        document.body.appendChild(modal);
        modal.style.display = 'flex';
    }

    // Create the top-up modal HTML
    function createTopUpModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Top Up Wallet</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="topup-form">
                        <div class="amount-selection">
                            <label>Select Amount:</label>
                            <div class="amount-buttons">
                                <button class="amount-btn" data-amount="1000">R10</button>
                                <button class="amount-btn" data-amount="2000">R20</button>
                                <button class="amount-btn" data-amount="5000">R50</button>
                                <button class="amount-btn" data-amount="10000">R100</button>
                                <button class="amount-btn" data-amount="20000">R200</button>
                                <button class="amount-btn" data-amount="50000">R500</button>
                            </div>
                        </div>
                        
                        <div class="custom-amount">
                            <label for="customAmount">Or enter custom amount:</label>
                            <div class="input-group">
                                <span class="input-prefix">R</span>
                                <input type="number" id="customAmount" min="10" max="1000" step="1" placeholder="0.00">
                            </div>
                        </div>
                        
                        <div class="payment-info">
                            <div class="info-box">
                                <h4>💳 Secure Payment via PayFast</h4>
                                <p>Your payment will be processed securely by PayFast, South Africa's leading payment gateway.</p>
                                <ul>
                                    <li>✓ Credit & Debit Cards accepted</li>
                                    <li>✓ Bank transfers (EFT)</li>
                                    <li>✓ Instant EFT</li>
                                    <li>✓ 256-bit SSL encryption</li>
                                </ul>
                            </div>
                        </div>
                        
                        <div class="selected-amount">
                            <strong>Amount to pay: <span id="selectedAmount">R0.00</span></strong>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" id="proceedPayment" disabled>Proceed to Payment</button>
                </div>
            </div>
        `;

        // Add event listeners
        modal.addEventListener('click', function(e) {
            // Amount button selection
            if (e.target.matches('.amount-btn')) {
                selectAmount(e.target.dataset.amount);
            }
            
            // Proceed to payment
            if (e.target.matches('#proceedPayment')) {
                initiatePayment();
            }
            
            // Close modal on overlay click
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Custom amount input
        const customAmountInput = modal.querySelector('#customAmount');
        customAmountInput.addEventListener('input', function() {
            const amount = parseFloat(this.value) * 100; // Convert to cents
            if (amount >= 1000 && amount <= 100000) {
                selectAmount(amount);
            } else {
                clearAmountSelection();
            }
        });

        return modal;
    }

    // Select payment amount
    function selectAmount(amountCents) {
        const modal = document.querySelector('.modal-overlay');
        if (!modal) return;

        // Clear previous selections
        modal.querySelectorAll('.amount-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        // Highlight selected button if it matches
        const matchingBtn = modal.querySelector(`[data-amount="${amountCents}"]`);
        if (matchingBtn) {
            matchingBtn.classList.add('selected');
        }

        // Update custom input if needed
        const customInput = modal.querySelector('#customAmount');
        if (!matchingBtn) {
            customInput.value = (amountCents / 100).toFixed(2);
        }

        // Update display
        const selectedAmountEl = modal.querySelector('#selectedAmount');
        selectedAmountEl.textContent = `R${(amountCents / 100).toFixed(2)}`;

        // Enable proceed button
        const proceedBtn = modal.querySelector('#proceedPayment');
        proceedBtn.disabled = false;
        proceedBtn.dataset.amount = amountCents;
    }

    // Clear amount selection
    function clearAmountSelection() {
        const modal = document.querySelector('.modal-overlay');
        if (!modal) return;

        modal.querySelectorAll('.amount-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        const selectedAmountEl = modal.querySelector('#selectedAmount');
        selectedAmountEl.textContent = 'R0.00';

        const proceedBtn = modal.querySelector('#proceedPayment');
        proceedBtn.disabled = true;
        delete proceedBtn.dataset.amount;
    }

    // Initiate PayFast payment
    async function initiatePayment() {
        const proceedBtn = document.querySelector('#proceedPayment');
        const amount = parseInt(proceedBtn.dataset.amount);

        if (!amount || amount < 1000 || amount > 100000) {
            showError('Please select a valid amount between R10 and R1000');
            return;
        }

        try {
            // Show loading state
            proceedBtn.disabled = true;
            proceedBtn.innerHTML = '<span class="loading"></span> Processing...';

            // Initiate payment via API
            const response = await CCApi.initiatePayment(amount);

            if (response.success) {
                // Store payment ID for status checking
                currentPaymentId = response.paymentId;
                
                // Redirect to PayFast
                CCApi.redirectToPayment(response.paymentUrl, response.paymentData);
            } else {
                throw new Error(response.error || 'Payment initiation failed');
            }

        } catch (error) {
            console.error('Payment initiation error:', error);
            showError(error.message || 'Failed to initiate payment. Please try again.');
            
            // Reset button
            proceedBtn.disabled = false;
            proceedBtn.innerHTML = 'Proceed to Payment';
        }
    }

    // Handle payment success page
    function handlePaymentSuccess() {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentId = urlParams.get('payment_id');
        
        if (paymentId) {
            // Start checking payment status
            checkPaymentStatus(paymentId);
        }
    }

    // Check payment status periodically
    async function checkPaymentStatus(paymentId, maxAttempts = 10) {
        let attempts = 0;
        
        const checkStatus = async () => {
            try {
                attempts++;
                const payment = await CCApi.getPaymentStatus(paymentId);
                
                if (payment.status === 'COMPLETED') {
                    // Payment successful - refresh wallet balance
                    if (typeof refreshWalletBalance === 'function') {
                        refreshWalletBalance();
                    }
                    clearInterval(paymentStatusInterval);
                    return;
                }
                
                if (payment.status === 'FAILED' || payment.status === 'CANCELLED') {
                    clearInterval(paymentStatusInterval);
                    return;
                }
                
                // Stop checking after max attempts
                if (attempts >= maxAttempts) {
                    clearInterval(paymentStatusInterval);
                }
                
            } catch (error) {
                console.error('Error checking payment status:', error);
                if (attempts >= maxAttempts) {
                    clearInterval(paymentStatusInterval);
                }
            }
        };
        
        // Check immediately, then every 3 seconds
        checkStatus();
        paymentStatusInterval = setInterval(checkStatus, 3000);
    }

    // Show error message
    function showError(message) {
        // Create or update error display
        let errorEl = document.querySelector('.payment-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'payment-error alert alert-error';
            const modal = document.querySelector('.modal-content .modal-body');
            if (modal) {
                modal.appendChild(errorEl);
            }
        }
        
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            if (errorEl) {
                errorEl.style.display = 'none';
            }
        }, 5000);
    }

    // Refresh wallet balance (to be called after successful payment)
    async function refreshWalletBalance() {
        try {
            if (typeof CCApi !== 'undefined' && CCApi.getWalletMe) {
                const wallet = await CCApi.getWalletMe();
                
                // Update wallet display elements
                const walletElements = document.querySelectorAll('[data-wallet-balance], .wallet-balance, #walletBalance');
                walletElements.forEach(el => {
                    el.textContent = `R${(wallet.balance / 100).toFixed(2)}`;
                });
                
                // Trigger custom event for other components
                document.dispatchEvent(new CustomEvent('walletUpdated', {
                    detail: { balance: wallet.balance }
                }));
            }
        } catch (error) {
            console.error('Error refreshing wallet balance:', error);
        }
    }

    // Add CSS styles
    function addPaymentStyles() {
        if (document.querySelector('#payment-integration-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'payment-integration-styles';
        styles.textContent = `
            .amount-buttons {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin: 10px 0;
            }
            
            .amount-btn {
                padding: 12px;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                background: white;
                cursor: pointer;
                font-weight: bold;
                transition: all 0.2s;
            }
            
            .amount-btn:hover {
                border-color: #3b82f6;
                background: #eff6ff;
            }
            
            .amount-btn.selected {
                border-color: #3b82f6;
                background: #3b82f6;
                color: white;
            }
            
            .input-group {
                display: flex;
                align-items: center;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                overflow: hidden;
            }
            
            .input-prefix {
                padding: 8px 12px;
                background: #f9fafb;
                border-right: 1px solid #d1d5db;
                font-weight: bold;
            }
            
            .input-group input {
                border: none;
                padding: 8px 12px;
                flex: 1;
                outline: none;
            }
            
            .info-box {
                background: #f0f9ff;
                border: 1px solid #0ea5e9;
                border-radius: 8px;
                padding: 16px;
                margin: 16px 0;
            }
            
            .info-box h4 {
                margin: 0 0 8px 0;
                color: #0c4a6e;
            }
            
            .info-box ul {
                margin: 8px 0 0 0;
                padding-left: 20px;
            }
            
            .info-box li {
                color: #0c4a6e;
                margin-bottom: 4px;
            }
            
            .selected-amount {
                text-align: center;
                padding: 16px;
                background: #f8fafc;
                border-radius: 8px;
                margin: 16px 0;
                font-size: 1.1em;
            }
            
            .loading {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .payment-error {
                margin-top: 16px;
                padding: 12px;
                background: #fef2f2;
                border: 1px solid #fca5a5;
                border-radius: 6px;
                color: #dc2626;
            }
        `;
        
        document.head.appendChild(styles);
    }

    // Public API
    window.PaymentIntegration = {
        init: initPaymentIntegration,
        showTopUpModal: showTopUpModal,
        refreshWalletBalance: refreshWalletBalance,
        checkPaymentStatus: checkPaymentStatus
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            addPaymentStyles();
            initPaymentIntegration();
        });
    } else {
        addPaymentStyles();
        initPaymentIntegration();
    }

})();