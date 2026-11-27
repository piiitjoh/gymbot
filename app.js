'use strict';
/* Gymbot – offline PWA. All data lives in IndexedDB on this device. */

// ---------- utils ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const fmtKg = v => v == null ? '' : (Math.round(v * 100) / 100).toString();
const fmtNum = v => Math.round(v).toLocaleString('en-GB');
const pad = n => String(n).padStart(2, '0');
const fmtClock = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; };
const fmtDur = s => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const fmtDate = (t, o = {}) => new Date(t).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...o });
const fmtDateY = t => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const e1rm = (kg, reps) => (!kg || !reps || reps > 15) ? 0 : reps === 1 ? kg : kg * (1 + reps / 30);
const setStr = s => s.kg ? `${fmtKg(s.kg)} kg × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
const clone = o => JSON.parse(JSON.stringify(o));
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

const MUSCLE = { abdominals: 'Abs', abductors: 'Abductors', adductors: 'Adductors', biceps: 'Biceps', calves: 'Calves', chest: 'Chest', forearms: 'Forearms', glutes: 'Glutes', hamstrings: 'Hamstrings', lats: 'Lats', 'lower back': 'Lower back', 'middle back': 'Upper back', neck: 'Neck', quadriceps: 'Quads', shoulders: 'Shoulders', traps: 'Traps', triceps: 'Triceps' };
const EQUIP = { barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine', 'body only': 'Bodyweight', kettlebells: 'Kettlebell', bands: 'Band', 'e-z curl bar': 'EZ bar', 'exercise ball': 'Ball', 'medicine ball': 'Medicine ball', 'foam roll': 'Foam roller', other: 'Other' };
const GROUPS = [
  ['All', null], ['Chest', ['chest']], ['Back', ['lats', 'middle back', 'lower back', 'traps']], ['Shoulders', ['shoulders']],
  ['Biceps', ['biceps']], ['Triceps', ['triceps']], ['Legs', ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors']],
  ['Abs', ['abdominals']], ['Forearms', ['forearms']]
];
const STYPES = ['n', 'w', 'd', 'f'];
const REST_PRESETS = [0, 30, 45, 60, 75, 90, 100, 120, 150, 180, 240, 300];

// ---------- body map (polygons: body-highlighter, MIT – see LICENSE-body-highlighter.txt) ----------
let BODY = null;
const BODY_SLUGS = {
  abdominals: ['abs', 'obliques'], abductors: ['abductors'], adductors: ['adductor'], biceps: ['biceps'],
  calves: ['calves', 'left-soleus', 'right-soleus'], chest: ['chest'], forearms: ['forearm'], glutes: ['gluteal'],
  hamstrings: ['hamstring'], lats: ['upper-back'], 'lower back': ['lower-back'], 'middle back': ['upper-back'],
  neck: ['neck'], quadriceps: ['quadriceps'], shoulders: ['front-deltoids', 'back-deltoids'], traps: ['trapezius'], triceps: ['triceps'],
};
const BODY_GREY = '#4a515c', BODY_INERT = '#3a3f48';
const LEVEL_COL = ['', '#2c4a7c', '#3a68b8', '#4f8cff', '#8fb6ff'];
function bodyMapHTML(levels, legend) {
  if (!BODY) return '';
  const side = (k, label) => `<div class="bm"><svg viewBox="0 0 100 220" role="img" aria-label="${label}">${BODY[k].map(([slug, polys]) => {
    const lv = levels[slug] || 0; const fill = lv ? LEVEL_COL[lv] : (slug === 'head' || slug === 'knees' ? BODY_INERT : BODY_GREY);
    return polys.map(pt => `<polygon points="${pt}" fill="${fill}"/>`).join('');
  }).join('')}</svg></div>`;
  return `<div class="bodymap">${side('front', 'Front')}${side('back', 'Back')}</div>${legend || ''}`;
}
function levelsForExercise(x) {
  const lv = {};
  for (const m of x.sm || []) for (const sl of BODY_SLUGS[m] || []) lv[sl] = Math.max(lv[sl] || 0, 2);
  for (const m of x.pm || []) for (const sl of BODY_SLUGS[m] || []) lv[sl] = 4;
  return lv;
}
function muscleLoad(days) {
  const since = Date.now() - days * 864e5, load = {};
  for (const w of S.workouts) {
    if (w.start < since) break;
    for (const e of w.ex) {
      const n = e.sets.filter(s => s.done && s.t !== 'w').length; if (!n) continue;
      const x = exById(e.eid);
      for (const m of x.pm || []) load[m] = (load[m] || 0) + n;
      for (const m of x.sm || []) load[m] = (load[m] || 0) + n / 2;
    }
  }
  return load;
}

// ---------- IndexedDB ----------
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('treningslogg', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const s of ['workouts', 'routines', 'customEx']) d.createObjectStore(s, { keyPath: 'id' });
        d.createObjectStore('kv');
      };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode); const st = t.objectStore(store);
      const out = fn(st); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error);
    });
  },
  all(s) { return this.tx(s, 'readonly', st => st.getAll()); },
  put(s, v, k) { return this.tx(s, 'readwrite', st => k === undefined ? st.put(v) : st.put(v, k)); },
  putMany(s, arr) { return this.tx(s, 'readwrite', st => { arr.forEach(v => st.put(v)); }); },
  del(s, k) { return this.tx(s, 'readwrite', st => st.delete(k)); },
  get(s, k) { return this.tx(s, 'readonly', st => st.get(k)); },
  clear(s) { return this.tx(s, 'readwrite', st => st.clear()); },
};

// ---------- state ----------
const S = {
  lib: [], ex: new Map(), workouts: [], routines: [], custom: [],
  settings: { rest: 100, sound: true, vibrate: true, wake: false, sfx: 'bell', progress: true, range: [8, 12], step: 2.5, ranges: {} },
  active: null, tab: 'train', stack: [], sheet: null,
  rest: null, // {end,total,eid}
  pr: new Map(), // workoutId -> [{eid,type,val}]
  q: '', grp: 0, histFilter: '',
};

const exById = id => S.ex.get(id) || { id, name: 'Unknown exercise', pm: [], sm: [], eq: 'other', ins: [] };
const sortWorkouts = () => S.workouts.sort((a, b) => b.start - a.start);

const saveActive = debounce(() => DB.put('kv', S.active, 'active'), 250);
function flushActive() { if (S.active !== undefined) DB.put('kv', S.active, 'active'); }
const saveWorkout = debounce(w => DB.put('workouts', w), 300);
const saveRoutine = debounce(r => DB.put('routines', r), 300);
const saveSettings = () => DB.put('kv', S.settings, 'settings');

// ---------- stats ----------
function workingSets(w, eid) {
  const out = [];
  for (const e of w.ex) if (e.eid === eid) for (const s of e.sets) if (s.done && s.t !== 'w') out.push(s);
  return out;
}
// "Set 3", or "Drop set"/"Failure set", as numbered on the workout screen
// Does this just-finished set beat every earlier set of the exercise (history and this workout)?
// Same rules as the Records page: heavier weight, higher estimated 1RM, or more reps without weight.
function isLiveRecord(w, eid, set) {
  if (set.t === 'w') return false;
  const st = exStats(eid); if (!st.n) return false;          // first time doing it is not a record
  let kg = st.kg, rm = st.rm, reps = st.reps;
  for (const e of w.ex) if (e.eid === eid) for (const x of e.sets) if (x !== set && x.done && x.t !== 'w') {
    kg = Math.max(kg, x.kg || 0); rm = Math.max(rm, e1rm(x.kg, x.reps)); reps = Math.max(reps, x.reps || 0);
  }
  return (set.kg || 0) > kg || e1rm(set.kg, set.reps) > rm + 0.01 || (!set.kg && !kg && (set.reps || 0) > reps);
}
function floatRecord(row) {
  if (!row) return;
  const r = (row.querySelector('.chk') || row).getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'prfloat';
  el.innerHTML = '<img src="icons/icon-192.png" alt=""><span>New record</span>';
  el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = r.top + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
  setTimeout(() => el.remove(), 3000);
}
function setLabel(w, eid, set) {
  for (const e of w.ex) {
    if (e.eid !== eid) continue;
    let n = 0;
    for (const x of e.sets) { const nn = !x.t || x.t === 'n'; if (nn) n++; if (x === set) return nn ? `Set ${n}` : x.t === 'd' ? 'Drop set' : 'Failure set'; }
  }
  return '';
}
function computePRs() {
  S.pr = new Map();
  const best = new Map();
  const asc = [...S.workouts].sort((a, b) => a.start - b.start);
  for (const w of asc) {
    const evs = [];
    const seen = new Set();
    for (const e of w.ex) {
      if (seen.has(e.eid)) continue; seen.add(e.eid);
      const sets = workingSets(w, e.eid); if (!sets.length) continue;
      let kg = 0, rm = 0, reps = 0, vol = 0, sKg = null, sRm = null, sReps = null;
      for (const s of sets) {
        if ((s.kg || 0) > kg) { kg = s.kg; sKg = s; }
        const r = e1rm(s.kg, s.reps); if (r > rm) { rm = r; sRm = s; }
        if ((s.reps || 0) > reps) { reps = s.reps; sReps = s; }
        vol += (s.kg || 0) * (s.reps || 0);
      }
      const at = s => s ? { set: setLabel(w, e.eid, s), kg: s.kg || 0, reps: s.reps || 0 } : {};
      const b = best.get(e.eid);
      if (b) {
        if (kg > b.kg) evs.push({ eid: e.eid, type: 'kg', val: kg, ...at(sKg) });
        if (rm > b.rm + 0.01) evs.push({ eid: e.eid, type: 'rm', val: rm, ...at(sRm) });
        if (!kg && !b.kg && reps > b.reps) evs.push({ eid: e.eid, type: 'reps', val: reps, ...at(sReps) });
        if (vol > b.vol) evs.push({ eid: e.eid, type: 'vol', val: vol, set: `${sets.length} sets` });
        b.kg = Math.max(b.kg, kg); b.rm = Math.max(b.rm, rm); b.reps = Math.max(b.reps, reps); b.vol = Math.max(b.vol, vol);
      } else best.set(e.eid, { kg, rm, reps, vol });
    }
    if (evs.length) S.pr.set(w.id, evs);
  }
}
const PRLABEL = { kg: 'Heaviest weight', rm: 'Estimated 1RM', reps: 'Most reps', vol: 'Workout volume' };
const prVal = p => p.type === 'reps' ? `${p.val} reps` : p.type === 'vol' ? `${fmtNum(p.val)} kg` : `${fmtKg(Math.round(p.val * 10) / 10)} kg`;
// which set gave the record: "Set 3 · 100 kg × 5"
const prWhere = p => !p.set ? '' : p.type === 'vol' ? p.set : p.kg ? `${p.set} · ${fmtKg(p.kg)} kg × ${p.reps}` : `${p.set} · ${p.reps} reps`;

function exStats(eid) {
  const sessions = [];
  const st = { kg: 0, rm: 0, rmSet: null, reps: 0, vol: 0, totalReps: 0, rr: {}, n: 0 };
  for (const w of S.workouts) {
    const sets = workingSets(w, eid); if (!sets.length) continue;
    let vol = 0, rm = 0, kg = 0, reps = 0, tr = 0;
    for (const s of sets) {
      vol += (s.kg || 0) * (s.reps || 0); tr += s.reps || 0;
      const r = e1rm(s.kg, s.reps);
      if (r > rm) rm = r; if ((s.kg || 0) > kg) kg = s.kg; if ((s.reps || 0) > reps) reps = s.reps;
      if (r > st.rm) { st.rm = r; st.rmSet = { ...s, date: w.start }; }
      if (s.reps >= 1 && s.reps <= 12 && s.kg > 0) { const c = st.rr[s.reps]; if (!c || s.kg > c.kg) st.rr[s.reps] = { kg: s.kg, date: w.start }; }
    }
    st.kg = Math.max(st.kg, kg); st.reps = Math.max(st.reps, reps); st.vol = Math.max(st.vol, vol); st.totalReps = Math.max(st.totalReps, tr);
    sessions.push({ w, sets: w.ex.filter(e => e.eid === eid).flatMap(e => e.sets.filter(s => s.done)), vol, rm, kg, reps, tr });
    st.n++;
  }
  st.sessions = sessions; st.bw = st.kg === 0;
  return st;
}
function lastSets(eid, excludeId) {
  for (const w of S.workouts) {
    if (w.id === excludeId) continue;
    const e = w.ex.find(x => x.eid === eid);
    if (e) { const sets = e.sets.filter(s => s.done); if (sets.length) return { sets, rest: e.rest }; }
  }
  return null;
}
function usage() {
  const m = new Map();
  for (const w of S.workouts) for (const e of w.ex) m.set(e.eid, (m.get(e.eid) || 0) + 1);
  return m;
}

// ---------- rendering core ----------
const topView = () => S.stack[S.stack.length - 1];
function push(v) { S.stack.push(v); history.pushState({ n: S.stack.length }, ''); render(); window.scrollTo(0, 0); }
function back() { history.back(); }
window.addEventListener('popstate', () => {
  if (S.sheet) { S.sheet = null; renderSheet(); const f = S.afterClose; S.afterClose = null; if (f) f(); return; }
  if (S.stack.length) { const v = S.stack.pop(); onLeave(v); render(); }
});
function onLeave(v) { if (v && v.v === 'editor' && v.mode === 'edit') { computePRs(); } }
function openSheet(sh) { S.sheet = sh; history.pushState({ sheet: 1 }, ''); renderSheet(); }
function closeSheet(then) { if (S.sheet) { S.afterClose = then || null; history.back(); } else if (then) then(); }

function render() {
  const t = topView();
  let html;
  if (t) html = ({ exercise: viewExercise, workout: viewWorkout, editor: viewEditor, summary: viewSummary })[t.v](t);
  else html = ({ train: viewTrain, history: viewHistory, exercises: viewExercises, records: viewRecords, more: viewMore })[S.tab]();
  $('#main').innerHTML = html;
  document.querySelectorAll('#nav button').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === S.tab);
  });
  afterRender();
  tick();
}
function afterRender() {
  const l = $('#exlist'); if (l) renderExList();
}

// ---------- TRAIN tab ----------
function viewTrain() {
  if (S.active) return editorHTML(S.active, 'active');
  const rs = [...S.routines].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  const lastDone = name => { const w = S.workouts.find(x => x.name === name); return w ? fmtDate(w.start) : null; };
  return `<h1 class="brand"><img src="icons/icon-192.png" alt="">Workout</h1>
  <button class="btn pri block" data-a="startEmpty">＋ Start empty workout</button>
  <div class="row between"><h2>Routines</h2><button class="btn sm" data-a="newRoutine">＋ New routine</button></div>
  ${rs.length ? rs.map(r => `
    <div class="card tap" data-a="startRoutine" data-id="${r.id}">
      <div class="row"><h3 class="grow">${esc(r.name)}</h3><button class="icon-btn" data-a="routineMenu" data-id="${r.id}">⋯</button></div>
      <div class="small mut ellip">${r.ex.map(e => esc(exById(e.eid).name)).join(' · ') || 'No exercises'}</div>
      ${lastDone(r.name) ? `<div class="tiny mut" style="margin-top:4px">Last: ${lastDone(r.name)}</div>` : ''}
    </div>`).join('') : '<p class="mut small">No routines yet. Create one, save a workout as a routine, or import from Strong under “More”.</p>'}`;
}
function timeOfDayName(d = new Date()) {
  const h = d.getHours();
  return h < 10 ? 'Morning Workout' : h < 13 ? 'Midday Workout' : h < 18 ? 'Afternoon Workout' : 'Evening Workout';
}
// ---------- next-set suggestions (double progression) ----------
// Each exercise has a rep range (default 8-12). If every working set at last session's top weight
// reached the top of the range, suggest more weight and the bottom of the range; otherwise the same
// weight and one more rep. Bodyweight exercises: one more rep.
const RANGES = [[3, 5], [5, 8], [6, 10], [8, 12], [10, 15], [12, 20]];
const repRange = eid => (S.settings.ranges || {})[eid] || S.settings.range || [8, 12];
function weightStep(eid) {
  const eq = (exById(eid).eq || '').toLowerCase();
  return /dumbbell|kettlebell/.test(eq) ? 2 : (S.settings.step || 2.5);
}
function suggestSets(eid, sets) {
  if (!S.settings.progress) return sets;
  const last = lastSets(eid); if (!last) return sets;
  const work = last.sets.filter(s => s.t !== 'w' && (s.reps || 0) > 0); if (!work.length) return sets;
  const [lo, hi] = repRange(eid), step = weightStep(eid);
  const top = Math.max(...work.map(s => s.kg || 0));
  const bw = top === 0;
  const allTop = work.filter(s => (s.kg || 0) === top).every(s => s.reps >= hi);
  let k = 0;
  return sets.map(s => {
    if (s.t === 'w' || s.done) return s;
    const p = work[Math.min(k++, work.length - 1)];
    if (bw) return { ...s, kg: s.kg ?? null, reps: p.reps + 1, sg: 'reps' };
    if (allTop) return { ...s, kg: Math.round(((p.kg || 0) + step) * 100) / 100, reps: lo, sg: 'kg' };
    return p.reps < hi ? { ...s, kg: p.kg, reps: p.reps + 1, sg: 'reps' } : { ...s, kg: p.kg, reps: p.reps };
  });
}
const withSuggestions = e => ({ ...e, sets: suggestSets(e.eid, e.sets) });
function exFromPrev(eid, fallbackSets, rest) {
  const last = lastSets(eid);
  let sets;
  if (fallbackSets && fallbackSets.length) {
    sets = fallbackSets.map((s, i) => { const p = last && last.sets[i]; return { kg: p ? p.kg : s.kg, reps: p ? p.reps : s.reps, t: s.t || 'n', done: false }; });
  } else if (last) sets = last.sets.map(s => ({ kg: s.kg, reps: s.reps, t: s.t || 'n', done: false }));
  else sets = [0, 1, 2].map(() => ({ kg: null, reps: null, t: 'n', done: false }));
  return { eid, rest: rest ?? (last && last.rest) ?? S.settings.rest, sets };
}
function startWorkout(w) {
  S.active = w; saveActive(); S.tab = 'train'; S.stack = []; render(); requestWake(); window.scrollTo(0, 0);
}
function startRoutine(r) {
  if (S.active) { toast('You already have an active workout'); S.tab = 'train'; S.stack = []; render(); return; }
  startWorkout({ id: uid(), name: r.name, start: Date.now(), routineId: r.id, ex: r.ex.map(e => withSuggestions(exFromPrev(e.eid, e.sets, e.rest))) });
}

// ---------- EDITOR (active workout / edit history / routine) ----------
function editorObj(mode, t) {
  if (mode === 'active') return S.active;
  if (mode === 'edit') return S.workouts.find(w => w.id === t.id);
  return S.routines.find(r => r.id === t.id);
}
function curEditor() {
  const t = topView();
  if (t && t.v === 'editor') return { mode: t.mode, obj: editorObj(t.mode, t) };
  if (!t && S.tab === 'train' && S.active) return { mode: 'active', obj: S.active };
  return null;
}
function persist(mode, obj) {
  if (mode === 'active') saveActive(); else if (mode === 'edit') saveWorkout(obj); else saveRoutine(obj);
}
function viewEditor(t) { const o = editorObj(t.mode, t); return o ? editorHTML(o, t.mode) : '<p class="empty">Not found</p>'; }
function editorHTML(w, mode) {
  const routine = mode === 'routine';
  let head;
  if (mode === 'active') head = `<div class="whead">
      <div class="row"><input class="wname grow" data-f="name" value="${esc(w.name)}"><button class="btn ok" data-a="finish">Finish</button></div>
      <div class="row between small"><span class="clock" id="elapsed">0:00</span><button class="btn sm bad" data-a="discard">Cancel workout</button></div></div>`;
  else if (mode === 'edit') {
    const d = new Date(w.start); const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    head = `<div class="whead"><div class="row"><button class="icon-btn" data-a="back">‹</button><input class="wname grow" data-f="name" value="${esc(w.name)}"><button class="btn sm pri" data-a="back">Done</button></div>
      <div class="row small"><input type="datetime-local" data-f="start" value="${local}" style="flex:2"><input type="number" inputmode="numeric" data-f="durMin" value="${Math.round(((w.end || w.start) - w.start) / 60000)}" style="flex:1"><span class="mut">min</span></div></div>`;
  } else head = `<div class="whead"><div class="row"><button class="icon-btn" data-a="back">‹</button><input class="wname grow" data-f="name" value="${esc(w.name)}" placeholder="Routine name"><button class="btn sm pri" data-a="back">Done</button></div><div class="tiny mut">Routine – weights/reps are a starting point. When started, values from last time are filled in.</div></div>`;
  return head + w.ex.map((e, i) => exCardHTML(w, e, i, mode)).join('') +
    `<button class="btn pri block" data-a="addEx">＋ Add exercise</button>` +
    (mode === 'active' && w.ex.length ? `<button class="btn ok block" data-a="finish">Finish workout</button>` : '');
}
function exCardHTML(w, e, i, mode) {
  const x = exById(e.eid), routine = mode === 'routine';
  const prev = mode === 'routine' ? null : lastSets(e.eid, w.id);
  let n = 0;
  const rows = e.sets.map((s, j) => {
    const lbl = s.t === 'n' || !s.t ? ++n : s.t.toUpperCase();
    const p = prev && prev.sets[j];
    return `<div class="swipe"><div class="swipe-bg">Delete</div><div class="setrow ${s.done ? 'done' : ''}" data-ei="${i}" data-si="${j}">
      <button class="stype ${s.t || 'n'}" data-a="stype">${lbl}</button>
      <div class="prev">${routine ? '' : p ? esc(setStr(p)) : '–'}</div>
      <input inputmode="decimal" data-f="kg" class="${!s.done && s.sg === 'kg' ? 'sug' : ''}" value="${s.kg ? fmtKg(s.kg) : ''}" placeholder="kg">
      <input inputmode="numeric" data-f="reps" class="${!s.done && s.sg ? 'sug' : ''}" value="${s.reps ?? ''}" placeholder="reps">
      ${routine ? '' : `<button class="chk" data-a="check">✓</button>`}</div></div>`;
  }).join('');
  return `<div class="excard" data-ei="${i}">
    <div class="exhead">${mode !== 'edit' ? '<button class="draghandle" aria-label="Drag to reorder">⠿</button>' : ''}${thumbHTML(x, 'thumb')}<div class="grow"><div class="exname ellip" data-a="openEx" data-id="${x.id}">${esc(x.name)}</div></div>
      <button class="restchip" data-a="restMenu" data-ei="${i}">⏱ ${e.rest ? fmtClock(e.rest) : 'off'}</button>
      <button class="icon-btn" data-a="exMenu" data-ei="${i}">⋯</button></div>
    <div class="sets ${routine ? 'routine' : ''}">
      <div class="hdrow"><div class="hd">Set</div><div class="hd l">${routine ? '' : 'Previous'}</div><div class="hd">kg</div><div class="hd">Reps</div>${routine ? '' : '<div class="hd">✓</div>'}</div>
      ${rows}
    </div>
    <div class="exfoot"><button class="btn sm" data-a="addSet" data-ei="${i}">＋ Add set</button></div>
  </div>`;
}
function thumbHTML(x, cls) {
  if (x.a) return `<img class="${cls}" loading="lazy" src="thumb/${x.a}.webp" alt="" onerror="this.outerHTML='<div class=&quot;${cls} none&quot;>${esc(x.name[0] || '?')}</div>'">`;
  return `<div class="${cls} none">${esc((x.name || '?')[0])}</div>`;
}
function rerenderCard(i) {
  const ed = curEditor(); if (!ed) return;
  const el = document.querySelector(`.excard[data-ei="${i}"]`);
  if (el) el.outerHTML = exCardHTML(ed.obj, ed.obj.ex[i], i, ed.mode);
}

// ---------- rest timer ----------
const APP_VERSION = 'v26';   // keep in step with VERSION in sw.js
let audioCtx = null;
let sfxOut = null;     // where sound effects go: the speakers, or the bus of a queued rest alarm
let alarmBus = null;   // the queued rest alarm, so it can be cancelled or moved
// Browsers only allow sound after a user gesture, and on a touch screen pointerdown does not count:
// the end of the tap does. Unlock (and re-unlock after the phone suspended audio) on every tap.
function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') audioCtx.resume();
    const b = audioCtx.createBufferSource(); b.buffer = audioCtx.createBuffer(1, 1, 22050); b.connect(audioCtx.destination); b.start(0);
  } catch (e) {}
  unlockClip();
}
// ---- alarm as an audio clip ----
// The chosen sound is recorded once into a short WAV and played through an <audio> element. Phones let
// a page replay a clip it has already started during a tap; live Web Audio gets blocked more readily.
const clip = { el: null, key: null, ok: false, busy: false };
const diag = { last: '' };
function wavBlob(buf) {
  const d = buf.getChannelData(0), n = d.length, v = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true);
  return new Blob([v], { type: 'audio/wav' });
}
async function buildClip(key) {
  if (clip.key === key && clip.el) return;
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!Off) return;
  const off = new Off(1, 44100 * 1.6, 44100), real = audioCtx;
  audioCtx = off; sfxOut = null;
  try { (SFX[key] || SFX.bell).play(0.02); } finally { audioCtx = real; }
  const buf = await off.startRendering();
  const el = clip.el || new Audio(); el.preload = 'auto';
  if (el.src) URL.revokeObjectURL(el.src);
  el.src = URL.createObjectURL(wavBlob(buf)); el.load();
  clip.el = el; clip.key = key;
}
function unlockClip() {
  if (!clip.el || clip.ok || clip.busy) return;
  clip.busy = true; clip.el.muted = true;
  const p = clip.el.play();
  const done = ok => { clip.el.pause(); clip.el.currentTime = 0; clip.el.muted = false; clip.ok = ok; clip.busy = false; };
  if (p && p.then) p.then(() => done(true), () => done(false)); else done(true);
}
function showDiag() {
  try { localStorage.setItem('gbDiag', diag.last); } catch (e) {}
  const el = $('#alarmDiag'); if (el) el.textContent = 'Last alarm: ' + diag.last;
}
function playAlarm() {
  const d = new Date(), when = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const vis = document.visibilityState;
  const fallback = why => {
    diag.last = `${when} · clip ${why} · fallback sound (audio ${audioCtx ? audioCtx.state : 'none'}) · screen ${vis}`;
    playSfx(S.settings.sfx); showDiag();
  };
  if (!clip.el) return fallback('not ready');
  clip.el.currentTime = 0; clip.el.muted = false;
  const p = clip.el.play();
  const ok = () => { diag.last = `${when} · played · screen ${vis}`; showDiag(); };
  if (p && p.then) p.then(ok, e => fallback('blocked (' + (e && e.name || 'error') + ')')); else ok();
}
['pointerup', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, { passive: true, capture: true }));
function bellStrike(t, vol) {
  const ctx = audioCtx, out = ctx.createGain(); out.gain.value = vol; out.connect(sfxOut || ctx.destination);
  const base = 880;
  [[1, 1, 1.2], [2.0, 0.3, 0.8], [2.76, 0.25, 0.6], [5.4, 0.07, 0.3]].forEach(([ratio, g, dec]) => {
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.type = 'sine'; o.frequency.value = base * ratio;
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(g, t + 0.004); a.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(a); a.connect(out); o.start(t); o.stop(t + dec + 0.05);
  });
  // short metallic click of the hammer
  const len = Math.floor(ctx.sampleRate * 0.03), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
  hp.type = 'highpass'; hp.frequency.value = 5000; ng.gain.value = 0.12;
  n.buffer = buf; n.connect(hp); hp.connect(ng); ng.connect(out); n.start(t);
}
function tone(type, f0, f1, t, dur, vol, dest) {
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || sfxOut || audioCtx.destination); o.start(t); o.stop(t + dur + 0.02);
}
const SFX = {
  bell: { name: 'Boxing bell', play: t => [0, 0.3].forEach(dt => bellStrike(t + dt, 0.38)) },
  arcade: { name: 'Arcade level-up', play: t => {           // 8-bit square-wave arpeggio
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone('square', f, f, t + i * 0.085, 0.08, 0.12));
    tone('square', 1046.5, 1046.5, t + 0.36, 0.28, 0.12); tone('square', 1318.5, 1318.5, t + 0.36, 0.28, 0.06);
  } },
  synth: { name: 'Synth power chord', play: t => {         // detuned saw chord through a sweeping filter
    const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(250, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.35); lp.frequency.exponentialRampToValueAtTime(600, t + 1.1);
    lp.connect(sfxOut || audioCtx.destination);
    [110, 164.81, 220, 277.18].forEach(f => { tone('sawtooth', f, f, t, 1.1, 0.07, lp); tone('sawtooth', f * 1.008, f * 1.008, t, 1.1, 0.07, lp); });
  } },
  watch: { name: 'Digital watch alarm', play: t => {        // classic LCD-watch beep-beep, beep-beep
    [0, 0.12, 0.42, 0.54].forEach(dt => tone('square', 4096, 4096, t + dt, 0.07, 0.05));
  } },
  laser: { name: 'Laser zap', play: t => {                  // falling square-wave pew-pew
    [0, 0.22].forEach(dt => tone('square', 1800, 140, t + dt, 0.2, 0.12));
  } },
  toms: { name: 'Electro tom fill', play: t => {            // drum-machine style descending toms
    [[260, 0], [200, 0.13], [150, 0.26], [110, 0.39]].forEach(([f, dt]) => tone('sine', f, f * 0.55, t + dt, 0.32, 0.5));
  } },
};
function playSfx(key) {
  if (!audioCtx) return;
  const go = () => (SFX[key] || SFX.bell).play(audioCtx.currentTime + 0.02);
  if (audioCtx.state === 'running') go(); else audioCtx.resume().then(go, () => {});
}
// Queue the alarm in the audio clock when the rest starts. That happens inside the tap that ticks
// the set, when the phone allows sound; asking for sound later, when the rest ends, is what Android
// blocks. A silent loop keeps the audio running until the alarm has played.
function cancelAlarm() { if (alarmBus) { try { alarmBus.disconnect(); } catch (e) {} alarmBus = null; } }
function scheduleAlarm(endMs) {
  cancelAlarm();
  if (!S.settings.sound) return;
  unlockAudio(); if (!audioCtx) return;
  buildClip(S.settings.sfx);
  const t = audioCtx.currentTime + Math.max(0.05, (endMs - Date.now()) / 1000);
  alarmBus = audioCtx.createGain(); alarmBus.connect(audioCtx.destination);
  const keep = audioCtx.createBufferSource(); keep.buffer = audioCtx.createBuffer(1, 2205, 22050); keep.loop = true;
  keep.connect(alarmBus); keep.start(); keep.stop(t + 3);
}
function beep() {
  if (S.settings.vibrate && navigator.vibrate) navigator.vibrate([150, 120, 150]);
  if (!S.settings.sound) return;
  playAlarm();
}
function startRest(sec, eid) {
  if (!sec) { S.rest = null; renderRest(); return; }
  S.rest = { end: Date.now() + sec * 1000, total: sec, eid, beeped: false }; DB.put('kv', S.rest, 'rest'); renderRest();
  scheduleAlarm(S.rest.end);
}
function adjustRest(d) {
  if (!S.rest) return; S.rest.end += d * 1000; S.rest.total = Math.max(1, S.rest.total + d);
  if (S.rest.end > Date.now()) { S.rest.beeped = false; scheduleAlarm(S.rest.end); } DB.put('kv', S.rest, 'rest'); tick();
}
function renderRest() {
  if (!S.rest) cancelAlarm();
  const bar = $('#restbar');
  if (!S.rest || !S.active) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = `<div class="prog"></div><div class="row" style="position:relative">
    <div class="t" id="restT"></div><div class="grow tiny mut ellip">${S.rest.eid ? esc(exById(S.rest.eid).name) : 'Alarm test'}</div>
    <button class="btn" data-a="rest-15">−15</button><button class="btn" data-a="rest+15">+15</button><button class="btn" data-a="restSkip">Done</button></div>`;
  tick();
}
// Workout tab while a workout runs: blinking green dot + elapsed time in place of the label
function navLive() {
  const b = document.querySelector('#nav button[data-tab="train"]'); if (!b) return;
  const lb = b.querySelector('.lb');
  if (S.active) {
    if (!b.classList.contains('live')) { b.classList.add('live'); lb.innerHTML = '<span class="ldot"></span><span class="lt"></span>'; b.setAttribute('aria-label', 'Workout in progress'); }
    const t = fmtClock((Date.now() - S.active.start) / 1000), lt = lb.querySelector('.lt');
    if (lt.textContent !== t) lt.textContent = t;
  } else if (b.classList.contains('live')) { b.classList.remove('live'); lb.textContent = 'Workout'; b.removeAttribute('aria-label'); }
}
function tick() {
  navLive();
  const el = $('#elapsed'); if (el && S.active) el.textContent = fmtClock((Date.now() - S.active.start) / 1000);
  if (S.rest) {
    const left = (S.rest.end - Date.now()) / 1000;
    const t = $('#restT'), bar = $('#restbar');
    if (t) {
      t.textContent = left >= 0 ? fmtClock(Math.ceil(left)) : '+' + fmtClock(-left);
      bar.classList.toggle('over', left < 0);
      $('.prog', bar).style.width = Math.max(0, Math.min(100, left / S.rest.total * 100)) + '%';
    }
    if (left <= 0 && !S.rest.beeped) { S.rest.beeped = true; if (document.visibilityState === 'visible' && left > -5) beep(); }
    if (left < -120) { S.rest = null; renderRest(); }
  }
}
setInterval(tick, 250);

// ---------- wake lock ----------
let wakeLock = null;
async function requestWake() {
  if (!S.settings.wake || !S.active || !('wakeLock' in navigator) || wakeLock) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { requestWake(); tick(); }
  else { flushActive(); }
});

// ---------- finish / summary ----------
function finishWorkout() {
  const w = S.active; if (!w) return;
  const out = clone(w);
  out.ex = out.ex.map(e => ({ ...e, sets: e.sets.filter(s => s.done) })).filter(e => e.sets.length);
  out.end = Date.now();
  if (!out.ex.length) {
    const keep = S.active; S.active = null; S.rest = null; flushActive(); renderRest(); render();
    toast('No completed sets – workout discarded', () => { S.active = keep; flushActive(); render(); });
    return;
  }
  S.workouts.push(out); sortWorkouts(); DB.put('workouts', out);
  S.active = null; S.rest = null; flushActive(); DB.put('kv', null, 'rest'); renderRest();
  if (wakeLock) { wakeLock.release(); wakeLock = null; }
  computePRs();
  S.stack = []; push({ v: 'summary', id: out.id, orig: w });
}
function routineDiffers(r, w) {
  if (!r) return false;
  if (r.ex.length !== w.ex.length) return true;
  return r.ex.some((e, i) => e.eid !== w.ex[i].eid || e.sets.length !== w.ex[i].sets.length || e.rest !== w.ex[i].rest);
}
function routineFromWorkout(w, name) {
  return { id: uid(), name: name || w.name, ex: w.ex.map(e => ({ eid: e.eid, rest: e.rest, sets: e.sets.map(s => ({ kg: s.kg, reps: s.reps, t: s.t || 'n' })) })) };
}
function viewSummary(t) {
  const w = S.workouts.find(x => x.id === t.id); if (!w) return '';
  const prs = S.pr.get(w.id) || [];
  const r = w.routineId && S.routines.find(x => x.id === w.routineId);
  const sets = w.ex.reduce((a, e) => a + e.sets.length, 0);
  const vol = w.ex.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0), 0);
  return `<h1>Great work! 💪</h1>
  <div class="card"><h3>${esc(w.name)}</h3><div class="small mut">${fmtDate(w.start)} · ${fmtDur((w.end - w.start) / 1000)}</div>
   <div class="stats" style="margin-top:10px"><div class="stat"><div class="v">${sets}</div><div class="l">Sets</div></div><div class="stat"><div class="v">${fmtNum(vol)} kg</div><div class="l">Volume</div></div></div></div>
  ${prs.length ? `<h2>🎆 New records</h2><div class="card">${prs.map(p => `<div class="row between" style="padding:4px 0"><span>${esc(exById(p.eid).name)}<br><span class="tiny mut">${PRLABEL[p.type]}${p.set ? ' · ' + prWhere(p) : ''}</span></span><span class="badge">${prVal(p)}</span></div>`).join('')}</div>` : ''}
  ${r && routineDiffers(r, w) && !t.updated ? `<button class="btn block" data-a="updateRoutine" data-id="${w.id}">Update routine “${esc(r.name)}” with this workout</button>` : ''}
  ${!r && !t.saved ? `<button class="btn block" data-a="saveAsRoutine" data-id="${w.id}">Save as routine</button>` : ''}
  <button class="btn pri block" data-a="summaryDone">Done</button>`;
}

// ---------- HISTORY ----------
function workoutVol(w) { return w.ex.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.done && s.t !== 'w' ? (s.kg || 0) * (s.reps || 0) : 0), 0), 0); }
function viewHistory() {
  if (!S.workouts.length) return `<h1>History</h1><p class="empty">No workouts yet.<br>Import from Strong under “More”.</p>`;
  let html = `<h1>History</h1><div class="small mut" style="margin-bottom:8px">${S.workouts.length} workouts</div>`, month = '';
  for (const w of S.workouts.slice(0, S.histLimit || 60)) {
    const m = new Date(w.start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (m !== month) { month = m; html += `<h2 style="text-transform:capitalize">${m}</h2>`; }
    const prs = (S.pr.get(w.id) || []).length;
    html += `<div class="card tap" data-a="openWorkout" data-id="${w.id}">
      <div class="row"><h3 class="grow">${esc(w.name)}</h3>${prs ? `<span class="badge">🎆 ${prs}</span>` : ''}</div>
      <div class="tiny mut">${fmtDate(w.start)} · ${fmtDur(((w.end || w.start) - w.start) / 1000)} · ${fmtNum(workoutVol(w))} kg</div>
      <div class="small" style="margin-top:6px">${w.ex.map(e => `<div class="ellip">${e.sets.filter(s => s.done).length} × ${esc(exById(e.eid).name)}</div>`).join('')}</div></div>`;
  }
  if (S.workouts.length > (S.histLimit || 60)) html += `<button class="btn block" data-a="moreHist">Show more</button>`;
  return html;
}
function viewWorkout(t) {
  const w = S.workouts.find(x => x.id === t.id); if (!w) return '<p class="empty">Workout deleted</p>';
  const prs = S.pr.get(w.id) || [];
  return `<div class="vhead"><button class="icon-btn" data-a="back">‹</button><h1 class="ellip">${esc(w.name)}</h1><button class="icon-btn" data-a="workoutMenu" data-id="${w.id}">⋯</button></div>
   <div class="small mut">${fmtDate(w.start, { year: 'numeric' })} at ${new Date(w.start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ${fmtDur(((w.end || w.start) - w.start) / 1000)} · ${fmtNum(workoutVol(w))} kg</div>
   <div class="row" style="margin:10px 0"><button class="btn pri grow" data-a="repeatWorkout" data-id="${w.id}">Repeat workout</button><button class="btn" data-a="editWorkout" data-id="${w.id}">Edit</button></div>
   ${w.ex.map(e => {
     const x = exById(e.eid); let n = 0;
     return `<div class="card"><div class="row" data-a="openEx" data-id="${x.id}">${thumbHTML(x, 'thumb')}<h3 class="grow" style="color:var(--acc)">${esc(x.name)}</h3></div>
     <div style="margin-top:6px">${e.sets.filter(s => s.done).map(s => {
       const lbl = s.t && s.t !== 'n' ? s.t.toUpperCase() : ++n;
       const isPr = prs.some(p => p.eid === e.eid && ((p.type === 'kg' && p.val === s.kg) || (p.type === 'rm' && Math.abs(p.val - e1rm(s.kg, s.reps)) < 0.01)));
       return `<div class="row hset"><span class="mut" style="width:22px">${lbl}</span><span class="grow">${setStr(s)}</span>${isPr ? '<span class="pr">🎆 PR</span>' : ''}</div>`;
     }).join('')}</div></div>`;
   }).join('')}`;
}

// ---------- EXERCISES ----------
function viewExercises() {
  return `<h1>Exercises</h1>${exListShell('open')}`;
}
function exListShell(mode) {
  return `<div class="search"><input type="search" id="exq" placeholder="Search ${S.lib.length + S.custom.length} exercises" value="${esc(S.q)}" autocomplete="off">
   <div class="chips">${GROUPS.map((g, i) => `<button class="chip ${i === S.grp ? 'on' : ''}" data-a="grp" data-i="${i}">${g[0]}</button>`).join('')}</div></div>
   <div id="exlist" data-mode="${mode}"></div>`;
}
function allExercises() { return [...S.custom, ...S.lib]; }
function renderExList() {
  const box = $('#exlist'); if (!box) return;
  const mode = box.dataset.mode;
  const q = S.q.trim().toLowerCase(), terms = q.split(/\s+/).filter(Boolean);
  const g = GROUPS[S.grp][1];
  const use = usage();
  const match = x => (!g || x.pm.some(m => g.includes(m))) && terms.every(t => x.name.toLowerCase().includes(t) || (x.ref || '').toLowerCase().includes(t));
  const list = allExercises().filter(match);
  const mine = list.filter(x => use.get(x.id) || x.custom).sort((a, b) => (use.get(b.id) || 0) - (use.get(a.id) || 0));
  const rest = list.filter(x => !use.get(x.id) && !x.custom);
  const item = x => `<div class="li" data-a="pick" data-id="${x.id}">${thumbHTML(x, 'thumb')}<div class="grow"><div class="ellip">${esc(x.name)}</div><div class="tiny mut ellip">${x.pm.map(m => MUSCLE[m] || m).join(', ')}${x.pm.length ? ' · ' : ''}${EQUIP[x.eq] || x.eq}${use.get(x.id) ? ` · ${use.get(x.id)} workouts` : ''}</div></div></div>`;
  let html = '';
  if (q) html += `<button class="btn block" data-a="newCustom">＋ Create exercise “${esc(S.q.trim())}”</button>`;
  if (mine.length) html += `<h2>My exercises</h2>` + mine.map(item).join('');
  if (rest.length) html += `<h2>${mine.length ? 'All others' : 'All exercises'}</h2>` + rest.slice(0, S.exLimit || 150).map(item).join('');
  if (rest.length > (S.exLimit || 150)) html += `<button class="btn block" data-a="moreEx">Show more (${rest.length - (S.exLimit || 150)})</button>`;
  if (!list.length) html += `<p class="empty">No matches</p>`;
  box.innerHTML = html;
}
function viewExercise(t) {
  const x = exById(t.id), st = exStats(x.id);
  const imgs = x.a ? `<div class="anim"><img src="anim/${x.a}.webp" alt="" onerror="this.parentNode.remove()"></div>` : '';
  const map = (x.pm && x.pm.length) ? bodyMapHTML(levelsForExercise(x), `<div class="bmleg tiny mut"><span style="background:${LEVEL_COL[4]}"></span>Primary <span style="background:${LEVEL_COL[2]}"></span>Secondary</div>`) : '';
  // Drawing and muscle map side by side; either one alone if the other is missing
  const vis = imgs && map ? `<div class="exvis">${imgs}<div class="exmap">${map}</div></div>` : imgs + map;
  const recs = st.n ? (st.bw ? `
     <div class="stat"><div class="v">${st.reps}</div><div class="l">Most reps in a set</div></div>
     <div class="stat"><div class="v">${st.totalReps}</div><div class="l">Most reps in a workout</div></div>` : `
     <div class="stat"><div class="v">${fmtKg(Math.round(st.rm * 10) / 10)} kg</div><div class="l">Estimated 1RM${st.rmSet ? ` (${setStr(st.rmSet)})` : ''}</div></div>
     <div class="stat"><div class="v">${fmtKg(st.kg)} kg</div><div class="l">Heaviest weight</div></div>
     <div class="stat"><div class="v">${st.reps}</div><div class="l">Most reps in a set</div></div>
     <div class="stat"><div class="v">${fmtNum(st.vol)} kg</div><div class="l">Most volume in a workout</div></div>`) : '';
  const rrKeys = Object.keys(st.rr).map(Number).sort((a, b) => a - b);
  const chartData = [...st.sessions].reverse().map(s => ({ t: s.w.start, v: st.bw ? s.reps : Math.round(s.rm * 10) / 10 })).filter(p => p.v > 0);
  const lim = t.lim || 15;
  return `<div class="vhead"><button class="icon-btn" data-a="back">‹</button><h1 class="ellip">${esc(x.name)}</h1></div>
   ${vis}
   <div class="small mut">${x.pm.map(m => MUSCLE[m] || m).join(', ') || 'Unknown muscle group'}${x.sm && x.sm.length ? ` (+ ${x.sm.map(m => MUSCLE[m] || m).join(', ')})` : ''} · ${EQUIP[x.eq] || x.eq}${x.ref && x.ref !== x.name ? `<br>Animation: ${esc(x.ref)}` : ''}</div>
   ${x.custom ? `<div class="row" style="margin-top:8px"><select data-a="customMuscle" data-id="${x.id}">${['', ...Object.keys(MUSCLE)].map(m => `<option value="${m}" ${x.pm[0] === m ? 'selected' : ''}>${m ? MUSCLE[m] : 'Choose muscle group'}</option>`).join('')}</select></div>` : ''}
   ${st.n ? `<h2>Records</h2><div class="stats">${recs}</div>
     <h2>${st.bw ? 'Best reps per workout' : 'Estimated 1RM over time'}</h2>${chartHTML(chartData)}` : '<p class="mut small" style="margin-top:14px">No logged sets yet.</p>'}
   ${rrKeys.length ? `<h2>Rep records</h2><table class="rr"><tr><th>Reps</th><th>Best weight</th><th>Date</th></tr>${rrKeys.map(k => `<tr><td>${k}</td><td>${fmtKg(st.rr[k].kg)} kg</td><td class="mut">${fmtDateY(st.rr[k].date)}</td></tr>`).join('')}</table>` : ''}
   ${x.desc ? `<h2>About</h2><p class="small" style="color:#cfd3d8">${esc(x.desc)}</p>` : ''}
   ${x.ins && x.ins.length ? `<h2>How to</h2><ol class="ins small">${x.ins.map(i => `<li>${esc(i)}</li>`).join('')}</ol>` : ''}
   ${st.n ? `<h2>History (${st.n} workouts)</h2>${st.sessions.slice(0, lim).map(s => `<div class="card tap" data-a="openWorkout" data-id="${s.w.id}"><div class="row between"><b class="small">${fmtDate(s.w.start, { year: 'numeric' })}</b><span class="tiny mut">${esc(s.w.name)}</span></div>
      <div class="hset" style="margin-top:4px">${s.sets.map(z => `<span style="display:inline-block;margin-right:12px">${z.t && z.t !== 'n' ? `<span class="mut">${z.t.toUpperCase()}</span> ` : ''}${setStr(z)}</span>`).join('')}</div></div>`).join('')}
      ${st.n > lim ? `<button class="btn block" data-a="moreExHist">Show more</button>` : ''}` : ''}`;
}
function chartHTML(d) {
  if (d.length < 2) return '<p class="mut small">Not enough data for a chart.</p>';
  const W = 340, H = 150, P = { l: 34, r: 8, t: 10, b: 20 };
  const t0 = d[0].t, t1 = d[d.length - 1].t || t0 + 1;
  let v0 = Math.min(...d.map(p => p.v)), v1 = Math.max(...d.map(p => p.v)); const padv = (v1 - v0) * 0.1 || 1; v0 -= padv; v1 += padv;
  const X = t => P.l + (t - t0) / (t1 - t0 || 1) * (W - P.l - P.r), Y = v => H - P.b - (v - v0) / (v1 - v0) * (H - P.t - P.b);
  const pts = d.map(p => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const grid = [0, .5, 1].map(f => { const v = v0 + (v1 - v0) * f; return `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#2b303a"/><text x="${P.l - 4}" y="${Y(v) + 3}" text-anchor="end">${Math.round(v)}</text>`; }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${grid}<polyline fill="none" stroke="#4f8cff" stroke-width="2" points="${pts}"/>${d.map(p => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="2.5" fill="#4f8cff"/>`).join('')}
   <text x="${P.l}" y="${H - 4}">${fmtDateY(t0)}</text><text x="${W - P.r}" y="${H - 4}" text-anchor="end">${fmtDateY(t1)}</text></svg>`;
}

// ---------- RECORDS ----------
function viewRecords() {
  const events = [];
  for (const w of S.workouts) for (const p of (S.pr.get(w.id) || [])) if (p.type !== 'vol') events.push({ ...p, w });
  const seen = new Set(); const per = [];
  const use = usage();
  for (const [eid] of [...use.entries()].sort((a, b) => b[1] - a[1])) {
    if (seen.has(eid)) continue; seen.add(eid);
    const st = exStats(eid); if (!st.n) continue;
    per.push({ x: exById(eid), st });
  }
  if (!per.length) return `<h1>Records</h1><p class="empty">No records yet.</p>`;
  const days = S.mapDays || 7, load = muscleLoad(days), lv = {};
  const vals = Object.values(load), max = Math.max(1, ...vals);
  for (const [m, v] of Object.entries(load)) { const l = v >= max * 0.75 ? 4 : v >= max * 0.45 ? 3 : v >= max * 0.2 ? 2 : 1; for (const sl of BODY_SLUGS[m] || []) lv[sl] = Math.max(lv[sl] || 0, l); }
  const top = Object.entries(load).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return `<h1>Records</h1>
   <h2>Training load</h2>
   <div class="seg"><button class="${days === 7 ? 'on' : ''}" data-a="mapDays" data-d="7">Last 7 days</button><button class="${days === 30 ? 'on' : ''}" data-a="mapDays" data-d="30">Last 30 days</button></div>
   ${vals.length ? bodyMapHTML(lv, `<div class="tiny mut" style="text-align:center">${top.map(([m, v]) => `${MUSCLE[m] || m} ${Math.round(v)}`).join(' · ')} sets</div>`) : '<p class="mut small">No workouts in this period.</p>'}
   ${events.length ? `<h2>Latest records</h2><div class="card">${events.slice(0, 12).map(e => `<div class="row tap" style="padding:6px 0" data-a="openEx" data-id="${e.eid}"><div class="grow"><div class="ellip">${esc(exById(e.eid).name)}</div><div class="tiny mut">${PRLABEL[e.type]} · ${fmtDate(e.w.start)}</div>${e.set ? `<div class="tiny mut">${prWhere(e)}</div>` : ''}</div><span class="badge">${prVal(e)}</span></div>`).join('')}</div>` : ''}
   <h2>By exercise</h2>
   ${per.map(({ x, st }) => `<div class="li" data-a="openEx" data-id="${x.id}">${thumbHTML(x, 'thumb')}<div class="grow"><div class="ellip">${esc(x.name)}</div>
     <div class="tiny mut">${st.bw ? `Most reps: ${st.reps} · Most in a workout: ${st.totalReps}` : `1RM ≈ ${fmtKg(Math.round(st.rm * 10) / 10)} kg · Heaviest: ${fmtKg(st.kg)} kg · ${st.rmSet ? setStr(st.rmSet) : ''}`}</div></div></div>`).join('')}`;
}

// ---------- MORE / settings ----------
function viewMore() {
  const st = S.settings;
  return `<h1>More</h1>
  <h2>Import and backup</h2>
  <div class="card">
    <button class="btn block" data-a="importStrong">📥 Import from Strong (CSV)</button>
    <button class="btn block" data-a="importHevy">📥 Import from Hevy (CSV)</button>
    <button class="btn block" data-a="exportHevy">📤 Export for Hevy (CSV)</button>
    <button class="btn block" data-a="exportBackup">💾 Export backup (JSON)</button>
    <button class="btn block" data-a="importBackup">♻️ Restore backup</button>
    <div class="tiny mut">Hevy only imports Strong's CSV format, so “Export for Hevy” writes a Strong-format file: in Hevy, use Settings → Export &amp; Import Data → Import Strong CSV. Data is stored only on this device. Back up regularly – deleting the app or browser data erases your history.</div>
    <div id="importMsg" class="small" style="margin-top:8px"></div>
  </div>
  <h2>Rest timer</h2>
  <div class="card">
    <div class="small mut" style="margin-bottom:6px">Default rest time for new exercises</div>
    <div class="grid3">${REST_PRESETS.filter(Boolean).map(s => `<button class="btn sm ${st.rest === s ? 'on' : ''}" data-a="defRest" data-s="${s}">${fmtClock(s)}</button>`).join('')}</div>
    <label class="set"><span>Sound when rest is over</span><input type="checkbox" data-a="toggle" data-k="sound" ${st.sound ? 'checked' : ''}></label>
    <div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)"><select data-a="sfx" class="grow">${Object.entries(SFX).map(([k, v]) => `<option value="${k}" ${st.sfx === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select><button class="btn sm" data-a="testSfx">▶ Test</button></div>
    <button class="btn block" data-a="testAlarm">⏱ Test rest alarm (5 s)</button>
    <div class="tiny mut" id="alarmDiag" style="padding:4px 0 8px">${diag.last ? 'Last alarm: ' + esc(diag.last) : 'Last alarm: none yet'}</div>
    <label class="set"><span>Vibration (Android)</span><input type="checkbox" data-a="toggle" data-k="vibrate" ${st.vibrate ? 'checked' : ''}></label>
    <label class="set" style="border:0"><span>Keep screen on during workout</span><input type="checkbox" data-a="toggle" data-k="wake" ${st.wake ? 'checked' : ''}></label>
  </div>
  <h2>Progression</h2>
  <div class="card">
    <label class="set"><span>Suggest next weight and reps</span><input type="checkbox" data-a="toggle" data-k="progress" ${st.progress ? 'checked' : ''}></label>
    <div class="small mut" style="margin:8px 0 6px">Default rep range – weight goes up when every working set reaches the top</div>
    <div class="grid3">${RANGES.map(r => `<button class="btn sm ${(st.range || [8, 12]).join() === r.join() ? 'on' : ''}" data-a="defRange" data-r="${r.join('-')}">${r.join('–')}</button>`).join('')}</div>
    <div class="small mut" style="margin:10px 0 6px">Weight step (dumbbells and kettlebells use 2 kg)</div>
    <div class="grid3">${[1.25, 2.5, 5].map(v => `<button class="btn sm ${(st.step || 2.5) === v ? 'on' : ''}" data-a="defStep" data-s="${v}">+${fmtKg(v)} kg</button>`).join('')}</div>
  </div>
  <h2>Offline</h2>
  <div class="card">
    <div class="small">Animations for your own exercises are saved automatically. Others are saved when you open them – or download all (~42 MB).</div>
    <button class="btn block" data-a="dlImages">⬇️ Download all animations</button>
    <div class="progress" id="dlProg" hidden><div></div></div><div id="dlMsg" class="tiny mut"></div>
  </div>
  <h2>Data</h2>
  <div class="card small">
    <div>${S.workouts.length} workouts · ${S.routines.length} routines · ${S.custom.length} custom exercises</div>
    <button class="btn block bad" data-a="wipe">Delete all data</button>
  </div>
  <p class="tiny mut">Exercise drawings: <a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noopener">Workout Guide</a> by Bryl Lim, partly based on <a href="https://github.com/everkinetic/data" target="_blank" rel="noopener">Everkinetic</a> by Greg Priday, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>, recoloured and combined into animations. Exercise descriptions: Open Exercise Figures (CC0). Muscle maps: body-highlighter (MIT). Icons: Tabler Icons (MIT).</p>
  <p class="tiny mut">Gymbot ${APP_VERSION}</p>
  <input type="file" id="fileStrong" accept=".csv,text/csv,text/plain" hidden>
  <input type="file" id="fileHevy" accept=".csv,text/csv,text/plain" hidden>
  <input type="file" id="fileBackup" accept=".json,application/json" hidden>`;
}

// ---------- Strong CSV import ----------
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.indexOf('\n'));
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(h.map((k, i) => [k.trim(), r[i] ?? ''])));
}
function slugName(s) { return 'c_' + s.toLowerCase().replace(/[^a-z0-9æøå]+/g, '_').replace(/^_|_$/g, ''); }
async function importStrong(text) {
  const rows = parseCSV(text);
  if (!rows.length || !('Exercise Name' in rows[0])) throw new Error('Strong columns not found (Exercise Name, Set Order …)');
  return importRows(rows, 'strong');
}
// Shared by the Strong and Hevy imports: rows in Strong's CSV layout. Workout ids come from the start
// time, so a workout that exists in both a Strong and a Hevy export is only imported once.
async function importRows(rows, src) {
  const wKey = Object.keys(rows[0]).find(k => /^Weight/i.test(k));
  const lbs = wKey && /lb/i.test(wKey);
  const byName = new Map(allExercises().map(x => [x.name.toLowerCase(), x]));
  const newCustom = [];
  const resolve = name => {
    const k = name.trim().toLowerCase(); let x = byName.get(k);
    if (!x) { x = { id: slugName(name), name: name.trim(), eq: 'other', pm: [], sm: [], ins: [], custom: true }; byName.set(k, x); newCustom.push(x); }
    return x.id;
  };
  const parseDate = s => { const m = s.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/); return m ? new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).getTime() : Date.parse(s); };
  const ws = new Map();
  for (const r of rows) {
    const key = r['Date'] + '|' + r['Workout Name'];
    let w = ws.get(key);
    if (!w) {
      const start = parseDate(r['Date']);
      const dur = parseFloat(r['Duration (sec)']) || (parseFloat(r['Duration']) || 0);
      w = { id: 'strong-' + r['Date'].replace(/\D/g, ''), name: r['Workout Name'] || 'Workout', start, end: start + dur * 1000, src, notes: r['Workout Notes'] || '', ex: [] };
      ws.set(key, w);
    }
    const eid = resolve(r['Exercise Name']);
    const order = r['Set Order'];
    let e = w.ex[w.ex.length - 1];
    if (!e || e.eid !== eid) { e = { eid, rest: null, sets: [] }; w.ex.push(e); }
    if (order === 'Rest Timer') { if (e.rest == null) e.rest = Math.round(parseFloat(r['Seconds']) || 0); continue; }
    if (order === 'Note') { if (r['Notes']) e.note = r['Notes']; continue; }
    let t = 'n', o = order.toUpperCase();
    if (o === 'W') t = 'w'; else if (o === 'D') t = 'd'; else if (o === 'F') t = 'f';
    let kg = num(r[wKey]); if (kg != null && lbs) kg = Math.round(kg * 0.45359237 * 4) / 4;
    const s = { kg: kg || 0, reps: num(r['Reps']) ?? 0, t, done: true };
    if (num(r['RPE'])) s.rpe = num(r['RPE']);
    if (num(r['Distance (meters)'])) s.dist = num(r['Distance (meters)']);
    if (num(r['Seconds'])) s.sec = num(r['Seconds']);
    if (r['Notes']) s.note = r['Notes'];
    e.sets.push(s);
  }
  const list = [...ws.values()].map(w => { w.ex = w.ex.filter(e => e.sets.length); w.ex.forEach(e => { if (e.rest == null) e.rest = S.settings.rest; }); return w; }).filter(w => w.ex.length);
  const existing = new Set(S.workouts.map(w => w.id));
  const added = list.filter(w => !existing.has(w.id));
  if (newCustom.length) { S.custom.push(...newCustom); await DB.putMany('customEx', newCustom); indexEx(); }
  await DB.putMany('workouts', list);
  const map = new Map(S.workouts.map(w => [w.id, w])); list.forEach(w => map.set(w.id, w));
  S.workouts = [...map.values()]; sortWorkouts();
  // routines from latest session of each named workout
  const generic = /^(morning|afternoon|evening|night|midday)?\s*workout$|^økt$/i;
  const routineNames = new Set(S.routines.map(r => r.name.toLowerCase()));
  const newRoutines = [];
  for (const w of [...list].sort((a, b) => b.start - a.start)) {
    const k = w.name.toLowerCase();
    if (generic.test(w.name.trim()) || routineNames.has(k)) continue;
    routineNames.add(k); newRoutines.push(routineFromWorkout(w));
  }
  if (newRoutines.length) { S.routines.push(...newRoutines); await DB.putMany('routines', newRoutines); }
  computePRs();
  const setsN = list.reduce((a, w) => a + w.ex.reduce((b, e) => b + e.sets.length, 0), 0);
  return `✅ Read ${list.length} workouts (${added.length} new), ${setsN} sets. ${newCustom.length ? `${newCustom.length} custom exercises created. ` : ''}${newRoutines.length ? `Routines created: ${newRoutines.map(r => esc(r.name)).join(', ')}.` : ''}`;
}

// ---------- Hevy CSV ----------
// Hevy's workout export: title, start_time, end_time, description, exercise_title, superset_id,
// exercise_notes, set_index, set_type, weight_kg | weight_lbs, reps, distance_km | distance_miles,
// duration_seconds, rpe. Dates look like "26 Mar 2024, 18:05" (ISO is accepted too).
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseHevyDate(s) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m && MONTHS[m[2].toLowerCase()] != null) return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +m[4], +m[5], +(m[6] || 0)).getTime();
  const t = Date.parse(s); return isNaN(t) ? null : t;
}
const pad2 = n => String(n).padStart(2, '0');
function strongDate(t) { const d = new Date(t); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; }
async function importHevy(text) {
  const rows = parseCSV(text);
  if (!rows.length || !('exercise_title' in rows[0]) || !('start_time' in rows[0])) throw new Error('Hevy columns not found (exercise_title, start_time …)');
  const lbs = !('weight_kg' in rows[0]) && 'weight_lbs' in rows[0];
  const miles = !('distance_km' in rows[0]) && 'distance_miles' in rows[0];
  const TYPE = { warmup: 'W', dropset: 'D', failure: 'F' };
  const out = []; let lastKey = '', n = 0, first = true;
  for (const r of rows) {
    const start = parseHevyDate(r.start_time);
    if (start == null) throw new Error(`Unreadable date in Hevy file: “${r.start_time}”`);
    const end = parseHevyDate(r.end_time);
    const date = strongDate(start);
    const exKey = date + '|' + r.title + '|' + r.exercise_title;
    if (exKey !== lastKey) { lastKey = exKey; n = 0; first = true; }
    // every row carries every column, so the shared importer finds them on the first row
    const base = { 'Date': date, 'Workout Name': r.title || 'Workout', 'Duration (sec)': end && end > start ? Math.round((end - start) / 1000) : 0, 'Exercise Name': r.exercise_title, 'Set Order': '', 'Weight (kg)': '', 'Reps': '', 'RPE': '', 'Distance (meters)': '', 'Seconds': '', 'Notes': '', 'Workout Notes': r.description || '' };
    if (first && r.exercise_notes) out.push({ ...base, 'Set Order': 'Note', 'Notes': r.exercise_notes });
    first = false;
    const type = TYPE[(r.set_type || '').toLowerCase()];
    if (!type) n++;
    let kg = num(lbs ? r.weight_lbs : r.weight_kg); if (kg != null && lbs) kg = Math.round(kg * 0.45359237 * 4) / 4;
    let dist = num(miles ? r.distance_miles : r.distance_km); if (dist != null) dist = Math.round(dist * (miles ? 1609.344 : 1000));
    out.push({ ...base, 'Set Order': type || String(n), 'Weight (kg)': kg ?? '', 'Reps': r.reps, 'RPE': r.rpe, 'Distance (meters)': dist ?? '', 'Seconds': r.duration_seconds, 'Notes': '' });
  }
  return importRows(out, 'hevy');
}
// Hevy imports only Strong CSV files, so export in Strong's layout (kg, English headers).
async function exportHevy() {
  const H = ['Workout #', 'Date', 'Workout Name', 'Duration (sec)', 'Exercise Name', 'Set Order', 'Weight (kg)', 'Reps', 'RPE', 'Distance (meters)', 'Seconds', 'Notes', 'Workout Notes'];
  const q = v => { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const lines = [H.join(',')];
  const ws = [...S.workouts].sort((a, b) => a.start - b.start);
  let sets = 0;
  ws.forEach((w, i) => {
    const dur = w.end && w.end > w.start ? Math.round((w.end - w.start) / 1000) : 0;
    for (const e of w.ex) {
      let n = 0;
      for (const s of e.sets.filter(s => s.done)) {
        const order = s.t === 'w' ? 'W' : s.t === 'd' ? 'D' : s.t === 'f' ? 'F' : String(++n);
        lines.push([i + 1, strongDate(w.start), w.name || 'Workout', dur, exById(e.eid).name, order, s.kg || 0, s.reps || 0, s.rpe ?? '', s.dist ?? '', s.sec ?? '', s.note || '', w.notes || ''].map(q).join(','));
        sets++;
      }
    }
  });
  if (!sets) throw new Error('No workouts to export.');
  await shareFile(`gymbot-for-hevy-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n') + '\n', 'text/csv');
  return `✅ Exported ${ws.length} workouts, ${sets} sets. In Hevy: Settings → Export &amp; Import Data → Import Data → Import Strong CSV.`;
}

