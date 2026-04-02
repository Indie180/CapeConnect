# Canonical Frontend Surfaces

This file defines which repo-root HTML pages are part of the current canonical publish path and which ones should be treated as compatibility, legacy, or test-only surfaces.

## Canonical Publish Path

These pages make up the current live user journey:
- `index.html`
- `login.html`
- `signup.html`
- `forgot-password.html`
- `reset-password.html`
- `choose-bus.html`
- `myciti-dashboard.html`
- `golden-arrow-dashboard.html`
- `myciti-timetable.html`
- `golden-arrow-timetable.html`
- `myciti-calculator.html`
- `ga-calculator.html`
- `profile.html`
- `admin.html`
- `choose-fare.html`
- `route-calculator.html`
- `results.html`
- `payment.html`
- `ga-route-calculator.html`
- `ga-choose-fare.html`
- `ga-results.html`
- `ga-payment.html`
- `timetable.html`
- `privacy.html`
- `terms.html`
- `offline.html`
- `payment-success.html`
- `payment-cancel.html`

## Compatibility Redirects

These are safe to keep temporarily but should not be treated as primary entry points:
- `dashboard.html`
- `booking.html`
- `ga-booking.html`
- `legacy-redirect.html`

These compatibility pages now redirect directly to canonical non-mobile pages.

## Legacy / Secondary Mobile Redirects

These legacy entry points now redirect into the canonical publish path. They can be kept temporarily for compatibility, then removed once inbound links are no longer needed:
- `choose-fare-mobile.html`
- `forgot-password-mobile.html`
- `golden-arrow-dashboard-mobile.html`
- `login-mobile.html`
- `login-mobile-integrated.html`
- `myciti-dashboard-mobile.html`
- `payment-mobile.html`
- `profile-mobile.html`
- `signup-mobile.html`
- `tickets-mobile.html`
- `timetables-mobile.html`
- `wallet-mobile.html`

## Test / Diagnostic Pages

The standalone root HTML test/diagnostic pages have already been removed from the release surface.

## Next Cleanup Pass

1. Keep the canonical publish path intact.
2. Preserve compatibility redirects only where inbound links are still useful.
3. Remove temporary mobile redirect pages once legacy links are no longer needed.
4. Remove compatibility redirects entirely once analytics or support history show they are no longer used.
