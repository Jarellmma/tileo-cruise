// v8: Sin City International · Baggage Claim (an interior area). Free Play and the Vegas Trip both start here:
// grab your bag off Carousel 11, stock the suite at the Booze Library, walk out to the pickup curb, ride the limo up the Strip to TILEO KINGDOM.
// Real-airport touches as parodies: a vintage plane hanging over the carousels, a big post clock, slot machines in baggage claim,
// a liquor-store-meets-library, a chauffeur holding a sign with your name, taxis and a parking garage across the arrivals road.
import * as THREE from 'three';
import { M, B, box, cyl, plane, glow, neon, onNight, signMesh, signTex, rng, PI, goldM, chromeM, canvas, tex, pbr, logoPlane } from './core.js?v=1794000555';
import { makeCharacter, randomLook, animate } from './characters.js?v=1794000555';
import { stadium, Batch } from './city.js?v=1794000555';
import { parkedTaxis } from './strip8.js?v=1794000555';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const R = rng(7070);
export const AIRPORT_SPAWN = { x: -20.4, z: -19.6, yaw: PI };    // foot of the escalator, by Carousel 11
export const AIRPORT_DOOR = { x: 0, z: 22.5, yaw: 0 };           // just inside the front doors (coming in from the Strip)

// a hard-shell roller suitcase (origin on the floor, handle toward -z); used for your bag, other travellers' bags and the bag you pull
const SUIT = {}; // merged geometry per size: 2 draw calls per suitcase (shell, trim)
function suitGeo(w, h, d) { const k = [w, h, d].join(); if (SUIT[k]) return SUIT[k]; const y = h / 2 + 0.06, sh = [], dk = [];
  const put = (arr, geo, x, yy, z, rz = 0) => { if (rz) geo.rotateZ(rz); geo.translate(x, yy, z); arr.push(geo); };
  put(sh, new THREE.BoxGeometry(w, h, d), 0, y, 0); for (const s of [-1, 1]) put(sh, new THREE.BoxGeometry(0.03, h * 0.94, d + 0.014), s * w * 0.22, y, 0);
  for (const s of [-1, 1]) put(dk, new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), s * (w / 2 - 0.05), 0.035, -d / 2 + 0.04, PI / 2);
  for (const s of [-1, 1]) put(dk, new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), s * 0.1, h + 0.27, -d / 2 + 0.03);
  put(dk, new THREE.BoxGeometry(0.24, 0.035, 0.045), 0, h + 0.48, -d / 2 + 0.03);
  const clean = a => a.map(g => { const x = g.index ? g.toNonIndexed() : g; for (const n of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(n)) x.deleteAttribute(n); return x; });
  return SUIT[k] = { sh: mergeGeometries(clean(sh)), dk: mergeGeometries(clean(dk)) }; }
const SUIT_DARK = M(0x15161a, { roughness: 0.6 }), SUIT_M = {}, TAG_M = neon(0xff4fa8, {}, 0.9, 1.3);
export function makeSuitcase(color = 0xd4a640, o = {}) { const g = new THREE.Group(), w = o.w || 0.42, h = o.h || 0.62, d = o.d || 0.26, G2 = suitGeo(w, h, d), mk = color + ':' + (o.metal ?? 0.5);
  const shell = SUIT_M[mk] || (SUIT_M[mk] = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: o.metal ?? 0.5 }));
  const a = new THREE.Mesh(G2.sh, shell), c = new THREE.Mesh(G2.dk, SUIT_DARK); a.castShadow = c.castShadow = true; g.add(a, c);
  if (o.tag) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.012), TAG_M); t.position.set(w * 0.28, h + 0.02, d / 2 + 0.03); g.add(t); }
  return g; }
// pull a suitcase behind a walking character (tilted toward the hand)
export function rollBag(ch, bag) { bag.position.set(-0.3, 0, -0.55); bag.rotation.set(0.5, PI, 0); ch.add(bag); return bag; } // right hand, handle side toward you, tilted onto its wheels

function vintagePlane() { const p = new THREE.Group(), al = chromeM(0.22, 0xdfe3e8), red = M(0xc8202a, { roughness: 0.45 }), dark = M(0x16181c, { roughness: 0.4 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); p.add(m); return m; };
  add(new THREE.CylinderGeometry(0.78, 0.42, 9, 18), al, 0, 0, 0, PI / 2);
  const nose = add(new THREE.SphereGeometry(0.78, 18, 12), al, 0, 0, 4.5); nose.scale.set(1, 1, 1.5);
  add(new THREE.ConeGeometry(0.42, 2.2, 16), al, 0, 0.1, -5.6, -PI / 2);
  add(new THREE.BoxGeometry(15, 0.16, 1.9), al, 0, -0.32, 1.3); for (const s of [-1, 1]) add(new THREE.BoxGeometry(1.2, 0.17, 1.92), red, s * 6.9, -0.32, 1.3);
  add(new THREE.BoxGeometry(5, 0.12, 1.1), al, 0, 0.12, -5.3); add(new THREE.BoxGeometry(0.12, 1.8, 1.4), red, 0, 1.0, -5.5);
  add(new THREE.BoxGeometry(1.58, 0.16, 8.4), red, 0, -0.1, 0.2);
  for (let k = 0; k < 7; k++) for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.04, 0.26, 0.4), dark, s * 0.77, 0.22, 2.6 - k * 0.9);
  add(new THREE.BoxGeometry(0.9, 0.3, 0.5), dark, 0, 0.55, 3.9, -0.4);
  const props = []; for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.42, 0.36, 1.9, 14), al, s * 2.6, -0.2, 2.1, PI / 2); const hub = add(new THREE.SphereGeometry(0.2, 10, 8), dark, s * 2.6, -0.2, 3.1); hub.scale.z = 1.4;
    const pr = new THREE.Group(); pr.position.set(s * 2.6, -0.2, 3.16); p.add(pr); for (let b = 0; b < 3; b++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.04), dark); bl.position.y = 0.75; const arm = new THREE.Group(); arm.rotation.z = b * PI * 2 / 3; arm.add(bl); pr.add(arm); } props.push(pr); }
  p.userData.props = props; return p; }

