// TILEO KINGDOM: Strip Life, playable prototype (Three.js, no build step)
import * as THREE from 'three';
import { T, buildTextures, nightFx, PI, G, logoReady, logoMaterial, TODS } from './core.js?v=1794015301';
import { Q, initQuality, setMode, TIERS } from './quality.js?v=1794015301';
import { createGfx, LOOK } from './gfx.js?v=1794015301';
import { createAmbience } from './ambience.js?v=1794015301';
import { createMusic, SONGS, LISTS, STATIONS, station } from './music.js?v=1794015301';
import { initCasino } from './casino.js?v=1794015301';
import { initNet } from './net.js?v=1794015301';
import { initCompanion } from './companion.js?v=1794015301';
import { makeCharacter, applyLook, animate, makeCar, BAND_C, STYLES, HAIRSTYLES, HAIR_NAMES, EMOTES, CHAR, rigReady, rigStatus, syncCharacters, PEOPLE, FACES, peopleReady, setPeople } from './characters.js?v=1794015301';
import { FACE_NAMES, GLASSES, faceFor } from './people.js?v=1794015301';
import { PEOPLE_BASES } from './people_data.js?v=1794015301';
import { buildStrip, updateWaters } from './world.js?v=1794015301';
import { buildNeedle, NX as NEEDLE_X, NZ as NEEDLE_Z } from './needle.js?v=1794015301';
import { buildLimo } from './limo.js?v=1794015301';
import { initPhoto } from './photo.js?v=1794015301';
import { buildLobby, buildPool, buildRooms, buildRoom, buildClub, SKYLINE_CREDITS } from './interiors.js?v=1794015301';
import { buildAirport, AIRPORT_DOOR } from './airport.js?v=1794015301';
import { createArrival } from './arrival.js?v=1794015301';

const $ = id => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; if (isTouch) document.body.classList.add('touch');
let SAVE_KEY = 'tileoKingdom.proto.v1';
// v7: "Epic or Fail: Vegas Trip" story mode. Free Play is the default; the trip loads from trip/ only when picked on the 18+ gate (or ?mode=trip)
// and keeps its own save (TRIP_KEY), so Free Play coins, outfits and the TILEO account are never touched during a trip.
const TRIP_KEY = 'tileoKingdom.trip.v1', URL_TRIP = new URLSearchParams(location.search).get('mode') === 'trip';
let MODE = 'free', trip = null;
const save =Object.assign({ coins: 1000, owned: ['solid'], room: null, bonusDay: '', look: { name: 'Guest', skin: '#d9a47c', hair: '#1a1209', outfit: '#c9932e', style: 'solid', hairLong: false, banded: false, body: 'f', hairStyle: 'long', beard: false } }, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'));
// v3 migration: older saves have no body type / hair style
save.look = Object.assign({ body: 'f', beard: false }, save.look); if (!save.look.hairStyle || !HAIRSTYLES[save.look.body].includes(save.look.hairStyle)) save.look.hairStyle = save.look.hairLong ? 'long' : HAIRSTYLES[save.look.body][0];
const PREF_KEY = 'tileoKingdom.prefs.v3'; const prefs = Object.assign({ mini: true, fp: false, ng: true, people: true }, JSON.parse(localStorage.getItem(PREF_KEY) || '{}'));
prefs.vol = Object.assign({ music: 0.7, amb: 0.35, fx: 0.7 }, prefs.vol || {}); /* Settings → Sound (v6.3: city ambience much quieter by default) */ const savePrefs = () => localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
let net = null; // v6.2 online (website build only)
const persist = () => { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); if (net && MODE !== 'trip') net.saveSoon(); };

// ---------- renderer / scene ----------
initQuality();
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.tier.pr)); renderer.setSize(innerWidth, innerHeight);
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.25, Q.tier.far);
scene.fog = new THREE.Fog(0x0a0820, 300, 1600);
LOOK.ng = prefs.ng !== false; PEOPLE.on = prefs.people !== false;
const GLOW = { soft: [0.65, 0.45], full: [1, 1], off: [0.22, 0] }; // [bloom, sun flare] per Settings → Glow & lens flare
const applyGlow = () => { const v = GLOW[prefs.glow] || GLOW.soft; LOOK.glow = v[0]; LOOK.glare = v[1]; };
applyGlow();
const gfx = createGfx(renderer, scene, camera);
gfx.st.onSlow = () => toast('Lighter effects: contact shadows turned off to keep the game smooth.');
addEventListener('resize', () => gfx.resize());
buildTextures();

// ---------- areas ----------
const areas = {};
function defArea(id, o) { const g = new THREE.Group(); g.visible = false; scene.add(g); return areas[id] = Object.assign({ id, group: g, rects: [], aabbs: [], interacts: [], anim: [], water: [], outdoor: false, ceiling: null }, o); }
const ctx = { save, toast, checkIn, openShop, openSlots, openElevator, exitToStrip, walkInto, drink, dailyBonus, roomDoor, leaveRoom, openWardrobe, vipBooth, requestTrack, openBlackjack, openRoulette, rlFast: false };
const strip = defArea('strip', { label: 'Las Vegas Strip', outdoor: true, envI: 1, rects: [[-200, 200, -640, 640]], music: null }); buildStrip(strip);
const lobby = defArea('lobby', { label: 'Tileo Kingdom · Lobby & Casino', envI: 0.6, hemi: 0.55, bloom: { day: [0.45, 0.4, 0.9], sunset: [0.45, 0.4, 0.9], night: [0.55, 0.45, 0.85] }, rects: [[-19.5, 19.5, -24.5, 24.5], [20.5, 69.5, -24.5, 24.5], [19, 21, -10.5, 10.5]], ceiling: 11.5, bbox: [-19.6, 69.6, -24.6, 24.6], music: 'lobby' }); buildLobby(lobby, ctx);
const pool = defArea('pool', { label: 'Pool Deck · Rooftop', outdoor: true, envI: 1.1, rects: [[-59.5, 59.5, -49.5, 49.5]], music: 'pool' }); buildPool(pool, ctx);
const rooms = defArea('rooms', { label: 'Floor 24 · Suites', envI: 0.5, hemi: 1.1, bloom: { day: [0.3, 0.4, 0.95], sunset: [0.3, 0.4, 0.95], night: [0.3, 0.4, 0.95] }, rects: [[-3.5, 3.5, -41.5, 7.5]], ceiling: 4.7, bbox: [-3.6, 3.6, -41.6, 7.6], music: 'lobby' }); buildRooms(rooms, ctx);
const room = defArea('room', { label: 'Your Suite', envI: 0.5, hemi: 1.1, bloom: { day: [0.3, 0.4, 0.95], sunset: [0.3, 0.4, 0.95], night: [0.3, 0.4, 0.95] }, rects: [[-7.5, 7.5, -9.5, 9.5]], ceiling: 4.7, bbox: [-7.6, 7.6, -9.6, 9.6], music: 'suite', vol: 0.4 }); buildRoom(room, ctx);
{ // v7.1: suite speaker by the bed: Suite Chill playlist or any radio station
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.55), new THREE.MeshStandardMaterial({ color: 0x0e0d0c, roughness: 0.35 })); m.position.set(-7.35, 0.65, -2.6); room.group.add(m);
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.95), new THREE.MeshStandardMaterial({ color: 0x1a1410, emissive: 0xffb347, emissiveIntensity: 0.22, roughness: 0.8 })); gr.position.set(-6.995, 0.72, -2.6); gr.rotation.y = PI / 2; room.group.add(gr);
  room.aabbs.push([-7.8, -6.9, -2.95, -2.25]); room.interacts.push({ x: -6.25, z: -2.6, r: 1.4, label: 'Suite speaker · change the music 🔊', act: () => openMusic() }); }
const club = defArea('club', { label: 'Mega Club · DJ Tileo', envI: 0.15, hemi: 0.25, bloom: { day: [0.75, 0.5, 0.8], sunset: [0.75, 0.5, 0.8], night: [0.75, 0.5, 0.8] }, rects: [[-29.5, 29.5, -29.5, 29.5]], ceiling: 13.5, bbox: [-29.6, 29.6, -29.6, 29.6], music: 'club' }); buildClub(club, ctx);
const FLOORS = [['lobby', 'L · Lobby & Casino'], ['pool', 'P · Pool Deck (rooftop)'], ['rooms', '24 · Suites'], ['club', 'C · Mega Club']];

// ---------- player / car ----------
const player = makeCharacter(save.look, { important: true }); scene.add(player);
const car = makeCar(); scene.add(car); car.position.set(45, 0, -346); car.rotation.y = 0;
const state = { area: null, driving: false, emote: null, sprint: false, vy: 0, jy: 0, air: false, baseY: 0, lights: false, carSpeed: 0, carHeading: 0, night: true, tod: 'night', muted: false, started: false, ui: null, near: null, moving: 0 };
const cam = { yaw: -PI / 2, pitch: 0.28, dist: 7, follow: true };
// ---------- v5: Sky Needle deck (an area that reuses the Strip geometry at 238 m), stretch limo, photo mode ----------
const C5 = { $, state, player, cam, camera, scene, save, prefs, savePrefs, CHAR, areas, renderer, toast, setCoins, transition, enterArea, showUI, closeUI, drink, setMusic, syncButtons, parkCar, toggleWheel, onShot: null };
const needleA = defArea('needle', { label: 'Sky Needle · Observation Deck · 238 m', outdoor: true, envI: 1, rects: [], showStrip: true, floorY: 238, farMul: 1.5, bloom: { day: [0.14, 0.35, 1.6], sunset: [0.45, 0.42, 0.95], night: [0.55, 0.42, 0.92] }, music: 'needle', vol: 0.45,
  fog: { day: [700, 3600], sunset: [600, 3200], night: [520, 3000] } });
const needle = buildNeedle(strip, needleA, C5);
const limo = buildLimo(strip, C5);
// v8: Sin City International baggage claim (Free Play and the Vegas Trip start here) + the arrival checklist (arrival.js)
const airport = defArea('airport', { label: 'Sin City International · Baggage Claim', envI: 0.8, hemi: 1.15, exp: 1.04, bloom: { day: [0.35, 0.4, 0.95], sunset: [0.35, 0.4, 0.95], night: [0.4, 0.4, 0.9] },
  rects: [[-33.5, 33.5, -31.6, 25.6], [-3.4, 3.4, 25, 27.3], [-42, 42, 26.6, 33.5]], ceiling: 9.4, music: 'airport', vol: 0.32 });
let arrival = null;
buildAirport(airport, { limoShell: limo.makeShell('white'), timeNow: () => (arrival ? arrival.time() : { h: 10, m: 0 }), grabBag: () => arrival.grabBag(), shop: () => arrival.shop(), services: () => arrival.services(), slots: () => openSlots(),
  limoLabel: () => arrival.limoLabel(), limoRide: () => arrival.limoRide(), toStrip: () => arrival.toStrip(), bagLabel: () => arrival.bagLabel(), shopLabel: () => arrival.shopLabel(), servicesLabel: () => arrival.servicesLabel(),
  counter: () => arrival.counter(), snacks: () => { if (trip) return trip.openVenue('snacks'); if (save.coins < 12) return toast('Not enough coins for a snack.'); setCoins(save.coins - 12); toast('🥨 A giant pretzel and an iced coffee for the road (-12 coins).'); }, counterLabel: () => (trip && trip.counterLabel ? trip.counterLabel() : 'Budget Air · Departures ✈️') });
C5.onArrive = name => { if (arrival) arrival.onLimoArrive(name); };
C5.dropAt = name => (name === 'Sin City International' ? { area: 'airport', ...AIRPORT_DOOR, msg: '✈️ Your chauffeur drops you right at the terminal doors.' } : null);
const photo = initPhoto(C5);
const comp = initCompanion({ scene, player, car, state, limo, toast, isTouch });
arrival = createArrival({ $, state, player, cam, save, prefs, areas, limo, strip, comp, toast, transition, enterArea, showUI, closeUI, setCoins, persist, openSlots, updateCamera: d => updateCamera(d), syncButtons, renderMini, parkCar });
{ const fd = lobby.interacts.find(i => Math.abs(i.x + 12.6) < 0.01 && Math.abs(i.z) < 0.01); if (fd) { const L0 = fd.label; fd.label = () => (arrival && arrival.active ? 'Check in with the concierge 🛎️ (the bellman takes your bags)' : typeof L0 === 'function' ? L0() : L0); } }
const UI_CLOSE = { people: () => { const i = $('chatIn'); if (i) i.blur(); }, photo: () => photo.close(), binoc: () => { needle.closeBinoc(); document.body.classList.remove('binocMode'); }, gallery: () => {}, cine: () => {} };

