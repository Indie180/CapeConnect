# CapeConnect - Testing Guide

Complete guide for testing the CapeConnect application.

## Quick Test Checklist

### ✅ Basic Functionality
- [ ] Application loads without errors
- [ ] Landing page displays both operators
- [ ] Can select MyCiTi operator
- [ ] Can select Golden Arrow operator
- [ ] Login page loads correctly
- [ ] Can switch between Passenger/Admin tabs
- [ ] Can login with any credentials (demo mode)
- [ ] Dashboard loads after login
- [ ] Navigation works between pages
- [ ] Logout works correctly

### ✅ Passenger Features
- [ ] Dashboard displays correctly
- [ ] Can navigate to Tickets page
- [ ] Can navigate to Wallet page
- [ ] Can navigate to Booking page
- [ ] Tickets display in list
- [ ] Can show QR code for active tickets
- [ ] Wallet balance displays
- [ ] Can add funds to wallet
- [ ] Recent tickets show on dashboard

### ✅ Admin Features
- [ ] Admin login works
- [ ] Admin dashboard loads
- [ ] Can access admin pages
- [ ] Admin navigation works

### ✅ Golden Arrow Flow
- [ ] Route calculator loads
- [ ] Can enter origin/destination
- [ ] Fare selection works
- [ ] Results page displays
- [ ] Payment page loads
- [ ] Can complete booking
- [ ] Ticket added to dashboard

## Detailed Test Cases

### Test Case 1: Landing Page

**Objective**: Verify landing page displays correctly

**Steps**:
1. Open `index.html` in browser
2. Verify page loads without errors
3. Check that "CapeConnect" title is visible
4. Verify both operator cards are displayed
5. Check MyCiTi card shows blue theme
6. Check Golden Arrow card shows green theme
7. Hover over cards to see animation
8. Click on MyCiTi card

**Expected Result**:
- Landing page displays with both operators
- Cards are interactive and animated
- Clicking navigates to login page

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test Case 2: MyCiTi Login (Passenger)

**Objective**: Test passenger login for MyCiTi

**Steps**:
1. From landing page, click MyCiTi card
2. Verify login page loads with MyCiTi branding (blue)
3. Verify "Passenger" tab is active by default
4. Enter email: `passenger@example.com`
5. Enter password: `password`
6. Click "Sign In"
7. Wait for redirect

**Expected Result**:
- Login page displays with blue MyCiTi theme
- Form accepts input
- Success toast appears
- Redirects to dashboard
- Dashboard shows passenger features

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test Case 3: Golden Arrow Login (Admin)

**Objective**: Test admin login for Golden Arrow

**Steps**:
1. From landing page, click Golden Arrow card
2. Verify login page loads with GA branding (green)
3. Click "Admin" tab
4. Verify form changes to admin login
5. Enter email: `admin@capeconnect.co.za`
6. Enter password: `admin123`
7. Click "Enter Admin Portal"
8. Wait for redirect

**Expected Result**:
- Login page displays with green GA theme
- Admin tab switches form
- Success toast appears
- Redirects to admin dashboard
- Admin navigation visible

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test Case 4: Dashboard Navigation

**Objective**: Test navigation from dashboard

**Steps**:
1. Login as passenger
2. Verify dashboard loads
3. Click "My Tickets" card
4. Verify tickets page loads
5. Click browser back button
6. Verify returns to dashboard
7. Click "Wallet" card
8. Verify wallet page loads
9. Use navbar to navigate to "Dashboard"
10. Verify dashboard loads again

**Expected Result**:
- All navigation works smoothly
- No page reloads (SPA behavior)
- Browser back/forward buttons work
- URL updates correctly
- Page transitions are smooth

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test Case 5: Ticket Display

**Objective**: Verify tickets display correctly

**Steps**:
1. Login as passenger
2. Navigate to "My Tickets"
3. If no tickets, note empty state
4. If tickets exist, verify display:
   - Route name visible
   - Operator name visible
   - Status badge visible
   - Date and time visible
   - Ticket type visible
   - Total price visible
5. Click "Show QR Code" on active ticket
6. Verify QR modal appears
7. Click "Close" to dismiss modal

