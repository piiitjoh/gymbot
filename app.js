'use strict';
/* Gymbot – offline PWA. All data lives in IndexedDB on this device. */

// ---------- utils ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = v => { if (v === '' || v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const fmtKg = v => v == null ? '' : (Math.round(v * 100) / 100).toString().replace('.', ',');
const fmtNum = v => Math.round(v).toLocaleString('nb-NO');
const pad = n => String(n).padStart(2, '0');
const fmtClock = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; };
const fmtDur = s => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} t ${m % 60} min` : `${m} min`; };
const fmtDate = (t, o = {}) => new Date(t).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', ...o });
const fmtDateY = t => new Date(t).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
const e1rm = (kg, reps) => (!kg || !reps || reps > 15) ? 0 : reps === 1 ? kg : kg * (1 + reps / 30);
const setStr = s => s.kg ? `${fmtKg(s.kg)} kg × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
const clone = o => JSON.parse(JSON.stringify(o));
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

const MUSCLE = { abdominals: 'Mage', abductors: 'Abduktorer', adductors: 'Adduktorer', biceps: 'Biceps', calves: 'Legger', chest: 'Bryst', forearms: 'Underarmer', glutes: 'Sete', hamstrings: 'Hamstrings', lats: 'Lats', 'lower back': 'Korsrygg', 'middle back': 'Øvre rygg', neck: 'Nakke', quadriceps: 'Lårforside', shoulders: 'Skuldre', traps: 'Trapes', triceps: 'Triceps' };
const EQUIP = { barbell: 'Stang', dumbbell: 'Manualer', cable: 'Kabel', machine: 'Maskin', 'body only': 'Kroppsvekt', kettlebells: 'Kettlebell', bands: 'Strikk', 'e-z curl bar': 'EZ-stang', 'exercise ball': 'Ball', 'medicine ball': 'Medisinball', 'foam roll': 'Foam roller', other: 'Annet' };
const GROUPS = [
  ['Alle', null], ['Bryst', ['chest']], ['Rygg', ['lats', 'middle back', 'lower back', 'traps']], ['Skuldre', ['shoulders']],
  ['Biceps', ['biceps']], ['Triceps', ['triceps']], ['Bein', ['quadriceps', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors']],
  ['Mage', ['abdominals']], ['Underarmer', ['forearms']]
];
const STYPES = ['n', 'w', 'd', 'f'];
const REST_PRESETS = [0, 30, 45, 60, 75, 90, 100, 120, 150, 180, 240, 300];

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
  settings: { rest: 100, sound: true, vibrate: true, wake: false },
  active: null, tab: 'train', stack: [], sheet: null,
  rest: null, // {end,total,eid}
  pr: new Map(), // workoutId -> [{eid,type,val}]
  q: '', grp: 0, histFilter: '',
};

const exById = id => S.ex.get(id) || { id, name: 'Ukjent øvelse', pm: [], sm: [], eq: 'other', img: [], ins: [] };
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
      let kg = 0, rm = 0, reps = 0, vol = 0;
      for (const s of sets) { kg = Math.max(kg, s.kg || 0); rm = Math.max(rm, e1rm(s.kg, s.reps)); reps = Math.max(reps, s.reps || 0); vol += (s.kg || 0) * (s.reps || 0); }
      const b = best.get(e.eid);
      if (b) {
        if (kg > b.kg) evs.push({ eid: e.eid, type: 'kg', val: kg });
        if (rm > b.rm + 0.01) evs.push({ eid: e.eid, type: 'rm', val: rm });
        if (!kg && !b.kg && reps > b.reps) evs.push({ eid: e.eid, type: 'reps', val: reps });
        if (vol > b.vol) evs.push({ eid: e.eid, type: 'vol', val: vol });
        b.kg = Math.max(b.kg, kg); b.rm = Math.max(b.rm, rm); b.reps = Math.max(b.reps, reps); b.vol = Math.max(b.vol, vol);
      } else best.set(e.eid, { kg, rm, reps, vol });
    }
    if (evs.length) S.pr.set(w.id, evs);
  }
}
const PRLABEL = { kg: 'Tyngste vekt', rm: 'Estimert 1RM', reps: 'Flest reps', vol: 'Volum i økt' };
const prVal = p => p.type === 'reps' ? `${p.val} reps` : p.type === 'vol' ? `${fmtNum(p.val)} kg` : `${fmtKg(Math.round(p.val * 10) / 10)} kg`;

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
    const dot = b.querySelector('.dot');
    if (b.dataset.tab === 'train' && S.active && !dot) b.insertAdjacentHTML('beforeend', '<span class="dot"></span>');
    if (dot && !S.active) dot.remove();
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
  return `<h1>Trening</h1>
  <button class="btn pri block" data-a="startEmpty">＋ Start tom økt</button>
  <div class="row between"><h2>Rutiner</h2><button class="btn sm" data-a="newRoutine">＋ Ny rutine</button></div>
  ${rs.length ? rs.map(r => `
    <div class="card tap" data-a="startRoutine" data-id="${r.id}">
      <div class="row"><h3 class="grow">${esc(r.name)}</h3><button class="icon-btn" data-a="routineMenu" data-id="${r.id}">⋯</button></div>
      <div class="small mut ellip">${r.ex.map(e => esc(exById(e.eid).name)).join(' · ') || 'Ingen øvelser'}</div>
      ${lastDone(r.name) ? `<div class="tiny mut" style="margin-top:4px">Sist: ${lastDone(r.name)}</div>` : ''}
    </div>`).join('') : '<p class="mut small">Ingen rutiner ennå. Lag en, lagre en økt som rutine, eller importer fra Strong under «Mer».</p>'}`;
}
function timeOfDayName(d = new Date()) {
  const h = d.getHours();
  return h < 10 ? 'Morgenøkt' : h < 13 ? 'Formiddagsøkt' : h < 18 ? 'Ettermiddagsøkt' : 'Kveldsøkt';
}
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
  if (S.active) { toast('Du har allerede en aktiv økt'); S.tab = 'train'; S.stack = []; render(); return; }
  startWorkout({ id: uid(), name: r.name, start: Date.now(), routineId: r.id, ex: r.ex.map(e => exFromPrev(e.eid, e.sets, e.rest)) });
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
function viewEditor(t) { const o = editorObj(t.mode, t); return o ? editorHTML(o, t.mode) : '<p class="empty">Finnes ikke</p>'; }
function editorHTML(w, mode) {
  const routine = mode === 'routine';
  let head;
  if (mode === 'active') head = `<div class="whead">
      <div class="row"><input class="wname grow" data-f="name" value="${esc(w.name)}"><button class="btn ok" data-a="finish">Fullfør</button></div>
      <div class="row between small"><span class="clock" id="elapsed">0:00</span><button class="btn sm bad" data-a="discard">Avbryt økt</button></div></div>`;
  else if (mode === 'edit') {
    const d = new Date(w.start); const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    head = `<div class="whead"><div class="row"><button class="icon-btn" data-a="back">‹</button><input class="wname grow" data-f="name" value="${esc(w.name)}"><button class="btn sm pri" data-a="back">Ferdig</button></div>
      <div class="row small"><input type="datetime-local" data-f="start" value="${local}" style="flex:2"><input type="number" inputmode="numeric" data-f="durMin" value="${Math.round(((w.end || w.start) - w.start) / 60000)}" style="flex:1"><span class="mut">min</span></div></div>`;
  } else head = `<div class="whead"><div class="row"><button class="icon-btn" data-a="back">‹</button><input class="wname grow" data-f="name" value="${esc(w.name)}" placeholder="Navn på rutine"><button class="btn sm pri" data-a="back">Ferdig</button></div><div class="tiny mut">Rutine – vekt/reps er utgangspunkt. Ved start fylles verdier fra forrige gang inn.</div></div>`;
  return head + w.ex.map((e, i) => exCardHTML(w, e, i, mode)).join('') +
    `<button class="btn pri block" data-a="addEx">＋ Legg til øvelse</button>` +
    (mode === 'active' && w.ex.length ? `<button class="btn ok block" data-a="finish">Fullfør økt</button>` : '');
}
function exCardHTML(w, e, i, mode) {
  const x = exById(e.eid), routine = mode === 'routine';
  const prev = mode === 'routine' ? null : lastSets(e.eid, w.id);
  let n = 0;
  const rows = e.sets.map((s, j) => {
    const lbl = s.t === 'n' || !s.t ? ++n : s.t.toUpperCase();
    const p = prev && prev.sets[j];
    return `<div class="setrow ${s.done ? 'done' : ''}" data-ei="${i}" data-si="${j}">
      <button class="stype ${s.t || 'n'}" data-a="stype">${lbl}</button>
      <div class="prev">${routine ? '' : p ? esc(setStr(p)) : '–'}</div>
      <input inputmode="decimal" data-f="kg" value="${s.kg ? fmtKg(s.kg) : ''}" placeholder="kg">
      <input inputmode="numeric" data-f="reps" value="${s.reps ?? ''}" placeholder="reps">
      ${routine ? '' : `<button class="chk" data-a="check">✓</button>`}
      <button class="del" data-a="delSet">×</button></div>`;
  }).join('');
  return `<div class="excard" data-ei="${i}">
    <div class="exhead">${thumbHTML(x, 'thumb')}<div class="grow"><div class="exname ellip" data-a="openEx" data-id="${x.id}">${esc(x.name)}</div></div>
      <button class="restchip" data-a="restMenu" data-ei="${i}">⏱ ${e.rest ? fmtClock(e.rest) : 'av'}</button>
      <button class="icon-btn" data-a="exMenu" data-ei="${i}">⋯</button></div>
    <div class="sets ${routine ? 'routine' : ''}">
      <div class="hd">Sett</div><div class="hd l">${routine ? '' : 'Forrige'}</div><div class="hd">kg</div><div class="hd">Reps</div>${routine ? '' : '<div class="hd">✓</div>'}<div></div>
      ${rows}
    </div>
    <div class="exfoot"><button class="btn sm" data-a="addSet" data-ei="${i}">＋ Sett</button></div>
  </div>`;
}
function thumbHTML(x, cls) {
  if (x.img && x.img.length) return `<img class="${cls}" loading="lazy" src="img/${x.img[0]}" alt="" onerror="this.outerHTML='<div class=&quot;${cls} none&quot;>${esc(x.name[0] || '?')}</div>'">`;
  return `<div class="${cls} none">${esc((x.name || '?')[0])}</div>`;
}
function rerenderCard(i) {
  const ed = curEditor(); if (!ed) return;
  const el = document.querySelector(`.excard[data-ei="${i}"]`);
  if (el) el.outerHTML = exCardHTML(ed.obj, ed.obj.ex[i], i, ed.mode);
}

