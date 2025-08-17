// Versi cache tetap dipertahankan untuk kompatibilitas script sinkronisasi BCE-KURIR
const CACHE_NAME = 'bce-express-v5.5.6';
const CRITICAL_CACHE = 'bce-critical-v5.5.6';
const API_CACHE = 'bce-api-v5.5.6';
const IMAGE_CACHE = 'bce-images-v5.5.6';

// Service Worker minimal: hanya memastikan update versi cepat & sinkronisasi
// Tidak melakukan intercept asset _next atau caching agresif agar tidak ganggu build Next.js

self.addEventListener('install', (event) => {
  // Aktifkan langsung
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Klaim segera agar versi baru langsung aktif
  event.waitUntil(self.clients.claim());
});

// Fetch: hanya khusus endpoint /api/version untuk paksa no-cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && /\/api\/version$/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request, { headers: { 'Cache-Control': 'no-cache' } })
        .catch(() => new Response('{"version":"offline"}', { headers: { 'Content-Type': 'application/json' } }))
    );
  }
  // Semua request lain dilewatkan ke network tanpa modifikasi
});

// Listener pesan optional: halaman bisa kirim 'CHECK_VERSION' untuk memaksa fetch versi
self.addEventListener('message', (event) => {
  if (event.data === 'CHECK_VERSION') {
    fetch('/api/version', { headers: { 'Cache-Control': 'no-cache' } })
      .then(r => r.json())
      .then(data => {
        self.clients.matchAll().then(clients => {
          clients.forEach(c => c.postMessage({ type: 'VERSION_INFO', data }));
        });
      })
      .catch(() => {});
  }
});

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