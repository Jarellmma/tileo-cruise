// Tileo Kingdom interiors: lobby+casino, pool deck, room floor, hotel room, mega club
import * as THREE from 'three';
import { G, M, B, add, box, cyl, plane, T, rep, glow, neon, onNight, signMesh, rng, PI, logoPlane, goldM, canvas, tex , pbr } from './core.js?v=1793692130';
import { makeLion, makeCharacter, makeDJ, randomLook, animate, applyLook } from './characters.js?v=1793692130';
import { palms, facadeMat, makeWater } from './world.js?v=1793692130';
import { STY, facade, roofMat } from './city.js?v=1793692130';
import { Q } from './quality.js?v=1793692130';

const R = rng(99);
const gold = () => goldM(0.35, 0.26);
// procedural travertine deck tiles (canvas, 512px) for the rooftop pool deck
let _trav; function travertine() { if (_trav) return _trav; const [c, g] = canvas(512, 512); const r = rng(7);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 214 + r() * 18 | 0; g.fillStyle = `rgb(${v},${v - 10 | 0},${v - 28 | 0})`; g.fillRect(i * 128 + 2, j * 128 + 2, 124, 124);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${150 + r() * 40 | 0},${120 + r() * 30 | 0},${90 + r() * 20 | 0},${0.08 + r() * 0.12})`; g.fillRect(i * 128 + r() * 120, j * 128 + r() * 126, 4 + r() * 60, 1 + r() * 2.5); } }
  g.fillStyle = '#9a8a74'; for (let i = 0; i <= 4; i++) { g.fillRect(i * 128 - 2, 0, 4, 512); g.fillRect(0, i * 128 - 2, 512, 4); } return _trav = tex(c); }
// ---- real Las Vegas skyline photos (Wikimedia Commons, CC BY-SA; see README CREDITS) on a curved backdrop outside suite glass ----
export const SKYLINE_CREDITS = [
  { tod: 'Day', title: 'Strip from Stratosphere tower 4', author: 'Antoine Taveneaux', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Strip_from_Stratosphere_tower_4.jpg' },
  { tod: 'Sunset', title: 'Nevada - Las Vegas Dusk over the Strip - seen from Stratosphere Tower', author: 'Reinhard Link (Traveller-Reini)', license: 'CC BY-SA 2.0', url: 'https://commons.wikimedia.org/wiki/File:Nevada_-_Las_Vegas_Dusk_over_the_Strip-_seen_from_Stratosphere_Tower_(49822715931).jpg' },
  { tod: 'Night', title: 'Strip from Stratosphere tower 3', author: 'Antoine Taveneaux', license: 'CC BY-SA 3.0', url: 'https://commons.wikimedia.org/wiki/File:Strip_from_Stratosphere_tower_3.jpg' },
];
const skyTex = {}; let skyLoader;
function skylineTexture(tod) {
  if (skyTex[tod]) return skyTex[tod]; skyLoader = skyLoader || new THREE.TextureLoader();
  const t = skyTex[tod] = skyLoader.load(`assets/images/skyline/${tod}${Q.key === 'low' ? '_1k' : ''}.jpg`); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.y = { day: -0.08, sunset: 0.07, night: -0.2 }[tod] || 0; t.anisotropy = 4; return t; // keep each photo horizon + city band in the window; // repeat -1: un-mirror the inside of the cylinder
}
// wall z = wz with a window opening [x0,x1]×[y0,y1]; curved photo screen of radius r centred at (cx, cz); `aspect` = photo w/h
function skylineWindow(g, A, o) {
  const { x0, x1, y0, y1, wz, h, wallMat, wx0, wx1, cx = 0, cz, r = 26, arc = 1.9, yMid = 1.0, mullions = 3 } = o, t = 1, gm = gold();
  box(g, wallMat, (wx0 + wx1) / 2, 0, wz - t / 2, wx1 - wx0 + 2, y0, t); box(g, wallMat, (wx0 + wx1) / 2, y1, wz - t / 2, wx1 - wx0 + 2, h - y1, t);
  box(g, wallMat, (wx0 - 1 + x0) / 2, y0, wz - t / 2, x0 - wx0 + 1, y1 - y0, t); box(g, wallMat, (x1 + wx1 + 1) / 2, y0, wz - t / 2, wx1 + 1 - x1, y1 - y0, t);
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.1, roughness: 0.04, metalness: 0.2, depthWrite: false });
  plane(g, glass, (x0 + x1) / 2, (y0 + y1) / 2, wz - 0.5, x1 - x0, y1 - y0, 0, 0);
  for (let i = 1; i <= mullions; i++) { const x = x0 + (x1 - x0) * i / (mullions + 1); box(g, gm, x, y0, wz - 0.5, 0.08, y1 - y0, 0.08); }
  box(g, gm, (x0 + x1) / 2, y0 - 0.05, wz - 0.45, x1 - x0 + 0.2, 0.1, 0.3); box(g, gm, (x0 + x1) / 2, y1, wz - 0.45, x1 - x0 + 0.2, 0.1, 0.3);
  const H = r * arc / 1.51; // keep the photo's aspect (≈3:2) across the arc
  const geo = new THREE.CylinderGeometry(r, r, H, 64, 1, true, PI - arc / 2, arc);
  const mat = new THREE.MeshBasicMaterial({ map: skylineTexture('night'), side: THREE.BackSide, fog: false, toneMapped: true });
  const screen = new THREE.Mesh(geo, mat); screen.position.set(cx, yMid, cz); g.add(screen);
  // deep backdrop behind the screen edges so nothing unlit shows through at grazing angles
  onNight((n, tod) => { const k = tod || (n ? 'night' : 'day'); mat.map = skylineTexture(k); mat.color.setScalar(k === 'night' ? 0.95 : k === 'sunset' ? 0.8 : 0.62); mat.needsUpdate = true; });
  return screen;
}
function walls(g, A, x0, x1, z0, z1, h, mat, skip = {}) {
  const t = 1;
  if (!skip.n) box(g, mat, (x0 + x1) / 2, 0, z0 - t / 2, x1 - x0 + 2, h, t);
  if (!skip.s) box(g, mat, (x0 + x1) / 2, 0, z1 + t / 2, x1 - x0 + 2, h, t);
  if (!skip.w) box(g, mat, x0 - t / 2, 0, (z0 + z1) / 2, t, h, z1 - z0);
  if (!skip.e) box(g, mat, x1 + t / 2, 0, (z0 + z1) / 2, t, h, z1 - z0);
}
function trim(g, x0, x1, z0, z1, y, mat) { // gold trim band around room
  box(g, mat, (x0 + x1) / 2, y, z0 + 0.05, x1 - x0, 0.25, 0.12); box(g, mat, (x0 + x1) / 2, y, z1 - 0.05, x1 - x0, 0.25, 0.12);
  box(g, mat, x0 + 0.05, y, (z0 + z1) / 2, 0.12, 0.25, z1 - z0); box(g, mat, x1 - 0.05, y, (z0 + z1) / 2, 0.12, 0.25, z1 - z0);
}
// elevator doors facing +z at local origin (rotated by ry). Doors slide open when player is near.
function elevator(A, g, x, z, ry, label) {
  const e = new THREE.Group(); e.position.set(x, 0, z); e.rotation.y = ry; g.add(e);
  const gm = glow(0xe8bf5a, 0x8a5a00, 0.5, 0.7); box(e, gm, 0, 0, 0, 4.6, 5.6, 0.5); box(e, M(0x050505), 0, 0, 0.05, 3.6, 4.8, 0.5);
  const dm = new THREE.MeshStandardMaterial({ color: 0xc9a34a, emissive: 0x3a2a00 }); const L = box(e, dm, -0.9, 0, 0.32, 1.8, 4.8, 0.12), Rr = box(e, dm, 0.9, 0, 0.32, 1.8, 4.8, 0.12);
  box(e, new THREE.MeshStandardMaterial({ map: rep(T.tiger, 1, 1) }), 0, 0, 0.27, 3.5, 4.7, 0.05);
  signMesh(e, label, '#ffcf4a', 0, 6.1, 0.3, 4.4, 0.8, 0, '', '#0e0d0c');
  const btn = add(e, G.sph, neon(0xffd23a), 2.7, 1.6, 0.3, 0.14, 0.14, 0.08);
  logoPlane(e, 'dj', -3.35, 2.9, 0.3, 1.9, 0, { back: 0x0b0906, pad: 0.12 }); // DJ Tileo poster by each elevator
  const st = { open: 0 }; A.elevDoor = st;
  A.anim.push((t, dt, P) => { const wx = x + Math.sin(ry) * 3, wz = z + Math.cos(ry) * 3; const near = Math.hypot(P.x - wx, P.z - wz) < 5 || st.force > 0; st.force = Math.max(0, (st.force || 0) - dt);
    st.open += ((near ? 1 : 0) - st.open) * Math.min(1, dt * 4); L.position.x = -0.9 - st.open * 1.7; Rr.position.x = 0.9 + st.open * 1.7; btn.scale.setScalar(near ? 0.18 : 0.14); });
  return e;
}
// a guest who walks a closed loop of waypoints (casino aisles, pool deck), pausing now and then
function walker(g, A, pts, speed = 1.25, look) { const c = makeCharacter(look || randomLook(R)); g.add(c); let i = 0, pause = R() * 4; const p = { x: pts[0][0], z: pts[0][1] };
  c.position.set(p.x, 0, p.z); A.anim.push((t, dt) => { let sp = 0; if (pause > 0) pause -= dt; else { const [tx, tz] = pts[(i + 1) % pts.length], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d < 0.2) { i = (i + 1) % pts.length; if (R() < 0.25) pause = 2 + R() * 5; } else { const st = Math.min(d, speed * dt); p.x += dx / d * st; p.z += dz / d * st; sp = speed; const want = Math.atan2(dx, dz); let dr = want - c.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); c.rotation.y += dr * Math.min(1, dt * 6); } }
    c.position.set(p.x, 0, p.z); animate(c, t, sp, sp ? '' : 'phone'); }); return c; }
function npc(g, A, x, z, ry = 0, mode = '', look) { const c = makeCharacter(look || randomLook(R)); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c); A.anim.push(t => animate(c, t, 0, mode)); return c; }
function sofa(g, x, z, ry, len = 4, mat = M(0x141210)) { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s); box(s, mat, 0, 0, 0, len, 0.5, 1.2); box(s, mat, 0, 0, -0.5, len, 1.2, 0.3); box(s, gold(), 0, 0.5, 0.0, len + 0.05, 0.06, 1.22); return s; }
function circleCol(A, x, z, r) { A.aabbs.push([x - r, x + r, z - r, z + r]); }

// =========================== LOBBY + CASINO ===========================
export function buildLobby(A, ctx) {
  const g = A.group; const wallM = M(0x231910), gm = gold();
  plane(g, pbr('marble', 40 / 2.4, 50 / 2.4, { color: 0xeee7dc, metalness: 0.02 }), 0, 0, 0, 40, 50).receiveShadow = true;
  plane(g, pbr('carpet', 50 / 3.2, 50 / 3.2, { normalScale: 0.8 }), 45, 0, 0, 50, 50).receiveShadow = true;
  plane(g, new THREE.MeshStandardMaterial({ map: rep(T.tiger, 1, 3) }), 0, 0.02, 15, 5, 18); plane(g, new THREE.MeshStandardMaterial({ map: rep(T.tiger, 1, 3) }), 0, 0.02, -15, 5, 18);
  plane(g, M(0x1a120a, { side: THREE.DoubleSide }), 0, 12, 0, 40, 50, PI / 2); plane(g, M(0x120c06, { side: THREE.DoubleSide }), 45, 12, 0, 50, 50, PI / 2);
  for (let i = -1; i <= 1; i++) for (let j = -2; j <= 2; j++) if (i || j) plane(g, gm, i * 12, 11.95, j * 10, 0.3, 9, PI / 2); // coffer lines
  walls(g, A, -20, 70, -25, 25, 12, wallM);
  box(g, wallM, 20, 0, -18, 1, 12, 14); box(g, wallM, 20, 0, 18, 1, 12, 14); box(g, gm, 20, 9, 0, 1.4, 1, 22); // arch to casino
  signMesh(g, 'KINGDOM CASINO', '#ffcf4a', 19.3, 10.2, 0, 12, 1.6, -PI / 2, '', '#0e0d0c');
  trim(g, -20, 70, -25, 25, 3, gm); trim(g, -20, 70, -25, 25, 9.6, gm);
  const tigerBand = new THREE.MeshStandardMaterial({ map: rep(T.tiger, 20, 1) }); box(g, tigerBand, -19.45, 0, 0, 0.12, 3, 50); box(g, tigerBand, 0, 0, 24.45, 40, 3, 0.12); box(g, tigerBand, 0, 0, -24.45, 40, 3, 0.12);
  // pillars
  for (const [x, z] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) { cyl(g, M(0x0e0d0c, { roughness: 0.12, metalness: 0.3 }), x, 0, z, 0.9, 12); cyl(g, gm, x, 0, z, 1.05, 0.6); cyl(g, gm, x, 11.2, z, 1.05, 0.8); circleCol(A, x, z, 1.1); }
  // gold lion fountain
  cyl(g, M(0xeae2d4), 0, 0, 0, 4.6, 0.9); cyl(g, gm, 0, 0.9, 0, 4.7, 0.12); const w = plane(g, new THREE.MeshStandardMaterial({ map: rep(T.water, 2, 2), emissive: 0x0a4a7a, emissiveIntensity: 0.5 }), 0, 0.8, 0, 8.6, 8.6);
  cyl(g, M(0xeae2d4), 0, 0, 0, 1.1, 2.6); const lion = makeLion(gm, 1.5); lion.position.set(0, 2.6, 0); lion.rotation.y = PI; g.add(lion);
  const jm = B(0xddf4ff, { transparent: true, opacity: 0.6 }); const jets = []; for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; jets.push(add(g, G.cyl6, jm, Math.cos(a) * 3.6, 1.5, Math.sin(a) * 3.6, 0.07, 1.4, 0.07)); }
  A.anim.push(t => { w.material.map.offset.set(t * 0.03, t * 0.02); jets.forEach((j, k) => { j.scale.y = 1.2 + Math.sin(t * 3 + k) * 0.5; }); });
  A.aabbs.push([-4.8, 4.8, -4.8, 4.8]);
  // chandelier (tiger-print drum + gold rings + crystals)
  const ch = new THREE.Group(); ch.position.set(0, 7.6, 0); g.add(ch);
  add(ch, G.cyl6, gm, 0, 3, 0, 0.05, 3.5, 0.05);
  const drum = add(ch, new THREE.CylinderGeometry(1, 1, 1, 20, 1, true), new THREE.MeshStandardMaterial({ map: rep(T.tiger, 4, 1), emissive: 0xff9a2a, emissiveMap: rep(T.tiger, 4, 1), emissiveIntensity: 0.8, side: THREE.DoubleSide }), 0, 1.0, 0, 3.4, 1.2, 3.4);
  for (const [r, y] of [[3.6, 0.3], [2.6, -0.3], [1.6, -0.8]]) { const t = add(ch, G.torus, gm, 0, y, 0, r, r, r * 2); t.rotation.x = PI / 2; }
  const cry = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.16), B(0xfff6dc), 60); const mm = new THREE.Matrix4();
  for (let k = 0; k < 60; k++) { const a = k * 2.4, r = 1.2 + (k % 3) * 1.1; mm.makeTranslation(Math.cos(a) * r, -0.6 - (k % 5) * 0.35, Math.sin(a) * r); cry.setMatrixAt(k, mm); } ch.add(cry);
  A.anim.push(t => ch.rotation.y = t * 0.05);
  const cl = new THREE.PointLight(0xffd8a0, 34, 40, 1.3); cl.position.set(0, 6.5, 0); g.add(cl);
  // check-in desk (west)
  box(g, M(0x0e0d0c), -15, 0, 0, 2.2, 1.2, 16); box(g, gm, -15, 1.2, 0, 2.6, 0.15, 16.4); box(g, new THREE.MeshStandardMaterial({ map: rep(T.tiger, 6, 1) }), -13.85, 0.15, 0, 0.06, 0.9, 15.6);
  A.aabbs.push([-20, -13.6, -8.4, 8.4]);
  // RESORT logo: lobby feature wall behind the desk + check-in desk front
  box(g, M(0x0b0906), -19.8, 2.6, 0, 0.3, 8.6, 8.4); box(g, gm, -19.75, 2.4, 0, 0.32, 0.2, 8.8); box(g, gm, -19.75, 11.2, 0, 0.32, 0.2, 8.8);
  logoPlane(g, 'resort', -19.6, 6.9, 0, 7.8, PI / 2, { maxW: 7.6 });
  for (const zz of [-4.6, 0, 4.6]) logoPlane(g, 'resort', -13.78, 0.62, zz, 0.92, PI / 2, { back: 0x0b0906, pad: 0.14 });
  signMesh(g, 'CHECK-IN', '#ffcf4a', -19.4, 3.2, -5.5, 5, 1.2, PI / 2, '', '#0e0d0c'); signMesh(g, 'TILEO KINGDOM', '#ffcf4a', -19.4, 3.2, 5.5, 6, 1.2, PI / 2, '', '#0e0d0c');
  npc(g, A, -17.2, -3, PI / 2, '', { skin: '#8a5636', hair: '#1a1209', outfit: '#111111', style: 'solid' }); npc(g, A, -17.2, 3.5, PI / 2, '', { skin: '#f1c9a5', hair: '#d8b45a', outfit: '#111111', style: 'solid', hairLong: true });
  A.interacts.push({ x: -12.6, z: 0, r: 4, label: () => ctx.save.room ? `Front desk · Room ${ctx.save.room}` : 'Check in', act: () => ctx.checkIn() });
  // boutique kiosk
  box(g, M(0x0e0d0c), 15, 0, 18, 6, 1, 3); box(g, gm, 15, 1, 18, 6.2, 0.1, 3.2); signMesh(g, 'TIGER BOUTIQUE', '#ffcf4a', 15, 5, 24.4, 8, 1.4, PI, '', '#0e0d0c');
  for (let k = 0; k < 5; k++) box(g, M([0xffffff, 0xc9932e, 0xb0102a, 0xff7a1a, 0x111111][k]), 12 + k * 1.5, 1.6, 22.6, 1, 2.2, 0.3);
  box(g, gm, 15, 3.9, 22.6, 8, 0.08, 0.08); A.aabbs.push([11.8, 18.2, 16.4, 23.6]);
  const man = makeCharacter({ skin: '#d9a47c', hair: '#1a1209', outfit: '#ffffff', style: 'tiger', hairLong: true }); man.position.set(18.5, 0, 14); man.rotation.y = -PI / 2; g.add(man); A.aabbs.push([18, 19, 13.5, 14.5]);
  A.interacts.push({ x: 14, z: 15.2, r: 3.8, label: 'Shop · Tiger Boutique', act: () => ctx.openShop() });
  // lounge seating
  sofa(g, -12, 16, PI / 2); sofa(g, -8, 20, PI); box(g, gm, -9, 0, 16.5, 2, 0.6, 2); A.aabbs.push([-13, -7, 15, 21]);
  npc(g, A, -12, 14, PI / 2, 'sit'); npc(g, A, -6, 8, -2.3); npc(g, A, 6, 7, 2.4);
  // elevators (back wall) + front doors
  elevator(A, g, -3, -24.4, 0, 'ELEVATOR'); elevator(A, g, 3.2, -24.4, 0, 'ELEVATOR');
  A.interacts.push({ x: 0, z: -21, r: 4.5, label: 'Call elevator', act: () => ctx.openElevator() });
  const glass = glow(0xffe0a0, 0xffc060, 0.6, 0.9); box(g, glass, 0, 0, 24.5, 8, 7, 0.2); box(g, gm, 0, 7, 24.5, 8.6, 0.5, 0.4); box(g, gm, 0, 0, 24.4, 0.15, 7, 0.4);
  A.interacts.push({ x: 0, z: 22, r: 3.5, label: 'Exit to the Strip', act: () => ctx.exitToStrip() });
  // ---- casino ----
  // DJ Tileo casino-floor signage (east wall)
  logoPlane(g, 'dj', 69.5, 6.4, 12, 7.2, -PI / 2, { back: 0x0b0906, pad: 0.12 }); signMesh(g, 'TONIGHT · DJ TILEO · MEGA CLUB', '#ffcf4a', 69.45, 10.9, 12, 9, 1.1, -PI / 2, '', '#0e0d0c');
  logoPlane(g, 'dj', 45, 7.4, 24.45, 5.2, PI, { back: 0x0b0906, pad: 0.12 });
  signMesh(g, 'KINGDOM CASINO · PLAY COINS ONLY · NO CASH OUT', '#ffcf4a', 45, 7.4, -24.4, 22, 1.6, 0, '', '#0e0d0c');
  for (let i = 0; i < 6; i++) { const p = plane(g, glow(0x221100, 0xffb040, 0.9, 0.9), 30 + i * 7, 11.9, 0, 2, 40, PI / 2); p.material.emissiveIntensity = 0.9; }
  const cab = M(0x15110c), top = [glow(0xff3355, 0xff2244, 0.8, 0.8), glow(0xffd23a, 0xffaa00, 0.8, 0.8), glow(0xb46cff, 0x9a4aff, 0.8, 0.8)], scr = B(0xffffff, { map: T.slot });
  const slot = (x, z, ry, feat) => { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
    box(s, feat ? gm : cab, 0, 0, 0, 1.3, 1.9, 1.0); box(s, top[(x * 7 + z * 3 & 7) % 3 | 0] || top[0], 0, 1.9, 0, 1.3, 0.5, 1.0); plane(s, scr, 0, 1.35, 0.51, 1.0, 0.75, 0); box(s, gm, 0, 0.9, 0.45, 1.2, 0.08, 0.3); logoPlane(s, 'dj', 0, 2.15, 0.52, 0.46, 0, { back: 0x0b0906, pad: 0.1 });
    cyl(s, M(0x2a0a0e), 0, 0, 1.0, 0.3, 0.75); A.aabbs.push([x - 0.8, x + 0.8, z - 0.8, z + 0.8]);
    A.interacts.push({ x: x + Math.sin(ry) * 1.6, z: z + Math.cos(ry) * 1.6, r: 1.4, label: feat ? "Play Lion's Roar (featured)" : 'Play slots', act: () => ctx.openSlots() }); return s; };
  for (const rx of [32, 44, 56]) for (let k = 0; k < 5; k++) { slot(rx - 0.6, -21 + k * 2.2, -PI / 2); slot(rx + 0.6, -21 + k * 2.2, PI / 2); }
  slot(25, -6, PI / 2, true); const ring = add(g, G.torus, neon(0xffd23a), 25, 0.08, -6, 1.5, 1.5, 3); ring.rotation.x = PI / 2;
  // tables (stubs for v1)
  const felt = M(0x0e5a2a); cyl(g, M(0x2a1a0a), 40, 0, 14, 3, 0.95); cyl(g, felt, 40, 0.95, 14, 2.8, 0.05); const wheel = cyl(g, gm, 38.5, 1.0, 14, 0.9, 0.2); A.anim.push((t, dt = 0.016) => wheel.rotation.y += dt * (ctx.rlFast ? 10 : 1));
  circleCol(A, 40, 14, 3); A.interacts.push({ x: 40, z: 18.2, r: 2.4, label: 'Play roulette', act: () => ctx.openRoulette() });
  for (const bx of [54, 63]) { cyl(g, M(0x2a1a0a), bx, 0, 14, 2.6, 0.95); cyl(g, felt, bx, 0.95, 14, 2.4, 0.05); circleCol(A, bx, 14, 2.6); A.interacts.push({ x: bx, z: 17.6, r: 2.2, label: 'Play blackjack', act: () => ctx.openBlackjack() }); npc(g, A, bx, 11, 0, '', { skin: '#5e3a22', hair: '#111', outfit: '#ffffff', style: 'solid' }); }
  box(g, M(0x0e0d0c), 68, 0, -2, 3, 3, 10); box(g, gm, 68, 3, -2, 3.4, 0.2, 10.4); signMesh(g, 'COIN CAGE', '#ffcf4a', 69.4, 5, -2, 6, 1.2, -PI / 2, '', '#0e0d0c'); A.aabbs.push([66.4, 70, -7.2, 3.2]);
  A.interacts.push({ x: 65, z: -2, r: 3, label: 'Coin Cage · daily bonus', act: () => ctx.dailyBonus() });
  for (let k = 0; k < 6; k++) npc(g, A, 32 + (k % 3) * 12 + (k > 2 ? 1.6 : -1.6), -19 + (k * 3) % 9, k > 2 ? -PI / 2 : PI / 2, 'sit');
  // table players and a croupier (v6.2): guests stand at the roulette and blackjack tables, others stroll the aisles
  npc(g, A, 40, 10.6, 0, '', { skin: '#d9a47c', hair: '#1a1209', outfit: '#111111', style: 'solid', body: 'f', role: 'business' });
  for (const [x, z, ry, m] of [[37.2, 16.6, PI - 0.6, 'fold'], [40.6, 17.4, PI, 'talk'], [43.4, 16.2, PI + 0.7, ''], [52.2, 16.9, PI - 0.3, 'fold'], [55.6, 17, PI + 0.3, ''], [62.4, 17, PI, 'talk']]) npc(g, A, x, z, ry, m);
  walker(g, A, [[29, -7], [61, -7], [61, 6], [29, 6]], 1.2); walker(g, A, [[61, 6], [29, 6], [29, -7], [61, -7]], 1.35); walker(g, A, [[38, -9], [50, -9], [50, 4], [38, 4]], 1.1);
  { const dl = glow(0xfff0d0, 0xffd8a0, 1.4, 1.4); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const d = plane(g, dl, 27 + i * 12, 11.9, -18 + j * 12, 1.2, 1.2, PI / 2); }
    for (const x of [33, 57]) { const l = new THREE.PointLight(0xffc88a, 22, 34, 1.2); l.position.set(x, 9, 0); g.add(l); } }
  A.spawnElev = { x: 0, z: -19, yaw: PI }; A.spawnDoor = { x: 0, z: 20, yaw: 0 };
}

// =========================== POOL DECK (rooftop) ===========================
export function buildPool(A, ctx) {
  const g = A.group, gm = gold();
  { const d = plane(g, pbr('travertine', 124 / 2.4, 104 / 2.4, { macro: [0.06, 0.12], color: 0xbdb6ac }), 0, 0, 0, 124, 104); d.receiveShadow = true; }
  const pl = [];
  // skyline backdrop
  { const keys = ['glassBlue', 'goldGlass', 'darkGlass', 'cream', 'white', 'emerald', 'beige', 'pink'], roof = roofMat();
    for (let k = 0; k < 30; k++) { const a = k / 30 * PI * 2, r = 230 + R() * 80, key = keys[k % keys.length], S = STY[key], w = Math.max(S.tw, Math.round((25 + R() * 30) / S.tw) * S.tw), h = Math.round((60 + R() * 160) / S.th * 4) * S.th / 4;
      const bg = new THREE.BoxGeometry(w, h, w), uv = bg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / S.tw, uv.getY(i) * h / S.th);
      const f = facade(key), m = new THREE.Mesh(bg, [f, f, roof, roof, f, f]); m.position.set(Math.cos(a) * r, h / 2 - 60, Math.sin(a) * r); m.rotation.y = -a; g.add(m); } }
  const glass = new THREE.MeshStandardMaterial({ color: 0xaaddff, transparent: true, opacity: 0.25 }); walls(g, A, -60, 60, -50, 50, 1.4, glass); trim(g, -60, 60, -50, 50, 1.4, gm);
  // water helper
  const wn = T.waterN.clone(); wn.needsUpdate = true; wn.repeat.set(0.5, 0.5);
  const waterM = new THREE.MeshStandardMaterial({ color: 0x1fb4d8, map: rep(T.water, 6, 4), roughness: 0.05, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), emissive: 0x0a88c0, emissiveIntensity: 0.15 }); onNight(n => waterM.emissiveIntensity = n ? 0.9 : 0.12);
  A.anim.push(t => { waterM.map.offset.set(t * 0.02, t * 0.013); wn.offset.set(t * 0.03, -t * 0.02); });
  const coping = M(0xf4efe6);
  // mega pool: free-form = rect + 2 circles
  const shape = new THREE.Shape(); shape.moveTo(-36, -30); shape.lineTo(36, -30); shape.lineTo(36, 0); shape.absarc(26, 0, 10, 0, PI / 2, false); shape.lineTo(-20, 10); shape.absarc(-26, 4, 10, PI / 2, PI, false); shape.lineTo(-36, -30);
  const pg = new THREE.ShapeGeometry(shape, 24); const pu = pg.attributes.uv; for (let i = 0; i < pu.count; i++) pu.setXY(i, pu.getX(i) / 12, pu.getY(i) / 12);
  const PW = makeWater(g, 72, 60, 0, 0.05, 0, { geometry: pg, color: 0x0e8fb8, glow: 0x0a7ab0, size: 6, distortion: 0.9, w: 72, d: 60 }); PW.lo.material = waterM; PW.r = 40;
  // underwater glow strip + pool lights (night)
  const ul = new THREE.PointLight(0x33c8ff, 0, 40, 1.4); ul.position.set(0, 3, 12); g.add(ul); onNight(n => ul.intensity = n ? 12 : 0);
  // rotateX(-PI/2) maps shape y -> world -z
  A.water.push({ rect: [-36, 36, -10, 30], depth: 1.0 }); // approx (world z = -shape.y)
  box(g, coping, 0, 0, 30.3, 73, 0.2, 0.6); box(g, coping, -36.3, 0, 10, 0.6, 0.2, 41); box(g, coping, 36.3, 0, 15, 0.6, 0.2, 31);
  // central rock cliff waterfall + hidden grotto (north edge of pool, world z ~ +30 => put cliff at z 31..43)
  const rock = M(0x6b5a4a), rock2 = M(0x584a3c);
  for (let k = 0; k < 26; k++) { const side = k % 2 ? 1 : -1; const x = side * (9.5 + R() * 6), y = R() * 12, z = 32 + R() * 10; add(g, G.dode, k % 3 ? rock : rock2, x, y, z, 2.6 + R() * 1.6, 3 + R() * 3, 2.6 + R() * 1.6); }
  for (let k = 0; k < 10; k++) add(g, G.dode, rock, -8 + k * 1.8, 11 + R() * 3, 33 + R() * 8, 3, 2.6, 3); // lintel over grotto
  box(g, rock2, 0, 13, 37, 20, 2, 12);
  A.aabbs.push([-17, -6, 30.5, 44], [6, 17, 30.5, 44]);
  // carved lion heads on the cliff
  const lionHead = (x) => { const h = new THREE.Group(); h.position.set(x, 12.5, 30.6); g.add(h); add(h, G.ico, gm, 0, 0, 0, 1.6, 1.8, 1); add(h, G.sph, gm, 0, -0.1, 0.6, 0.9, 1.0, 0.7); add(h, G.box, M(0x111111), -0.35, 0.2, 1.25, 0.2, 0.12, 0.1); add(h, G.box, M(0x111111), 0.35, 0.2, 1.25, 0.2, 0.12, 0.1); };
  lionHead(-7.5); lionHead(7.5);
  // waterfall sheet
  const fallM = new THREE.MeshBasicMaterial({ map: rep(T.fall, 3, 1), transparent: true, opacity: 0.88, depthWrite: false, side: THREE.DoubleSide });
  const fall = plane(g, fallM, 0, 6.2, 30.8, 12, 12.4, 0, 0); A.anim.push(t => fallM.map.offset.y = t * 1.6);
  const foam = plane(g, B(0xffffff, { transparent: true, opacity: 0.6 }), 0, 0.12, 29.5, 13, 2.5); A.anim.push(t => foam.material.opacity = 0.45 + Math.sin(t * 6) * 0.15);
  // second sheet (parallax) + rising mist sprites at the base of the falls
  const fallM2 = fallM.clone(); fallM2.map = rep(T.fall, 2, 1); fallM2.opacity = 0.5; plane(g, fallM2, 0, 6.2, 31.1, 12.6, 12.4, 0, 0); A.anim.push(t => fallM2.map.offset.y = t * 1.1);
  { const [mc, mg] = canvas(64, 64); const gr = mg.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); mg.fillStyle = gr; mg.fillRect(0, 0, 64, 64);
    const mistM = new THREE.SpriteMaterial({ map: tex(mc), transparent: true, opacity: 0.32, depthWrite: false }); const mist = [];
    for (let k = 0; k < 18; k++) { const s = new THREE.Sprite(mistM); s.userData.o = R() * 10; s.userData.x = (R() - 0.5) * 12; g.add(s); mist.push(s); }
    onNight(n => mistM.color.set(n ? 0xffcf90 : 0xffffff));
    A.anim.push(t => mist.forEach(s => { const u = (t * 0.35 + s.userData.o) % 1; s.position.set(s.userData.x, 0.4 + u * 4, 29.4 - u * 2.5); s.scale.setScalar(2 + u * 4); s.material.opacity = 0.32; })); }
  // waterfall lights (gold/orange at night)
  const fl = [new THREE.PointLight(0xffb030, 0, 26, 1), new THREE.PointLight(0xff6a00, 0, 26, 1)]; fl[0].position.set(-4, 2, 26); fl[1].position.set(4, 2, 26); g.add(...fl);
  const lamps = glow(0xffc04a, 0xffa020, 0, 2.2); for (let k = -2; k <= 2; k++) add(g, G.sph, lamps, k * 2.8, 0.15, 29.2, 0.35, 0.2, 0.35);
  onNight(n => { fl[0].intensity = n ? 25 : 0; fl[1].intensity = n ? 25 : 0; fallM.color.set(n ? 0xffc070 : 0xffffff); });
  // DJ Tileo pool banners flanking the waterfall (face the pool / elevator)
  for (const bx of [-21.5, 21.5]) { cyl(g, gm, bx, 0, 31.5, 0.18, 13); box(g, gm, bx, 12.6, 31.5, 6.6, 0.25, 0.3); logoPlane(g, 'dj', bx, 8.6, 31.25, 7.4, PI, { back: 0x0b0906, pad: 0.1 }); A.aabbs.push([bx - 0.5, bx + 0.5, 31, 32]); }
  // grotto lounge behind the falls (third hot tub)
  plane(g, M(0x3a2e24), 0, 0.02, 38, 12, 12); cyl(g, coping, 0, 0, 39, 3.2, 0.5); const gt = plane(g, waterM, 0, 0.52, 39, 5.6, 5.6); A.water.push({ circle: [0, 39, 3.1], depth: 0.6, seat: true });
  const gl = new THREE.PointLight(0xff9a2a, 18, 14, 1); gl.position.set(0, 4, 39); g.add(gl);
  signMesh(g, 'THE GROTTO', '#ffcf4a', 0, 5.5, 43.4, 4, 0.8, PI, '', '#0e0d0c'); sofa(g, -4.5, 41.5, PI, 3); sofa(g, 4.5, 41.5, PI, 3);
  // swim-up bar (island in the pool)
  cyl(g, M(0x0e0d0c), 22, 0, 8, 4, 1.4); cyl(g, gm, 22, 1.4, 8, 4.3, 0.12); cyl(g, M(0xe6dccb), 22, 0, 8, 2.6, 3.2); add(g, G.cone, new THREE.MeshStandardMaterial({ map: rep(T.tiger, 3, 1) }), 22, 4.6, 8, 5, 1.6, 5);
  for (let k = 0; k < 3; k++) cyl(g, gm, 22 + Math.cos(k * 2.1) * 2.2, 0, 8 + Math.sin(k * 2.1) * 2.2, 0.12, 4); circleCol(A, 22, 8, 4.1);
  for (let k = 0; k < 8; k++) { const a = k / 8 * PI * 2; cyl(g, gm, 22 + Math.cos(a) * 5, 0, 8 + Math.sin(a) * 5, 0.35, 0.3); }
  npc(g, A, 22, 6.6, PI, '', { skin: '#b07a52', hair: '#111', outfit: '#ff7a1a', style: 'swim' });
  A.interacts.push({ x: 22, z: 2.6, r: 2.5, label: 'Swim-up bar · order', act: () => ctx.drink('swim-up bar') });
  // 2 tiki bars on deck
  const tiki = (x, z) => { cyl(g, M(0x7a4a24), x, 0, z, 3, 1.2); cyl(g, M(0x5a3a1c), x, 1.2, z, 3.2, 0.15); for (let k = 0; k < 4; k++) cyl(g, M(0x6a4422), x + Math.cos(k * PI / 2 + 0.8) * 2.6, 0, z + Math.sin(k * PI / 2 + 0.8) * 2.6, 0.18, 4.2, 6);
    add(g, G.cone, M(0xc8a060), x, 5.0, z, 4.6, 1.8, 4.6); signMesh(g, 'TIKI BAR', '#ffcf4a', x, 4.0, z + (z < 0 ? 3.3 : -3.3), 3, 0.7, z < 0 ? 0 : PI, '', '#2a1a0a');
    circleCol(A, x, z, 3.2); A.interacts.push({ x, z: z + (z < 0 ? 4.4 : -4.4), r: 2.4, label: 'Tiki bar · order', act: () => ctx.drink('tiki bar') }); };
  tiki(-50, -40); tiki(50, -40);
  for (const bx of [-50, 50]) for (const [dx, m] of [[-1.6, 'talk'], [1.7, 'phone']]) npc(g, A, bx + dx, -35.3, PI + dx * 0.15, m);
  walker(g, A, [[-40, -30], [40, -30], [40, -24], [-40, -24]], 1.1); walker(g, A, [[40, -24], [-40, -24], [-40, -30], [40, -30]], 1.25);
  // 2 hot tubs
  const tub = (x, z) => { cyl(g, coping, x, 0, z, 3.8, 0.6); const w = plane(g, waterM, x, 0.62, z, 6.6, 6.6); A.water.push({ circle: [x, z, 3.5], depth: 0.6, seat: true });
    const bub = new THREE.InstancedMesh(G.sph, B(0xffffff, { transparent: true, opacity: 0.6 }), 24); const mm = new THREE.Matrix4(); g.add(bub);
    A.anim.push(t => { for (let k = 0; k < 24; k++) { const a = k * 2.6 + t * 0.6, r = (k % 6) * 0.55; mm.makeScale(0.12, 0.12, 0.12); mm.setPosition(x + Math.cos(a) * r, 0.65 + Math.abs(Math.sin(t * 5 + k)) * 0.12, z + Math.sin(a) * r); bub.setMatrixAt(k, mm); } bub.instanceMatrix.needsUpdate = true; });
    const l = glow(0x66ccff, 0x2288ff, 0, 1.6); add(g, G.torus, l, x, 0.6, z, 3.8, 3.8, 3).rotation.x = PI / 2; };
  tub(-44, 18); tub(-44, 30); signMesh(g, 'HOT TUBS', '#ffcf4a', -52, 3, 24, 3, 0.8, PI / 2, '', '#0e0d0c');
  // conversation pool (sunken ring seating with fire bowl)
  cyl(g, coping, 46, 0, 26, 7, 0.3); plane(g, waterM, 46, 0.32, 26, 13, 13); A.water.push({ circle: [46, 26, 6.6], depth: 0.8, seat: true });
  const ringSeat = add(g, new THREE.TorusGeometry(4.6, 0.5, 6, 30), M(0xf4efe6), 46, 0.3, 26); ringSeat.rotation.x = PI / 2;
  cyl(g, M(0x222222), 46, 0, 26, 1.4, 1.1); const fire = add(g, G.cone, glow(0xff8a00, 0xff6a00, 1.2, 2), 46, 1.5, 26, 0.9, 1.2, 0.9); A.anim.push(t => fire.scale.y = 1 + Math.sin(t * 9) * 0.25); circleCol(A, 46, 26, 1.5);
  signMesh(g, 'CONVERSATION POOL', '#ffcf4a', 46, 3, 34.6, 5, 0.8, PI, '', '#0e0d0c');
  // loungers + umbrellas, palms
  for (let k = 0; k < 10; k++) { if (k === 4 || k === 5) continue; const x = -42 + k * 9; box(g, M(0xffffff), x, 0, -45, 1.2, 0.45, 2.6); box(g, new THREE.MeshStandardMaterial({ map: rep(T.tiger, 1, 1) }), x, 0.45, -44.6, 1.1, 0.08, 1.6); A.aabbs.push([x - 0.7, x + 0.7, -46.4, -43.6]);
    if (k % 2) { cyl(g, M(0x333333), x + 4.5, 0, -45, 0.08, 3.4); add(g, G.cone, M(0x0e0d0c), x + 4.5, 3.6, -45, 2.4, 0.8, 2.4); } }
  for (let k = 0; k < 10; k++) pl.push([-56 + (k % 2) * 112, -44 + Math.floor(k / 2) * 21, 8]); pl.push([-20, 40, 9], [20, 40, 9], [-32, 44, 8], [32, 44, 8]); palms(g, pl);
  // guests
  for (let k = 0; k < 4; k++) { const c = npc(g, A, -20 + k * 9, 6 + (k % 2) * 8, R() * 6); c.position.y = -1.0; }
  npc(g, A, -44, 17, 0, 'sit').position.y = -0.2; npc(g, A, 45, 21, 0.2, 'sit').position.y = -0.2; npc(g, A, 50, 28, -2, 'sit').position.y = -0.2; npc(g, A, -50, -36.5, 0.2); npc(g, A, 50, -36.4, -0.3);
  signMesh(g, 'TILEO KINGDOM POOL DECK · ADULTS ONLY', '#ffcf4a', 0, 4.6, -49.4, 18, 1.4, 0, '', '#0e0d0c');
  // elevator kiosk (south edge, facing pool = -z... we put it at z=-49 facing +z)
  box(g, M(0x0e0d0c), 0, 0, -50, 8, 7, 2.5);
  elevator(A, g, 0, -48.7, 0, 'ELEVATOR'); A.aabbs.push([-4.2, 4.2, -51, -48.6]);
  A.interacts.push({ x: 0, z: -45.5, r: 3.5, label: 'Call elevator', act: () => ctx.openElevator() });
  A.spawnElev = { x: 0, z: -44, yaw: PI };
}

// =========================== ROOM FLOOR + HOTEL ROOM ===========================
export function buildRooms(A, ctx) {
  const g = A.group, gm = gold(); const z0 = -42, z1 = 8;
  plane(g, new THREE.MeshStandardMaterial({ map: rep(T.tiger, 2, 12) }), 0, 0, (z0 + z1) / 2, 8, z1 - z0);
  plane(g, M(0x140e08, { side: THREE.DoubleSide }), 0, 5, (z0 + z1) / 2, 8, z1 - z0, PI / 2);
  const hw = M(0x2a1d14); walls(g, A, -4, 4, z0, z1, 5, hw, { n: 1 }); trim(g, -4, 4, z0, z1, 4.6, gm); trim(g, -4, 4, z0, z1, 0.0, gm);
  A.skyline = skylineWindow(g, A, { x0: -2.6, x1: 2.6, y0: 0.9, y1: 3.2, wz: z0, h: 5, wallMat: hw, wx0: -4, wx1: 4, cz: z0 + 24, r: 30, arc: 1.2, yMid: -1.9, mullions: 1 });
  A.doors = [];
  for (let i = 0; i < 10; i++) { const side = i % 2 ? 1 : -1, z = -2 - Math.floor(i / 2) * 8, num = 2401 + i;
    box(g, M(0x0e0d0c), side * 3.95, 0, z, 0.15, 3.4, 1.8); box(g, gm, side * 3.88, 0, z, 0.1, 3.5, 0.12);
    signMesh(g, String(num), '#ffcf4a', side * 3.85, 3.8, z, 1.1, 0.4, side < 0 ? PI / 2 : -PI / 2, '', '#0e0d0c');
    const lock = add(g, G.box, neon(0xff2222), side * 3.85, 1.4, z + 0.6, 0.05, 0.2, 0.1); A.doors.push({ num, side, z, lock });
    A.interacts.push({ x: side * 2.6, z, r: 1.6, label: () => ctx.save.room === num ? `Enter your room ${num}` : `Room ${num}`, act: () => ctx.roomDoor(num, side, z) });
    if (i % 2 === 0) { const l = new THREE.PointLight(0xffc880, 6, 12, 1.5); l.position.set(0, 4.4, z); g.add(l); } }
  A.anim.push(() => A.doors.forEach(d => d.lock.material.color.set(ctx.save.room === d.num ? 0x22ff66 : 0xff2222)));
  signMesh(g, 'FLOOR 24 · SUITES 2401-2410', '#ffcf4a', 0, 3.75, z0 + 0.12, 5, 0.6, 0, '', '#0e0d0c');
  elevator(A, g, 0, z1 + 0.3, PI, 'ELEVATOR'); A.interacts.push({ x: 0, z: 5, r: 2.8, label: 'Call elevator', act: () => ctx.openElevator() });
  A.spawnElev = { x: 0, z: 4.5, yaw: 0 };
}
export function buildRoom(A, ctx) {
  const g = A.group, gm = gold();
  plane(g, M(0x2a2018), 0, 0, 0, 16, 20); plane(g, new THREE.MeshStandardMaterial({ map: rep(T.tiger, 1, 1) }), 0, 0.02, 0, 6, 5);
  plane(g, M(0x140e08, { side: THREE.DoubleSide }), 0, 5, 0, 16, 20, PI / 2);
  const rw = M(0x1e1610); walls(g, A, -8, 8, -10, 10, 5, rw, { n: 1 }); trim(g, -8, 8, -10, 10, 4.6, gm);
  // floor-to-ceiling suite glass looking south down the Strip (real photo backdrop, swaps day / sunset / night)
  A.skyline = skylineWindow(g, A, { x0: -7, x1: 7, y0: 0.6, y1: 4.6, wz: -10, h: 5, wallMat: rw, wx0: -8, wx1: 8, cz: 8, r: 30, arc: 1.75, yMid: -3.2, mullions: 3 });
  // king bed with tiger throw, gold headboard
  box(g, M(0x0e0d0c), -3, 0, -4, 5, 0.6, 6); box(g, M(0xf4efe6), -3, 0.6, -4, 4.8, 0.4, 5.8); box(g, new THREE.MeshStandardMaterial({ map: rep(T.tiger, 2, 1) }), -3, 1.0, -2.4, 4.9, 0.06, 2.6);
  box(g, gm, -3, 0, -7.1, 5.4, 3.2, 0.3); for (const x of [-4.2, -1.8]) box(g, M(0xffffff), x, 1.0, -6.3, 1.8, 0.4, 0.8);
  for (const x of [-6.5, 0.5]) { box(g, M(0x0e0d0c), x, 0, -6.4, 1.2, 1, 1.2); cyl(g, gm, x, 1, -6.4, 0.08, 0.8); add(g, G.cone, glow(0xfff0c0, 0xffd080, 1, 1), x, 2.0, -6.4, 0.45, 0.5, 0.45); }
  A.aabbs.push([-5.6, -0.4, -7.4, -0.9], [-7.2, -5.8, -7.1, -5.7], [-0.2, 1.2, -7.1, -5.7]);
  A.interacts.push({ x: -3, z: 0, r: 1.8, label: 'Lie down (rest)', act: () => ctx.toast('You stretch out on the tiger-print throw. Rested.') });
  // sofa + minibar + wardrobe/mirror
  sofa(g, 5, -2, -PI / 2, 4); A.aabbs.push([4.2, 6.2, -4.2, 0.2]);
  box(g, M(0x0e0d0c), 6.6, 0, 5, 1.4, 1.2, 3); box(g, gm, 6.6, 1.2, 5, 1.5, 0.08, 3.1); for (let k = 0; k < 4; k++) cyl(g, glow([0xffd23a, 0xff3355, 0x66ccff, 0xb46cff][k], [0xffd23a, 0xff3355, 0x66ccff, 0xb46cff][k], 0.6, 1), 6.6, 1.28, 4 + k * 0.6, 0.1, 0.4); A.aabbs.push([5.8, 8, 3.4, 6.6]);
  A.interacts.push({ x: 5, z: 5, r: 1.8, label: 'Minibar', act: () => ctx.drink('minibar') });
  box(g, M(0x0e0d0c), -7.4, 0, 4, 1.2, 4, 3.6); plane(g, new THREE.MeshBasicMaterial({ color: 0xb8c8d8 }), -6.78, 2.1, 4, 1.4, 3.2, 0, PI / 2); box(g, gm, -6.78, 0.4, 4, 0.05, 3.5, 1.6); A.aabbs.push([-8, -6.7, 2.1, 5.9]);
  A.interacts.push({ x: -5.4, z: 4, r: 1.8, label: 'Wardrobe · change outfit', act: () => ctx.openWardrobe() });
  A.plaque = signMesh(g, 'SUITE', '#ffcf4a', 0, 3.4, 9.45, 2, 0.6, PI, '', '#0e0d0c');
  box(g, M(0x0e0d0c), 0, 0, 9.6, 2.2, 3.6, 0.2); box(g, gm, 0, 3.6, 9.6, 2.4, 0.15, 0.3);
  A.interacts.push({ x: 0, z: 8.6, r: 1.8, label: 'Leave room', act: () => ctx.leaveRoom() });
  const l = new THREE.PointLight(0xffd8a0, 20, 20, 1.4); l.position.set(0, 4.5, 0); g.add(l);
}

// =========================== MEGA CLUB ===========================
export function buildClub(A, ctx) {
  const g = A.group, gm = gold();
  plane(g, new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 0.08, metalness: 0.4 }), 0, 0, 0, 60, 60); plane(g, M(0x050507, { side: THREE.DoubleSide }), 0, 14, 0, 60, 60, PI / 2);
  walls(g, A, -30, 30, -30, 30, 14, M(0x0c0a10)); trim(g, -30, 30, -30, 30, 0.2, neon(0xff7a1a)); trim(g, -30, 30, -30, 30, 6, neon(0xb46cff));
  // dance floor (instanced tiles, colour-cycling)
  const nx = 8, nz = 7, tile = 3;
  // LED floor: glossy smoked-glass tiles lit from below (emissive per tile, brighter in the middle, dark frame), reflecting the lasers
  const ledM = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.2, metalness: 0.3, envMapIntensity: 0.08 });
  ledM.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vTkUv;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTkUv = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vTkUv;')
      .replace('#include <color_fragment>', 'vec3 tkLed = vec3( 1.0 );\n#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\n  tkLed = vColor.rgb;\n#endif')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  { vec2 q = abs( vTkUv - 0.5 ); float e = max( q.x, q.y ); float k = smoothstep( 0.5, 0.4, e ) * ( 0.75 + 0.5 * smoothstep( 0.45, 0.0, e ) );
    vec2 px = fract( vTkUv * 10.0 ) - 0.5; float tkDot = 0.85 + 0.15 * smoothstep( 0.35, 0.1, length( px ) );
    totalEmissiveRadiance += tkLed * k * tkDot * 0.62; }`); };
  ledM.customProgramCacheKey = () => 'tkLed';
  const tg = new THREE.InstancedMesh(G.box, ledM, nx * nz); tg.receiveShadow = true; const mm = new THREE.Matrix4(); const c = new THREE.Color();
  let k = 0; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { mm.makeScale(tile * 0.95, 0.1, tile * 0.95); mm.setPosition(-12 + tile / 2 + i * tile, 0.05, -18 + tile / 2 + j * tile); tg.setMatrixAt(k, mm); tg.setColorAt(k++, c.set(0xffffff)); } g.add(tg);
  const pal = [0xff7a1a, 0xffd23a, 0xb46cff, 0xff2d8f, 0x22ccff];
  A.anim.push(t => { let k = 0; const beat = Math.floor(t * 2.2); for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const v = (i + j + beat) % 5, on = ((i * 3 + j * 5 + beat) % 4) !== 0; tg.setColorAt(k++, c.set(pal[v]).multiplyScalar(on ? 1 : 0.15)); } tg.instanceColor.needsUpdate = true; });
  A.danceRect = [-12, 12, -18, 3];
  // DJ booth (raised, north) + LED wall
  box(g, M(0x111111), 0, 0, -25, 20, 1.6, 8); box(g, gm, 0, 1.6, -25, 20.2, 0.15, 8.2); box(g, M(0x0e0d0c), 0, 1.6, -22.2, 8, 1.3, 1.6); box(g, new THREE.MeshStandardMaterial({ map: rep(T.tiger, 3, 1), emissive: 0xff8a00, emissiveMap: rep(T.tiger, 3, 1), emissiveIntensity: 0.6 }), 0, 1.7, -21.38, 8, 1.1, 0.05);
  for (const x of [-2, 2]) { const d = cyl(g, M(0x222222), x, 2.9, -22.4, 0.7, 0.08); A.anim.push(t => d.rotation.y = t * 4); }
  A.aabbs.push([-10, 10, -29, -21]);
  const led = new THREE.MeshBasicMaterial({ color: 0xff7a1a }); const ledWall = plane(g, led, 0, 7.5, -29.4, 26, 10, 0, 0); const lc = new THREE.Color();
  A.anim.push(t => led.color.copy(lc.setHSL((t * 0.05) % 1, 0.9, 0.35 + Math.abs(Math.sin(t * 4.4)) * 0.2)));
  // DJ Tileo logo: LED wall centerpiece, booth front, side-wall banners
  logoPlane(g, 'dj', 0, 7.6, -29.3, 9.4, 0, { back: 0x070504, pad: 0.06 });
  logoPlane(g, 'dj', 0, 2.25, -21.32, 1.2, 0); for (const bx of [-6.5, 6.5]) logoPlane(g, 'dj', bx, 0.8, -20.93, 1.35, 0, { back: 0x0b0906, pad: 0.1 });
  for (const sx of [-1, 1]) for (const bz of [-20, 12]) logoPlane(g, 'dj', sx * 29.45, 8.6, bz, 6.4, -sx * PI / 2, { back: 0x0b0906, pad: 0.1 });
  // DJ Tileo: original lion-headed mascot DJ (not a likeness of a real person)
  const dj = makeDJ(); dj.position.set(0, 1.6, -23.6); g.add(dj);
  A.anim.push(t => animate(dj, t, 0, 'dj'));
  A.interacts.push({ x: 0, z: -19.6, r: 2.2, label: 'Request a track from DJ Tileo', act: () => ctx.requestTrack() });
  // lasers + moving lights
  const laserM = new THREE.MeshBasicMaterial({ color: 0x33ff88, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
  const lasers = []; for (let i = 0; i < 6; i++) { const lg = new THREE.Group(); lg.position.set(-10 + i * 4, 13.5, -27); g.add(lg); const b = add(lg, G.box, i % 2 ? laserM : new THREE.MeshBasicMaterial({ color: 0xff2d8f, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0, 20, 0.06, 0.06, 40); lasers.push(lg); }
  A.anim.push(t => lasers.forEach((l, i) => { l.rotation.x = 0.35 + Math.sin(t * 1.3 + i) * 0.25; l.rotation.y = Math.sin(t * 0.9 + i * 1.7) * 0.6; }));
  const spots = [0xff7a1a, 0xb46cff, 0x22ccff].map((col, i) => { const l = new THREE.PointLight(col, 40, 30, 1.2); l.position.set(-10 + i * 10, 10, -8); g.add(l); return l; });
  // volumetric-looking haze cones under each moving head (additive, cheap)
  const coneG = new THREE.ConeGeometry(4.5, 11, 24, 1, true); coneG.translate(0, -5.5, 0);
  const cones = spots.map((l, i) => { const m = new THREE.MeshBasicMaterial({ color: new THREE.Color([0xff7a1a, 0xb46cff, 0x22ccff][i]).multiplyScalar(0.08), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); const c = new THREE.Mesh(coneG, m); c.position.set(0, 13.6, -8); g.add(c); return c; });
  A.anim.push(t => spots.forEach((l, i) => { l.position.x = Math.sin(t * 0.8 + i * 2) * 12; l.intensity = 14 + Math.abs(Math.sin(t * 4.4 + i)) * 18; cones[i].position.x = l.position.x * 0.9; cones[i].rotation.z = -Math.sin(t * 0.8 + i * 2) * 0.35; cones[i].material.opacity = 1; }));
  // bottle-service VIP booths along walls + bar
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const z = -14 + k * 10; const bx = s * 26; const booth = new THREE.Group(); booth.position.set(bx, 0, z); booth.rotation.y = -s * PI / 2; g.add(booth);
    box(booth, M(0x4a0a12), 0, 0, -1.2, 6, 0.5, 1.6); box(booth, M(0x4a0a12), 0, 0, -2, 6, 1.8, 0.4); box(booth, gm, 0, 1.8, -2, 6.1, 0.1, 0.42);
    cyl(booth, M(0x0e0d0c), 0, 0, 0.8, 1.2, 0.8); for (let b = 0; b < 3; b++) cyl(booth, glow(0xffd23a, 0xffb000, 1, 1.4), -0.4 + b * 0.4, 0.8, 0.8, 0.08, 0.5);
    A.aabbs.push(s > 0 ? [23.8, 30, z - 3.1, z + 3.1] : [-30, -23.8, z - 3.1, z + 3.1]);
    signMesh(g, 'VIP', '#ffcf4a', s * 29.4, 4, z, 2, 0.8, s < 0 ? PI / 2 : -PI / 2, '', '#0e0d0c');
    A.interacts.push({ x: bx - s * 3.2, z, r: 2, label: 'Book VIP bottle-service booth (300)', act: () => ctx.vipBooth() });
    npc(g, A, bx + s * 1.0, z + 1.5, -s * PI / 2, 'sit'); }
  box(g, M(0x0e0d0c), 0, 0, 22, 18, 1.3, 2); box(g, gm, 0, 1.3, 22, 18.2, 0.12, 2.2); signMesh(g, 'TIGER BAR', '#ffcf4a', 0, 4.5, 23.4, 6, 1.2, PI, '', '#0e0d0c'); A.aabbs.push([-9, 9, 21, 23.6]);
  for (let k = 0; k < 6; k++) cyl(g, glow([0xffd23a, 0xff3355, 0x66ccff][k % 3], [0xffd23a, 0xff3355, 0x66ccff][k % 3], 1, 1.4), -6 + k * 2.4, 1.42, 22, 0.1, 0.45);
  A.interacts.push({ x: 0, z: 19.6, r: 2.5, label: 'Tiger Bar · order', act: () => ctx.drink('Tiger Bar') });
  // dancing crowd
  for (let k = 0; k < 14; k++) npc(g, A, -10 + R() * 20, -16 + R() * 17, R() * 6, 'dance');
  elevator(A, g, 12, 29.4, PI, 'ELEVATOR'); A.interacts.push({ x: 12, z: 26, r: 3, label: 'Call elevator', act: () => ctx.openElevator() });
  A.spawnElev = { x: 12, z: 25.5, yaw: 0 };
  const amb = new THREE.PointLight(0xffffff, 8, 60, 1); amb.position.set(0, 12, 10); g.add(amb);
}
