'use strict';

const NOMBRE_CACHE = 'inspeccion-pwa-v1';

const RECURSOS_PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalación: precache del App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(NOMBRE_CACHE)
      .then((cache) => cache.addAll(RECURSOS_PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activación: limpieza de cachés antiguas y toma de control inmediata
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((nombre) => nombre !== NOMBRE_CACHE)
          .map((nombre) => caches.delete(nombre))
      ))
      .then(() => self.clients.claim())
  );
});

// Estrategia Cache First: primero la caché, si no existe se va a la red
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((respuestaCache) => {
        if (respuestaCache) {
          return respuestaCache;
        }

        return fetch(event.request)
          .then((respuestaRed) => {
            if (respuestaRed && respuestaRed.ok && event.request.url.startsWith(self.location.origin)) {
              const copia = respuestaRed.clone();
              caches.open(NOMBRE_CACHE).then((cache) => cache.put(event.request, copia));
            }
            return respuestaRed;
          });
      })
      .catch(() => {
        // Sin red ni caché: para navegaciones devolvemos el App Shell
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return Response.error();
      })
  );
});
