// CapeConnect Configuration
window.CCConfig = {
  API_BASE_URL: 'http://localhost:4000',
  
  OPERATORS: {
    MYCITI: {
      id: 'myciti',
      name: 'MyCiTi',
      displayName: 'MyCiTi',
      color: '#005DAA',
      accentColor: '#E2231A',
      icon: '🚌',
      tagline: "Cape Town's Bus Rapid Transit"
    },
    GOLDEN_ARROW: {
      id: 'ga',
      name: 'Golden Arrow',
      displayName: 'Golden Arrow',
      color: '#1E7F43',
      accentColor: '#FFB300',
      icon: '🚍',
      tagline: 'Connecting Communities Since 1861'
    }
  },
  
  ROUTES: {
    // Landing & Auth
    HOME: '/',
    LOGIN: '/login',
    SIGNUP: '/signup',
    FORGOT_PASSWORD: '/forgot-password',
    VERIFICATION: '/verification',
    
    // Passenger Routes
    DASHBOARD: '/dashboard',
    BOOKING: '/booking',
    CHOOSE_BUS: '/choose-bus',
    CHOOSE_FARE: '/choose-fare',
    PAYMENT: '/payment',
    TICKETS: '/tickets',
    WALLET: '/wallet',
    PROFILE: '/profile',
    TIMETABLE: '/timetable',
    
    // Golden Arrow Specific
    GA_CALCULATOR: '/ga-calculator',
    GA_ROUTE_CALCULATOR: '/ga-route-calculator',
    GA_CHOOSE_FARE: '/ga-choose-fare',
    GA_RESULTS: '/ga-results',
    GA_PAYMENT: '/ga-payment',
    GA_BOOKING: '/ga-booking',
    
    // MyCiTi Specific
    MYCITI_CALCULATOR: '/myciti-calculator',
    
    // Admin Routes
    ADMIN: '/admin',
    ADMIN_DASHBOARD: '/admin/dashboard',
    ADMIN_TICKETS: '/admin/tickets',
    ADMIN_USERS: '/admin/users',
    ADMIN_WALLETS: '/admin/wallets',
    ADMIN_AUDIT: '/admin/audit',
    ADMIN_PRICES: '/admin/prices',
    ADMIN_TIMETABLES: '/admin/timetables',
    ADMIN_SETTINGS: '/admin/settings',
    
    // Legal
    TERMS: '/terms',
    PRIVACY: '/privacy'
  },
  
  STORAGE_KEYS: {
    AUTH_TOKEN: 'capeconnect_token',
    USER_DATA: 'capeconnect_user',
    OPERATOR: 'capeconnect_operator',
    TICKETS: 'capeconnectTickets',
    WALLET: 'capeconnect_wallet',
    BOOKING_STATE: 'capeconnect_booking_state',
    GA_BOOKING_STATE: 'gaBookingState'
  }
};
