# CapeConnect

CapeConnect is a Cape Town transit web app with:
- Frontend pages (booking, calculators, dashboard, admin portals)
- Node.js backend API with PostgreSQL (`backend/`)
- Golden Arrow transit API utility (`capetown-transit-api/`)

## Repository Layout

- `backend/` - main API, auth, tickets, wallets, admin routes
- `capetown-transit-api/` - Golden Arrow route/stop utility API
- `admin-common/`, `admin-goldenarrow/`, `admin-myciti/` - admin UI modules
- `js/`, `css/`, `data/` - frontend logic, styles, static datasets

## Quick Start (Backend)

1. Start PostgreSQL (example dev port `55432`).
2. Configure `backend/.env`:
   - `DATABASE_URL=postgres://postgres@localhost:55432/capeconnect`
3. Install dependencies:
   - `cd backend`
   - `npm ci`
4. Apply schema:
   - `psql <connection> -f sql/schema.sql`
5. For existing DBs, apply migrations:
   - `psql <connection> -f sql/migrations/2026-03-03_add_operator_to_audit_logs.sql`
6. Run API:
   - `npm run dev`

API runs on `http://localhost:4000` by default.

## Tests and Checks

From `backend/`:

- `npm test` - Node test runner
- `npm run lint` - placeholder lint step
- `npm run check` - lint + tests

## CI

GitHub Actions workflow: [ci.yml](/C:/Users/Indiphile.Tini/Desktop/BUS/.github/workflows/ci.yml)

It runs:
- Backend install + `npm run check`
- Frontend JavaScript syntax smoke checks

## Security Notes

- `.env` files are ignored; only `.env.example` should be committed.
- Card data storage in frontend was reduced to masked values only.
- Admin APIs enforce operator scope and operator-linked audit rows.
