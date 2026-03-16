# CapeConnect - Architecture Documentation

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                     index.html (SPA)                      │ │
│  │                                                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │ │
│  │  │   Landing   │  │    Login    │  │  Dashboard  │     │ │
│  │  │    Page     │→ │    Page     │→ │    Page     │     │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │ │
│  │                                                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │ │
│  │  │   Tickets   │  │   Wallet    │  │    Admin    │     │ │
│  │  │    Page     │  │    Page     │  │    Pages    │     │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                   JavaScript Modules                      │ │
│  │                                                           │ │
│  │  config.js → router.js → auth.js → api.js               │ │
│  │      ↓           ↓          ↓         ↓                  │ │
│  │  components.js ← pages.js ← app.js                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    LocalStorage                           │ │
│  │  • Auth Token  • User Data  • Tickets  • Wallet          │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ↕ HTTP/HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API SERVER                         │
│                    (Node.js + Express)                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    API Endpoints                          │ │
│  │                                                           │ │
│  │  /api/auth/*     - Authentication                        │ │
│  │  /api/tickets/*  - Ticket Management                     │ │
│  │  /api/wallets/*  - Wallet Operations                     │ │
│  │  /api/routes/*   - Route Information                     │ │
│  │  /api/admin/*    - Admin Functions                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↕                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                      Database                             │ │
│  │              (SQLite / PostgreSQL)                        │ │
│  │                                                           │ │
│  │  • users  • tickets  • wallets  • routes  • audit_logs   │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Module Dependencies

```
app.js (Entry Point)
  │
  ├─→ config.js (Configuration)
  │     └─→ Defines: API_BASE_URL, OPERATORS, ROUTES, STORAGE_KEYS
  │
  ├─→ router.js (Navigation)
  │     ├─→ Uses: config.js, auth.js, pages.js
  │     └─→ Handles: URL routing, history management, page transitions
  │
  ├─→ auth.js (Authentication)
  │     ├─→ Uses: config.js, api.js
  │     └─→ Handles: login, signup, logout, token management
  │
  ├─→ api.js (Backend Communication)
  │     ├─→ Uses: config.js, auth.js
  │     └─→ Handles: HTTP requests, error handling, data fetching
  │
  ├─→ components.js (UI Components)
  │     ├─→ Uses: config.js, auth.js
  │     └─→ Provides: Navbar, Cards, Modals, Toasts, Forms
  │
  └─→ pages.js (Page Rendering)
        ├─→ Uses: config.js, router.js, auth.js, api.js, components.js
        └─→ Renders: All application pages
```

## Data Flow Diagrams

### Authentication Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Enter credentials
     ↓
┌────────────────┐
│  Login Page    │
│  (pages.js)    │
└────┬───────────┘
     │ 2. Submit form
     ↓
┌────────────────┐
│   auth.js      │
│   login()      │
└────┬───────────┘
     │ 3. POST /api/auth/login
     ↓
┌────────────────┐
│  Backend API   │
│  Validate      │
└────┬───────────┘
     │ 4. Return JWT token
     ↓
┌────────────────┐
│  auth.js       │
│  Store token   │
└────┬───────────┘
     │ 5. Save to LocalStorage
     ↓
┌────────────────┐
│  router.js     │
│  navigate()    │
└────┬───────────┘
     │ 6. Redirect to dashboard
     ↓
┌────────────────┐
│  Dashboard     │
│  (pages.js)    │
└────────────────┘
```

### Ticket Purchase Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Click "Book Ticket"
     ↓
┌────────────────┐
│  Booking Page  │
│  Select route  │
└────┬───────────┘
     │ 2. Choose fare type
     ↓
┌────────────────┐
│  Fare Page     │
│  Select qty    │
└────┬───────────┘
     │ 3. Review details
     ↓
┌────────────────┐
│  Results Page  │
│  Confirm       │
└────┬───────────┘
     │ 4. Enter payment info
     ↓
┌────────────────┐
│  Payment Page  │
│  Process       │
└────┬───────────┘
     │ 5. POST /api/tickets
     ↓
┌────────────────┐
│  Backend API   │
│  Create ticket │
└────┬───────────┘
     │ 6. Return ticket data
     ↓
┌────────────────┐
│  LocalStorage  │
│  Save ticket   │
└────┬───────────┘
     │ 7. Show success
     ↓
┌────────────────┐
│  Dashboard     │
│  Display ticket│
└────────────────┘
```

### Navigation Flow

```
┌──────────┐
│  User    │
└────┬─────┘
     │ 1. Click link or button
     ↓
┌────────────────┐
│  Event Handler │
│  Intercept     │
└────┬───────────┘
     │ 2. Prevent default
     ↓
┌────────────────┐
│  router.js     │
│  navigate()    │
└────┬───────────┘
     │ 3. Update history
     ↓
┌────────────────┐
│  router.js     │
│  handleRoute() │
└────┬───────────┘
     │ 4. Check authentication
     ↓
┌────────────────┐
│  auth.js       │
│  isAuth()?     │
└────┬───────────┘
     │ 5. If authenticated
     ↓
┌────────────────┐
│  pages.js      │
│  renderPage()  │
└────┬───────────┘
     │ 6. Generate HTML
     ↓
┌────────────────┐
│  DOM           │
│  Update #app   │
└────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CCComponents                           │
│                   (components.js)                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Navbar     │  │  TicketCard  │  │  WalletCard  │    │
│  │              │  │              │  │              │    │
│  │ • Logo       │  │ • Route      │  │ • Balance    │    │
│  │ • Nav Links  │  │ • Status     │  │ • Add Funds  │    │
│  │ • User Menu  │  │ • QR Code    │  │ • Actions    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    Toast     │  │   Spinner    │  │    Modal     │    │
│  │              │  │              │  │              │    │
│  │ • Success    │  │ • Loading    │  │ • Add Funds  │    │
│  │ • Error      │  │ • Animation  │  │ • QR Code    │    │
│  │ • Info       │  │              │  │ • Confirm    │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## State Management

```
┌─────────────────────────────────────────────────────────────┐
│                      LocalStorage                           │
│                   (Browser Storage)                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  capeconnect_token                                   │  │
│  │  • JWT authentication token                          │  │
│  │  • Expires in 7 days                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  capeconnect_user                                    │  │
│  │  • User ID, email, name                              │  │
│  │  • Role (USER/ADMIN)                                 │  │
│  │  • Operator (MYCITI/GOLDEN_ARROW)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  capeconnect_operator                                │  │
│  │  • Selected operator (myciti/ga)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  capeconnectTickets                                  │  │
│  │  • Array of ticket objects                           │  │
│  │  • Includes active, used, expired                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  capeconnect_wallet                                  │  │
│  │  • Balance (in cents)                                │  │
│  │  • Last updated timestamp                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Routing System

```
┌─────────────────────────────────────────────────────────────┐
│                      URL Routes                             │
│                                                             │
│  /                    → Landing Page (Operator Selection)   │
│  /login               → Login Page                          │
│  /signup              → Signup Page                         │
│  /forgot-password     → Password Reset                      │
│                                                             │
│  /dashboard           → User Dashboard (Auth Required)      │
│  /tickets             → My Tickets (Auth Required)          │
│  /wallet              → Wallet (Auth Required)              │
│  /booking             → Book Ticket (Auth Required)         │
│  /profile             → User Profile (Auth Required)        │
│  /timetable           → Route Timetables (Auth Required)    │
│                                                             │
│  /ga-route-calculator → GA: Route Calculator                │
│  /ga-choose-fare      → GA: Fare Selection                  │
│  /ga-results          → GA: Booking Results                 │
│  /ga-payment          → GA: Payment Processing              │
│                                                             │
│  /admin/dashboard     → Admin Dashboard (Admin Only)        │
│  /admin/tickets       → Ticket Management (Admin Only)      │
│  /admin/users         → User Management (Admin Only)        │
│  /admin/wallets       → Wallet Management (Admin Only)      │
│  /admin/audit         → Audit Logs (Admin Only)             │
│  /admin/prices        → Price Management (Admin Only)       │
│  /admin/timetables    → Timetable Management (Admin Only)   │
│  /admin/settings      → System Settings (Admin Only)        │
│                                                             │
│  /terms               → Terms of Service                    │
│  /privacy             → Privacy Policy                      │
└─────────────────────────────────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Layer 1: HTTPS/TLS                                  │  │
│  │  • Encrypted communication                           │  │
│  │  • SSL certificate                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Layer 2: Authentication                             │  │
│  │  • JWT tokens                                        │  │
│  │  • Token expiration                                  │  │
│  │  • Secure storage                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Layer 3: Authorization                              │  │
│  │  • Role-based access (USER/ADMIN)                    │  │
│  │  • Route protection                                  │  │
│  │  • API endpoint guards                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Layer 4: Input Validation                           │  │
│  │  • Client-side validation                            │  │
│  │  • Server-side validation                            │  │
│  │  • XSS protection                                    │  │
│  │  • SQL injection prevention                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Layer 5: Rate Limiting                              │  │
│  │  • API request throttling                            │  │
│  │  • DDoS protection                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Setup                         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  CDN (Cloudflare)                                    │  │
│  │  • Static assets caching                             │  │
│  │  • DDoS protection                                   │  │
│  │  • SSL termination                                   │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       ↓                                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Load Balancer                                       │  │
│  │  • Traffic distribution                              │  │
│  │  • Health checks                                     │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       ↓                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Frontend Servers (Static Hosting)                  │   │
│  │  • Netlify / Vercel / S3                            │   │
│  │  • index.html + assets                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Backend Servers (Node.js)                          │   │
│  │  • Express API                                      │   │
│  │  • PM2 process manager                              │   │
│  │  • Multiple instances                               │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       ↓                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Database (PostgreSQL)                              │   │
│  │  • Primary + Read replicas                          │   │
│  │  • Automated backups                                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Performance Optimization

```
┌─────────────────────────────────────────────────────────────┐
│                  Optimization Strategy                      │
│                                                             │
│  Frontend:                                                  │
│  • Minified JavaScript (Terser)                            │
│  • Compressed CSS (cssnano)                                │
│  • Optimized images (WebP, lazy loading)                   │
│  • Code splitting (dynamic imports)                        │
│  • Browser caching (Cache-Control headers)                 │
│                                                             │
│  Backend:                                                   │
│  • Database query optimization                             │
│  • Redis caching layer                                     │
│  • Connection pooling                                      │
│  • Gzip compression                                        │
│  • API response caching                                    │
│                                                             │
│  Network:                                                   │
│  • CDN for static assets                                   │
│  • HTTP/2 multiplexing                                     │
│  • Prefetch critical resources                             │
│  • Service worker (offline support)                        │
└─────────────────────────────────────────────────────────────┘
```

## Monitoring & Logging

```
┌─────────────────────────────────────────────────────────────┐
│                  Monitoring Stack                           │
│                                                             │
│  Application Monitoring:                                    │
│  • Sentry (Error tracking)                                 │
│  • New Relic (Performance monitoring)                      │
│  • Google Analytics (User analytics)                       │
│                                                             │
│  Server Monitoring:                                         │
│  • PM2 (Process monitoring)                                │
│  • DataDog (Infrastructure monitoring)                     │
│  • UptimeRobot (Uptime monitoring)                         │
│                                                             │
│  Logging:                                                   │
│  • Winston (Application logs)                              │
│  • Papertrail (Centralized logging)                        │
│  • CloudWatch (AWS logs)                                   │
└─────────────────────────────────────────────────────────────┘
```

---

This architecture provides a scalable, maintainable, and secure foundation for CapeConnect.
