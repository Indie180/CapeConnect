// CapeConnect Service Worker - Phase 3 Enhanced
// Advanced offline functionality and caching for mobile app

const CACHE_NAME = 'capeconnect-v3';
const STATIC_CACHE = 'capeconnect-static-v3';
const DYNAMIC_CACHE = 'capeconnect-dynamic-v3';
const OFFLINE_CACHE = 'capeconnect-offline-v3';

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/css/mobile-responsive.css',
  '/css/styles.css',
  '/css/components.css',
  '/manifest.json',
  '/templates/mobile-page-template.html',
  '/components/mobile-nav.html',
  '/components/service-card.html',
  '/components/mobile-form.html',
  '/myciti-dashboard.html',
  '/golden-arrow-dashboard.html',
  '/choose-fare.html',
  '/login.html',
  '/offline.html'
];

// Critical offline pages
const OFFLINE_PAGES = [
  '/offline.html',
  '/myciti-dashboard.html',
  '/golden-arrow-dashboard.html'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  '/api/routes',
  '/api/timetables',
  '/api/fares',
  '/api/user/tickets'
];

// Files to cache dynamically
const DYNAMIC_FILES = [
  '/dashboard.html',
  '/choose-fare.html',
  '/ga-choose-fare.html',
  '/tickets.html',
  '/wallet.html',
  '/profile.html'
];

// Install event - cache static files
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Static files cached');
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('Service Worker: Error caching static files', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip external requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Handle different types of requests
  if (isStaticFile(request.url)) {
    // Static files: Cache first, then network
    event.respondWith(cacheFirst(request));
  } else if (isAPIRequest(request.url)) {
    // API requests: Network first, then cache
    event.respondWith(networkFirst(request));
  } else {
    // Other requests: Stale while revalidate
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Cache first strategy (for static files)
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Cache first failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network first strategy (for API requests)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html') || new Response('Offline', { 
        status: 503,
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => cachedResponse);
  
  return cachedResponse || fetchPromise;
}

// Helper functions
function isStaticFile(url) {
  return url.includes('/css/') || 
         url.includes('/js/') || 
         url.includes('/images/') ||
         url.includes('/icons/') ||
         url.includes('/pictures/') ||
         url.includes('/components/') ||
         url.includes('/templates/') ||
         url.endsWith('.css') ||
         url.endsWith('.js') ||
         url.endsWith('.png') ||
         url.endsWith('.jpg') ||
         url.endsWith('.jpeg') ||
         url.endsWith('.webp') ||
         url.endsWith('.svg');
}

function isAPIRequest(url) {
  return url.includes('/api/') || 
         url.includes('/backend/');
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync', event.tag);
  
  if (event.tag === 'ticket-purchase') {
    event.waitUntil(syncTicketPurchase());
  } else if (event.tag === 'wallet-topup') {
    event.waitUntil(syncWalletTopup());
  }
});

// Sync ticket purchases when back online
async function syncTicketPurchase() {
  try {
    // Get pending ticket purchases from IndexedDB
    const pendingPurchases = await getPendingPurchases();
    
    for (const purchase of pendingPurchases) {
      try {
        const response = await fetch('/api/tickets/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(purchase.data)
        });
        
        if (response.ok) {
          await removePendingPurchase(purchase.id);
          console.log('Synced ticket purchase:', purchase.id);
        }
      } catch (error) {
        console.error('Failed to sync ticket purchase:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Sync wallet top-ups when back online
async function syncWalletTopup() {
  try {
    // Get pending wallet top-ups from IndexedDB
    const pendingTopups = await getPendingTopups();
    
    for (const topup of pendingTopups) {
      try {
        const response = await fetch('/api/wallet/topup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(topup.data)
        });
        
        if (response.ok) {
          await removePendingTopup(topup.id);
          console.log('Synced wallet topup:', topup.id);
        }
      } catch (error) {
        console.error('Failed to sync wallet topup:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// IndexedDB helpers (simplified - would need full implementation)
async function getPendingPurchases() {
  // Implementation would use IndexedDB to get pending purchases
  return [];
}

async function removePendingPurchase(id) {
  // Implementation would remove purchase from IndexedDB
  console.log('Removing pending purchase:', id);
}

async function getPendingTopups() {
  // Implementation would use IndexedDB to get pending topups
  return [];
}

async function removePendingTopup(id) {
  // Implementation would remove topup from IndexedDB
  console.log('Removing pending topup:', id);
}

// Push notification handling
self.addEventListener('push', event => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from CapeConnect',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/icons/action-explore.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/action-close.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('CapeConnect', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling from main thread
self.addEventListener('message', event => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('Service Worker: Loaded');
