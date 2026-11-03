// Procedural cars (v6 realistic): lofted bodies with real wheel arches, a glass cabin with painted pillars and roof,
// tyres with alloy rims, head/tail lights, mirrors, grille and dark underbody. No brands, no logos (apart from the
// game's own DJ Tileo livery on the player's convertible). Every car faces +z with its wheels on y = 0.
// carParts(type) returns merged geometries per material so traffic can draw each type with one instanced mesh per part.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const CAR_TYPES = {
  //        length width wheelR wheelbase  hood(front) belt  roof  tail  bottom  windshield base / roof front / roof back / rear glass base   nose round
  sedan:  { L: 4.75, W: 1.86, R: 0.34, WB: 2.85, hood: 0.8, belt: 0.98, roof: 1.45, tail: 0.98, yB: 0.24, zW: 0.85, zRF: 0.02, zRB: -1.15, zR: -1.8, nose: 0.55, cabinW: 0.88 },
  suv:    { L: 4.75, W: 1.95, R: 0.40, WB: 2.92, hood: 1.04, belt: 1.08, roof: 1.80, tail: 1.12, yB: 0.36, zW: 0.98, zRF: 0.22, zRB: -1.72, zR: -2.02, nose: 0.42, cabinW: 0.9 },
  taxi:   { L: 4.75, W: 1.86, R: 0.34, WB: 2.85, hood: 0.8, belt: 0.98, roof: 1.45, tail: 0.98, yB: 0.24, zW: 0.85, zRF: 0.02, zRB: -1.15, zR: -1.8, nose: 0.55, cabinW: 0.88, sign: true },
  coupe:  { L: 4.55, W: 1.92, R: 0.35, WB: 2.70, hood: 0.72, belt: 0.88, roof: 1.27, tail: 0.92, yB: 0.18, zW: 0.45, zRF: -0.4, zRB: -1.0, zR: -1.95, nose: 0.65, cabinW: 0.82 },
  convertible: { L: 4.6, W: 1.95, R: 0.36, WB: 2.80, hood: 0.80, belt: 0.98, roof: 1.3, tail: 0.98, yB: 0.22, zW: 0.78, zRF: 0.5, zRB: 0.5, zR: 0.5, nose: 0.55, cabinW: 0.9, open: true },
};
// lower body: half width, top and bottom along the length (z from -L/2 to +L/2, front = +z)
function profile(P) {
  const hL = P.L / 2;
  const zf = hL - (P.L - P.WB) * 0.47, zr = zf - P.WB; // front / rear axle z
  const hw = z => { const zn = z / hL; const f = zn > 0 ? Math.pow(Math.max(0, (zn - 0.72) / 0.28), 2) * P.nose : Math.pow(Math.max(0, (-zn - 0.78) / 0.22), 2) * 0.35; return P.W / 2 * (1 - 0.22 * f); };
  const top = z => { if (z > P.zW) { const t = (z - P.zW) / (hL - P.zW); return P.belt + (P.hood - P.belt) * Math.pow(t, 1.4) - 0.06 * Math.pow(t, 6); }
    if (z < P.zR) { const t = (P.zR - z) / (P.zR + hL); return P.belt + (P.tail - P.belt) * t - 0.08 * Math.pow(t, 5); } return P.belt; };
  const arch = z => { let y = P.yB; for (const za of [zf, zr]) { const d = Math.abs(z - za), r = P.R + 0.07; if (d < r) y = Math.max(y, P.R + Math.sqrt(r * r - d * d)); } return y; };
  const bottom = z => { const zn = Math.abs(z / hL); return Math.max(arch(z), P.yB + 0.12 * Math.pow(Math.max(0, (zn - 0.85) / 0.15), 2)); };
  return { hw, top, bottom, zf, zr, hL };
}
// superellipse ring
function ringPts(cx, cy, hw, hh, n, seg) { const out = []; for (let i = 0; i < seg; i++) { const t = i / seg * PI * 2, c = Math.cos(t), s = Math.sin(t);
  out.push([cx + hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + hh * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]); } return out; }