// ---------- rest timer ----------
let audioCtx = null;
document.addEventListener('pointerdown', () => { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } else if (audioCtx.state === 'suspended') audioCtx.resume(); }, { passive: true });
function beep() {
  if (S.settings.vibrate && navigator.vibrate) navigator.vibrate([250, 120, 250]);
  if (!S.settings.sound || !audioCtx) return;
  [0, 0.25, 0.5].forEach(t => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
    const s = audioCtx.currentTime + t; g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.4, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.18);
    o.start(s); o.stop(s + 0.2);
  });
}
function startRest(sec, eid) {
  if (!sec) { S.rest = null; renderRest(); return; }
  S.rest = { end: Date.now() + sec * 1000, total: sec, eid, beeped: false }; DB.put('kv', S.rest, 'rest'); renderRest();
}
function adjustRest(d) {
  if (!S.rest) return; S.rest.end += d * 1000; S.rest.total = Math.max(1, S.rest.total + d);
  if (S.rest.end > Date.now()) S.rest.beeped = false; DB.put('kv', S.rest, 'rest'); tick();
}
function renderRest() {
  const bar = $('#restbar');
  if (!S.rest || !S.active) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = `<div class="prog"></div><div class="row" style="position:relative">
    <div class="t" id="restT"></div><div class="grow tiny mut ellip">${esc(exById(S.rest.eid).name)}</div>
    <button class="btn" data-a="rest-15">−15</button><button class="btn" data-a="rest+15">+15</button><button class="btn" data-a="restSkip">Ferdig</button></div>`;
  tick();
}
function tick() {
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
    toast('Ingen fullførte sett – økta ble forkastet', () => { S.active = keep; flushActive(); render(); });
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
  return `<h1>Bra jobba! 💪</h1>
  <div class="card"><h3>${esc(w.name)}</h3><div class="small mut">${fmtDate(w.start)} · ${fmtDur((w.end - w.start) / 1000)}</div>
   <div class="stats" style="margin-top:10px"><div class="stat"><div class="v">${sets}</div><div class="l">Sett</div></div><div class="stat"><div class="v">${fmtNum(vol)} kg</div><div class="l">Volum</div></div></div></div>
  ${prs.length ? `<h2>🏆 Nye rekorder</h2><div class="card">${prs.map(p => `<div class="row between" style="padding:4px 0"><span>${esc(exById(p.eid).name)}<br><span class="tiny mut">${PRLABEL[p.type]}</span></span><span class="badge">${prVal(p)}</span></div>`).join('')}</div>` : ''}
  ${r && routineDiffers(r, w) && !t.updated ? `<button class="btn block" data-a="updateRoutine" data-id="${w.id}">Oppdater rutinen «${esc(r.name)}» med denne økta</button>` : ''}
  ${!r && !t.saved ? `<button class="btn block" data-a="saveAsRoutine" data-id="${w.id}">Lagre som rutine</button>` : ''}
  <button class="btn pri block" data-a="summaryDone">Ferdig</button>`;
}

