# CapeConnect Hosting Decision

Recommended target: `Netlify + Railway + PostgreSQL`

This repo now contains starter configuration for that shape, but it does not yet contain verified live production URLs.

## Current Truth

- The canonical frontend is the repo-root static HTML app.
- The live backend is the Node API in `backend/`.
- The production backend runbook is `backend/DEPLOYMENT.md`.
- The frontend is prepared for Netlify with `netlify.toml` and `_redirects`.
- The backend is prepared for Railway with `backend/railway.toml`.
- The backend still needs PostgreSQL, production env vars, log shipping, and alert wiring.

## What Is Missing Before Real Host Validation

1. Commit to Netlify for the frontend.
2. Commit to Railway for the backend and PostgreSQL.
3. Define the real production URLs.
   - `FRONTEND_URL`
   - `API_URL`
   - `FRONTEND_ORIGIN`
4. Configure log shipping and alert delivery.
5. Run one real remote CI pass from `.github/workflows/ci.yml`.

## Recommended Hosting Shape

### Frontend

Use Netlify to publish the repo root.

Required checks:
- `/login` resolves to `/login.html`
- `/signup` resolves to `/signup.html`
- `/forgot-password` resolves to `/forgot-password.html`
- `/reset-password` resolves to `/reset-password.html`
- old compatibility routes still resolve safely
- `netlify.toml` is present and `_redirects` is published
- if frontend and backend are on different hosts, either:
  - set a production API override using `site-config.js`, `window.CapeConnectConfig.apiBaseUrl`, or a `meta[name="capeconnect-api-base"]`, or
  - uncomment the `/api/*` proxy rule in `_redirects` and point it at the Railway backend URL

### Backend

Use Railway for the Node API and PostgreSQL.

Required checks:
- Node 20
- PostgreSQL
- environment variable management
- HTTPS
- centralized logs
- `backend/railway.toml` is present
- Railway service root should be `backend/`

Follow `backend/DEPLOYMENT.md` for startup, migrations, smoke tests, and rollback guidance.

## Recommended Setup Steps

1. Create a Netlify site that publishes the repo root.
2. Create a Railway service for `backend/`.
3. Provision PostgreSQL in Railway.
4. Set backend env vars in Railway:
   - `NODE_ENV=production`
   - `USE_SQLITE=false`
   - `DATABASE_URL`
   - `FRONTEND_ORIGIN`
   - `FRONTEND_URL`
   - `API_URL`
   - `QR_SECRET`
   - `PAYFAST_MERCHANT_ID`
   - `PAYFAST_MERCHANT_KEY`
   - `PAYFAST_PASSPHRASE`
   - `SENTRY_DSN` if used
5. Decide frontend-to-backend connection mode:
   - direct API base override via `site-config.js`, or
   - Netlify proxy rule in `_redirects`
6. Apply the publish smoke tests from `backend/DEPLOYMENT.md`.

## Release Gate For Host Validation

A hosting target should not be called validated until all of these are true:

1. GitHub Actions is green remotely.
2. Frontend is reachable on the chosen public URL.
3. Backend `/health` and `/readyz` are green on the chosen public URL.
4. Production env validation passes.
5. Login works against the hosted backend.
6. Ticket purchase works.
7. Payment callback URL is configured for the hosted backend.
8. Alert-tagged logs appear in the monitoring destination.

## Status

Hosting target: recommended and partially prepared in repo, not yet verified live.
Host validation: blocked on real Netlify/Railway project setup, production URLs, and remote CI.
