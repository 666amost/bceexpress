const CACHE_NAME = 'bce-express-v2';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json'
      ]);
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - network first, then cache
self.addEventListener('fetch', (event) => {
  // Skip version check for API calls
  if (event.request.url.includes('/api/version')) {
    event.respondWith(
      fetch(event.request, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the fetched response
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // If network fails, try to get from cache
        return caches.match(event.request);
      })
  );
});

// Check for updates when app opens
self.addEventListener('message', (event) => {
  if (event.data === 'CHECK_VERSION') {
    checkForUpdates();
  }
});

async function checkForUpdates() {
  try {
    const response = await fetch('/api/version', {
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    const data = await response.json();
    
    // Get current version from cache
    const currentVersion = await caches.keys().then(keys => {
      return keys.find(key => key.startsWith('bce-express-'));
    });

    // Only update if version is different
    if (data.version !== currentVersion) {
      // New version available
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'UPDATE_AVAILABLE',
            version: data.version,
            lastSync: data.lastSync
          });
        });
      });
      
      // Force update
      self.skipWaiting();
      
      // Clear all caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            return caches.delete(cacheName);
          })
        );
      });
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}

// Check for updates when the service worker starts
checkForUpdates();

// Check for updates when the app becomes visible
self.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkForUpdates();
  }
}); 