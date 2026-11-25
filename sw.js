// Bump VERSION when you change app files, so phones pick up the update.
const VERSION = 'v22';
const SHELL = 'shell-' + VERSION;
const IMG = 'media-v3';
const SHELL_FILES = ["./", "index.html", "app.js", "styles.css", "exercises.json", "bodymap.json", "images.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const OWN_IMAGES = ["anim/wg-ab-wheel.webp", "anim/wg-assisted-dip.webp", "anim/wg-back-extension.webp", "anim/wg-barbell-row.webp", "anim/wg-bicep-curl.webp", "anim/wg-bodyweight-squat.webp", "anim/wg-bulgarian-split-squat.webp", "anim/wg-cable-crunch.webp", "anim/wg-cable-curl.webp", "anim/wg-cable-fly.webp", "anim/wg-cable-lateral-raise.webp", "anim/wg-cable-rear-delt-fly.webp", "anim/wg-calf-raise.webp", "anim/wg-captains-chair-knee-raise.webp", "anim/wg-chest-dip.webp", "anim/wg-chest-supported-row.webp", "anim/wg-chin-up.webp", "anim/wg-close-grip-lat-pulldown.webp", "anim/wg-concentration-curl.webp", "anim/wg-deadlift.webp", "anim/wg-decline-bench-press.webp", "anim/wg-decline-sit-up.webp", "anim/wg-dip.webp", "anim/wg-dumbbell-bench-press.webp", "anim/wg-dumbbell-bent-over-row.webp", "anim/wg-dumbbell-fly.webp", "anim/wg-dumbbell-romanian-deadlift.webp", "anim/wg-ez-bar-curl.webp", "anim/wg-face-pull.webp", "anim/wg-farmer-carry.webp", "anim/wg-goblet-squat.webp", "anim/wg-hack-squat.webp", "anim/wg-hammer-curl.webp", "anim/wg-hanging-knee-raise.webp", "anim/wg-hip-thrust.webp", "anim/wg-incline-bench-press.webp", "anim/wg-incline-cable-fly.webp", "anim/wg-incline-dumbbell-press.webp", "anim/wg-lat-pulldown.webp", "anim/wg-lateral-raise.webp", "anim/wg-leg-extension.webp", "anim/wg-leg-press.webp", "anim/wg-leg-press-calf-raise.webp", "anim/wg-machine-chest-press.webp", "anim/wg-machine-lateral-raise.webp", "anim/wg-machine-row.webp", "anim/wg-machine-shoulder-press.webp", "anim/wg-one-arm-dumbbell-row.webp", "anim/wg-overhead-press.webp", "anim/wg-overhead-tricep-extension.webp", "anim/wg-pec-deck.webp", "anim/wg-preacher-curl.webp", "anim/wg-pull-up.webp", "anim/wg-push-up.webp", "anim/wg-rear-delt-fly.webp", "anim/wg-romanian-deadlift.webp", "anim/wg-seated-row.webp", "anim/wg-single-arm-cable-row.webp", "anim/wg-single-arm-dumbbell-tricep-extension.webp", "anim/wg-skull-crusher.webp", "anim/wg-smith-machine-bulgarian-split-squat.webp", "anim/wg-standing-calf-raise.webp", "anim/wg-standing-dumbbell-press.webp", "anim/wg-t-bar-row.webp", "anim/wg-tricep-pushdown.webp", "anim/wg-v-up.webp", "anim/wg-walking-lunge.webp", "thumb/wg-ab-wheel.webp", "thumb/wg-assisted-dip.webp", "thumb/wg-back-extension.webp", "thumb/wg-barbell-row.webp", "thumb/wg-bicep-curl.webp", "thumb/wg-bodyweight-squat.webp", "thumb/wg-bulgarian-split-squat.webp", "thumb/wg-cable-crunch.webp", "thumb/wg-cable-curl.webp", "thumb/wg-cable-fly.webp", "thumb/wg-cable-lateral-raise.webp", "thumb/wg-cable-rear-delt-fly.webp", "thumb/wg-calf-raise.webp", "thumb/wg-captains-chair-knee-raise.webp", "thumb/wg-chest-dip.webp", "thumb/wg-chest-supported-row.webp", "thumb/wg-chin-up.webp", "thumb/wg-close-grip-lat-pulldown.webp", "thumb/wg-concentration-curl.webp", "thumb/wg-deadlift.webp", "thumb/wg-decline-bench-press.webp", "thumb/wg-decline-sit-up.webp", "thumb/wg-dip.webp", "thumb/wg-dumbbell-bench-press.webp", "thumb/wg-dumbbell-bent-over-row.webp", "thumb/wg-dumbbell-fly.webp", "thumb/wg-dumbbell-romanian-deadlift.webp", "thumb/wg-ez-bar-curl.webp", "thumb/wg-face-pull.webp", "thumb/wg-farmer-carry.webp", "thumb/wg-goblet-squat.webp", "thumb/wg-hack-squat.webp", "thumb/wg-hammer-curl.webp", "thumb/wg-hanging-knee-raise.webp", "thumb/wg-hip-thrust.webp", "thumb/wg-incline-bench-press.webp", "thumb/wg-incline-cable-fly.webp", "thumb/wg-incline-dumbbell-press.webp", "thumb/wg-lat-pulldown.webp", "thumb/wg-lateral-raise.webp", "thumb/wg-leg-extension.webp", "thumb/wg-leg-press.webp", "thumb/wg-leg-press-calf-raise.webp", "thumb/wg-machine-chest-press.webp", "thumb/wg-machine-lateral-raise.webp", "thumb/wg-machine-row.webp", "thumb/wg-machine-shoulder-press.webp", "thumb/wg-one-arm-dumbbell-row.webp", "thumb/wg-overhead-press.webp", "thumb/wg-overhead-tricep-extension.webp", "thumb/wg-pec-deck.webp", "thumb/wg-preacher-curl.webp", "thumb/wg-pull-up.webp", "thumb/wg-push-up.webp", "thumb/wg-rear-delt-fly.webp", "thumb/wg-romanian-deadlift.webp", "thumb/wg-seated-row.webp", "thumb/wg-single-arm-cable-row.webp", "thumb/wg-single-arm-dumbbell-tricep-extension.webp", "thumb/wg-skull-crusher.webp", "thumb/wg-smith-machine-bulgarian-split-squat.webp", "thumb/wg-standing-calf-raise.webp", "thumb/wg-standing-dumbbell-press.webp", "thumb/wg-t-bar-row.webp", "thumb/wg-tricep-pushdown.webp", "thumb/wg-v-up.webp", "thumb/wg-walking-lunge.webp"];

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
    for (const k of await caches.keys()) if ((k.startsWith('shell-') && k !== SHELL) || k === 'img-v1' || k === 'media-v1' || k === 'media-v2') await caches.delete(k);
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
