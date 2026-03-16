# CapeConnect - Transit Ticketing Platform

## Project Overview
CapeConnect is a comprehensive transit ticketing and wallet management platform for Cape Town, South Africa. It serves two major bus operators: **MyCiTi** (formal BRT system) and **Golden Arrow** (informal bus service). The platform provides digital ticketing, wallet management, route planning, and administrative tools.

## Tech Stack

### Backend
- **Runtime:** Node.js 20+ with ES Modules
- **Framework:** Express.js
- **Database:** SQLite (sql.js) for development, PostgreSQL for production
- **Authentication:** Bearer token sessions stored in database
- **Security:** Helmet, CORS, bcryptjs for password hashing
- **Validation:** Zod schemas
- **Rate Limiting:** express-rate-limit

### Frontend
- **Legacy HTML:** Original booking flows, calculators, and admin portal
- **React App:** Modern SPA for dashboard, tickets, wallet (Vite + React 19)
- **Styling:** Custom CSS with dual-operator theming
- **Icons:** Font Awesome 6.4.0
- **Routing:** React Router DOM

### DevOps
- **CI/CD:** GitHub Actions
- **Containerization:** Docker + Docker Compose
- **API Documentation:** OpenAPI 3.0 (openapi.yml)

## Project Structure

```
capeconnect/
├── backend/                          # Node.js API Server
│   ├── src/
│   │   ├── app.js                   # Express app configuration
│   │   ├── server.js                # Server entry point
│   │   ├── config.js                # Environment configuration
│   │   ├── db.js                    # Database abstraction (SQLite/PostgreSQL)
│   │   ├── init-db.js               # Database initialization & seeding
│   │   ├── middleware/
│   │   │   ├── auth.js              # Authentication middleware
│   │   │   ├── errorHandler.js     # Global error handler
│   │   │   └── rateLimiter.js      # Rate limiting
│   │   ├── routes/
│   │   │   ├── auth.js              # Login, logout, refresh, me
│   │   │   ├── tickets.js           # Ticket CRUD & usage
│   │   │   ├── wallets.js           # Wallet top-up & spend
│   │   │   ├── routes.js            # Route listings
│   │   │   ├── timetables.js        # Timetable data
│   │   │   ├── prices.js            # Fare pricing
│   │   │   └── admin.js             # Admin operations
│   │   └── utils/
│   │       └── validation.js        # Zod validation schemas
│   ├── sql/
│   │   ├── schema.sql               # PostgreSQL schema
│   │   ├── seed.sql                 # Seed data
│   │   └── migrations/              # Database migrations
│   ├── test/
│   │   └── api.test.js              # API tests
│   ├── .env                         # Environment variables
│   ├── .env.example                 # Environment template
│   ├── package.json                 # Dependencies
│   ├── Dockerfile                   # Container image
│   ├── docker-compose.yml           # PostgreSQL service
│   ├── openapi.yml                  # API documentation
│   └── README.md                    # Backend documentation
│
├── frontend-react/                   # React SPA
│   ├── src/
│   │   ├── main.jsx                 # React entry point
│   │   ├── App.jsx                  # Main app component & routing
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx        # Login form
│   │   │   ├── DashboardPage.jsx    # User dashboard
│   │   │   ├── TicketsPage.jsx      # Ticket management
│   │   │   └── WalletPage.jsx       # Wallet management
│   │   └── lib/
│   │       └── authClient.js        # Auth utilities
│   ├── public/
│   │   ├── css/                     # Original CSS files
│   │   └── pictures/                # Images & logos
│   ├── index.html                   # HTML entry point
│   ├── package.json                 # Dependencies
│   ├── vite.config.js               # Vite configuration
│   └── README.md                    # Frontend documentation
│
├── css/                              # Shared CSS (legacy HTML)
│   ├── styles.css                   # Main styles with dual theming
│   ├── components.css               # Reusable components
│   ├── flow-components.css          # Booking flow styles
│   └── ga-experience.css            # Golden Arrow specific styles
│
├── pictures/                         # Images & logos
│   ├── myciti-removebg-preview.png
│   ├── Golden_Arrow-removebg-preview.png
│   └── [other images]
│
├── data/                             # Static data files
│   ├── golden-arrow.json            # GA routes & fares
│   ├── myciti.json                  # MyCiTi stops & passes
│   └── source-registry.json         # Data source metadata
│
├── docs/                             # Documentation
│   ├── SETUP.md                     # Setup instructions
│   ├── WINDOWS_SETUP.md             # Windows-specific guide
│   ├── branch-protection.md         # Git workflow
│   └── data-source-contract.md      # Data format specs
│
├── admin-goldenarrow/                # Golden Arrow admin pages
│   ├── dashboard.html
│   ├── tickets.html
│   ├── users.html
│   └── [other admin pages]
│
├── admin-myciti/                     # MyCiTi admin pages
│   ├── dashboard.html
│   ├── tickets.html
│   └── [other admin pages]
│
├── admin-common/                     # Shared admin assets
│   ├── charts.js
│   ├── export.js
│   └── [theme files]
│
├── Legacy HTML Pages (root)
│   ├── dashboard.html               # Main user dashboard
│   ├── booking.html                 # MyCiTi booking flow
│   ├── ga-booking.html              # Golden Arrow booking
│   ├── choose-bus.html              # Operator selection
│   ├── choose-fare.html             # Fare selection
│   ├── admin.html                   # Admin portal
│   ├── admin.js                     # Admin logic
│   └── [other pages]
│
├── .github/
│   └── workflows/
│       └── ci.yml                   # CI/CD pipeline
│
├── .gitignore                       # Git ignore rules
├── README.md                        # Main project README
├── QUICKSTART.md                    # Quick start guide
├── CONTRIBUTING.md                  # Contribution guidelines
└── PROJECT_OVERVIEW.md              # This file

```