function loft(stations, seg, capStart, capEnd) { // stations: [{z, pts:[[x,y]...]}]
  const pos = [], idx = []; stations.forEach(s => s.pts.forEach(([x, y]) => pos.push(x, y, s.z)));
  for (let i = 0; i < stations.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg; idx.push(a, b, c, b, d, c); }
  const addCap = (si, flip) => { const s = stations[si]; let cx = 0, cy = 0; s.pts.forEach(p => { cx += p[0]; cy += p[1]; }); const ci = pos.length / 3; pos.push(cx / seg, cy / seg, s.z);
    for (let j = 0; j < seg; j++) { const a = si * seg + j, b = si * seg + (j + 1) % seg; flip ? idx.push(ci, a, b) : idx.push(ci, b, a); } };
  if (capStart) addCap(0, false); if (capEnd) addCap(stations.length - 1, true);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
const finish = g => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; };
const smooth = g => { g.computeVertexNormals(); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g.index ? g.toNonIndexed() : g; };
const strip = g => { const x = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
  if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); return x; };
const box = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return strip(g); };

const cache = {};
export function carParts(type) {
  if (cache[type]) return cache[type];
  const P = CAR_TYPES[type], F = profile(P), SEG = P.open ? 36 : 20, NZ = P.open ? 48 : 28;
  const paint = [], glass = [], dark = [], alloy = [], lights = [], lightsC = [], head = [], tail = [];
  // lower body (smooth, arches in the underside)
  const st = []; for (let i = 0; i <= NZ; i++) { const u = i / NZ, z = -F.hL + u * P.L; const zz = clamp(z, -F.hL + 0.002, F.hL - 0.002);
    const hw = F.hw(zz), t = F.top(zz), b = F.bottom(zz); const k = Math.min(1, Math.sin(u * PI) * 6 + 0.08);
    const ring = ringPts(0, (t + b) / 2, hw * k + 0.001, (t - b) / 2 * (0.6 + 0.4 * k), 4.5, SEG);
    if (P.open) { const cz = sstep(P.zW + 0.05, P.zW - 0.25, zz) * sstep(-1.35, -1.05, zz); if (cz > 0) for (const p of ring) { const m = sstep(hw * k - 0.1, hw * k - 0.2, Math.abs(p[0])); if (p[1] > (t + b) / 2) p[1] -= (P.belt - 0.62) * cz * m; } }
    st.push({ z: zz, pts: ring }); }
  paint.push(smooth(loft(st, SEG, true, true)));
  // cabin: glass with painted roof and pillars, built as one loft and split per face
  if (!P.open) {
    const NC = 20, SG = 14, zs = P.zW, ze = P.zR;
    const roofY = z => { if (z > P.zRF) return P.belt + (P.roof - P.belt) * Math.pow(1 - (z - P.zRF) / (P.zW - P.zRF), 0.85);
      if (z < P.zRB) return P.belt + (P.roof - P.belt) * Math.pow(1 - (P.zRB - z) / (P.zRB - P.zR), 0.8); return P.roof + 0.03 * Math.sin((z - P.zRB) / (P.zRF - P.zRB) * PI); };
    const pos = [], col = []; const S = [];
    for (let i = 0; i <= NC; i++) { const z = zs + (ze - zs) * i / NC, hwB = F.hw(z) * P.cabinW, hwT = hwB * 0.78, y0 = P.belt - 0.01, y1 = roofY(z), pts = [];
      for (let j = 0; j <= SG; j++) { const th = PI - j / SG * PI, c = Math.cos(th), s = Math.sin(th), yy = Math.pow(Math.abs(s), 0.42), xx = Math.sign(c) * Math.pow(Math.abs(c), 0.42);
        pts.push([xx * (hwB + (hwT - hwB) * yy), y0 + (y1 - y0) * yy, yy, j]); } S.push({ z, pts }); }
    // one indexed grid (smooth normals), then each quad goes to glass or paint
    const W2 = SG + 1, gp = [], gi = []; S.forEach(st => st.pts.forEach(p => gp.push(p[0], p[1], st.z)));
    for (let i = 0; i < NC; i++) for (let j = 0; j < SG; j++) { const a = i * W2 + j, b = a + 1, c = a + W2, d = c + 1; gi.push(a, c, b, b, c, d); }
    const G0 = new THREE.BufferGeometry(); G0.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); G0.setIndex(gi); G0.computeVertexNormals();
    const N0 = G0.attributes.normal.array, gpos = [], gnor = [], ppos = [], pnor = [];
    for (let i = 0; i < NC; i++) for (let j = 0; j < SG; j++) {
      const A = S[i].pts[j], B = S[i].pts[j + 1], z0 = S[i].z, z1 = S[i + 1].z, zm = (z0 + z1) / 2, ym = (A[2] + B[2]) / 2;
      const a = i * W2 + j, b = a + 1, c = a + W2, d = c + 1;
      // classify by the surface direction: roof faces up, side windows face out, windshield/rear glass face forward/back
      let nx = 0, ny = 0, nz = 0; for (const v of [a, b, c, d]) { nx += N0[v * 3]; ny += N0[v * 3 + 1]; nz += N0[v * 3 + 2]; } const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const front = zm > P.zRF - 0.02, rear = zm < P.zRB + 0.02, side = Math.abs(nx) > 0.6, top = ny > 0.82 && Math.abs(nz) < 0.35;
      const roof = top && !front && !rear;
      const corner = !side && !top && Math.abs(nx) > 0.22; // A and C pillars between the glass areas
      const bPillar = side && Math.abs(zm - (P.zRF * 0.45 + P.zRB * 0.55)) < 0.06;
      const cPillar = rear && side && zm < P.zRB - 0.05 * 0 && zm > P.zR + 0.12 && (P.cPil ?? 0.5) > 0.4 && zm < P.zRB - 0.02;
      const lowSill = ym < 0.06;
      const isP = roof || corner || bPillar || cPillar || lowSill, tp = isP ? ppos : gpos, tn = isP ? pnor : gnor;
      for (const v of [a, c, b, b, c, d]) { tp.push(gp[v * 3], gp[v * 3 + 1], gp[v * 3 + 2]); tn.push(N0[v * 3], N0[v * 3 + 1], N0[v * 3 + 2]); }
    }
    const mk = (arr, nor) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(arr.length / 3 * 2), 2)); return g; };
    glass.push(mk(gpos, gnor)); paint.push(mk(ppos, pnor));
    // mirrors
    for (const s of [-1, 1]) { const mx = s * (F.hw(P.zW - 0.15) * P.cabinW + 0.07); paint.push(box(0.16, 0.11, 0.09, mx, P.belt + 0.07, P.zW - 0.18, 0, s * 0.25)); dark.push(box(0.06, 0.03, 0.04, mx - s * 0.06, P.belt + 0.02, P.zW - 0.16)); }
  } else {
    // convertible: windshield in a thin frame, open cockpit
    const z = P.zW, hw = F.hw(z) * 0.9, wsH = 0.42;
    const ws = new THREE.PlaneGeometry(hw * 2, wsH, 8, 2); const p = ws.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, -0.1 * Math.pow(x / hw, 2)); } ws.computeVertexNormals();
    ws.rotateX(-0.55); ws.translate(0, P.belt + wsH / 2 * Math.cos(0.55), z - wsH / 2 * Math.sin(0.55)); glass.push(strip(ws));
    for (const s of [-1, 1]) paint.push(box(0.05, wsH + 0.04, 0.05, s * hw, P.belt + wsH / 2 * Math.cos(0.55), z - wsH / 2 * Math.sin(0.55), -0.55));
    paint.push(box(hw * 2 + 0.05, 0.05, 0.05, 0, P.belt + wsH * Math.cos(0.55), z - wsH * Math.sin(0.55)));
  }
  // underbody, grille, lower trim, wheel arch liners
  dark.push(box(P.W - 0.42, 0.14, P.L * 0.86, 0, P.yB - 0.02 + 0.07, 0));
  dark.push(box(P.W * 0.46, 0.16, 0.06, 0, P.hood - 0.3, F.hL - 0.04));
  dark.push(box(P.W * 0.6, 0.08, 0.06, 0, P.yB + 0.12, F.hL - 0.16)); // lower front / rear trim, tucked inside the rounded body ends
  dark.push(box(P.W * 0.66, 0.08, 0.06, 0, P.yB + 0.14, -F.hL + 0.16));
  for (const za of [F.zf, F.zr]) for (const s of [-1, 1]) { const t = new THREE.TorusGeometry(P.R + 0.07, 0.035, 4, 12, PI); t.rotateY(PI / 2); t.translate(s * (F.hw(za) - 0.02), P.R, za); dark.push(strip(t)); }
  const tw = 0.23, R = P.R; const { tyre, rim: rimG } = wheelParts(R, tw);
  for (const za of [F.zf, F.zr]) for (const s of [-1, 1]) { const x = s * (F.hw(za) - tw / 2 - 0.015);
    const t = tyre.clone(); t.translate(x, R, za); dark.push(strip(t));
    const r = rimG.clone(); if (s < 0) r.scale(-1, 1, 1); r.translate(x, R, za); alloy.push(r); }
  // lights (vertex colours > 1 bloom at night): headlights, DRL strip, tail light bar
  const quad = (x, y, z, w, h, nz, c, tilt = 0) => { const g = new THREE.PlaneGeometry(w, h); g.rotateX(tilt); if (nz < 0) g.rotateY(PI); g.translate(x, y, z); const s = strip(g); lights.push(s); (c[1] > 1 ? head : tail).push(s); const n = s.attributes.position.count; for (let i = 0; i < n; i++) lightsC.push(...c); };
  const zF = F.hL - 0.06, yH = P.hood - 0.1;
  for (const s of [-1, 1]) { const x = s * (F.hw(zF) - 0.3); quad(x, yH, zF + 0.012, 0.34, 0.1, 1, [2.6, 2.5, 2.2], -0.25); quad(x, yH - 0.07, zF + 0.01, 0.3, 0.025, 1, [2.0, 2.1, 2.4], -0.25); }
  const zT = -F.hL + 0.05, yT = P.tail - 0.14;
  quad(0, yT, zT - 0.012, P.W * 0.82, 0.04, -1, [1.5, 0.06, 0.04], 0.3); for (const s of [-1, 1]) quad(s * (P.W / 2 - 0.28), yT - 0.04, zT - 0.012, 0.36, 0.11, -1, [1.9, 0.08, 0.05], 0.3);
  if (P.sign) { dark.push(box(0.7, 0.06, 0.3, 0, P.roof + 0.04, (P.zRF + P.zRB) / 2)); const sg = new THREE.BoxGeometry(0.66, 0.24, 0.26); sg.translate(0, P.roof + 0.19, (P.zRF + P.zRB) / 2); const s2 = strip(sg); lights.push(s2); for (let i = 0; i < s2.attributes.position.count; i++) lightsC.push(1.15, 1.02, 0.62); }
  const lg = mergeGeometries(lights); lg.setAttribute('color', new THREE.Float32BufferAttribute(lightsC, 3));
  return cache[type] = { P, F, paint: mergeGeometries(paint.map(strip)), glass: glass.length ? mergeGeometries(glass.map(strip)) : null, dark: mergeGeometries(dark), alloy: mergeGeometries(alloy), lights: lg, head: mergeGeometries(head), tail: mergeGeometries(tail) };
}

