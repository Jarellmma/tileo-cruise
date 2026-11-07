// TILEO KINGDOM v5: chauffeured stretch limo. You ride in the back on a scenic loop of the Strip.
// The route runs south on the east lanes, U-turns, north on the west lanes, U-turns, and repeats.
// Local frame: +z forward, -x is the curb side, the floor is at y 0.36.
import * as THREE from 'three';
import { M, neon, glow, goldM, chromeM, onNight, logoPlane, canvas, tex, PI } from './core.js?v=1794015301';
import { Batch, streetTex } from './city.js?v=1794015301';
import { makeCharacter, animate } from './characters.js?v=1794015301';
import { wheelParts } from './cars.js?v=1794015301';
import { STATIONS, station } from './music.js?v=1794015301';

const XL = 12.4, ZE = 615, RA = 12.4, ARC = PI * RA, LEN = 4 * ZE + 2 * ARC; // loop length is about 2538 m
const SEG = [2 * ZE, 2 * ZE + ARC, 4 * ZE + ARC, LEN];
export function routeAt(s) { s = ((s % LEN) + LEN) % LEN;
  if (s < SEG[0]) return { x: XL, z: ZE - s, h: PI, arc: false };
  if (s < SEG[1]) { const th = (s - SEG[0]) / RA; return { x: RA * Math.cos(th), z: -ZE - RA * Math.sin(th), h: PI + th, arc: true }; }
  if (s < SEG[2]) return { x: -XL, z: -ZE + (s - SEG[1]), h: 0, arc: false };
  const th = (s - SEG[2]) / RA; return { x: -RA * Math.cos(th), z: ZE + RA * Math.sin(th), h: th, arc: true }; }
// arc length along the route for a curbside point (the side is picked from x)
export function routeS(x, z) { return x >= 0 ? ZE - z : SEG[1] + (z + ZE); }
const PICKUP_S = routeS(1, -330);
const SEAT = new THREE.Vector3(0.05, 0.23, -3.38), STAND = new THREE.Vector3(0.0, 0.84, -0.8);
// passenger places on the J-seat along the curb side (facing in): your invited guest and other players riding with you
export const J_SEATS = [new THREE.Vector3(-0.44, 0.23, -2.3), new THREE.Vector3(-0.44, 0.23, -1.3), new THREE.Vector3(-0.44, 0.23, -0.3)]; // v8.1: 10 cm lower so tall guests' heads stay under the roof // v6.3: hips over the cushion, back to the backrest (was inside the wall)
const DRV_Y = 0.03; // chauffeur origin height: hips on the low seat (top 0.5), head under the headliner (1.59)
const DRV_LOOK = { skin: '#8a5636', hair: '#1a1209', outfit: '#111111', style: 'solid', hairLong: false, body: 'm', hairStyle: 'buzzed', beard: false, banded: false, role: 'business' }; // chauffeur in a suit
const VIEWS = ['cabin', 'seat', 'chase', 'side'];
const VNAME = { cabin: 'Rear cabin', seat: 'Rear-seat POV', chase: 'Chase cam', side: 'Curbside', roof: 'Sunroof' };
const CAMS = { // [camera position, look-at target, interior?]
  cabin: [[-0.55, 1.36, 0.95], [0.1, 0.92, -3.4], 1], seat: [[0.05, 1.3, -3.25], [0.05, 1.12, 1.5], 1],
  chase: [[0, 3.5, -15.5], [0, 1.1, 2.5], 0], side: [[-5.6, 1.25, 3.8], [0, 1.0, -1.2], 0], roof: [[-2.6, 2.75, 5.0], [0, 2.05, -0.9], 0] };

