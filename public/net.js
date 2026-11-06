// TILEO KINGDOM online (v6.2): other players live on the Strip, name tags, chat, private parties and TILEO accounts.
// Only the website build turns this on: it sets window.TILEO_RELAY_URL (config.js) to the TILEO KINGDOM server.
// Accounts are shared with TILEO Cruise Lines (same username and password); each game keeps its own saved profile.
// Public Strips (strangers) only allow the preset chat phrases (also enforced on the server); private parties chat freely.
import * as THREE from 'three';
import { makeCharacter, applyLook, animate, disposeCharacter, makeCar, BAND_C, STYLES, HAIRSTYLES, EMOTES, FACES } from './characters.js?v=1794000555';

export const QUICK_SAYS = ['Hi!', 'Follow me!', 'Meet me at the pool', 'Club tonight?', 'Nice outfit!', 'Race you down the Strip', 'Lucky streak!', 'Want a limo ride?', 'Good game!', 'Bye!'];
const AREA_LABEL = { strip: 'On the Strip', lobby: 'Lobby & Casino', pool: 'Pool Deck', rooms: 'Suites floor', room: 'In their suite', club: 'Mega Club', needle: 'Sky Needle deck' };
const MODES = new Set(['', 'jump', 'swim', 'sit', 'drive', ...Object.keys(EMOTES)]);
const PARTY_RE = /^[a-z0-9]{4,12}$/, HEX = /^#[0-9a-f]{6}$/i;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const cleanText = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, n);
const num = (v, a, b, d = 0) => (typeof v === 'number' && isFinite(v)) ? Math.max(a, Math.min(b, v)) : d;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } };

// a look received from another player: only known values get through
export function cleanLook(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const body = o.body === 'm' ? 'm' : 'f', hs = HAIRSTYLES[body];
  const L = { name: cleanText(o.name, 16) || 'Guest', skin: HEX.test(o.skin) ? o.skin : '#d9a47c', hair: HEX.test(o.hair) ? o.hair : '#1a1209', outfit: HEX.test(o.outfit) ? o.outfit : '#c9932e',
    style: typeof o.style === 'string' && own(STYLES, o.style) ? o.style : 'solid',
    hairLong: !!o.hairLong, banded: !!o.banded, body, hairStyle: hs.includes(o.hairStyle) ? o.hairStyle : hs[0], beard: body === 'm' && !!o.beard, beardLevel: num(o.beardLevel, 0, 100, 70) | 0,
    glasses: ['', 'aviator', 'round'].includes(o.glasses) ? o.glasses : '' };
  if (['tank', 'polo', 'tee'].includes(o.cut)) L.cut = o.cut;
  if (FACES[body] && FACES[body].includes(o.face)) L.face = o.face;
  return L;
}
const lookOut = L => cleanLook(L);

