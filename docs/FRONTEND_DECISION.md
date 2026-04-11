# Frontend Decision

CapeConnect's canonical publish target is the repo-root static HTML frontend.

This means:
- the live user entry points are the repo-root HTML pages such as `login.html`, `signup.html`, `choose-bus.html`, `myciti-dashboard.html`, and `golden-arrow-dashboard.html`
- shared live frontend behavior lives under `js/`, `css/`, `components/`, and related root assets

## Why

- the root static frontend is the only path fully wired into the current backend-backed auth, wallet, tickets, booking, and E2E flows
- publishing with two competing frontend paths would create release, testing, and support ambiguity

## Release Rule

Until a future migration is explicitly completed, production releases should:
- ship the root static HTML frontend
- avoid adding competing frontend stacks beside the canonical static app

## Immediate Follow-up

- keep root static HTML as the published frontend
- clean up duplicate and legacy root HTML pages that are not part of the canonical user journey
- remove retired frontend paths and keep release/test/docs focused on the static app