// ---------- backup ----------
async function shareFile(name, text, type) {
  const blob = new Blob([text], { type });
  const file = new File([blob], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function exportBackup() {
  const data = { app: 'gymbot', v: 1, exported: new Date().toISOString(), workouts: S.workouts, routines: S.routines, custom: S.custom, settings: S.settings };
  const name = `gymbot-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function importBackup(text) {
  const d = JSON.parse(text);
  if (!['gymbot', 'treningslogg'].includes(d.app)) throw new Error('Not a Gymbot backup');
  await DB.putMany('workouts', d.workouts || []); await DB.putMany('routines', d.routines || []); await DB.putMany('customEx', d.custom || []);
  if (d.settings) { S.settings = { ...S.settings, ...d.settings }; saveSettings(); }
  await loadAll();
  return `✅ Restored ${d.workouts.length} workouts and ${d.routines.length} routines.`;
}

// ---------- image download ----------
async function downloadImages() {
  const msg = $('#dlMsg'), prog = $('#dlProg');
  if (!('caches' in window)) { msg.textContent = 'This browser does not support offline storage.'; return; }
  const list = await (await fetch('images.json')).json();
  const cache = await caches.open('media-v3');
  prog.hidden = false; let done = 0, fail = 0;
  const queue = [...list];
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      try { if (!(await cache.match(p))) { const r = await fetch(p); if (r.ok) await cache.put(p, r); else fail++; } } catch (e) { fail++; }
      done++; if (done % 10 === 0 || done === list.length) { $('div', prog).style.width = (done / list.length * 100) + '%'; msg.textContent = `${done} / ${list.length}`; }
    }
  };
  await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
  msg.textContent = fail ? `Done, ${fail} failed – try again online.` : 'All animations saved offline ✅';
}

// ---------- sheets ----------
function renderSheet() {
  const el = $('#sheet');
  const sh = S.sheet;
  if (!sh) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  let body = '', full = false;
  if (sh.type === 'picker') {
    full = true;
    body = `<div class="row between"><h2 style="margin:0">${sh.replace != null ? 'Replace exercise' : 'Add exercise'}</h2><button class="btn sm" data-a="closeSheet">Close</button></div>${exListShell('pick')}`;
  } else if (sh.type === 'rest') {
    const ed = curEditor(); const cur = ed && ed.obj.ex[sh.ei] && ed.obj.ex[sh.ei].rest;
    body = `<h2 style="margin-top:0">Rest time – ${esc(exById(ed.obj.ex[sh.ei].eid).name)}</h2><div class="grid3">${REST_PRESETS.map(s => `<button class="btn ${cur === s ? 'on' : ''}" data-a="setRest" data-s="${s}">${s ? fmtClock(s) : 'Off'}</button>`).join('')}</div>`;
  } else if (sh.type === 'range') {
    const cur = (S.settings.ranges || {})[sh.eid];
    body = `<h2 style="margin-top:0">Rep range – ${esc(exById(sh.eid).name)}</h2>
      <div class="small mut" style="margin-bottom:8px">Weight goes up when every working set reaches the top of the range.</div>
      <div class="grid3">${RANGES.map(r => `<button class="btn ${cur && cur.join() === r.join() ? 'on' : ''}" data-a="setRange" data-r="${r.join('-')}">${r.join('–')}</button>`).join('')}</div>
      <button class="btn block ${cur ? '' : 'on'}" data-a="setRange" data-r="">Use default (${(S.settings.range || [8, 12]).join('–')})</button>`;
  } else if (sh.type === 'menu') {
    body = `<div class="menu">${sh.items.map((it, i) => `<button class="${it.bad ? 'bad' : ''}" data-a="menuItem" data-i="${i}">${it.label}</button>`).join('')}</div><button class="btn block" data-a="closeSheet">Close</button>`;
  }
  el.innerHTML = `<div class="panel ${full ? 'full' : ''}"><div class="grip"></div>${body}</div>`;
  if (sh.type === 'picker') renderExList();
}
function menu(items) { openSheet({ type: 'menu', items }); }

// ---------- toast with undo ----------
let toastTimer;
function toast(msg, undo) {
  const el = $('#toast'); clearTimeout(toastTimer);
  el.innerHTML = `<div class="grow">${esc(msg)}</div>${undo ? '<button id="undoBtn">Undo</button>' : ''}`;
  el.hidden = false;
  if (undo) $('#undoBtn').onclick = () => { el.hidden = true; undo(); };
  toastTimer = setTimeout(() => { el.hidden = true; }, undo ? 6000 : 2500);
}

// ---------- actions ----------
const A = {
  startEmpty() { startWorkout({ id: uid(), name: timeOfDayName(), start: Date.now(), ex: [] }); },
  startRoutine(el) { startRoutine(S.routines.find(r => r.id === el.dataset.id)); },
  newRoutine() { const r = { id: uid(), name: 'New routine', ex: [] }; S.routines.push(r); DB.put('routines', r); push({ v: 'editor', mode: 'routine', id: r.id }); },
  routineMenu(el) {
    const r = S.routines.find(x => x.id === el.dataset.id);
    menu([
      { label: '▶️ Start', fn: () => startRoutine(r) },
      { label: '✏️ Edit', fn: () => push({ v: 'editor', mode: 'routine', id: r.id }) },
      { label: '📄 Duplicate', fn: () => { const c = { ...clone(r), id: uid(), name: r.name + ' (copy)' }; S.routines.push(c); DB.put('routines', c); render(); } },
      { label: '🗑️ Delete', bad: true, fn: () => { S.routines = S.routines.filter(x => x !== r); DB.del('routines', r.id); render(); toast(`Deleted “${r.name}”`, () => { S.routines.push(r); DB.put('routines', r); render(); }); } },
    ]);
  },
  menuItem(el) { const it = S.sheet.items[+el.dataset.i]; closeSheet(it.fn); },
  closeSheet() { closeSheet(); },
  back() { back(); },
  finish() { finishWorkout(); },
  discard() {
    const keep = S.active; S.active = null; S.rest = null; flushActive(); renderRest(); render();
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    toast('Workout discarded', () => { S.active = keep; flushActive(); render(); });
  },
  addEx() { S.q = ''; S.grp = 0; S.exLimit = 0; openSheet({ type: 'picker' }); },
  pick(el) {
    const id = el.dataset.id;
    if (!S.sheet) { push({ v: 'exercise', id }); return; }
    const ed = curEditor(); if (!ed) return;
    const sh = S.sheet;
    if (sh.replace != null) {
      const e = ed.obj.ex[sh.replace];
      if (ed.mode === 'routine') e.eid = id; else ed.obj.ex[sh.replace] = ed.mode === 'active' ? withSuggestions(exFromPrev(id, e.sets, e.rest)) : exFromPrev(id, e.sets, e.rest);
    } else {
      const n = ed.mode === 'routine' ? { eid: id, rest: (lastSets(id) || {}).rest || S.settings.rest, sets: (lastSets(id)?.sets || [{}, {}, {}]).map(s => ({ kg: s.kg ?? null, reps: s.reps ?? null, t: s.t || 'n' })) } : ed.mode === 'active' ? withSuggestions(exFromPrev(id)) : exFromPrev(id);
      ed.obj.ex.push(n);
    }
    persist(ed.mode, ed.obj);
    closeSheet(() => { render(); if (sh.replace == null) setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 50); });
  },
  newCustom() {
    const name = S.q.trim(); if (!name) return;
    let id = slugName(name); while (S.ex.has(id)) id += '_';
    const x = { id, name, eq: 'other', pm: GROUPS[S.grp][1] ? [GROUPS[S.grp][1][0]] : [], sm: [], ins: [], custom: true };
    S.custom.push(x); DB.put('customEx', x); indexEx();
    if (S.sheet) A.pick({ dataset: { id } }); else push({ v: 'exercise', id });
  },
  customMuscle() {},
  grp(el) { S.grp = +el.dataset.i; S.exLimit = 0; document.querySelectorAll('.chip').forEach((c, i) => c.classList.toggle('on', i === S.grp)); renderExList(); },
  moreEx() { S.exLimit = (S.exLimit || 150) + 300; renderExList(); },
  moreHist() { S.histLimit = (S.histLimit || 60) + 100; render(); },
  moreExHist() { const t = topView(); t.lim = (t.lim || 15) + 50; render(); },
  openEx(el) { push({ v: 'exercise', id: el.dataset.id }); },
  openWorkout(el) { push({ v: 'workout', id: el.dataset.id }); },
  check(el) {
    const ed = curEditor(); const { ei, si } = el.closest('.setrow').dataset; const e = ed.obj.ex[ei], s = e.sets[si];
    const row = el.closest('.setrow');
    if (!s.done) {
      if (s.reps == null) { const p = lastSets(e.eid, ed.obj.id); const ps = p && p.sets[si]; if (ps) { s.reps = ps.reps; if (s.kg == null) s.kg = ps.kg; } }
      s.done = true;
      if (ed.mode === 'active') startRest(e.rest, e.eid);
    } else s.done = false;
    persist(ed.mode, ed.obj); rerenderCard(+ei);
    if (s.done && ed.mode === 'active' && isLiveRecord(ed.obj, e.eid, s)) floatRecord(document.querySelector(`.setrow[data-ei="${ei}"][data-si="${si}"]`));
  },
  delSet(el) {
    const ed = curEditor(); if (!ed) return; const { ei, si } = el.closest('.setrow').dataset; const e = ed.obj.ex[ei];
    const [removed] = e.sets.splice(+si, 1);
    persist(ed.mode, ed.obj); rerenderCard(+ei);
    toast('Set removed', () => { e.sets.splice(+si, 0, removed); persist(ed.mode, ed.obj); rerenderCard(+ei); });
  },
  addSet(el) {
    const ed = curEditor(); const e = ed.obj.ex[el.dataset.ei];
    const last = e.sets[e.sets.length - 1];
    e.sets.push({ kg: last ? last.kg : null, reps: last ? last.reps : null, t: 'n', done: false });
    persist(ed.mode, ed.obj); rerenderCard(+el.dataset.ei);
  },
  stype(el) {
    const ed = curEditor(); const { ei, si } = el.closest('.setrow').dataset; const s = ed.obj.ex[ei].sets[si];
    s.t = STYPES[(STYPES.indexOf(s.t || 'n') + 1) % STYPES.length];
    persist(ed.mode, ed.obj); rerenderCard(+ei);
  },
  restMenu(el) { openSheet({ type: 'rest', ei: +el.dataset.ei }); },
  setRest(el) {
    const ed = curEditor(); const e = ed.obj.ex[S.sheet.ei]; e.rest = +el.dataset.s;
    persist(ed.mode, ed.obj); const i = S.sheet.ei; closeSheet(() => rerenderCard(i));
  },
  exMenu(el) {
    const ed = curEditor(); const i = +el.dataset.ei; const arr = ed.obj.ex;
    const move = d => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; persist(ed.mode, ed.obj); render(); };
    menu([
      { label: '🔄 Replace exercise', fn: () => { S.q = ''; S.grp = 0; openSheet({ type: 'picker', replace: i }); } },
      { label: '⬆️ Move up', fn: () => move(-1) },
      { label: '⬇️ Move down', fn: () => move(1) },
      { label: 'ℹ️ View exercise', fn: () => push({ v: 'exercise', id: arr[i].eid }) },
      { label: `🎯 Rep range: ${repRange(arr[i].eid).join('–')}${(S.settings.ranges || {})[arr[i].eid] ? '' : ' (default)'}`, fn: () => openSheet({ type: 'range', eid: arr[i].eid, ei: i }) },
      { label: '🗑️ Remove exercise', bad: true, fn: () => { const [r] = arr.splice(i, 1); persist(ed.mode, ed.obj); render(); toast(`Removed ${exById(r.eid).name}`, () => { arr.splice(i, 0, r); persist(ed.mode, ed.obj); render(); }); } },
    ]);
  },
  'rest-15'() { adjustRest(-15); },
  'rest+15'() { adjustRest(15); },
  restSkip() { S.rest = null; DB.put('kv', null, 'rest'); renderRest(); },
  updateRoutine(el) {
    const w = S.workouts.find(x => x.id === el.dataset.id); const r = S.routines.find(x => x.id === w.routineId);
    const n = routineFromWorkout(w); r.ex = n.ex; DB.put('routines', r); topView().updated = true; render(); toast(`Routine “${r.name}” updated`);
  },
  saveAsRoutine(el) {
    const w = S.workouts.find(x => x.id === el.dataset.id);
    const r = routineFromWorkout(w); S.routines.push(r); DB.put('routines', r); w.routineId = r.id; DB.put('workouts', w);
    const t = topView(); if (t.v === 'summary') { t.saved = true; render(); }
    toast(`Saved routine “${r.name}”`);
  },
  summaryDone() { S.stack = []; S.tab = 'history'; history.back(); render(); },
  repeatWorkout(el) {
    const w = S.workouts.find(x => x.id === el.dataset.id);
    if (S.active) { toast('You already have an active workout'); return; }
    startWorkout({ id: uid(), name: w.name, start: Date.now(), routineId: w.routineId, ex: w.ex.map(e => withSuggestions(exFromPrev(e.eid, e.sets.filter(s => s.done), e.rest))) });
  },
  editWorkout(el) { push({ v: 'editor', mode: 'edit', id: el.dataset.id }); },
  workoutMenu(el) {
    const w = S.workouts.find(x => x.id === el.dataset.id);
    menu([
      { label: '💾 Save as routine', fn: () => A.saveAsRoutine({ dataset: { id: w.id } }) },
      { label: '✏️ Edit', fn: () => push({ v: 'editor', mode: 'edit', id: w.id }) },
      { label: '🗑️ Delete workout', bad: true, fn: () => {
        S.workouts = S.workouts.filter(x => x !== w); DB.del('workouts', w.id); computePRs(); back();
        toast('Workout deleted', () => { S.workouts.push(w); sortWorkouts(); DB.put('workouts', w); computePRs(); render(); });
      } },
    ]);
  },
  importStrong() { $('#fileStrong').click(); },
  importHevy() { $('#fileHevy').click(); },
  async exportHevy() { const msg = $('#importMsg'); try { msg.innerHTML = await exportHevy(); } catch (err) { msg.textContent = '❌ ' + err.message; } },
  importBackup() { $('#fileBackup').click(); },
  exportBackup() { exportBackup(); },
  mapDays(el) { S.mapDays = +el.dataset.d; render(); },
  testAlarm() { startRest(5, null); toast('Rest alarm in 5 seconds – stay on this screen'); },
  testSfx() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } playSfx(S.settings.sfx); },
  setRange(el) {
    const sh = S.sheet; S.settings.ranges = S.settings.ranges || {};
    if (el.dataset.r) S.settings.ranges[sh.eid] = el.dataset.r.split('-').map(Number); else delete S.settings.ranges[sh.eid];
    saveSettings();
    // re-suggest this exercise's untouched sets in the running workout
    const ed = curEditor();
    if (ed && ed.mode === 'active' && ed.obj.ex[sh.ei]) {
      const e = ed.obj.ex[sh.ei];
      if (e.sets.some(s => s.sg)) { e.sets = suggestSets(e.eid, e.sets.map(s => s.sg ? { ...s, sg: undefined } : s)); persist(ed.mode, ed.obj); }
    }
    closeSheet(); render();
  },
  defRange(el) { S.settings.range = el.dataset.r.split('-').map(Number); saveSettings(); render(); },
  defStep(el) { S.settings.step = +el.dataset.s; saveSettings(); render(); },
  defRest(el) { S.settings.rest = +el.dataset.s; saveSettings(); render(); },
  dlImages() { downloadImages(); },
  async wipe() {
    if (!confirm('Delete ALL workouts, routines and custom exercises on this device? This cannot be undone.')) return;
    for (const s of ['workouts', 'routines', 'customEx', 'kv']) await DB.clear(s);
    S.active = null; S.rest = null; await loadAll(); render(); toast('All data deleted');
  },
};

document.addEventListener('click', e => {
  const tabBtn = e.target.closest('#nav button');
  if (tabBtn) {
    const was = S.tab; S.tab = tabBtn.dataset.tab;
    if (S.stack.length) { const n = S.stack.length; S.stack = []; history.go(-n); }
    if (was === S.tab) window.scrollTo(0, 0);
    S.q = ''; S.grp = 0; S.exLimit = 0;
    render(); return;
  }
  if (e.target.id === 'sheet') { closeSheet(); return; }
  const el = e.target.closest('[data-a]');
  if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
  const fn = A[el.dataset.a]; if (!fn) return;
  e.stopPropagation(); fn(el);
});
// Swipe a set row left to delete it. It must pass a clear threshold (40% of the row, at least 90 px);
// a shorter swipe springs back. Undo is offered in the toast.
(() => {
  let sw = null;
  document.addEventListener('pointerdown', e => {
    const row = e.target.closest('.setrow'); if (!row || e.button > 0) return;
    sw = { row, x: e.clientX, y: e.clientY, dx: 0, on: false, w: row.offsetWidth };
  }, { passive: true });
  document.addEventListener('pointermove', e => {
    if (!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }   // vertical: let the page scroll
      if (dx < -12 && Math.abs(dx) > Math.abs(dy) * 1.5) { sw.on = true; sw.row.classList.add('dragging'); if (document.activeElement && sw.row.contains(document.activeElement)) document.activeElement.blur(); }
      else return;
    }
    sw.dx = Math.min(0, dx);
    sw.row.style.transform = `translateX(${sw.dx}px)`;
    sw.row.parentNode.classList.toggle('armed', -sw.dx >= Math.max(90, sw.w * 0.4));
  }, { passive: true });
  const end = () => {
    if (!sw) return; const { row, on, dx, w } = sw; sw = null;
    if (!on) return;
    row.classList.remove('dragging');
    // swallow the click that ends the swipe, so the tick button isn't pressed by accident
    const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => document.removeEventListener('click', stop, { capture: true }), 400);
    if (-dx >= Math.max(90, w * 0.4)) {
      row.style.transform = 'translateX(-110%)';
      setTimeout(() => A.delSet(row), 180);
    } else { row.style.transform = ''; row.parentNode.classList.remove('armed'); }
  };
  document.addEventListener('pointerup', end, { passive: true });
  document.addEventListener('pointercancel', end, { passive: true });
})();
// Drag an exercise by its handle (routine editor and active workout) to move it above or below another exercise.
// While dragging, all cards collapse to their header so the whole routine fits on screen.
(() => {
  let d = null;
  const cards = () => [...document.querySelectorAll('#main .excard')];
  const place = () => {                       // keep the lifted card under the finger
    d.card.style.transform = 'none';
    const top = d.card.getBoundingClientRect().top;
    d.card.style.transform = `translateY(${d.y - d.grab - top}px)`;
  };
  const reorder = () => {                     // move the card in the DOM to where the finger is
    const others = cards().filter(c => c !== d.card);
    const before = others.find(c => { const r = c.getBoundingClientRect(); return d.y < r.top + r.height / 2; });
    const ref = before || others[others.length - 1].nextSibling;
    if (d.card.nextSibling !== ref && d.card !== ref) d.card.parentNode.insertBefore(d.card, ref);
    place();
  };
  const tick = () => {                        // auto-scroll near the top/bottom edge
    if (!d) return;
    const head = document.querySelector('.whead'), topEdge = (head ? head.getBoundingClientRect().bottom : 0) + 50;
    const nav = document.getElementById('nav'), botEdge = (nav ? nav.getBoundingClientRect().top : innerHeight) - 50;
    const v = d.y < topEdge ? -Math.min(16, (topEdge - d.y) / 3) : d.y > botEdge ? Math.min(16, (d.y - botEdge) / 3) : 0;
    if (v) { window.scrollBy(0, v); reorder(); }
    d.raf = requestAnimationFrame(tick);
  };
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest('.draghandle'); if (!h || e.button > 0) return;
    const ed = curEditor(); if (!ed || ed.mode === 'edit' || ed.obj.ex.length < 2) return;
    e.preventDefault();
    if (document.activeElement) document.activeElement.blur();
    const card = h.closest('.excard');
    d = { card, y: e.clientY, grab: 0, id: e.pointerId, from: cards().map(c => +c.dataset.ei) };
    try { h.setPointerCapture(e.pointerId); } catch (_) {}
    document.body.classList.add('reordering'); card.classList.add('lifted');
    // after collapsing, scroll so the grabbed card sits under the finger again
    const r = card.getBoundingClientRect(); d.grab = r.height / 2;
    window.scrollBy(0, r.top + d.grab - e.clientY);
    place();
    if (navigator.vibrate) navigator.vibrate(10);
    d.raf = requestAnimationFrame(tick);
  });
  document.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    d.y = e.clientY; reorder();
  });
  const end = e => {
    if (!d || (e && e.pointerId !== d.id)) return;
    cancelAnimationFrame(d.raf);
    const { card } = d; d = null;
    const order = cards().map(c => +c.dataset.ei);
    card.style.transform = ''; card.classList.remove('lifted'); document.body.classList.remove('reordering');
    const ed = curEditor(); if (!ed) return;
    if (order.some((v, k) => v !== k)) { ed.obj.ex = order.map(k => ed.obj.ex[k]); persist(ed.mode, ed.obj); }
    render();
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
})();
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'exq') { S.q = el.value; S.exLimit = 0; renderExList(); return; }
  const f = el.dataset.f; if (!f) return;
  const ed = curEditor(); if (!ed) return;
  const row = el.closest('.setrow');
  if (row) {
    const s = ed.obj.ex[row.dataset.ei].sets[row.dataset.si];
    s[f] = f === 'reps' ? (num(el.value) == null ? null : Math.round(num(el.value))) : num(el.value);
    if (s.sg) { delete s.sg; row.querySelectorAll('input.sug').forEach(i => i.classList.remove('sug')); }
  } else if (f === 'name') ed.obj.name = el.value;
  else if (f === 'start' && el.value) { const dur = (ed.obj.end || ed.obj.start) - ed.obj.start; ed.obj.start = new Date(el.value).getTime(); ed.obj.end = ed.obj.start + dur; sortWorkouts(); }
  else if (f === 'durMin') { const m = num(el.value); if (m != null) ed.obj.end = ed.obj.start + m * 60000; }
  persist(ed.mode, ed.obj);
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.a === 'toggle') { S.settings[el.dataset.k] = el.checked; saveSettings(); if (el.dataset.k === 'wake') requestWake(); return; }
  if (el.dataset.a === 'sfx') { S.settings.sfx = el.value; saveSettings(); playSfx(el.value); clip.ok = false; buildClip(el.value).then(unlockClip); return; }
  if (el.dataset.a === 'customMuscle') { const x = S.custom.find(c => c.id === el.dataset.id); x.pm = el.value ? [el.value] : []; DB.put('customEx', x); return; }
  if (el.id === 'fileStrong' || el.id === 'fileHevy' || el.id === 'fileBackup') {
    const file = el.files[0]; if (!file) return;
    const msg = $('#importMsg'); msg.textContent = 'Importing …';
    try { const text = await file.text(); const res = el.id === 'fileStrong' ? await importStrong(text) : el.id === 'fileHevy' ? await importHevy(text) : await importBackup(text); render(); $('#importMsg').innerHTML = res; }
    catch (err) { $('#importMsg').textContent = '❌ ' + err.message; }
    el.value = '';
  }
});
document.addEventListener('focusin', e => { if (e.target.matches('.sets input')) setTimeout(() => e.target.select(), 0); });

// ---------- boot ----------
function indexEx() { S.ex = new Map(allExercises().map(x => [x.id, x])); }
async function loadAll() {
  const [w, r, c, settings, active, rest] = await Promise.all([DB.all('workouts'), DB.all('routines'), DB.all('customEx'), DB.get('kv', 'settings'), DB.get('kv', 'active'), DB.get('kv', 'rest')]);
  S.workouts = w; sortWorkouts(); S.routines = r; S.custom = c;
  if (settings) S.settings = { ...S.settings, ...settings };
  S.active = active || null; S.rest = active && rest && rest.end > Date.now() - 120000 ? rest : null;
  indexEx(); computePRs();
}
(async function boot() {
  try {
    const [lib, body] = await Promise.all([fetch('exercises.json').then(r => r.json()), fetch('bodymap.json').then(r => r.json()).catch(() => null), DB.open()]);
    BODY = body;
    S.lib = lib; await loadAll();
  } catch (e) { $('#main').innerHTML = `<p class="empty">Could not start: ${esc(e.message)}</p>`; return; }
  history.replaceState({ n: 0 }, '');
  render(); renderRest(); requestWake();
  buildClip(S.settings.sfx);
  try { diag.last = localStorage.getItem('gbDiag') || ''; } catch (e) {}
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
