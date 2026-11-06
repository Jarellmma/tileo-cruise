// The Strip: road, sidewalks, parody lookalike landmarks (procedural PBR architecture), Tileo Kingdom tower
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { G, M, B, add, box, cyl, plane, T, rep, glow, neon, onNight, signMesh, rng, PI, logoPlane, goldM, chromeM, canvas, tex, logoMaterial, logoReady, LOGOS , pbr } from './core.js?v=1793987979';
import { makeLion, makeCharacter, randomLook, animate } from './characters.js?v=1793987979';
import { STY, facade, roofMat, rect, circle, arcBand, stadium, inset, Batch, streetTex, palms as palmKit, carKitGeo } from './city.js?v=1793987979';
import { carParts, carMats } from './cars.js?v=1793987979';
import { buildGrounds } from './landscape.js?v=1793987979';
import { Q } from './quality.js?v=1793987979';

export function facadeMat(color, w, h, d, lit = 0xffd98f, nightI = 1) {
  const mk = (rx) => { const m = new THREE.MeshStandardMaterial({ color, map: rep(T.facade, rx / 6, h / 5), emissive: lit, emissiveMap: rep(T.facadeE, rx / 6, h / 5), emissiveIntensity: nightI, roughness: 0.55, metalness: 0.2 });
    m.map.colorSpace = THREE.SRGBColorSpace; onNight(n => { m.emissiveIntensity = n ? nightI : 0.0; }); return m; };
  const mx = mk(d), mz = mk(w), top = M(new THREE.Color(color).multiplyScalar(0.6).getHex());
  return [mx, mx, top, top, mz, mz];
}
export function palms(parent, list) { return palmKit(parent, list); }

// ---------- shared helpers ----------
const STD = o => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, ...o });
const UP = new THREE.Vector3(0, 1, 0), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
function bar(b, mat, ax, ay, az, bx, by, bz, r = 0.3, seg = 6, r2 = r) {
  _a.set(ax, ay, az); _b.set(bx, by, bz); const L = _a.distanceTo(_b); const g = new THREE.CylinderGeometry(r2, r, L, seg, 1);
  _q.setFromUnitVectors(UP, _b.clone().sub(_a).normalize()); _m.compose(_a.clone().add(_b).multiplyScalar(0.5), _q, _s.set(1, 1, 1)); g.applyMatrix4(_m); b.add(mat, g); }
function sphere(b, mat, x, y, z, rx, ry = rx, rz = rx, seg = 12) { b.geo(mat, new THREE.SphereGeometry(1, seg, Math.max(6, seg / 2 | 0)), x, y, z, rx, ry, rz); }
// hip / pyramid roof on a rectangle (4-sided cone)
function hipRoof(b, mat, x, y, z, w, d, h, ry = 0) { const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1); g.rotateY(PI / 4); b.geo(mat, g, x, y + h / 2, z, w, h, d, ry); }
// triangular pediment facing +x (yz-plane triangle extruded along x)
function pediment(b, mat, x, y, z, depth, width, h, ry = 0) { const s = new THREE.Shape([new THREE.Vector2(-width / 2, 0), new THREE.Vector2(width / 2, 0), new THREE.Vector2(0, h)]);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); g.rotateY(PI / 2 + ry); g.translate(x, y, z); b.add(mat, g); }
function fluted(r, h, flutes = 16) { const g = new THREE.CylinderGeometry(r, r * 1.06, h, flutes * 2, 1); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 - 0.06 * Math.max(0, Math.cos(a * flutes)); if (Math.hypot(x, z) > 0.01) { p.setX(i, x * k); p.setZ(i, z * k); } }
  g.computeVertexNormals(); return g; }
function beamMesh(len, rTop, rBot, color) { const S = streetTex(); const g = new THREE.CylinderGeometry(rTop, rBot, len, 16, 1, true); g.translate(0, len / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, map: S.beam, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); m.frustumCulled = false; return m; }

// reflective water: Water.js planar reflections on High, PBR env-reflective water elsewhere (switchable at runtime)
const waters = [];
export function makeWater(parent, w, d, x, y, z, opts = {}) {
  const col = opts.color ?? 0x0d4a5e, geo = opts.geometry || new THREE.PlaneGeometry(w, d);
  const nm = T.waterN.clone(); nm.repeat.set((opts.w || w) / 14, (opts.d || d) / 14); nm.needsUpdate = true;
  const lo = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.04, metalness: 0.15, normalMap: nm, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 1.5, emissive: opts.glow ?? 0x041c2a, emissiveIntensity: 0 }));
  lo.rotation.x = -PI / 2; lo.position.set(x, y, z); lo.receiveShadow = true; parent.add(lo);
  onNight(n => lo.material.emissiveIntensity = n ? 1 : 0.15);
  const W = { lo, hi: null, x, z, r: Math.max(w, d) / 2, opts, geo, parent, y, col };
  waters.push(W); return W;
}
function ensureHi(W) { if (W.hi) return W.hi;
  const hi = new Water(W.geo, { textureWidth: 512, textureHeight: 512, waterNormals: T.waterN, sunDirection: new THREE.Vector3(-0.4, 0.7, 0.5).normalize(), sunColor: 0xfff0dd, waterColor: W.col, distortionScale: W.opts.distortion ?? 2.4, fog: true, alpha: 1 });
  hi.material.uniforms.size.value = W.opts.size ?? 3; hi.rotation.x = -PI / 2; hi.position.set(W.x, W.y, W.z); hi.visible = false; W.parent.add(hi); W.hi = hi; return hi; }
// called every frame from main: only the nearest visible water body renders a mirror (and only on High)
export function updateWaters(t, camera, sunDir, sunCol) {
  let best = null, bd = 1e9;
  for (const W of waters) { if (!W.parent.visible && !isShown(W.parent)) { if (W.hi) W.hi.visible = false; W.lo.visible = true; continue; }
    W.lo.material.normalMap.offset.set(t * 0.012, t * 0.018);
    const d = Math.hypot(camera.position.x - W.x, camera.position.z - W.z) - W.r; if (Q.tier.water && d < 260 && d < bd) { bd = d; best = W; } }
  for (const W of waters) { const on = W === best; if (on) { const h = ensureHi(W); h.material.uniforms.time.value = t * 0.6; h.material.uniforms.sunDirection.value.copy(sunDir); h.material.uniforms.sunColor.value.copy(sunCol); }
    if (W.hi) W.hi.visible = on; W.lo.visible = !on; }
}
function isShown(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }

// animated LED screen (canvas texture) showing the DJ Tileo logo
function ledScreen(g, A, x, y, z, w, h, ry, title = 'DJ TILEO LIVE', sub = 'MEGA CLUB · TONIGHT') {
  const [c, x2] = canvas(384, 256); const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4;
  const m = neon(0xffffff, { map: t }, 0.95, 1.25); const p = plane(g, m, x, y, z, w, h, 0, ry);
  const logo = logoMaterial('dj').map; let acc = 0, ph = 0;
  const draw = time => { const hue = (time * 25) % 360; const gr = x2.createLinearGradient(0, 0, 384, 256); gr.addColorStop(0, `hsl(${hue},85%,22%)`); gr.addColorStop(1, `hsl(${(hue + 80) % 360},85%,10%)`);
    x2.fillStyle = gr; x2.fillRect(0, 0, 384, 256);
    for (let i = 0; i < 9; i++) { x2.fillStyle = `hsla(${(hue + i * 40) % 360},100%,60%,0.18)`; const r = 40 + ((time * 60 + i * 50) % 260); x2.beginPath(); x2.arc(192, 120, r, 0, 7); x2.lineWidth = 6; x2.strokeStyle = x2.fillStyle; x2.stroke(); }
    const img = logo.image; if (img && img.width) { const a = img.width / img.height, hh = 160, ww = hh * a; x2.drawImage(img, 192 - ww / 2, 12, ww, hh); }
    x2.textAlign = 'center'; x2.fillStyle = '#fff3c4'; x2.font = '900 30px Georgia, serif'; x2.shadowColor = '#ffcf4a'; x2.shadowBlur = 12; x2.fillText(title, 192, 206);
    x2.font = '700 18px sans-serif'; x2.shadowBlur = 4; x2.fillStyle = `hsl(${(hue + 180) % 360},100%,70%)`; x2.fillText(sub, 192, 236); x2.shadowBlur = 0;
    for (let yy = 0; yy < 256; yy += 3) { x2.fillStyle = 'rgba(0,0,0,0.18)'; x2.fillRect(0, yy, 384, 1); } t.needsUpdate = true; };
  draw(0); logoReady.dj?.then(() => draw(0));
  A.anim.push((time, dt, pp) => { acc += dt; if (acc < 0.12) return; acc = 0; if (pp && Math.hypot(pp.x - x, pp.z - z) > 320) return; draw(time); });
  return p;
}

