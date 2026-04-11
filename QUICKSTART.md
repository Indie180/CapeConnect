# CapeConnect - Quick Start Guide

Current note:
- the canonical frontend is the repo-root static HTML app
- the current entry point is `http://127.0.0.1:4173/login.html`
- use backend-backed auth, not the old demo-only flow below

Current startup:

```bash
npm run dev:frontend
npm run dev:backend
```

Then open:

```text
http://127.0.0.1:4173/login.html
```

Backend health:

```text
http://127.0.0.1:4000/health
```

Seeded backend users all use password:

```text
Demo#123
```

Canonical user accounts:
- `william@capeconnect.demo`
- `sihle@capeconnect.demo`
- `myciti-admin@capeconnect.demo`
- `ga-admin@capeconnect.demo`

See `docs/FRONTEND_DECISION.md` for the formal publish-path decision.

Get up and running with CapeConnect in 5 minutes.

## Step 1: Open the Application

### Local Server (Recommended)
```bash
npm run dev:frontend
```

Then open: `http://127.0.0.1:4173/login.html`

## Step 2: Select an Operator

You'll see two options:
- **MyCiTi** (Blue) - Bus Rapid Transit
- **Golden Arrow** (Green) - City & Regional Buses

Click on either card to continue.

## Step 3: Login

Use one of the seeded backend accounts:
- `william@capeconnect.demo`
- `sihle@capeconnect.demo`
- `myciti-admin@capeconnect.demo`
- `ga-admin@capeconnect.demo`

Password:

```text
Demo#123
```

## Step 4: Explore Features

### As a Passenger:
1. **Dashboard** - Overview of your account
2. **Book Ticket** - Purchase new tickets
3. **My Tickets** - View active/past tickets
4. **Wallet** - Add funds and check balance

### As an Admin:
1. **Admin Dashboard** - System overview
2. **Tickets** - Manage all tickets
3. **Users** - User management
4. **Wallets** - Financial oversight

## Golden Arrow Booking Flow

For Golden Arrow users, the booking process is:

1. **Route Calculator** (`/ga-route-calculator`)
   - Enter origin and destination
   - Calculate route and fare

2. **Choose Fare** (`/ga-choose-fare`)
   - Select ticket type (single, weekly, monthly)
   - Choose quantity

3. **Results** (`/ga-results`)
   - Review booking details
   - Confirm selection

4. **Payment** (`/ga-payment`)
   - Enter passenger details
   - Complete purchase
   - Ticket added to dashboard

## Testing the Application

Automated test commands:

```bash
npm test
npm run test:e2e
cd backend
npm test
```

Notes:
- `npm run test:e2e` now starts the root static server and the backend automatically.
- The E2E runner uses a direct Chromium script instead of the Playwright worker runner.
- If Chromium launch is blocked with `spawn EPERM`, run the command in a normal local terminal outside restricted sandbox tooling.

### Test Ticket Purchase
1. Login as passenger
2. Navigate to booking
3. Complete the flow
4. Check "My Tickets" to see your purchase

### Test Wallet
1. Go to Wallet page
2. Click "Add Funds"
3. Enter amount (e.g., 100)
4. Select payment method
5. Confirm - balance updates immediately

### Test QR Code
1. Go to "My Tickets"
2. Find an active ticket
3. Click "Show QR Code"
4. Modal displays ticket QR

## Backend API

```bash
cd backend
npm install
npm run dev
```

Backend runs on `http://localhost:4000`

The backend allows both `http://localhost:4173` and `http://127.0.0.1:4173` by default in development.
The frontend should connect to the backend automatically on either hostname.

## Troubleshooting

### Issue: Blank page
**Solution**: Make sure you're using `node scripts/static-server.js`, or check browser console for errors.

### Issue: Login doesn't work
**Solution**: Verify the backend is running on `http://127.0.0.1:4000/health` or `http://localhost:4000/health`, then use a seeded account.

### Issue: Tickets not showing
**Solution**: Check the backend is running, then reload the page so the frontend can re-resolve the API base.

### Issue: Styles not loading
**Solution**: Ensure `styles/main.css` exists and the path is correct.

## File Structure Quick Reference

```text
login.html          -> Main login entry
signup.html         -> Signup flow
choose-bus.html     -> Operator selection
myciti-dashboard.html
golden-arrow-dashboard.html
admin.html          -> Admin portal
js/                 -> Shared frontend logic
css/                -> Shared frontend styles
backend/            -> Node API
```

## Next Steps

1. ✅ Explore the passenger dashboard
2. ✅ Book a test ticket
3. ✅ Add funds to wallet
4. ✅ Try the admin portal
5. ✅ Test Golden Arrow booking flow
6. 📖 Read full README.md for details
7. 🔧 Connect to backend API
8. 🚀 Deploy to production

## Demo Credentials

- `william@capeconnect.demo`
- `sihle@capeconnect.demo`
- `myciti-admin@capeconnect.demo`
- `ga-admin@capeconnect.demo`

Password:

```text
Demo#123
```

## Support

Need help? Check:
- `README.md` - Full documentation
- `backend/openapi.yml` - API reference
- Browser console - Error messages
- Network tab - API calls

---

**Ready to go!** Start by opening `http://127.0.0.1:4173/login.html`.
