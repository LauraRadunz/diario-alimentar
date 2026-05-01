/* ── Service Worker — Diário Alimentar ── */
const CACHE = 'diario-v1';
const STATIC = [
    '/',
    '/static/style.css',
    '/static/app.js',
    '/static/auth.css',
    '/static/admin.css',
    '/static/manifest.json',
    '/static/icons/icon-192.png',
    '/static/icons/icon-512.png',
    'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);

    // Requisições de API sempre vão para a rede (nunca cache)
    if (url.pathname.startsWith('/api/')) {
        e.respondWith(fetch(e.request));
        return;
    }

    // Estratégia: Network first, fallback para cache
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res && res.status === 200 && e.request.method === 'GET') {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});