export function buildStrip(A) {
  const g = A.group, R = rng(42), col = A.aabbs, S = streetTex();
  const solid = (x0, x1, z0, z1) => col.push([Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1)]);
  A.landmarks = [];
  const landmark = (name, x, z) => A.landmarks.push({ name, x, z });
  const roof = roofMat();
  const T0 = (b, k, pts, y0, y1, o = {}) => { const St = STY[k], fl = St.th / St.rows; const uo = Math.floor(R() * St.cols) * St.tw / St.cols; T0.uo = o.uo ?? uo; return b.prism(facade(k), o.roof === undefined ? roof : o.roof, pts, y0, y1, { uo, vo: Math.floor(R() * St.rows) * fl, ...o }); };
  // ---- v6 architecture kit (own random stream so the Strip layout stays the same) ----
  const R2 = rng(4242), CURTAIN = { glassBlue: 1, darkGlass: 1, goldGlass: 1, emerald: 1, blackGold: 1 };
  const outward = pts => { let cx = 0, cz = 0; pts.forEach(p => { cx += p[0]; cz += p[1]; }); cx /= pts.length; cz /= pts.length; let A = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; A += a[0] * b[1] - b[0] * a[1]; } return A > 0 ? -1 : 1; };
  const offsetPoly = (pts, d) => { const n = pts.length, sg = outward(pts), nrm = []; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], l = Math.hypot(ex, ez) || 1; nrm.push([sg * ez / l, -sg * ex / l]); }
    return pts.map((p, i) => { const n1 = nrm[(i + n - 1) % n], n2 = nrm[i]; let mx = n1[0] + n2[0], mz = n1[1] + n2[1]; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml; const k = Math.min(3, 1 / Math.max(0.3, mx * n2[0] + mz * n2[1])); return [p[0] + mx * d * k, p[1] + mz * d * k]; }); };
  const finMat = {}, fin = k => finMat[k] || (finMat[k] = M(STY[k].frame || '#8a9098', { roughness: 0.3, metalness: 0.85 }));
  // vertical fins on glass towers at every window bay (real depth and shadow lines on the curtain wall)
  const fins = (b, k, pts, y0, y1, uo) => { const St = STY[k], bay = St.tw / St.cols, n = pts.length, sg = outward(pts); let cum = 0;
    for (let i = 0; i < n; i++) { const a = pts[i], c = pts[(i + 1) % n], ex = c[0] - a[0], ez = c[1] - a[1], L = Math.hypot(ex, ez); if (L < 0.5) { cum += L; continue; }
      const ux = ex / L, uz = ez / L, nx = sg * uz, nz = -sg * ux, ry = Math.atan2(-ez, ex);
      let t = (bay - ((cum + uo) % bay)) % bay; for (; t <= L + 1e-3; t += bay) b.box(fin(k), a[0] + ux * t + nx * 0.2, y0, a[1] + uz * t + nz * 0.2, 0.12, y1 - y0, 0.4, ry);
      cum += L; } };
  const slabM = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.8, side: THREE.DoubleSide }), railM = M(0x9aa0a6, { roughness: 0.3, metalness: 0.8 });
  const balGlass = new THREE.MeshStandardMaterial({ color: 0x9fb6c4, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
  // continuous balconies (slab + glass balustrade + top rail) on every floor of hotel towers
  const balconies = (b, pts, y0, y1, fh) => { const o1 = offsetPoly(pts, 1.35), o2 = offsetPoly(pts, 1.3);
    for (let y = y0 + fh; y < y1 - 1.5; y += fh) { b.prism(slabM, slabM, o1, y - 0.12, y + 0.1); b.prism(balGlass, null, o2, y + 0.1, y + 1.08, { cap: false }); b.prism(railM, null, o2, y + 1.08, y + 1.13, { cap: false }); } };
  const parapetM = M(0xcfc9be, { roughness: 0.85 }), mechM = M(0x7c7f84, { roughness: 0.7, metalness: 0.2 });
  // crown: parapet, mechanical penthouse with screen, the odd antenna
  const crown = (b, pts, y) => { b.prism(parapetM, parapetM, offsetPoly(pts, 0.06), y, y + 1.2, { cap: false }); const mh = 3.5 + R2() * 4, ip = inset(pts, 0.5);
    b.prism(mechM, roof, ip, y, y + mh); b.prism(railM, null, offsetPoly(ip, 0.25), y + mh - 1.6, y + mh + 0.4, { cap: false }); if (R2() < 0.4) b.box(railM, ip[0][0] * 0.5 + ip[2 % ip.length][0] * 0.5, y + mh, ip[0][1] * 0.5 + ip[2 % ip.length][1] * 0.5, 0.25, 6 + R2() * 8, 0.25); return y + mh; };
  const TOWER_NAMES = ['THE MERIDIAN', 'PALM ROYALE', 'DESERT ROSE', 'GOLDEN MILE', 'NOVA', 'THE SAPPHIRE', 'CASA ARENA', 'STARLIGHT', 'THE ORCHID', 'SILVER CROWN', 'MONARCH', 'LA PERLA'];
  let towerNames = 0; const plazaPalms = [];
  const canopyM = M(0x24252a, { roughness: 0.45, metalness: 0.6 }), downlight = neon(0xffe3b8, {}, 0.25, 1.05);
  const plazaM = pbr('travertine', 4 / 2.4, 4 / 2.4, { color: 0xb3aca2, macro: [0.05, 0.15] }), planterM = pbr('gravel', 0.5, 0.5, { color: 0x9a8a78 });
  const band = (b, mat, pts, y, h, k = 1.006) => b.prism(mat, null, inset(pts, k), y, y + h, { cap: false });
  const cap = (b, mat, pts, y, h, k = 1.02) => b.prism(mat, mat, inset(pts, k), y, y + h);
  const stone = M(0xe6dac2, { roughness: 0.65 }), marble = M(0xf3f0e8, { roughness: 0.3 }), black = M(0x0e0d0c, { roughness: 0.35, metalness: 0.4 }), terra = M(0xb05a34, { roughness: 0.75 });
  const gold = goldM(0.35), gray = M(0x8a8a88, { roughness: 0.8 }), white = M(0xf4f4f0, { roughness: 0.5 });
  const aviation = neon(0xff2010, {}, 0.6, 2.2);
  const roofKit = (b, pts, y, n = 2) => { let cx = 0, cz = 0; pts.forEach(p => { cx += p[0]; cz += p[1]; }); cx /= pts.length; cz /= pts.length;
    for (let i = 0; i < n; i++) b.box(gray, cx + (R() - 0.5) * 8, y, cz + (R() - 0.5) * 8, 3 + R() * 5, 1.5 + R() * 2.5, 3 + R() * 5);
    if (y > 70) sphere(b, aviation, cx, y + 4.4, cz, 0.45, 0.45, 0.45, 6), b.box(gray, cx, y, cz, 0.3, 4, 0.3); };

  // ===================== ground, road, sidewalks, median, cross streets =====================
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), pbr('gravel', 9000 / 4, 9000 / 4, { macro: [0.018, 0.42], color: 0xf2ece4 })); // desert rock landscaping // big enough that its edge never shows from the Sky Needle deck
  ground.rotation.x = -PI / 2; ground.position.y = -0.2; ground.receiveShadow = true; g.add(ground); // y -0.2 avoids z-fighting with the road
  S.road.repeat.set(1, 1300 / 14); const roadM = pbr('asphalt', 28 / 4, 1300 / 4, { detail: S.road, macro: [0.04, 0.22], normalScale: 0.9 }); const road = plane(g, roadM, 0, 0.03, 0, 28, 1300); road.receiveShadow = true;
  const CROSS = [-470, -200, -5, 310];
  const sb = new Batch(); const paver = pbr('sidewalk', 1, 1, { macro: [0.03, 0.18], color: 0xc4c0bb }), curb = pbr('concrete', 0.25, 0.25, { color: 0xe8e4dc });
  const segs = []; { let z0 = -650; for (const c of CROSS) { segs.push([z0, c - 10]); z0 = c + 10; } segs.push([z0, 650]); }
  for (const [z0, z1] of segs) for (const sx of [-1, 1]) sb.prism(curb, paver, rect(sx * 18, (z0 + z1) / 2, 8, z1 - z0), 0, 0.15);
  // median planter with shrubs
  sb.prism(curb, pbr('gravel', 1, 1, { color: 0xb8a690, macro: [0.05, 0.3] }), rect(0, 0, 2.4, 1196), 0, 0.35); // ends at |z| 598 so the limo can U-turn at the Strip ends
  const shrub = M(0x3c6a2c, { roughness: 0.9 }); for (let z = -594; z < 594; z += 5.5) { if (CROSS.some(c => Math.abs(z - c) < 11)) continue; sphere(sb, shrub, (R() - 0.5) * 0.6, 0.55, z, 0.9 + R() * 0.3, 0.55 + R() * 0.2, 1.4, 6); }
  const side = pbr('asphalt', 242 / 4, 20 / 4, { color: 0x8a8a8c, macro: [0.04, 0.2] }), yel = M(0xe8c547, { roughness: 0.6 });
  const crossM = new THREE.MeshStandardMaterial({ map: S.cross, transparent: true, alphaTest: 0.5, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  S.cross.repeat.set(28 / 4.6, 1); S.cross.wrapT = THREE.ClampToEdgeWrapping;
  const sig = M(0x1a1a1c, { roughness: 0.5, metalness: 0.6 }), sigR = new THREE.MeshBasicMaterial({ color: 0x220806 }), sigA = new THREE.MeshBasicMaterial({ color: 0x221806 }), sigG = new THREE.MeshBasicMaterial({ color: 0x062210 }), pedWalk = new THREE.MeshBasicMaterial({ color: 0x111111 }), pedStop = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const c of CROSS) {
    for (const sx of [-1, 1]) { const p = plane(g, side, sx * 135, 0.035, c, 242, 20); p.receiveShadow = true; plane(g, yel, sx * 135, 0.045, c, 242, 0.3); }
    for (const dz of [-12.8, 12.8]) { const p = plane(g, crossM, 0, 0.045, c + dz, 28, 4); p.receiveShadow = true; }
    for (const sx of [-1, 1]) for (const dz of [-1, 1]) { const x = sx * 15.6, z = c + dz * 11.2; // signal pole with mast arm over the road
      sb.cyl(sig, x, 0, z, 0.22, 8.2, 8); bar(sb, sig, x, 7.8, z, x - sx * 9, 7.8, z, 0.12, 6);
      for (const k of [3.5, 7.5]) { sb.box(sig, x - sx * k, 6.55, z, 0.5, 1.5, 0.5); [sigR, sigA, sigG].forEach((m, i) => sphere(sb, m, x - sx * k, 7.7 - i * 0.46, z - dz * 0.27, 0.16, 0.16, 0.06, 8)); }
      // pedestrian signal facing across the Strip
      sb.box(sig, x - sx * 0.35, 2.6, z, 0.45, 0.7, 0.35); sb.box(pedStop, x - sx * 0.58, 2.97, z, 0.03, 0.26, 0.24); sb.box(pedWalk, x - sx * 0.58, 2.67, z, 0.03, 0.26, 0.24);
      solid(x - 0.4, x + 0.4, z - 0.4, z + 0.4); } }
  // signal cycle (45 s): Strip green 0-24, amber 24-27, red 27-45; pedestrians walk 27.5-41, flashing hand 41-45
  const SIG = A.signal = { t: 0, strip: 'green', walk: false };
  const lampOn = (m, c, on) => m.color.set(c).multiplyScalar(on ? 2.4 : 0.07);
  A.anim.push((t, dt) => { const ph = (t + 6) % 45; SIG.t = ph; SIG.strip = ph < 24 ? 'green' : ph < 27 ? 'amber' : 'red'; SIG.walk = ph >= 27.5 && ph < 41;
    lampOn(sigG, 0x2aff7a, SIG.strip === 'green'); lampOn(sigA, 0xffb020, SIG.strip === 'amber'); lampOn(sigR, 0xff2a1a, SIG.strip === 'red');
    lampOn(pedWalk, 0xf4f8ff, SIG.walk); lampOn(pedStop, 0xff8a1a, !SIG.walk && !(ph >= 41 && Math.floor(ph * 2) % 2)); });
  sb.flush(g);

  // ===================== streetlights (instanced, emissive heads + additive light pools at night) =====================
  { const pole = new THREE.CylinderGeometry(0.13, 0.22, 11, 8); pole.translate(0, 5.5, 0);
    const arm = new THREE.BoxGeometry(3.2, 0.14, 0.14); arm.translate(-1.6, 10.8, 0); const hd = new THREE.BoxGeometry(1.1, 0.24, 0.5); hd.translate(-3.1, 10.7, 0);
    const lampG = mergeG([pole, arm, hd]); const bulbG = new THREE.BoxGeometry(0.9, 0.05, 0.38); bulbG.translate(-3.1, 10.56, 0);
    const pts = []; for (let z = -630; z <= 630; z += 36) { if (CROSS.some(c => Math.abs(z - c) < 12)) continue; pts.push([14.9, z, 0], [-14.9, z + 18, PI], [0.4, z + 9, PI], [-0.4, z + 9, 0]); }
    const n = pts.length, lamp = new THREE.InstancedMesh(lampG, M(0x2a2c30, { roughness: 0.45, metalness: 0.7 }), n), bulb = new THREE.InstancedMesh(bulbG, neon(0xfff0d0, {}, 0.6, 2.3), n);
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: S.pool, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffe2b0 }), n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), s2 = new THREE.Vector3(13, 1, 13);
    pts.forEach(([x, z, ry], i) => { q.setFromAxisAngle(UP, ry); m4.compose(v.set(x, 0, z), q, s1); lamp.setMatrixAt(i, m4); bulb.setMatrixAt(i, m4);
      const hx = x + Math.cos(ry) * -3.1; m4.compose(v.set(hx, 0.07, z), q, s2); pool.setMatrixAt(i, m4); });
    lamp.castShadow = true; for (const x of [lamp, bulb, pool]) { x.computeBoundingSphere(); g.add(x); }
    onNight(nn => pool.visible = nn && Q.tier.pools); A.lampPools = pool; }

  // ===================== roadside pylons =====================
  const pb = new Batch(), ledF = neon(0xffd77a, {}, 0.9, 1.8);
  const sign = (text, color, x, z, sub = '') => { // double-faced roadside pylon, readable along the road
    pb.box(black, x, 0, z, 2.4, 1, 2.4); pb.box(stone, x - 0.45, 1, z, 0.55, 11, 1.2); pb.box(stone, x + 0.45, 1, z, 0.55, 11, 1.2); pb.box(gold, x, 11.9, z, 13.4, 0.35, 1);
    signMesh(g, text, color, x, 15.3, z + 0.45, 12.4, 6, 0, sub); signMesh(g, text, color, x, 15.3, z - 0.45, 12.4, 6, PI, sub);
    pb.box(M(0x111111), x, 12.2, z, 12.6, 6.2, 0.8); for (const yy of [12.15, 18.4]) pb.box(ledF, x, yy, z, 12.9, 0.18, 0.95); for (const xx of [-6.4, 6.4]) pb.box(ledF, x + xx, 12.15, z, 0.18, 6.4, 0.95);
    pb.box(gold, x, 18.6, z, 8, 0.5, 0.8); sphere(pb, gold, x, 19.6, z, 0.7); solid(x - 1.2, x + 1.2, z - 1.2, z + 1.2); };
  const facadeSign = (text, color, x, y, z, w, h, sd) => signMesh(g, text, color, x, y, z, w, h, sd < 0 ? PI / 2 : -PI / 2);

  // ===================== Luxe Pyramid (south, west) =====================
  { const x = -90, z = 470, b = new Batch();
    const pyrPts = rect(x, z, 100, 100); b.prism(facade('darkGlass'), null, pyrPts, 0, 95, { taper: 0.002, smooth: 0, cap: false });
    const ridge = neon(0xbfe8ff, {}, 0.5, 2.0); for (const [px, pz] of pyrPts) bar(b, ridge, px, 0, pz, x, 95, z, 0.28, 5);
    for (const [px, pz] of rect(x, z, 101.5, 101.5)) b.box(black, px, 0, pz, 3, 3, 3);
    b.geo(gold, new THREE.ConeGeometry(Math.SQRT2 * 2.2, 3.5, 4, 1).rotateY(PI / 4), x, 95.5, z);
    b.prism(stone, stone, rect(x + 50, z, 6, 22), 0, 9); b.prism(gold, null, rect(x + 50.2, z, 6.2, 22.2), 9, 9.6, { cap: false }); b.box(glow(0x6a4a24, 0xb07a34, 0.1, 0.42), x + 53.1, 0, z, 0.2, 6.5, 10); // portal (warm doorway, kept below bloom)
    // sphinx (facing the Strip)
    const sx = -42, sand = M(0xd2b882, { roughness: 0.85 }), sandD = M(0xb89a64, { roughness: 0.9 });
    b.prism(sand, sand, stadium(sx - 6, z, 20, 9), 0, 6.5); b.prism(sandD, sandD, rect(sx - 6, z, 22, 11), 0, 1.2);
    for (const dz of [-2.8, 2.8]) b.prism(sand, sand, stadium(sx + 6, z + dz, 9, 2.6), 0, 2);
    b.prism(sand, sand, rect(sx + 1, z, 6, 7.5, 0, 1.6), 0, 10); b.prism(sand, sand, rect(sx + 2, z, 4.6, 4.6, 0, 1), 10, 15.2, { taper: 0.92 });
    pediment(b, M(0x3a6aa0, { roughness: 0.5 }), sx + 0.7, 12, z, 4.2, 7.8, 5.2); // nemes headdress
    b.box(sandD, sx + 4.35, 11.2, z, 0.4, 1.6, 1.6); b.box(sandD, sx + 4.3, 9.6, z, 0.6, 1.8, 0.8); solid(-54, -30, z - 7, z + 7);
    // obelisk
    b.prism(sandD, null, rect(-36, z + 34, 2.6, 2.6), 0, 22, { taper: 0.65, cap: false }); b.geo(gold, new THREE.ConeGeometry(1.2, 2.2, 4).rotateY(PI / 4), -36, 23.1, z + 34); b.box(black, -36, 0, z + 34, 4, 1, 4); solid(-38, -34, z + 32, z + 36);
    // stepped ziggurat hotel towers
    for (const tz of [z - 62, z + 62]) { let pts = rect(-160, tz, 48, 36); for (let k = 0; k < 4; k++) { T0(b, 'darkGlass', pts, k * 26, k * 26 + 26); band(b, ridge, pts, k * 26 + 25.6, 0.4); pts = inset(pts, 0.86); } roofKit(b, pts, 104); solid(-184, -136, tz - 18, tz + 18); }
    b.flush(g); solid(x - 50, x + 50, z - 50, z + 50);
    const beam = beamMesh(1400, 3.2, 1.6, 0xd8ecff); beam.position.set(x, 96, z); g.add(beam); const core = beamMesh(1400, 0.9, 0.6, 0xffffff); core.position.set(x, 96, z); g.add(core);
    onNight(n => { beam.visible = core.visible = n; });
    sign('LUXE PYRAMID', '#7fd8ff', -25, z - 20); landmark('Luxe Pyramid', x, z); }

  // ===================== Emerald City Grand (east) =====================
  { const x = 95, z = 380, b = new Batch(), em = neon(0x4dff9a, {}, 0.6, 1.35);
    const main = stadium(102, z, 46, 22, PI / 2); T0(b, 'emerald', main, 10, 100); band(b, em, main, 99.4, 0.6); T0(b, 'emerald', inset(main, 0.84), 100, 108); band(b, em, inset(main, 0.84), 107.4, 0.6); roofKit(b, inset(main, 0.84), 108);
    for (const [dz, ry] of [[-36, 0.55], [36, -0.55]]) { const w = stadium(112, z + dz, 38, 20, PI / 2 + ry); T0(b, 'emerald', w, 10, 84); band(b, em, w, 83.4, 0.6); roofKit(b, w, 84); }
    solid(86, 124, z - 56, z + 56);
    const pod = rect(60, z, 20, 80, 0, 4); T0(b, 'emerald', pod, 0, 10, { roof: M(0x0b3a26) }); b.prism(gold, null, inset(pod, 1.01), 10, 10.6, { cap: false }); b.prism(em, null, inset(pod, 1.012), 2.6, 2.9, { cap: false });
    b.flush(g); solid(50, 70, z - 40, z + 40);
    const gemM = new THREE.MeshPhysicalMaterial({ color: 0x18c070, metalness: 0.1, roughness: 0.04, clearcoat: 1, emissive: 0x0a7a3a, emissiveIntensity: 0.3, flatShading: true });
    onNight(n => gemM.emissiveIntensity = n ? 1.4 : 0.25);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), gemM); gem.scale.set(5, 8, 5); gem.position.set(60, 22, z); gem.castShadow = true; g.add(gem);
    A.anim.push(t => { gem.rotation.y = t * 0.4; gem.position.y = 22 + Math.sin(t * 1.2) * 0.6; });
    facadeSign('EMERALD CITY GRAND', '#4dff9a', 49.7, 12.5, z, 36, 5, 1);
    sign('EMERALD CITY GRAND', '#4dff9a', 25, z + 48); landmark('Emerald City Grand', x, z); }

  // ===================== Bellissimo with fountain lake (west) =====================
  { const z = 220, b = new Batch(), C0 = -40, ivory = M(0xf0e6d0, { roughness: 0.55 });
    const segs2 = [[-0.17, 0.17, 115], [0.17, 0.34, 98], [-0.34, -0.17, 98], [0.34, 0.5, 80], [-0.5, -0.34, 80]];
    for (const [a0, a1, h] of segs2) { const pts = arcBand(C0, z, 82, 100, PI + a0, PI + a1, 10); T0(b, 'cream', pts, 12, h, { roof: stone });
      cap(b, ivory, pts, h, 1.6, 1.012); b.prism(stone, stone, arcBand(C0, z, 84.5, 97.5, PI + a0 + 0.01, PI + a1 - 0.01, 8), h + 1.6, h + 5); band(b, ivory, pts, h - 9, 0.8); }
    // central cupola crown + red-roofed rooftop pavilions
    b.prism(stone, stone, circle(C0 - 91, z, 5, 16), 120, 126); b.geo(terra, new THREE.SphereGeometry(5.2, 16, 8, 0, PI * 2, 0, PI / 2), C0 - 91, 126, z); b.geo(gold, new THREE.ConeGeometry(0.6, 4, 8), C0 - 91, 133, z);
    for (const s of [-1, 1]) { const a = PI + s * 0.255, px = C0 + Math.cos(a) * 91, pz = z + Math.sin(a) * 91; hipRoof(b, terra, px, 103, pz, 12, 12, 5, -a); }
    const pod = arcBand(C0, z, 76, 104, PI - 0.56, PI + 0.56, 12); b.prism(ivory, stone, pod, 0, 12); band(b, gold, pod, 11.4, 0.5, 1.004);
    solid(-142, -112, z - 52, z + 52); solid(-128, -104, z - 30, z + 30);
    // Tuscan villa podium on the lake (x -100..-80)
    for (let k = 0; k < 4; k++) { const vz = z - 42 + k * 28, w = 18, d = 22, pts = rect(-90, vz, w, d); T0(b, 'villa', pts, 0, 12 + (k % 2) * 4, { roof: null });
      hipRoof(b, terra, -90, 12 + (k % 2) * 4, vz, w + 1.6, d + 1.6, 4.5); }
    for (const tz of [z - 56, z + 56]) { T0(b, 'villa', rect(-92, tz, 7, 7), 0, 26, { roof: null }); hipRoof(b, terra, -92, 26, tz, 8.4, 8.4, 4); } // little bell towers
    solid(-100, -80, z - 60, z + 60);
    // lake edge: stone coping, balustrade, lanterns
    const lake = { x0: -77, x1: -23, z0: z - 60, z1: z + 60 };
    const balM = (() => { const [c, x2] = canvas(128, 64); x2.clearRect(0, 0, 128, 64); x2.fillStyle = '#efe7d6'; x2.fillRect(0, 0, 128, 8); x2.fillRect(0, 56, 128, 8);
      for (let i = 0; i < 8; i++) { const cx = 8 + i * 16; x2.beginPath(); x2.moveTo(cx - 3, 56); x2.quadraticCurveTo(cx - 7, 40, cx - 2, 30); x2.quadraticCurveTo(cx - 6, 18, cx - 3, 8); x2.lineTo(cx + 3, 8); x2.quadraticCurveTo(cx + 6, 18, cx + 2, 30); x2.quadraticCurveTo(cx + 7, 40, cx + 3, 56); x2.fill(); }
      const t = tex(c); return new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }); })();
    const lkPts = rect((lake.x0 + lake.x1) / 2, z, lake.x1 - lake.x0, lake.z1 - lake.z0); b.prism(ivory, ivory, inset(lkPts, 1.02), 0, 0.5); // coping ring (filled; water sits on top)
    const balG = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0); const pg = new THREE.PlaneGeometry(L, 1.1); const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L / 2); b.geo(balM, pg, (x0 + x1) / 2, 1.05, (z0 + z1) / 2, 1, 1, 1, -Math.atan2(z1 - z0, x1 - x0)); b.box(ivory, (x0 + x1) / 2, 1.55, (z0 + z1) / 2, Math.abs(x1 - x0) + 0.4, 0.15, Math.abs(z1 - z0) + 0.4); };
    balG(lake.x1 + 0.6, lake.z0, lake.x1 + 0.6, lake.z1); balG(lake.x0, lake.z0 - 0.6, lake.x1 + 0.6, lake.z0 - 0.6); balG(lake.x0, lake.z1 + 0.6, lake.x1 + 0.6, lake.z1 + 0.6);
    const lantern = neon(0xffd9a0, {}, 0.7, 1.6); for (let zz = lake.z0; zz <= lake.z1; zz += 12) { b.cyl(black, lake.x1 + 0.6, 0.5, zz, 0.12, 4.2, 6); sphere(b, lantern, lake.x1 + 0.6, 4.9, zz, 0.35, 0.45, 0.35, 8); }
    b.flush(g); solid(lake.x0, lake.x1 + 1, lake.z0 - 1, lake.z1 + 1);
    makeWater(g, lake.x1 - lake.x0, lake.z1 - lake.z0, (lake.x0 + lake.x1) / 2, 0.42, z, { color: 0x0f4e66, size: 2.5 });
    fountain(A, g, lake, z);
    facadeSign('BELLISSIMO', '#ffe08a', -111.2, 10, z, 30, 4, -1); sign('BELLISSIMO', '#ffe08a', -25, z + 70); landmark('Bellissimo', -90, z); }

  // ===================== Flamingo Pink (east) =====================
  { const x = 90, z = 120, b = new Batch(), pk = neon(0xff4fa8, {}, 0.7, 1.5);
    const slab = stadium(x, z, 70, 24, PI / 2); T0(b, 'pink', slab, 14, 72); band(b, pk, slab, 71.4, 0.6); band(b, pk, slab, 40, 0.4); roofKit(b, slab, 72, 3);
    const pod = rect(66, z, 24, 76, 0, 3); T0(b, 'pink', pod, 0, 14, { roof: M(0x5a2a40) }); band(b, pk, pod, 13.4, 0.6, 1.01); band(b, pk, pod, 4, 0.3, 1.01);
    // neon feather fan on the tower face
    for (let k = 0; k < 9; k++) { const a = -0.95 + k * 0.2375; const L = 15 + (4 - Math.abs(k - 4)) * 1.8; const bx = 77.4, by = 24, bz = z;
      bar(b, pk, bx, by, bz, bx, by + Math.cos(a) * L, bz + Math.sin(a) * L, 0.22, 5); sphere(b, pk, bx - 0.2, by + Math.cos(a) * L * 0.72, bz + Math.sin(a) * L * 0.72, 0.3, 2.6, 1.0, 8); }
    sphere(b, gold, 77.4, 24, z, 1.2);
    b.flush(g); solid(78, 102, z - 35, z + 35); solid(54, 78, z - 38, z + 38);
    // neon flamingo on the podium roof
    { const f = new THREE.Group(), pm = neon(0xff6ec7, {}, 0.8, 1.6); f.position.set(62, 14, z + 22); f.rotation.y = -PI / 2; g.add(f);
      const bodyM = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), pm); bodyM.scale.set(2.2, 1.4, 4); bodyM.position.set(0, 7, 0); f.add(bodyM);
      const neck = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 8, 3), new THREE.Vector3(0, 11, 5), new THREE.Vector3(0, 13.5, 3.2), new THREE.Vector3(0, 15.5, 4.5)]);
      f.add(new THREE.Mesh(new THREE.TubeGeometry(neck, 24, 0.45, 8), pm)); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), pm); hd.position.set(0, 15.8, 4.8); f.add(hd);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.6, 8), neon(0x222222, {}, 1, 1)); beak.position.set(0, 15.4, 5.9); beak.rotation.x = 2.2; f.add(beak);
      for (const s of [-0.5, 0.5]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 6), pm); leg.position.set(s, 3, 0); f.add(leg); }
      A.anim.push(t => { f.rotation.z = Math.sin(t * 0.8) * 0.03; }); }
    facadeSign('FLAMINGO PINK', '#ff6ec7', 77.7, 52, z, 22, 5, 1); sign('FLAMINGO PINK', '#ff6ec7', 25, z - 36); landmark('Flamingo Pink', x, z); }

  // ===================== Kingdom of Rome (west) =====================
  { const x = -95, z = 50, b = new Batch(), wm = M(0xf2efe8, { roughness: 0.4 });
    for (const [tx, tz, ry, h] of [[-112, 24, 0.22, 105], [-120, 78, -0.28, 95], [-158, 50, 0, 116]]) { const pts = rect(tx, tz, 24, 46, ry, 2);
      T0(b, 'white', pts, 0, h, { roof: wm }); cap(b, wm, pts, h, 2.2, 1.03); b.prism(wm, wm, inset(pts, 0.8), h + 2.2, h + 6); hipRoof(b, terra, tx, h + 6, tz, 15, 30, 4, ry); band(b, gold, pts, h - 2, 0.5, 1.02);
      for (const s of [-1, 1]) pediment(b, wm, tx + s * Math.sin(ry) * 0, h - 8, tz, 0.8, 18, 6, ry + (s > 0 ? 0 : PI)); }
    solid(-128, -98, 0, 50); solid(-136, -104, 54, 104); solid(-172, -144, 24, 76);
    // colonnade with fluted columns, entablature and pediment
    const colG = fluted(0.9, 13.2); for (let k = 0; k < 12; k++) { const cz = z - 33 + k * 6; b.geo(wm, colG, -50, 0.8 + 6.6, cz); b.box(wm, -50, 0.8, cz, 2.2, 0.5, 2.2); b.box(wm, -50, 13.6, cz, 2.2, 0.5, 2.2); }
    b.box(wm, -52, 0, z, 8, 0.8, 72); b.box(wm, -50, 14.1, z, 4, 2.2, 70); band(b, gold, rect(-50, z, 4, 70), 15.4, 0.3, 1.01);
    pediment(b, wm, -50, 16.3, z, 4, 30, 6.5); b.box(gold, -48, 16.3, z, 0.3, 0.3, 30);
    sphere(b, gold, -50, 23.6, z, 1.2); b.cyl(gold, -50, 16.3, z - 14.5, 0.6, 2.2, 8); b.cyl(gold, -50, 16.3, z + 14.5, 0.6, 2.2, 8); solid(-54, -48, z - 36, z + 36);
    // dome rotunda
    b.cyl(wm, -68, 0, z, 12, 12, 32); for (let k = 0; k < 16; k++) { const a = k / 16 * PI * 2; b.geo(wm, colG, -68 + Math.cos(a) * 12.6, 6.6 + 0.8, z + Math.sin(a) * 12.6, 0.5, 0.88, 0.5); }
    b.box(wm, -68, 12, z, 0, 0, 0); b.cyl(wm, -68, 12, z, 13.2, 1.4, 32);
    b.geo(M(0xb8c8c0, { roughness: 0.35, metalness: 0.5 }), new THREE.SphereGeometry(12.4, 32, 12, 0, PI * 2, 0, PI / 2), -68, 13.4, z); b.cyl(gold, -68, 25.4, z, 1.6, 3, 12); b.geo(gold, new THREE.ConeGeometry(1.2, 3, 12), -68, 29.8, z);
    solid(-80, -56, z - 12, z + 12);
    // forum plaza: fountain, statues on plinths, cypress trees
    b.cyl(wm, -34, 0, z, 6, 0.8, 24); b.cyl(wm, -34, 0.8, z, 1, 2.6, 12); b.cyl(wm, -34, 3.4, z, 2.2, 0.4, 16); solid(-40, -28, z - 6, z + 6);
    makeWater(g, 11, 11, -34, 0.7, z, { color: 0x1a6a8a, geometry: new THREE.CircleGeometry(5.6, 32), w: 11, d: 11 });
    const cyp = M(0x1f3a20, { roughness: 0.9 }); for (const cz of [z - 38, z - 28, z + 28, z + 38]) { b.geo(cyp, new THREE.SphereGeometry(1, 10, 8), -40, 6, cz, 1.4, 6, 1.4); b.cyl(M(0x4a3420), -40, 0, cz, 0.2, 1.2, 6); }
    for (const cz of [z - 20, z + 20]) { b.box(wm, -38, 0, cz, 2.4, 3, 2.4); b.cyl(wm, -38, 3, cz, 0.45, 2.4, 10, 0.35); sphere(b, wm, -38, 5.9, cz, 0.42); bar(b, wm, -38, 4.9, cz, -37.3, 6.6, cz + 0.4, 0.14, 6); solid(-39.5, -36.5, cz - 1.5, cz + 1.5); }
    b.flush(g);
    facadeSign('KINGDOM OF ROME', '#ffd77a', -47.9, 19, z, 30, 4.5, -1); sign('KINGDOM OF ROME', '#ffd77a', -25, z + 44); landmark('Kingdom of Rome', x, z); }

  // ===================== Venezia Grand (east) =====================
  { const x = 95, z = -80, b = new Batch(), ivory = M(0xf0e6d6, { roughness: 0.6 });
    const cx = 112, cz2 = z - 6; T0(b, 'beige', rect(cx, cz2, 18, 18, 0, 4), 0, 92);
    for (let k = 0; k < 3; k++) { const a = PI + k * PI * 2 / 3, L = 34, wx = cx + Math.cos(a) * L / 2, wz = cz2 + Math.sin(a) * L / 2; const pts = rect(wx, wz, L, 16, -a);
      T0(b, 'beige', pts, 0, 86); cap(b, ivory, pts, 86, 1.5); hipRoof(b, terra, wx, 87.5, wz, L, 16, 5, -a);
      const ex = cx + Math.cos(a) * L, ez = cz2 + Math.sin(a) * L; T0(b, 'beige', rect(ex, ez, 10, 10, -a), 86, 96, { roof: null }); hipRoof(b, terra, ex, 96, ez, 11, 11, 5, -a); }
    cap(b, ivory, rect(cx, cz2, 18, 18, 0, 4), 92, 2); hipRoof(b, terra, cx, 94, cz2, 18, 18, 7);
    solid(80, 132, z - 40, z + 30);
    // Doge palace (x 60–78)
    const dp = rect(69, z - 22, 18, 46); T0(b, 'doge', dp, 0, 18, { roof: null }); hipRoof(b, terra, 69, 18, z - 22, 18, 46, 3.5);
    for (let k = 0; k < 15; k++) b.box(ivory, 60, 18, z - 44 + k * 3.1, 0.6, 1.2, 1.2);
    solid(60, 78, z - 45, z);
    // campanile (60, -40)
    const camp = rect(60, -40, 7, 7); T0(b, 'brick', camp, 0, 60, { roof: null }); cap(b, ivory, camp, 60, 0.8, 1.05);
    for (const [px, pz] of rect(60, -40, 6.2, 6.2)) b.box(ivory, px, 60.8, pz, 1, 7, 1); b.box(M(0x2a2018), 60, 60.8, -40, 4.6, 5.5, 4.6);
    cap(b, ivory, camp, 67.8, 1.4, 1.08); b.prism(ivory, ivory, rect(60, -40, 5.6, 5.6), 69.2, 73); b.geo(gold, new THREE.ConeGeometry(4, 12, 4).rotateY(PI / 4), 60, 79, -40); sphere(b, gold, 60, 85.4, -40, 0.7);
    solid(56, 64, -44, -36);
    // Grand Canal (x 33–51) with stone edges, Rialto-style arch bridge
    b.prism(ivory, ivory, rect(42, z, 20, 92), 0, 0.3); b.box(ivory, 32.6, 0.3, z, 0.8, 0.9, 92); b.box(ivory, 51.4, 0.3, z, 0.8, 0.9, 92);
    { const sh = new THREE.Shape(); sh.moveTo(-10, 0); sh.quadraticCurveTo(0, 7.6, 10, 0); sh.lineTo(10, 1.1); sh.quadraticCurveTo(0, 8.8, -10, 1.1); sh.closePath();
      const bg = new THREE.ExtrudeGeometry(sh, { depth: 6, bevelEnabled: false, curveSegments: 16 }); bg.translate(0, 0, -3); b.geo(ivory, bg, 42, 0, z - 28, 1, 1, 1, 0);
      const ar = new THREE.Shape(); ar.moveTo(-10, 1.1); ar.quadraticCurveTo(0, 8.8, 10, 1.1); ar.lineTo(10, 2.2); ar.quadraticCurveTo(0, 9.9, -10, 2.2); ar.closePath();
      const rg = new THREE.ExtrudeGeometry(ar, { depth: 0.4, bevelEnabled: false, curveSegments: 16 }); b.geo(ivory, rg, 42, 0, z - 31, 1, 1, 1); b.geo(ivory, rg, 42, 0, z - 25.4, 1, 1, 1);
      b.box(ivory, 42, 4.8, z - 28, 5, 3.4, 6.4); hipRoof(b, terra, 42, 8.2, z - 28, 6, 7.2, 2.2); }
    b.flush(g); solid(33, 51, z - 46, z + 46);
    makeWater(g, 18, 90, 42, 0.36, z, { color: 0x1d6a6a, size: 3 });
    // gondolas gliding on the canal
    const gm = M(0x0b0a0a, { roughness: 0.3, metalness: 0.2 }), gondolas = [];
    for (let k = 0; k < 3; k++) { const gd = new THREE.Group(); const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), gm); hull.scale.set(0.7, 0.35, 5); hull.position.y = 0.5; gd.add(hull);
      for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, 1.8, 5), gm); tip.position.set(0, 1.2, s * 4.7); tip.rotation.x = s * 0.35; gd.add(tip); }
      const seat = new THREE.Mesh(G.box, M(0xb0102a)); seat.scale.set(0.9, 0.3, 1.4); seat.position.y = 0.8; gd.add(seat);
      const gond = makeCharacter({ skin: '#d9a47c', hair: '#1a1209', outfit: '#ffffff', style: 'solid' }); gond.scale.setScalar(0.95); gond.position.set(0, 0.6, -3.2); gd.add(gond);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4, 5), M(0x6a4a2a)); pole.position.set(0.5, 1.6, -2.8); pole.rotation.x = 0.5; gd.add(pole);
      gd.position.set(36 + k * 6, 0, z - 40 + k * 30); g.add(gd); gondolas.push({ gd, v: k % 2 ? 1.6 : -1.6, gond, x: 36 + k * 6 }); }
    A.anim.push((t, dt) => gondolas.forEach(o => { o.gd.position.z += o.v * dt; if (o.gd.position.z > z + 42 || o.gd.position.z < z - 42) o.v *= -1; o.gd.rotation.y = o.v > 0 ? 0 : PI; o.gd.position.y = Math.sin(t * 1.5 + o.x) * 0.05 + 0.05; animate(o.gond, t, 0); }));
    facadeSign('VENEZIA GRAND', '#ffcf7a', 77.6, 10, z - 22, 16, 3.4, 1); sign('VENEZIA GRAND', '#ffcf7a', 25, z - 52); landmark('Venezia Grand', x, z); }

  // ===================== Sky Needle (north end, east) =====================
  { const x = 80, z = -572, b = new Batch(), conc = M(0xf2f0ea, { roughness: 0.55 });
    const base = circle(x, z, 22, 32); T0(b, 'concrete', base, 0, 18, { roof: conc }); band(b, neon(0xff66cc, {}, 0.6, 1.8), base, 17.4, 0.5, 1.01);
    const lathe = (pts, mat, seg = 32) => { const lg = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); b.geo(mat, lg, x, 0, z); };
    lathe([[7.6, 18], [6.6, 50], [5.2, 120], [4.4, 200], [4.4, 222], [5.6, 228]], conc);
    for (let k = 0; k < 3; k++) { const a = k / 3 * PI * 2 + 0.3; bar(b, conc, x + Math.cos(a) * 17, 18, z + Math.sin(a) * 17, x + Math.cos(a) * 4.6, 150, z + Math.sin(a) * 4.6, 1.3, 8, 0.7); }
    lathe([[5.6, 226], [17, 230], [21, 236], [21.6, 238]], conc); // v5: the deck (needle.js) supplies its own glass ring at 238 m
    lathe([[22.6, 245], [22, 247], [18.5, 250], [18.5, 256]], conc); lathe([[18.5, 256], [19.6, 257], [19.6, 258.4], [14, 262], [6, 264], [0.01, 264.2]], M(0xd8dce0, { roughness: 0.3, metalness: 0.6 }));
    lathe([[22.65, 244.6], [22.65, 245.6]], neon(0x66ccff, {}, 0.6, 2.2)); lathe([[19.7, 257.4], [19.7, 258]], neon(0xff66cc, {}, 0.6, 2.2));
    b.cyl(conc, x, 264, z, 1.4, 20, 8, 1); b.cyl(conc, x, 284, z, 0.9, 30, 6, 0.4);
    for (const y of [272, 290, 313]) sphere(b, aviation, x, y, z, 0.7, 0.7, 0.7, 8);
    b.flush(g); solid(x - 22, x + 22, z - 22, z + 22);
    sign('SKY NEEDLE', '#ff66cc', 25, z + 28); landmark('Sky Needle', x, z); }

  // ===================== TILEO KINGDOM (vacant North Strip lot, east) =====================
  buildTileo(A, solid, sign, pb);

  // ===================== filler buildings + vacant lots / construction =====================
  const fillers = [[-1, -640, -540], [-1, -520, -482], [-1, -458, -380], [-1, -360, -212], [-1, -188, -20], [-1, 120, 150], [-1, 325, 400], [-1, 540, 640],
    [1, -530, -482], [1, -458, -414], [1, -260, -212], [1, -188, -140], [1, 10, 70], [1, 170, 295], [1, 325, 335], [1, 440, 640]];
  const styles = ['glassBlue', 'darkGlass', 'cream', 'concrete', 'sand', 'goldGlass', 'white', 'beige', 'glassBlue', 'darkGlass'];
  const neonPal = [0xff4fa8, 0x4dd8ff, 0xffcf4a, 0xb46cff, 0x4dff9a, 0xff7a3a];
  const fb = new Batch(); let signs = 0;
  const GENERIC = [['CASINO', 'SLOTS · TABLES · 24/7'], ['LIVE SHOWS', 'TONIGHT 8PM'], ['BUFFET', 'ALL YOU CAN EAT'], ['HOTEL & SPA', 'VACANCY'], ['POKER ROOM', 'OPEN 24 HOURS'], ['WEDDING CHAPEL', 'DRIVE-THRU']];
  for (const [sd, z0, z1] of fillers) { let z = z0;
    while (z < z1 - 14) { const w = 24 + R() * 22, d = Math.min(26 + R() * 30, z1 - z); if (d < 14) break; const cz = z + d / 2, cx = sd * (40 + w / 2 + R() * 10); const r = R();
      if (r < 0.14) { // vacant dirt lot with fence
        const lot = M(0x9e8460, { roughness: 1 }); fb.box(lot, cx, 0, cz, w, 0.06, d - 4); const f = M(0x8899aa, { transparent: true, opacity: 0.45 });
        fb.box(f, cx - sd * w / 2, 0, cz, 0.15, 2.4, d - 4); for (let zz = cz - d / 2 + 2; zz <= cz + d / 2 - 2; zz += 3) fb.cyl(gray, cx - sd * w / 2, 0, zz, 0.06, 2.5, 4); }
      else if (r < 0.24) { // construction site: concrete core, floor slabs, tower crane
        const y = M(0xf2b51c, { roughness: 0.5 }), h = 30 + R() * 40; fb.prism(M(0x9a9894), null, rect(cx, cz, 8, 8), 0, h + 6, { cap: false });
        for (let yy = 4; yy < h; yy += 4.2) fb.box(M(0x8a8884), cx, yy, cz, 18, 0.5, 18);
        for (const [px, pz] of rect(cx, cz, 17, 17)) fb.box(gray, px, 0, pz, 0.6, h, 0.6);
        for (let yy = 0; yy < h + 20; yy += 3) { bar(fb, y, cx + 10, yy, cz - 0.7, cx + 10, yy + 3, cz + 0.7, 0.08, 4); } for (const [ox, oz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) fb.box(y, cx + 10 + ox, 0, cz + oz, 0.18, h + 20, 0.18);
        fb.box(y, cx + 2, h + 20, cz, 44, 1.2, 1.2); fb.box(gray, cx + 22, h + 17, cz, 3, 3, 2); bar(fb, gray, cx + 10, h + 26, cz, cx + 24, h + 21.2, cz, 0.05, 4); bar(fb, gray, cx + 10, h + 26, cz, cx - 18, h + 21.2, cz, 0.05, 4); fb.box(y, cx + 10, h + 21.2, cz, 1.4, 4.8, 1.4);
        sphere(fb, aviation, cx + 10, h + 27, cz, 0.5, 0.5, 0.5, 6); solid(cx - 9.5, cx + 12, cz - 9.5, cz + 9.5); }
      else { const k = styles[Math.floor(R() * styles.length)], podH = 8 + R() * 8, H = podH + 30 + R() * (R() < 0.35 ? 130 : 70);
        const pod = rect(cx, cz, w, d - 4, 0, R() < 0.5 ? 2 : 0); T0(fb, 'darkGlass', pod, 0, podH, { roof: M(0x3a3a3c, { roughness: 0.9 }) }); fb.prism(stone, null, inset(pod, 1.01), podH - 0.8, podH, { cap: false });
        { // street level: paved plaza from the sidewalk to the door, planters with palms, a lit entrance canopy and glowing shopfronts
          const face = cx - sd * w / 2, edge = sd * 22, pw = Math.abs(face - edge), pz = d + 1;
          if (pw > 1) { fb.prism(plazaM, plazaM, rect((face + edge) / 2, cz, pw, pz), 0, 0.12);
            for (const dz of [-1, 1]) { const px = edge + sd * Math.min(3.5, pw / 2), pzz = cz + dz * (pz / 2 - 3); if (pw > 5) { fb.prism(stone, planterM, rect(px, pzz, 3, 3, 0, 0.4), 0.12, 0.6); plazaPalms.push([px, pzz, 7 + R2() * 3, 0.6]); solid(px - 1.5, px + 1.5, pzz - 1.5, pzz + 1.5); } } }
          const cw = Math.min(d - 8, 26); if (cw > 6) { const cxn = face - sd * 2.6;
            fb.box(canopyM, cxn, 5.2, cz, 5.2, 0.45, cw); fb.box(gold, cxn - sd * 2.6, 5.15, cz, 0.12, 0.55, cw + 0.1);
            for (let zz = -cw / 2 + 1.5; zz <= cw / 2 - 1.5; zz += 3) for (const xo of [-1.2, 1.2]) fb.box(downlight, cxn + xo, 5.17, cz + zz, 0.45, 0.03, 0.45);
            for (const dz of [-1, 1]) { const qx = cxn - sd * 2.2, qz = cz + dz * (cw / 2 - 0.6); fb.cyl(canopyM, qx, 0.12, qz, 0.18, 5.1, 12); solid(qx - 0.25, qx + 0.25, qz - 0.25, qz + 0.25); } } }
        const f = R(), tw = w * (0.55 + R() * 0.3), td = (d - 4) * (0.55 + R() * 0.3);
        let pts = f < 0.3 ? rect(cx, cz, tw, td, 0, 3 + R() * 4) : f < 0.55 ? stadium(cx, cz, Math.max(tw, td), Math.min(tw, td), tw > td ? 0 : PI / 2) : f < 0.68 ? circle(cx, cz, Math.min(tw, td) / 2, 24) : rect(cx, cz, tw, td);
        const tiers = 1 + Math.floor(R() * 3); let y0 = podH; const th = (H - podH) / tiers;
        const hotelBal = !CURTAIN[k] && R2() < 0.55;
        for (let s = 0; s < tiers; s++) { const y1 = y0 + th * (s === 0 ? 1.15 : 0.92); T0(fb, k, pts, y0, y1);
          if (CURTAIN[k]) fins(fb, k, pts, y0, y1, T0.uo); else if (hotelBal) balconies(fb, pts, y0, y1, STY[k].th / STY[k].rows);
          if (R() < 0.5) cap(fb, stone, pts, y1, 0.8, 1.015); y0 = y1; if (s < tiers - 1) pts = inset(pts, 0.82); }
        const yTop = y0;
        if (H > 80 && towerNames < TOWER_NAMES.length && R2() < 0.6) { // resort name in lights near the top, facing the Strip
          let fx = sd > 0 ? 1e9 : -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { fx = sd > 0 ? Math.min(fx, p[0]) : Math.max(fx, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
          const sw = Math.min(26, (z1 - z0) * 0.8); if (sw > 8) signMesh(g, TOWER_NAMES[towerNames++], ['#ffd27a', '#ffffff', '#7fe3ff', '#ff8fd0'][towerNames % 4], fx - sd * 0.5, yTop - sw / 5 / 2 - 4, (z0 + z1) / 2, sw, sw / 5, sd < 0 ? PI / 2 : -PI / 2, '', '#0a0a0c'); }
        crown(fb, pts, yTop);
        if (R() < 0.45) band(fb, neon(neonPal[Math.floor(R() * neonPal.length)], {}, 0.5, 1.9), pts, y0 - 1.5, 0.7, 1.012);
        roofKit(fb, pts, y0, 1 + Math.floor(R() * 3)); solid(cx - w / 2, cx + w / 2, cz - (d - 4) / 2, cz + (d - 4) / 2);
        if (signs < 10 && R() < 0.5) { const [t1, t2] = GENERIC[signs % GENERIC.length]; const sc = ['#ffcf4a', '#4dd8ff', '#ff6ec7', '#9aff6a'][signs % 4]; signs++;
          signMesh(g, t1, sc, cx - sd * (w / 2 + 0.2), podH - 4, cz, Math.min(16, d - 8), Math.min(16, d - 8) / 4, sd < 0 ? PI / 2 : -PI / 2, t2); } }
      z += d + 2 + R() * 6; } }
  // far skyline (no collision): distant resorts both sides
  for (let k = 0; k < 34; k++) { const sd = k % 2 ? 1 : -1, z = -640 + k * 40 + R() * 10, w = 26 + R() * 26, h = 30 + R() * 110, x = sd * (215 + R() * 70);
    const pts = R() < 0.5 ? rect(x, z, w, w * (0.6 + R() * 0.5), R() * 0.6 - 0.3, 3) : stadium(x, z, w, w * 0.5, R() * PI); T0(fb, styles[k % styles.length], pts, 0, h);
    if (R() < 0.5) band(fb, neon(neonPal[k % neonPal.length], {}, 0.4, 1.8), pts, h - 1.2, 0.8, 1.01); }
  fb.flush(g); pb.flush(g);

  // ===================== palms =====================
  const pl = []; for (let z = -592; z <= 592; z += 34) { if (CROSS.some(c => Math.abs(z - c) < 12)) continue; pl.push([0, z, 8 + R() * 2, 0.35]); }
  for (let z = -600; z <= 600; z += 26) { for (const [x, o] of [[21, 7], [-21, -6]]) { const zz = z + o; if (CROSS.some(c => Math.abs(zz - c) < 12)) continue; pl.push([x, zz, 7 + R() * 4, 0.15]); } }
  for (let k = 0; k < 14; k++) pl.push([-30 - R() * 6, 160 + k * 9, 8 + R() * 3, 0]); // Bellissimo promenade
  pl.push(...plazaPalms);
  palms(g, pl);

  // ===================== resort grounds: landscaped beds, lawns, walks, bushes, agaves (v6.2) =====================
  A.grounds = buildGrounds(A, CROSS);

  // ===================== traffic (instanced cars with head/tail lights) =====================
  { const NC = 26, TYPES = ['sedan', 'suv', 'sedan', 'taxi', 'suv', 'coupe', 'sedan', 'suv', 'taxi', 'sedan'], CM = carMats();
    const lm = new THREE.MeshBasicMaterial({ vertexColors: true }); onNight(n => lm.color.setScalar(n ? 1 : 0.32));
    const hp = new THREE.PlaneGeometry(5, 16).rotateX(-PI / 2).translate(0, 0.08, 10.5); const heads = new THREE.InstancedMesh(hp, new THREE.MeshBasicMaterial({ map: S.head, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xfff2d8 }), NC);
    onNight(n => heads.visible = n && Q.tier.pools);
    // realistic paint colours (most cars on the Strip are white, black, silver or grey); taxis are yellow
    const pal = [0xf2f2f0, 0x111114, 0xa7abb1, 0x5c6066, 0x1d2f52, 0x8c1220, 0xe4e1da, 0x2c3a2e, 0x6b5a48, 0x0f1c33];
    const cars = [], per = {}; for (let k = 0; k < NC; k++) { const ty = TYPES[k % TYPES.length]; per[ty] = (per[ty] || 0) + 1; }
    const G = {}; for (const ty in per) { const K = carParts(ty), n = per[ty];
      const parts = [new THREE.InstancedMesh(K.paint, CM.paint, n), new THREE.InstancedMesh(K.glass, CM.glass, n), new THREE.InstancedMesh(K.dark, CM.dark, n), new THREE.InstancedMesh(K.alloy, CM.alloy, n), new THREE.InstancedMesh(K.lights, lm, n)];
      parts.forEach((x, i) => { x.frustumCulled = false; x.castShadow = i === 0 || i === 2; x.receiveShadow = i === 0; g.add(x); }); G[ty] = { parts, n: 0 }; }
    for (let k = 0; k < NC; k++) { const ty = TYPES[k % TYPES.length], dir = k % 2 ? 1 : -1, gi = G[ty].n++;
      const vm = 9 + R() * 8; cars.push({ x: dir * (3.6 + (k % 3) * 4.4) * -1, z: -600 + R() * 1200, v: vm * dir, vm, s: vm, dir, ty, gi });
      G[ty].parts[0].setColorAt(gi, new THREE.Color(ty === 'taxi' ? 0xf2c200 : pal[Math.floor(R() * pal.length)])); }
    g.add(heads); heads.frustumCulled = false;
    const tm = new THREE.Matrix4(), tq = new THREE.Quaternion(), ts = new THREE.Vector3(1, 1, 1), tp = new THREE.Vector3();
    A.traffic = cars;
    const SIGNAL = () => A.signal || { strip: 'green' };
    A.anim.push((t, dt) => { const lb = A.limoBody, sigS = SIGNAL().strip; cars.forEach((c, k) => {
      let vt = c.vm;
      // red / amber light: stop at the line before the crosswalk (unless too close to stop on amber)
      if (sigS !== 'green') for (const cz of CROSS) { const line = cz - c.dir * 15.5, d = (line - c.z) * c.dir; if (d > -0.5 && d < 45) { if (sigS === 'amber' && d < 7) break; vt = Math.min(vt, Math.sqrt(Math.max(0, 2 * 4.5 * (d - 0.3)))); } }
      // keep a gap to the car (or limo) ahead in the same lane
      let gap = 1e9; for (const o of cars) { if (o === c || Math.abs(o.x - c.x) > 1 || o.dir !== c.dir) continue; const d = (o.z - c.z) * c.dir; if (d > 0 && d < gap) gap = d; }
      if (lb && Math.abs(c.x - lb.x) < 2) { const d = (lb.z - c.z) * c.dir; if (d > 0 && d < gap) gap = d - 4; }
      // the player's car, players on foot in the road, other players' cars (A.blockers, filled by main.js every frame)
      let blk = false; for (const o of A.blockers || []) { if (Math.abs(o.x - c.x) > (o.ped ? 1.5 : 2.1)) continue; const d = (o.z - c.z) * c.dir + 2.4 - o.len; if (d > -0.5 && d < gap) { gap = d; blk = true; } }
      if (gap < 40) vt = Math.min(vt, Math.max(0, (gap - 7.5) * 1.1));
      // stuck behind someone: honk, then change lanes when the next lane is clear
      if (blk && vt < 0.6 && c.s < 0.8) { c.wait = (c.wait || 0) + dt; if (c.wait > 2.2 && !(c.honkT > 0)) { c.honkT = 5 + Math.random() * 3; if (A.onHonk) A.onHonk(c); }
        if (c.wait > 4 && c.tx === undefined) { const lanes = [3.6, 8, 12.4].map(v => -c.dir * v), i = lanes.reduce((bi, v, j) => Math.abs(v - c.x) < Math.abs(lanes[bi] - c.x) ? j : bi, 0);
          for (const j of [i + 1, i - 1]) { const lx = lanes[j]; if (lx === undefined) continue;
            const clear = !cars.some(o => o !== c && Math.abs(o.x - lx) < 1.5 && Math.abs(o.z - c.z) < 9) && !(A.blockers || []).some(o => Math.abs(o.x - lx) < 2.4 && Math.abs(o.z - c.z) < 9);
            if (clear) { c.tx = lx; break; } } } }
      else c.wait = 0;
      if (c.honkT > 0) c.honkT -= dt;
      if (c.tx !== undefined) { const dx = c.tx - c.x, st = 2.4 * dt; c.x += Math.max(-st, Math.min(st, dx)); vt = blk ? 0.8 : Math.max(vt, 3.5); /* creep until clear of whoever blocked the lane */ if (Math.abs(dx) < 0.02) { c.x = c.tx; delete c.tx; c.wait = 0; } }
      c.s += Math.max(-7 * dt, Math.min(3 * dt, vt - c.s)); c.z += c.dir * c.s * dt; c.v = c.dir * Math.max(0.01, c.s);
      if (c.z > 640) c.z = -640; if (c.z < -640) c.z = 640; tq.setFromAxisAngle(UP, (c.dir > 0 ? 0 : PI) + (c.tx !== undefined ? Math.sign(c.tx - c.x) * c.dir * 0.12 : 0)); tm.compose(tp.set(c.x, 0.03, c.z), tq, ts);
      for (const x of G[c.ty].parts) x.setMatrixAt(c.gi, tm); heads.setMatrixAt(k, tm); });
      for (const ty in G) for (const x of G[ty].parts) x.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; }); }
  // pedestrians crossing the Strip on the walk signal (they wait at the corner otherwise)
  { const crossers = []; for (const c of CROSS) for (const dz of [-12.8, 12.8]) for (let n = 0; n < 3; n++) { const ch = makeCharacter(randomLook(R)), side = (n % 2 ? 1 : -1) * (R() < 0.5 ? 1 : -1);
      const p = { ch, z: c + dz + (R() - 0.5) * 3, from: side * 16.8, at: 0, state: 'wait', delay: R() * 3, speed: 1.9 + R() * 0.5 }; ch.position.set(p.from, 0.15, p.z); ch.rotation.y = side > 0 ? -PI / 2 : PI / 2; g.add(ch); crossers.push(p); }
    A.anim.push((t, dt) => { const S2 = A.signal || {}; for (const p of crossers) { let sp = 0;
      if (p.state === 'wait') { if (S2.walk && S2.t < 30 + p.delay) { if (S2.t > 27.5 + p.delay) { p.state = 'walk'; p.at = 0; } } }
      else { p.at += p.speed * dt; sp = p.speed; const L = Math.abs(p.from) * 2, k = Math.min(1, p.at / L); p.ch.position.x = p.from * (1 - 2 * k); p.ch.position.y = Math.abs(p.ch.position.x) > 14 ? 0.15 : 0.03;
        p.ch.rotation.y = p.from > 0 ? -PI / 2 : PI / 2; if (k >= 1) { p.from = -p.from; p.state = 'wait'; p.ch.rotation.y = p.from > 0 ? -PI / 2 : PI / 2; } }
      animate(p.ch, t, sp, sp ? '' : (p.ch.userData.idleMode ||= ['', 'phone', 'fold', ''][Math.floor(Math.random() * 4)])); } }); }
  // pedestrians on sidewalks
  const peds = []; for (let k = 0; k < 12; k++) { const ch = makeCharacter(randomLook(R)); const sd = k % 2 ? 1 : -1; ch.position.set(sd * (16.5 + R() * 3), 0.15, -600 + R() * 1200); ch.userData.v = (1.4 + R()) * (R() < 0.5 ? 1 : -1); ch.rotation.y = ch.userData.v > 0 ? 0 : PI; g.add(ch); peds.push(ch); }
  A.anim.push((t, dt) => peds.forEach(p => { p.position.z += p.userData.v * dt; if (p.position.z > 630) p.position.z = -630; if (p.position.z < -630) p.position.z = 630; animate(p, t, Math.abs(p.userData.v)); }));
}
function mergeG(list) { const out = []; for (const g of list) { const x = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k); out.push(x); }
  const pos = [], nor = [], uv = []; for (const x of out) { pos.push(...x.attributes.position.array); nor.push(...x.attributes.normal.array); uv.push(...x.attributes.uv.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; }

// Bellissimo choreographed fountain: rows of jets along curves, instanced (2 draw calls), lit gold at night
function fountain(A, g, lake, z) {
  const S = streetTex(), pts = [];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 26; k++) { const u = k / 25 - 0.5; pts.push([-50 + r * 9 - Math.cos(u * 2.2) * 10 + 10, z + u * (100 - r * 16), r]); }
  for (let k = 0; k < 6; k++) pts.push([-44, z - 40 + k * 16, 3]); // big shooters
  const n = pts.length;
  const jg = new THREE.CylinderGeometry(0.12, 0.55, 1, 8, 1, true); jg.translate(0, 0.5, 0);
  const jm = new THREE.MeshBasicMaterial({ color: 0xffffff, map: S.beam, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.5 });
  const mg = new THREE.SphereGeometry(1, 10, 6); const mm = new THREE.MeshBasicMaterial({ color: 0xffffff, map: S.soft, transparent: true, depthWrite: false, opacity: 0.16 });
  const jets = new THREE.InstancedMesh(jg, jm, n), mist = new THREE.InstancedMesh(mg, mm, n); jets.frustumCulled = mist.frustumCulled = false; g.add(jets, mist);
  onNight(nn => { jm.color.set(nn ? 0xffe6b8 : 0xffffff).multiplyScalar(nn ? 1.1 : 1); mm.color.set(nn ? 0xffd9a0 : 0xffffff); });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  A.anim.push((t, dt, pp) => { if (pp && Math.hypot(pp.x + 50, pp.z - z) > 700) return; const show = Math.floor(t / 9) % 4, lt = t % 9;
    pts.forEach(([x, zz, r], i) => { const u = (zz - z) / 100; let h;
      if (show === 0) h = 6 + 18 * Math.max(0, Math.sin(t * 2.2 - u * 9 + r));
      else if (show === 1) h = r === 3 ? (lt > 3 ? 48 * Math.max(0, Math.sin((lt - 3) * 0.9)) : 2) : 4 + 14 * Math.abs(Math.sin(t * 1.4 + r * 1.2));
      else if (show === 2) h = 3 + 22 * Math.max(0, Math.sin(t * 3 + (i % 2) * PI)) * (0.6 + 0.4 * Math.sin(u * 6 + t));
      else h = r === 3 ? 30 + 12 * Math.sin(t * 2) : 8 + 10 * Math.max(0, Math.cos(u * 12 - t * 4));
      h = Math.max(0.8, h); const w = r === 3 ? 1.8 : 1;
      m4.compose(v.set(x, 0.4, zz), q, s.set(w, h, w)); jets.setMatrixAt(i, m4);
      m4.compose(v.set(x, 0.4 + h * 0.92, zz), q, s.set(w * (1.2 + h * 0.06), w * (1 + h * 0.05), w * (1.2 + h * 0.06))); mist.setMatrixAt(i, m4); });
    jets.instanceMatrix.needsUpdate = mist.instanceMatrix.needsUpdate = true; });
}

function buildTileo(A, solid, sign, pb) {
  const g = A.group, cx = 100, cz = -330, b = new Batch();
  const black = M(0x0e0d0c, { roughness: 0.3, metalness: 0.5 }), gold = goldM(0.45, 0.25), tiger = glow(0xffffff, 0xff8a00, 0.0, 0.7, { map: rep(T.tiger, 1 / 6, 1 / 2.6), emissiveMap: rep(T.tiger, 1 / 6, 1 / 2.6), roughness: 0.45 });
  const goldLED = neon(0xffc04a, {}, 0.6, 1.25);
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(56, 110), pbr('marble', 56 / 2.4, 110 / 2.4, { color: 0x1c1816, metalness: 0.2 })); plaza.material.color.setHex(0x3a3430);
  plaza.rotation.x = -PI / 2; plaza.position.set(50, 0.06, cz); plaza.receiveShadow = true; g.add(plaza);
  const ts = plane(g, STD({ map: rep(T.tiger, 1, 6), roughness: 0.6 }), 46, 0.08, cz, 6, 70); ts.receiveShadow = true; // tiger drive stripe
  // podium + tower (faces stay at x = cx-18 / z = cz+20 so the logo planes sit just proud of the glass)
  const pod = rect(cx, cz, 50, 80); b.prism(facade('blackGold'), black, pod, 0, 16); b.prism(gold, gold, inset(pod, 1.012), 16, 17); solid(cx - 25, cx + 25, cz - 40, cz + 40);
  const towerPts = rect(cx, cz, 36, 40, 0, 3); b.prism(facade('blackGold'), null, towerPts, 16, 196, { cap: false, uo: 0, vo: 0 });
  for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const fx = cx + a * 16.6, fz = cz + c * 18.6; b.box(gold, fx, 16, fz, 0.7, 186, 4.6, a * c > 0 ? -PI / 4 : PI / 4); b.box(goldLED, fx + a * 0.38, 16, fz + c * 0.38, 0.12, 186, 3.4, a * c > 0 ? -PI / 4 : PI / 4); }
  for (let y = 40; y < 196; y += 36) b.prism(tiger, null, rect(cx, cz, 37.2, 41.2, 0, 3.3), y, y + 2.6, { cap: false });
  // crown: gold cornice, setback, crown spikes, LED rings
  b.prism(gold, gold, rect(cx, cz, 38, 42, 0, 3.6), 196, 199); band(b, goldLED, rect(cx, cz, 38, 42, 0, 3.6), 197.2, 0.5, 1.008);
  b.prism(black, black, rect(cx, cz, 30, 34, 0, 2.6), 199, 205); b.prism(gold, gold, rect(cx, cz, 31, 35, 0, 2.6), 205, 206); band(b, goldLED, rect(cx, cz, 31, 35, 0, 2.6), 205.2, 0.4, 1.01);
  const perim = rect(cx, cz, 36.5, 40.5, 0, 3.5); for (let i = 0; i < perim.length; i++) { const [ax, az] = perim[i], [bx, bz] = perim[(i + 1) % perim.length];
    for (let k = 0; k < 3; k++) { const u = (k + 0.5) / 3, px = ax + (bx - ax) * u, pz = az + (bz - az) * u, h = k === 1 ? 13 : 8; b.geo(gold, new THREE.ConeGeometry(0.9, h, 6), px, 199 + h / 2, pz); sphere(b, goldLED, px, 199 + h + 0.4, pz, 0.45, 0.45, 0.45, 8); } }
  b.box(black, cx, 205, cz, 3, 34, 3); // crown mast
  function band(bb, mat, pts, y, h, k) { bb.prism(mat, null, inset(pts, k), y, y + h, { cap: false }); }
  // RESORT logo: tower face crests + rooftop crown crest (two back-to-back planes so it never reads mirrored)
  logoPlane(g, 'resort', cx - 18.75, 167, cz, 29, -PI / 2, { maxW: 34, back: 0x0b0906, pad: 0.08 }); logoPlane(g, 'resort', cx, 167, cz + 20.75, 29, 0, { maxW: 32, back: 0x0b0906, pad: 0.08 });
  logoPlane(g, 'resort', cx - 1.6, 222, cz, 32, -PI / 2, { maxW: 34 }); logoPlane(g, 'resort', cx + 1.6, 222, cz, 32, PI / 2, { maxW: 34 });
  // DJ TILEO exterior banners (west face toward the Strip + south face)
  for (const [bx, bz, br] of [[cx - 18.75, cz, -PI / 2], [cx, cz + 20.75, 0]]) logoPlane(g, 'dj', bx, 95, bz, 30, br, { back: 0x0b0906, pad: 0.1 });
  const crestLight = new THREE.PointLight(0xffb030, 0, 90, 1.2); crestLight.position.set(cx - 25, 215, cz); g.add(crestLight); onNight(n => crestLight.intensity = n ? 40 : 0);
  // entrance: doors, canopy, lion statues
  // v6.3: sliding glass doors in gold frames with the warm lobby behind the glass; they slide open as you walk up (A.tileo.want, set by main.js)
  const doors = { k: 0, want: 0, leaves: [] };
  { const X = cx - 25.3, DH = 3.4, TOP = 7;
    const glassM = new THREE.MeshPhysicalMaterial({ color: 0xb8c8d0, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.3, envMapIntensity: 1.5, depthWrite: false, side: THREE.DoubleSide });
    b.box(glow(0x241508, 0x7a4c1c, 0.05, 0.3), X + 0.12, 0, cz, 0.06, TOP, 11.8); // the lobby, seen through the glass (kept under the bloom threshold)
    for (const dz of [-3.6, 0, 3.6]) b.box(glow(0x3a2610, 0xc08a40, 0.05, 0.6), X + 0.08, 4.7, cz + dz, 0.02, 0.45, 1.5); // chandeliers inside
    b.box(M(0x2a2018, { roughness: 0.35, metalness: 0.2 }), X + 0.06, 0, cz, 0.04, 0.9, 11.8); // reception desk silhouette
    const pane = (w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateY(-PI / 2), glassM);
    for (const s of [-1, 1]) { const m = pane(2.9, DH - 0.12); m.position.set(X - 0.12, DH / 2, cz + s * 4.5); g.add(m); } // fixed side lights
    { const m = pane(11.8, TOP - DH - 0.14); m.position.set(X - 0.12, DH + (TOP - DH) / 2, cz); g.add(m); } // transom
    b.box(gold, X - 0.12, 0, cz, 0.22, 0.1, 12); b.box(gold, X - 0.12, DH - 0.07, cz, 0.24, 0.14, 12);
    for (const zz of [-6, -3, 3, 6]) b.box(gold, X - 0.12, 0, cz + zz, 0.2, TOP, 0.14);
    for (const zz of [-2, 2]) b.box(gold, X - 0.12, DH, cz + zz, 0.16, TOP - DH, 0.1);
    for (const s of [-1, 1]) { const leaf = new THREE.Group(); leaf.position.set(X - 0.28, 0, cz + s * 1.5); g.add(leaf);
      const gp = pane(2.88, DH - 0.16); gp.position.y = DH / 2; leaf.add(gp);
      for (const [dz, w, y, h] of [[-1.47, 0.07, 0, DH], [1.47, 0.07, 0, DH], [0, 3.0, 0, 0.08], [0, 3.0, DH - 0.1, 0.08]]) { const fm = new THREE.Mesh(G.box, gold); fm.scale.set(0.06, h, w); fm.position.set(0, y + h / 2, dz); leaf.add(fm); }
      const bar = new THREE.Mesh(G.box, gold); bar.scale.set(0.05, 1.4, 0.05); bar.position.set(-0.08, 1.05, -s * 1.25); leaf.add(bar);
      doors.leaves.push({ leaf, z0: cz + s * 1.5, s }); }
    A.anim.push((t, dt = 0.016) => { doors.k += Math.max(-dt * 1.6, Math.min(dt * 1.6, doors.want - doors.k)); const e = doors.k * doors.k * (3 - 2 * doors.k);
      for (const L of doors.leaves) L.leaf.position.z = L.z0 + L.s * 2.95 * e; }); }
  b.box(gold, cx - 25.4, 7, cz, 0.6, 0.6, 13);
  // canopy: dark coffered ceiling with spot downlights (the old all-gold glowing ceiling washed the entrance out)
  b.box(gold, 64, 8, cz, 20, 0.8, 26); b.box(M(0x2a1f12, { roughness: 0.6, metalness: 0.4 }), 64, 7.86, cz, 19.4, 0.12, 25.4);
  { const dl = neon(0xffe3b8, {}, 0.2, 1.0); for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) b.box(dl, 56.5 + i * 5, 7.83, cz - 10 + j * 5, 0.8, 0.03, 0.8); } for (const zz of [-12, 12]) for (const xx of [56, 70]) b.cyl(gold, xx, 0, cz + zz, 0.4, 8, 12);
  const canLight = new THREE.PointLight(0xffd090, 0, 30, 1.5); canLight.position.set(64, 6.5, cz); g.add(canLight); onNight(n => canLight.intensity = n ? 22 : 0);
  // entrance sign: resort logo over the canopy, flanked by name panels
  b.box(black, cx - 23.6, 17, cz, 0.5, 12, 11.5); b.box(gold, cx - 23.6, 29, cz, 0.7, 0.5, 12);
  logoPlane(g, 'resort', cx - 23.9, 23, cz, 11, -PI / 2, { maxW: 10.6 }); // resort logo standing on the podium over the entrance
  logoPlane(g, 'resort', cx - 25.5, 12.7, cz, 4.4, -PI / 2, { back: 0x0e0d0c, pad: 0.1 }); // small badge between the name panels
  signMesh(g, 'TILEO KINGDOM', '#ffcf4a', cx - 25.45, 12.4, cz - 13, 16, 3.2, -PI / 2, '', '#0e0d0c'); signMesh(g, 'LIFESTYLE RESORT', '#ffcf4a', cx - 25.45, 12.4, cz + 13, 16, 3.2, -PI / 2, '', '#0e0d0c');
  // animated LED screens on the podium (DJ Tileo)
  ledScreen(g, A, cx - 25.35, 7.2, cz - 30, 14, 9.3, -PI / 2); ledScreen(g, A, cx - 25.35, 7.2, cz + 30, 14, 9.3, -PI / 2, 'TILEO KINGDOM', 'ADULTS-ONLY LIFESTYLE RESORT');
  for (const zz of [cz - 30, cz + 30]) { b.box(gold, cx - 25.2, 2.3, zz, 0.3, 0.3, 14.6); b.box(gold, cx - 25.2, 11.9, zz, 0.3, 0.3, 14.6); }
  for (const s of [-1, 1]) { b.box(black, 70, 0, cz + s * 9, 3, 1.6, 4.4); const l = makeLion(gold, 1.2); l.position.set(70, 1.6, cz + s * 9); l.rotation.y = -PI / 2; g.add(l); solid(68.3, 71.7, cz + s * 9 - 2.4, cz + s * 9 + 2.4); }
  for (const s of [-1, 1]) { const l = makeLion(gold, 2.6); l.position.set(30, 1.2, cz + s * 40); l.rotation.y = -PI / 2; b.box(black, 30, 0, cz + s * 40, 6, 1.2, 8); b.box(goldLED, 30, 1.15, cz + s * 40, 6.1, 0.1, 8.1); g.add(l); solid(27, 33, cz + s * 40 - 4, cz + s * 40 + 4); }
  // big roadside pylon
  b.box(tiger, 25, 0, -288, 3, 26, 3); signMesh(g, 'TILEO KINGDOM', '#ffcf4a', 25, 30, -287.4, 18, 7, 0, 'LIFESTYLE RESORT · ADULTS ONLY'); signMesh(g, 'TILEO KINGDOM', '#ffcf4a', 25, 30, -288.6, 18, 7, PI, 'LIFESTYLE RESORT · ADULTS ONLY');
  b.box(black, 25, 26, -288, 18.6, 7.6, 1); solid(23, 27, -290, -286); for (const yy of [25.9, 33.5]) b.box(goldLED, 25, yy, -288, 19, 0.2, 1.1);
  b.box(black, 25, 33.6, -288, 12.6, 14.2, 1); logoPlane(g, 'resort', 25, 40.7, -287.45, 13.4, 0, { maxW: 12 }); logoPlane(g, 'resort', 25, 40.7, -288.55, 13.4, PI, { maxW: 12 }); b.box(gold, 25, 47.8, -288, 13, 0.5, 1.2);
  // DJ TILEO billboard / marquee by the tower (double-faced, readable both directions on the Strip)
  b.box(tiger, 24, 0, -398, 2.4, 22, 2.4); b.box(black, 24, 21, -398, 18, 22, 1.2); b.box(gold, 24, 20.6, -398, 18.6, 0.6, 1.4); b.box(gold, 24, 43, -398, 18.6, 0.6, 1.4);
  for (const yy of [21.2, 42.8]) b.box(goldLED, 24, yy, -398, 18.8, 0.15, 1.5);
  for (const [zz, rr] of [[-397.35, 0], [-398.65, PI]]) { logoPlane(g, 'dj', 24, 33.3, zz, 19, rr, { maxW: 16 }); signMesh(g, 'TONIGHT · MEGA CLUB', '#ffcf4a', 24, 22.6, zz + (rr ? -0.02 : 0.02), 16, 2.6, rr, 'DJ TILEO LIVE · TILEO KINGDOM', '#0e0d0c'); }
  solid(22.5, 25.5, -399.5, -396.5);
  // rental kiosk
  b.box(black, 38, 0, -362, 4, 3, 3); b.box(gold, 38, 3, -362, 5, 0.3, 4); signMesh(g, 'CONVERTIBLE RENTAL', '#ffcf4a', 38, 4.4, -360.4, 6, 1.4, 0); solid(36, 40, -363.5, -360.5);
  b.flush(g);
  // sweeping searchlights from the crown (night)
  const beams = []; for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const bm = beamMesh(900, 16, 1.2, 0xffe2a0); bm.position.set(cx + a * 14, 206, cz + c * 16); bm.material.opacity = 0.55; g.add(bm); beams.push([bm, a, c]); }
  onNight(n => beams.forEach(([bm]) => bm.visible = n));
  A.anim.push(t => beams.forEach(([bm, a, c], i) => { bm.rotation.set(0.32 * Math.sin(t * 0.45 + i * 1.7) + 0.18 * c, 0, 0.32 * Math.cos(t * 0.38 + i) - 0.18 * a, 'XYZ'); }));
  A.landmarks.push({ name: 'TILEO KINGDOM', x: cx, z: cz });
  A.tileo = { doorX: cx - 25, doorZ: cz, doors };
}
