-- Add payment processing tables
-- Migration: 2026-03-23_add_payments_tables.sql

-- Payments table for tracking all payment transactions
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL, -- Amount in cents
    currency VARCHAR(3) NOT NULL DEFAULT 'ZAR',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, COMPLETED, FAILED, CANCELLED, REFUNDED
    payment_method VARCHAR(20) NOT NULL DEFAULT 'PAYFAST',
    
    -- PayFast specific fields
    payfast_payment_id VARCHAR(100),
    payfast_pf_payment_id VARCHAR(100), -- PayFast's internal payment ID
    
    -- Transaction details
    description TEXT,
    reference VARCHAR(100) UNIQUE NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enhanced wallet transactions table
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL, -- Positive for credit, negative for debit
    type VARCHAR(20) NOT NULL, -- TOPUP, PURCHASE, REFUND, ADJUSTMENT
    description TEXT,
    
    -- Related records
    payment_id UUID REFERENCES payments(id),
    ticket_id UUID REFERENCES tickets(id),
    
    -- Balance tracking
    balance_before_cents BIGINT,
    balance_after_cents BIGINT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment webhooks log for debugging
CREATE TABLE IF NOT EXISTS payment_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id),
    webhook_data JSONB NOT NULL,
    signature_valid BOOLEAN,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_reference ON payments(reference);
CREATE INDEX IF NOT EXISTS idx_payments_payfast_payment_id ON payments(payfast_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_payment_id ON wallet_transactions(payment_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_payment_id ON payment_webhooks(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_processed ON payment_webhooks(processed);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_created_at ON payment_webhooks(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE payments IS 'All payment transactions including top-ups and purchases';
COMMENT ON TABLE wallet_transactions IS 'Detailed wallet transaction history with balance tracking';
COMMENT ON TABLE payment_webhooks IS 'Log of all payment webhook calls for debugging and audit';

COMMENT ON COLUMN payments.amount_cents IS 'Payment amount in cents (e.g., 5000 = R50.00)';
COMMENT ON COLUMN payments.reference IS 'Unique payment reference for tracking';
COMMENT ON COLUMN wallet_transactions.amount_cents IS 'Transaction amount in cents (positive = credit, negative = debit)';
COMMENT ON COLUMN wallet_transactions.balance_before_cents IS 'Wallet balance before this transaction';
COMMENT ON COLUMN wallet_transactions.balance_after_cents IS 'Wallet balance after this transaction';