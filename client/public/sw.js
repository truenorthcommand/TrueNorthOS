const CACHE_NAME = 'truenorth-fieldview-v8';
const API_CACHE_NAME = 'truenorth-api-cache-v2';
const OFFLINE_QUEUE_NAME = 'truenorth-offline-queue';

const STATIC_ASSETS = [
  '/manifest.json',
  '/logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

const CACHEABLE_API_ROUTES = [
  '/api/jobs',
  '/api/user',
  '/api/clients',
  '/api/fleet/vehicles',
  '/api/conversations'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'GET') {
      if (isCacheableApiRoute(url.pathname)) {
        event.respondWith(networkFirstWithApiCache(request));
      } else {
        event.respondWith(networkOnly(request));
      }
    } else {
      event.respondWith(handleMutatingRequest(request));
    }
    return;
  }

  if (request.method !== 'GET') return;

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(processOfflineQueue());
  }
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'PROCESS_OFFLINE_QUEUE') {
    processOfflineQueue().then(() => {
      event.ports[0].postMessage({ success: true });
    }).catch((error) => {
      event.ports[0].postMessage({ success: false, error: error.message });
    });
  }
  
  if (event.data.type === 'GET_OFFLINE_QUEUE_COUNT') {
    getOfflineQueueCount().then((count) => {
      event.ports[0].postMessage({ count });
    });
  }
  
  if (event.data.type === 'CLEAR_ALL_CACHES') {
    clearAllCaches().then(() => {
      event.ports[0].postMessage({ success: true });
    }).catch((error) => {
      event.ports[0].postMessage({ success: false, error: error.message });
    });
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  return true;
}

function isCacheableApiRoute(pathname) {
  return CACHEABLE_API_ROUTES.some(route => pathname.startsWith(route));
}

function isStaticAsset(pathname) {
  return STATIC_ASSETS.includes(pathname) ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    if (request.mode === 'navigate') {
      const cachedIndex = await caches.match('/');
      if (cachedIndex) return cachedIndex;
    }
    
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirstWithApiCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      const offlineResponse = cached.clone();
      const headers = new Headers(offlineResponse.headers);
      headers.set('X-Offline-Cache', 'true');
      return new Response(offlineResponse.body, {
        status: offlineResponse.status,
        statusText: offlineResponse.statusText,
        headers
      });
    }
    return new Response(JSON.stringify({ error: 'Offline - No cached data available' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleMutatingRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch {
    const clonedRequest = request.clone();
    const body = await clonedRequest.text();
    
    await addToOfflineQueue({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: body,
      timestamp: Date.now()
    });

    if ('sync' in self.registration) {
      self.registration.sync.register('sync-offline-queue');
    }

    return new Response(JSON.stringify({ 
      queued: true, 
      message: 'Action queued for when you are back online' 
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TrueNorthOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offlineQueue')) {
        db.createObjectStore('offlineQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

async function addToOfflineQueue(action) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('offlineQueue', 'readwrite');
    const store = transaction.objectStore('offlineQueue');
    const request = store.add(action);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getOfflineQueue() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('offlineQueue', 'readonly');
    const store = transaction.objectStore('offlineQueue');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removeFromOfflineQueue(id) {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('offlineQueue', 'readwrite');
    const store = transaction.objectStore('offlineQueue');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getOfflineQueueCount() {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('offlineQueue', 'readonly');
    const store = transaction.objectStore('offlineQueue');
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function processOfflineQueue() {
  const queue = await getOfflineQueue();
  const results = { success: 0, failed: 0 };
  
  for (const action of queue) {
    try {
      const response = await fetch(action.url, {
        method: action.method,
        headers: action.headers,
        body: action.body || undefined,
        credentials: 'include'
      });
      
      if (response.ok) {
        await removeFromOfflineQueue(action.id);
        results.success++;
      } else {
        results.failed++;
      }
    } catch {
      results.failed++;
    }
  }
  
  if (results.success > 0) {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'OFFLINE_QUEUE_SYNCED',
        results
      });
    });
  }
  
  return results;
}
