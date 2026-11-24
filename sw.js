// Bump VERSION when you change app files, so phones pick up the update.
const VERSION = 'v12';
const SHELL = 'shell-' + VERSION;
const IMG = 'media-v1';
const SHELL_FILES = ["./", "index.html", "app.js", "styles.css", "exercises.json", "bodymap.json", "images.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const OWN_IMAGES = ["anim/0019.webp", "anim/0027.webp", "anim/0031.webp", "anim/0032.webp", "anim/0033.webp", "anim/0047.webp", "anim/0060.webp", "anim/0085.webp", "anim/0109.webp", "anim/0116.webp", "anim/0154.webp", "anim/0175.webp", "anim/0178.webp", "anim/0188.webp", "anim/0189.webp", "anim/0194.webp", "anim/0201.webp", "anim/0245.webp", "anim/0251.webp", "anim/0277.webp", "anim/0289.webp", "anim/0292.webp", "anim/0293.webp", "anim/0294.webp", "anim/0297.webp", "anim/0308.webp", "anim/0313.webp", "anim/0314.webp", "anim/0319.webp", "anim/0327.webp", "anim/0334.webp", "anim/0336.webp", "anim/0361.webp", "anim/0372.webp", "anim/0383.webp", "anim/0417.webp", "anim/0426.webp", "anim/0432.webp", "anim/0472.webp", "anim/0489.webp", "anim/0507.webp", "anim/0534.webp", "anim/0573.webp", "anim/0576.webp", "anim/0579.webp", "anim/0584.webp", "anim/0585.webp", "anim/0596.webp", "anim/0603.webp", "anim/0605.webp", "anim/0652.webp", "anim/0662.webp", "anim/0739.webp", "anim/0743.webp", "anim/0757.webp", "anim/0768.webp", "anim/0773.webp", "anim/0809.webp", "anim/0814.webp", "anim/0857.webp", "anim/0861.webp", "anim/0868.webp", "anim/1010.webp", "anim/1299.webp", "anim/1326.webp", "anim/1349.webp", "anim/1350.webp", "anim/1372.webp", "anim/1391.webp", "anim/1409.webp", "anim/1451.webp", "anim/1452.webp", "anim/1459.webp", "anim/1615.webp", "anim/1731.webp", "anim/2133.webp", "anim/2188.webp", "anim/2292.webp", "anim/2330.webp", "anim/2963.webp", "anim/3533.webp", "anim/3697.webp", "anim/pulse-0002.webp", "thumb/0019.webp", "thumb/0027.webp", "thumb/0031.webp", "thumb/0032.webp", "thumb/0033.webp", "thumb/0047.webp", "thumb/0060.webp", "thumb/0085.webp", "thumb/0109.webp", "thumb/0116.webp", "thumb/0154.webp", "thumb/0175.webp", "thumb/0178.webp", "thumb/0188.webp", "thumb/0189.webp", "thumb/0194.webp", "thumb/0201.webp", "thumb/0245.webp", "thumb/0251.webp", "thumb/0277.webp", "thumb/0289.webp", "thumb/0292.webp", "thumb/0293.webp", "thumb/0294.webp", "thumb/0297.webp", "thumb/0308.webp", "thumb/0313.webp", "thumb/0314.webp", "thumb/0319.webp", "thumb/0327.webp", "thumb/0334.webp", "thumb/0336.webp", "thumb/0361.webp", "thumb/0372.webp", "thumb/0383.webp", "thumb/0417.webp", "thumb/0426.webp", "thumb/0432.webp", "thumb/0472.webp", "thumb/0489.webp", "thumb/0507.webp", "thumb/0534.webp", "thumb/0573.webp", "thumb/0576.webp", "thumb/0579.webp", "thumb/0584.webp", "thumb/0585.webp", "thumb/0596.webp", "thumb/0603.webp", "thumb/0605.webp", "thumb/0652.webp", "thumb/0662.webp", "thumb/0739.webp", "thumb/0743.webp", "thumb/0757.webp", "thumb/0768.webp", "thumb/0773.webp", "thumb/0809.webp", "thumb/0814.webp", "thumb/0857.webp", "thumb/0861.webp", "thumb/0868.webp", "thumb/1010.webp", "thumb/1299.webp", "thumb/1326.webp", "thumb/1349.webp", "thumb/1350.webp", "thumb/1372.webp", "thumb/1391.webp", "thumb/1409.webp", "thumb/1451.webp", "thumb/1452.webp", "thumb/1459.webp", "thumb/1615.webp", "thumb/1731.webp", "thumb/2133.webp", "thumb/2188.webp", "thumb/2292.webp", "thumb/2330.webp", "thumb/2963.webp", "thumb/3533.webp", "thumb/3697.webp", "thumb/pulse-0002.webp"];

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
    for (const k of await caches.keys()) if ((k.startsWith('shell-') && k !== SHELL) || k === 'img-v1') await caches.delete(k);
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
