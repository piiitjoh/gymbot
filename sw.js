// Bump VERSION when you change app files, so phones pick up the update.
const VERSION = 'v15';
const SHELL = 'shell-' + VERSION;
const IMG = 'media-v2';
const SHELL_FILES = ["./", "index.html", "app.js", "styles.css", "exercises.json", "bodymap.json", "images.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const OWN_IMAGES = ["anim/ek-0004.webp", "anim/ek-0017.webp", "anim/ek-0018.webp", "anim/ek-0025.webp", "anim/ek-0026.webp", "anim/ek-0029.webp", "anim/ek-0032.webp", "anim/ek-0038.webp", "anim/ek-0043.webp", "anim/ek-0048.webp", "anim/ek-0051.webp", "anim/ek-0054.webp", "anim/ek-0055.webp", "anim/ek-0056.webp", "anim/ek-0061.webp", "anim/ek-0062.webp", "anim/ek-0066.webp", "anim/ek-0077.webp", "anim/ek-0081.webp", "anim/ek-0087.webp", "anim/ek-0093.webp", "anim/ek-0099.webp", "anim/ek-0103.webp", "anim/ek-0107.webp", "anim/ek-0115.webp", "anim/ek-0118.webp", "anim/ek-0123.webp", "anim/ek-0127.webp", "anim/ek-0142.webp", "anim/ek-0171.webp", "anim/ek-0172.webp", "anim/ek-0183.webp", "anim/ek-0192.webp", "anim/ek-0198.webp", "anim/ek-0201.webp", "anim/ek-0212.webp", "anim/ek-0220.webp", "anim/ek-0224.webp", "anim/ek-0227.webp", "anim/ek-0236.webp", "anim/ek-0249.webp", "anim/ek-0273.webp", "anim/ek-0281.webp", "anim/ek-0282.webp", "anim/ek-0286.webp", "anim/ek-0288.webp", "anim/ek-0292.webp", "thumb/ek-0004.webp", "thumb/ek-0017.webp", "thumb/ek-0018.webp", "thumb/ek-0025.webp", "thumb/ek-0026.webp", "thumb/ek-0029.webp", "thumb/ek-0032.webp", "thumb/ek-0038.webp", "thumb/ek-0043.webp", "thumb/ek-0048.webp", "thumb/ek-0051.webp", "thumb/ek-0054.webp", "thumb/ek-0055.webp", "thumb/ek-0056.webp", "thumb/ek-0061.webp", "thumb/ek-0062.webp", "thumb/ek-0066.webp", "thumb/ek-0077.webp", "thumb/ek-0081.webp", "thumb/ek-0087.webp", "thumb/ek-0093.webp", "thumb/ek-0099.webp", "thumb/ek-0103.webp", "thumb/ek-0107.webp", "thumb/ek-0115.webp", "thumb/ek-0118.webp", "thumb/ek-0123.webp", "thumb/ek-0127.webp", "thumb/ek-0142.webp", "thumb/ek-0171.webp", "thumb/ek-0172.webp", "thumb/ek-0183.webp", "thumb/ek-0192.webp", "thumb/ek-0198.webp", "thumb/ek-0201.webp", "thumb/ek-0212.webp", "thumb/ek-0220.webp", "thumb/ek-0224.webp", "thumb/ek-0227.webp", "thumb/ek-0236.webp", "thumb/ek-0249.webp", "thumb/ek-0273.webp", "thumb/ek-0281.webp", "thumb/ek-0282.webp", "thumb/ek-0286.webp", "thumb/ek-0288.webp", "thumb/ek-0292.webp"];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(SHELL)).addAll(SHELL_FILES);
    const c = await caches.open(IMG);
    await Promise.all(OWN_IMAGES.map(p => c.match(p).then(m => m || c.add(p)).catch(() => {})));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if ((k.startsWith('shell-') && k !== SHELL) || k === 'img-v1' || k === 'media-v1') await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/anim/') || url.pathname.includes('/thumb/')) {
    e.respondWith((async () => {
      const c = await caches.open(IMG);
      const hit = await c.match(e.request);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    })());
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(SHELL);
    const hit = await c.match(e.request, { ignoreSearch: true }) || (e.request.mode === 'navigate' && await c.match('index.html'));
    return hit || fetch(e.request);
  })());
});