## Key Features

### User Features
1. **Dual Operator Support**
   - MyCiTi (formal BRT system)
   - Golden Arrow (informal bus service)
   - Dynamic theming based on selected operator

2. **Digital Ticketing**
   - Purchase tickets via wallet or card
   - QR code generation for validation
   - Ticket history and status tracking
   - Multi-journey passes (Golden Arrow)
   - Top-up cards (MyCiTi)

3. **Wallet Management**
   - Real-time balance tracking
   - Top-up functionality
   - Transaction history
   - Operator-specific wallets

4. **Route Planning**
   - Stop-to-stop route search
   - Real-time timetables
   - Fare calculation
   - Journey planning tools

5. **User Dashboard**
   - Active tickets display
   - Wallet balance overview
   - Recent transactions
   - Quick actions (book, top-up)

### Admin Features
1. **Dual-Bus Admin Portal**
   - Switch between GA/MyCiTi contexts
   - Operator-scoped data views
   - Unified admin interface

2. **Route Management**
   - Add/edit/delete routes
   - Bulk timetable import
   - Route search and filtering
   - Fare configuration

3. **User Management**
   - User status control (active/blocked/deactivated/blacklisted)
   - Wallet balance viewing
   - User filtering by operator
   - Role management

4. **Analytics Dashboard**
   - Daily booking statistics
   - Revenue tracking
   - Active route counts
   - User metrics

5. **Audit Logging**
   - All admin actions logged
   - Operator-scoped audit trails
   - Searchable activity logs

## Design System

### Color Schemes

**MyCiTi Branding:**
- Primary Blue: `#005DAA`
- Alert Red: `#E2231A`
- White: `#FFFFFF`
- Grey: `#B0B7C3`

**Golden Arrow Branding:**
- Golden Yellow: `#FFB300`
- Forest Green: `#1E7F43`
- White: `#FFFFFF`
- Dark Grey: `#2E2E2E`

**Dark Theme (Default):**
- Background Main: `#0f172a`
- Background Card: `#1e293b`
- Text Main: `#f8fafc`
- Text Muted: `#94a3b8`

**Light Theme:**
- Background Main: `#f8fafc`
- Background Card: `#ffffff`
- Text Main: `#0f172a`
- Text Muted: `#64748b`

### Typography
- **Primary Font:** Inter (MyCiTi), Nunito Sans (Golden Arrow)
- **Monospace:** ui-monospace, Menlo, Monaco (for prices/codes)
- **Icons:** Font Awesome 6.4.0

### Layout Patterns
1. **Hero Sections:** Full-width with angled backgrounds, SVG waves, accent lines
2. **Card Grids:** Responsive 6-column (desktop) → 1-column (mobile)
3. **Ticket Cards:** Light cards with QR codes, badges, structured info rows
4. **Stats Grids:** 4-column responsive grids with icons and values
5. **Feature Cards:** Hover effects with icon, title, description

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Tickets
- `GET /api/tickets` - List user tickets (with status filter)
- `POST /api/tickets` - Purchase ticket
- `POST /api/tickets/:id/use` - Use/validate ticket

### Wallets
- `GET /api/wallets/me` - Get user wallet
- `POST /api/wallets/topup` - Top up wallet
- `POST /api/wallets/spend` - Spend from wallet

### Routes & Timetables
- `GET /api/routes` - List routes
- `GET /api/routes/stops` - List stops
- `GET /api/timetables` - Get timetables
- `GET /api/prices` - Get fare prices

