# CapeConnect Backend

Backend API for the live CapeConnect frontend. It supports PostgreSQL in production and SQLite for local/demo and automated test runs.

## Stack
- Node.js + Express
- PostgreSQL or SQLite
- `pg` for DB access
- Bearer session tokens stored in `sessions` table
- `helmet`, CORS, and rate limiting

## Setup
1. Copy env file:
   - `cp .env.example .env` (Windows: copy manually)
2. Install dependencies:
   - `npm install`
3. Choose a database mode:
   - PostgreSQL:
     - create database `capeconnect`
     - set `USE_SQLITE=false`
     - set `DATABASE_URL`
     - run `psql <connection> -f sql/schema.sql`
     - run `psql <connection> -f sql/seed.sql`
   - SQLite:
     - set `USE_SQLITE=true`
     - no manual schema setup is required; the app self-initializes the local database
4. Start API:
   - `npm run dev`

API default URL: `http://localhost:4000`

## Environment Variables
- `NODE_ENV`
  - `development`, `test`, or `production`
- `PORT`
  - API port, default `4000`
- `USE_SQLITE`
  - `true` for local SQLite mode
  - `false` for PostgreSQL mode
- `DATABASE_URL`
  - required when `USE_SQLITE=false`
- `FRONTEND_ORIGIN`
  - comma-separated list of allowed frontend origins
  - do not use `*` in production
- `SESSION_TTL_MINUTES`
  - access token session lifetime
- `REFRESH_TTL_DAYS`
  - refresh token lifetime

## Auth Demo Users
Password for all seeded users: `Demo#123`
- `myciti-admin@capeconnect.demo`
- `ga-admin@capeconnect.demo`
- `william@capeconnect.demo`
- `sihle@capeconnect.demo`

## Implemented Endpoints
- `GET /health`
- `GET /readyz`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/refresh`
- `POST /api/auth/logout` (auth)
- `GET /api/auth/me` (auth)
- `PATCH /api/auth/me` (auth)
- `POST /api/auth/change-password` (auth)
- `GET /api/tickets` (auth)
- `POST /api/tickets` (auth)
- `POST /api/tickets/:id/use` (auth)
- `GET /api/wallets/me` (auth)
- `POST /api/wallets/topup` (auth)
- `POST /api/wallets/spend` (auth)
- `GET /api/routes`
- `GET /api/routes/stops`
- `GET /api/timetables`
- `GET /api/prices`
- `GET /api/admin/bootstrap` (admin, operator-scoped)
- `POST /api/admin/users/bulk` (admin, operator-scoped)
- `POST /api/admin/tickets/bulk` (admin, operator-scoped)
- `POST /api/admin/wallets/bulk` (admin, operator-scoped)
- `POST /api/admin/prices/global/bulk` (admin, operator-scoped)
- `POST /api/admin/prices/routes/bulk` (admin, operator-scoped)
- `POST /api/admin/timetables/bulk` (admin, operator-scoped)
- `GET /api/admin/audit` (admin, operator-scoped)
- `POST /api/admin/audit` (admin, operator-scoped)

## Security Notes
- CORS is origin-restricted through `FRONTEND_ORIGIN`
- `*` is allowed only outside production
- `helmet` is enabled
- auth routes and general API routes are rate-limited
- admin routes are operator-scoped and require an authenticated session

## Deployment Notes
- Use HTTPS in production
- Set explicit `FRONTEND_ORIGIN` values in production
- Use PostgreSQL in production
- Run schema and seed scripts before first start
- Keep `.env` out of version control
- Put the API behind a reverse proxy/load balancer if deployed publicly
- Wire alert-tagged JSON logs into your monitoring destination; see `MONITORING.md`

## Testing
- `npm test`
  - Runs the backend integration suite in in-process mode:
    - `--test-isolation=none`
    - `--test-force-exit`
  - This avoids Windows `spawn EPERM` issues with the default Node test runner isolation mode.
- In `NODE_ENV=test`, API and auth rate limiting are skipped so the shared in-process test run stays stable.

## Important
Important work still left before full production:
- signed QR validation API
- remote alert delivery and escalation on top of the new structured event logs
- stronger deployment automation and backup procedures