function clockTex() { const [c, x] = canvas(256, 256), t = tex(c);
  const draw = (h, m) => { x.clearRect(0, 0, 256, 256); x.fillStyle = '#0d4a2e'; x.beginPath(); x.arc(128, 128, 126, 0, PI * 2); x.fill(); x.fillStyle = '#d9b45a'; x.beginPath(); x.arc(128, 128, 112, 0, PI * 2); x.fill();
    x.fillStyle = '#f7f3e8'; x.beginPath(); x.arc(128, 128, 104, 0, PI * 2); x.fill(); x.fillStyle = '#1a2a22';
    for (let k = 0; k < 12; k++) { const a = k / 12 * PI * 2; x.save(); x.translate(128 + Math.sin(a) * 88, 128 - Math.cos(a) * 88); x.rotate(a); x.fillRect(-3, -10, 6, k % 3 ? 12 : 20); x.restore(); }
    x.font = 'italic 700 17px Georgia, serif'; x.textAlign = 'center'; x.fillStyle = '#0d4a2e'; x.fillText('Sin City', 128, 92); x.font = '600 10px sans-serif'; x.fillText('INTERNATIONAL', 128, 172);
    const hand = (a, len, w, col) => { x.save(); x.translate(128, 128); x.rotate(a); x.fillStyle = col; x.fillRect(-w / 2, -len, w, len + 12); x.restore(); };
    hand(((h % 12) + m / 60) / 12 * PI * 2, 56, 8, '#1a2a22'); hand(m / 60 * PI * 2, 84, 5, '#1a2a22'); x.fillStyle = '#d9b45a'; x.beginPath(); x.arc(128, 128, 8, 0, PI * 2); x.fill(); t.needsUpdate = true; };
  return { t, draw }; }

function welcomeNeon() { const W = 1024, H = 256, [c, x] = canvas(W, H); x.clearRect(0, 0, W, H); x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'italic 700 92px Georgia, serif'; x.shadowColor = '#ff4fa8'; x.shadowBlur = 24; x.fillStyle = '#ff7cc0'; x.fillText('Welcome to', 300, 120); x.shadowBlur = 0; x.fillStyle = '#ffe0f0'; x.globalAlpha = 0.5; x.fillText('Welcome to', 300, 120); x.globalAlpha = 1;
  x.font = '900 120px Georgia, serif'; x.shadowColor = '#ffb020'; x.shadowBlur = 26; x.fillStyle = '#ffcf4a'; x.fillText('LAS VEGAS', 712, 132); x.shadowBlur = 0; x.globalAlpha = 0.5; x.fillStyle = '#fff4d0'; x.fillText('LAS VEGAS', 712, 132); x.globalAlpha = 1;
  x.font = '700 30px sans-serif'; x.fillStyle = '#9fd8ff'; x.shadowColor = '#4dd8ff'; x.shadowBlur = 10; x.fillText('★  YOUR TRIP STARTS NOW  ★', 512, 222); return tex(c); }

function nameBoard(name) { const [c, x] = canvas(256, 160); x.fillStyle = '#fbfaf6'; x.fillRect(0, 0, 256, 160); x.strokeStyle = '#c9932e'; x.lineWidth = 8; x.strokeRect(4, 4, 248, 152);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#1a1209'; let fs = 52; x.font = `900 ${fs}px Georgia, serif`; while (x.measureText(name).width > 220 && fs > 18) { fs -= 2; x.font = `900 ${fs}px Georgia, serif`; }
  x.fillText(name, 128, 70); x.font = '700 18px sans-serif'; x.fillStyle = '#9a6a10'; x.fillText('TILEO KINGDOM · LIMO', 128, 126); return tex(c); }

