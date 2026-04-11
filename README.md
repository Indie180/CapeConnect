# CapeConnect - Complete Transit System

A transit ticketing and wallet management platform for Cape Town operators: MyCiTi and Golden Arrow.

## Project Structure

```text
CapeConnect/
├── login.html                   # Live login page
├── signup.html                  # Live signup page
├── choose-bus.html              # Service selection
├── myciti-dashboard.html        # MyCiTi passenger dashboard
├── golden-arrow-dashboard.html  # Golden Arrow passenger dashboard
├── admin.html                   # Canonical admin portal
├── js/                          # Shared frontend logic
├── css/                         # Shared frontend styles
├── backend/                     # Node.js API
├── e2e/                         # Playwright end-to-end tests
└── test/                        # Root smoke tests
```

## Features

### Passenger Features
- Operator selection
- Backend-authenticated login and signup
- Split MyCiTi and Golden Arrow dashboards
- Ticket booking and management
- Wallet balance and top-up
- Route and timetable flows

### Admin Features
- Operator-scoped admin portal
- User, ticket, wallet, fare, timetable, and audit tooling through the backend API

## Getting Started

### Frontend Preview

From the repo root:

```bash
npm run dev:frontend
```

Open:

```text
http://127.0.0.1:4173/login.html
```

### Backend API

```bash
npm run dev:backend
```

The backend runs on `http://localhost:4000` by default.
In development, the backend now allows both `http://localhost:4173` and `http://127.0.0.1:4173` by default.

## Current Architecture

- The live frontend is the root static HTML flow, not the old SPA router stack.
- Auth, wallet, tickets, profile updates, and admin access are backend-backed.
- Frontend publish decision: see `docs/FRONTEND_DECISION.md`.

## Testing

Root smoke tests:

```bash
npm run test
```

End-to-end tests:

```bash
npm run test:e2e
```

This command starts the static frontend and test backend automatically, then runs the browser flow suite with a direct Playwright-driven Chromium script.
The same root `test:e2e` path is used for local runs and CI.
If Chromium launch is blocked by the local shell or sandbox, rerun it in a normal terminal session outside that restricted environment.

Backend integration tests:

```bash
cd backend
npm test
```

## Release Gate

Before publish, the GitHub Actions workflow in `.github/workflows/ci.yml` should be green on a real remote run:

- root static tests pass
- root Playwright tests pass
- backend lint and tests pass

Local runs are useful, but they do not replace a verified remote CI pass.

## Docs

- Backend API and deployment details: `backend/README.md` and `backend/DEPLOYMENT.md`
- Hosting decision and publish-time host validation status: `DEPLOYMENT.md`
- Launch checklist for Netlify + Railway: `LAUNCH_CHECKLIST.md`
- Production progress tracker: `PRODUCTION_CHECKLIST.md`
- Frontend publish-path docs: `docs/FRONTEND_DECISION.md` and `docs/CANONICAL_SURFACES.md`

## Recommended Hosting

Recommended production target: `Netlify` for the root static frontend and `Railway + PostgreSQL` for `backend/`.
