// Минимальный service worker — нужен только для критерия "installable"
// (Add to Home Screen). Сознательно НЕ кеширует ничего: цены/доступность
// на сайте могут меняться, офлайн-кеш только создал бы риск показать
// посетителю устаревшую версию после следующего деплоя.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {}); // no-op — запрос идёт в сеть как обычно