// ---------- HISTORY ----------
function workoutVol(w) { return w.ex.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.done && s.t !== 'w' ? (s.kg || 0) * (s.reps || 0) : 0), 0), 0); }
function viewHistory() {
  if (!S.workouts.length) return `<h1>Historikk</h1><p class="empty">Ingen økter ennå.<br>Importer fra Strong under «Mer».</p>`;
  let html = `<h1>Historikk</h1><div class="small mut" style="margin-bottom:8px">${S.workouts.length} økter</div>`, month = '';
  for (const w of S.workouts.slice(0, S.histLimit || 60)) {
    const m = new Date(w.start).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' });
    if (m !== month) { month = m; html += `<h2 style="text-transform:capitalize">${m}</h2>`; }
    const prs = (S.pr.get(w.id) || []).length;
    html += `<div class="card tap" data-a="openWorkout" data-id="${w.id}">
      <div class="row"><h3 class="grow">${esc(w.name)}</h3>${prs ? `<span class="badge">🏆 ${prs}</span>` : ''}</div>
      <div class="tiny mut">${fmtDate(w.start)} · ${fmtDur(((w.end || w.start) - w.start) / 1000)} · ${fmtNum(workoutVol(w))} kg</div>
      <div class="small" style="margin-top:6px">${w.ex.map(e => `<div class="ellip">${e.sets.filter(s => s.done).length} × ${esc(exById(e.eid).name)}</div>`).join('')}</div></div>`;
  }
  if (S.workouts.length > (S.histLimit || 60)) html += `<button class="btn block" data-a="moreHist">Vis flere</button>`;
  return html;
}
function viewWorkout(t) {
  const w = S.workouts.find(x => x.id === t.id); if (!w) return '<p class="empty">Økta er slettet</p>';
  const prs = S.pr.get(w.id) || [];
  return `<div class="vhead"><button class="icon-btn" data-a="back">‹</button><h1 class="ellip">${esc(w.name)}</h1><button class="icon-btn" data-a="workoutMenu" data-id="${w.id}">⋯</button></div>
   <div class="small mut">${fmtDate(w.start, { year: 'numeric' })} kl. ${new Date(w.start).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })} · ${fmtDur(((w.end || w.start) - w.start) / 1000)} · ${fmtNum(workoutVol(w))} kg</div>
   <div class="row" style="margin:10px 0"><button class="btn pri grow" data-a="repeatWorkout" data-id="${w.id}">Gjenta økta</button><button class="btn" data-a="editWorkout" data-id="${w.id}">Rediger</button></div>
   ${w.ex.map(e => {
     const x = exById(e.eid); let n = 0;
     return `<div class="card"><div class="row" data-a="openEx" data-id="${x.id}">${thumbHTML(x, 'thumb')}<h3 class="grow" style="color:var(--acc)">${esc(x.name)}</h3></div>
     <div style="margin-top:6px">${e.sets.filter(s => s.done).map(s => {
       const lbl = s.t && s.t !== 'n' ? s.t.toUpperCase() : ++n;
       const isPr = prs.some(p => p.eid === e.eid && ((p.type === 'kg' && p.val === s.kg) || (p.type === 'rm' && Math.abs(p.val - e1rm(s.kg, s.reps)) < 0.01)));
       return `<div class="row hset"><span class="mut" style="width:22px">${lbl}</span><span class="grow">${setStr(s)}</span>${isPr ? '<span class="pr">🏆 PR</span>' : ''}</div>`;
     }).join('')}</div></div>`;
   }).join('')}`;
}