// G: { $, state, player, car, scene, camera, save, toast, showUI, closeUI, goTo(area, x, z, yaw), persist, applyProfile(p), isTouch, chime }
export function initNet(G) {
  const { $, state, save } = G;
  const url = typeof window.TILEO_RELAY_URL === 'string' && /^wss?:\/\//.test(window.TILEO_RELAY_URL) ? window.TILEO_RELAY_URL : '';
  const inClaude = !!(window.claude && typeof window.claude.use === 'function');
  const N = { on: !!url && !!window.WebSocket && !inClaude, ws: null, open: false, id: '', strip: 0, party: partyFromHash(), remotes: new Map(), sendT: 0, last: '', log: [], sayT: 0, tries: 0, timer: 0 };
  const tags = $('nameTags'), _v = new THREE.Vector3();
  $('btnPeople').classList.toggle('hidden', !N.on); document.querySelectorAll('[data-app="people"]').forEach(b => b.classList.toggle('hidden', !N.on)); document.querySelectorAll('.onlineOnly').forEach(e => e.classList.toggle('hidden', !N.on));

  // ---------------------------------------------------------------- connection
  function partyFromHash() { const m = /(?:^|[#&])party=([a-z0-9]{4,12})/i.exec(location.hash || ''); return m ? m[1].toLowerCase() : ''; }
  const setHash = c => { try { history.replaceState(null, '', location.pathname + location.search + (c ? '#party=' + c : '')); } catch (e) { } };
  const sendRaw = o => { if (N.ws && N.ws.readyState === 1) { try { N.ws.send(JSON.stringify(o)); } catch (e) { } } };
  function connect() {
    clearTimeout(N.timer); N.timer = 0; if (!N.on) return;
    let ws; try { ws = new WebSocket(url); } catch (e) { retry(); return; }
    N.ws = ws;
    ws.onopen = () => { N.tries = 0; sendRaw({ t: 'join', party: N.party }); };
    ws.onmessage = ev => { if (typeof ev.data !== 'string' || ev.data.length > 120000) return; let m; try { m = JSON.parse(ev.data); } catch (e) { return; } handle(m); };
    ws.onclose = () => { if (N.ws !== ws) return; N.ws = null; N.open = false; clearRemotes(); refresh(); retry(); };
    ws.onerror = () => { };
  }
  function retry() { clearTimeout(N.timer); const d = Math.min(15000, 1000 * Math.pow(1.6, N.tries++)); N.timer = setTimeout(connect, d); }
  function handle(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'welcome') {
      N.id = String(m.id || ''); N.strip = m.strip | 0; if (!m.party && N.party) { N.party = ''; setHash(''); }
      clearRemotes(); for (const p of Array.isArray(m.peers) ? m.peers : []) if (p && typeof p.id === 'string') readRemote(p.id, p.d);
      N.open = true; N.last = ''; N.sendT = 0; refresh();
    } else if (m.t === 'p' && typeof m.id === 'string') { readRemote(m.id, m.d); refresh(true); }
    else if (m.t === 'leave' && typeof m.id === 'string') { const R = N.remotes.get(m.id); if (R) { dropRemote(R); refresh(); } }
    else if (m.t === 'say' && typeof m.id === 'string') { const R = N.remotes.get(m.id), x = cleanText(m.x, 80); if (!R || !x || (!N.party && !QUICK_SAYS.includes(x))) return; addLog(R.name, x); R.say = x; R.sayUntil = performance.now() + 7000; G.chime && G.chime(); }
    else if (m.t === 'full') G.toast('👥 That party is full · you are on a public Strip instead.');
  }
  // a free server sleeps when nobody plays; a light check-in while connected keeps it awake for the people here
  const httpBase = url.replace(/^ws/, 'http').replace(/\/ws\/?$/, '');
  if (N.on) {
    setInterval(() => { if (N.open && !document.hidden) fetch(httpBase + '/health', { cache: 'no-store', mode: 'cors' }).catch(() => { }); }, 240000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !N.ws) connect(); });
    addEventListener('hashchange', () => { const c = partyFromHash(); if (c !== N.party) switchParty(c); });
    addEventListener('pagehide', () => { try { N.ws && N.ws.close(); } catch (e) { } });
    connect();
  }
  function switchParty(c) { N.party = c && PARTY_RE.test(c) ? c : ''; setHash(N.party); clearRemotes(); N.log = []; sendRaw({ t: 'join', party: N.party }); refresh(); }

  // ---------------------------------------------------------------- remote players
  function readRemote(id, d) {
    if (!d || typeof d !== 'object' || Array.isArray(d) || d.v !== 1) return;
    let R = N.remotes.get(id);
    if (!R) { R = { id, pos: new THREE.Vector3(), tpos: new THREE.Vector3(), yaw: 0, tyaw: 0, seen: 0, ch: null, lookKey: '', tag: null, car: null, say: '', sayUntil: 0 }; N.remotes.set(id, R); }
    R.look = cleanLook(d.L) || cleanLook({}); R.name = R.look.name;
    R.area = typeof d.a === 'string' && own(AREA_LABEL, d.a) ? d.a : 'strip';
    const P = Array.isArray(d.p) ? d.p : [];
    R.tpos.set(num(P[0], -900, 900), num(P[1], -5, 400), num(P[2], -900, 900)); R.tyaw = num(d.r, -20, 20);
    R.m = MODES.has(d.m) ? d.m : ''; R.s = num(d.s, 0, 40); R.hid = !!d.h;
    const tr = d.tr; R.tr = tr && typeof tr === 'object' && !Array.isArray(tr) ? { k: ['solo', 'bday', 'bach'].includes(tr.k) ? tr.k : 'solo', d: num(tr.d, 1, 5) | 0, b: typeof tr.b === 'string' ? tr.b.slice(0, 16) : '', w: num(tr.w, 0, 9) | 0, f: num(tr.f, 0, 200000) | 0, e: !!tr.e } : null;
    const D = Array.isArray(d.d) ? d.d : null; R.drive = D ? { x: num(D[0], -900, 900), z: num(D[1], -900, 900), h: num(D[2], -20, 20), l: !!D[3] } : null;
    const RD = Array.isArray(d.rd) ? d.rd : null; R.rd = RD && (RD[0] === 'car' || RD[0] === 'limo') && typeof RD[1] === 'string' ? { k: RD[0], host: RD[1].slice(0, 40), seat: num(RD[2], 0, 2) | 0 } : null;
    const LM = Array.isArray(d.lm) ? d.lm : null; R.lm = LM ? { s: num(LM[0], -1e7, 1e7), c: LM[1] === 'black' ? 'black' : 'white', st: !!LM[2] } : null; R.ps = !!d.ps;
    if (!R.seen) { R.pos.copy(R.tpos); R.yaw = R.tyaw; if (R.drive) R.cpos = { ...R.drive }; }
    R.seen = performance.now();
  }
  function hideRemote(R) { if (R.ch) R.ch.visible = false; if (R.car) R.car.visible = false; if (R.lmo) R.lmo.visible = false; if (R.tag) R.tag.style.display = 'none'; }
  function dropRemote(R) { dropShell(R); if (R.ch) disposeCharacter(R.ch); if (R.car) { R.car.visible = false; carPool.push(R.car); } if (R.tag) R.tag.remove(); N.remotes.delete(R.id); }
  function clearRemotes() { for (const R of [...N.remotes.values()]) dropRemote(R); }
  // remote convertibles are pooled and never carry a real spotlight (a new light would recompile every shader)
  const carPool = []; let carsMade = 0;
  function takeCar() { if (carPool.length) return carPool.pop(); if (carsMade >= 6) return null; carsMade++; const c = makeCar(); const b = c.userData.beam; if (b) { c.remove(b, b.target); c.userData.beam = null; } G.scene.add(c); return c; }
  const angW = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  // other players' limo rides: copies of the limo (pooled, at most 3), driven along the same route from the host's position s
  const shellPool = []; let shellsMade = 0;
  function takeShell(color) { let sh = shellPool.pop(); if (!sh && shellsMade < 3 && G.limo) { shellsMade++; sh = G.limo.makeShell(color); } if (sh) { sh.visible = true; sh.userData.paint.color.set(color === 'black' ? 0x0c0c0e : 0xf4f2ee); } return sh; }
  function dropShell(R) { if (R.lmo) { R.lmo.visible = false; shellPool.push(R.lmo); R.lmo = null; R.lms = undefined; } }
  const PASS = new THREE.Vector3(-0.45, 0.25, -0.2), _s = new THREE.Vector3();
  // the vehicle someone rides in: mine (I'm the host) or another player's
  function hostVehicle(rd) { if (!rd) return null;
    if (rd.host === N.id) { if (rd.k === 'car' && state.driving) return { o: G.car, k: 'car' }; if (rd.k === 'limo' && state.limo && G.limo.grp.visible) return { o: G.limo.grp, k: 'limo' }; return null; }
    const H = N.remotes.get(rd.host); if (!H) return null;
    if (rd.k === 'car' && H.drive && H.car && H.car.visible) return { o: H.car, k: 'car', H }; if (rd.k === 'limo' && H.lm && H.lmo && H.lmo.visible) return { o: H.lmo, k: 'limo', H }; return null; }
  function seatIn(veh, seat, ch, t, me) { if (veh.k === 'car') { _s.copy(PASS); veh.o.localToWorld(_s); ch.position.copy(_s); ch.rotation.y = veh.o.rotation.y; animate(ch, t, 0, 'drive'); }
    else { G.limo.seatWorld(veh.o, seat, _s); ch.position.copy(_s); ch.rotation.y = veh.o.rotation.y + Math.PI / 2; animate(ch, t, 0, 'sit'); } }

  function update(dt, t) {
    if (!N.on) return;
    send(dt); G.camera.updateMatrixWorld();
    const myArea = state.area && state.area.id, cam = G.camera.position, now = performance.now(), vis = [];
    for (const R of N.remotes.values()) { // limo rides (the route is shared, so only the position along it travels)
      if (R.lm && myArea === 'strip') { if (!R.lmo) R.lmo = takeShell(R.lm.c); if (R.lmo) { const L = G.limo.LEN; if (R.lms === undefined || Math.abs(R.lm.s - R.lms) > 60) R.lms = R.lm.s; else R.lms += (R.lm.s - R.lms) * Math.min(1, dt * 6);
          const r = G.limo.routeAt(R.lms); R.lmo.visible = true; R.lmo.position.set(r.x, 0.02, r.z); R.lmo.rotation.y = r.h; R.lmo.updateMatrixWorld(true); animate(R.lmo.userData.drv, t, 0, 'drive'); R.tpos.set(r.x, 0, r.z); } }
      else dropShell(R); }
    for (const R of N.remotes.values()) { R.veh = R.rd ? hostVehicle(R.rd) : null; if (R.veh) R.tpos.copy(R.veh.o.position);
      R.here = !!myArea && R.area === myArea && myArea !== 'room' && !R.hid && R.tpos.distanceTo(cam) < 220; if (R.here) vis.push(R); else hideRemote(R); }
    vis.sort((a, b) => a.tpos.distanceToSquared(cam) - b.tpos.distanceToSquared(cam));
    const W = innerWidth, H = innerHeight, uiOpen = !!state.ui && state.ui !== 'mapFull';
    vis.forEach((R, i) => {
      if (i >= 24) { hideRemote(R); return; }
      const key = JSON.stringify(R.look);
      if (!R.ch) { R.ch = makeCharacter(R.look); R.ch.userData.remote = true; G.scene.add(R.ch); R.lookKey = key; }
      else if (R.lookKey !== key) { R.lookKey = key; applyLook(R.ch, R.look); }
      const ch = R.ch; ch.visible = true;
      if (R.pos.distanceToSquared(R.tpos) > 81) R.pos.copy(R.tpos); else R.pos.lerp(R.tpos, 1 - Math.exp(-10 * dt));
      R.yaw += angW(R.tyaw - R.yaw) * Math.min(1, dt * 10);
      if (R.veh) seatIn(R.veh, R.rd.seat, ch, t); // riding with someone: sit in their seat
      else if (R.lmo) { G.limo.seatWorld(R.lmo, R.lm.st ? 99 : -1, _s); ch.position.copy(_s); ch.rotation.y = R.lmo.rotation.y; animate(ch, t, 0, R.lm.st ? 'wave' : 'sit'); }
      else { ch.position.copy(R.pos); ch.rotation.y = R.yaw; animate(ch, t, R.m === 'drive' ? 0 : R.s, R.m); }
      // their convertible
      if (R.drive && myArea === 'strip') { if (!R.car) R.car = takeCar();
        if (R.car) { const c = R.cpos || (R.cpos = { ...R.drive }); c.x += (R.drive.x - c.x) * Math.min(1, dt * 10); c.z += (R.drive.z - c.z) * Math.min(1, dt * 10); c.h += angW(R.drive.h - c.h) * Math.min(1, dt * 10);
          if (Math.hypot(R.drive.x - c.x, R.drive.z - c.z) > 12) Object.assign(c, R.drive);
          R.car.visible = true; R.car.position.set(c.x, 0, c.z); R.car.rotation.y = c.h; const hm = R.car.userData.headMat; if (hm) hm.emissiveIntensity = R.drive.l ? 2.4 : 0.6; } }
      else if (R.car) { R.car.visible = false; carPool.push(R.car); R.car = null; R.cpos = null; }
      // name tag + speech bubble
      if (!R.tag) { R.tag = document.createElement('div'); R.tag.className = 'ntag'; R.tag.innerHTML = '<i class="nbub"></i><span class="nname"></span>'; tags.appendChild(R.tag); }
      const nm = R.name + '|' + R.look.banded; if (R.tag.dataset.k !== nm) { R.tag.dataset.k = nm; const s = R.tag.querySelector('.nname'); s.textContent = R.name; s.style.setProperty('--band', R.look.banded ? BAND_C : 'transparent'); }
      const b = R.tag.querySelector('.nbub'), talking = R.say && now < R.sayUntil; if (b.dataset.x !== (talking ? R.say : '')) { b.dataset.x = talking ? R.say : ''; b.textContent = talking ? R.say : ''; b.style.display = talking ? '' : 'none'; }
      const tp = R.veh || R.lmo ? ch.position : R.pos, d = tp.distanceTo(cam); _v.set(tp.x, tp.y + (R.m === 'drive' || R.veh || R.lmo ? 1.6 : 2.05), tp.z).project(G.camera);
      if (_v.z > 1 || uiOpen || (d > 60 && !talking)) R.tag.style.display = 'none';
      else { R.tag.style.display = ''; R.tag.style.transform = `translate(${((_v.x + 1) / 2 * W).toFixed(1)}px, ${((1 - _v.y) / 2 * H).toFixed(1)}px) translate(-50%, -100%)`; R.tag.style.opacity = d > 35 ? Math.max(0.35, 1 - (d - 35) / 40).toFixed(2) : ''; }
    });
    if (N.ride) { const veh = hostVehicle(N.ride);
      if (!veh) { N.ride.lost += dt; if (N.ride.lost > 2.5) leaveRide(true); }
      else { N.ride.lost = 0; N.ride.last = veh.o.position.clone(); N.ride.h = veh.o.rotation.y; seatIn(veh, N.ride.seat, G.player, t); state.pmode = veh.k === 'car' ? 'drive' : 'sit'; state.moving = 0; } }
    // my own speech bubble
    const mt = $('myBubble'); if (mt) { const talking = N.mySay && now < N.mySayUntil; if (!talking || uiOpen) mt.style.display = 'none';
      else { _v.set(G.player.position.x, G.player.position.y + 2.05, G.player.position.z).project(G.camera); mt.style.display = _v.z > 1 ? 'none' : ''; mt.style.transform = `translate(${((_v.x + 1) / 2 * W).toFixed(1)}px, ${((1 - _v.y) / 2 * H).toFixed(1)}px) translate(-50%, -100%)`; } }
  }
  function send(dt) {
    if (!N.open || !state.started) return;
    N.sendT -= dt; if (N.sendT > 0) return; N.sendT = 0.1;
    const p = G.player.position, r = G.player.rotation.y, c = G.car;
    const pres = { v: 1, L: lookOut(save.look), a: state.area ? state.area.id : 'strip', p: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], r: +angW(r).toFixed(2),
      m: MODES.has(state.pmode || '') ? state.pmode || '' : '', s: +(state.moving || 0).toFixed(1), h: state.cine ? 1 : 0,
      rd: N.ride ? [N.ride.k, N.ride.host, N.ride.seat] : 0, lm: state.limo && G.limo.ride ? [+G.limo.ride.s.toFixed(1), G.limo.ride.color || 'white', G.limo.ride.stand ? 1 : 0] : 0, ps: G.comp && G.comp.inCar ? 1 : 0,
      d: state.driving ? [+c.position.x.toFixed(2), +c.position.z.toFixed(2), +angW(c.rotation.y).toFixed(2), state.lights ? 1 : 0] : 0, tr: G.tripPres ? G.tripPres() || 0 : 0 }; // tr: Vegas Trip status (0 in Free Play)
    const js = JSON.stringify(pres); if (js === N.last) return; N.last = js; sendRaw({ t: 'p', d: pres });
  }
  // ---------------------------------------------------------------- rides: hop into another player's convertible or limo
  function seatsTaken(H, k) { const used = new Set(); if (k === 'car' && H.ps) used.add(0); if (k === 'limo') used.add(0); // limo seat 0 is the host's invited guest
    for (const O of N.remotes.values()) if (O.rd && O.rd.host === H.id && O.rd.k === k) used.add(O.rd.seat); return used; }
  function joinRide(H, k) { if (!H || state.driving || state.limo || state.cine) return false;
    const used = seatsTaken(H, k), free = k === 'car' ? [0] : [1, 2]; const seat = free.find(x => !used.has(x));
    if (seat === undefined) { G.toast(k === 'car' ? `🚗 ${H.name}'s passenger seat is taken.` : `🚘 ${H.name}'s limo is full.`); return false; }
    N.ride = { k, host: H.id, seat, lost: 0 }; state.ride = N.ride; state.emote = null; N.last = '';
    G.toast(k === 'car' ? `🚗 Riding with ${H.name}. Press E (or ✋) to get out.` : `🚘 You're in ${H.name}'s limo. Press E (or ✋) to get out.`); return true; }
  function leaveRide(ended) { const r = N.ride; if (!r) return; N.ride = null; state.ride = null;
    if (r.last) { const h = r.h || 0, side = r.k === 'car' ? -2.3 : -3.1; G.player.position.set(r.last.x + Math.cos(h) * side, 0, r.last.z - Math.sin(h) * side); G.player.rotation.y = h; }
    G.player.visible = true; G.toast(ended ? '🚘 The ride ended. You hop out at the curb.' : '👋 You hop out.'); N.last = ''; }
  function rideAction() {
    if (N.ride) return { label: 'Get out', act: () => leaveRide(false) };
    if (!N.open || state.driving || state.limo || state.cine || !state.area || state.area.id !== 'strip') return null;
    const p = G.player.position; let best = null, bd = 1e9;
    for (const H of N.remotes.values()) {
      if (H.drive && H.car && H.car.visible) { const d = Math.hypot(H.car.position.x - p.x, H.car.position.z - p.z); if (d < 4.5 && d < bd) { bd = d; best = { label: `Ride with ${H.name} 🚗`, act: () => joinRide(H, 'car') }; } }
      if (H.lm && H.lmo && H.lmo.visible) { const d = Math.hypot(H.lmo.position.x - p.x, H.lmo.position.z - p.z); if (d < 7 && d < bd) { bd = d; best = { label: `Join ${H.name}'s limo 🚘`, act: () => joinRide(H, 'limo') }; } } }
    return best; }
  function rideCamera() { if (!N.ride || N.ride.k !== 'limo') return false; const veh = hostVehicle(N.ride); return veh ? G.limo.cabinCamera(veh.o) : false; }
  function vehicles() { const out = []; for (const R of N.remotes.values()) { if (R.car && R.car.visible) out.push({ x: R.car.position.x, z: R.car.position.z, h: R.car.rotation.y, len: 2.4 }); if (R.lmo && R.lmo.visible) out.push({ x: R.lmo.position.x, z: R.lmo.position.z, h: R.lmo.rotation.y, len: 4.6, limo: true }); } return out; }
  function say(text) {
    const x = cleanText(text, 80); if (!x) return false;
    if (!N.party && !QUICK_SAYS.includes(x)) { G.toast('💬 Free chat is for private parties · start one in Online and invite friends.'); return false; }
    const now = Date.now(); if (now - N.sayT < 1500) { G.toast('💬 One message every couple of seconds.'); return false; }
    N.sayT = now; sendRaw({ t: 'say', x }); addLog(save.look.name || 'You', x, true); N.mySay = x; N.mySayUntil = performance.now() + 7000; return true;
  }
  function addLog(name, x, me) { N.log.push({ name, x, me }); if (N.log.length > 40) N.log.shift(); if (state.ui === 'people') renderLog(); }

  // ---------------------------------------------------------------- Online sheet
  let refreshT = 0;
  function refresh(soft) {
    const n = N.remotes.size, badge = $('pplBadge'); badge.textContent = n ? String(n) : ''; badge.classList.toggle('hidden', !n); $('btnPeople').classList.toggle('off', !N.open);
    if (state.ui !== 'people') return; if (soft) { if (refreshT) return; refreshT = setTimeout(() => { refreshT = 0; if (state.ui === 'people') renderPeople(); }, 1000); return; } renderPeople();
  }
  function newCode() { const a = 'abcdefghjkmnpqrstuvwxyz23456789', r = new Uint32Array(6); crypto.getRandomValues(r); let s = ''; for (const v of r) s += a[v % a.length]; return s; }
  const inviteLink = c => location.origin + location.pathname + location.search + '#party=' + c;
  async function copyInvite() { const u = inviteLink(N.party); try { await navigator.clipboard.writeText(u); G.toast('🔗 Invite link copied · send it to friends'); } catch (e) { const i = $('inviteUrl'); i.classList.remove('hidden'); i.value = u; i.select(); G.toast('Copy the invite link below'); } }
  function renderLog() { const box = $('chatLog'); box.innerHTML = N.log.length ? N.log.slice(-14).map(l => `<div class="${l.me ? 'me' : ''}"><b>${esc(l.name)}</b> ${esc(l.x)}</div>`).join('') : '<div class="empty">No messages yet.</div>'; box.scrollTop = box.scrollHeight; }
  function renderPeople() {
    const myArea = state.area ? state.area.id : 'strip';
    $('pplSub').textContent = N.open ? `${N.remotes.size + 1} here right now` : 'Connecting… the server can take up to a minute to wake up';
    $('pplParty').innerHTML = N.party
      ? `<div><b>Private party · ${esc(N.party.toUpperCase())}</b><small>Only people with your invite link join you</small></div><button class="gold" id="pCopy">Copy invite</button><button class="ghost" id="pPublic">Public Strip</button>`
      : `<div><b>Public Strip ${N.strip || 1}</b><small>Anyone playing right now can appear here · preset chat only</small></div><button class="gold" id="pNew">Start a private party</button>`;
    const me = `<div class="pRow me"><span class="pDot here"></span><div><b>${esc(save.look.name || 'You')} <small>you</small></b><small>${esc(AREA_LABEL[myArea] || '')}</small></div></div>`;
    const others = [...N.remotes.values()].sort((a, b) => a.name.localeCompare(b.name)).map(R => {
      const here = R.area === myArea && myArea !== 'room', far = !here || R.tpos.distanceTo(G.player.position) > 15;
      const btn = R.area === 'room' || R.hid ? '' : (R.drive || R.lm) && !N.ride ? `<button class="ghost" data-ride="${esc(R.id)}">Ride along</button>` : far ? `<button class="ghost" data-go="${esc(R.id)}">Go to</button>` : '';
      return `<div class="pRow"><span class="pDot ${here ? 'here' : ''}" style="--band:${R.look.banded ? BAND_C : '#666'}"></span><div><b>${esc(R.name)}</b><small>${esc(R.rd ? (R.rd.k === 'car' ? 'Riding in a convertible' : 'Riding in a limo') : R.lm ? 'Riding in their limo' : R.drive ? 'Cruising the Strip' : AREA_LABEL[R.area] || '')}</small></div>${btn}</div>`;
    }).join('');
    $('pplList').innerHTML = me + (others || `<p class="empty">${N.party ? 'Nobody else at your party yet. Copy the invite link and send it to friends.' : 'Nobody else on this Strip right now. Start a private party and invite friends, or check back later.'}</p>`);
    $('chatRow').classList.toggle('hidden', !N.party);
    $('chatQuick').innerHTML = QUICK_SAYS.map(q => `<button class="tbet" data-q="${esc(q)}">${esc(q)}</button>`).join('');
    renderLog();
    if ($('pNew')) $('pNew').onclick = () => { switchParty(newCode()); copyInvite(); renderPeople(); };
    if ($('pCopy')) $('pCopy').onclick = copyInvite;
    if ($('pPublic')) $('pPublic').onclick = () => { switchParty(''); renderPeople(); };
    $('pplList').querySelectorAll('[data-go]').forEach(b => b.onclick = () => goToPeer(b.dataset.go));
    $('pplList').querySelectorAll('[data-ride]').forEach(b => b.onclick = () => { const H = N.remotes.get(b.dataset.ride); if (!H) return; G.closeUI();
      const go = () => joinRide(H, H.lm ? 'limo' : 'car'); if (state.area.id === 'strip' && !state.driving && !state.limo) go(); else G.goTo('strip', H.tpos.x + 3, H.tpos.z, go); });
    $('chatQuick').querySelectorAll('[data-q]').forEach(b => b.onclick = () => { if (say(b.dataset.q)) G.closeUI(); });
  }
  const sendTyped = () => { const i = $('chatIn'); if (!i.value.trim()) return; if (say(i.value)) { i.value = ''; G.closeUI(); } };
  $('chatSend').onclick = sendTyped; $('chatIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendTyped(); } if (e.key === 'Escape') G.closeUI(); e.stopPropagation(); });
  function goToPeer(id) {
    const R = N.remotes.get(id); if (!R) return; G.closeUI();
    const P = R.drive && R.area === 'strip' ? { x: R.drive.x + 3 * Math.cos(R.drive.h), z: R.drive.z - 3 * Math.sin(R.drive.h) } : { x: R.tpos.x + 1.4, z: R.tpos.z + 1.4 };
    G.goTo(R.area, P.x, P.z, () => G.toast(`👥 You found ${R.name}`));
  }
  function openPeople() { if (!N.on) return; G.showUI('people'); $('inviteUrl').classList.add('hidden'); renderPeople(); if (N.party && !G.isTouch) setTimeout(() => $('chatIn').focus(), 50); }
  $('btnPeople').onclick = () => state.ui === 'people' ? G.closeUI() : openPeople();

  // ---------------------------------------------------------------- accounts (shared with TILEO Cruise Lines)
  const A = { base: '', on: false, ready: false, google: '', user: null, token: '', status: 'off', saveT: 0, saving: false, again: false, dirty: false };
  const TOKEN_KEY = 'tileoKingdom.acct';
  A.base = (() => { if (window.TILEO_API_URL) return String(window.TILEO_API_URL).replace(/\/$/, ''); if (!url) return ''; try { const u = new URL(url); return (u.protocol === 'wss:' ? 'https://' : 'http://') + u.host; } catch (e) { return ''; } })();
  A.on = !!A.base && !inClaude;
  function api(path, method = 'GET', body, timeoutMs = 20000) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null, tm = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : 0;
    const headers = { 'content-type': 'application/json' }; if (A.token) headers.authorization = 'Bearer ' + A.token;
    return fetch(A.base + path, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined, keepalive: method === 'PUT' && JSON.stringify(body || {}).length < 60000 })
      .then(async r => { clearTimeout(tm); let j = null; try { j = await r.json(); } catch (e) { } if (!r.ok) throw Object.assign(new Error(j && j.error || 'Request failed'), { status: r.status }); return j; })
      .catch(e => { clearTimeout(tm); if (e.name === 'AbortError') throw Object.assign(new Error('The server is waking up. Try again in a few seconds.'), { status: 0 }); throw e.status !== undefined ? e : Object.assign(new Error('Can’t reach the server right now.'), { status: 0 }); });
  }
  const profileOf = () => ({ v: 1, coins: save.coins, owned: save.owned, room: save.room, bonusDay: save.bonusDay, look: save.look });
  async function accountInit() {
    renderAcct(); if (!A.on) return;
    A.token = lsGet(TOKEN_KEY, '') || ''; A.status = 'connecting'; renderAcct();
    for (let i = 0; i < 6; i++) {
      try { const c = await api('/api/config', 'GET', null, 60000); A.ready = !!c.accounts; A.google = c.google || ''; if (A.ready) break; if (c.setup) { A.status = 'setup'; renderAcct(); return; } } catch (e) { }
      await new Promise(r => setTimeout(r, 5000));
    }
    if (!A.ready) { A.status = 'down'; renderAcct(); return; }
    A.status = 'ready';
    if (A.token) { try { signedIn(await api('/api/me'), false); } catch (e) { if (e.status === 401) { A.token = ''; lsSet(TOKEN_KEY, null); } } }
    renderAcct();
  }
  function signedIn(r, fresh) {
    if (r.token) { A.token = r.token; lsSet(TOKEN_KEY, r.token); }
    A.user = r.user; const p = r.profile && typeof r.profile === 'object' && r.profile.look ? r.profile : null;
    if (p) { G.applyProfile(p); if (fresh) G.toast(`👑 Welcome back, ${save.look.name} · your guest is loaded from your account`); }
    else { saveNow(); if (fresh) G.toast(`👑 ${save.look.name} now saves to your TILEO account`); }
    renderAcct();
  }
  function signOut() { if (A.token) api('/api/logout', 'POST').catch(() => { }); if (A.dirty) saveNow(); A.token = ''; A.user = null; lsSet(TOKEN_KEY, null); renderAcct(); G.toast('Signed out · your guest stays on this device'); }
  function saveSoon() { if (!A.user) return; A.dirty = true; if (!A.saveT) A.saveT = setTimeout(() => { A.saveT = 0; saveNow(); }, 6000); }
  function saveNow() {
    if (!A.user) return; if (A.saving) { A.again = true; A.dirty = true; return; }
    A.dirty = false; A.saving = true;
    api('/api/profile', 'PUT', { profile: profileOf() }).catch(e => { if (e.status === 401) { G.toast('Signed out · sign in again to keep saving online'); A.user = null; A.token = ''; lsSet(TOKEN_KEY, null); renderAcct(); } else A.dirty = true; })
      .finally(() => { A.saving = false; if (A.again) { A.again = false; if (A.user) saveNow(); } });
  }
  addEventListener('pagehide', () => { if (A.dirty) saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && A.dirty) saveNow(); });
  function renderAcct() {
    const bar = $('acctBar'); bar.classList.toggle('hidden', !A.on); document.querySelectorAll('[data-app="account"]').forEach(b => b.classList.toggle('hidden', !A.on));
    if (!A.on) return;
    if (A.user) bar.innerHTML = `<span>Signed in as <b>${esc(A.user.name)}</b> · your guest saves to your account</span><button class="link" id="acctOut">Sign out</button>`;
    else if (A.status === 'connecting') bar.innerHTML = '<span>Connecting to TILEO accounts…</span>';
    else if (A.status === 'down') bar.innerHTML = '<span>Accounts are offline right now. You can play as a guest.</span>';
    else if (A.status === 'setup') bar.innerHTML = '<span>Sign-in opens soon. Play as a guest for now.</span>';
    else bar.innerHTML = `<span>Keep your guest and coins on every device</span><button class="link" id="acctIn">Sign in</button>`;
    const o = $('acctOut'); if (o) o.onclick = signOut; const i = $('acctIn'); if (i) i.onclick = () => openAuth('in');
    if (state.ui === 'account') openAuth(authMode);
  }
  let authMode = 'in', gisP = null;
  const loadGIS = () => gisP || (gisP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => { gisP = null; rej(new Error('gsi')); }; document.head.appendChild(s); }));
  function openAuth(mode) {
    if (!A.on) return; authMode = mode || 'in'; if (state.ui !== 'account') G.showUI('account');
    const box = $('acctBody'), up = authMode === 'up';
    if (A.user) { box.innerHTML = `<h2>TILEO account</h2><p>Signed in as <b>${esc(A.user.name)}</b>. Your guest, coins, wardrobe and suite save to your account, so they follow you to any device.</p><p class="fine">The same account signs in to TILEO Cruise Lines. Each game keeps its own character.</p><div class="row"><button class="ghost" id="aOut">Sign out</button></div>`; $('aOut').onclick = () => { signOut(); G.closeUI(); }; return; }
    if (A.status !== 'ready') { box.innerHTML = `<h2>TILEO account</h2><p>${A.status === 'setup' ? 'Sign-in opens soon. Play as a guest for now: your guest saves on this device.' : A.status === 'connecting' ? 'Connecting to TILEO accounts… the server can take up to a minute to wake up.' : 'Accounts are offline right now. You can play as a guest.'}</p>`; return; }
    box.innerHTML = `<form id="authForm" class="auth" novalidate>
      <h2>${up ? 'Create a TILEO account' : 'Sign in'}</h2>
      <p class="fine">One account for TILEO KINGDOM and TILEO Cruise Lines. Each game keeps its own character.</p>
      <div class="seg"><button type="button" data-m="in" class="${up ? '' : 'on'}">Sign in</button><button type="button" data-m="up" class="${up ? 'on' : ''}">Create account</button></div>
      <label>Username<input id="aUser" autocomplete="username" maxlength="20" autocapitalize="none" spellcheck="false"></label>
      <label>Password<input id="aPass" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" maxlength="128"></label>
      ${up ? '<label>Confirm password<input id="aPass2" type="password" autocomplete="new-password" maxlength="128"></label><p class="fine">3–20 letters, numbers, dots, dashes or underscores for the username; at least 8 characters for the password.</p>' : ''}
      <p class="authErr" id="aErr" role="alert"></p>
      <button class="gold" type="submit" id="aGo">${up ? 'Create account' : 'Sign in'}</button>
      ${A.google ? '<div class="authOr"><span>or</span></div><div id="gBtn" class="gBtn"></div>' : ''}
    </form>`;
    box.querySelectorAll('[data-m]').forEach(b => b.onclick = () => openAuth(b.dataset.m));
    box.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));
    const err = m => { $('aErr').textContent = m || ''; };
    $('authForm').onsubmit = async e => {
      e.preventDefault(); err(''); const u = $('aUser').value.trim(), p = $('aPass').value;
      if (!/^[A-Za-z0-9_.-]{3,20}$/.test(u)) return err('Usernames are 3 to 20 letters, numbers, dots, dashes or underscores.');
      if (up && p.length < 8) return err('Passwords need at least 8 characters.');
      if (up && p !== $('aPass2').value) return err('The passwords don’t match.');
      const go = $('aGo'); go.disabled = true; go.textContent = up ? 'Creating…' : 'Signing in…';
      try { signedIn(await api(up ? '/api/signup' : '/api/login', 'POST', { username: u, password: p }), true); G.closeUI(); }
      catch (x) { err(x.message); go.disabled = false; go.textContent = up ? 'Create account' : 'Sign in'; }
    };
    if (A.google) loadGIS().then(() => { const el = $('gBtn'); if (!el || !window.google || !google.accounts) return;
      google.accounts.id.initialize({ client_id: A.google, ux_mode: 'popup', auto_select: false, cancel_on_tap_outside: true, callback: async resp => { err(''); try { signedIn(await api('/api/google', 'POST', { credential: resp.credential }), true); G.closeUI(); } catch (x) { err(x.message); } } });
      google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: Math.min(300, el.clientWidth || 280) });
    }).catch(() => { const el = $('gBtn'); if (el) el.textContent = 'Google sign-in could not load.'; });
    setTimeout(() => { const f = $('aUser'); if (f && !G.isTouch) f.focus(); }, 50);
  }
  accountInit();

  // test / trailer hooks: show a player or a chat line exactly as if it came from the server
  const inject = (id, d) => { readRemote(String(id), d); refresh(); }, injectSay = (id, x) => handle({ t: 'say', id: String(id), x });
  return { peers: () => [...N.remotes.values()], N, A, update, say, openPeople, openAuth, saveSoon, rideAction, leaveRide, rideCamera, vehicles, get ride() { return N.ride; }, get online() { return N.on; }, cleanLook, inject, injectSay };
}
