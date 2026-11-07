// TILEO KINGDOM v5: Sky Needle observation deck.
// The deck lives in the Strip group at its real height (floor y = 238 m) so the whole city renders below it and it is visible from the street.
// It has an indoor glass ring and an outdoor skywalk ring, both walkable 360°, four doorways between them, a glass elevator ride,
// coin binoculars with landmark labels, night uplighting, and a far-view package (suburb light grid, horizon city glow, desert).
import * as THREE from 'three';
import { M, neon, glow, goldM, chromeM, onNight, signMesh, logoPlane, canvas, tex, rng, rep, T, PI } from './core.js?v=1794015301';
import { Batch } from './city.js?v=1794015301';
import { Q } from './quality.js?v=1794015301';
import { animate } from './characters.js?v=1794015301';

export const NX = 80, NZ = -572, FLOOR = 238;
export const AE = Math.atan2(-NZ, -NX); // bearing from the needle toward the heart of the Strip (the elevator faces it)
const R_CORE = 6, RG0 = 21.6, RG1 = 22.6, R_RAIL = 28.4, R_EDGE = 28.9, CEIL = 244.85;
export const DOORS = [0, 1, 2, 3].map(k => AE + k * PI / 2); const DOOR_HALF = 1.3;
const BINOC = [AE - 0.3, AE + 0.3, AE + PI / 2 + 0.4, AE + PI, AE - PI / 2 - 0.4];
const BAR_A = AE + PI; // Sky Bar sits on the far side of the core, opposite the elevator
const pol = (r, a, y = FLOOR) => new THREE.Vector3(NX + Math.cos(a) * r, y, NZ + Math.sin(a) * r);
const ryOut = a => PI / 2 - a; // rotation.y that turns a +z-facing object to face radially outward at bearing a
const wrap = a => { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; };
const SHAFT = [[7.6, 18], [6.6, 50], [5.2, 120], [4.4, 200], [4.4, 222], [5.6, 228]];
function shaftR(y) { for (let i = 1; i < SHAFT.length; i++) { const [r0, y0] = SHAFT[i - 1], [r1, y1] = SHAFT[i]; if (y <= y1) return r0 + (r1 - r0) * Math.max(0, (y - y0) / (y1 - y0)); } return 5.6; }
const ease = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
// lathe segment between bearings a0..a1 (my bearing convention: x = cos a, z = sin a)
function latheSeg(pts, a0, a1, seg) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, PI / 2 - a1, a1 - a0); }