// ---------- EXERCISES ----------
function viewExercises() {
  return `<h1>Øvelser</h1>${exListShell('open')}`;
}
function exListShell(mode) {
  return `<div class="search"><input type="search" id="exq" placeholder="Søk i ${S.lib.length + S.custom.length} øvelser" value="${esc(S.q)}" autocomplete="off">
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
  const item = x => `<div class="li" data-a="pick" data-id="${x.id}">${thumbHTML(x, 'thumb')}<div class="grow"><div class="ellip">${esc(x.name)}</div><div class="tiny mut ellip">${x.pm.map(m => MUSCLE[m] || m).join(', ')}${x.pm.length ? ' · ' : ''}${EQUIP[x.eq] || x.eq}${use.get(x.id) ? ` · ${use.get(x.id)} økter` : ''}</div></div></div>`;
  let html = '';
  if (q) html += `<button class="btn block" data-a="newCustom">＋ Lag egen øvelse «${esc(S.q.trim())}»</button>`;
  if (mine.length) html += `<h2>Mine øvelser</h2>` + mine.map(item).join('');
  if (rest.length) html += `<h2>${mine.length ? 'Alle andre' : 'Alle øvelser'}</h2>` + rest.slice(0, S.exLimit || 150).map(item).join('');
  if (rest.length > (S.exLimit || 150)) html += `<button class="btn block" data-a="moreEx">Vis flere (${rest.length - (S.exLimit || 150)})</button>`;
  if (!list.length) html += `<p class="empty">Ingen treff</p>`;
  box.innerHTML = html;
}
function viewExercise(t) {
  const x = exById(t.id), st = exStats(x.id);
  const imgs = x.img && x.img.length ? `<div class="anim">${x.img.slice(0, 2).map(p => `<img src="img/${p}" alt="" onerror="this.remove()">`).join('')}</div>` : '';
  const recs = st.n ? (st.bw ? `
     <div class="stat"><div class="v">${st.reps}</div><div class="l">Flest reps i ett sett</div></div>
     <div class="stat"><div class="v">${st.totalReps}</div><div class="l">Flest reps i én økt</div></div>` : `
     <div class="stat"><div class="v">${fmtKg(Math.round(st.rm * 10) / 10)} kg</div><div class="l">Estimert 1RM${st.rmSet ? ` (${setStr(st.rmSet)})` : ''}</div></div>
     <div class="stat"><div class="v">${fmtKg(st.kg)} kg</div><div class="l">Tyngste vekt</div></div>
     <div class="stat"><div class="v">${st.reps}</div><div class="l">Flest reps i ett sett</div></div>
     <div class="stat"><div class="v">${fmtNum(st.vol)} kg</div><div class="l">Mest volum i én økt</div></div>`) : '';
  const rrKeys = Object.keys(st.rr).map(Number).sort((a, b) => a - b);
  const chartData = [...st.sessions].reverse().map(s => ({ t: s.w.start, v: st.bw ? s.reps : Math.round(s.rm * 10) / 10 })).filter(p => p.v > 0);
  const lim = t.lim || 15;
  return `<div class="vhead"><button class="icon-btn" data-a="back">‹</button><h1 class="ellip">${esc(x.name)}</h1></div>
   ${imgs}
   <div class="small mut">${x.pm.map(m => MUSCLE[m] || m).join(', ') || 'Ukjent muskelgruppe'}${x.sm && x.sm.length ? ` (+ ${x.sm.map(m => MUSCLE[m] || m).join(', ')})` : ''} · ${EQUIP[x.eq] || x.eq}${x.ref && x.ref !== x.name ? `<br>Illustrasjon: ${esc(x.ref)}` : ''}</div>
   ${x.custom ? `<div class="row" style="margin-top:8px"><select data-a="customMuscle" data-id="${x.id}">${['', ...Object.keys(MUSCLE)].map(m => `<option value="${m}" ${x.pm[0] === m ? 'selected' : ''}>${m ? MUSCLE[m] : 'Velg muskelgruppe'}</option>`).join('')}</select></div>` : ''}
   ${st.n ? `<h2>Rekorder</h2><div class="stats">${recs}</div>
     <h2>${st.bw ? 'Beste reps per økt' : 'Estimert 1RM over tid'}</h2>${chartHTML(chartData)}` : '<p class="mut small" style="margin-top:14px">Ingen loggførte sett ennå.</p>'}
   ${rrKeys.length ? `<h2>Rep-rekorder</h2><table class="rr"><tr><th>Reps</th><th>Beste vekt</th><th>Dato</th></tr>${rrKeys.map(k => `<tr><td>${k}</td><td>${fmtKg(st.rr[k].kg)} kg</td><td class="mut">${fmtDateY(st.rr[k].date)}</td></tr>`).join('')}</table>` : ''}
   ${x.ins && x.ins.length ? `<h2>Utførelse</h2><ol class="ins small">${x.ins.map(i => `<li>${esc(i)}</li>`).join('')}</ol>` : ''}
   ${st.n ? `<h2>Historikk (${st.n} økter)</h2>${st.sessions.slice(0, lim).map(s => `<div class="card tap" data-a="openWorkout" data-id="${s.w.id}"><div class="row between"><b class="small">${fmtDate(s.w.start, { year: 'numeric' })}</b><span class="tiny mut">${esc(s.w.name)}</span></div>
      <div class="hset" style="margin-top:4px">${s.sets.map(z => `<span style="display:inline-block;margin-right:12px">${z.t && z.t !== 'n' ? `<span class="mut">${z.t.toUpperCase()}</span> ` : ''}${setStr(z)}</span>`).join('')}</div></div>`).join('')}
      ${st.n > lim ? `<button class="btn block" data-a="moreExHist">Vis flere</button>` : ''}` : ''}`;
}
function chartHTML(d) {
  if (d.length < 2) return '<p class="mut small">For lite data til graf.</p>';
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
  if (!per.length) return `<h1>Rekorder</h1><p class="empty">Ingen rekorder ennå.</p>`;
  return `<h1>Rekorder</h1>
   ${events.length ? `<h2>Siste rekorder</h2><div class="card">${events.slice(0, 12).map(e => `<div class="row tap" style="padding:6px 0" data-a="openEx" data-id="${e.eid}"><div class="grow"><div class="ellip">${esc(exById(e.eid).name)}</div><div class="tiny mut">${PRLABEL[e.type]} · ${fmtDate(e.w.start)}</div></div><span class="badge">${prVal(e)}</span></div>`).join('')}</div>` : ''}
   <h2>Per øvelse</h2>
   ${per.map(({ x, st }) => `<div class="li" data-a="openEx" data-id="${x.id}">${thumbHTML(x, 'thumb')}<div class="grow"><div class="ellip">${esc(x.name)}</div>
     <div class="tiny mut">${st.bw ? `Flest reps: ${st.reps} · Mest i én økt: ${st.totalReps}` : `1RM ≈ ${fmtKg(Math.round(st.rm * 10) / 10)} kg · Tyngst: ${fmtKg(st.kg)} kg · ${st.rmSet ? setStr(st.rmSet) : ''}`}</div></div></div>`).join('')}`;
}

// ---------- MORE / settings ----------
function viewMore() {
  const st = S.settings;
  return `<h1>Mer</h1>
  <h2>Import og backup</h2>
  <div class="card">
    <button class="btn block" data-a="importStrong">📥 Importer fra Strong (CSV)</button>
    <button class="btn block" data-a="exportBackup">💾 Eksporter backup (JSON)</button>
    <button class="btn block" data-a="importBackup">♻️ Gjenopprett backup</button>
    <div class="tiny mut">Data lagres kun på denne enheten. Ta backup jevnlig – sletter du appen eller nettleserdata, forsvinner historikken.</div>
    <div id="importMsg" class="small" style="margin-top:8px"></div>
  </div>
  <h2>Hviletimer</h2>
  <div class="card">
    <div class="small mut" style="margin-bottom:6px">Standard hviletid for nye øvelser</div>
    <div class="grid3">${REST_PRESETS.filter(Boolean).map(s => `<button class="btn sm ${st.rest === s ? 'on' : ''}" data-a="defRest" data-s="${s}">${fmtClock(s)}</button>`).join('')}</div>
    <label class="set"><span>Lydsignal</span><input type="checkbox" data-a="toggle" data-k="sound" ${st.sound ? 'checked' : ''}></label>
    <label class="set"><span>Vibrasjon (Android)</span><input type="checkbox" data-a="toggle" data-k="vibrate" ${st.vibrate ? 'checked' : ''}></label>
    <label class="set" style="border:0"><span>Hold skjermen på under økt</span><input type="checkbox" data-a="toggle" data-k="wake" ${st.wake ? 'checked' : ''}></label>
  </div>
  <h2>Offline</h2>
  <div class="card">
    <div class="small">Bilder av dine egne øvelser lagres automatisk. Andre bilder lagres når du åpner dem – eller last ned alle (~16 MB).</div>
    <button class="btn block" data-a="dlImages">⬇️ Last ned alle øvelsesbilder</button>
    <div class="progress" id="dlProg" hidden><div></div></div><div id="dlMsg" class="tiny mut"></div>
  </div>
  <h2>Data</h2>
  <div class="card small">
    <div>${S.workouts.length} økter · ${S.routines.length} rutiner · ${S.custom.length} egne øvelser</div>
    <button class="btn block bad" data-a="wipe">Slett alle data</button>
  </div>
  <p class="tiny mut">Øvelsesbilder og -beskrivelser: free-exercise-db (public domain).</p>
  <input type="file" id="fileStrong" accept=".csv,text/csv,text/plain" hidden>
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
  if (!rows.length || !('Exercise Name' in rows[0])) throw new Error('Fant ikke Strong-kolonner (Exercise Name, Set Order …)');
  const wKey = Object.keys(rows[0]).find(k => /^Weight/i.test(k));
  const lbs = wKey && /lb/i.test(wKey);
  const byName = new Map(allExercises().map(x => [x.name.toLowerCase(), x]));
  const newCustom = [];
  const resolve = name => {
    const k = name.trim().toLowerCase(); let x = byName.get(k);
    if (!x) { x = { id: slugName(name), name: name.trim(), eq: 'other', pm: [], sm: [], img: [], ins: [], custom: true }; byName.set(k, x); newCustom.push(x); }
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
      w = { id: 'strong-' + r['Date'].replace(/\D/g, ''), name: r['Workout Name'] || 'Økt', start, end: start + dur * 1000, src: 'strong', notes: r['Workout Notes'] || '', ex: [] };
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
  return `✅ ${list.length} økter lest (${added.length} nye), ${setsN} sett. ${newCustom.length ? `${newCustom.length} egne øvelser opprettet. ` : ''}${newRoutines.length ? `Rutiner laget: ${newRoutines.map(r => esc(r.name)).join(', ')}.` : ''}`;
}

// ---------- backup ----------
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
  if (!['gymbot', 'treningslogg'].includes(d.app)) throw new Error('Ikke en backup fra Gymbot');
  await DB.putMany('workouts', d.workouts || []); await DB.putMany('routines', d.routines || []); await DB.putMany('customEx', d.custom || []);
  if (d.settings) { S.settings = { ...S.settings, ...d.settings }; saveSettings(); }
  await loadAll();
  return `✅ Gjenopprettet ${d.workouts.length} økter og ${d.routines.length} rutiner.`;
}