function enterArea(id, x, z, yaw) {
  if (state.ride && net) net.leaveRide(false);
  if (state.limo || limo.leaving.on) limo.abort();
  if (state.area) { state.area.group.visible = false; if (state.area.showStrip) strip.group.visible = false; }
  const A = state.area = areas[id]; A.group.visible = true; if (A.showStrip) strip.group.visible = true;
  player.position.set(x, A.floorY || 0, z); if (yaw !== undefined) { cam.yaw = yaw; player.rotation.y = yaw + PI; }
  car.visible = id === 'strip' || !!A.showStrip; player.visible = true; $('areaName').textContent = A.label; state.emote = null; state.air = false; state.jy = state.vy = 0; state.baseY = 0; renderMini(true);
  applyEnv(); setMusic(); if (arrival) arrival.onEnter(id); }
function transition(fn) { $('fade').classList.add('on'); setTimeout(() => { fn(); setTimeout(() => $('fade').classList.remove('on'), 120); }, 420); }

// ---------- environment (day / sunset / night) ----------
const TOD_ICON = { day: '☀️', sunset: '🌇', night: '🌙' }, TOD_ORDER = ['day', 'sunset', 'night'];
function applyEnv() {
  const A = state.area, tod = state.tod, n = tod !== 'day'; state.night = tod === 'night'; TODS.cur = tod;
  nightFx.forEach(f => f(n, tod));
  if (!A) return;
  gfx.applyArea(A, tod);
  $('btnNight').textContent = TOD_ICON[tod];
}
function setTod(tod) { state.tod = tod; applyEnv(); }
function setNight(n) { setTod(n ? 'night' : 'day'); }
function cycleTod() { if (trip) return trip.todTap(); setTod(TOD_ORDER[(TOD_ORDER.indexOf(state.tod) + 1) % 3]); toast(`${TOD_ICON[state.tod]} ${state.tod[0].toUpperCase() + state.tod.slice(1)} on the Strip`); }
function setQuality(m) { setMode(m, true); gfx.applyQuality(); applyEnv(); renderQualityUI(); }
function renderQualityUI() { const box = $('qualBtns'); if (!box) return; box.innerHTML = '';
  for (const m of ['auto', 'low', 'med', 'high']) { const b = document.createElement('button'); b.className = 'txt' + (Q.mode === m ? ' on' : ''); b.textContent = m === 'auto' ? `Auto (${TIERS[Q.auto].name})` : TIERS[m].name; b.onclick = () => setQuality(m); box.appendChild(b); }
  $('qualInfo').textContent = `Rendering: ${Q.tier.name} · ${Q.tier.shadow ? 'soft shadows' : 'no shadows'} · ${Q.tier.bloom ? 'bloom' : 'no bloom'}${Q.tier.water ? ' · mirror water' : ''}${gfx.ng ? ' · Next-Gen' + (Q.tier.ao ? ' with contact shadows' : '') : ''}`;
  const lb = $('lookBtns'); if (lb) { lb.innerHTML = ''; for (const [v, n] of [[true, 'Next-Gen'], [false, 'Classic']]) { const b = document.createElement('button'); b.className = 'txt' + ((prefs.ng !== false) === v ? ' on' : ''); b.textContent = n;
    b.onclick = () => { prefs.ng = v; savePrefs(); gfx.setLook(v); applyEnv(); renderQualityUI(); }; lb.appendChild(b); }
    const gb = $('glowBtns'); if (gb) { gb.innerHTML = ''; for (const [v, n] of [['soft', 'Soft'], ['full', 'Full'], ['off', 'Off']]) { const b = document.createElement('button'); b.className = 'txt' + ((prefs.glow || 'soft') === v ? ' on' : ''); b.textContent = n;
      b.onclick = () => { prefs.glow = v; savePrefs(); applyGlow(); applyEnv(); renderQualityUI(); }; gb.appendChild(b); } }
    $('lookInfo').textContent = Q.tier.bloom ? 'Next-Gen: real sky and reflections, contact shadows, sun glare, film grade, selfie depth of field.' : 'Next-Gen needs Med or High quality.'; }
  const pb = $('peopleBtns'); if (pb) { pb.innerHTML = ''; for (const [v, n] of [[true, 'Realistic'], [false, 'Classic']]) { const b = document.createElement('button'); b.className = 'txt' + ((prefs.people !== false) === v ? ' on' : ''); b.textContent = n;
    b.onclick = () => { prefs.people = v; savePrefs(); setPeople(v); renderQualityUI(); if (state.ui === 'creator') buildCreator(state.wardrobe); }; pb.appendChild(b); } } }

// ---------- music ----------
// v7.1: rotating playlists per venue + radio stations (music.js) instead of one looping song per place
const music = createMusic({ onNow: (d, why) => nowPlaying(d, why) });
let curTrack = null; const amb = createAmbience(); amb.setVolumes(prefs.vol);
// Settings → Sound: three sliders, saved with the other preferences
for (const [id, k] of [['volMusic', 'music'], ['volAmb', 'amb'], ['volFx', 'fx']]) { const el = $(id); if (!el) continue; el.value = Math.round(prefs.vol[k] * 100);
  el.oninput = () => { prefs.vol[k] = el.value / 100; savePrefs(); amb.setVolumes(prefs.vol); if (k === 'music') setMusic(); if (k === 'fx') amb.chime('spin'); }; }
function setMusic() {
  if (!state.started) return; amb.resume(); amb.setMuted(state.muted); const A = state.area, key = musicKey();
  const vol = state.muted ? 0 : (state.limo ? 0.5 : state.driving ? 0.55 : (A.vol || 0.6)) * prefs.vol.music;
  music.play(key, vol); curTrack = key; if (state.ui === 'music') renderMusic(); }
function musicKey() { const A = state.area; if (!A) return null;
  if (state.limo) return state.limo.radio && state.limo.radio !== 'off' ? 'radio:' + state.limo.radio : null;
  if (A.id === 'strip' && state.driving) return prefs.radio === 'off' ? null : 'radio:' + (prefs.radio || 'hits');
  if (A.id === 'room') { const s = prefs.suiteSt || 'suite'; return s === 'off' ? null : s === 'suite' ? 'suite' : 'radio:' + s; }
  return A.music; }
const SRC_NAME = k => !k ? '' : k.startsWith('radio:') ? `${state.limo ? 'Limo radio' : state.area.id === 'room' ? 'Suite speaker' : 'Car radio'} · ${station(k.slice(6)).icon} ${station(k.slice(6)).n}` : k === 'club' ? '🎧 DJ Tileo · Mega Club' : k === 'suite' ? '🛏️ Suite speaker · Suite Chill' : k === 'pool' ? '🏝️ Pool Deck' : k === 'needle' ? '🗼 Sky Needle' : k === 'airport' ? '✈️ Sin City International' : '🦁 Kingdom Lounge';
let npT = 0; function nowPlaying(d, why) { const s = SONGS[d.song]; if (!s || !state.started) return; const el = $('nowPlay'); el.innerHTML = `♪ <b>${s.t}</b> · ${s.a}<small>${SRC_NAME(d.key)}</small>`; el.classList.add('on'); clearTimeout(npT); npT = setTimeout(() => el.classList.remove('on'), 6000);
  if (state.ui === 'music') renderMusic(); }
// car / limo / suite stations, next song, DJ requests (📱 Music, the 📻 button while driving, B)
function cycleRadio() { if (state.limo) return limo.cycleRadio(); if (state.area.id === 'room') { const ids = ['suite', ...STATIONS.map(s => s.id)]; prefs.suiteSt = ids[(ids.indexOf(prefs.suiteSt || 'suite') + 1) % ids.length]; savePrefs(); setMusic(); toast(prefs.suiteSt === 'suite' ? '🛏️ Suite Chill' : `${station(prefs.suiteSt).icon} ${station(prefs.suiteSt).n}`); return; }
  if (!state.driving) return openMusic(); const ids = STATIONS.map(s => s.id); prefs.radio = ids[(ids.indexOf(prefs.radio || 'hits') + 1) % ids.length]; savePrefs(); setMusic(); const st = station(prefs.radio); toast(`${st.icon} ${st.n}`); syncButtons(); }
function openMusic() { if (!state.started) return; toggleWheel(false); showUI('music'); renderMusic(); }
function renderMusic() { const c = music.current, k = curTrack, box = $('musicBody'); if (!box) return;
  const btn = (label, on, fn, cls = 'txt') => { const b = document.createElement('button'); b.className = cls + (on ? ' on' : ''); b.innerHTML = label; b.onclick = fn; return b; };
  box.innerHTML = `<div class="mNow">${c && !state.muted ? `<small>${SRC_NAME(k)}</small><b>${c.t}</b><span>${c.a}</span>` : state.muted ? '<b>🔇 Muted</b><span>Tap Unmute to hear the music.</span>' : '<b>No music here</b><span>The Strip has city sound only: hop in the car for the radio.</span>'}</div><div class="mRow" id="mCtl"></div>`;
  const ctl = box.querySelector('#mCtl'); if (c) ctl.append(btn('⏭ Next song', false, () => { music.next(); }, 'gold')); ctl.append(btn(state.muted ? '🔊 Unmute' : '🔇 Mute', false, () => { toggleMute(); renderMusic(); }));
  const where = state.limo ? 'limo' : state.driving ? 'car' : state.area.id === 'room' ? 'suite' : null;
  if (where) { box.insertAdjacentHTML('beforeend', `<h3>${where === 'suite' ? 'Suite speaker' : where === 'limo' ? 'Limo radio' : 'Car radio'}</h3>`); const row = document.createElement('div'); row.className = 'sw mStations';
    const cur = where === 'limo' ? (state.limo.radio || 'off') : where === 'car' ? (prefs.radio || 'hits') : (prefs.suiteSt || 'suite');
    const opts = (where === 'suite' ? [{ id: 'suite', n: 'Suite Chill', icon: '🛏️' }] : []).concat(STATIONS);
    for (const st of opts) row.append(btn(`${st.icon} ${st.n}`, cur === st.id, () => { if (where === 'limo') { limo.setRadio(st.id === 'off' ? null : st.id); } else if (where === 'car') { prefs.radio = st.id; savePrefs(); setMusic(); } else { prefs.suiteSt = st.id; savePrefs(); setMusic(); } renderMusic(); })); box.append(row); }
  if (k === 'club' || k === 'suite' || (k && k.startsWith('radio:'))) { box.insertAdjacentHTML('beforeend', `<h3>${k === 'club' ? 'Request a song from DJ Tileo' : 'Pick a song'}</h3>`); const row = document.createElement('div'); row.className = 'mList';
    for (const id of (k === 'club' ? LISTS.club : k === 'suite' ? LISTS.suite : station(k.slice(6)).list)) row.append(btn(`${c && c.id === id ? '▶ ' : ''}${SONGS[id].t}`, c && c.id === id, () => { music.request(k, id); if (k === 'club') toast(pick(['DJ Tileo: "Say less!" 🦁', 'DJ Tileo: "Coming right up!"', 'DJ Tileo: "Great taste. Dropping it now."'])); }));
    box.append(row); }
  const vr = document.createElement('div'); vr.className = 'volRow'; vr.innerHTML = `<label>Music volume <input type="range" min="0" max="100" step="5" value="${Math.round(prefs.vol.music * 100)}"></label>`; vr.querySelector('input').oninput = e => { prefs.vol.music = e.target.value / 100; savePrefs(); setMusic(); const m = $('volMusic'); if (m) m.value = e.target.value; }; box.append(vr); }
const pick = a => a[Math.random() * a.length | 0];

