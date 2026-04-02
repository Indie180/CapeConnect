# Backend Deployment

This runbook documents the minimum publish path for the CapeConnect backend.

## Production Baseline

- Use PostgreSQL, not SQLite
- Run the API behind HTTPS and a reverse proxy
- Set explicit `FRONTEND_ORIGIN` values
- Keep `.env` out of version control
- Back up the database before every production migration

## Required Environment

These values are enforced by `src/config.js` in production:

- `NODE_ENV=production`
- `PORT=<api port>`
- `USE_SQLITE=false`
- `DATABASE_URL=<postgres connection string>`
- `FRONTEND_ORIGIN=<comma-separated frontend origins>`
- `SESSION_TTL_MINUTES=<access token ttl>`
- `REFRESH_TTL_DAYS=<refresh token ttl>`
- `QR_SECRET=<strong random secret>`
- `PAYFAST_MERCHANT_ID=<live merchant id>`
- `PAYFAST_MERCHANT_KEY=<live merchant key>`
- `PAYFAST_PASSPHRASE=<live passphrase if used>`
- `API_URL=<public backend url>`
- `FRONTEND_URL=<public frontend url>`
- `SENTRY_DSN=<optional but recommended>`

Use `backend/.env.example` as the template for non-secret defaults and variable names.

## Pre-Deploy Checklist

1. Confirm the branch to be published has a green GitHub Actions run in `.github/workflows/ci.yml`.
2. Confirm production secrets exist outside the repo.
3. Confirm `FRONTEND_ORIGIN`, `FRONTEND_URL`, and `API_URL` match the real publish domains.
4. Confirm PayFast production credentials are loaded, not sandbox values.
5. Confirm the PostgreSQL database is reachable from the deploy target.
6. Confirm a fresh database backup has been taken.
7. Confirm log shipping and alert rules described in `backend/MONITORING.md` are active.

## First Production Deploy

1. Install backend dependencies with `npm ci`.
2. Create the PostgreSQL database.
3. Apply `sql/schema.sql`.
4. Apply migration files in `sql/migrations` in ascending filename order.
5. Apply `sql/seed.sql` only if demo or bootstrap data is intentionally required.
6. Start the API with `npm start`.
7. Verify `GET /health` returns `ok: true`.
8. Verify `GET /readyz` returns `ok: true` and reports `postgres`.
9. Exercise a smoke path:
   - login
   - authenticated `GET /api/auth/me`
   - ticket list
   - wallet read

## Ongoing Deploys

1. Pull the new release.
2. Run `npm ci` if dependency or lockfile changes are included.
3. Review new migration files in `sql/migrations`.
4. Take a fresh PostgreSQL backup.
5. Apply only the new migration files in ascending filename order.
6. Restart the API process.
7. Verify `/health` and `/readyz`.
8. Verify application logs for startup or migration errors.
9. Run a quick post-deploy smoke test through the live frontend.

## Backup And Restore

Minimum expectation before publish:

- backups are automated or explicitly run before each production migration
- restore has been tested at least once on a non-production environment
- the team knows where backups are stored and how long they are retained

Recommended PostgreSQL flow:

1. Create a timestamped backup before migration.
2. Store it outside the app host if possible.
3. Verify the backup file exists and is non-empty.
4. Test restore periodically against a staging or disposable database.

## Rollback Guidance

1. Stop or drain traffic if the deploy caused data corruption or repeated 5xx errors.
2. Roll back the application version to the last known good release.
3. If the failing release included schema changes, restore the pre-deploy database backup unless the migration has a verified backward-compatible rollback path.
4. Re-check `/health` and `/readyz`.
5. Re-run the smoke path for auth, wallet, and ticket access.
6. Capture the incident details before the next deploy attempt.

## Startup Validation

The backend already fails fast on invalid production configuration. A production start should block if:

- `DATABASE_URL` is missing while `USE_SQLITE=false`
- `FRONTEND_ORIGIN` still includes `*`
- `QR_SECRET` is missing
- PayFast merchant credentials are missing
- `API_URL` or `FRONTEND_URL` is missing

## Publish Smoke Test

After each release, verify at least:

1. frontend can load the login page
2. signup or login succeeds
3. wallet fetch succeeds
4. ticket purchase succeeds
5. payment callback endpoints remain reachable
6. admin bootstrap still works for an operator admin

## Remaining Gaps

These still need work before calling deployment fully hardened:

- remote CI verification on GitHub, not just local runs
- verify real alert delivery for auth, payments, and ticket failures
- documented restore drill evidence
- clearer QR operations runbook for validators and conductors