export function buildNeedle(strip, A, C) {
  const g = strip.group, b = new Batch(), R = rng(238);
  const conc = M(0xf2f0ea, { roughness: 0.55 }), bronze = M(0x3a2c20, { metalness: 0.6, roughness: 0.35 }), dark = M(0x141218, { roughness: 0.5 });
  const gold = goldM(0.35), chrome = chromeM(0.2), leather = glow(0xd8c7a8, 0x2a1e10, 0.0, 0.25, { roughness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xa8d0e6, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const railGlass = new THREE.MeshStandardMaterial({ color: 0xc8e4f0, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide, depthWrite: false });
  const ledP = neon(0xb46cff, {}, 0.5, 2.2), ledG = neon(0xffc94a, {}, 0.55, 2.0), ledB = neon(0x66ccff, {}, 0.5, 2.0), up = neon(0xfff0d0, {}, 0.35, 1.8), inlay = neon(0xffc94a, {}, 0.35, 0.9);
  // ---- floors ----
  const marble = rep(T.marble, 9, 9); const floorIn = new THREE.Mesh(new THREE.RingGeometry(R_CORE - 0.1, RG0 + 0.25, 96, 1).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ map: marble, color: 0x5a544e, roughness: 0.38, metalness: 0.08 }));
  floorIn.position.set(NX, FLOOR + 0.012, NZ); floorIn.receiveShadow = true; g.add(floorIn);
  const deck = new THREE.Mesh(new THREE.RingGeometry(RG0 + 0.2, R_EDGE, 128, 1).rotateX(-PI / 2), M(0x7a5e44, { roughness: 0.85 })); deck.position.set(NX, FLOOR, NZ); deck.receiveShadow = true; g.add(deck);
  for (let k = 0; k < 72; k++) { const a = k / 72 * PI * 2; b.geo(M(0x5e4632, { roughness: 0.9 }), new THREE.BoxGeometry(0.03, 0.01, R_EDGE - RG1 - 0.3), NX + Math.cos(a) * (RG1 + R_EDGE) / 2, FLOOR + 0.006, NZ + Math.sin(a) * (RG1 + R_EDGE) / 2, 1, 1, 1, ryOut(a)); } // deck plank seams
  b.geo(conc, new THREE.RingGeometry(RG0, R_EDGE, 96, 1).rotateX(PI / 2), NX, FLOOR - 0.8, NZ); // slab underside
  b.geo(conc, new THREE.CylinderGeometry(R_EDGE, R_EDGE, 0.8, 128, 1, true), NX, FLOOR - 0.4, NZ);
  b.geo(ledP, new THREE.CylinderGeometry(R_EDGE + 0.02, R_EDGE + 0.02, 0.12, 128, 1, true), NX, FLOOR - 0.12, NZ); // slab edge LED
  b.geo(inlay, new THREE.RingGeometry(12.9, 13.05, 96, 1).rotateX(-PI / 2), NX, FLOOR + 0.02, NZ); // gold inlay rings
  b.geo(inlay, new THREE.RingGeometry(20.6, 20.72, 96, 1).rotateX(-PI / 2), NX, FLOOR + 0.02, NZ);
  // ---- elevator core ----
  b.geo(bronze, new THREE.CylinderGeometry(R_CORE, R_CORE, CEIL - FLOOR, 48, 1, true), NX, (FLOOR + CEIL) / 2, NZ);
  { const p = pol(R_CORE + 0.04, AE); const grp = new THREE.Group(); grp.position.copy(p); grp.rotation.y = ryOut(AE); g.add(grp);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.3, 0.1), dark); fr.position.y = 1.65; grp.add(fr);
    for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.8, 0.06), gold); d.position.set(s * 0.6, 1.42, 0.07); grp.add(d); }
    signMesh(grp, '▼ STREET LEVEL', '#ffcf4a', 0, 3.75, 0.08, 3.2, 0.55, 0, 'SKY NEEDLE EXPRESS');
    logoPlane(g, 'dj', pol(R_CORE + 0.05, AE + PI / 2, FLOOR + 3.4).x, FLOOR + 3.4, pol(R_CORE + 0.05, AE + PI / 2).z, 2.6, ryOut(AE + PI / 2));
    logoPlane(g, 'resort', pol(R_CORE + 0.05, AE - PI / 2, FLOOR + 3.4).x, FLOOR + 3.4, pol(R_CORE + 0.05, AE - PI / 2).z, 2.8, ryOut(AE - PI / 2)); }
  signMesh(g, 'SKY NEEDLE · 238 m', '#ff66cc', pol(R_CORE + 0.06, BAR_A).x, FLOOR + 4.6, pol(R_CORE + 0.06, BAR_A).z, 4.2, 0.8, ryOut(BAR_A), 'OBSERVATION DECK · SKY BAR');
  // ---- ceiling + cove lighting ----
  b.geo(dark, new THREE.RingGeometry(R_CORE, RG1, 96, 1).rotateX(PI / 2), NX, CEIL, NZ);
  b.geo(ledG, new THREE.CylinderGeometry(RG0 + 0.7, RG0 + 0.7, 0.1, 96, 1, true), NX, CEIL - 0.25, NZ);
  b.geo(ledB, new THREE.CylinderGeometry(R_CORE + 0.05, R_CORE + 0.05, 0.12, 48, 1, true), NX, CEIL - 0.1, NZ);
  for (let k = 0; k < 48; k++) { const a = k / 48 * PI * 2; b.geo(up, new THREE.CircleGeometry(0.16, 8).rotateX(PI / 2), NX + Math.cos(a) * 16, CEIL - 0.02, NZ + Math.sin(a) * 16); } // downlights
  // ---- glass wall with 4 doorways (+ transoms above the doors) ----
  const glassG = [], G0 = [[RG0, FLOOR], [RG1, CEIL - 0.1]], TR = [[RG0 + (RG1 - RG0) * 3.0 / 6.75, FLOOR + 3.0], [RG1, CEIL - 0.1]];
  const dh = DOOR_HALF / ((RG0 + RG1) / 2);
  for (let k = 0; k < 4; k++) { const a0 = DOORS[k] + dh, a1 = DOORS[(k + 1) % 4] - dh + (k === 3 ? 2 * PI : 0); glassG.push(latheSeg(G0, a0, a1, 22)); glassG.push(latheSeg(TR, DOORS[k] - dh, DOORS[k] + dh, 3)); }
  for (const gg of glassG) b.geo(glass, gg, NX, 0, NZ);
  for (let k = 0; k < 64; k++) { const a = k / 64 * PI * 2; if (DOORS.some(d => Math.abs(wrap(a - d)) < dh * 1.4)) continue; const p = pol((RG0 + RG1) / 2, a, (FLOOR + CEIL) / 2); b.geo(chrome, new THREE.BoxGeometry(0.06, 6.9, 0.1), p.x, p.y, p.z, 1, 1, 1, ryOut(a), Math.atan((RG1 - RG0) / 6.85)); }
  for (const d of DOORS) { for (const s of [-1, 1]) { const a = d + s * dh, p = pol(RG0 + 0.22, a, FLOOR + 1.5); b.geo(gold, new THREE.BoxGeometry(0.16, 3.0, 0.2), p.x, p.y, p.z, 1, 1, 1, ryOut(a), 0.145); }
    const p = pol(RG0 + 0.44, d, FLOOR + 3.0); b.geo(gold, new THREE.BoxGeometry(DOOR_HALF * 2 + 0.2, 0.14, 0.22), p.x, p.y, p.z, 1, 1, 1, ryOut(d));
    const s = pol(RG0 + 0.3, d, FLOOR + 3.35); signMesh(g, 'SKYWALK', '#66ccff', s.x, s.y, s.z, 1.8, 0.36, ryOut(d) + PI); }
  // ---- outdoor railing ----
  b.geo(railGlass, new THREE.CylinderGeometry(R_RAIL, R_RAIL, 1.0, 128, 1, true), NX, FLOOR + 0.58, NZ);
  b.geo(gold, new THREE.TorusGeometry(R_RAIL, 0.055, 6, 192).rotateX(PI / 2), NX, FLOOR + 1.12, NZ);
  b.geo(chrome, new THREE.TorusGeometry(R_RAIL, 0.03, 4, 160).rotateX(PI / 2), NX, FLOOR + 0.08, NZ);
  for (let k = 0; k < 96; k++) { const a = k / 96 * PI * 2, p = pol(R_RAIL, a); b.box(chrome, p.x, FLOOR, p.z, 0.06, 1.12, 0.06, ryOut(a)); }
  for (let k = 0; k < 36; k++) { const a = (k + 0.5) / 36 * PI * 2, p = pol(R_RAIL - 0.35, a); b.cyl(ledG, p.x, FLOOR, p.z, 0.07, 0.28, 6); } // bollard lights
  b.geo(ledB, new THREE.TorusGeometry(R_RAIL - 0.08, 0.025, 4, 160).rotateX(PI / 2), NX, FLOOR + 1.02, NZ); // handrail underglow
  for (let k = 0; k < 96; k++) { const a = k / 96 * PI * 2; if (DOORS.some(d => Math.abs(wrap(a - d)) < dh * 1.6)) continue; const p = pol(RG0 - 0.3, a); b.geo(up, new THREE.BoxGeometry(0.22, 0.03, 0.08), p.x, FLOOR + 0.03, p.z, 1, 1, 1, ryOut(a)); } // glass uplights
  // ---- lounge benches (indoor, between the doors) + Sky Bar ----
  const circles = A.circles = [];
  for (let k = 0; k < 4; k++) { const a = AE + PI / 4 + k * PI / 2, p = pol(17.2, a); b.box(leather, p.x, FLOOR, p.z, 3.4, 0.46, 0.8, ryOut(a)); b.box(gold, p.x, FLOOR, p.z, 3.5, 0.06, 0.86, ryOut(a));
    for (const t of [-1.2, 0, 1.2]) { const q = pol(17.2, a + t / 17.2); circles.push([q.x, q.z, 0.5]); } }
  { const bm = M(0x1a1410, { roughness: 0.3, metalness: 0.3 }), w = 1.1;
    b.geo(bm, latheSeg([[8.2, FLOOR], [8.2, FLOOR + 1.08], [9.4, FLOOR + 1.08], [9.4, FLOOR], [8.2, FLOOR]], BAR_A - w / 2, BAR_A + w / 2, 18), NX, 0, NZ);
    b.geo(gold, latheSeg([[8.1, FLOOR + 1.08], [9.5, FLOOR + 1.08], [9.5, FLOOR + 1.14], [8.1, FLOOR + 1.14], [8.1, FLOOR + 1.08]], BAR_A - w / 2 - 0.02, BAR_A + w / 2 + 0.02, 18), NX, 0, NZ);
    b.geo(ledP, latheSeg([[9.42, FLOOR + 0.12], [9.42, FLOOR + 0.2]], BAR_A - w / 2, BAR_A + w / 2, 18), NX, 0, NZ);
    for (let t = -w / 2 + 0.05; t <= w / 2 - 0.05; t += 0.11) { const q = pol(8.8, BAR_A + t); circles.push([q.x, q.z, 0.75]); }
    for (let t = -0.45; t <= 0.46; t += 0.18) { const q = pol(10.1, BAR_A + t); b.cyl(chrome, q.x, FLOOR, q.z, 0.04, 0.72, 6); b.cyl(leather, q.x, FLOOR + 0.72, q.z, 0.22, 0.08, 10); }
    for (let t = -0.4; t <= 0.41; t += 0.1) { const q = pol(8.5, BAR_A + t); b.cyl(t % 0.2 < 0.05 ? M(0x1d5a2a, { roughness: 0.2 }) : M(0x6a2a10, { roughness: 0.2 }), q.x, FLOOR + 1.14, q.z, 0.045, 0.28, 6); } }
  // ---- coin binoculars ----
  const bin = M(0x2a2230, { metalness: 0.7, roughness: 0.3 });
  A.binocs = BINOC.map((a, i) => { const p = pol(R_RAIL - 0.7, a); b.cyl(chrome, p.x, FLOOR, p.z, 0.09, 1.15, 8); b.cyl(gold, p.x, FLOOR, p.z, 0.25, 0.06, 12);
    const hd = new THREE.Group(); hd.position.set(p.x, FLOOR + 1.3, p.z); hd.rotation.y = ryOut(a); g.add(hd);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.42), bin); hd.add(body);
    for (const s of [-1, 1]) { const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.42, 12).rotateX(PI / 2), gold); tb.position.set(s * 0.13, 0.03, 0.3); hd.add(tb);
      const ey = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10).rotateX(PI / 2), bin); ey.position.set(s * 0.12, 0.05, -0.27); hd.add(ey); }
    circles.push([p.x, p.z, 0.4]); return { a, p, head: hd, i }; });
  // ---- street-level elevator kiosk (west face of the podium) ----
  { const kx = 56.4, kz = NZ; b.box(dark, kx, 0, kz - 1.6, 2.8, 3.4, 0.2); b.box(dark, kx, 0, kz + 1.6, 2.8, 3.4, 0.2); b.box(dark, kx - 0.2, 3.4, kz, 3.2, 0.25, 3.6);
    b.box(gold, kx + 1.0, 0, kz, 0.1, 3.2, 2.9); signMesh(g, 'SKY NEEDLE ▲ ELEVATOR', '#ff66cc', kx - 1.82, 4.2, kz, 4.6, 0.9, -PI / 2, 'OBSERVATION DECK 238 m · TOP OF THE STRIP');
    strip.aabbs.push([kx - 1.4, kx + 1.6, kz - 1.75, kz + 1.75]);
    strip.needleKiosk = { x: kx - 2.6, z: kz, r: 3.2 }; }
  // ---- glass elevator cab on the shaft (faces the Strip) ----
  const cab = new THREE.Group(); g.add(cab); A.cab = cab;
  { const fl = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.16, 2.7), dark); cab.add(fl); const rf = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 2.8), dark); rf.position.y = 3.0; cab.add(rf);
    for (const [x, z, w, d] of [[0, 1.33, 2.7, 0.04], [1.33, 0, 0.04, 2.7], [-1.33, 0, 0.04, 2.7]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(w, 2.9, d), glass); p.position.set(x, 1.5, z); cab.add(p); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.9, 0.06), bronze); back.position.set(0, 1.5, -1.33); cab.add(back);
    for (const x of [-1.33, 1.33]) for (const z of [-1.33, 1.33]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.0, 0.08), gold); p.position.set(x, 1.5, z); cab.add(p); }
    const rl = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.05), gold); rl.position.set(0, 1.0, 1.28); cab.add(rl);
    const lg = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 0.06), ledP); lg.position.set(0, 2.9, 1.3); cab.add(lg); const lg2 = lg.clone(); lg2.position.y = 0.12; cab.add(lg2);
    logoPlane(cab, 'dj', 0, 1.9, -1.29, 1.1, 0); cab.traverse(o => { if (o.isMesh) o.castShadow = false; }); }
  const cabAt = y => { const r = shaftR(y + 1.5) + 1.55; cab.position.copy(pol(r, AE, y)); cab.rotation.y = ryOut(AE); };
  cabAt(18.05);
  b.flush(g);
  // ---- far view: suburb light grid + horizon city glow (night / sunset) ----
  const NP = Q.key === 'low' ? 3200 : Q.key === 'med' ? 6000 : 9000, pos = new Float32Array(NP * 3), col = new Float32Array(NP * 3);
  for (let i = 0; i < NP; i++) { let x, z; do { const rr = 380 + Math.pow(R(), 0.8) * 5600, a = R() * PI * 2; x = Math.cos(a) * rr; z = Math.sin(a) * rr * 1.25; } while (Math.abs(x) < 240 && Math.abs(z) < 720);
    if (R() < 0.5) x = Math.round(x / 180) * 180 + (R() - 0.5) * 6; else z = Math.round(z / 180) * 180 + (R() - 0.5) * 6;
    if (x < -2600) { i--; continue; } // the Spring Mountains are dark
    pos.set([x, 0.6, z], i * 3); const d = Math.hypot(x, z), f = Math.max(0.28, 1 - d / 7000), wht = R() < 0.25; col.set(wht ? [0.85 * f, 0.88 * f, f] : [f, 0.6 * f, 0.28 * f], i * 3); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pm = new THREE.PointsMaterial({ size: Q.key === 'low' ? 1.6 : 2.0, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, depthWrite: false, opacity: 1 });
  const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; pts.renderOrder = -990; g.add(pts);
  const [gc, gx] = canvas(8, 128); const gr = gx.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, 'rgba(255,150,80,0.55)'); gr.addColorStop(0.35, 'rgba(255,110,120,0.22)'); gr.addColorStop(1, 'rgba(120,60,160,0)'); gx.fillStyle = gr; gx.fillRect(0, 0, 8, 128);
  const glowM = new THREE.MeshBasicMaterial({ map: tex(gc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.BackSide });
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, true).translate(0, 0.5, 0), glowM); dome.frustumCulled = false; dome.renderOrder = -995; C.scene.add(dome);
  let night = true, tod = 'night'; onNight((n, t) => { night = n; tod = t; pm.opacity = t === 'night' ? 1 : 0.45; glowM.opacity = t === 'night' ? 1 : 0.5; });
  const farView = () => { const cy = C.camera.position.y, high = cy > 45; pts.visible = night && high && (C.state.area.outdoor);
    dome.visible = night && C.state.area.outdoor && high; if (dome.visible) { const Rr = C.camera.far * 0.78; dome.position.set(C.camera.position.x, -20, C.camera.position.z); dome.scale.set(Rr, Rr * 0.16, Rr); } };

  // ---- area setup ----
  Object.assign(A, { ring: { cx: NX, cz: NZ, r0: R_CORE + 0.35, r1: R_RAIL - 0.3, w0: RG0 - 0.12, w1: RG1 + 0.12, doors: DOORS, half: DOOR_HALF, ceil: CEIL - 0.35 },
    mapRects: [[NX - 30, NX + 30, NZ - 30, NZ + 30]], spawn: (() => { const p = pol(12.5, AE); return { x: p.x, z: p.z, yaw: Math.atan2(-Math.cos(AE), -Math.sin(AE)) }; })(),
    drawMap: (gg, P, s, full) => { const ring = (r, fill, stroke, w = 1) => { const [u, v] = P(NX, NZ); gg.beginPath(); gg.arc(u, v, r * s, 0, PI * 2); if (fill) { gg.fillStyle = fill; gg.fill(); } if (stroke) { gg.lineWidth = w; gg.strokeStyle = stroke; gg.stroke(); } };
      ring(R_EDGE, '#3b2c1e', '#b46cffaa', 2); ring(RG1, '#2e2a26'); ring(R_CORE, '#15110d', '#c9932e', 2);
      gg.lineWidth = Math.max(2, s * 0.5); gg.strokeStyle = '#8fd0ff'; for (let k = 0; k < 4; k++) { const [u, v] = P(NX, NZ); gg.beginPath(); gg.arc(u, v, (RG0 + RG1) / 2 * s, DOORS[k] + dh, DOORS[(k + 1) % 4] - dh + (k === 3 ? 2 * PI : 0)); gg.stroke(); } gg.lineWidth = 1;
      if (full) { gg.font = 'bold 13px sans-serif'; gg.textAlign = 'center'; gg.fillStyle = '#f3e6c4'; const [u, v] = P(NX, NZ); gg.fillText('ELEVATOR', u, v + 4); const q = P(pol(25.6, AE + PI / 4).x, pol(25.6, AE + PI / 4).z); gg.fillText('outdoor skywalk', q[0], q[1]); const q2 = P(pol(14, AE + PI / 4).x, pol(14, AE + PI / 4).z); gg.fillText('indoor lounge', q2[0], q2[1]); } } });
  A.interacts.push({ ...xz(pol(R_CORE + 1.3, AE)), r: 2.2, label: 'Elevator down to the Strip', act: () => rideDown() });
  A.interacts.push({ ...xz(pol(10.6, BAR_A)), r: 2.6, label: 'Sky Bar · cocktail (15 coins)', act: () => C.drink('Sky Bar') });
  for (const bn of A.binocs) A.interacts.push({ ...xz(pol(R_RAIL - 1.5, bn.a)), r: 1.4, label: 'Coin binoculars (5 coins)', act: () => openBinoc(bn.i) });
  A.anim.push(() => farView()); strip.anim.push(() => farView());

  // ---- elevator ride (cinematic) ----
  const cine = { on: false, dir: 1, t: 0, dur: 11 };
  function startRide(dir) { const st = C.state; cine.on = true; cine.dir = dir; cine.t = 0; cine.dur = Q.key === 'low' ? 9 : 11; st.cine = cine; st.emote = null; C.showUI('cine'); C.$('cineSkip').onclick = () => (cine.t = cine.dur); updRide(0); }
  function rideUp() { C.transition(() => { C.enterArea('strip', NX - 10, NZ, PI / 2); startRide(1); C.toast('🗼 Sky Needle Express: glass elevator to the 238 m deck'); }); }
  function rideDown() { C.transition(() => { C.enterArea('strip', NX - 10, NZ, PI / 2); startRide(-1); }); }
  const YB = 18.1, YT = 222.5;
  function updRide(dt, t = 0) { cine.t = Math.min(cine.dur, cine.t + dt); const k = ease(cine.t / cine.dur), y = cine.dir > 0 ? YB + (YT - YB) * k : YT - (YT - YB) * k; cabAt(y);
    const p = C.player; cab.updateMatrixWorld(); p.position.copy(new THREE.Vector3(0.35, 0.08, 0.35).applyMatrix4(cab.matrixWorld)); p.rotation.y = ryOut(AE) + 0.35; animate(p, t, 0, '');
    C.$('cineAlt').textContent = `${Math.round(y + 16)} m`; C.$('cineBar').style.width = (k * 100) + '%';
    if (cine.t >= cine.dur && cine.on) { cine.on = false; if (cine.dir > 0) C.transition(() => { endCine(); const s = A.spawn; C.enterArea('needle', s.x, s.z, s.yaw); C.toast('🗼 Welcome to the top: 238 m. Walk the indoor lounge or step out onto the skywalk (360°).'); });
      else C.transition(() => { endCine(); cabAt(YB); C.enterArea('strip', strip.needleKiosk.x - 1.5, NZ, PI / 2); }); } }
  function endCine() { C.state.cine = null; if (C.state.ui === 'cine') C.closeUI(); }
  const cv = new THREE.Vector3(), ct = new THREE.Vector3();
  function cineCamera(dt) { cab.updateMatrixWorld(); const sw = Math.sin(cine.t * 0.35) * 0.25; cv.set(-0.75 + sw, 2.15, -0.95).applyMatrix4(cab.matrixWorld); ct.set(0.6 + sw * 4, 0.4 - cine.dir * 0.2, 8).applyMatrix4(cab.matrixWorld); ct.y -= 4;
    C.camera.position.copy(cv); C.camera.lookAt(ct); C.CHAR.camPos.copy(C.camera.position); C.player.visible = true; return true; }

  // ---- coin binoculars ----
  const TGT = { 'TILEO KINGDOM': 120, 'Luxe Pyramid': 55, 'Emerald City Grand': 60, 'Bellissimo': 60, 'Flamingo Pink': 45, 'Kingdom of Rome': 50, 'Venezia Grand': 60 };
  const targets = () => [...strip.landmarks.filter(l => l.name !== 'Sky Needle').map(l => ({ name: l.name, x: l.x, y: TGT[l.name] ?? 40, z: l.z })),
    { name: 'Spring Mountains', x: -3200, y: 160, z: 200 }, { name: 'Valley suburbs', x: 1900, y: 10, z: -900 }, { name: 'Desert highway', x: 300, y: 5, z: 2200 }];
  const bz = { i: 0, yaw: 0, pitch: 0, zoom: 2 }; const labels = [];
  function openBinoc(i) { const S = C.save; if (S.coins < 5) { C.toast('🔭 You need 5 coins for the binoculars.'); return; }
    C.setCoins(S.coins - 5); const bn = A.binocs[i]; Object.assign(bz, { i, yaw: bn.a, pitch: 0.06, zoom: 2.5 }); C.showUI('binoc'); drawMask(); setZoom(bz.zoom); C.toast('🔭 5 coins: drag to pan, pinch / wheel / slider to zoom'); }
  function setZoom(z) { bz.zoom = Math.max(1, Math.min(16, z)); C.$('binocZoom').value = bz.zoom; C.$('binocZv').textContent = bz.zoom.toFixed(1) + '×'; }
  function binocDrag(dx, dy) { const f = 0.0045 / bz.zoom; bz.yaw += dx * f * 1.0; bz.pitch = Math.max(-0.75, Math.min(0.5, bz.pitch + dy * f)); const bn = A.binocs[bz.i]; const d = wrap(bz.yaw - bn.a); if (Math.abs(d) > 1.9) bz.yaw = bn.a + Math.sign(d) * 1.9; }
  function drawMask() { const m = C.$('binocMask'), w = innerWidth, h = innerHeight; m.width = w; m.height = h; const x = m.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'destination-out';
    const r = Math.min(h * 0.46, w * 0.27), off = r * 0.62; for (const s of [-1, 1]) { const gr = x.createRadialGradient(w / 2 + s * off, h / 2, r * 0.82, w / 2 + s * off, h / 2, r); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.beginPath(); x.arc(w / 2 + s * off, h / 2, r, 0, PI * 2); x.fill(); }
    x.globalCompositeOperation = 'source-over'; bz.r = r; bz.off = off; }
  addEventListener('resize', () => { if (C.state.ui === 'binoc') drawMask(); });
  const tv = new THREE.Vector3();
  function binocCamera() { const bn = A.binocs[bz.i], cam = C.camera; const p = pol(R_RAIL + 0.35, bn.a, FLOOR + 1.45);
    cam.position.copy(p); tv.set(Math.cos(bz.yaw) * Math.cos(bz.pitch), -Math.sin(bz.pitch), Math.sin(bz.yaw) * Math.cos(bz.pitch)).add(p); cam.lookAt(tv);
    const fov = 56 / bz.zoom; if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); } C.CHAR.camPos.copy(cam.position); C.player.visible = false;
    // labels
    const box = C.$('binocLabels'), w = innerWidth, h = innerHeight; let n = 0;
    for (const T of targets()) { tv.set(T.x, T.y, T.z).project(cam); if (tv.z > 1 || tv.z < -1) continue; const sx = (tv.x + 1) / 2 * w, sy = (1 - tv.y) / 2 * h;
      const inside = [-1, 1].some(s => Math.hypot(sx - (w / 2 + s * bz.off), sy - h / 2) < bz.r * 0.84); if (!inside) continue;
      let el = labels[n]; if (!el) { el = document.createElement('div'); el.className = 'bLbl'; box.appendChild(el); labels[n] = el; }
      const d = Math.hypot(T.x - p.x, T.z - p.z); el.innerHTML = `<b>${T.name}</b><small>${d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}</small>`; el.style.transform = `translate(${sx}px,${sy}px)`; el.style.display = ''; n++; }
    for (let k = n; k < labels.length; k++) labels[k].style.display = 'none'; bz.visible = n; return true; }
  // point the binoculars at a named target (picks the binocular on that side of the deck)
  function aimAt(name) { const T = targets().find(t => t.name === name); if (!T) return false; let best = 0, bd = 1e9;
    A.binocs.forEach((bn, k) => { const d = Math.abs(wrap(Math.atan2(T.z - NZ, T.x - NX) - bn.a)); if (d < bd) { bd = d; best = k; } });
    if (best !== bz.i) { bz.i = best; } const p = pol(R_RAIL + 0.35, A.binocs[best].a, FLOOR + 1.45); bz.yaw = Math.atan2(T.z - p.z, T.x - p.x); bz.pitch = Math.atan2(p.y - T.y, Math.hypot(T.x - p.x, T.z - p.z)); binocDrag(0, 0); return true; }
  function closeBinoc() { C.camera.fov = 62; C.camera.updateProjectionMatrix(); }
  C.$('binocZoom').oninput = e => setZoom(+e.target.value); C.$('binocIn').onclick = () => setZoom(bz.zoom * 1.5); C.$('binocOut').onclick = () => setZoom(bz.zoom / 1.5);
  return { rideUp, rideDown, updRide, cineCamera, cine, aimAt, openBinoc, binocCamera, binocDrag, setZoom, closeBinoc, bz, endCine, cabAt, targets };
}
const xz = v => ({ x: v.x, z: v.z });
