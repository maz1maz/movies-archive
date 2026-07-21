const APP_CACHE = 'film-archive-app-v2'
const POSTER_CACHE = 'film-archive-posters-v1'
const APP_FILES = ['/', '/index.html', '/manifest.webmanifest']
const MAX_POSTERS = 200

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_FILES)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== APP_CACHE && key !== POSTER_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

async function trimPosterCache(cache) {
  const keys = await cache.keys()
  if (keys.length <= MAX_POSTERS) return
  // Remove oldest entries first (Cache Storage preserves insertion order).
  await Promise.all(keys.slice(0, keys.length - MAX_POSTERS).map((key) => cache.delete(key)))
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  // Poster URLs are cached separately and served cache-first for offline use.
  if (request.method === 'GET' && request.destination === 'image' && url.protocol.startsWith('http')) {
    event.respondWith(
      caches.open(POSTER_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        try {
          const response = await fetch(request)
          if (response.ok || response.type === 'opaque') {
            await cache.put(request, response.clone())
            await trimPosterCache(cache)
          }
          return response
        } catch {
          return new Response('', { status: 503, statusText: 'Offline' })
        }
      })
    )
    return
  }

  // Cache the app shell; API data remains network-first so edits/imports stay fresh.
  if (request.method === 'GET' && url.origin === self.location.origin && !url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(APP_CACHE).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request))
    )
  }
})