// ---------- input ----------
const keys = {}; addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'Tab') { e.preventDefault(); state.ui === 'mapFull' ? closeUI() : openMap(); return; }
  if (e.code === 'Escape') { if (wheelOpen) toggleWheel(false); else closeUI(); return; }
  if (state.ui === 'photo') { if (photo.key(e)) return; }
  if (state.ui === 'binoc') { if (e.code === 'Equal' || e.code === 'NumpadAdd') needle.setZoom(needle.bz.zoom * 1.4); if (e.code === 'Minus' || e.code === 'NumpadSubtract') needle.setZoom(needle.bz.zoom / 1.4); if (e.code === 'KeyE' || e.code === 'Enter') closeUI(); return; }
  if (e.code === 'KeyC' && (!state.ui || state.ui === 'phone') && state.started && !state.cine) { photo.open(); return; }
  if (state.limo && !state.ui) { const k = e.code; if (k === 'KeyV') limo.cycleView(); else if (k === 'Space') { e.preventDefault(); limo.toggleStand(); } else if (k === 'KeyB' || k === 'KeyR') limo.cycleRadio(); else if (k === 'KeyX' || k === 'KeyE') limo.end(); else if (k === 'KeyO') limo.toggleWindows(); else if (k === 'KeyN') cycleTod(); else if (k === 'KeyM') toggleMute(); else if (k === 'KeyK') toggleMini();
    const dg = /^Digit([1-8])$/.exec(k); if (dg && state.limo.stand) state.emote = EMOTE_KEYS[+dg[1] - 1]; return; }
  if (e.code === 'KeyP') { state.ui === 'phone' ? closeUI() : openPhone(); return; }
  if (e.code === 'KeyT') { if (state.ui === 'teleport') closeUI(); else if (!state.ui || state.ui === 'mapFull' || state.ui === 'phone') openTeleport(); return; }
  if (e.code === 'KeyY' && net && net.online) { if (state.ui === 'people') closeUI(); else if ((!state.ui || state.ui === 'phone' || state.ui === 'mapFull') && state.started) { e.preventDefault(); net.openPeople(); } return; }
  if (state.ui && state.ui !== 'mapFull') return;
  if (e.code === 'Space') { e.preventDefault(); state.driving ? horn() : jump(); }
  if (e.code === 'KeyE' || e.code === 'Enter') doInteract(); if (e.code === 'KeyG') toggleDance(); if (e.code === 'KeyN') cycleTod(); if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyR') toggleSprint(); if (e.code === 'KeyQ') toggleWheel(); if (e.code === 'KeyV') toggleCam(); if (e.code === 'KeyK') toggleMini();
  if (e.code === 'KeyH') horn(); if (e.code === 'KeyL') toggleLights(); if (e.code === 'KeyB') cycleRadio();
  const dg = /^Digit([1-8])$/.exec(e.code); if (dg) setEmote(EMOTE_KEYS[+dg[1] - 1]); });
addEventListener('keyup', e => keys[e.code] = false);
const joy = { x: 0, y: 0, id: null }; const jb = $('joy'), jk = $('joyKnob');
jb.addEventListener('pointerdown', e => { joy.id = e.pointerId; jb.setPointerCapture(e.pointerId); joyMove(e); e.preventDefault(); });
jb.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMove(e); });
const joyEnd = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; jk.style.transform = ''; } }; jb.addEventListener('pointerup', joyEnd); jb.addEventListener('pointercancel', joyEnd);
function joyMove(e) { const r = jb.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const m = Math.hypot(dx, dy), max = r.width / 2 - 20; if (m > max) { dx *= max / m; dy *= max / m; } joy.x = dx / max; joy.y = -dy / max; jk.style.transform = `translate(${dx}px,${dy}px)`; }
const drag = { id: null, x: 0, y: 0 }; const cv = renderer.domElement;
cv.addEventListener('pointerdown', e => { if (drag.id !== null) return; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => { if (e.pointerId !== drag.id) return; const ddx = e.clientX - drag.x, ddy = e.clientY - drag.y;
  if (state.ui === 'photo' || state.ui === 'binoc' || state.limo) { if (state.ui === 'photo') photo.drag(ddx, ddy); else if (state.ui === 'binoc') needle.binocDrag(ddx, ddy); else limo.look(ddx, ddy); drag.x = e.clientX; drag.y = e.clientY; return; }
  cam.yaw -= (e.clientX - drag.x) * 0.006; cam.pitch = Math.min(1.2, Math.max(prefs.fp ? -0.9 : -0.15, cam.pitch + (e.clientY - drag.y) * 0.004)); drag.x = e.clientX; drag.y = e.clientY; cam.manual = 1.5; });
const pinch = new Map(); let pinchD = 0;
addEventListener('pointerdown', e => { if (state.ui === 'binoc' || state.ui === 'photo') { pinch.set(e.pointerId, [e.clientX, e.clientY]); if (pinch.size === 2) { const [a, b] = [...pinch.values()]; pinchD = Math.hypot(a[0] - b[0], a[1] - b[1]); } } });
addEventListener('pointermove', e => { if (!pinch.has(e.pointerId)) return; pinch.set(e.pointerId, [e.clientX, e.clientY]); if (pinch.size !== 2) return; const [a, b] = [...pinch.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (!pinchD) { pinchD = d; return; }
  const k = d / pinchD; if (Math.abs(k - 1) > 0.04) { if (state.ui === 'binoc') needle.setZoom(needle.bz.zoom * k); else if (state.ui === 'photo') photo.zoom(k > 1 ? -1 : 1); pinchD = d; } });
const pinchEnd = e => { pinch.delete(e.pointerId); pinchD = 0; }; addEventListener('pointerup', pinchEnd); addEventListener('pointercancel', pinchEnd);
const dragEnd = e => { if (e.pointerId === drag.id) drag.id = null; }; cv.addEventListener('pointerup', dragEnd); cv.addEventListener('pointercancel', dragEnd);
cv.addEventListener('wheel', e => { if (state.ui === 'photo') return photo.zoom(e.deltaY); if (state.ui === 'binoc') return needle.setZoom(needle.bz.zoom * (e.deltaY > 0 ? 0.85 : 1.18)); cam.dist = Math.min(state.driving ? 18 : 14, Math.max(2.5, cam.dist + e.deltaY * 0.01)); }, { passive: true });
$('btnAct').onclick = doInteract; $('btnDance').onclick = toggleDance; $('btnNight').onclick = cycleTod; $('btnMute').onclick = toggleMute; $('btnHelp').onclick = () => showUI('help');
$('btnJump').onclick = () => jump(); $('btnRadio').onclick = () => cycleRadio(); $('btnHorn').onclick = () => horn(); $('btnLights').onclick = () => toggleLights(); $('btnSprint').onclick = () => toggleSprint(); $('btnEmote').onclick = () => toggleWheel();
$('btnCam').onclick = () => toggleCam(); $('btnMap').onclick = () => toggleMini(); $('btnPhone').onclick = () => openPhone(); $('btnTp').onclick = () => openTeleport(); $('miniWrap').onclick = () => openMap(); $('btnPhoto').onclick = () => photo.open();
$('binocDone').onclick = () => closeUI(); $('hailWhite').onclick = () => hailLimo('white'); $('hailBlack').onclick = () => hailLimo('black');
// stop HUD buttons from also starting a camera drag / double-tap zoom
document.querySelectorAll('#hud button, #miniWrap').forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));
// ---------- v3 controller actions ----------
const EMOTE_KEYS = Object.keys(EMOTES); let wheelOpen = false;
function setEmote(k) { if (state.limo && state.limo.stand && EMOTES[k]) { state.emote = state.emote === k ? null : k; return; } if (state.driving || state.limo || state.ui || !state.started || !EMOTES[k]) return; toggleWheel(false); state.emote = state.emote === k ? null : k;
  if (state.emote === 'dance') toast(state.area.id === 'club' && inRect(player.position, club.danceRect) ? 'Dance streak! +5 coins every 10s on the floor' : 'Showing off your moves');
  else if (state.emote) toast(`${EMOTES[k][2]} ${EMOTES[k][1]}`); syncButtons(); }
function toggleWheel(on = !wheelOpen) { if (on && (state.driving || !state.started)) on = false; wheelOpen = on; const w = $('emoteWheel'); w.classList.toggle('hidden', !on); $('btnEmote').classList.toggle('on', on);
  if (on) { w.innerHTML = ''; EMOTE_KEYS.forEach((k, i) => { const a = -PI / 2 - (i / EMOTE_KEYS.length) * PI * 2, b = document.createElement('button');
    b.style.left = (125 + Math.cos(a) * 92 - 31) + 'px'; b.style.top = (125 + Math.sin(a) * 92 - 31) + 'px'; b.className = state.emote === k ? 'on' : '';
    b.innerHTML = `${EMOTES[k][2]}<span>${i + 1} · ${EMOTES[k][1]}</span>`; b.addEventListener('pointerdown', e => e.stopPropagation()); b.onclick = () => setEmote(k); w.appendChild(b); }); } }
function jump() { if (state.driving || state.limo || state.ui || !state.started || state.air) return; if (waterDepth(player.position) >= 0.8) return; state.air = true; state.vy = 5.2; state.jy = 0.001; state.emote = null; syncButtons(); }
function toggleSprint() { if (state.driving) return; state.sprint = !state.sprint; syncButtons(); toast(state.sprint ? '🏃 Sprint on' : '🚶 Sprint off'); }
function toggleCam() { prefs.fp = !prefs.fp; savePrefs(); if (!prefs.fp) cam.pitch = Math.max(-0.15, cam.pitch); syncButtons(); toast(prefs.fp ? '🎥 First-person view' : '🎥 Third-person view'); }
function toggleMini(on = !prefs.mini) { prefs.mini = on; savePrefs(); syncButtons(); renderMini(true); }
function toggleLights(on = !state.lights) { if (!state.driving && on) return; state.lights = on; const b = car.userData.beam, hm = car.userData.headMat;
  if (b) { b.visible = Q.tier.shadow !== false || Q.key !== 'low'; b.intensity = on ? 180 : 0; if (Q.key === 'low') b.visible = false; }
  if (hm) hm.emissiveIntensity = on ? 4 : 0.6; syncButtons(); }
let actx = null; function horn() { if (!state.driving) return; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const t0 = actx.currentTime, gn = actx.createGain();
  gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(state.muted ? 0.0001 : Math.max(0.0001, 0.22 * prefs.vol.fx), t0 + 0.02); gn.gain.setValueAtTime(state.muted ? 0.0001 : Math.max(0.0001, 0.22 * prefs.vol.fx), t0 + 0.3); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; f.connect(gn); gn.connect(actx.destination);
  for (const hz of [415, 523]) { const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz; o.connect(f); o.start(t0); o.stop(t0 + 0.4); } } catch (e) {}
  $('btnHorn').classList.add('on'); setTimeout(() => $('btnHorn').classList.remove('on'), 300); }
function syncButtons() { const d = state.driving;
  $('btnJump').classList.toggle('hidden', d); $('btnHorn').classList.toggle('hidden', !d); $('btnEmote').classList.toggle('hidden', d); $('btnLights').classList.toggle('hidden', !d);
  $('btnSprint').classList.toggle('hidden', d); $('btnDance').classList.toggle('hidden', d); $('btnRadio').classList.toggle('hidden', !d); if (d) $('btnRadio').innerHTML = `${station(prefs.radio || 'hits').icon}<span>Radio</span>`;
  $('btnSprint').classList.toggle('on', state.sprint); $('btnDance').classList.toggle('on', state.emote === 'dance'); $('btnLights').classList.toggle('on', state.lights);
  $('btnMap').classList.toggle('on', prefs.mini); $('hud').classList.toggle('nomini', !prefs.mini); $('btnCam').textContent = prefs.fp ? '👁️' : '🎥'; }
function openPhone() { if (!state.started) return; toggleWheel(false); showUI('phone'); }
document.querySelectorAll('.appGrid button').forEach(b => b.onclick = () => { const a = b.dataset.app; closeUI();
  ({ map: openMap, emote: () => toggleWheel(true), cam: toggleCam, mini: () => toggleMini(), tod: cycleTod, mute: openMusic, help: () => showUI('help'), credits: openCredits, teleport: openTeleport, limo: () => openHail(true), photo: () => photo.open(), gallery: () => photo.openGallery(), people: () => net && net.openPeople(), account: () => net && net.openAuth('in') })[a](); });
function openCredits() { const sk = SKYLINE_CREDITS.map(c => `<li><b>${c.tod} suite view:</b> “${c.title}” by ${c.author}, <a href="${c.url}" target="_blank" rel="noopener">Wikimedia Commons</a>, ${c.license} (<a href="https://creativecommons.org/licenses/${c.license.includes('3.0') ? 'by-sa/3.0' : 'by-sa/2.0'}/" target="_blank" rel="noopener">license</a>). Resized &amp; re-encoded.</li>`).join('');
  $('creditsBody').innerHTML = `<h3>Game</h3><p>TILEO KINGDOM: Strip Life, an original parody game. All resort, casino &amp; brand names are fictional. Play coins only, with no real-money gambling. 18+.</p>
  <h3>Realistic people</h3><ul><li>Bodies, faces and outfits adapted from the <a href="https://github.com/microsoft/Microsoft-Rocketbox" target="_blank" rel="noopener">Microsoft Rocketbox Avatar Library</a> (MIT License, © Microsoft Corporation): textures resized, outfits/skin/beards recoloured at runtime, meshes converted to glTF. They are driven by the Quaternius animations below (no Mixamo motion).</li></ul>
  <h3>Surfaces &amp; lighting</h3><ul><li>Asphalt, concrete, desert rock, travertine, marble, casino carpet and palm textures: generated for this game (tools-src/gen_textures.py), no photos.</li><li>Physical sky: three.js Sky addon (Preetham scattering, MIT). SMAA and bokeh depth of field: three.js addons (MIT).</li></ul>
  <h3>Characters &amp; animation</h3><ul><li>Universal Base Characters by <a href="https://quaternius.com" target="_blank" rel="noopener">Quaternius</a> (CC0)</li><li>Universal Animation Library 1 &amp; 2 by Quaternius (CC0)</li><li>DJ Tileo lion head, outfits, wristbands: original, procedural</li></ul>
  <h3>Las Vegas skyline photos (suite windows)</h3><ul>${sk}</ul>
  <h3>Engine</h3><p><a href="https://threejs.org" target="_blank" rel="noopener">three.js</a> r186 (MIT), meshoptimizer decoder (MIT).</p><h3>Music</h3><p>Original tracks supplied for TILEO KINGDOM:</p><ul>${Object.values(SONGS).map(s => `<li>“${s.t}” · ${s.a}</li>`).join('')}</ul>`;
  showUI('credits'); }