// tyre (rounded profile) and alloy rim with five spokes, axle along x, outer face toward +x, centred on the origin
export function wheelParts(R, tw = 0.23) {
  const tp = [], ri = R * 0.66;
  for (let i = 0; i <= 8; i++) { const a = i / 8 * PI; tp.push(new THREE.Vector2(ri + (R - ri) * (0.5 + 0.5 * Math.sin(a)) + 0.012 * Math.sin(a), -tw / 2 + tw * (0.5 - 0.5 * Math.cos(a)))); }
  const tyre = new THREE.LatheGeometry(tp, 16); tyre.rotateZ(PI / 2);
  const rimParts = []; const disc = new THREE.CylinderGeometry(ri * 0.98, ri * 0.98, 0.04, 14, 1, false); disc.rotateZ(PI / 2); disc.translate(-0.06, 0, 0); rimParts.push(strip(disc));
  const lip = new THREE.TorusGeometry(ri * 0.97, 0.018, 3, 16); lip.rotateY(PI / 2); lip.translate(0.08, 0, 0); rimParts.push(strip(lip));
  for (let k = 0; k < 5; k++) { const sp = new THREE.BoxGeometry(0.05, ri * 0.92, 0.07); sp.translate(0, ri * 0.46, 0); sp.rotateX(k / 5 * PI * 2); sp.translate(0.07, 0, 0); rimParts.push(strip(sp)); }
  const hub = new THREE.CylinderGeometry(ri * 0.22, ri * 0.25, 0.08, 8); hub.rotateZ(PI / 2); hub.translate(0.08, 0, 0); rimParts.push(strip(hub));
  return { tyre: strip(tyre), rim: mergeGeometries(rimParts) };
}

// shared materials
let MATS = null;
export function carMats() {
  if (MATS) return MATS;
  return MATS = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.18, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 }), // solid paint under clearcoat (white was blowing out in the sun)
    glass: new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: 0.04, metalness: 0.9, envMapIntensity: 1.2 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.78, metalness: 0.05, side: THREE.DoubleSide }),
    alloy: new THREE.MeshStandardMaterial({ color: 0xc9cdd3, roughness: 0.22, metalness: 1, side: THREE.DoubleSide }),
  };
}
