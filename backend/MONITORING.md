# Backend Monitoring

This file defines the minimum backend monitoring expectations for publish.

## Structured Event Format

Backend route logs now emit JSON with fields such as:

- `level`
- `message`
- `time`
- `requestId`
- `userId`
- `alert`
- `alertSeverity`
- `alertCategory`
- `alertCode`
- `runbook`

Alert-tagged events are intended to feed log-based alerting in your host, SIEM, or error tracker.

## Page-Worthy Alerts

These should trigger an immediate production alert:

- `payment_webhook_amount_mismatch`
- `payment_webhook_processing_error`
- `payment_webhook_invalid_signature`
- `payment_webhook_provider_validation_failed`
- `payment_webhook_payment_not_found`
- `auth_login_error`
- `auth_register_error`
- `auth_reset_password_error`
- `auth_change_password_error`
- `ticket_qr_verify_error`

## Warn / Investigate Alerts

These should be monitored and escalated if they spike:

- `auth_forgot_password_error`
- `auth_logout_error`
- repeated `auth_login_failed`
- repeated `wallet_spend_rejected`
- repeated `ticket_create_rejected`
- repeated `ticket_qr_verify_rejected`

## Current Event Sources

- Auth flows: `backend/src/routes/auth.js`
- Ticket and QR flows: `backend/src/routes/tickets.js`
- Wallet flows: `backend/src/routes/wallets.js`
- Payment and webhook flows: `backend/src/routes/payments.js`
- Unhandled request errors: `backend/src/middleware/errorHandler.js`

## Minimum Production Wiring

1. Send backend stdout/stderr to a centralized log system.
2. Create alert rules for `alert=true`.
3. Route `alertSeverity=critical` and `alertSeverity=high` to immediate notification.
4. Route `alertSeverity=medium` to a lower-priority operational channel.
5. Keep at least request path, request ID, and user ID in retained logs where available.

## Release Gate

Before publish, verify:

1. alert-tagged logs appear in the production logging destination
2. one test alert can be observed end to end
3. payment webhook alert rules are active
4. auth error alert rules are active
5. QR verification error alert rules are active
