# CapeConnect TODO

Practical next steps to move the project from its current demo-heavy state toward a cleaner production-ready state.

## P0

- [x] Update the API spec in `backend/openapi.yml` so it matches the actual backend:
  - session-token auth instead of JWT wording
  - real role names (`passenger`, `operator_admin`, `super_admin`)
  - current request/response shapes for auth, tickets, wallets, payments, and admin routes
  - string/UUID-style IDs instead of integer-only assumptions

- [x] Harden PayFast webhook reconciliation in `backend/src/routes/payments.js`:
  - call `validatePayment()` from `backend/src/services/payfast.js`
  - reject mismatched amount/reference/user details
  - make duplicate webhook processing idempotent
  - add explicit audit/error logging for payment reconciliation outcomes

- [ ] Make backend and E2E test execution reliable on Windows and CI:
  - review `npm` invocation in `playwright.config.js`
  - document Windows-safe commands
  - remove environment-specific runner failures like `spawn EPERM`
  - confirm `backend` tests and Playwright can be started consistently       

## P1

- [ ] Decide the canonical frontend path:
  - keep the static HTML frontend as the live app and trim React down
  - or continue building `frontend-react/` into the real app path

- [ ] If React stays, align it with the live backend:
  - fix response-shape mismatches in `frontend-react/src/pages/TicketsPage.jsx`
  - fix response-shape mismatches in `frontend-react/src/pages/WalletPage.jsx`
  - remove remaining mock/demo assumptions from `frontend-react/src/App.jsx`

- [ ] Improve monitoring and operational visibility:
  - payment failure monitoring
  - auth failure / lockout monitoring
  - ticket purchase and QR verification error reporting
  - alerting around critical backend failures

## P2

- [ ] Clean up duplicate and legacy frontend surfaces in the repo root:
  - identify which HTML pages are still canonical
  - remove or archive obsolete variants
  - reduce parallel flows that describe the same journey

- [ ] Strengthen deployment operations:
  - migration workflow for production changes
  - backup and restore procedure
  - rollback guidance
  - environment validation and startup checks

- [ ] Review QR verification for operational use:
  - validator/conductor role expectations
  - permission boundaries
  - audit logging
  - user-facing failure states

## Suggested Order

1. Sync `backend/openapi.yml` with the real API.
2. Harden payment reconciliation and add tests.
3. Fix test runner reliability.
4. Choose the canonical frontend path.
5. Clean up duplicate surfaces and improve ops documentation.
