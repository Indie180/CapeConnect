# CapeConnect Testing Guide

Current test guidance for the canonical repo-root static frontend and Node backend.

## Automated Commands

Run these from the repo root unless noted:

```bash
npm test
npm run test:e2e
cd backend
npm test
```

What they cover:
- `npm test`: root smoke tests for the static frontend surface
- `npm run test:e2e`: starts the static server and backend, then runs the browser flow suite
- `cd backend && npm test`: backend integration tests against the SQLite test setup

Windows note:
- The local E2E flow uses a direct Chromium runner instead of the Playwright worker runner.
- If browser launch fails with `spawn EPERM`, rerun `npm run test:e2e` in a normal local terminal outside a restricted sandbox.

## Local Manual Setup

Frontend:

```bash
npm run dev:frontend
```

Backend:

```bash
npm run dev:backend
```

Open:
- `http://127.0.0.1:4173/login.html`
- `http://127.0.0.1:4000/health`

Development defaults now allow both `localhost` and `127.0.0.1` for the frontend origin.

## Demo Accounts

- `william@capeconnect.demo`
- `sihle@capeconnect.demo`
- `myciti-admin@capeconnect.demo`
- `ga-admin@capeconnect.demo`

Password:

```text
Demo#123
```

## Manual Checklist

### Core Access
- [ ] `login.html` loads without console errors
- [ ] `signup.html` loads without console errors
- [ ] backend health responds on `/health`
- [ ] login works with a seeded account
- [ ] logout returns the user to `login.html`

### Passenger Flow
- [ ] signup redirects to `choose-bus.html`
- [ ] MyCiTi selection opens `myciti-dashboard.html`
- [ ] Golden Arrow selection opens `golden-arrow-dashboard.html`
- [ ] MyCiTi booking reaches `choose-fare.html`, `results.html`, and `payment.html`
- [ ] Golden Arrow booking reaches `ga-route-calculator.html`, `ga-choose-fare.html`, `ga-results.html`, and `ga-payment.html`
- [ ] purchased ticket appears in the relevant dashboard
- [ ] wallet top-up updates the visible balance
- [ ] profile page loads and saves without errors

### Admin Flow
- [ ] admin account reaches `admin.html`
- [ ] admin bootstrap data loads
- [ ] admin pages do not show authorization errors for valid admin users

### Compatibility
- [ ] `dashboard.html` still redirects safely
- [ ] legacy routes preserved in `_redirects` still resolve correctly in Netlify-style hosting

## Common Browser Issues

### Failed To Fetch

This usually means the browser cannot reach the backend API.

Examples:
- frontend on `http://127.0.0.1:4173` should use API base `http://127.0.0.1:4000`
- frontend on `http://localhost:4173` should use API base `http://localhost:4000`

Set the API base in the browser console if needed:

```js
localStorage.setItem('ccApiBaseUrl', 'http://127.0.0.1:4000');
sessionStorage.setItem('ccApiBaseUrl', 'http://127.0.0.1:4000');
location.reload();
```

### CORS Errors

For local development, the backend allows both `http://localhost:4173` and `http://127.0.0.1:4173` by default.
Only set `FRONTEND_ORIGIN` manually if you need extra origins:

```powershell
$env:FRONTEND_ORIGIN="http://localhost:4173,http://127.0.0.1:4173"
npm run dev
```

### Inputs Clearing While Typing

Do not use auto-reloading preview servers for the static frontend.
Use:

```bash
node scripts/static-server.js
```

instead of editor live-reload servers.

## Bug Report Template

```text
Bug Title:
Severity:

Steps to Reproduce:
1.
2.
3.

Expected Result:

Actual Result:

Browser:
Device:
Screenshots:
Console Errors:
Additional Notes:
```