// ---------- image download ----------
async function downloadImages() {
  const msg = $('#dlMsg'), prog = $('#dlProg');
  if (!('caches' in window)) { msg.textContent = 'Nettleseren støtter ikke offline-lagring.'; return; }
  const list = await (await fetch('images.json')).json();
  const cache = await caches.open('img-v1');
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
  msg.textContent = fail ? `Ferdig, ${fail} feilet – prøv igjen med nett.` : 'Alle bilder er lagret offline ✅';
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
    body = `<div class="row between"><h2 style="margin:0">${sh.replace != null ? 'Bytt øvelse' : 'Legg til øvelse'}</h2><button class="btn sm" data-a="closeSheet">Lukk</button></div>${exListShell('pick')}`;
  } else if (sh.type === 'rest') {
    const ed = curEditor(); const cur = ed && ed.obj.ex[sh.ei] && ed.obj.ex[sh.ei].rest;
    body = `<h2 style="margin-top:0">Hviletid – ${esc(exById(ed.obj.ex[sh.ei].eid).name)}</h2><div class="grid3">${REST_PRESETS.map(s => `<button class="btn ${cur === s ? 'on' : ''}" data-a="setRest" data-s="${s}">${s ? fmtClock(s) : 'Av'}</button>`).join('')}</div>`;
  } else if (sh.type === 'menu') {
    body = `<div class="menu">${sh.items.map((it, i) => `<button class="${it.bad ? 'bad' : ''}" data-a="menuItem" data-i="${i}">${it.label}</button>`).join('')}</div><button class="btn block" data-a="closeSheet">Lukk</button>`;
  }
  el.innerHTML = `<div class="panel ${full ? 'full' : ''}"><div class="grip"></div>${body}</div>`;
  if (sh.type === 'picker') renderExList();
}
function menu(items) { openSheet({ type: 'menu', items }); }