// ---------- mini-map + full Strip map ----------
const miniCv = $('miniMap'), mctx = miniCv.getContext('2d'), mapCv = $('mapCanvas'), fctx = mapCv.getContext('2d');
const lmk = n => strip.landmarks.find(l => l.name === n);
const NORTH = (() => { const a = lmk('Luxe Pyramid'), b = lmk('Sky Needle'); if (!a || !b) return { x: 0, z: -1 }; const dx = b.x - a.x, dz = b.z - a.z, m = Math.hypot(dx, dz); return { x: dx / m, z: dz / m }; })();
const EAST = { x: -NORTH.z, z: NORTH.x };
function drawPlan(g, A, P, s, full) { // P(x,z) -> [sx,sy]; s = px per metre
  const poly = (pts, fill, stroke) => { g.beginPath(); pts.forEach(([x, z], i) => { const [u, v] = P(x, z); i ? g.lineTo(u, v) : g.moveTo(u, v); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.stroke(); } };
  const rect = (r, fill, stroke) => poly([[r[0], r[2]], [r[1], r[2]], [r[1], r[3]], [r[0], r[3]]], fill, stroke);
  if (A.id === 'strip') { rect([-200, 200, -650, 650], '#2a2116'); rect([-22, 22, -650, 650], '#3b3328'); rect([-14, 14, -650, 650], '#15151a');
    g.setLineDash([6, 6]); g.strokeStyle = '#d8b45a88'; g.lineWidth = 1; const [a1, b1] = P(0, -650), [a2, b2] = P(0, 650); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); g.setLineDash([]); }
  else if (A.drawMap) A.drawMap(g, P, s, full);
  else for (const r of A.rects) rect(r, '#3a2c1c', '#c9932e66');
  for (const w of A.water || []) { if (w.rect) rect(w.rect, '#1f6f8bcc'); else if (w.circle) { const [u, v] = P(w.circle[0], w.circle[1]); g.beginPath(); g.arc(u, v, w.circle[2] * s, 0, PI * 2); g.fillStyle = '#1f6f8bcc'; g.fill(); } }
  g.lineWidth = 1; for (const b of A.aabbs) { if ((b[1] - b[0]) * (b[3] - b[2]) < (A.id === 'strip' ? 6 : 0.3)) continue; rect(b, A.id === 'strip' ? '#5a4a35' : '#6b5638', '#00000066'); }
  if (A.id === 'strip') { for (const l of strip.landmarks) { const [u, v] = P(l.x, l.z), tk = l.name === 'TILEO KINGDOM';
      g.beginPath(); g.arc(u, v, tk ? 7 : 4.5, 0, PI * 2); g.fillStyle = tk ? '#ffcf4a' : '#ff6ec7'; g.fill(); g.strokeStyle = '#000'; g.stroke();
      if (tk) { g.font = `${full ? 18 : 12}px sans-serif`; g.textAlign = 'center'; g.fillText('👑', u, v - 9); }
      if (full) { g.font = `bold ${tk ? 17 : 14}px sans-serif`; g.textAlign = u > g.canvas.width * 0.6 ? 'right' : 'left'; g.fillStyle = tk ? '#ffcf4a' : '#f3e6c4'; g.strokeStyle = '#000'; g.lineWidth = 3; const tx = u + (g.textAlign === 'left' ? 10 : -10); g.strokeText(l.name, tx, v + 5); g.fillText(l.name, tx, v + 5); g.lineWidth = 1; } }
    { const [u, v] = P(NEEDLE_X, NEEDLE_Z); if (full) { g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#8fd0ff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText('🗼 Top · 238 m', u, v - 22); g.fillText('🗼 Top · 238 m', u, v - 22); g.lineWidth = 1; } }
    if (limo.grp.visible) { const [u, v] = P(limo.grp.position.x, limo.grp.position.z); g.font = `${full ? 20 : 14}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🚘', u, v); g.textBaseline = 'alphabetic'; }
    { const [u, v] = P(17, -330); if (full) { g.font = 'bold 13px sans-serif'; g.textAlign = 'right'; g.fillStyle = '#f4f2ee'; g.fillText('🚘 limo stand', u - 26, v + 22); } }
    if (car.visible) { const [u, v] = P(car.position.x, car.position.z); g.font = `${full ? 20 : 14}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🚗', u, v); g.textBaseline = 'alphabetic'; } }
  else for (const it of A.interacts) { const [u, v] = P(it.x, it.z); g.beginPath(); g.arc(u, v, full ? 4 : 2.5, 0, PI * 2); g.fillStyle = '#ffcf4a'; g.fill(); }
}
function arrow(g, u, v, ang, sz) { g.save(); g.translate(u, v); g.rotate(ang); g.beginPath(); g.moveTo(0, -sz); g.lineTo(sz * 0.7, sz * 0.75); g.lineTo(0, sz * 0.35); g.lineTo(-sz * 0.7, sz * 0.75); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#c9932e'; g.lineWidth = 2; g.stroke(); g.restore(); }
let miniAcc = 0;
function renderMini(force) { if (!prefs.mini || !state.area || !state.started && !force) return; const A = state.area, W = miniCv.width, c = W / 2, p = state.driving ? car.position : player.position;
  const range = A.id === 'strip' ? (state.driving || state.limo ? 230 : 140) : A.id === 'needle' ? 40 : 32, s = c / range, yaw = cam.yaw;
  const rt = { x: Math.cos(yaw), z: -Math.sin(yaw) }, fw = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
  const P = (x, z) => { const dx = x - p.x, dz = z - p.z; return [c + (dx * rt.x + dz * rt.z) * s, c - (dx * fw.x + dz * fw.z) * s]; };
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.fillStyle = '#0b0906'; mctx.fillRect(0, 0, W, W); drawPlan(mctx, A, P, s, false);
  const h = state.driving ? state.carHeading : player.rotation.y, f = { x: Math.sin(h), z: Math.cos(h) };
  arrow(mctx, c, c, Math.atan2(f.x * rt.x + f.z * rt.z, f.x * fw.x + f.z * fw.z), 11);
  const nx = NORTH.x * rt.x + NORTH.z * rt.z, ny = -(NORTH.x * fw.x + NORTH.z * fw.z), n = $('miniN'), R = 44; // % of the wrap
  n.style.left = (50 + nx * R) + '%'; n.style.top = (50 + ny * R) + '%'; n.style.transform = 'translate(-50%,-50%)'; }
function openMap() { if (!state.started) return; toggleWheel(false); showUI('mapFull'); renderFullMap(); }
function renderFullMap() { const A = state.area, g = fctx, Wd = mapCv.width, Ht = mapCv.height; g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0b0906'; g.fillRect(0, 0, Wd, Ht);
  const outside = A.id === 'strip', src = outside ? [[-200, -650], [200, -650], [200, 650], [-200, 650]] : (A.mapRects || A.rects).flatMap(r => [[r[0], r[2]], [r[1], r[3]], [r[0], r[3]], [r[1], r[2]]]);
  const north = outside ? NORTH : { x: 0, z: -1 }, east = { x: -north.z, z: north.x };
  const pr = (x, z) => [x * east.x + z * east.z, -(x * north.x + z * north.z)]; const pts = src.map(([x, z]) => pr(x, z));
  const mnx = Math.min(...pts.map(q => q[0])), mxx = Math.max(...pts.map(q => q[0])), mny = Math.min(...pts.map(q => q[1])), mxy = Math.max(...pts.map(q => q[1]));
  const s = Math.min((Wd - 40) / (mxx - mnx), (Ht - 40) / (mxy - mny)), ox = Wd / 2 - (mnx + mxx) / 2 * s, oy = Ht / 2 - (mny + mxy) / 2 * s;
  const P = (x, z) => { const [u, v] = pr(x, z); return [ox + u * s, oy + v * s]; };
  drawPlan(g, A, P, s, true);
  mapPins = tpPins(A, P, g);
  const p = state.driving ? car.position : player.position, [u, v] = P(p.x, p.z), h = state.driving ? state.carHeading : player.rotation.y, f = { x: Math.sin(h), z: Math.cos(h) };
  arrow(g, u, v, Math.atan2(f.x * east.x + f.z * east.z, f.x * north.x + f.z * north.z), 14);
  g.font = 'bold 16px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffcf4a'; g.fillText('▲ N', Wd - 34, 28);
  $('mapTitle').textContent = outside ? 'Las Vegas Strip' : A.label; $('mapLegend').textContent = outside ? '▲ you · 🚗 convertible · 🚘 limo · 👑 TILEO KINGDOM · 🗼 Sky Needle top · pink = parody landmarks · north is up · tap a pin to teleport' : '▲ you · gold dots = things to do · tap a 🌀 pin to teleport'; }
function toggleMute() { state.muted = !state.muted; $('btnMute').textContent = state.muted ? '🔇' : '🔊'; setMusic(); }
function toggleDance() { setEmote('dance'); }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeUI());
function showUI(id) { closeUI(); state.ui = id; $(id).classList.remove('hidden'); if (id === 'binoc') document.body.classList.add('binocMode'); }
function closeUI() { if (state.ui) { $(state.ui).classList.add('hidden'); const f = UI_CLOSE[state.ui]; state.ui = null; if (f) f(); } state.ui = null; }

// ---------- HUD ----------
let toastT = 0; function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); }
function setCoins(v) { save.coins = Math.max(0, Math.round(v)); $('coinVal').textContent = save.coins.toLocaleString(); persist(); }
function updateBand() { const L = save.look, c = L.banded ? BAND_C : '#555'; $('bandDot').style.background = c; $('bandDot').style.color = c;
  $('bandTxt').textContent = L.banded ? `${L.name} · Suite ${save.room} · Kingdom wristband` : `${L.name} · no wristband (check in at the lobby)`; }

// ---------- interactions ----------
function inRect(p, r) { return p.x >= r[0] && p.x <= r[1] && p.z >= r[2] && p.z <= r[3]; }
function nearest() { if (state.ride) return net && net.rideAction(); if (state.limo || state.cine) return null; if (state.area.id === 'strip') { if (state.driving) return { label: 'Exit car', act: exitCar };
    if (Math.hypot(player.position.x - car.position.x, player.position.z - car.position.z) < 4) return { label: 'Drive convertible', act: enterCar };
    const d = strip.tileo; if (Math.hypot(player.position.x - (d.doorX - 3), player.position.z - d.doorZ) < 6) return { label: 'Enter TILEO KINGDOM', act: () => walkInto(d.doorX - 1.1, d.doorZ, enterTower) };
    const ap = strip.airport; if (ap && Math.hypot(player.position.x - (ap.doorX - 2.5), player.position.z - ap.doorZ) < 5) return { label: 'Enter Sin City International ✈️ (baggage claim)', act: () => walkInto(ap.doorX + 0.4, ap.doorZ, enterAirport) };
    if (!state.limo && Math.hypot(player.position.x - 17, player.position.z + 330) < 5) return { label: 'Hail the stretch limo 🚘', act: () => openHail(false) };
    const k = strip.needleKiosk; if (Math.hypot(player.position.x - k.x, player.position.z - k.z) < k.r) return { label: 'Ride the Sky Needle elevator ▲', act: () => needle.rideUp() };
    return (net && net.rideAction()) || (trip && trip.near()) || comp.action(); }
  let best = null, bd = 1e9; for (const it of state.area.interacts) { if (it.when && !it.when()) continue; const d = Math.hypot(player.position.x - it.x, player.position.z - it.z); if (d < it.r && d < bd) { bd = d; best = it; } } return best || (trip && trip.near()) || comp.action(); }
function doInteract() { if (state.ui || !state.started) return; const it = state.near; if (it) it.act(); }
function enterAirport() { if (state.walkTo) state.walkTo = null; if (state.entering) return; state.entering = true; setTimeout(() => { state.entering = false; }, 900); transition(() => enterArea('airport', AIRPORT_DOOR.x, AIRPORT_DOOR.z, AIRPORT_DOOR.yaw)); }
function enterTower() { if (state.walkTo) state.walkTo = null; if (state.entering) return; state.entering = true; setTimeout(() => { state.entering = false; }, 900); transition(() => enterArea('lobby', lobby.spawnDoor.x, lobby.spawnDoor.z, lobby.spawnDoor.yaw)); }
// v6.3: walk yourself to a spot (through the opening glass doors), then carry on
function walkInto(x, z, then) { if (tpBusy) return; state.walkTo = { x, z, then, t: 0 }; state.emote = null; }
function exitToStrip() { if (state.walkTo) state.walkTo = null; if (state.entering) return; state.entering = true; setTimeout(() => { state.entering = false; }, 900); transition(() => enterArea('strip', strip.tileo.doorX - 8, strip.tileo.doorZ, PI / 2)); }
function enterCar() { if (state.ride) return; state.driving = true; state.emote = null; toggleWheel(false); state.air = false; state.jy = 0; setTimeout(syncButtons); player.visible = true; state.carHeading = car.rotation.y; cam.dist = 11; toast('Convertible rented: W/S or joystick to drive, A/D to steer. Car radio on.'); setMusic(); }
function exitCar() { state.driving = false; state.carSpeed = 0; const h = state.carHeading; player.position.set(car.position.x + Math.cos(h) * 2.2, 0, car.position.z - Math.sin(h) * 2.2); player.rotation.set(0, h, 0); cam.dist = 7; toggleLights(false); syncButtons(); setMusic(); }
function checkIn() {
  if (arrival && arrival.active) arrival.concierge(); // v8.1: the concierge checks you in and the bellman takes your bags up
  const L = save.look;
  if (!save.room) { save.room = 2401 + Math.floor(Math.random() * 10); L.banded = true; applyLook(player, L); persist(); updateBand();
    toast(`Welcome to TILEO KINGDOM, ${L.name}. Suite ${save.room} on floor 24. Your Kingdom wristband is on: take the elevator to Floor 24.`); }
  else toast(`You're checked in: Suite ${save.room}, floor 24. Kingdom wristband active.`);
  showKeycard(); }
function showKeycard() { const L = save.look; $('kcName').textContent = L.name; $('kcRoom').textContent = `${save.room} · Floor 24`;
  $('kcBand').textContent = 'Kingdom guest'; $('kcDot').style.background = BAND_C; showUI('keycard'); }
function openElevator() { const A = state.area; if (A.elevDoor) A.elevDoor.force = 2;
  const box = $('elevBtns'); box.innerHTML = ''; for (const [id, name] of FLOORS) { const b = document.createElement('button'); b.textContent = name; b.disabled = id === A.id;
    b.onclick = () => { closeUI(); if (id === 'rooms' && !save.room) { toast('Floor 24 is for guests: check in at the front desk first.'); return; } if (trip && !trip.canEnter(id)) return; transition(() => { const s = areas[id].spawnElev; enterArea(id, s.x, s.z, s.yaw); areas[id].elevDoor && (areas[id].elevDoor.force = 1.5); }); }; box.appendChild(b); }
  setTimeout(() => showUI('elev'), 250); }
function roomDoor(num, side, z) { if (!save.room) return toast('Check in at the lobby desk to get a suite.'); if (num !== save.room) return toast(`Not your suite. Yours is ${save.room} (green light).`);
  state.lastDoor = { side, z }; transition(() => enterArea('room', 0, 7.5, 0)); }
function leaveRoom() { const d = state.lastDoor || { side: -1, z: -2 }; transition(() => enterArea('rooms', d.side * 1.8, d.z, d.side > 0 ? PI / 2 : -PI / 2)); }
const DRINKS = ["Tiger's Kiss", 'Gold Mane Margarita', 'Velvet Roar', 'Midnight Mojito', 'Jungle Spritz'];
function drink(where) { if (save.coins < 15) return toast('Not enough coins. Visit the Coin Cage for a daily bonus.'); setCoins(save.coins - 15); toast(`${DRINKS[Math.floor(Math.random() * DRINKS.length)]} from the ${where} (-15 coins). Cheers! 🥂`); }
function dailyBonus() { const d = new Date().toDateString(); if (save.bonusDay === d) return toast('Daily bonus already collected. Come back tomorrow. (Play coins only, no cash-out.)'); save.bonusDay = d; setCoins(save.coins + 500); toast('+500 Kingdom Coins daily bonus!'); }
function vipBooth() { if (state.vip) return toast('Your VIP booth is reserved all night.'); if (save.coins < 300) return toast('VIP booth needs 300 coins.'); setCoins(save.coins - 300); state.vip = true; toast('VIP bottle-service booth booked (-300). Sparklers on the way! ✨'); }
function requestTrack() { openMusic(); }

// ---------- slots ----------
const SYM = ['🍒', '💎', '7', '👑', '🐯', '🦁'], W = [30, 22, 16, 12, 10, 7], PAY = { '🦁': 50, '🐯': 25, '👑': 15, '7': 10, '💎': 8, '🍒': 5 };
let bet = 10, spinning = false;
document.querySelectorAll('.bet').forEach(b => b.onclick = () => { document.querySelectorAll('.bet').forEach(x => x.classList.remove('on')); b.classList.add('on'); bet = +b.dataset.bet; });
function roll() { let r = Math.random() * W.reduce((a, b) => a + b); for (let i = 0; i < SYM.length; i++) { r -= W[i]; if (r < 0) return SYM[i]; } return SYM[0]; }
let casinoUI = null; const casino = () => casinoUI || (casinoUI = initCasino({ save, setCoins, showUI, closeUI, toast, chime: k => amb.chime(k), onSpin: on => { ctx.rlFast = on; },
  bets: trip ? trip.bets : null, broke: trip ? trip.brokeMsg : null, onEvent: (k, d) => { if (trip) trip.emit(k, d); } }));
function openBlackjack() { casino().openBlackjack(); }
function openRoulette() { casino().openRoulette(); }
function openSlots() { showUI('slots'); $('slotMsg').textContent = `Bet ${bet}. Balance ${save.coins}. Play coins only.`; }
$('spin').onclick = () => { if (spinning) return; if (save.coins < bet) { $('slotMsg').textContent = trip ? trip.brokeMsg : 'Not enough coins: try the Coin Cage daily bonus.'; return; }
  spinning = true; setCoins(save.coins - bet); const reels = [...document.querySelectorAll('.reel')]; const res = [roll(), roll(), roll()]; let t = 0;
  const iv = setInterval(() => { t++; reels.forEach((r, i) => { if (t < 8 + i * 5) r.textContent = SYM[Math.floor(Math.random() * 6)]; else r.textContent = res[i]; });
    if (t >= 18) { clearInterval(iv); spinning = false; let win = 0;
      if (res[0] === res[1] && res[1] === res[2]) win = bet * PAY[res[0]]; else if (res.filter(s => s === '🦁').length === 2) win = bet * 2; else if (new Set(res).size === 2) win = bet;
      if (win) setCoins(save.coins + win); amb.chime(win >= bet * 10 ? 'big' : win ? 'win' : 'spin'); const u = trip ? ' Trip Cash' : ' coins'; $('slotMsg').textContent = win ? (win >= bet * 10 ? `🎉 JACKPOT! +${win}${u}` : `Winner: +${win}${u}`) : 'No win. Spin again?';
      if (trip) trip.emit('slots', { bet, win }); } }, 70); };

// ---------- shop / creator / wardrobe ----------
function openShop() { const L = $('shopList'); L.innerHTML = '';
  for (const [k, s] of Object.entries(STYLES)) { if (k === 'solid') continue; const own = save.owned.includes(k); const d = document.createElement('div'); d.className = 'item';
    const col = { swim: '#1f6f8b', white: '#fff', tiger: '#e8891c', gold: '#ffc94a' }[k];
    d.innerHTML = `<div class="sq" style="background:${col}"></div><div style="flex:1">${s.n}<br><small>${own ? 'Owned' : s.price + ' coins'}</small></div>`;
    const b = document.createElement('button'); b.textContent = own ? (save.look.style === k ? 'Wearing' : 'Wear') : 'Buy';
    b.onclick = () => { if (!own) { if (save.coins < s.price) return toast('Not enough coins.'); setCoins(save.coins - s.price); save.owned.push(k); toast(`Bought ${s.n}!`); } save.look.style = k; applyLook(player, save.look); persist(); openShop(); };
    d.appendChild(b); L.appendChild(d); } showUI('shop'); }
const SKINS = ['#f6d7bd', '#f1c9a5', '#d9a47c', '#b07a52', '#8a5636', '#5e3a22', '#3d2516'], HAIRS = ['#1a1209', '#3b2412', '#7a4a1e', '#d8b45a', '#f0e0b0', '#b8321c', '#e8e0d0', '#7b2cbf', '#ff6ec7'], OUTFITS = ['#c9932e', '#111111', '#ffffff', '#b0102a', '#ff7a1a', '#7b2cbf', '#1f6f8b', '#e83e8c', '#2f7a32'];
function swatches(id, list, key) { const el = $(id); el.innerHTML = ''; list.forEach(c => { const b = document.createElement('button'); b.style.background = c; if (save.look[key] === c) b.classList.add('on'); b.onclick = () => { save.look[key] = c; applyLook(player, save.look); swatches(id, list, key); }; el.appendChild(b); }); }
function buildCreator(wardrobe) {
  $('crTitle').textContent = wardrobe ? 'Wardrobe' : 'Create your guest'; $('crDone').textContent = wardrobe ? 'Done' : 'Land in Vegas ✈️'; $('crName').value = save.look.name;
  swatches('swSkin', SKINS, 'skin'); swatches('swHair', HAIRS, 'hair'); swatches('swOutfit', OUTFITS, 'outfit');
  const bd = $('swBody'); bd.innerHTML = ''; for (const [k, n] of [['f', 'Female'], ['m', 'Male']]) { const b = document.createElement('button'); b.className = 'txt' + (save.look.body === k ? ' on' : ''); b.textContent = n;
    b.onclick = () => { if (save.look.body === k) return; save.look.body = k; save.look.face = ''; save.look.cut = ''; if (!HAIRSTYLES[k].includes(save.look.hairStyle)) save.look.hairStyle = HAIRSTYLES[k][0]; applyLook(player, save.look); buildCreator(wardrobe); }; bd.appendChild(b); }
  const hs = $('swHairStyle'); hs.innerHTML = ''; for (const k of HAIRSTYLES[save.look.body]) { const b = document.createElement('button'); b.className = 'txt' + (save.look.hairStyle === k ? ' on' : ''); b.textContent = HAIR_NAMES[k];
    b.onclick = () => { save.look.hairStyle = k; save.look.hairLong = k === 'long'; applyLook(player, save.look); buildCreator(wardrobe); }; hs.appendChild(b); }
  if (save.look.body === 'm') { const b = document.createElement('button'); b.className = 'txt' + (save.look.beard ? ' on' : ''); b.textContent = save.look.beard ? 'Beard ✓' : 'Beard'; b.onclick = () => { save.look.beard = !save.look.beard; applyLook(player, save.look); buildCreator(wardrobe); }; hs.appendChild(b); }
  // realistic people: face (with its skin tone and hair), beard level, sunglasses, classic cut
  const real = PEOPLE.on; $('realRows').style.display = real ? '' : 'none'; $('classicRows').style.display = real ? 'none' : '';
  if (real) { const sex = save.look.body === 'm' ? 'm' : 'f', cur = faceFor(save.look), fc = $('swFace'); fc.innerHTML = '';
    for (const f of FACES[sex]) { const b = document.createElement('button'), sk = PEOPLE_BASES[f].skin.map(v => Math.round(v * 255)); b.className = 'txt' + (cur === f ? ' on' : '');
      b.innerHTML = `<span style="color:rgb(${sk})">●</span> ${FACE_NAMES[f]}`; b.onclick = () => { save.look.face = f; save.look.skin = '#' + sk.map(v => v.toString(16).padStart(2, '0')).join(''); applyLook(player, save.look); buildCreator(wardrobe); }; fc.appendChild(b); }
    if (sex === 'm') for (const [lv, n] of [[0, 'No beard'], [35, 'Stubble'], [80, 'Beard']]) { const on = (save.look.beard ? (save.look.beardLevel || 80) : 0) === lv; const b = document.createElement('button'); b.className = 'txt' + (on ? ' on' : ''); b.textContent = n;
      b.onclick = () => { save.look.beard = lv > 0; save.look.beardLevel = lv || undefined; applyLook(player, save.look); buildCreator(wardrobe); }; fc.appendChild(b); }
    const gl = $('swGlasses'); gl.innerHTML = ''; for (const [k, n] of GLASSES) { const b = document.createElement('button'); b.className = 'txt' + ((save.look.glasses || '') === k ? ' on' : ''); b.textContent = n; b.onclick = () => { save.look.glasses = k; applyLook(player, save.look); buildCreator(wardrobe); }; gl.appendChild(b); } }
  const showCut = real && (save.look.style || 'solid') === 'solid'; $('cutRow').style.display = showCut ? '' : 'none';
  if (showCut) { const cu = $('swCut'); cu.innerHTML = ''; const cuts = save.look.body === 'm' ? [['tank', 'Tank & shorts'], ['polo', 'Polo & shorts']] : [['tank', 'Party top & denim'], ['tee', 'Tee & jeans']];
    for (const [k, n] of cuts) { const b = document.createElement('button'); b.className = 'txt' + ((save.look.cut || cuts[0][0]) === k ? ' on' : ''); b.textContent = n; b.onclick = () => { save.look.cut = k; applyLook(player, save.look); buildCreator(wardrobe); }; cu.appendChild(b); } }
  const st = $('swStyle'); st.innerHTML = ''; for (const k of save.owned) { if (!STYLES[k]) continue; const b = document.createElement('button'); b.className = 'txt' + (save.look.style === k ? ' on' : ''); b.textContent = STYLES[k].n; b.onclick = () => { save.look.style = k; applyLook(player, save.look); buildCreator(wardrobe); }; st.appendChild(b); }
}
function openWardrobe() { buildCreator(true); state.ui = 'creator'; state.wardrobe = true; $('creator').classList.remove('hidden'); }
function beginPlay(msg) { state.started = true; $('hud').classList.remove('hidden'); syncButtons(); renderMini(true); setMusic(); if (msg) toast(msg); }
function openCreator() { buildCreator(false); state.ui = 'creator'; $('creator').classList.remove('hidden'); state.started = false; }
$('crDone').onclick = () => { save.look.name = ($('crName').value || 'Guest').slice(0, 16); persist(); updateBand(); $('creator').classList.add('hidden'); state.ui = null;
  if (!state.wardrobe) { if (trip) trip.afterCreator(); else { arrival.start(); beginPlay(`✈️ Welcome to Las Vegas, ${save.look.name}! Your bag is coming out on Carousel 11.`); } } state.wardrobe = false; };
// 18+ gate: pick Free Play (sandbox, the default) or the Epic or Fail: Vegas Trip story mode
let gateMode = URL_TRIP ? 'trip' : 'free';
function pickGateMode(m) { gateMode = m; document.querySelectorAll('#gateModes [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('gateYes').textContent = m === 'trip' ? "I'm 18 or older · Start the trip" : "I'm 18 or older · Enter"; }
document.querySelectorAll('#gateModes [data-mode]').forEach(b => b.onclick = () => pickGateMode(b.dataset.mode)); pickGateMode(gateMode);
$('gateYes').onclick = () => { $('gate').classList.add('hidden'); state.audioUnlocked = true;
  if (gateMode === 'trip') startTripMode(); else openCreator(); };
$('gateNo').onclick = () => { location.href = 'about:blank'; };

// ---------- movement / collisions ----------
function blocked(x, z, r) { const A = state.area;
  if (A.ring) { const R = A.ring, dx = x - R.cx, dz = z - R.cz, d = Math.hypot(dx, dz); if (d < R.r0 + r || d > R.r1 - r) return true;
    if (d > R.w0 - r && d < R.w1 + r) { const a = Math.atan2(dz, dx); if (!R.doors.some(ad => Math.abs(angleWrap(a - ad)) * d < R.half - r)) return true; }
    for (const c of A.circles || []) if (Math.hypot(x - c[0], z - c[1]) < c[2] + r) return true; }
  if (A.rects.length && !A.rects.some(q => x >= q[0] && x <= q[1] && z >= q[2] && z <= q[3])) return true;
  for (const b of A.aabbs) if (x > b[0] - r && x < b[1] + r && z > b[2] - r && z < b[3] + r) return true;
  if (A.id === 'strip' && r < 1 && Math.abs(x) < 15) for (const c of strip.traffic) if (Math.abs(c.x - x) < 1.4 && Math.abs(c.z - z) < 2.9) return true; // walking into traffic
  return false; }
// the convertible against traffic, other players' cars and the limo: each vehicle is a row of circles along its length
function carHit(x, z, h) { const fx = Math.sin(h), fz = Math.cos(h), P = [[x + fx * 1.3, z + fz * 1.3], [x, z], [x - fx * 1.3, z - fz * 1.3]];
  const hit = (ox, oz, oh, half) => { const ex = Math.sin(oh), ez = Math.cos(oh), n = Math.max(1, Math.round(half / 1.2)); for (let k = -n; k <= n; k++) { const cx = ox + ex * half * k / n * 0.8, cz = oz + ez * half * k / n * 0.8;
      for (const [px, pz] of P) if ((px - cx) ** 2 + (pz - cz) ** 2 < 3.4) return true; } return false; };
  for (const c of strip.traffic) if (Math.abs(c.z - z) < 9 && Math.abs(c.x - x) < 5 && hit(c.x, c.z, c.dir > 0 ? 0 : PI, 2.4)) return true;
  if (net) for (const o of net.vehicles()) if (Math.hypot(o.x - x, o.z - z) < 10 && hit(o.x, o.z, o.h, o.len)) return true;
  if (limo.grp.visible && !state.limo) { const g = limo.grp; if (Math.hypot(g.position.x - x, g.position.z - z) < 10 && hit(g.position.x, g.position.z, g.rotation.y, 5)) return true; }
  return false; }
function tryMove(o, dx, dz, r) { const p = o.position; if (!blocked(p.x + dx, p.z + dz, r)) { p.x += dx; p.z += dz; return true; } let ok = false; if (!blocked(p.x + dx, p.z, r)) { p.x += dx; ok = true; } else if (!blocked(p.x, p.z + dz, r)) { p.z += dz; ok = true; } return ok; }
function waterDepth(p) { for (const w of state.area.water) { if (w.rect && inRect(p, w.rect)) return w.depth; if (w.circle && Math.hypot(p.x - w.circle[0], p.z - w.circle[1]) < w.circle[2]) return w.depth; } return 0; }
let danceAcc = 0;
function update(dt, t) {
  const A = state.area; let ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x, iy = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.y;
  if (!state.started || state.ui) { ix = iy = 0; }
  ix = Math.max(-1, Math.min(1, ix)); iy = Math.max(-1, Math.min(1, iy));
  if (state.cine) { needle.updRide(dt, t); }
  else if (state.limo) { /* the limo drives itself */ }
  else if (state.ride) { /* riding with another player: net.js puts you in their seat */ }
  else if (state.driving) {
    const accel = iy * 22, maxV = 34; state.carSpeed += accel * dt; if (!iy) state.carSpeed *= Math.pow(0.4, dt); state.carSpeed = Math.max(-10, Math.min(maxV, state.carSpeed));
    state.carHeading -= ix * dt * 1.6 * Math.min(1, Math.abs(state.carSpeed) / 6) * Math.sign(state.carSpeed || 1);
    const h = state.carHeading, v = state.carSpeed * dt, nx = car.position.x + Math.sin(h) * v, nz = car.position.z + Math.cos(h) * v;
    if (Math.abs(v) > 0 && carHit(nx, nz, h) && !carHit(car.position.x, car.position.z, h)) { if (Math.abs(state.carSpeed) > 2.5) amb.bump(Math.abs(state.carSpeed) / 14); state.carSpeed *= -0.25; }
    else if (!tryMove(car, Math.sin(h) * v, Math.cos(h) * v, 2.0)) state.carSpeed *= -0.3;
    car.rotation.y = h; player.position.set(car.position.x + Math.cos(h) * 0.45 + Math.sin(h) * -0.2, 0.25, car.position.z - Math.sin(h) * 0.45 + Math.cos(h) * -0.2); /* driver's seat on the left; back against the seat back */ player.rotation.y = h; animate(player, t, 0, 'drive'); state.pmode = 'drive';
    if (!cam.manual) cam.yaw += (angleWrap(h + PI - cam.yaw)) * Math.min(1, dt * 3);
  } else if (state.walkTo) { const W = state.walkTo; W.t += dt; const dx = W.x - player.position.x, dz = W.z - player.position.z, d = Math.hypot(dx, dz);
    if (d < 0.3 || W.t > 3) { state.walkTo = null; state.moving = 0; animate(player, t, 0, ''); W.then(); }
    else { const sp = 3.4; player.position.x += dx / d * Math.min(d, sp * dt); player.position.z += dz / d * Math.min(d, sp * dt); player.rotation.y += angleWrap(Math.atan2(dx, dz) - player.rotation.y) * Math.min(1, dt * 10); state.moving = sp; animate(player, t, sp, ''); state.pmode = ''; }
  } else {
    const run = state.sprint || keys.ShiftLeft || keys.ShiftRight || Math.hypot(joy.x, joy.y) > 0.95; const sp = (run ? 11 : 6) * (waterDepth(player.position) > 0.7 ? 0.55 : 1);
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    let mx = fx * iy + rx * ix, mz = fz * iy + rz * ix; const m = Math.hypot(mx, mz); state.moving = 0;
    if (m > 0.05) { mx /= Math.max(1, m); mz /= Math.max(1, m); tryMove(player, mx * sp * dt, mz * sp * dt, 0.4); const target = Math.atan2(mx, mz); player.rotation.y += angleWrap(target - player.rotation.y) * Math.min(1, dt * 12); state.moving = sp * Math.min(1, m); if (state.emote) { state.emote = null; syncButtons(); } }
    else if (prefs.fp) player.rotation.y += angleWrap(cam.yaw + PI - player.rotation.y) * Math.min(1, dt * 12);
    const wd = waterDepth(player.position); state.baseY += ((A.id === 'strip' && Math.abs(player.position.x) > 14 && Math.abs(player.position.x) < 22 ? 0.15 : -wd) - state.baseY) * Math.min(1, dt * 8);
    if (state.air) { state.vy -= 14 * dt; state.jy += state.vy * dt; if (state.jy <= 0) { state.jy = 0; state.vy = 0; state.air = false; } }
    player.position.y = (A.floorY || 0) + state.baseY + state.jy;
    const seat = wd >= 0.6 && A.water.find(w => w.seat && w.circle && Math.hypot(player.position.x - w.circle[0], player.position.z - w.circle[1]) < w.circle[2]);
    const mode = state.air ? 'jump' : (wd >= 0.8 && !seat) ? 'swim' : state.emote ? state.emote : (seat && !state.moving ? 'sit' : '');
    animate(player, t, state.moving, mode); state.pmode = mode;
    if (state.emote === 'dance' && A.id === 'club' && inRect(player.position, club.danceRect) && !trip) { danceAcc += dt; if (danceAcc > 10) { danceAcc = 0; setCoins(save.coins + 5); toast('Dance streak +5 coins 🔥'); } }
  }
  cam.manual = Math.max(0, (cam.manual || 0) - dt);
  // interact prompt
  const it = state.started && !state.ui ? nearest() : null; state.near = it; const lbl = it ? (typeof it.label === 'function' ? it.label() : it.label) : '';
  $('btnAct').classList.toggle('hidden', !it); $('actLbl').textContent = lbl || 'Interact'; $('hint').textContent = it ? (isTouch ? `✋ ${lbl}` : `E · ${lbl}`) : ''; $('hint').classList.toggle('on', !!it && !isTouch);
  limo.update(dt, t); photo.pose();
  if (A.id === 'strip' && state.started && !state.limo && !state.cine) { let best = null, bd = 1e9; for (const l of strip.landmarks) { const d = Math.hypot(player.position.x - l.x, player.position.z - l.z); if (d < bd) { bd = d; best = l; } } $('areaName').textContent = `Las Vegas Strip · near ${best.name}${state.driving ? ' · 🚗 ' + Math.round(Math.abs(state.carSpeed) * 2.2) + ' mph' : ''}`; }
  if (A.id === 'lobby' && lobby.exitDoors) { const D = lobby.exitDoors; D.want = Math.hypot(player.position.x, player.position.z - 22) < 7 || state.walkTo ? 1 : 0; // lobby glass doors, inside
    if (D.k > 0.85 && !state.walkTo && state.moving > 0 && player.position.z > 23.2 && Math.abs(player.position.x) < 1.8 && Math.cos(player.rotation.y) > 0.5) exitToStrip(); }
  if (A.id === 'strip') { const d = strip.tileo, D = d.doors; if (D) { // TILEO KINGDOM glass doors: open as you walk up; walking into the open doorway takes you inside
      D.want = (!state.driving && !state.limo && !state.ride && Math.hypot(player.position.x - (d.doorX - 3), player.position.z - d.doorZ) < 8) || state.walkTo ? 1 : 0;
      if (D.k > 0.85 && !state.walkTo && !tpBusy && state.moving > 0 && player.position.x > d.doorX - 1.9 && Math.abs(player.position.z - d.doorZ) < 2.8 && Math.sin(player.rotation.y) > 0.5) enterTower(); } }
  if (A.id === 'strip' || A.showStrip) { const B = strip.blockers || (strip.blockers = []); B.length = 0; B.push({ x: car.position.x, z: car.position.z, len: 2.4 });
    if (!state.driving && !state.limo && !state.ride && Math.abs(player.position.x) < 14.5 && A.id === 'strip') B.push({ x: player.position.x, z: player.position.z, len: 0.4, ped: true });
    if (net) for (const o of net.vehicles()) B.push(o); strip.onHonk = c => { const d = Math.hypot(c.x - player.position.x, c.z - player.position.z); if (d < 80) amb.honk(1 / (1 + d / 25)); }; }
  for (const f of A.anim) f(t, dt, player.position); if (A.showStrip) for (const f of strip.anim) f(t, dt, player.position);
  if (arrival) arrival.update(dt);
  miniAcc += dt; if (miniAcc > (Q.key === 'low' ? 0.1 : 0.05)) { miniAcc = 0; renderMini(); }
  if (state.ui === 'mapFull') renderFullMap();
  if (trip) trip.update(dt, t);
}
function angleWrap(a) { while (a > PI) a -= PI * 2; while (a < -PI) a += PI * 2; return a; }
const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3();
const fpDir = new THREE.Vector3();
function updateCamera(dt) {
  const A = state.area, p = player.position;
  if (state.ui === 'photo' && photo.camera(dt)) return;
  if (state.ui === 'binoc' && needle.binocCamera()) return;
  if (state.cine && needle.cineCamera(dt)) return;
  if (state.limo && limo.camera(dt)) return;
  if (state.ride && net && net.rideCamera()) return;
  if (trip && trip.camera(dt)) return;
  if (camera.fov !== 62) { camera.fov = 62; camera.updateProjectionMatrix(); }
  const cr = state.ui === 'creator'; // creator preview: 3/4 portrait of the guest, framed to the right of the panel
  player.visible = !prefs.fp || cr;
  if (cr) { player.rotation.y = cam.yaw - 0.35; const d = 3.3, sx = innerWidth > 700 ? -0.75 : 0, rx = Math.cos(cam.yaw) * sx, rz = -Math.sin(cam.yaw) * sx;
    camTarget.set(p.x + rx, p.y + 1.05, p.z + rz); camPos.set(camTarget.x + Math.sin(cam.yaw) * d, camTarget.y + 0.25, camTarget.z + Math.cos(cam.yaw) * d);
    if (innerHeight > innerWidth * 1.1) { // portrait: the panel is a bottom sheet, so aim low and the whole guest shows in the top half of the screen
      const dp = 4.6, h = 1.15, f = Math.tan(camera.fov * PI / 360), at = Math.atan((0.9 - h) / dp) - Math.atan(0.5 * f);
      camTarget.set(p.x, p.y + h + Math.tan(at) * dp, p.z); camPos.set(p.x + Math.sin(cam.yaw) * dp, p.y + h, p.z + Math.cos(cam.yaw) * dp); }
    camera.position.lerp(camPos, Math.min(1, dt * 10)); camera.lookAt(camTarget); CHAR.camPos.copy(camera.position); return; }
  if (prefs.fp) { const pitch = cam.pitch - 0.2, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), eye = p.y + (state.driving ? 1.12 : 1.62);
    camera.position.set(p.x + fx * 0.12, eye, p.z + fz * 0.12); fpDir.set(fx * Math.cos(pitch), -Math.sin(pitch), fz * Math.cos(pitch)).add(camera.position); camera.lookAt(fpDir); CHAR.camPos.copy(camera.position); return; } const d = cam.dist; camTarget.set(p.x, p.y + (state.driving ? 1.6 : 1.7) + (cam.lift || 0), p.z);
  camPos.set(p.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * d, camTarget.y + Math.sin(cam.pitch) * d, p.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * d);
  if (A.rects.length && !A.bbox) { let dd = d; const inA = () => A.rects.some(r => camPos.x > r[0] + 0.3 && camPos.x < r[1] - 0.3 && camPos.z > r[2] + 0.3 && camPos.z < r[3] - 0.3); // keep the camera on the walkable deck (e.g. not behind the pool elevator wall)
    for (let k = 0; k < 10 && dd > 1.6 && !inA(); k++) { dd *= 0.82; camPos.x = p.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * dd; camPos.z = p.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * dd; } }
  if (A.bbox) { const Bx = A.bbox, mg = 0.9; let dd = d; const inB = () => camPos.x > Bx[0] + mg && camPos.x < Bx[1] - mg && camPos.z > Bx[2] + mg && camPos.z < Bx[3] - mg; // pull in toward the guest instead of pressing against a wall
    for (let k = 0; k < 12 && dd > 1.4 && !inB(); k++) { dd *= 0.85; camPos.x = p.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * dd; camPos.z = p.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * dd; }
    camPos.x = Math.min(A.bbox[1] - 0.3, Math.max(A.bbox[0] + 0.3, camPos.x)); camPos.z = Math.min(A.bbox[3] - 0.3, Math.max(A.bbox[2] + 0.3, camPos.z)); }
  if (A.ring) { const R = A.ring; let dd = d; const rr = () => Math.hypot(camPos.x - R.cx, camPos.z - R.cz); // keep the camera off the elevator core and inside the railing
    for (let k = 0; k < 12 && dd > 1.2 && (rr() < R.r0 + 0.6 || rr() > R.r1 + 1.2); k++) { dd *= 0.82; camPos.x = p.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * dd; camPos.z = p.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * dd; }
    if (rr() < R.w1 + 0.2) camPos.y = Math.min(R.ceil, camPos.y); }
  if (A.ceiling) camPos.y = Math.min(A.ceiling, camPos.y); camPos.y = Math.max((A.floorY || 0) + 0.4, camPos.y);
  camera.position.lerp(camPos, Math.min(1, dt * 10)); camera.lookAt(camTarget); CHAR.camPos.copy(camera.position);
}
let frames = 0, last = performance.now(), t = 0; const photoDof = { on: false, focus: 1 };
function loop() { const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt; if (window.__preHook) window.__preHook(dt, t); update(dt, t); comp.update(dt, t); updateCamera(dt); if (window.__camHook) window.__camHook(camera, dt, t); if (net) net.update(dt, t); syncCharacters(dt); { const pp = state.driving ? car.position : player.position; amb.update(dt, { area: state.area.id, tod: state.tod, pos: pp, traffic: strip.traffic, limo: !!state.limo, driving: state.driving, inCasino: state.area.id === 'lobby' && pp.x > 20 }); } gfx.st.photo = photo.st.on && photo.st.mode === 'selfie' ? (photoDof.on = true, photoDof.focus = Math.max(0.6, photo.st.arm), photoDof) : null; gfx.update(dt, state.driving ? car.position : player.position, t); if (state.area.outdoor) updateWaters(t, camera, gfx.sunDir, gfx.sun.color); gfx.render(); photo.afterRender(); frames++; requestAnimationFrame(loop); }

// ---------- boot ----------
gfx.applyQuality(); renderQualityUI();
applyLook(player, save.look); setCoins(save.coins); updateBand(); syncButtons();
enterArea('strip', 40, -318, -PI / 2 + 0.25); cam.pitch = 0.18; camera.position.set(30, 4, -316);
loop();
// loading screen (DJ Tileo): wait for both logo textures, min ~1s so the brand is seen
function showLoading(p = 0.35, txt = 'Loading the Strip…') { $('loading').classList.remove('hidden'); $('loadBar').style.width = (p * 100) + '%'; $('loadTxt').textContent = txt; }
{ const t0 = performance.now(); logoMaterial('dj'); logoMaterial('resort'); let n = 0; $('loadBar').style.width = '30%';
  const step = () => { n++; $('loadBar').style.width = (30 + n * 23) + '%'; };
  const rig = Promise.race([rigReady.catch(() => {}), new Promise(r => setTimeout(r, 20000))]); // characters (GLB rigs + animation library); never block forever
  logoReady.dj.then(step); logoReady.resort.then(step); rig.then(() => { step(); $('loadTxt').textContent = 'Guests arriving…'; });
  Promise.all([logoReady.dj, logoReady.resort, rig]).then(() => { $('loadTxt').textContent = 'Doors open · welcome to TILEO KINGDOM';
    setTimeout(() => $('loading').classList.add('hidden'), Math.max(250, 1100 - (performance.now() - t0))); }); }

// ---------- teleport (v4) ----------
const TP_LMK = [['Bellissimo', '⛲', 'Bellissimo Fountains'], ['Luxe Pyramid', '🔺'], ['Emerald City Grand', '💚'], ['Flamingo Pink', '🦩'], ['Kingdom of Rome', '🏛️'], ['Venezia Grand', '🚤'], ['Power Chord', '🎸'], ['Aurum', '🥂'], ['Bravo', '🌸'], ['Sky Needle', '🗼'], ['Sin City International', '🛬', 'Airport curb']];
const TPD = [{ id: 'car', icon: '🚗', name: 'My Car' }, { id: 'entrance', icon: '👑', name: 'Tileo Kingdom entrance' }, { id: 'lobby', icon: '🛎️', name: 'Lobby' }, { id: 'casino', icon: '🎰', name: 'Casino' },
  { id: 'pool', icon: '🏝️', name: 'Pool Deck' }, { id: 'club', icon: '🎧', name: 'Mega Club' }, { id: 'suite', icon: '🛏️', name: 'My Suite' },
  { id: 'needleTop', icon: '🗼', name: 'Sky Needle Top' }, { id: 'limo', icon: '🚘', name: 'Limo ride' }, { id: 'airport', icon: '✈️', name: 'Airport · baggage claim' },
  ...TP_LMK.map(([lm, icon, name]) => ({ id: 'lm:' + lm, icon, name: name || lm, lm }))];
const tpById = id => TPD.find(d => d.id === id);
let tpBusy = false, mapPins = [];
prefs.tpSeat = !!prefs.tpSeat; $('tpSeat').checked = prefs.tpSeat; $('tpSeat').onchange = () => { prefs.tpSeat = $('tpSeat').checked; savePrefs(); };
function tpArea(d) { return d.id === 'needleTop' ? 'needle' : d.id === 'car' || d.id === 'entrance' || d.id === 'limo' || d.lm ? 'strip' : d.id === 'casino' ? 'lobby' : d.id === 'suite' ? 'room' : d.id; }
function openTeleport() { if (!state.started) return; toggleWheel(false); const box = $('tpList'); box.innerHTML = '';
  for (const d of TPD) { const b = document.createElement('button'); b.dataset.tp = d.id; let sub = '';
    if (d.id === 'suite' && !save.room) { b.classList.add('locked'); sub = 'check in first'; }
    else if (d.id === 'suite') sub = 'Suite ' + save.room;
    else if (d.id === 'needleTop') sub = '238 m deck · 360° views'; else if (d.id === 'limo') sub = state.limo ? 'riding now' : 'chauffeured Strip cruise'; else if (d.id === 'airport') sub = 'Booze Library · limos';
    else if (d.id === 'car') { const p = state.area.id === 'strip' ? (state.driving ? car.position : player.position) : null; sub = state.driving ? 'you are driving' : p ? Math.round(Math.hypot(p.x - car.position.x, p.z - car.position.z)) + ' m away' : 'parked on the Strip'; }
    if (tpArea(d) === state.area.id && d.id !== 'car' && !d.lm && d.id !== 'entrance') b.classList.add('here');
    b.innerHTML = `${d.icon}<span>${d.name}</span>${sub ? `<small>${sub}</small>` : ''}`; b.onclick = () => teleport(d.id); box.appendChild(b); }
  showUI('teleport'); }
$('mapTp').onclick = () => openTeleport();
function safeSpot(x, z, r = 0.45) { const ok = (a, b) => !blocked(a, b, r) && waterDepth({ x: a, z: b }) < 0.3;
  if (ok(x, z)) return { x, z }; for (let rad = 1; rad <= 24; rad += 1) for (let k = 0; k < 16; k++) { const a = k / 16 * PI * 2, qx = x + Math.cos(a) * rad, qz = z + Math.sin(a) * rad; if (ok(qx, qz)) return { x: qx, z: qz }; }
  return { x, z }; }
function parkCar() { if (!state.driving) return; state.driving = false; state.carSpeed = 0; toggleLights(false); cam.dist = 7; }
function teleport(id) { const d = tpById(id); if (!d || !state.started || tpBusy) return;
  if (id === 'suite' && !save.room) { closeUI(); toast('🛏️ Check in first: visit the front desk in the Tileo Kingdom lobby to get your suite.'); return; }
  if (id === 'car' && state.driving) { closeUI(); toast("🚗 You're already in the driver seat."); return; }
  if (id === 'limo' && state.limo) { closeUI(); toast('🚘 You are already riding in the limo.'); return; }
  if (trip && !trip.canEnter(tpArea(d), d)) { if (state.ui === 'teleport' || state.ui === 'mapFull') closeUI(); return; }
  closeUI(); toggleWheel(false); tpBusy = true; const f = $('fade'); f.classList.add('tp'); void f.offsetWidth; f.classList.add('on');
  setTimeout(() => { try { tpArrive(d); } catch (e) { console.error('teleport', e); }
    setTimeout(() => { f.classList.remove('on'); setTimeout(() => { f.classList.remove('tp'); tpBusy = false; }, 420); }, 420); }, 430); }
function tpArrive(d) { const to = tpArea(d), keepCar = state.driving && to === 'strip' && d.id !== 'car';
  if (!keepCar) parkCar(); state.emote = null; state.air = false;
  let x = 0, z = 0, yaw = 0, side = 1, carSeat = false;
  if (d.lm || d.id === 'entrance') { const l = d.lm ? lmk(d.lm) : { x: strip.tileo.doorX, z: strip.tileo.doorZ }; side = l.x < 0 ? -1 : 1;
    if (d.id === 'entrance') { x = strip.tileo.doorX - 8 * side; z = strip.tileo.doorZ; } else { x = side * 18; z = l.z; } yaw = side < 0 ? PI / 2 : -PI / 2; }
  else if (d.id === 'car') { const h = car.rotation.y; x = car.position.x - Math.cos(h) * 2.0; z = car.position.z + Math.sin(h) * 2.0; yaw = h + PI; carSeat = prefs.tpSeat; }
  else if (d.id === 'lobby') ({ x, z, yaw } = lobby.spawnDoor);
  else if (d.id === 'casino') { x = 27; z = 4; yaw = -PI / 2; }
  else if (d.id === 'needleTop') ({ x, z, yaw } = needleA.spawn);
  else if (d.id === 'limo') { x = 17.5; z = -330; yaw = -PI / 2; }
  else if (d.id === 'suite') { const dr = rooms.doors.find(q => q.num === save.room); if (dr) state.lastDoor = { side: dr.side, z: dr.z }; x = 0; z = 7.5; yaw = 0; }
  else ({ x, z, yaw } = areas[to].spawnElev);
  enterArea(to, x, z, yaw);
  if (to === 'pool' || to === 'club') areas[to].elevDoor && (areas[to].elevDoor.force = 1.5);
  if (keepCar) { const q = safeSpot(side * 7, z, 2.2); car.position.set(q.x, 0, q.z); state.carHeading = car.rotation.y = side < 0 ? PI : 0; state.carSpeed = 0; cam.yaw = state.carHeading + PI; }
  else { let q = safeSpot(player.position.x, player.position.z); if (d.id === 'car' && Math.hypot(q.x - x, q.z - z) > 1) { const h = car.rotation.y, o = safeSpot(car.position.x + Math.cos(h) * 2.0, car.position.z - Math.sin(h) * 2.0); if (Math.hypot(o.x - car.position.x, o.z - car.position.z) < Math.hypot(q.x - car.position.x, q.z - car.position.z)) q = o; }
    player.position.set(q.x, areas[to].floorY || 0, q.z); }
  if (carSeat) { enterCar(); cam.yaw = car.rotation.y + PI; }
  if (d.id === 'limo') { limo.start(prefs.limoColor || 'white'); updateCamera(1); syncButtons(); renderMini(true); return; }
  updateCamera(1); // snap the camera while the screen is covered
  syncButtons(); renderMini(true); if (!carSeat) toast(`🌀 Teleported to ${d.name}${keepCar ? ' (with your convertible)' : ''}`); }
function tpPins(A, P, g) { const pins = [];
  if (A.id === 'strip') { for (const d of TPD) { if (d.lm) { const l = lmk(d.lm); if (l) pins.push({ id: d.id, uv: P(l.x, l.z) }); } }
    const tk = lmk('TILEO KINGDOM'); if (tk) pins.push({ id: 'entrance', uv: P(tk.x, tk.z) }); { const uv = P(NEEDLE_X, NEEDLE_Z); pins.push({ id: 'needleTop', uv: [uv[0], uv[1] - 22] }); } pins.push({ id: 'limo', uv: P(17, -330) }); pins.push({ id: 'car', uv: P(car.position.x, car.position.z) }); return pins; }
  const here = { needle: [['needleTop', needleA.spawn]], lobby: [['lobby', lobby.spawnDoor], ['casino', { x: 27, z: 4 }]], pool: [['pool', pool.spawnElev]], club: [['club', club.spawnElev]], room: [['suite', { x: 0, z: 7.5 }]], airport: [['airport', airport.spawnElev]] }[A.id] || [];
  g.font = 'bold 14px sans-serif'; g.textAlign = 'center';
  for (const [id, sp] of here) { const uv = P(sp.x, sp.z); pins.push({ id, uv }); g.fillStyle = '#ffcf4a'; g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeText('🌀 ' + tpById(id).name, uv[0], uv[1] - 14); g.fillText('🌀 ' + tpById(id).name, uv[0], uv[1] - 14); g.lineWidth = 1; }
  return pins; }
mapCv.addEventListener('click', e => { const r = mapCv.getBoundingClientRect(), x = (e.clientX - r.left) * mapCv.width / r.width, y = (e.clientY - r.top) * mapCv.height / r.height;
  let best = null, bd = 30; for (const pn of mapPins) { const dd = Math.hypot(pn.uv[0] - x, pn.uv[1] - y); if (dd < bd) { bd = dd; best = pn; } } if (best) teleport(best.id); });
// ---------- v5: limo hail ----------
function openHail(fromPhone) { if (!state.started) return; if (state.limo) { closeUI(); return toast('🚘 You are already riding.'); } toggleWheel(false);
  $('hailWhite').classList.toggle('on', (prefs.limoColor || 'white') === 'white'); $('hailBlack').classList.toggle('on', prefs.limoColor === 'black');
  $('hailNote').textContent = fromPhone && !(state.area.id === 'strip' && Math.hypot(player.position.x - 17, player.position.z + 330) < 30) ? 'Your chauffeur picks you up at the TILEO KINGDOM entrance.' : 'Waiting at the TILEO KINGDOM curb.'; showUI('limoHail'); }
function hailLimo(color) { prefs.limoColor = color; savePrefs(); closeUI(); if (state.cine) return;
  const go = () => { limo.start(color); updateCamera(1); syncButtons(); renderMini(true); };
  if (state.area.id === 'strip' && Math.hypot(player.position.x - 17, player.position.z + 330) < 30) transition(go); else transition(() => { parkCar(); enterArea('strip', 17.5, -330, -PI / 2); go(); }); }
// test/debug hook (used by the local smoke test)
window.__game = { amb, areas, state, player, car, cam, save, enterArea, setNight, setTod, setQuality, gfx, Q, scene, camera, checkIn, openSlots, openElevator, enterCar, exitCar, showLoading, showKeycard, frames: () => frames, renderer, applyLook, CHAR, rigStatus, prefs, setEmote, jump, toggleSprint, toggleCam, toggleMini, toggleWheel, toggleLights, horn, openMap, openPhone, openCredits, syncButtons, teleport, openTeleport, TPD, mapPins: () => mapPins, tpBusy: () => tpBusy, blocked, waterDepth, limo, needle, photo, needleA, openHail, hailLimo, updateCamera: d => updateCamera(d), step: (n = 1, dt = 0.05) => { for (let k = 0; k < n; k++) { t += dt; update(dt, t); comp.update(dt, t); updateCamera(dt); } },
  start: () => { $('gate').classList.add('hidden'); $('creator').classList.add('hidden'); state.ui = null; state.started = true; $('hud').classList.remove('hidden'); syncButtons(); renderMini(true); setMusic(); } };

// ---------- v6.2: online players, chat, parties and TILEO accounts (website build: config.js sets TILEO_RELAY_URL) ----------
function applyProfile(p) { // a guest saved to the player's TILEO account
  if (MODE === 'trip') return; // a Vegas Trip run never loads (or overwrites) the account's Free Play guest
  if (typeof p.coins === 'number' && isFinite(p.coins)) save.coins = Math.max(0, Math.round(p.coins));
  if (Array.isArray(p.owned)) save.owned = [...new Set(['solid', ...p.owned.filter(k => typeof k === 'string' && Object.prototype.hasOwnProperty.call(STYLES, k))])];
  save.room = typeof p.room === 'number' || typeof p.room === 'string' ? p.room : null; save.bonusDay = typeof p.bonusDay === 'string' ? p.bonusDay : '';
  if (p.look && typeof p.look === 'object') { save.look = Object.assign({}, save.look, p.look); if (!HAIRSTYLES[save.look.body === 'm' ? 'm' : 'f'].includes(save.look.hairStyle)) save.look.hairStyle = HAIRSTYLES[save.look.body === 'm' ? 'm' : 'f'][0]; }
  localStorage.setItem(SAVE_KEY, JSON.stringify(save)); applyLook(player, save.look); setCoins(save.coins); updateBand();
  if (state.ui === 'creator') buildCreator(!!state.wardrobe);
}
function goToSpot(area, x, z, done) { // "Go to" a friend from the Online sheet
  if (!state.started || tpBusy || state.cine || !areas[area]) return; if (trip && !trip.canEnter(area)) return; closeUI(); toggleWheel(false);
  transition(() => { parkCar(); enterArea(area, x, z); const q = safeSpot(x, z); player.position.set(q.x, areas[area].floorY || 0, q.z); updateCamera(1); syncButtons(); renderMini(true); if (done) done(); });
}
net = initNet({ $, state, player, car, scene, camera, save, toast, showUI, closeUI, persist, applyProfile, goTo: goToSpot, isTouch, chime: () => amb.chime('spin'), limo, comp, tripPres: () => trip ? trip.presence() : 0 });
window.__game.net = net; window.__game.comp = comp; Object.assign(window.__game, { closeUI, showUI, setCoins, C5, ctx, music, openMusic, cycleRadio, setMusic, airport, strip, enterAirport, get arrival() { return arrival; } }); window.__game.carHit = carHit; window.__game.syncCharacters = syncCharacters;

// ---------- v7: Epic or Fail: Vegas Trip (story mode, loaded from trip/ only when picked) ----------
async function startTripMode() {
  if (MODE === 'trip') return trip; MODE = 'trip'; SAVE_KEY = TRIP_KEY; document.body.classList.add('tripMode');
  const fpLook = { ...save.look }; let ts = null; try { ts = JSON.parse(localStorage.getItem(TRIP_KEY) || 'null'); } catch (e) { ts = null; }
  for (const k of Object.keys(save)) delete save[k]; // the same save object (every module holds it) now holds the trip; Free Play's key is left alone
  Object.assign(save, ts && ts.look ? ts : { coins: 0, owned: ['solid'], room: 2407, bonusDay: '', look: { ...fpLook, style: 'solid', banded: true } });
  save.owned = ['solid']; save.room = 2407;
  showLoading(0.7, 'Packing for Vegas…');
  try { const m = await import('./trip/trip.js?v=1794015301');
    trip = await m.initTrip({ $, THREE, state, player, car, cam, camera, scene, save, prefs, savePrefs, areas, strip, lobby, pool, rooms, room, club, needleA, ctx, C5, comp, limo, needle, photo, gfx, amb, net, isTouch,
      toast, setCoins, persist, transition, enterArea, showUI, closeUI, setTod, applyLook, makeCharacter, animate, STYLES, EMOTES, CHAR, waterDepth, blocked, safeSpot, inRect, teleport, updateBand, syncButtons, renderMini,
      updateCamera: d => updateCamera(d), faceFor, beginPlay, openCreator, buildCreator, setEmote, parkCar, exitCar, lmk, tpBusy: () => tpBusy, keys, joy, arrival, airport }); }
  catch (e) { console.error('[trip]', e); toast('Could not load the Vegas Trip. Reload to try again.'); }
  $('loading').classList.add('hidden'); window.__game.trip = trip;
  if (trip) trip.begin(); else openCreator();
  return trip; }
window.__game.startTrip = startTripMode;
