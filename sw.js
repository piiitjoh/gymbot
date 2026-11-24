// Bump VERSION when you change app files, so phones pick up the update.
const VERSION = 'v2';
const SHELL = 'shell-' + VERSION;
const IMG = 'img-v1';
const SHELL_FILES = ["./", "index.html", "app.js", "styles.css", "exercises.json", "images.json", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const OWN_IMAGES = ["img/Ab_Crunch_Machine/0.webp", "img/Ab_Crunch_Machine/1.webp", "img/Ab_Roller/0.webp", "img/Ab_Roller/1.webp", "img/Barbell_Curl/0.webp", "img/Barbell_Curl/1.webp", "img/Barbell_Deadlift/0.webp", "img/Barbell_Deadlift/1.webp", "img/Barbell_Hip_Thrust/0.webp", "img/Barbell_Hip_Thrust/1.webp", "img/Barbell_Incline_Bench_Press_-_Medium_Grip/0.webp", "img/Barbell_Incline_Bench_Press_-_Medium_Grip/1.webp", "img/Barbell_Shoulder_Press/0.webp", "img/Barbell_Shoulder_Press/1.webp", "img/Bent_Over_Barbell_Row/0.webp", "img/Bent_Over_Barbell_Row/1.webp", "img/Bent_Over_Two-Dumbbell_Row/0.webp", "img/Bent_Over_Two-Dumbbell_Row/1.webp", "img/Bodyweight_Squat/0.webp", "img/Bodyweight_Squat/1.webp", "img/Butterfly/0.webp", "img/Butterfly/1.webp", "img/Cable_Crunch/0.webp", "img/Cable_Crunch/1.webp", "img/Cable_Rear_Delt_Fly/0.webp", "img/Cable_Rear_Delt_Fly/1.webp", "img/Cable_Rope_Overhead_Triceps_Extension/0.webp", "img/Cable_Rope_Overhead_Triceps_Extension/1.webp", "img/Cable_Seated_Lateral_Raise/0.webp", "img/Cable_Seated_Lateral_Raise/1.webp", "img/Calf_Press_On_The_Leg_Press_Machine/0.webp", "img/Calf_Press_On_The_Leg_Press_Machine/1.webp", "img/Chin-Up/0.webp", "img/Chin-Up/1.webp", "img/Close-Grip_Dumbbell_Press/0.webp", "img/Close-Grip_Dumbbell_Press/1.webp", "img/Concentration_Curls/0.webp", "img/Concentration_Curls/1.webp", "img/Decline_Barbell_Bench_Press/0.webp", "img/Decline_Barbell_Bench_Press/1.webp", "img/Decline_Crunch/0.webp", "img/Decline_Crunch/1.webp", "img/Dip_Machine/0.webp", "img/Dip_Machine/1.webp", "img/Dips_-_Chest_Version/0.webp", "img/Dips_-_Chest_Version/1.webp", "img/Dips_-_Triceps_Version/0.webp", "img/Dips_-_Triceps_Version/1.webp", "img/Dumbbell_Bench_Press/0.webp", "img/Dumbbell_Bench_Press/1.webp", "img/Dumbbell_Bicep_Curl/0.webp", "img/Dumbbell_Bicep_Curl/1.webp", "img/Dumbbell_Flyes/0.webp", "img/Dumbbell_Flyes/1.webp", "img/Dumbbell_Incline_Row/0.webp", "img/Dumbbell_Incline_Row/1.webp", "img/Dumbbell_Lunges/0.webp", "img/Dumbbell_Lunges/1.webp", "img/Dumbbell_One-Arm_Shoulder_Press/0.webp", "img/Dumbbell_One-Arm_Shoulder_Press/1.webp", "img/Dumbbell_Shoulder_Press/0.webp", "img/Dumbbell_Shoulder_Press/1.webp", "img/EZ-Bar_Skullcrusher/0.webp", "img/EZ-Bar_Skullcrusher/1.webp", "img/Face_Pull/0.webp", "img/Face_Pull/1.webp", "img/Farmers_Walk/0.webp", "img/Farmers_Walk/1.webp", "img/Flat_Bench_Cable_Flyes/0.webp", "img/Flat_Bench_Cable_Flyes/1.webp", "img/Goblet_Squat/0.webp", "img/Goblet_Squat/1.webp", "img/Hack_Squat/0.webp", "img/Hack_Squat/1.webp", "img/Hammer_Curls/0.webp", "img/Hammer_Curls/1.webp", "img/Hanging_Leg_Raise/0.webp", "img/Hanging_Leg_Raise/1.webp", "img/Hyperextensions_Back_Extensions/0.webp", "img/Hyperextensions_Back_Extensions/1.webp", "img/Incline_Dumbbell_Flyes/0.webp", "img/Incline_Dumbbell_Flyes/1.webp", "img/Incline_Dumbbell_Press/0.webp", "img/Incline_Dumbbell_Press/1.webp", "img/Jackknife_Sit-Up/0.webp", "img/Jackknife_Sit-Up/1.webp", "img/Knee_Hip_Raise_On_Parallel_Bars/0.webp", "img/Knee_Hip_Raise_On_Parallel_Bars/1.webp", "img/Leg_Extensions/0.webp", "img/Leg_Extensions/1.webp", "img/Leg_Press/0.webp", "img/Leg_Press/1.webp", "img/Leverage_Chest_Press/0.webp", "img/Leverage_Chest_Press/1.webp", "img/Leverage_Incline_Chest_Press/0.webp", "img/Leverage_Incline_Chest_Press/1.webp", "img/Leverage_Iso_Row/0.webp", "img/Leverage_Iso_Row/1.webp", "img/Leverage_Shoulder_Press/0.webp", "img/Leverage_Shoulder_Press/1.webp", "img/Machine_Bench_Press/0.webp", "img/Machine_Bench_Press/1.webp", "img/Machine_Preacher_Curls/0.webp", "img/Machine_Preacher_Curls/1.webp", "img/One-Arm_Dumbbell_Row/0.webp", "img/One-Arm_Dumbbell_Row/1.webp", "img/One_Arm_Dumbbell_Preacher_Curl/0.webp", "img/One_Arm_Dumbbell_Preacher_Curl/1.webp", "img/Pullups/0.webp", "img/Pullups/1.webp", "img/Pushups/0.webp", "img/Pushups/1.webp", "img/Reverse_Flyes/0.webp", "img/Reverse_Flyes/1.webp", "img/Romanian_Deadlift/0.webp", "img/Romanian_Deadlift/1.webp", "img/Seated_Cable_Rows/0.webp", "img/Seated_Cable_Rows/1.webp", "img/Seated_One-arm_Cable_Pulley_Rows/0.webp", "img/Seated_One-arm_Cable_Pulley_Rows/1.webp", "img/Side_Lateral_Raise/0.webp", "img/Side_Lateral_Raise/1.webp", "img/Smith_Machine_Calf_Raise/0.webp", "img/Smith_Machine_Calf_Raise/1.webp", "img/Smith_Machine_Incline_Bench_Press/0.webp", "img/Smith_Machine_Incline_Bench_Press/1.webp", "img/Smith_Single-Leg_Split_Squat/0.webp", "img/Smith_Single-Leg_Split_Squat/1.webp", "img/Split_Squat_with_Dumbbells/0.webp", "img/Split_Squat_with_Dumbbells/1.webp", "img/Standing_Barbell_Calf_Raise/0.webp", "img/Standing_Barbell_Calf_Raise/1.webp", "img/Standing_Biceps_Cable_Curl/0.webp", "img/Standing_Biceps_Cable_Curl/1.webp", "img/Standing_Calf_Raises/0.webp", "img/Standing_Calf_Raises/1.webp", "img/Standing_Dumbbell_Calf_Raise/0.webp", "img/Standing_Dumbbell_Calf_Raise/1.webp", "img/Standing_Dumbbell_Triceps_Extension/0.webp", "img/Standing_Dumbbell_Triceps_Extension/1.webp", "img/Standing_One-Arm_Cable_Curl/0.webp", "img/Standing_One-Arm_Cable_Curl/1.webp", "img/Standing_Overhead_Barbell_Triceps_Extension/0.webp", "img/Standing_Overhead_Barbell_Triceps_Extension/1.webp", "img/Stiff-Legged_Barbell_Deadlift/0.webp", "img/Stiff-Legged_Barbell_Deadlift/1.webp", "img/Stiff-Legged_Dumbbell_Deadlift/0.webp", "img/Stiff-Legged_Dumbbell_Deadlift/1.webp", "img/T-Bar_Row_with_Handle/0.webp", "img/T-Bar_Row_with_Handle/1.webp", "img/Triceps_Pushdown/0.webp", "img/Triceps_Pushdown/1.webp", "img/Underhand_Cable_Pulldowns/0.webp", "img/Underhand_Cable_Pulldowns/1.webp", "img/Wide-Grip_Lat_Pulldown/0.webp", "img/Wide-Grip_Lat_Pulldown/1.webp"];

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
    for (const k of await caches.keys()) if (k.startsWith('shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/img/')) {
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