export function buildLimo(strip, C) {
  const grp = new THREE.Group(); grp.visible = false; grp.scale.setScalar(1.12); strip.group.add(grp); // a roomy stretch: avatars sit upright under the headliner
  const b = new Batch();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xf4f2ee, metalness: 0.35, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
  const gold = goldM(0.3), chrome = chromeM(0.15), black = M(0x0b0b0d, { roughness: 0.35 }), tire = M(0x151515, { roughness: 0.9 });
  const leather = glow(0xe6d6b8, 0x30220f, 0, 0.18, { roughness: 0.5 }), lacquer = M(0x0e0b0a, { roughness: 0.15, metalness: 0.2 }), carpet = M(0x1a1416, { roughness: 1 });
  const tint = new THREE.MeshStandardMaterial({ color: 0x223040, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.4, depthWrite: false, side: THREE.DoubleSide });
  const led = new THREE.MeshBasicMaterial({ color: 0xb46cff, toneMapped: false }), head = glow(0xffffff, 0xfff4d8, 0.6, 2.2), tail = neon(0xff2020, {}, 0.7, 1.6);
  const [sc, sx] = canvas(256, 512); sx.fillStyle = '#07050c'; sx.fillRect(0, 0, 256, 512); for (let i = 0; i < 260; i++) { const r = Math.random() < 0.1 ? 1.6 : 0.8; sx.fillStyle = `hsla(${40 + Math.random() * 30},80%,${70 + Math.random() * 30}%,${0.5 + Math.random() * 0.5})`; sx.beginPath(); sx.arc(Math.random() * 256, Math.random() * 512, r, 0, 7); sx.fill(); }
  const stars = new THREE.MeshBasicMaterial({ map: tex(sc), color: 0xffffff });
  // ---- body shell ----
  b.box(black, 0, 0.12, 0, 2.0, 0.22, 10.25);                       // undertray
  b.box(paint, 0, 0.32, 4.3, 2.15, 0.66, 1.8);                      // hood block
  b.box(paint, 0, 0.32, -4.8, 2.15, 0.66, 0.8);                     // trunk block
  for (const s of [-1, 1]) { b.box(paint, s * 1.04, 0.3, -0.5, 0.07, 0.68, 7.8);     // side panels
    b.box(lacquer, s * 0.995, 0.36, -0.5, 0.02, 0.6, 7.7);                          // inner door trim
    b.box(gold, s * 1.077, 0.945, 0, 0.012, 0.028, 10.28);                         // gold pinstripe
    b.box(chrome, s * 1.077, 0.36, 0, 0.012, 0.05, 9.6);                           // rocker chrome
    for (const z of [3.0, 1.55, -1.2, -4.0]) b.box(black, s * 1.045, 0.98, z, 0.06, 0.68, 0.12); // pillars
    b.box(tint, s * 1.06, 0.98, 2.28, 0.02, 0.66, 1.4);                            // driver cabin glass
    b.box(paint, s * 1.04, 0.32, 4.3, 0.1, 0.66, 1.8); }
  b.box(paint, 0, 0.3, 5.18, 2.05, 0.5, 0.12); b.box(chrome, 0, 0.22, 5.28, 2.0, 0.14, 0.08); b.box(chrome, 0, 0.22, -5.25, 2.0, 0.14, 0.08);
  b.box(gold, 0, 0.36, 5.25, 1.0, 0.34, 0.04); for (let i = -4; i <= 4; i++) b.box(black, i * 0.105, 0.38, 5.27, 0.025, 0.3, 0.02);  // lion-gold grille
  for (const s of [-1, 1]) { b.box(head, s * 0.78, 0.66, 5.24, 0.42, 0.13, 0.04); b.box(tail, s * 0.86, 0.72, -5.21, 0.3, 0.14, 0.04); }
  b.box(paint, 0, 0.32, -5.19, 2.05, 0.66, 0.1);
  b.geo(tint, new THREE.BoxGeometry(2.04, 0.83, 0.03), 0, 1.32, 3.15, 1, 1, 1, 0, -0.65);   // windshield
  b.geo(tint, new THREE.BoxGeometry(2.04, 0.78, 0.03), 0, 1.32, -4.2, 1, 1, 1, 0, 0.54);    // rear window
  b.box(paint, 0, 0.96, -4.42, 2.12, 0.06, 0.04);
  // roof with the sunroof opening (z -1.7..0.1, x ±0.6) + starlight headliner
  for (const [x, z, w, d] of [[0, 1.55, 2.12, 2.9], [0, -2.85, 2.12, 2.3], [-0.84, -0.8, 0.48, 1.8], [0.84, -0.8, 0.48, 1.8]]) { b.box(paint, x, 1.64, z, w, 0.1, d); b.box(stars, x, 1.585, z, Math.min(w, 1.98), 0.05, d - 0.02); }
  b.box(gold, 0, 1.74, -0.8, 1.26, 0.015, 0.04); b.box(gold, 0, 1.74, 0.12, 1.26, 0.015, 0.04); b.box(gold, 0, 1.74, -1.72, 1.26, 0.015, 0.04);
  // wheels
  { const W = wheelParts(0.38, 0.27), alloy = new THREE.MeshStandardMaterial({ color: 0xd2d5da, metalness: 1, roughness: 0.2, side: THREE.DoubleSide }), rubber = new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.8, side: THREE.DoubleSide });
    for (const z of [3.72, -3.9]) for (const s of [-1, 1]) { b.geo(rubber, W.tyre, s * 0.95, 0.38, z, s, 1, 1); b.geo(alloy, W.rim, s * 0.95, 0.38, z, s, 1, 1); b.geo(gold, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10).rotateZ(PI / 2), s * 1.07, 0.38, z); } }
  // ---- interior ----
  b.box(carpet, 0, 0.26, -0.6, 1.98, 0.1, 7.6);
  b.box(leather, 0, 0.36, -3.66, 1.96, 0.38, 0.5); b.box(leather, 0, 0.72, -3.97, 1.96, 0.78, 0.2); b.box(gold, 0, 0.77, -3.4, 1.96, 0.02, 0.02); // rear bench (0.5 m deep so knees clear the front edge)
  for (const x of [-0.5, 0.5]) b.box(leather, x, 1.38, -3.98, 0.5, 0.22, 0.16);
  b.box(leather, -0.74, 0.36, -1.2, 0.48, 0.34, 3.3); b.box(leather, -0.95, 0.72, -1.2, 0.08, 0.52, 3.3); b.box(gold, -0.5, 0.74, -1.2, 0.02, 0.02, 3.3); // J-seat
  b.box(lacquer, 0.78, 0.36, -1.1, 0.42, 0.6, 2.5); b.box(gold, 0.78, 0.96, -1.1, 0.44, 0.03, 2.52); b.box(led, 0.565, 0.9, -1.1, 0.02, 0.03, 2.5); // mini bar
  const glassM = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 });
  for (const z of [-2.05, -1.85, -1.65]) { b.cyl(glassM, 0.72, 0.99, z, 0.03, 0.17, 8); b.cyl(gold, 0.72, 0.99, z, 0.04, 0.01, 8); }
  b.cyl(chrome, 0.8, 0.99, -0.55, 0.11, 0.2, 12); b.cyl(M(0x0e3a1c, { roughness: 0.15 }), 0.8, 1.02, -0.55, 0.04, 0.3, 8); b.cyl(gold, 0.8, 1.32, -0.55, 0.018, 0.06, 6); // ice bucket + bubbly
  for (const s of [-1, 1]) { b.box(led, s * 0.975, 0.38, -1.2, 0.025, 0.02, 5.5); b.box(led, s * 0.965, 1.555, -1.2, 0.025, 0.025, 5.5); }
  b.box(led, 0, 0.3, -3.17, 1.9, 0.03, 0.02);
  b.box(lacquer, 0, 0.36, 1.55, 2.0, 1.24, 0.06);                                     // partition
  b.box(black, 0, 0.88, 1.505, 1.0, 0.6, 0.03); b.box(gold, 0, 0.86, 1.5, 1.06, 0.02, 0.035); b.box(gold, 0, 1.49, 1.5, 1.06, 0.02, 0.035);
  // chauffeur cabin
  for (const x of [0.5, -0.5]) { b.box(black, x, 0.3, 2.3, 0.62, 0.2, 0.6); b.box(black, x, 0.5, 2.0, 0.62, 0.62, 0.12); } // v8.1: low sports seats so the chauffeur's head clears the roof
  b.geo(black, new THREE.TorusGeometry(0.19, 0.025, 6, 20), 0.5, 0.84, 2.86, 1, 1, 1, 0, -0.5); b.box(black, 0, 0.6, 3.15, 1.98, 0.36, 0.4);
  b.flush(grp, true, false);
  logoPlane(grp, 'dj', 0, 0.89, 1.485, 0.52, PI, { maxW: 0.94 });                    // DJ Tileo screen on the partition
  for (const s of [-1, 1]) logoPlane(grp, 'resort', s * 1.087, 0.64, -2.1, 0.34, s * PI / 2);
  logoPlane(grp, 'resort', 0, 0.79, 5.22, 0.2, 0);
  // windows that open: rear cabin glass both sides
  const winG = new THREE.Group(); grp.add(winG); for (const s of [-1, 1]) for (const [z0, z1] of [[-4.0, -1.2], [-1.2, 1.55]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.62, z1 - z0 - 0.12), tint); m.position.set(s * 1.06, 1.31, (z0 + z1) / 2); winG.add(m); }
  // sliding sunroof glass
  const roofGlass = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.03, 1.8), tint); roofGlass.position.set(0, 1.71, -0.8); grp.add(roofGlass);
  // night light beams
  const ST = streetTex(); const beam = new THREE.Mesh(new THREE.PlaneGeometry(5, 15).rotateX(-PI / 2).translate(0, 0.07, 12.8), new THREE.MeshBasicMaterial({ map: ST.head, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  grp.add(beam); const amb = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 7.4).rotateX(-PI / 2).translate(0, 0.315, -0.6), new THREE.MeshBasicMaterial({ color: 0x8a40ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })); grp.add(amb);
  // chauffeur (NPC avatar)
  const drv = makeCharacter(DRV_LOOK); drv.userData.noInvite = true;
  drv.position.set(0.5, DRV_Y, 2.3); drv.scale.setScalar(1 / grp.scale.x); grp.add(drv); // (the old chauffeur cap floated above the roof: removed)
  // v8.1: the limo is scaled up 1.12 for a roomy cabin; the chauffeur keeps real human size so his head sits well under the roof
  let night = true; onNight(n => { night = n; beam.visible = n; stars.color.setScalar(n ? 1 : 0.55); amb.material.opacity = n ? 0.22 : 0.08; });

  // ---- ride state ----
  const st = C.state; let L = null; const leaving = { on: false, s: 0, v: 0, t: 0 };
  const stopsList = () => [{ name: 'TILEO KINGDOM', icon: '👑', x: 1, z: -330 }, ...strip.landmarks.filter(l => l.name !== 'TILEO KINGDOM').map(l => ({ name: l.name, icon: '📍', x: l.x, z: l.z }))];
  function setColor(c) { paint.color.set(c === 'black' ? 0x0c0c0e : 0xf4f2ee); paint.roughness = c === 'black' ? 0.18 : 0.22; }
  function place(s) { const r = routeAt(s); grp.position.set(r.x, 0.02, r.z); grp.rotation.y = r.h; grp.updateMatrixWorld(true); return r; }
  function start(color = 'white', o = {}) { // v8: o.s = where on the loop to start (the airport curb), o.stop = drive straight to a stop, o.msg = welcome line
    if (st.driving) C.parkCar(); C.closeUI(); setColor(color); leaving.on = false;
    L = st.limo = { s: o.s ?? PICKUP_S, v: 0, phase: 'board', t: 0, view: 'cabin', stand: false, open: true, windows: false, radio: 'party', stop: null, look: { yaw: 0, pitch: 0 }, passing: '', color, odo: 0 };
    if (o.stop) { const p = stopsList().find(q => q.name === o.stop); if (p) { const cur = ((L.s % LEN) + LEN) % LEN; L.stop = { s: L.s + (((routeS(p.x, p.z) - cur) % LEN) + LEN) % LEN, name: o.stop }; } }
    place(L.s); grp.visible = true; roofGlass.position.z = -2.6; roofGlass.position.y = 1.775; winG.visible = true;
    st.emote = null; st.air = false; st.jy = 0; C.toggleWheel(false); document.body.classList.add('inLimo'); C.$('limoBar').classList.remove('hidden'); ui(); C.setMusic();
    C.toast(o.msg || '🚘 Your chauffeur welcomes you aboard. Sit back and cruise the Strip.'); }
  function stopAt(name) { const p = stopsList().find(q => q.name === name); if (!p || !L) return; const sl = routeS(p.x, p.z), cur = ((L.s % LEN) + LEN) % LEN; let ds = ((sl - cur) % LEN + LEN) % LEN; if (ds < 25 + L.v * L.v / 4) ds += LEN;
    L.stop = { s: L.s + ds, name }; L.phase = 'ride'; C.$('limoStops').classList.add('hidden'); C.$('limoArrive').classList.add('hidden'); C.toast(`📍 Next stop: ${name}`); ui(); }
  function end() { if (!L) return; if (L.phase === 'arrived' || L.v < 0.5) return getOut(); L.phase = 'ending'; L.stop = { s: L.s + L.v * L.v / (2 * 2.6) + 3, name: 'curbside' }; C.toast('🚪 Your chauffeur is pulling over…'); ui(); }
  function getOut() { if (!L) return; const at = L.phase === 'arrived' && L.stop ? L.stop.name : null, drop = at && C.dropAt ? C.dropAt(at) : null; // v8.1: e.g. the airport stop drops you inside the terminal doors
    if (drop) return C.transition(() => { L = st.limo = null; grp.visible = false; finish(); C.enterArea(drop.area, drop.x, drop.z, drop.yaw); C.toast(drop.msg || '🚘 Thanks for riding.'); });
    C.transition(() => { const pos = new THREE.Vector3(-2.9, 0, -1.6); grp.localToWorld(pos); const h = grp.rotation.y; L = st.limo = null; finish();
      C.player.visible = true; C.player.position.set(pos.x, 0, pos.z); const yaw = h - PI / 2 + PI; C.player.rotation.y = h - PI / 2; C.cam.yaw = yaw; C.cam.pitch = 0.3; C.cam.manual = 0;
      leaving.on = true; leaving.s = ((routeS(grp.position.x, grp.position.z)) % LEN + LEN) % LEN; leaving.v = 0; leaving.t = 0; C.toast('🚘 Thanks for riding. Your chauffeur drives off.'); }); }
  function finish() { document.body.classList.remove('inLimo'); C.$('limoBar').classList.add('hidden'); C.$('limoStops').classList.add('hidden'); C.$('limoArrive').classList.add('hidden'); C.player.visible = true; st.baseY = 0; C.setMusic(); C.syncButtons(); }
  function abort() { if (!L && !leaving.on) return; const was = !!L; L = st.limo = null; leaving.on = false; grp.visible = false; if (was) finish(); }
  function cycleView() { if (!L) return; const list = L.stand ? [...VIEWS, 'roof'] : VIEWS; L.view = list[(list.indexOf(L.view) + 1) % list.length]; L.look.yaw = L.look.pitch = 0; ui(); C.toast('🎥 ' + VNAME[L.view]); }
  function setView(v) { if (L && CAMS[v]) { L.view = v; L.look.yaw = L.look.pitch = 0; ui(); } }
  function toggleStand() { if (!L) return; L.stand = !L.stand; if (L.stand) { L.open = true; L.view = 'roof'; C.toast('🌅 Standing up through the sunroof. Wave to the Strip!'); } else L.view = 'cabin'; L.look.yaw = L.look.pitch = 0; ui(); }
  function toggleWindows() { if (!L) return; L.windows = !L.windows; winG.visible = !L.windows; C.toast(L.windows ? '🪟 Windows down' : '🪟 Windows up'); ui(); }
  // v7.1: the limo radio uses the same stations as the convertible (music.js)
  const RADIO = [...STATIONS.filter(s => s.id !== 'off').map(s => s.id), null], RNAME = k => k ? station(k).n : 'Off';
  function cycleRadio() { if (!L) return; L.radio = RADIO[(RADIO.indexOf(L.radio) + 1) % RADIO.length]; C.setMusic(); ui(); C.toast(L.radio ? `${station(L.radio).icon} ${RNAME(L.radio)}` : '🔇 Radio off'); }
  function setRadio(k) { if (!L) return; L.radio = k; C.setMusic(); ui(); }
  function ui() { if (!L) return; C.$('lbView').innerHTML = `🎥<span>${VNAME[L.view]}</span>`; C.$('lbStand').innerHTML = L.stand ? '🪑<span>Sit down</span>' : '🌅<span>Stand up</span>';
    C.$('lbRadio').innerHTML = `📻<span>${RNAME(L.radio)}</span>`; C.$('lbWin').innerHTML = `🪟<span>${L.windows ? 'Windows up' : 'Windows down'}</span>`; C.$('lbEnd').innerHTML = L.phase === 'ending' ? '⏳<span>Pulling over</span>' : '🚪<span>End ride</span>'; }
  function openStops() { const box = C.$('limoStops'); if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
    box.innerHTML = '<b>Choose a stop</b>' + stopsList().map(p => `<button data-stop="${p.name}">${p.icon} ${p.name}</button>`).join('') + '<button data-stop="">✕ Close</button>';
    box.querySelectorAll('button').forEach(bt => bt.onclick = e => { e.stopPropagation(); const n = bt.dataset.stop; if (n) stopAt(n); else box.classList.add('hidden'); }); box.classList.remove('hidden'); }

  // ---- per-frame update (runs while riding, even with a menu open) ----
  const v3 = new THREE.Vector3();
  function trafficGap(r) { if (r.arc || !strip.traffic) return 1e9; const dir = r.h === 0 ? 1 : -1; let g = 1e9; for (const c of strip.traffic) { if (Math.abs(c.x - r.x) > 1.6) continue; const d = (c.z - r.z) * dir; if (d > 0 && d < g) g = d; } return g - 7.3; }
  function update(dt, t) {
    if (leaving.on) { leaving.t += dt; leaving.v = Math.min(14, leaving.v + 2.2 * dt); leaving.s += leaving.v * dt; const r = place(leaving.s); animate(drv, t, 0, 'drive'); if (leaving.t > 14) { leaving.on = false; grp.visible = false; } strip.limoBody = { x: r.x, z: r.z, on: true }; return; }
    if (!L) { strip.limoBody = null; return; }
    L.t += dt; let r = routeAt(L.s);
    let vt = 14.5; if (L.phase === 'board') { vt = 0; if (L.t > 1.6) L.phase = 'ride'; } if (L.phase === 'arrived') vt = 0;
    const cur = ((L.s % LEN) + LEN) % LEN; let toArc = 1e9; for (const a of [SEG[0], SEG[2]]) { const d = a - cur; if (d > 0 && d < toArc) toArc = d; }
    if (r.arc) vt = Math.min(vt, 6); else vt = Math.min(vt, Math.sqrt(36 + 2 * 1.8 * toArc));
    const near = strip.landmarks.find(l => Math.abs(l.z - r.z) < 45 && Math.sign(l.x) === Math.sign(r.x)); if (near && !r.arc) vt = Math.min(vt, 9.5);
    if (L.stop) { const d = L.stop.s - L.s; vt = Math.min(vt, Math.sqrt(Math.max(0, 2 * 2.4 * (d - 0.4)))); if (d < 0.6 && L.v < 0.6) arrive(); }
    vt = Math.min(vt, Math.max(0, trafficGap(r) - 2) * 0.9);
    L.v += Math.max(-3.4 * dt, Math.min(2.0 * dt, vt - L.v)); if (L.v < 0.02 && vt <= 0) L.v = 0; L.s += L.v * dt; L.odo += L.v * dt;
    r = place(L.s); strip.limoBody = { x: r.x, z: r.z, on: true };
    if (near && near.name !== L.passing && !r.arc) { L.passing = near.name; if (L.phase === 'ride') C.toast(`✨ Now passing: ${near.name}`); }
    const mph = Math.round(L.v * 2.237); C.$('areaName').textContent = `🚘 Stretch limo · ${near && !r.arc ? near.name : r.arc ? 'U-turn' : 'The Strip'} · ${mph} mph`;
    C.$('limoInfo').textContent = L.phase === 'arrived' ? `📍 ${L.stop ? L.stop.name : ''}` : L.stop ? `📍 ${L.stop.name} · ${Math.max(0, Math.round(L.stop.s - L.s))} m` : '🎶 Scenic cruise';
    // passenger + chauffeur
    const p = C.player; p.visible = L.view !== 'seat'; v3.copy(L.stand ? STAND : SEAT); grp.localToWorld(v3); p.position.copy(v3); p.rotation.y = r.h + (L.stand ? 0 : 0); st.baseY = v3.y;
    animate(p, t, 0, L.stand ? (st.emote || 'wave') : 'sit'); animate(drv, t, 0, 'drive');
    roofGlass.position.z += ((L.open ? -2.6 : -0.8) - roofGlass.position.z) * Math.min(1, dt * 3); roofGlass.position.y = roofGlass.position.z < -1.0 ? 1.775 : 1.71;
    const hue = (t * 0.04) % 1; led.color.setHSL(hue, 0.85, night ? 0.6 : 0.42); amb.material.color.setHSL(hue, 0.9, 0.5);
  }
  function arrive() { if (L.phase === 'ending') { L.stop = null; return getOut(); } L.phase = 'arrived'; L.v = 0; C.$('limoArrTxt').textContent = `📍 ${L.stop.name}`; C.$('limoArrive').classList.remove('hidden'); C.toast(`📍 Arrived: ${L.stop.name}`); if (C.onArrive) C.onArrive(L.stop.name); }
  function cruise() { if (!L) return; L.stop = null; L.phase = 'ride'; C.$('limoArrive').classList.add('hidden'); ui(); }
  // ---- camera ----
  const cp = new THREE.Vector3(), ctg = new THREE.Vector3(), sm = new THREE.Vector3(), smT = new THREE.Vector3(); let smInit = false;
  function camera(dt) { if (!L) return false; const [P, Tg, inside] = CAMS[L.view]; cp.set(...P); ctg.set(...Tg);
    if (L.view === 'seat' && L.stand) { cp.set(0, 2.25, -0.75); ctg.set(0, 2.0, 5); }
    const ly = L.look.yaw, lp = L.look.pitch;
    if (inside) { const d = ctg.clone().sub(cp); d.applyAxisAngle(new THREE.Vector3(0, 1, 0), ly); d.y -= lp * d.length(); ctg.copy(cp).add(d); }
    else { const d = cp.clone().sub(ctg); d.applyAxisAngle(new THREE.Vector3(0, 1, 0), ly); d.y += lp * 6; cp.copy(ctg).add(d); }
    grp.localToWorld(cp); grp.localToWorld(ctg);
    if (!inside && smInit) { const k = Math.min(1, dt * 5); sm.lerp(cp, k); smT.lerp(ctg, Math.min(1, dt * 8)); } else { sm.copy(cp); smT.copy(ctg); } smInit = !inside;
    sm.y = Math.max(0.5, sm.y); C.camera.position.copy(sm); C.camera.lookAt(smT); C.CHAR.camPos.copy(sm); return true; }
  function look(dx, dy) { if (!L) return; L.look.yaw -= dx * 0.005; L.look.pitch = Math.max(-0.6, Math.min(0.8, L.look.pitch + dy * 0.004)); }
  // wire the UI
  C.$('lbView').onclick = cycleView; C.$('lbStand').onclick = toggleStand; C.$('lbRadio').onclick = cycleRadio; C.$('lbStops').onclick = openStops; C.$('lbEnd').onclick = end; C.$('lbWin').onclick = toggleWindows;
  C.$('lbOut').onclick = getOut; C.$('lbCruise').onclick = cruise;
  C.$('limoBar').addEventListener('pointerdown', e => e.stopPropagation());
  // v6.3 multiplayer: another player's limo is a copy of this one (shared geometry, own paint) with its own chauffeur
  function makeShell(color) { const i = grp.children.indexOf(drv), sh = grp.clone(true); if (i >= 0) sh.remove(sh.children[i]);
    const pm = paint.clone(); pm.color.set(color === 'black' ? 0x0c0c0e : 0xf4f2ee); sh.traverse(o => { if (o.isMesh && o.material === paint) o.material = pm; });
    const d = makeCharacter(DRV_LOOK); d.userData.noInvite = true; d.position.set(0.5, DRV_Y, 2.3); d.scale.setScalar(1 / grp.scale.x); sh.add(d); sh.userData.drv = d; sh.userData.paint = pm; sh.visible = true; grp.parent.add(sh); return sh; }
  function seatWorld(g, i, out) { out.copy(i < 0 ? SEAT : i === 99 ? STAND : J_SEATS[i % J_SEATS.length]); return g.localToWorld(out); }
  function cabinCamera(g) { const [P, Tg] = CAMS.cabin; cp.set(...P); ctg.set(...Tg); g.localToWorld(cp); g.localToWorld(ctg); C.camera.position.copy(cp); C.camera.lookAt(ctg); C.CHAR.camPos.copy(cp); return true; }
  return { grp, start, end, abort, getOut, cruise, makeShell, seatWorld, cabinCamera, J_SEATS, stopAt, cycleView, setView, toggleStand, toggleWindows, cycleRadio, setRadio, update, camera, look, setColor, stopsList, routeAt, PICKUP_S, LEN, get ride() { return L; }, leaving, VNAME };
}