### Admin (Requires ADMIN role)
- `GET /api/admin/bootstrap` - Get operator-scoped data
- `POST /api/admin/users/bulk` - Bulk user operations
- `POST /api/admin/tickets/bulk` - Bulk ticket operations
- `POST /api/admin/wallets/bulk` - Bulk wallet operations
- `POST /api/admin/prices/global/bulk` - Update global prices
- `POST /api/admin/prices/routes/bulk` - Update route prices
- `POST /api/admin/timetables/bulk` - Import timetables
- `GET /api/admin/audit` - Get audit logs
- `POST /api/admin/audit` - Create audit log

### Health
- `GET /health` - Service health check

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'USER',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  operator TEXT,
  created_at DATETIME DEFAULT (datetime('now'))
);
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Refresh Sessions Table
```sql
CREATE TABLE refresh_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME,
  replaced_by_hash TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Wallets Table
```sql
CREATE TABLE wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  balance REAL NOT NULL DEFAULT 0,
  operator TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Tickets Table
```sql
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  route_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PAID',
  price REAL NOT NULL,
  purchased_at DATETIME DEFAULT (datetime('now')),
  used_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (route_id) REFERENCES routes(id)
);
```

### Routes Table
```sql
CREATE TABLE routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator TEXT NOT NULL,
  route_number TEXT NOT NULL,
  route_name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now'))
);
```

### Stops Table
```sql
CREATE TABLE stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator TEXT NOT NULL,
  stop_name TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  created_at DATETIME DEFAULT (datetime('now'))
);
```

### Timetables Table
```sql
CREATE TABLE timetables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER NOT NULL,
  stop_id INTEGER NOT NULL,
  arrival_time TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (route_id) REFERENCES routes(id),
  FOREIGN KEY (stop_id) REFERENCES stops(id)
);
```

### Prices Table
```sql
CREATE TABLE prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  operator TEXT NOT NULL,
  route_id INTEGER,
  fare_type TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (route_id) REFERENCES routes(id)
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  operator TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=4000
USE_SQLITE=true
DATABASE_URL=postgres://postgres:postgres@localhost:5432/capeconnect
FRONTEND_ORIGIN=http://127.0.0.1:5512,http://localhost:5173
SESSION_TTL_MINUTES=30
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:4000
```

## Demo Users

All demo users have the password: `Demo#123`

- `myciti-admin@capeconnect.demo` - MyCiTi Admin
- `ga-admin@capeconnect.demo` - Golden Arrow Admin
- `william@capeconnect.demo` - Regular User (MyCiTi)
- `sihle@capeconnect.demo` - Regular User (Golden Arrow)

## Setup & Installation

### Prerequisites
- Node.js 20+
- npm or yarn
- (Optional) PostgreSQL 16+ or Docker

### Quick Start

1. **Clone Repository**
```bash
git clone <repository-url>
cd capeconnect
```

2. **Backend Setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env if needed (SQLite is default)
npm run dev
```

3. **Frontend Setup**
```bash
cd frontend-react
npm install
cp .env.example .env
npm run dev
```

4. **Access Application**
- React App: http://localhost:5173
- Backend API: http://localhost:4000
- Original HTML: Open files directly in browser

### Docker Setup (Optional)
```bash
cd backend
docker-compose up -d  # Start PostgreSQL
docker build -t capeconnect-api .
docker run -p 4000:4000 --env-file .env capeconnect-api
```

## Development Workflow

### Running Tests
```bash
cd backend
npm test
```

### Linting
```bash
cd backend
npm run lint

cd frontend-react
npm run lint
```

### Building for Production
```bash
cd frontend-react
npm run build
```

## CI/CD Pipeline

GitHub Actions workflow runs on push/PR to main/develop:
1. Backend linting
2. Backend tests with PostgreSQL
3. Frontend linting
4. Frontend build

## Security Features

1. **Authentication**
   - Bcrypt password hashing (10 rounds)
   - Bearer token sessions
   - Refresh token rotation
   - Session expiration (30 min default)

2. **API Security**
   - Helmet.js security headers
   - CORS with origin whitelist
   - Rate limiting (100 req/15min general, 5 req/15min auth)
   - Input validation with Zod

3. **Database Security**
   - Parameterized queries (SQL injection prevention)
   - Foreign key constraints
   - Indexed lookups

## Future Enhancements (Phase 2+)

- [ ] MFA implementation
- [ ] Payment webhook reconciliation
- [ ] QR code validation API
- [ ] Full audit logging for all mutations
- [ ] Stricter RBAC per operator
- [ ] Mobile app (React Native)
- [ ] Real-time notifications
- [ ] Analytics dashboard
- [ ] PWA support
- [ ] Offline mode

## License

Proprietary - All rights reserved

## Support

For issues or questions:
- Email: support@capeconnect.co.za
- Documentation: See `/docs` folder
- API Docs: `backend/openapi.yml`

---

**Last Updated:** March 4, 2026
**Version:** 1.0.0 (Phase 1)