**Expected Result**:
- Tickets display in cards
- All information is readable
- Status badges have correct colors
- QR code modal works
- Empty state shows if no tickets

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test Case 6: Wallet Operations

**Objective**: Test wallet functionality

**Steps**:
1. Login as passenger
2. Navigate to "Wallet"
3. Note current balance
4. Click "Add Funds"
5. Enter amount: `100`
6. Select payment method: "Credit/Debit Card"
7. Click "Add Funds"
8. Wait for success message
9. Verify balance updated
10. Check that R100 was added

**Expected Result**:
- Wallet displays current balance
- Add funds modal opens
- Form accepts input
- Success toast appears
- Balance updates immediately
- New balance = old balance + R100

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test Case 7: Golden Arrow Booking Flow

**Objective**: Complete full booking process

**Steps**:
1. Login as passenger with Golden Arrow
2. Navigate to booking (should redirect to GA flow)
3. Enter origin: "Cape Town"
4. Enter destination: "Bellville"
5. Click "Calculate Route"
6. Verify results display
7. Select fare type: "Weekly"
8. Enter quantity: 2
9. Click "Continue"
10. Review booking details
11. Click "Proceed to Payment"
12. Enter passenger name
13. Enter email
14. Select payment method
15. Click "Confirm and Issue Ticket"
16. Wait for success
17. Verify redirects to dashboard
18. Check that ticket appears in "My Tickets"

**Expected Result**:
- All steps complete without errors
- Data persists between pages
- Calculations are correct
- Ticket is created
- Ticket appears in dashboard
- QR code is generated

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test Case 8: Logout

**Objective**: Test logout functionality

**Steps**:
1. Login as any user
2. Navigate to any page
3. Click "Logout" button in navbar
4. Verify redirect to landing page
5. Try to navigate to `/dashboard` directly
6. Verify redirects to login
7. Check that auth token is removed

**Expected Result**:
- Logout button works
- Redirects to landing page
- Auth token removed from localStorage
- Protected routes redirect to login
- Cannot access dashboard without login

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test Case 9: Browser Compatibility

**Objective**: Test across different browsers

**Browsers to Test**:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

**Steps** (for each browser):
1. Open application
2. Complete login flow
3. Navigate between pages
4. Test ticket display
5. Test wallet operations
6. Check console for errors

**Expected Result**:
- Works in all modern browsers
- No console errors
- Styles render correctly
- Animations work smoothly
- Touch interactions work on mobile

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Test Case 10: Responsive Design

**Objective**: Test mobile responsiveness

**Viewports to Test**:
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Mobile (414x896)

**Steps** (for each viewport):
1. Resize browser or use device
2. Check landing page layout
3. Check login page layout
4. Check dashboard layout
5. Check tickets page layout
6. Verify buttons are touch-friendly
7. Check that text is readable

**Expected Result**:
- Layouts adapt to screen size
- No horizontal scrolling
- Buttons are large enough to tap
- Text is readable without zooming
- Images scale appropriately
- Navigation works on mobile

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Performance Testing

### Load Time Test

**Objective**: Measure page load performance

**Steps**:
1. Open browser DevTools
2. Go to Network tab
3. Clear cache
4. Load `index.html`
5. Record metrics:
   - DOMContentLoaded: _____ ms
   - Load: _____ ms
   - Total size: _____ KB
   - Number of requests: _____

**Expected Result**:
- DOMContentLoaded < 500ms
- Load < 1000ms
- Total size < 500KB
- Requests < 20

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Navigation Performance

**Objective**: Test SPA navigation speed

**Steps**:
1. Login to application
2. Open Performance tab in DevTools
3. Start recording
4. Navigate: Dashboard → Tickets → Wallet → Dashboard
5. Stop recording
6. Analyze results

**Expected Result**:
- Each navigation < 100ms
- No page reloads
- Smooth transitions
- No layout shifts

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Security Testing

### Authentication Test

**Objective**: Verify authentication is enforced

