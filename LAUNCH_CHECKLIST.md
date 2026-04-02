# CapeConnect Launch Checklist

Recommended hosting target: `Netlify + Railway + PostgreSQL`

## Netlify

- Site name: `capeconnect`
- Repository: `Indie180/CapeConnect`
- Branch: `main`
- Base directory: blank
- Build command: blank
- Publish directory: `.`
- Config file: `netlify.toml`

Frontend URL placeholder:

- `https://capeconnect.netlify.app`

If using the proxy approach, update `_redirects` to:

```text
/api/* https://capeconnect-api.up.railway.app/api/:splat 200
```

If using the direct API-base approach instead:

1. Copy `site-config.example.js` to `site-config.js`
2. Set `window.CapeConnectConfig.apiBaseUrl`
3. Load `site-config.js` before `js/api-client.js` on pages that use the backend

## Railway

- Project name: `capeconnect`
- Backend service root: `backend`
- Config file: `backend/railway.toml`
- Start command: `npm start`
- Healthcheck path: `/health`

Backend URL placeholder:

- `https://capeconnect-api.up.railway.app`

PostgreSQL:

- Add Railway PostgreSQL
- Copy its connection string into `DATABASE_URL`

## Railway Environment Variables

```env
NODE_ENV=production
PORT=4000
USE_SQLITE=false
DATABASE_URL=<railway postgres url>
FRONTEND_ORIGIN=https://capeconnect.netlify.app
FRONTEND_URL=https://capeconnect.netlify.app
API_URL=https://capeconnect-api.up.railway.app
SESSION_TTL_MINUTES=30
REFRESH_TTL_DAYS=14
QR_SECRET=<strong-random-secret>
PAYFAST_MERCHANT_ID=<live-payfast-id>
PAYFAST_MERCHANT_KEY=<live-payfast-key>
PAYFAST_PASSPHRASE=<live-payfast-passphrase>
SENTRY_DSN=<optional>
```

## PayFast Callback URLs

Set PayFast to the Railway backend:

- notify URL: `https://capeconnect-api.up.railway.app/api/payments/payfast/webhook`
- return URL: `https://capeconnect.netlify.app/payment-success.html`
- cancel URL: `https://capeconnect.netlify.app/payment-cancel.html`

## Release Checks

1. Open `https://capeconnect.netlify.app/login.html`
2. Check `https://capeconnect-api.up.railway.app/health`
3. Check `https://capeconnect-api.up.railway.app/readyz`
4. Log in from the frontend
5. Buy a ticket
6. Confirm PayFast callback works
7. Confirm GitHub Actions is green
8. Confirm alert-tagged logs appear in the monitoring destination

## Still Requires Live Setup

- real Netlify site creation
- real Railway project and PostgreSQL creation
- real production domains or default hosted URLs
- real PayFast live credentials
- real monitoring destination
