# CapeConnect - Complete Transit System

A unified digital ticketing and wallet management system for Cape Town's transit operators (MyCiTi and Golden Arrow).

## Project Structure

```
CapeConnect/
├── index.html                 # Main entry point (SPA)
├── styles/
│   └── main.css              # Unified stylesheet
├── js/
│   ├── config.js             # Configuration & constants
│   ├── router.js             # Client-side routing
│   ├── auth.js               # Authentication logic
│   ├── api.js                # API client
│   ├── components.js         # Reusable UI components
│   ├── pages.js              # Page rendering logic
│   └── app.js                # Main app initialization
├── backend/                  # Node.js backend API
├── admin-goldenarrow/        # Golden Arrow admin pages
├── admin-myciti/             # MyCiTi admin pages
└── [50+ existing HTML files] # Legacy pages (being integrated)
```

## Features

### Passenger Features
- Operator selection (MyCiTi / Golden Arrow)
- User authentication (login/signup)
- Dashboard with quick actions
- Ticket booking and management
- Digital wallet with balance management
- QR code ticket display
- Route timetables
- Transaction history

### Admin Features
- Admin dashboard
- User management
- Ticket management
- Wallet oversight
- Audit logs
- Price management
- Timetable management
- System settings

### Golden Arrow Specific
- Route calculator
- Fare selection
- Results preview
- Payment processing
- Multi-journey tickets

## Getting Started

### 1. Open the Application

Simply open `index.html` in a modern web browser, or serve it with a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve

# Using PHP
php -S localhost:8000
```

Then navigate to `http://localhost:8000`

### 2. Demo Login

The application runs in demo mode by default:
- Email: any valid email format
- Password: any value
- Select either MyCiTi or Golden Arrow operator
- Choose Passenger or Admin role

### 3. Backend API (Optional)

To connect to the real backend API:

```bash
cd backend
npm install
npm start
```

The backend runs on `http://localhost:4000`

## Architecture

### Single Page Application (SPA)
- All navigation handled by `js/router.js`
- No page reloads, smooth transitions
- Browser history support (back/forward buttons work)
- Deep linking support

### State Management
- Authentication state in localStorage
- Operator selection persisted
- Tickets stored locally (demo mode)
- Wallet balance tracked

### Modular Design
- **config.js**: All constants and configuration
- **router.js**: URL routing and navigation
- **auth.js**: Login, signup, session management
- **api.js**: Backend API communication
- **components.js**: Reusable UI elements
- **pages.js**: Page-specific rendering
- **app.js**: Application initialization

## Integration Status

### ✅ Completed
- Landing page with operator selection
- Login/signup flow
- Dashboard
- Tickets page
- Wallet page
- Navigation system
- Authentication
- Local storage persistence

### 🚧 In Progress
- Golden Arrow booking flow (existing HTML files)
- MyCiTi booking flow
- Admin pages integration
- Backend API integration

### 📋 To Do
- Connect all 50+ existing HTML files
- Implement real payment processing
- Add route search functionality
- Integrate timetable data
- Add transaction history
- Implement admin features
- Add profile management
- Terms & privacy pages

## Operators

### MyCiTi
- Color: #005DAA (Blue)
- Accent: #E2231A (Red)
- Icon: 🚌
- Type: Bus Rapid Transit (BRT)

### Golden Arrow
- Color: #1E7F43 (Green)
- Accent: #FFB300 (Gold)
- Icon: 🚍
- Type: City & Regional Bus Service

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development

### Adding New Pages

1. Add route to `js/config.js`:
```javascript
ROUTES: {
  NEW_PAGE: '/new-page'
}
```

2. Add rendering function to `js/pages.js`:
```javascript
function renderNewPage() {
  app().innerHTML = `...`;
}
```

3. Add route handler to `js/router.js`:
```javascript
else if (path === '/new-page') {
  showNewPage();
}
```

### Adding New Components

Add to `js/components.js`:
```javascript
function createNewComponent(data) {
  return `<div>...</div>`;
}
```

## API Endpoints

See `backend/openapi.yml` for complete API documentation.

Key endpoints:
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `GET /api/tickets` - Get user tickets
- `POST /api/tickets` - Purchase ticket
- `GET /api/wallets/me` - Get wallet balance
- `POST /api/wallets/me/add` - Add funds

## License

Proprietary - CapeConnect Transit System

## Support

For issues or questions, contact the development team.