// `C`: { limoShell, timeNow(), grabBag(), shop(), services(), slots(), limoLabel(), limoRide(), toStrip(), bagLabel() }
export function buildAirport(A, C) {
  const g = A.group, b = new Batch(), gm = goldM(0.3, 0.26), steel = M(0xb9bec5, { roughness: 0.38, metalness: 0.3 }), rubber = M(0x2a2b2e, { roughness: 0.85 });
  const wallM = M(0xdcd9d2, { roughness: 0.75 }), wood = M(0x6b4a2c, { roughness: 0.55 }), darkWood = M(0x3a2616, { roughness: 0.5 }), white = M(0xf2f1ed, { roughness: 0.5 }), dark = M(0x15161a, { roughness: 0.5 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  A.spawnElev = AIRPORT_SPAWN; A.spawnDoor = AIRPORT_DOOR;

  // ---------------- hall shell (x -34..34, z -38..26, 12 m high) ----------------
  plane(g, pbr('marble', 68 / 2.4, 64 / 2.4, { color: 0xe9e5dd, metalness: 0.02 }), 0, 0, -6, 68, 64).receiveShadow = true;
  for (let x = -30; x <= 30; x += 10) plane(g, M(0xb9b2a6, { roughness: 0.4 }), x, 0.012, -6, 0.25, 64); // terrazzo divider strips
  plane(g, M(0xe8e6e0, { side: THREE.DoubleSide }), 0, 12, -6, 68, 64, PI / 2);
  const sky = neon(0xf4f8ff, {}, 1.1, 0.85); for (let z = -30; z <= 20; z += 10) plane(g, sky, 0, 11.95, z, 60, 2.2, PI / 2);
  b.box(wallM, -34.5, 0, -6, 1, 12, 64); b.box(wallM, 34.5, 0, -6, 1, 12, 64); b.box(wallM, 0, 0, -38.5, 70, 12, 1);
  for (const x of [-34, 34]) b.box(wood, x * 0.985, 0, -6, 0.2, 2.4, 64); // wainscot
  // mezzanine (arrivals from the gates) with glass rail; escalators down to the hall
  b.box(M(0xcfcac0, { roughness: 0.6 }), 0, 5.6, -35, 70, 0.6, 6); b.box(glassM, 0, 6.2, -32.05, 68, 1.1, 0.06); b.box(steel, 0, 7.3, -32.05, 68, 0.08, 0.12);
  b.box(M(0x8a8478, { roughness: 0.7 }), 0, 0, -35, 70, 5.6, 6); A.aabbs.push([-35, 35, -38.5, -32]);
  for (const [lbl, x] of [['RESTROOMS', -8], ['GATES A · B · C ↑', 0], ['RENTAL CARS', 8]]) signMesh(g, lbl, '#ffffff', x, 4.4, -31.9, 6, 0.9, 0, '', '#123050');
  const escM = new THREE.MeshStandardMaterial({ map: (() => { const [c, x] = canvas(64, 64); x.fillStyle = '#3a3c40'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#9aa0a8'; for (let i = 0; i < 64; i += 8) x.fillRect(0, i, 64, 2); const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 18); return t; })(), roughness: 0.4, metalness: 0.6 });
  const ESC = []; for (const ex of [-22, 22]) { const L = Math.hypot(10, 6), ang = Math.atan2(6, 10), cy = 3, czz = -27;
    const s = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, L), escM); s.position.set(ex, cy + 0.1, czz); s.rotation.x = ang; g.add(s);
    for (const sx of [-1, 1]) { const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, L), glassM); side.position.set(ex + sx * 0.78, cy + 0.7, czz); side.rotation.x = ang; g.add(side);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, L), dark); rail.position.set(ex + sx * 0.78, cy + 1.22, czz); rail.rotation.x = ang; g.add(rail);
      const truss = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, L), steel); truss.position.set(ex + sx * 0.82, cy - 0.35, czz); truss.rotation.x = ang; g.add(truss); }
    A.aabbs.push([ex - 1, ex + 1, -32, -22.2]); ESC.push({ x: ex, m: escM }); }
  A.anim.push(t => { escM.map.offset.y = (t * 0.5) % 1; });
  // "Welcome to LAS VEGAS" neon over the mezzanine + ad screens + arrivals board
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 6.5), neon(0xffffff, { map: welcomeNeon(), transparent: true, depthWrite: false }, 1.0, 1.25)); m.position.set(0, 9.4, -31.6); g.add(m); }
  const ADS = [['THUNDER FROM THE KINGDOM', 'NIGHTLY 7 PM · TILEO KINGDOM', '#ff6ec7'], ['DJ TILEO · LIVE', 'MEGA CLUB · TILEO KINGDOM', '#ffcf4a'], ['SKY NEEDLE', '238 m DECK · OPEN LATE', '#7fd8ff'], ['POWER CHORD', 'HOTEL · CASINO · LIVE MUSIC', '#d49cff'], ['AURUM & BRAVO', 'DINE · SPA · SHOWS', '#ffe6b0']].map(([a, s, c]) => signTex(a, c, '#0a0812', 768, 320, s));
  const ad = signMesh(g, 'THUNDER FROM THE KINGDOM', '#ff6ec7', -33.9, 5.4, -16, 11, 4.6, PI / 2, 'NIGHTLY 7 PM'); let adK = 0;
  A.anim.push(t => { const k = Math.floor(t / 7) % ADS.length; if (k !== adK) { adK = k; ad.material.map = ADS[k]; ad.material.needsUpdate = true; } });
  logoPlane(g, 'dj', -33.9, 4.6, -26.5, 4.4, PI / 2, { back: 0x0b0906, pad: 0.1 });
  { const [c, x] = canvas(768, 384); x.fillStyle = '#05080e'; x.fillRect(0, 0, 768, 384); x.fillStyle = '#ffcf4a'; x.font = '900 40px sans-serif'; x.fillText('ARRIVALS', 24, 52); x.fillStyle = '#9fd8ff'; x.font = '700 22px monospace'; x.fillText('FLIGHT   FROM              BELT   STATUS', 24, 96);
    const rows = [['TK 777', 'NEW YORK JFK', '11', 'ON BELT'], ['BA 129', 'BOISE', '12', 'DELAYED'], ['SC 404', 'LOS ANGELES', '12', 'LANDED'], ['TK 088', 'MIAMI', '11', 'ON BELT'], ['VG 007', 'CHICAGO', '12', 'ARRIVING'], ['PX 321', 'SEATTLE', '11', 'LANDED']];
    rows.forEach(([f, o, bl, st], i) => { const y = 140 + i * 40; x.fillStyle = '#f4f2ea'; x.font = '700 24px monospace'; x.fillText(f.padEnd(9) + o.padEnd(18) + bl.padEnd(7), 24, y); x.fillStyle = st === 'DELAYED' ? '#ff5a5a' : st === 'ON BELT' ? '#5aff9a' : '#ffcf4a'; x.fillText(st, 590, y); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), neon(0xffffff, { map: tex(c) }, 0.9, 1.1)); m.position.set(33.9, 5.2, -14); m.rotation.y = -PI / 2; g.add(m); }

  // ---------------- baggage carousels 11 and 12 ----------------
  const Ls = 15.6, rp = 2.7, Pp = 2 * Ls + 2 * PI * rp, BELT_V = 0.55, carousels = [];
  const bagG = new THREE.BoxGeometry(0.72, 0.28, 0.48), BAG_C = [0x15161a, 0x1d2f52, 0x8c1220, 0xa7abb1, 0x5a2a7a, 0x1f6f6b, 0x2a2a2a, 0xe8e4da, 0x6b5a48, 0xd85a1a];
  for (const [cx, num, fl] of [[-13, '11', 'TK 777 · NEW YORK JFK'], [13, '12', 'BA 129 · BOISE']]) { const cz = -4;
    b.prism(steel, steel, stadium(cx, cz, Ls + 8.4, 8.4, PI / 2, 12), 0, 0.5); b.prism(rubber, rubber, stadium(cx, cz, Ls + 8, 8, PI / 2, 12), 0.5, 0.56);
    b.prism(steel, steel, stadium(cx, cz, Ls + 2.4, 2.4, PI / 2, 10), 0.56, 1.0); b.prism(dark, dark, stadium(cx, cz, Ls + 1.6, 1.6, PI / 2, 10), 1.0, 1.06);
    b.box(steel, cx, 0, cz - Ls / 2 - 4.9, 3.6, 3.4, 1.0); b.box(dark, cx, 0.56, cz - Ls / 2 - 4.35, 2.6, 1.3, 0.12); for (let k = 0; k < 9; k++) b.box(rubber, cx - 1.2 + k * 0.3, 0.6, cz - Ls / 2 - 4.27, 0.26, 1.2, 0.04);
    A.aabbs.push([cx - 4.2, cx + 4.2, cz - Ls / 2 - 5.5, cz + Ls / 2 + 4.2]);
    signMesh(g, num, '#ffcf4a', cx, 7.6, cz + 9, 2.6, 2.6, 0, '', '#0a1420'); signMesh(g, num, '#ffcf4a', cx, 7.6, cz + 8.95, 2.6, 2.6, PI, '', '#0a1420');
    signMesh(g, 'CAROUSEL ' + num, '#ffffff', cx, 5.4, cz + Ls / 2 + 4.6, 5.6, 1.7, 0, fl, '#123050'); b.box(dark, cx, 0, cz + Ls / 2 + 4.6, 0.3, 4.5, 0.3); A.aabbs.push([cx - 0.3, cx + 0.3, cz + Ls / 2 + 4.3, cz + Ls / 2 + 4.9]);
    const v = new THREE.Vector3(), pos = (s, out) => { s = ((s % Pp) + Pp) % Pp;
      if (s < Ls) { out.set(cx + rp, 0.56, cz - Ls / 2 + s); return 0; }
      if (s < Ls + PI * rp) { const a = (s - Ls) / rp; out.set(cx + rp * Math.cos(a), 0.56, cz + Ls / 2 + rp * Math.sin(a)); return -a; }
      if (s < 2 * Ls + PI * rp) { out.set(cx - rp, 0.56, cz + Ls / 2 - (s - Ls - PI * rp)); return PI; }
      const a = PI + (s - 2 * Ls - PI * rp) / rp; out.set(cx + rp * Math.cos(a), 0.56, cz - Ls / 2 + rp * Math.sin(a)); return -a; };
    const N = 13, im = new THREE.InstancedMesh(bagG, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.15 }), N), offs = [];
    for (let k = 0; k < N; k++) { offs.push(k / N * Pp + R() * 1.2); im.setColorAt(k, new THREE.Color(BAG_C[Math.floor(R() * BAG_C.length)])); } im.castShadow = true; g.add(im);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), e = new THREE.Euler();
    A.anim.push(t => { for (let k = 0; k < N; k++) { const h = pos(offs[k] + t * BELT_V, v); v.y += 0.14; e.set(0, h + (k % 3) * 0.3, 0); q.setFromEuler(e); sc.set(1 + (k % 4) * 0.12, 1 + (k % 2) * 0.25, 1); m4.compose(v, q, sc); im.setMatrixAt(k, m4); } im.instanceMatrix.needsUpdate = true; });
    carousels.push({ cx, cz, pos }); }
  // your bag (gold hard-shell with a pink tag) drops out of the chute onto Carousel 11
  { const yb = new THREE.Group(), sc = makeSuitcase(0xd4a640, { tag: true }); sc.rotation.x = -PI / 2; sc.position.set(0, 0.13, 0.37); yb.add(sc); yb.visible = false; g.add(yb);
    const S0 = 2 * Ls + PI * rp + PI * rp / 2 + 0.6, v = new THREE.Vector3();
    const BAG = A.bag = { on: false, s: S0, t: 0, x: 0, z: 0, get shown() { return yb.visible; }, start(delay = 4) { this.on = true; this.t = -delay; this.s = S0; yb.visible = false; }, take() { this.on = false; yb.visible = false; } };
    A.anim.push((t, dt) => { if (!BAG.on) return; BAG.t += dt; if (BAG.t < 0) return; yb.visible = true; BAG.s += BELT_V * dt; const h = carousels[0].pos(BAG.s, v); yb.position.copy(v); yb.rotation.y = h + 0.2; BAG.x = v.x; BAG.z = v.z; });
    A.interacts.push({ get x() { return BAG.x; }, get z() { return BAG.z; }, r: 3.2, when: () => BAG.on && yb.visible, label: () => C.bagLabel(), act: () => C.grabBag() }); }
  // vintage airliner hanging over the carousels
  { const vp = vintagePlane(); vp.position.set(0, 8.8, -3); vp.rotation.set(-0.05, 0.25, 0.1); g.add(vp); const cab = dark;
    for (const [x, z] of [[-6.6, 1.3], [6.6, 1.3], [0, 3.6], [0, -4.6]]) { const w = new THREE.Vector3(x, 0, z).applyEuler(vp.rotation).add(vp.position); b.cyl(cab, w.x, w.y, w.z, 0.02, 12 - w.y, 4); }
    A.anim.push(t => { vp.userData.props.forEach((p, i) => { p.rotation.z = t * (0.6 + i * 0.1); }); }); }
  // the big post clock (shows the trip clock, or local time in Free Play)
  { const cl = new THREE.Group(); cl.position.set(0, 0, -20); g.add(cl); const green = M(0x0d4a2e, { roughness: 0.4, metalness: 0.3 });
    cyl(cl, green, 0, 0, 0, 0.9, 0.5); cyl(cl, gm, 0, 0.5, 0, 0.6, 0.2); cyl(cl, green, 0, 0.7, 0, 0.2, 5.2); const CT = clockTex();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, 0.36, 28), gm); ring.rotation.x = PI / 2; ring.position.y = 7.1; cl.add(ring);
    for (const r of [0, PI]) { const f = new THREE.Mesh(new THREE.CircleGeometry(1.24, 32), neon(0xffffff, { map: CT.t }, 0.95, 1.05)); f.position.set(0, 7.1, r ? -0.19 : 0.19); f.rotation.y = r; cl.add(f); }
    A.aabbs.push([-1, 1, -21, -19]); let last = -1;
    A.anim.push(() => { const T = C.timeNow(), k = T.h * 60 + T.m; if (k !== last) { last = k; CT.draw(T.h, T.m); } }); }

  // ---------------- Booze Library (west wall): a liquor store dressed as an old library ----------------
  { const x0 = -34, x1 = -23, z0 = 6, z1 = 22;
    plane(g, pbr('marble', 3, 4, { color: 0x6b4a2c }), (x0 + x1) / 2, 0.015, (z0 + z1) / 2, x1 - x0, z1 - z0); plane(g, M(0x1e140c, { side: THREE.DoubleSide }), (x0 + x1) / 2, 5, (z0 + z1) / 2, x1 - x0, z1 - z0, PI / 2);
    b.box(darkWood, (x0 + x1) / 2, 0, z0 - 0.3, x1 - x0, 6.6, 0.6); b.box(darkWood, (x0 + x1) / 2, 0, z1 + 0.3, x1 - x0, 6.6, 0.6); b.box(darkWood, x1, 5, (z0 + z1) / 2, 0.6, 1.6, z1 - z0 + 1.2);
    for (const z of [z0 + 1, z1 - 1]) { b.box(darkWood, x1, 0, z, 0.6, 5, 2); b.box(glassM, x1 + 0.35, 0.4, z, 0.04, 4, 1.8); }
    A.aabbs.push([x0, x1 + 0.3, z0 - 0.6, z0 + 2], [x0, x1 + 0.3, z1 - 2, z1 + 0.6]);
    signMesh(g, 'BOOZE LIBRARY', '#ffcf4a', x1 + 0.33, 5.8, (z0 + z1) / 2, 10, 1.5, PI / 2, 'CHECK OUT A BOTTLE · OPEN 24/7', '#1a0f06');
    // shelving on three walls, bottles (instanced, all colours) and a row of old books along the top
    const shelf = (ax, az, bx, bz, nx, nz) => { const L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
      for (let k = 0; k < 7; k++) b.geo(wood, new THREE.BoxGeometry(0.42, 0.06, L), (ax + bx) / 2 + nx * 0.21, 0.4 + k * 0.6, (az + bz) / 2 + nz * 0.21, 1, 1, 1, ry);
      b.geo(darkWood, new THREE.BoxGeometry(0.08, 4.6, L), (ax + bx) / 2, 2.3, (az + bz) / 2, 1, 1, 1, ry); return { ax, az, bx, bz, nx, nz, L }; };
    const walls = [shelf(x0 + 0.5, z0 + 0.6, x0 + 0.5, z1 - 0.6, 1, 0), shelf(x0 + 1, z0 + 0.3, x1 - 2.4, z0 + 0.3, 0, 1), shelf(x0 + 1, z1 - 0.3, x1 - 2.4, z1 - 0.3, 0, -1)];
    const bottleG = new THREE.LatheGeometry([[0.001, 0], [0.05, 0], [0.055, 0.02], [0.055, 0.19], [0.03, 0.25], [0.017, 0.28], [0.017, 0.34], [0.001, 0.34]].map(([a, c]) => new THREE.Vector2(a, c)), 7);
    const BC = [0x7a3a0e, 0x9a5a18, 0x1e5a2a, 0xcfe4ea, 0x2a1408, 0x2a5aa8, 0xe8a0b0, 0xd8b040, 0x6a0e1a, 0x4a6a2a];
    let n = 0; for (const w of walls) n += Math.floor(w.L / 0.24) * 6;
    const bim = new THREE.InstancedMesh(bottleG, new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0.15 }), n), m4 = new THREE.Matrix4(); let i = 0;
    for (const w of walls) { const cnt = Math.floor(w.L / 0.24); for (let k = 0; k < 6; k++) for (let j = 0; j < cnt; j++) { const u = (j + 0.5) / cnt, s = 0.85 + R() * 0.4;
      m4.makeScale(s, s * (0.8 + R() * 0.5), s).setPosition(w.ax + (w.bx - w.ax) * u + w.nx * 0.22, 0.43 + k * 0.6, w.az + (w.bz - w.az) * u + w.nz * 0.22); bim.setMatrixAt(i, m4); bim.setColorAt(i, new THREE.Color(BC[Math.floor(R() * BC.length)])); i++; } }
    g.add(bim);
    const bookG = new THREE.BoxGeometry(1, 1, 1), BK = [0x5a1a14, 0x1a3a2a, 0x2a2a4a, 0x6a4a1a, 0x3a1a2a, 0x1a1a1a]; const bkm = new THREE.InstancedMesh(bookG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), 200); let nb = 0;
    for (const w of walls) { let u = 0.02; while (u < 0.98 && nb < 200) { const th = 0.05 + R() * 0.06, hh = 0.26 + R() * 0.16; m4.makeScale(Math.abs(w.nx) ? 0.3 : th, hh, Math.abs(w.nx) ? th : 0.3).setPosition(w.ax + (w.bx - w.ax) * u + w.nx * 0.2, 4.0 + hh / 2, w.az + (w.bz - w.az) * u + w.nz * 0.2); bkm.setMatrixAt(nb, m4); bkm.setColorAt(nb, new THREE.Color(BK[Math.floor(R() * BK.length)])); nb++; u += (th + 0.01) / w.L; } }
    bkm.count = nb; g.add(bkm);
    for (const z of [9, 17]) { bar3(g, gm, x0 + 1.4, 0, z - 0.3, x0 + 0.7, 4.6, z - 0.3); bar3(g, gm, x0 + 1.4, 0, z + 0.3, x0 + 0.7, 4.6, z + 0.3); for (let k = 1; k < 8; k++) { const y = k * 0.56, xx = x0 + 1.4 - 0.7 * y / 4.6; bar3(g, gm, xx, y, z - 0.3, xx, y, z + 0.3, 0.025); } } // rolling ladders
    b.box(darkWood, -27.6, 0, 13, 1.3, 1.05, 6.4); b.box(M(0xe8e2d4, { roughness: 0.25 }), -27.6, 1.05, 13, 1.5, 0.08, 6.6); b.box(dark, -27.8, 1.13, 14.8, 0.5, 0.35, 0.6); A.aabbs.push([-28.4, -26.8, 9.7, 16.3]);
    const crateM = BC.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.15 }));
    for (const z of [9.4, 16.6]) { b.box(M(0xb8862a, { roughness: 0.3, metalness: 0.6 }), -24.6, 0, z, 0.9, 0.9, 0.9); for (let k = 0; k < 6; k++) b.cyl(new THREE.MeshStandardMaterial({ color: BC[(k + Math.round(z)) % BC.length], roughness: 0.15 }), -24.85 + (k % 3) * 0.25, 0.9, z - 0.15 + (k > 2 ? 0.3 : 0), 0.05, 0.3, 7); A.aabbs.push([-25.1, -24.1, z - 0.5, z + 0.5]); } // display crates by the door
    for (const z of [9, 13, 17]) { b.cyl(dark, -28.5, 3.6, z, 0.015, 1.4, 4); const pd = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), glow(0xffe0a0, 0xffb860, 1, 1.2)); pd.position.set(-28.5, 3.5, z); g.add(pd); }
    const pl = new THREE.PointLight(0xffc888, 14, 18, 1.5); pl.position.set(-28.5, 4.2, 14); g.add(pl);
    npc(g, A, -28.9, 13, PI / 2, 'fold', { skin: '#b07a52', hair: '#1a1209', outfit: '#3a2616', style: 'solid', body: 'm', name: 'Clerk' });
    A.interacts.push({ x: -25.6, z: 13, r: 2.6, label: () => C.shopLabel(), act: () => C.shop() }); }

  // ---------------- Baggage Services (east wall) ----------------
  { b.box(wallM, 30, 0, 2, 8, 4.4, 0.4); b.box(wallM, 30, 0, 14, 8, 4.4, 0.4); b.box(M(0x123050), 30, 4.4, 8, 8.4, 0.9, 12.4);
    b.box(white, 27.2, 0, 8, 1, 1.1, 10); b.box(M(0x123050), 27.2, 1.1, 8, 1.15, 0.06, 10.1); A.aabbs.push([26.6, 34, 1.7, 14.3]);
    signMesh(g, 'BAGGAGE SERVICES', '#ffffff', 25.74, 4.85, 8, 8, 0.85, -PI / 2, '', '#123050');
    for (let k = 0; k < 9; k++) { const s = makeSuitcase(BAG_C[k % BAG_C.length], { metal: 0.2 }); s.position.set(32.6 - (k % 2) * 0.8, (k % 3) * 0.02, 3.2 + k * 1.15); s.rotation.y = -PI / 2 + (R() - 0.5) * 0.5; g.add(s); }
    npc(g, A, 28.6, 8, -PI / 2, '', { skin: '#f1c9a5', hair: '#3b2412', outfit: '#123050', style: 'solid', body: 'f', name: 'Agent' });
    A.interacts.push({ x: 25.3, z: 8, r: 2.6, label: () => C.servicesLabel(), act: () => C.services() }); }

  // ---------------- slot machines (yes, in baggage claim) ----------------
  { const screen = (() => { const [c, x] = canvas(128, 128); const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#3a0a5a'); gr.addColorStop(1, '#0a0418'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      x.font = '42px serif'; x.textAlign = 'center'; x.fillText('🍒', 26, 74); x.fillText('7', 64, 74); x.fillText('💎', 102, 74); x.fillStyle = '#ffcf4a'; x.font = '900 18px sans-serif'; x.fillText('SIN CITY', 64, 26); x.fillText('JACKPOT', 64, 116); return tex(c); })();
    const sm = neon(0xffffff, { map: screen }, 0.9, 1.15), top = glow(0xff4fa8, 0xff4fa8, 0.5, 1.2);
    for (let k = 0; k < 6; k++) { const x = 12 + k * 2.1; b.box(dark, x, 0, 18.6, 1.0, 1.75, 0.85); b.box(gm, x, 1.75, 18.6, 1.04, 0.08, 0.9); b.box(top, x, 1.83, 18.7, 0.9, 0.35, 0.5);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78), sm); s.position.set(x, 1.15, 18.16); s.rotation.y = PI; g.add(s); b.cyl(gm, x, 0, 17.6, 0.22, 0.75, 10); }
    A.aabbs.push([10.9, 23.6, 18.1, 19.1]); signMesh(g, 'SIN CITY SLOTS', '#ff6ec7', 17.25, 3.1, 18.95, 6, 0.8, PI, '', '#0a0418');
    npc(g, A, 16.2, 17.1, 0, 'phone'); A.interacts.push({ x: 17.2, z: 16.4, r: 3.4, label: 'Airport slots 🎰 (yes, really)', act: () => C.slots() }); }

  // ---------------- front glass wall, sliding doors, the pickup curb outside ----------------
  { const fz = 26; for (const [a, c] of [[-34, -3.6], [3.6, 34]]) { b.box(glassM, (a + c) / 2, 0, fz, c - a, 12, 0.08); A.aabbs.push([a, c, fz - 0.3, fz + 0.3]); }
    b.box(glassM, 0, 3.6, fz, 7.2, 8.4, 0.08); for (let x = -32; x <= 32; x += 4) if (Math.abs(x) > 3.7) b.box(steel, x, 0, fz, 0.12, 12, 0.14); b.box(steel, 0, 3.5, fz, 7.4, 0.2, 0.2);
    const dL = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.4, 0.06), glassM), dR = dL.clone(); dL.position.set(-1.8, 1.7, fz); dR.position.set(1.8, 1.7, fz); g.add(dL, dR);
    const D = A.doors = { k: 0 }; A.anim.push((t, dt, P) => { const near = P && Math.abs(P.x) < 5 && Math.abs(P.z - fz) < 5; D.k += ((near ? 1 : 0) - D.k) * Math.min(1, dt * 4); dL.position.x = -1.8 - D.k * 3.3; dR.position.x = 1.8 + D.k * 3.3; });
    signMesh(g, 'GROUND TRANSPORTATION · LIMO · TAXI · RIDESHARE', '#ffffff', 0, 4.6, fz - 0.15, 12, 0.9, PI, '', '#123050'); signMesh(g, 'GROUND TRANSPORTATION · LIMO · TAXI · RIDESHARE', '#ffffff', 0, 4.6, fz + 0.15, 12, 0.9, 0, '', '#123050');
    // sidewalk + arrivals road + canopy
    plane(g, pbr('sidewalk', 88 / 2, 8 / 2, { color: 0xc4c0bb }), 0, 0.01, 30, 88, 8); b.box(M(0xe8c547, { roughness: 0.6 }), 0, 0, 34.05, 88, 0.03, 0.15);
    plane(g, pbr('asphalt', 120 / 4, 16 / 4, { color: 0x8e8e90 }), 0, 0.005, 42, 120, 16); for (let x = -56; x < 60; x += 8) b.box(white, x, 0.01, 42, 4, 0.01, 0.18);
    b.box(white, 0, 10, 37, 92, 0.6, 22); const dl = neon(0xfff0d8, {}, 0.3, 1.15); for (let x = -40; x <= 40; x += 6) for (const z of [29, 33, 38, 43]) b.box(dl, x, 9.95, z, 1.2, 0.04, 0.5);
    for (let x = -42; x <= 42; x += 12) { b.cyl(white, x, 0, 47.2, 0.4, 10, 12); }
    for (const x of [-42, 42]) b.box(glassM, x + Math.sign(x) * 2.5, 0, 30, 0.08, 10, 8); A.aabbs.push([-46, -44.2, 26, 34], [44.2, 46, 26, 34]);
    signMesh(g, 'LIMOS', '#ffcf4a', 4, 7.4, 34.4, 4, 1.1, PI, '', '#123050'); signMesh(g, 'TAXIS', '#ffcf4a', 24, 7.4, 34.4, 4, 1.1, PI, '', '#123050'); signMesh(g, 'RIDESHARE', '#ffcf4a', -24, 7.4, 34.4, 5, 1.1, PI, '', '#123050');
    for (const x of [4, 24, -24]) b.cyl(dark, x, 7.95, 34.4, 0.02, 2, 4);
    parkedTaxis(g, [[16.5, 38.6, -PI / 2], [22.5, 38.6, -PI / 2], [28.5, 38.6, -PI / 2], [-18, 42.2, PI / 2]]);
    // parking garage across the road, and a strip of sky above it
    const conc = M(0xb9b4aa, { roughness: 0.9 }), gl = neon(0xfff2d0, {}, 0.35, 1.0);
    for (let k = 0; k < 4; k++) { b.box(conc, 0, k * 4.2, 53, 130, 0.9, 2); if (k) for (let x = -60; x <= 60; x += 7.5) b.box(conc, x, k * 4.2 - 3.3, 53.4, 0.8, 3.3, 0.8); b.box(gl, 0, k * 4.2 - 0.25, 54.2, 128, 0.12, 0.2); }
    b.box(M(0x2a2c30), 0, 0, 55, 130, 16, 0.5); signMesh(g, 'PARKING · LEVELS 1–4', '#ffffff', 0, 6.7, 51.9, 12, 1.3, PI, '', '#123050');
    const skyM = new THREE.MeshBasicMaterial({ color: 0x7fb0e0, fog: false }); onNight((n, tod) => skyM.color.set(tod === 'day' ? 0x86b6e6 : tod === 'sunset' ? 0xe08a5a : 0x0b0f22));
    const sk = new THREE.Mesh(new THREE.PlaneGeometry(260, 60), skyM); sk.position.set(0, 30, 70); sk.rotation.y = PI; g.add(sk);
    // your limo at the curb, with the chauffeur holding a sign with your name
    if (C.limoShell) { const L = A.curbLimo = C.limoShell; g.add(L); L.position.set(5.2, 0.02, 37.2); L.rotation.y = -PI / 2; if (L.userData.drv) L.userData.drv.visible = false; }
    const ch = npc(g, A, 8.6, 33.1, PI, '', { skin: '#8a5636', hair: '#1a1209', outfit: '#111111', style: 'solid', body: 'm', name: 'Chauffeur' });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.39), new THREE.MeshBasicMaterial({ map: nameBoard('GUEST') })); board.position.set(0, 1.2, 0.34); ch.add(board);
    A.setName = name => { board.material.map = nameBoard(String(name || 'GUEST').toUpperCase().slice(0, 16)); board.material.needsUpdate = true; };
    A.interacts.push({ x: 6.5, z: 32.4, r: 3.6, label: () => C.limoLabel(), act: () => C.limoRide() });
    A.interacts.push({ x: -40.5, z: 30, r: 3, label: 'Walk out to Las Vegas Blvd 🚶', act: () => C.toStrip() });
    const lc = new THREE.PointLight(0xfff0d8, 16, 40, 1.4); lc.position.set(0, 9, 34); g.add(lc); }

  // ---------------- lights, people, columns ----------------
  for (const [x, z] of [[-22, -8], [22, -8], [0, 10]]) { b.cyl(white, x, 0, z, 0.55, 12, 16); A.aabbs.push([x - 0.6, x + 0.6, z - 0.6, z + 0.6]); }
  const hl = new THREE.PointLight(0xfff4e8, 22, 60, 1.2); hl.position.set(0, 10.5, -6); g.add(hl);
  for (const [x, z, ry, mode] of [[-8.2, -10, -PI / 2, 'phone'], [-8.3, 2, -PI / 2, 'fold'], [8.3, -6, PI / 2, 'phone']]) { const c = npc(g, A, x, z, ry, mode); if (mode !== 'phone') rollBag(c, makeSuitcase(BAG_C[Math.floor(R() * BAG_C.length)], { metal: 0.2 })); }
  const routes = [[[19.5, -18], [19.5, 9], [8, 14], [2, 22], [0, 30.5], [-14, 30.5], [-2, 28], [-2, 23], [-19.5, 10], [-19.5, -18], [-10, -23], [10, -23]],
    [[-21, -20], [-19.5, -12], [-19.5, 9], [-8, 14], [-2, 22], [0, 30.5], [14, 30.5], [2, 28], [2, 23], [19.5, 10], [19.5, -18], [10, -23], [-10, -23]],
    [[-30, 30], [30, 30], [30, 32.6], [-30, 32.6]], [[-30, -10], [-20, -18], [-6, -24], [6, -24], [20, -16], [28, -4], [20, 10], [8, 14], [-8, 16], [-19.5, 12], [-21, 2], [-28, -4]]];
  for (const pts of routes) traveler(g, A, pts, 1.2 + R() * 0.3);
  for (const e of ESC) rider(g, A, e.x);

  // ---------------- objective marker (gold ring + bobbing arrow) ----------------
  { const mk = new THREE.Group(), mm = new THREE.MeshBasicMaterial({ color: 0xffcf4a, transparent: true, opacity: 0.85, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 36), mm); ring.rotation.x = -PI / 2; ring.position.y = 0.04; mk.add(ring);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 4), new THREE.MeshBasicMaterial({ color: 0xffcf4a })); arrow.rotation.x = PI; mk.add(arrow); mk.visible = false; g.add(mk);
    A.marker = { at(x, z, y = 0) { mk.visible = true; mk.position.set(x, y, z); }, hide() { mk.visible = false; } };
    A.anim.push(t => { if (!mk.visible) return; arrow.position.y = 2.7 + Math.sin(t * 3) * 0.25; arrow.rotation.y = t * 1.5; const s = 1 + 0.12 * Math.sin(t * 4); ring.scale.set(s, s, s); }); }
  b.flush(g);
  A.mapRects = [[-34, 34, -38, 26], [-44, 44, 26, 48]];
}

