# 🚀 Get Started with CapeConnect

Welcome to CapeConnect! This guide will get you up and running in minutes.

## What is CapeConnect?

CapeConnect is a unified digital ticketing and wallet management system for Cape Town's transit operators:
- **MyCiTi** (Bus Rapid Transit)
- **Golden Arrow** (City & Regional Buses)

## 📋 What You Need

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- That's it! No installation required for basic usage.

## 🎯 Quick Start (3 Steps)

### Step 1: Open the Application

**Option A - Direct File** (Easiest)
```
Double-click index.html
```

**Option B - Local Server** (Recommended)
```bash
# Choose one:
python -m http.server 8000
# OR
npx serve
# OR
php -S localhost:8000

# Then open: http://localhost:8000
```

### Step 2: Select Your Operator

You'll see two cards:
- 🚌 **MyCiTi** (Blue) - Modern BRT system
- 🚍 **Golden Arrow** (Green) - Traditional bus service

Click either one to continue.

### Step 3: Login

**Demo Mode** (No registration needed!)
- Email: `demo@example.com` (or any email)
- Password: `password` (or anything)
- Choose: **Passenger** or **Admin**

Click "Sign In" and you're in! 🎉

## 🎮 What Can You Do?

### As a Passenger

#### 1. View Dashboard
- See your account overview
- Quick access to all features
- Recent tickets display

#### 2. Book Tickets
- Select your route
- Choose fare type (single, weekly, monthly)
- Complete payment
- Get digital ticket with QR code

#### 3. Manage Wallet
- Check balance
- Add funds
- View transaction history

#### 4. View Tickets
- See all your tickets
- Active, used, and expired
- Display QR codes for scanning

### As an Admin

#### 1. Dashboard
- System overview
- Key metrics
- Recent activity

#### 2. Manage Users
- View all users
- Edit user details
- Manage permissions

#### 3. Manage Tickets
- View all tickets
- Filter by status
- Generate reports

#### 4. Manage Wallets
- View all wallets
- Monitor transactions
- Handle refunds

## 📱 Try These Features

### Test Ticket Booking (Golden Arrow)

1. Login with Golden Arrow
2. You'll see the route calculator
3. Enter:
   - Origin: `Cape Town`
   - Destination: `Bellville`
4. Click "Calculate Route"
5. Select fare type: `Weekly`
6. Enter quantity: `2`
7. Click "Continue"
8. Review and proceed to payment
9. Enter your details
10. Click "Confirm and Issue Ticket"
11. ✅ Ticket created! Check "My Tickets"

### Test Wallet

1. Go to "Wallet" page
2. Click "Add Funds"
3. Enter amount: `100`
4. Select payment method
5. Click "Add Funds"
6. ✅ Balance updated!

### Test QR Code

1. Go to "My Tickets"
2. Find an active ticket
3. Click "Show QR Code"
4. ✅ QR code displayed!

## 🗂️ Project Structure

```
CapeConnect/
├── index.html          ← Start here
├── styles/
│   └── main.css        ← All styles
├── js/
│   ├── config.js       ← Settings
│   ├── router.js       ← Navigation
│   ├── auth.js         ← Login/logout
│   ├── api.js          ← Backend calls
│   ├── components.js   ← UI elements
│   ├── pages.js        ← Page content
│   └── app.js          ← Initialization
└── backend/            ← API server (optional)
```

## 📚 Documentation

- **README.md** - Complete documentation
- **QUICKSTART.md** - Quick start guide
- **ARCHITECTURE.md** - Technical architecture
- **DEPLOYMENT.md** - How to deploy
- **TESTING.md** - Testing guide
- **PROJECT_SUMMARY.md** - Project overview

## 🔧 Advanced Setup

### Connect to Backend API

1. Start the backend:
```bash
cd backend
npm install
npm start
```

2. Backend runs on `http://localhost:4000`

3. Frontend automatically connects!

### Enable Production Mode

1. Update `js/config.js`:
```javascript
API_BASE_URL: 'https://api.capeconnect.co.za'
```

2. Deploy frontend to hosting service

3. Deploy backend to server

## 🎨 Customization

### Change Operator Colors

Edit `js/config.js`:
```javascript
OPERATORS: {
  MYCITI: {
    color: '#005DAA',      // Change this
    accentColor: '#E2231A' // And this
  }
}
```

### Add New Routes

Edit `js/config.js`:
```javascript
ROUTES: {
  NEW_PAGE: '/new-page'  // Add route
}
```

Then add rendering in `js/pages.js`:
```javascript
function renderNewPage() {
  app().innerHTML = `<div>New Page</div>`;
}
```

## 🐛 Troubleshooting

### Issue: Blank Page
**Solution**: Serve files with a local server, don't just open index.html

### Issue: Login Doesn't Work
**Solution**: Check browser console for errors. In demo mode, any credentials work.

### Issue: Styles Not Loading
**Solution**: Ensure `styles/main.css` exists and path is correct

### Issue: Navigation Not Working
**Solution**: Check that all JS files are loading in correct order

### Issue: Tickets Not Showing
**Solution**: Check browser localStorage - tickets stored there in demo mode

## 💡 Tips & Tricks

1. **Use Browser DevTools**
   - Press F12 to open
   - Check Console for errors
   - Use Network tab to see API calls

2. **Clear LocalStorage**
   - If things get weird, clear storage:
   ```javascript
   localStorage.clear()
   ```

3. **Test Different Operators**
   - Logout and select different operator
   - Each has unique branding and features

4. **Mobile Testing**
   - Use DevTools device emulation
   - Or open on actual mobile device

5. **Bookmark Useful Pages**
   - `/dashboard` - Your dashboard
   - `/tickets` - Your tickets
   - `/wallet` - Your wallet

## 🎓 Learning Path

### Beginner
1. ✅ Open application
2. ✅ Select operator
3. ✅ Login
4. ✅ Explore dashboard
5. ✅ View tickets

### Intermediate
1. ✅ Book a ticket
2. ✅ Add funds to wallet
3. ✅ Display QR code
4. ✅ Try admin features
5. ✅ Test on mobile

### Advanced
1. ✅ Connect to backend API
2. ✅ Customize branding
3. ✅ Add new features
4. ✅ Deploy to production
5. ✅ Set up monitoring

## 🤝 Getting Help

### Documentation
- Read the full README.md
- Check ARCHITECTURE.md for technical details
- Review TESTING.md for test cases

### Common Questions

**Q: Is this production-ready?**
A: The frontend is ready. Backend needs production database and payment gateway.

**Q: Can I use real payment methods?**
A: Currently demo mode only. Integrate payment gateway for production.

**Q: Does it work offline?**
A: Not yet. Service worker can be added for offline support.

**Q: Can I customize the design?**
A: Yes! Edit `styles/main.css` and operator colors in `js/config.js`.

**Q: How do I add more operators?**
A: Add to `OPERATORS` in `js/config.js` and create corresponding pages.

## 🚀 Next Steps

Now that you're set up:

1. ✅ Explore all features
2. ✅ Test the booking flow
3. ✅ Try admin features
4. ✅ Read the documentation
5. ✅ Customize for your needs
6. ✅ Deploy to production

## 📞 Support

Need help?
- Check the documentation files
- Review browser console for errors
- Test in different browsers
- Clear cache and try again

## 🎉 You're Ready!

You now have a fully functional transit ticketing system. Start exploring and building!

**Happy coding!** 🚌🚍

---

**Quick Links:**
- [Full Documentation](README.md)
- [Architecture Guide](ARCHITECTURE.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Testing Guide](TESTING.md)
