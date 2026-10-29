/**
 * Service Worker untuk KertasStruk (PWA Offline Cache)
 * Hanya menyimpan berkas statis (HTML, CSS, JS, Icon).
 * TIDAK PERNAH menyimpan data transaksi atau data pengguna.
 */

const CACHE_NAME = 'kertasstruk-static-v3';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './main.js',
    './app/',
    './app/index.html',
    './app/app.css',
    './app/app.js',
    './app/storage.js',
    './app/catalog.js',
    './app/receipt.js',
    './app/export.js',
    './app/whatsapp.js',
    './app/report.js',
    './app/backup.js',
    './app/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Hanya tangani request GET untuk berkas statis lokal
    if (event.request.method !== 'GET') return;

    // Abaikan request ekstensi atau skema selain http/https
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                // Berikan dari cache, sambil perbarui di background jika online (stale-while-revalidate)
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse);
                        });
                    }
                }).catch(() => {
                    // Abaikan galat jaringan saat offline
                });
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Fallback jika offline dan request berupa navigasi halaman
                if (event.request.mode === 'navigate') {
                    return caches.match('./app/index.html');
                }
            });
        })
    );
});