function bar3(g, mat, ax, ay, az, bx, by, bz, r = 0.035) { const a = new THREE.Vector3(ax, ay, az), c = new THREE.Vector3(bx, by, bz), L = a.distanceTo(c), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 6), mat);
  m.position.copy(a).add(c).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(a).normalize()); g.add(m); return m; }
function npc(g, A, x, z, ry = 0, mode = '', look) { const c = makeCharacter(look ? { ...randomLook(R), ...look } : randomLook(R)); if (look && look.name) c.userData.noInvite = true; /* staff stay at work */ c.position.set(x, 0, z); c.rotation.y = ry; g.add(c); A.anim.push(t => animate(c, t, 0, mode)); return c; }
// a traveller pulling a suitcase around a loop of waypoints (out to the curb and back), pausing now and then
function traveler(g, A, pts, speed) { const c = makeCharacter(randomLook(R)); g.add(c); rollBag(c, makeSuitcase(0x15161a + Math.floor(R() * 6) * 0x101010, { metal: 0.25 }));
  let i = 0, pause = R() * 3; const p = { x: pts[0][0], z: pts[0][1] }; c.position.set(p.x, 0, p.z);
  A.anim.push((t, dt) => { let sp = 0; if (pause > 0) pause -= dt; else { const [tx, tz] = pts[(i + 1) % pts.length], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.25) { i = (i + 1) % pts.length; if (R() < 0.2) pause = 1.5 + R() * 4; } else { const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; sp = speed; let dr = Math.atan2(dx, dz) - c.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); c.rotation.y += dr * Math.min(1, dt * 6); } }
    c.position.set(p.x, 0, p.z); animate(c, t, sp, sp ? '' : 'phone'); }); }
// someone riding the escalator down from the gates, then walking off toward the carousels
function rider(g, A, ex) { const c = makeCharacter(randomLook(R)); g.add(c); const bag = rollBag(c, makeSuitcase(BAGC(), { metal: 0.25 })); let u = R(); const L = Math.hypot(10, 6);
  A.anim.push((t, dt) => { u += dt * 0.5 / L; if (u > 1.45) u = 0; let sp = 0;
    if (u <= 1) { c.position.set(ex, 6 * (1 - u) + 0.05, -32 + 10 * u); c.rotation.y = 0; bag.visible = false; } else { const w = (u - 1) / 0.45; c.position.set(ex + (ex < 0 ? 1 : -1) * w * 3, 0, -22 + w * 9); c.rotation.y = ex < 0 ? 0.32 : -0.32; sp = 1.3; bag.visible = true; }
    animate(c, t, sp, ''); }); }
const BAGC = () => [0x15161a, 0x1d2f52, 0x8c1220, 0xa7abb1, 0x5a2a7a][Math.floor(R() * 5)];
