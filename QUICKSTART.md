# CapeConnect - Quick Start Guide

Get up and running with CapeConnect in 5 minutes.

## Step 1: Open the Application

### Option A: Direct File Access
Simply double-click `index.html` to open in your browser.

### Option B: Local Server (Recommended)
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then open: `http://localhost:8000`

## Step 2: Select an Operator

You'll see two options:
- **MyCiTi** (Blue) - Bus Rapid Transit
- **Golden Arrow** (Green) - City & Regional Buses

Click on either card to continue.

## Step 3: Login

### Demo Mode (Default)
- Email: `demo@example.com` (or any email)
- Password: `password` (or any value)
- Choose **Passenger** or **Admin** tab

Click "Sign In" to enter the application.

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

## Backend API (Optional)

To use the real backend instead of demo mode:

```bash
cd backend
npm install
npm start
```

Backend runs on `http://localhost:4000`

The frontend will automatically connect to the API.

## Troubleshooting

### Issue: Blank page
**Solution**: Make sure you're serving the files (not just opening index.html directly), or check browser console for errors.

### Issue: Login doesn't work
**Solution**: In demo mode, any credentials work. Check that JavaScript is enabled.

### Issue: Tickets not showing
**Solution**: Check browser localStorage - tickets are stored there in demo mode.

### Issue: Styles not loading
**Solution**: Ensure `styles/main.css` exists and the path is correct.

## File Structure Quick Reference

```
index.html          → Main entry point
styles/main.css     → All styles
js/config.js        → Configuration
js/router.js        → Navigation
js/auth.js          → Login/logout
js/api.js           → Backend calls
js/components.js    → UI components
js/pages.js         → Page rendering
js/app.js           → Initialization
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

### Passenger Account
- Email: `passenger@example.com`
- Password: `anything`
- Role: Passenger

### Admin Account
- Email: `admin@capeconnect.co.za`
- Password: `anything`
- Role: Admin

## Support

Need help? Check:
- `README.md` - Full documentation
- `backend/openapi.yml` - API reference
- Browser console - Error messages
- Network tab - API calls

---

**Ready to go!** 🚌🚍 Start by opening `index.html` and selecting your operator.
