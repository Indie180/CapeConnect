# CapeConnect Project Overview

## Summary

CapeConnect is a transit ticketing platform for MyCiTi and Golden Arrow. The current live path is the root static frontend backed by the Node.js API in `backend/`.

## Current Live Structure

```text
capeconnect/
├── backend/                     # API, auth, tickets, wallets, admin routes
├── css/                         # Shared frontend styles
├── js/                          # Shared frontend logic and API client
├── login.html                   # Login
├── signup.html                  # Signup
├── forgot-password.html         # Password reset request
├── reset-password.html          # Password reset completion
├── choose-bus.html              # Service selection
├── myciti-dashboard.html        # MyCiTi passenger dashboard
├── golden-arrow-dashboard.html  # Golden Arrow passenger dashboard
├── admin.html                   # Single operator-scoped admin portal
├── e2e/                         # Playwright tests
├── test/                        # Root smoke tests
└── frontend-react/              # Separate React app, not the current live path
```

## Backend

- Express.js API
- SQLite for local/dev and PostgreSQL for production
- Bearer session auth with refresh tokens
- Backend-owned wallet, ticket, profile, and admin operations
- Health and readiness endpoints
- Structured error logging with request IDs

## Frontend

- Static HTML/CSS/JS flow at repo root
- Split MyCiTi and Golden Arrow dashboards
- Backend-backed auth, wallet, tickets, profile, and password reset
- Operator-specific booking and timetable flows

## Testing

- Root smoke tests in `test/`
- Backend integration tests in `backend/test/api.test.js`
- Playwright E2E flows in `e2e/auth-flow.spec.js`

## Status

The obsolete legacy SPA router stack and duplicate admin entry points have been removed from the live path. The main remaining work is incremental hardening and doc cleanup tracked in `PRODUCTION_CHECKLIST.md`.
