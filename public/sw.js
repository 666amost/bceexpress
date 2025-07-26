const CACHE_NAME = 'bce-express-v5.3.1';
const CRITICAL_CACHE = 'bce-critical-v5.3.1';
const API_CACHE = 'bce-api-v5.3.1';
const IMAGE_CACHE = 'bce-images-v5.3.1';

// Critical resources to cache immediately
const CRITICAL_RESOURCES = [
  '/',
  '/courier',
  '/courier/dashboard',
  '/manifest.json',
  '/offline.html'
];

// API patterns for caching strategy
const API_PATTERNS = [
  /\/api\/version/,
  /\/api\/auth/,
  /\/api\/shipments/
];

// Image patterns
const IMAGE_PATTERNS = [
  /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i,
  /\/images\//,
  /supabase\.co.*\/storage\//
];

// Network timeout for fetch operations
const NETWORK_TIMEOUT = 3000; // 3 seconds

// Install event - cache critical resources only
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Cache critical resources
      caches.open(CRITICAL_CACHE).then((cache) => {
        return cache.addAll(CRITICAL_RESOURCES.filter(url => url !== '/offline.html'));
      }),
      // Create offline fallback
      caches.open(CACHE_NAME).then((cache) => {
        return cache.add('/offline.html');
      })
    ]).then(() => {
      // Skip waiting to activate immediately
      self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches efficiently
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        const validCaches = [CACHE_NAME, CRITICAL_CACHE, API_CACHE, IMAGE_CACHE];
        return Promise.all(
          cacheNames
            .filter(cacheName => !validCaches.includes(cacheName))
            .map(cacheName => caches.delete(cacheName))
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Optimized fetch event with different strategies
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests (except images)
  if (url.origin !== self.location.origin && !IMAGE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    return;
  }
  
  // Version check API - always fetch fresh
  if (/\/api\/version/.test(url.pathname)) {
    event.respondWith(
      fetch(request, {
        headers: { 'Cache-Control': 'no-cache' }
      }).catch(() => 
        new Response('{"version":"offline","error":"Network unavailable"}', {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }
  
  // Images - Cache First with fallback
  if (IMAGE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }
  
  // API calls - Network First with timeout
  if (API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(networkFirstWithTimeout(request, API_CACHE));
    return;
  }
  
  // Critical resources - Cache First
  if (CRITICAL_RESOURCES.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, CRITICAL_CACHE));
    return;
  }
  
  // Other resources - Stale While Revalidate
  event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
});

// Cache First strategy (for images and critical resources)
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetchWithTimeout(request);
    
    if (networkResponse.ok) {
      // Clone before caching
      const responseToCache = networkResponse.clone();
      cache.put(request, responseToCache);
    }
    
    return networkResponse;
    
  } catch (error) {
    // Return offline fallback for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(CACHE_NAME);
      return cache.match('/offline.html');
    }
    
    // Return empty response for other failed requests
    return new Response('', { status: 408, statusText: 'Request Timeout' });
  }
}

// Network First with timeout (for API calls)
async function networkFirstWithTimeout(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    
    try {
      const networkResponse = await fetchWithTimeout(request);
      
      if (networkResponse.ok) {
        // Cache successful API responses (but not error responses)
        const responseToCache = networkResponse.clone();
        cache.put(request, responseToCache);
      }
      
      return networkResponse;
      
    } catch (networkError) {
      // Network failed, try cache
      const cachedResponse = await cache.match(request);
      
      if (cachedResponse) {
        return cachedResponse;
      }
      
      throw networkError;
    }
    
  } catch (error) {
    // Return error response
    return new Response(
      JSON.stringify({ error: 'Network unavailable', offline: true }), 
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Stale While Revalidate (for general resources)
async function staleWhileRevalidate(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    // Start network request in background
    const networkPromise = fetchWithTimeout(request).then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    }).catch(() => {
      // Silent fail for background updates
    });
    
    // Return cached version immediately if available
    if (cachedResponse) {
      // Start background update
      event.waitUntil(networkPromise);
      return cachedResponse;
    }
    
    // Wait for network if no cache available
    return await networkPromise;
    
  } catch (error) {
    // Fallback for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(CACHE_NAME);
      return cache.match('/offline.html');
    }
    
    return new Response('', { status: 408, statusText: 'Request Timeout' });
  }
}

// Fetch with timeout utility
function fetchWithTimeout(request, timeout = NETWORK_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, timeout);
    
    fetch(request).then(response => {
      clearTimeout(timeoutId);
      resolve(response);
    }).catch(error => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

// Background sync for offline actions (if supported)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Get pending actions from IndexedDB or localStorage
    const pendingActions = await getPendingActions();
    
    for (const action of pendingActions) {
      try {
        await fetch(action.url, action.options);
        await removePendingAction(action.id);
      } catch (error) {
        console.warn('Background sync failed for action:', action.id);
      }
    }
  } catch (error) {
    console.warn('Background sync failed:', error);
  }
}

// Placeholder functions for background sync
async function getPendingActions() {
  // Implement reading from IndexedDB
  return [];
}

async function removePendingAction(id) {
  // Implement removing from IndexedDB
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  const { data } = event;
  
  switch (data.type) {
    case 'CHECK_VERSION':
      checkForUpdates();
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'CACHE_URLS':
      cacheUrls(data.urls).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    default:
      // Unknown message type
      break;
  }
});

// Clear all caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

// Cache specific URLs
async function cacheUrls(urls) {
  const cache = await caches.open(CACHE_NAME);
  return Promise.all(
    urls.map(url => 
      fetch(url).then(response => {
        if (response.ok) {
          return cache.put(url, response);
        }
      }).catch(() => {
        // Silent fail for individual URLs
      })
    )
  );
}

// Optimized update checker
async function checkForUpdates() {
  try {
    const response = await fetch(self.location.origin + '/api/version', {
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    if (!response.ok) {
      throw new Error('Version check failed');
    }
    
    const data = await response.json();
    
    // Get current version from cache name
    const currentVersion = CACHE_NAME.split('-v')[1];
    
    // Only update if version is different and valid
    if (data.version && currentVersion && data.version !== currentVersion) {
      // Notify clients of update
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_AVAILABLE',
          version: data.version,
          currentVersion: currentVersion
        });
      });
      
      // Prepare for update
      self.skipWaiting();
    }
    
  } catch (error) {
    console.warn('Update check failed:', error);
  }
}

// Periodic update check (every 2 hours when active)
let updateCheckInterval;

self.addEventListener('message', (event) => {
  if (event.data === 'START_UPDATE_CHECK') {
    updateCheckInterval = setInterval(checkForUpdates, 2 * 60 * 60 * 1000); // 2 hours
  } else if (event.data === 'STOP_UPDATE_CHECK') {
    clearInterval(updateCheckInterval);
  }
});

// Initial update check
checkForUpdates();

// Performance monitoring
let performanceMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  networkRequests: 0,
  errors: 0
};

// Track performance metrics
function trackMetric(type) {
  performanceMetrics[type]++;
  
  // Send metrics to main thread periodically
  if (performanceMetrics.networkRequests % 50 === 0) {
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'PERFORMANCE_METRICS',
          metrics: { ...performanceMetrics }
        });
      });
    });
  }
}
self.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkForUpdates();
  }
}); 