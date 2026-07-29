const CACHE_NAME = 'syntra-v3';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/pages.css',
  './css/responsive.css',
  './css/shop.css',
  './js/app.js',
  './js/router.js',
  './js/state.js',
  './db/indexeddb.js',
  './db/repositories.js',
  './config/brandConfig.js',
  './config/permissions.js',
  './services/backupManager.js',
  './utils/analytics.js',
  './utils/charts.js',
  './utils/currency.js',
  './utils/export.js',
  './utils/githubBackup.js',
  './utils/hash.js',
  './utils/imageHelper.js',
  './utils/logger.js',
  './utils/payments.js',
  './utils/pdfExport.js',
  './utils/sanitizer.js',
  './utils/ticket.js',
  './utils/validators.js',
  './components/header.js',
  './components/modal.js',
  './components/notification.js',
  './components/sidebar.js',
  './components/table.js',
  './components/toast.js',
  './modules/categories/categories.js',
  './modules/customers/customers.js',
  './modules/cash/cash.js',
  './modules/cash/cashService.js',
  './modules/dashboard/dashboard.js',
  './modules/pos/pos.js',
  './modules/products/products.js',
  './modules/reports/reports.js',
  './modules/sales/sales.js',
  './modules/sales/salesTable.js',
  './modules/settings/settings.js',
  './modules/shop/shop.js',
  './modules/shop/shopCart.js',
  './modules/shop/shopCheckout.js',
  './modules/shop/shopUI.js',
  './modules/shop/shopWhatsApp.js',
  './data/seed.json',
  './icons/favicon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(err => {
        console.error('[SW] Cache install failed:', err);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }
  if (event.request.url.includes('api.github.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetched = fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
