// TRAB build cache. User configs live in IndexedDB /idbfs, never in this cache.
const buildVersion = "1133abf1afa54dd1baea2525046596d2";
const buildFiles = ["Build/c62a236daf0fe0e53ba87c40db3e4605.loader.js?trab-build=1133abf1afa54dd1baea2525046596d2","Build/6ff1483c8fd017e301e4d2d96d3b3078.data.gz?trab-build=1133abf1afa54dd1baea2525046596d2","Build/70db33c2076505e65a5e80a23337b5f5.framework.js.gz?trab-build=1133abf1afa54dd1baea2525046596d2","Build/fcef445770df88004c5ae9bb7a4782d8.wasm.gz?trab-build=1133abf1afa54dd1baea2525046596d2","TemplateData/favicon.ico","TemplateData/style.css","manifest.webmanifest","TemplateData/progress-bar-empty-dark.png","TemplateData/progress-bar-empty-light.png","TemplateData/progress-bar-full-dark.png","TemplateData/progress-bar-full-light.png","TemplateData/unity-logo-dark.png","TemplateData/unity-logo-light.png","TemplateData/webmemd-icon.png","TemplateData/icons/unity-logo-dark.png","TemplateData/icons/unity-logo-light.png"];
const cachePrefix = '3DTRAB-build-v10:' + self.registration.scope + ':';
const cacheName = cachePrefix + buildVersion;
const indexUrl = new URL('index.html', self.registration.scope).href;
const buildUrls = new Set(buildFiles.map(function(path) { return new URL(path, self.registration.scope).href; }));

self.addEventListener('install', function(event) {
  event.waitUntil((async function() {
    const cache = await caches.open(cacheName);
    const index = await fetch(new Request(indexUrl, {cache: 'reload'}));
    if (!index.ok || !(await index.clone().text()).includes('TRAB-BUILD:' + buildVersion))
      throw new Error('Build upload is incomplete. Upload index.html last and reload once the upload is complete.');
    // Download the complete version before activating it. An old build's cache is never matched.
    await cache.addAll(buildFiles.map(function(path) {
      return new Request(new URL(path, self.registration.scope).href, {cache: 'reload'});
    }));
    await cache.put(indexUrl, index);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async function() {
    // Only this application's versioned BUILD caches. No IndexedDB/localStorage operations.
    const keys = await caches.keys();
    await Promise.all(keys.filter(function(key) {
      return key.startsWith(cachePrefix) && key !== cacheName;
    }).map(function(key) { return caches.delete(key); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function(event) {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async function() {
      try {
        // An online reload must discover the latest index even with old HTTP cache headers.
        const response = await fetch(new Request(request, {cache: 'no-cache'}));
        if (response.ok) return response;
        const installed = await (await caches.open(cacheName)).match(indexUrl);
        return installed || response;
      } catch (error) {
        const installed = await (await caches.open(cacheName)).match(indexUrl);
        if (installed) return installed;
        throw error;
      }
    })());
  } else if (buildUrls.has(request.url)) {
    event.respondWith((async function() {
      const cache = await caches.open(cacheName);
      return (await cache.match(request)) || fetch(new Request(request, {cache: 'reload'}));
    })());
  }
  // Everything else (models, APIs, downloads) uses the browser's normal network handling.
});