// ---------- toast with undo ----------
let toastTimer;
function toast(msg, undo) {
  const el = $('#toast'); clearTimeout(toastTimer);
  el.innerHTML = `<div class="grow">${esc(msg)}</div>${undo ? '<button id="undoBtn">Angre</button>' : ''}`;
  el.hidden = false;
  if (undo) $('#undoBtn').onclick = () => { el.hidden = true; undo(); };
  toastTimer = setTimeout(() => { el.hidden = true; }, undo ? 6000 : 2500);
}

// ---------- actions ----------
const A = {
  startEmpty() { startWorkout({ id: uid(), name: timeOfDayName(), start: Date.now(), ex: [] }); },
  startRoutine(el) { startRoutine(S.routines.find(r => r.id === el.dataset.id)); },
  newRoutine() { const r = { id: uid(), name: 'Ny rutine', ex: [] }; S.routines.push(r); DB.put('routines', r); push({ v: 'editor', mode: 'routine', id: r.id }); },
  routineMenu(el) {
    const r = S.routines.find(x => x.id === el.dataset.id);
    menu([
      { label: '▶️ Start', fn: () => startRoutine(r) },
      { label: '✏️ Rediger', fn: () => push({ v: 'editor', mode: 'routine', id: r.id }) },
      { label: '📄 Dupliser', fn: () => { const c = { ...clone(r), id: uid(), name: r.name + ' (kopi)' }; S.routines.push(c); DB.put('routines', c); render(); } },
      { label: '🗑️ Slett', bad: true, fn: () => { S.routines = S.routines.filter(x => x !== r); DB.del('routines', r.id); render(); toast(`Slettet «${r.name}»`, () => { S.routines.push(r); DB.put('routines', r); render(); }); } },
    ]);
  },
  menuItem(el) { const it = S.sheet.items[+el.dataset.i]; closeSheet(it.fn); },
  closeSheet() { closeSheet(); },
  back() { back(); },
  finish() { finishWorkout(); },
  discard() {
    const keep = S.active; S.active = null; S.rest = null; flushActive(); renderRest(); render();
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    toast('Økta ble forkastet', () => { S.active = keep; flushActive(); render(); });
  },
  addEx() { S.q = ''; S.grp = 0; S.exLimit = 0; openSheet({ type: 'picker' }); },
  pick(el) {
    const id = el.dataset.id;
    if (!S.sheet) { push({ v: 'exercise', id }); return; }
    const ed = curEditor(); if (!ed) return;
    const sh = S.sheet;
    if (sh.replace != null) {
      const e = ed.obj.ex[sh.replace];
      if (ed.mode === 'routine') e.eid = id; else ed.obj.ex[sh.replace] = exFromPrev(id, e.sets, e.rest);
    } else {
      const n = ed.mode === 'routine' ? { eid: id, rest: (lastSets(id) || {}).rest || S.settings.rest, sets: (lastSets(id)?.sets || [{}, {}, {}]).map(s => ({ kg: s.kg ?? null, reps: s.reps ?? null, t: s.t || 'n' })) } : exFromPrev(id);
      ed.obj.ex.push(n);
    }
    persist(ed.mode, ed.obj);
    closeSheet(() => { render(); if (sh.replace == null) setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 50); });
  },
  newCustom() {
    const name = S.q.trim(); if (!name) return;
    let id = slugName(name); while (S.ex.has(id)) id += '_';
    const x = { id, name, eq: 'other', pm: GROUPS[S.grp][1] ? [GROUPS[S.grp][1][0]] : [], sm: [], img: [], ins: [], custom: true };
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
  },
  delSet(el) {
    const ed = curEditor(); const { ei, si } = el.closest('.setrow').dataset; const e = ed.obj.ex[ei];
    const [removed] = e.sets.splice(+si, 1);
    persist(ed.mode, ed.obj); rerenderCard(+ei);
    toast('Sett fjernet', () => { e.sets.splice(+si, 0, removed); persist(ed.mode, ed.obj); rerenderCard(+ei); });
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
      { label: '🔄 Bytt øvelse', fn: () => { S.q = ''; S.grp = 0; openSheet({ type: 'picker', replace: i }); } },
      { label: '⬆️ Flytt opp', fn: () => move(-1) },
      { label: '⬇️ Flytt ned', fn: () => move(1) },
      { label: 'ℹ️ Vis øvelse', fn: () => push({ v: 'exercise', id: arr[i].eid }) },
      { label: '🗑️ Fjern øvelse', bad: true, fn: () => { const [r] = arr.splice(i, 1); persist(ed.mode, ed.obj); render(); toast(`Fjernet ${exById(r.eid).name}`, () => { arr.splice(i, 0, r); persist(ed.mode, ed.obj); render(); }); } },
    ]);
  },
  'rest-15'() { adjustRest(-15); },
  'rest+15'() { adjustRest(15); },
  restSkip() { S.rest = null; DB.put('kv', null, 'rest'); renderRest(); },
  updateRoutine(el) {
    const w = S.workouts.find(x => x.id === el.dataset.id); const r = S.routines.find(x => x.id === w.routineId);
    const n = routineFromWorkout(w); r.ex = n.ex; DB.put('routines', r); topView().updated = true; render(); toast(`Rutinen «${r.name}» er oppdatert`);
  },
  saveAsRoutine(el) {
    const w = S.workouts.find(x => x.id === el.dataset.id);
    const r = routineFromWorkout(w); S.routines.push(r); DB.put('routines', r); w.routineId = r.id; DB.put('workouts', w);
    const t = topView(); if (t.v === 'summary') { t.saved = true; render(); }
    toast(`Lagret rutinen «${r.name}»`);
  },
  summaryDone() { S.stack = []; S.tab = 'history'; history.back(); render(); },
  repeatWorkout(el) {
    const w = S.workouts.find(x => x.id === el.dataset.id);
    if (S.active) { toast('Du har allerede en aktiv økt'); return; }
    startWorkout({ id: uid(), name: w.name, start: Date.now(), routineId: w.routineId, ex: w.ex.map(e => exFromPrev(e.eid, e.sets.filter(s => s.done), e.rest)) });
  },
  editWorkout(el) { push({ v: 'editor', mode: 'edit', id: el.dataset.id }); },
  workoutMenu(el) {
    const w = S.workouts.find(x => x.id === el.dataset.id);
    menu([
      { label: '💾 Lagre som rutine', fn: () => A.saveAsRoutine({ dataset: { id: w.id } }) },
      { label: '✏️ Rediger', fn: () => push({ v: 'editor', mode: 'edit', id: w.id }) },
      { label: '🗑️ Slett økt', bad: true, fn: () => {
        S.workouts = S.workouts.filter(x => x !== w); DB.del('workouts', w.id); computePRs(); back();
        toast('Økta ble slettet', () => { S.workouts.push(w); sortWorkouts(); DB.put('workouts', w); computePRs(); render(); });
      } },
    ]);
  },
  importStrong() { $('#fileStrong').click(); },
  importBackup() { $('#fileBackup').click(); },
  exportBackup() { exportBackup(); },
  defRest(el) { S.settings.rest = +el.dataset.s; saveSettings(); render(); },
  dlImages() { downloadImages(); },
  async wipe() {
    if (!confirm('Slette ALLE økter, rutiner og egne øvelser på denne enheten? Dette kan ikke angres.')) return;
    for (const s of ['workouts', 'routines', 'customEx', 'kv']) await DB.clear(s);
    S.active = null; S.rest = null; await loadAll(); render(); toast('Alle data slettet');
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
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'exq') { S.q = el.value; S.exLimit = 0; renderExList(); return; }
  const f = el.dataset.f; if (!f) return;
  const ed = curEditor(); if (!ed) return;
  const row = el.closest('.setrow');
  if (row) {
    const s = ed.obj.ex[row.dataset.ei].sets[row.dataset.si];
    s[f] = f === 'reps' ? (num(el.value) == null ? null : Math.round(num(el.value))) : num(el.value);
  } else if (f === 'name') ed.obj.name = el.value;
  else if (f === 'start' && el.value) { const dur = (ed.obj.end || ed.obj.start) - ed.obj.start; ed.obj.start = new Date(el.value).getTime(); ed.obj.end = ed.obj.start + dur; sortWorkouts(); }
  else if (f === 'durMin') { const m = num(el.value); if (m != null) ed.obj.end = ed.obj.start + m * 60000; }
  persist(ed.mode, ed.obj);
});
document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset.a === 'toggle') { S.settings[el.dataset.k] = el.checked; saveSettings(); if (el.dataset.k === 'wake') requestWake(); return; }
  if (el.dataset.a === 'customMuscle') { const x = S.custom.find(c => c.id === el.dataset.id); x.pm = el.value ? [el.value] : []; DB.put('customEx', x); return; }
  if (el.id === 'fileStrong' || el.id === 'fileBackup') {
    const file = el.files[0]; if (!file) return;
    const msg = $('#importMsg'); msg.textContent = 'Importerer …';
    try { const text = await file.text(); const res = el.id === 'fileStrong' ? await importStrong(text) : await importBackup(text); render(); $('#importMsg').innerHTML = res; }
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
    const [lib] = await Promise.all([fetch('exercises.json').then(r => r.json()), DB.open()]);
    S.lib = lib; await loadAll();
  } catch (e) { $('#main').innerHTML = `<p class="empty">Kunne ikke starte: ${esc(e.message)}</p>`; return; }
  history.replaceState({ n: 0 }, '');
  render(); renderRest(); requestWake();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
