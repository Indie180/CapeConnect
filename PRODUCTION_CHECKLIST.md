# Production Readiness Checklist

Target: move the project from its current demo-heavy state toward a practical `80%` readiness level.

How to use this file:
- Mark items as done only when the live app path uses the new implementation.
- Prefer removing duplicate flows instead of keeping old and new versions in parallel.
- Treat browser-only `localStorage` as a temporary fallback, not the source of truth.

## 1. Frontend Cleanup

- [x] Remove obvious dead prototype files and backups
- [x] Remove the orphaned legacy SPA router stack
- [x] Split user dashboards into `myciti-dashboard.html` and `golden-arrow-dashboard.html`
- [x] Convert `dashboard.html` into a compatibility redirect
- [x] Redirect obsolete booking pages to the canonical flows
- [x] Remove remaining duplicate admin entry points if they are no longer needed
- [x] Remove unused assets and outdated docs that still describe deleted flows
- [x] Standardize all navigation links to the split dashboards only

## 2. Authentication And Session

- [x] Replace demo login with backend-authenticated login
- [x] Stop assigning user role from email text during login
- [x] Use backend session data to hydrate dashboard/profile user state
- [x] Use backend logout when an authenticated session exists
- [x] Add a real backend register/signup endpoint
- [x] Move signup off local-only user creation
- [x] Add consistent protected-page session guards across user pages
- [x] Add expired-session handling and redirect behavior
- [x] Back forgot-password and reset flows with the backend

## 3. User Data Ownership

- [x] Move bus linkage to backend-owned user data
- [x] Move selected active bus to backend-owned user data
- [x] Move profile updates to backend-owned user data
- [x] Remove `currentUser` / `capeConnectUser` split-brain storage paths
- [x] Remove local-only user state as the primary source of truth

## 4. Tickets And Wallet

- [x] Make wallet balance backend-owned everywhere
- [x] Make ticket creation backend-owned everywhere
- [x] Make ticket history backend-owned everywhere
- [x] Make ticket usage and expiry backend-owned everywhere
- [x] Remove legacy ticket migration as part of the normal app path
- [x] Validate purchases and top-ups server-side

## 5. Booking And Fare Logic

- [x] Centralize MyCiTi fare rules in one implementation
- [x] Centralize Golden Arrow fare rules in one implementation
- [x] Remove duplicated fare logic across pages
- [x] Make arrival time, pricing, and ticket outputs come from one trusted data path
- [x] Validate booking inputs consistently on the backend

## 6. Testing

- [x] Add basic root smoke tests
- [x] Add initial Playwright E2E scaffolding
- [x] Add E2E test for signup -> choose bus -> dashboard
- [x] Add E2E test for MyCiTi purchase -> ticket appears on dashboard
- [x] Add E2E test for Golden Arrow purchase -> ticket appears on dashboard
- [x] Add E2E test for wallet top-up
- [x] Add E2E test for bus switching when a user has both buses
- [x] Add backend integration tests for auth, wallet, tickets, and permissions

## 7. Deployment And Security

- [x] Define production env vars clearly
- [x] Add health checks for backend services
- [x] Add error logging and monitoring
- [x] Add secure deployment guidance for HTTPS, CORS, and CSP
- [x] Add a production database migration path
- [x] Review input validation and access control for admin/user boundaries

## Current Recommended Order

1. Review input validation and access control for admin/user boundaries
2. Remove remaining duplicate admin entry points if they are no longer needed
3. Remove unused assets and outdated docs that still describe deleted flows
4. Consolidate duplicated booking and fare logic further
5. Review deeper admin/user input validation boundaries
