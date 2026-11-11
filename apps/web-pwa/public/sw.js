const CACHE_NAME = 'krona-vault-pwa-v11';

const STATIC_PORTALS = [
  '/',
  '/login',
  '/wallet',
  '/pos',
  '/tournaments',
  '/trade-in',
  '/custody',
  '/stores',
  '/users',
  '/profile',
  '/audit',
];

const STATIC_ASSETS = [
  ...STATIC_PORTALS,
  '/styles/brand.css',
  '/js/krona-core.js',
  '/js/qrcode.min.js',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.ico',
  '/favicon-96x96.png',
  '/apple-touch-icon.png',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
];

const OFFLINE_FALLBACK_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KRONA VAULT™ — Modo Sin Conexión</title>
  <style>
    body {
      background: #07090E;
      color: #F8FAFC;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1.5rem;
      box-sizing: border-box;
      text-align: center;
    }
    .offline-box {
      background: #131A29;
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: 12px;
      padding: 2rem;
      max-width: 480px;
      box-shadow: 0 12px 36px rgba(0,0,0,0.6);
    }
    h1 { color: #F59E0B; font-size: 1.35rem; margin-top: 0; }
    p { color: #CBD5E1; font-size: 0.95rem; line-height: 1.5; }
    .btn {
      display: inline-block;
      margin-top: 1.25rem;
      padding: 0.75rem 1.4rem;
      background: #F59E0B;
      color: #07090E;
      font-weight: 700;
      text-decoration: none;
      border-radius: 8px;
      cursor: pointer;
      border: none;
    }
  </style>
</head>
<body>
  <div class="offline-box">
    <h1>🛡️ KRONA VAULT™ — Sin Conexión</h1>
    <p>Esta pantalla aún no ha sido descargada en tu dispositivo o la red local no está disponible.</p>
    <p>Tu <strong>Bóveda KRONA Pass™</strong> y la información precargada siguen seguras en tu navegador.</p>
    <button class="btn" onclick="window.location.reload()">Reintentar Conexión</button>
  </div>
</body>
</html>`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Solo interceptar peticiones idempotentes GET
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Las transacciones contables /api/* NUNCA se cachean bajo ninguna circunstancia
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  const isNavigation = event.request.mode === 'navigate';
  const isStaticAsset =
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.json');

  if (isStaticAsset) {
    // Stale-While-Revalidate para activos estáticos: respuesta instantánea + actualización en segundo plano
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Network-First para páginas HTML / navegación con fallback a caché local y rescate
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned)).catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // Fallback para navegación de ruta limpia (ej. /wallet -> buscar en caché /wallet)
        const pathFallback = await caches.match(url.pathname);
        if (pathFallback) return pathFallback;

        if (isNavigation) {
          return new Response(OFFLINE_FALLBACK_HTML, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }

        return new Response('Modo sin conexión — Servidor KRONA VAULT no accesible.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});