**Steps**:
1. Open application (not logged in)
2. Try to access `/dashboard` directly
3. Verify redirects to login
4. Try to access `/tickets` directly
5. Verify redirects to login
6. Try to access `/admin/dashboard` directly
7. Verify redirects to login
8. Login as passenger
9. Try to access `/admin/dashboard`
10. Verify redirects to passenger dashboard

**Expected Result**:
- Protected routes require authentication
- Unauthenticated users redirected to login
- Admin routes require admin role
- Passengers cannot access admin pages

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### XSS Protection Test

**Objective**: Test for XSS vulnerabilities

**Steps**:
1. Login to application
2. Try to inject script in form fields:
   - `<script>alert('XSS')</script>`
   - `<img src=x onerror=alert('XSS')>`
3. Submit forms
4. Check if scripts execute

**Expected Result**:
- Scripts do not execute
- Input is sanitized
- No alerts appear
- Data is safely displayed

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Accessibility Testing

### Keyboard Navigation

**Objective**: Test keyboard-only navigation

**Steps**:
1. Open application
2. Use only keyboard (Tab, Enter, Escape)
3. Navigate through landing page
4. Complete login
5. Navigate dashboard
6. Test all interactive elements

**Expected Result**:
- All elements are keyboard accessible
- Focus indicators are visible
- Tab order is logical
- Enter key activates buttons
- Escape closes modals

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

### Screen Reader Test

**Objective**: Test with screen reader

**Tools**: NVDA (Windows), VoiceOver (Mac), TalkBack (Android)

**Steps**:
1. Enable screen reader
2. Navigate through application
3. Listen to announcements
4. Verify all content is readable
5. Check form labels
6. Test button descriptions

**Expected Result**:
- All content is announced
- Form labels are associated
- Buttons have descriptive text
- Images have alt text
- Navigation is clear

**Status**: ⬜ Not Tested | ✅ Pass | ❌ Fail

---

## Bug Report Template

When you find a bug, use this template:

```
**Bug Title**: [Short description]

**Severity**: Critical | High | Medium | Low

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**:


**Actual Result**:


**Browser**: Chrome 120 / Firefox 121 / etc.

**Device**: Desktop / Mobile / Tablet

**Screenshots**: [Attach if applicable]

**Console Errors**: [Copy any errors]

**Additional Notes**:

```

---

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| Landing Page | ⬜ | |
| MyCiTi Login | ⬜ | |
| GA Login | ⬜ | |
| Dashboard Nav | ⬜ | |
| Ticket Display | ⬜ | |
| Wallet Ops | ⬜ | |
| GA Booking | ⬜ | |
| Logout | ⬜ | |
| Browser Compat | ⬜ | |
| Responsive | ⬜ | |
| Load Time | ⬜ | |
| Navigation Perf | ⬜ | |
| Authentication | ⬜ | |
| XSS Protection | ⬜ | |
| Keyboard Nav | ⬜ | |
| Screen Reader | ⬜ | |

**Overall Status**: ⬜ Not Started | 🚧 In Progress | ✅ Complete

---

## Automated Testing (Future)

### Unit Tests
```javascript
// Example: auth.js tests
describe('CCAuth', () => {
  test('login with valid credentials', async () => {
    const result = await CCAuth.login('test@example.com', 'password', 'myciti', 'USER');
    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });
  
  test('logout clears storage', () => {
    CCAuth.logout();
    expect(localStorage.getItem('capeconnect_token')).toBeNull();
  });
});
```

### Integration Tests
```javascript
// Example: Booking flow test
describe('Booking Flow', () => {
  test('complete GA booking', async () => {
    await login('passenger@example.com', 'password', 'ga');
    await navigateTo('/ga-route-calculator');
    await fillForm({ origin: 'Cape Town', destination: 'Bellville' });
    await clickButton('Calculate');
    // ... continue flow
    expect(getTickets()).toHaveLength(1);
  });
});
```

### E2E Tests (Playwright/Cypress)
```javascript
// Example: E2E test
test('user can book ticket', async ({ page }) => {
  await page.goto('http://localhost:8000');
  await page.click('text=Golden Arrow');
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button:has-text("Sign In")');
  await expect(page).toHaveURL('/dashboard');
});
```

---

**Happy Testing!** 🧪 Report any issues you find.
