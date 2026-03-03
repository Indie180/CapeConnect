# CapeConnect Backend (Phase 1)

This is the first production foundation for your app: real API + PostgreSQL (no more localStorage for core business data).

## Stack
- Node.js + Express
- PostgreSQL
- `pg` for DB access
- Bearer session tokens stored in `sessions` table

## Setup
1. Create PostgreSQL database `capeconnect`.
2. Copy env file:
   - `cp .env.example .env` (Windows: copy manually)
3. Install dependencies:
   - `npm install`
4. Run schema:
   - `psql <connection> -f sql/schema.sql`
   - for existing databases, run migrations in `sql/migrations/` (latest first)
5. Seed data:
   - `psql <connection> -f sql/seed.sql`
6. Start API:
   - `npm run dev`

API default URL: `http://localhost:4000`

## Auth Demo Users
Password for all seeded users: `Demo#123`
- `myciti-admin@capeconnect.demo`
- `ga-admin@capeconnect.demo`
- `william@capeconnect.demo`
- `sihle@capeconnect.demo`

## Implemented Endpoints
- `GET /health`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout` (auth)
- `GET /api/auth/me` (auth)
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

## Frontend Integration (replace localStorage)
- Login page:
  - call `POST /api/auth/login`
  - store token in memory/session storage
- Dashboard:
  - load active tickets from `GET /api/tickets?status=PAID`
- Use ticket:
  - call `POST /api/tickets/:id/use`
- Wallet top-up:
  - call `POST /api/wallets/topup`
- Timetable/calculator forms:
  - load stops/routes/prices from API endpoints above

## Important
This is Phase 1 foundation. Next phases should add:
- stricter RBAC per operator
- MFA
- payment webhook reconciliation
- signed QR validation API
- full audit logging for all admin mutations
