// Shared helpers, materials, procedural textures (no external assets)
import * as THREE from 'three';
export const PI = Math.PI;
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  sph: new THREE.SphereGeometry(1, 12, 8),
  plane: new THREE.PlaneGeometry(1, 1),
  ico: new THREE.IcosahedronGeometry(1, 0),
  dode: new THREE.DodecahedronGeometry(1, 0),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone: new THREE.ConeGeometry(1, 1, 10),
  torus: new THREE.TorusGeometry(1, 0.08, 6, 24),
};
const cache = {};
export function M(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!o.unique && cache[k]) return cache[k];
  const { unique, ...rest } = o;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, ...rest });
  if (!unique) cache[k] = m;
  return m;
}
export function B(color, o = {}) { return new THREE.MeshBasicMaterial({ color, ...o }); }

// --- night system ---
export const nightFx = [];
export function onNight(fn) { nightFx.push(fn); }
export const TODS = { cur: 'night' };
// emissive material that glows at night
export function glow(color, emissive = color, dayI = 0.25, nightI = 1.2, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: nightI, roughness: 0.6, metalness: 0, ...o });
  onNight(n => { m.emissiveIntensity = n ? nightI : dayI; });
  return m;
}
// basic (unlit) material dimmed slightly in daytime
// (values above 1.0 at night feed the bloom pass; ACES tone mapping keeps them from clipping)
export function neon(color, o = {}, day = 0.85, night = 1.35) {
  const m = new THREE.MeshBasicMaterial({ color, ...o });
  const c = new THREE.Color(color);
  onNight(n => { m.color.copy(c).multiplyScalar(n ? night : day); });
  return m;
}
// polished gold / chrome (PBR metals; a touch of emissive keeps them readable at night)
const metalCache = {};
export function goldM(nightE = 0.22, rough = 0.28) {
  const k = 'g' + nightE + rough; if (metalCache[k]) return metalCache[k];
  const m = new THREE.MeshStandardMaterial({ color: 0xe2b356, metalness: 1, roughness: rough, emissive: 0x6a4300, emissiveIntensity: nightE });
  onNight(n => { m.emissiveIntensity = n ? nightE : nightE * 0.25; }); return metalCache[k] = m;
}
export function chromeM(rough = 0.18, color = 0xd8dde4) { const k = 'c' + rough + color; return metalCache[k] || (metalCache[k] = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough })); }

export function add(p, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry;
  p.add(m); return m;
}
// y is the bottom of the box
export function box(p, mat, x, y, z, w, h, d, ry = 0) { return add(p, G.box, mat, x, y + h / 2, z, w, h, d, ry); }
export function cyl(p, mat, x, y, z, r, h, seg) { return add(p, seg === 6 ? G.cyl6 : G.cyl, mat, x, y + h / 2, z, r, h, r); }
export function plane(p, mat, x, y, z, w, h, rx = -PI / 2, ry = 0) {
  const m = new THREE.Mesh(G.plane, mat); m.position.set(x, y, z); m.scale.set(w, h, 1);
  m.rotation.order = 'YXZ'; m.rotation.y = ry; m.rotation.x = rx; p.add(m); return m;
}

export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function tex(c, rep = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export function rep(t, x, y) { const c = t.clone(); c.repeat.set(x, y); c.needsUpdate = true; return c; }

export const T = {};
export function buildTextures() {
  const R = rng(7);
  // tiger stripes
  { const [c, g] = canvas(256, 256); g.fillStyle = '#e8891c'; g.fillRect(0, 0, 256, 256);
    const grd = g.createLinearGradient(0, 0, 256, 0); grd.addColorStop(0, '#f3a43a55'); grd.addColorStop(1, '#c8640a55'); g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#120a04';
    for (let i = 0; i < 14; i++) { const x = i * 19 + R() * 8, w = 4 + R() * 8; g.beginPath(); g.moveTo(x, -10);
      for (let y = 0; y <= 266; y += 22) g.lineTo(x + Math.sin(y * 0.05 + i) * 9 + (R() - .5) * 6, y);
      for (let y = 266; y >= -10; y -= 22) g.lineTo(x + w + Math.sin(y * 0.05 + i) * 9 + (R() - .5) * 4, y);
      g.fill(); }
    T.tiger = tex(c); }
  // book-matched white marble with grey/gold veins and a brass inlay border (512px)
  { const [c, g] = canvas(512, 512); const gr = g.createLinearGradient(0, 0, 512, 512); gr.addColorStop(0, '#f4f0ea'); gr.addColorStop(0.5, '#ebe4da'); gr.addColorStop(1, '#f2ede6'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${150 + R() * 60},${140 + R() * 60},${130 + R() * 50},${R() * 0.06})`; g.beginPath(); g.arc(R() * 512, R() * 512, 4 + R() * 30, 0, 7); g.fill(); }
    for (let i = 0; i < 34; i++) { const gold = R() < 0.18; g.strokeStyle = gold ? `rgba(190,150,70,${0.25 + R() * 0.35})` : `rgba(${90 + R() * 40},${88 + R() * 30},${86 + R() * 30},${0.06 + R() * 0.3})`;
      g.lineWidth = 0.5 + R() * (gold ? 1.6 : 2.6); g.beginPath(); let x = R() * 512, y = R() * 512, a = R() * 6.28; g.moveTo(x, y);
      for (let k = 0; k < 18; k++) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * 22; y += Math.sin(a) * 22; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = '#b8924a'; g.lineWidth = 5; g.strokeRect(2.5, 2.5, 507, 507); g.strokeStyle = '#3a2a14'; g.lineWidth = 1; g.strokeRect(6, 6, 500, 500);
    T.marble = tex(c); }
  // casino carpet (deep red, gold lattice, tiger medallions)
  { const [c, g] = canvas(256, 256); g.fillStyle = '#4a0910'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${R() < 0.5 ? 0 : 120},0,0,${R() * 0.12})`; g.fillRect(R() * 256, R() * 256, 2, 2); }
    g.strokeStyle = '#d29b34'; g.lineWidth = 4; g.beginPath(); g.moveTo(128, 12); g.lineTo(244, 128); g.lineTo(128, 244); g.lineTo(12, 128); g.closePath(); g.stroke();
    g.strokeStyle = '#7a1520'; g.lineWidth = 2; g.beginPath(); g.moveTo(128, 30); g.lineTo(226, 128); g.lineTo(128, 226); g.lineTo(30, 128); g.closePath(); g.stroke();
    g.fillStyle = '#d29b34'; for (const [x, y] of [[0, 0], [256, 0], [0, 256], [256, 256]]) { g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); }
    g.fillStyle = '#e8891c'; g.beginPath(); g.arc(128, 128, 22, 0, 7); g.fill(); g.fillStyle = '#120a04'; for (let k = -2; k <= 2; k++) g.fillRect(124 + k * 8, 110, 3, 36);
    g.strokeStyle = '#ffd77a'; g.lineWidth = 2; g.beginPath(); g.arc(128, 128, 24, 0, 7); g.stroke();
    T.carpet = tex(c); }
  // water
  { const [c, g] = canvas(256, 256); const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, '#1aa6d8'); gr.addColorStop(1, '#0b6fb0'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(220,250,255,${0.15 + R() * 0.3})`; g.lineWidth = 1 + R() * 2; g.beginPath(); const x = R() * 256, y = R() * 256; g.moveTo(x, y); g.quadraticCurveTo(x + 20, y + (R() - .5) * 20, x + 30 + R() * 20, y + (R() - .5) * 10); g.stroke(); }
    T.water = tex(c); }
  // tileable water normal map (sum of integer-frequency waves -> seamless), linear color space
  { const N = 256, [c, g] = canvas(N, N), img = g.createImageData(N, N), H = new Float32Array(N * N), W = [];
    for (let i = 0; i < 14; i++) W.push([Math.round((R() - 0.5) * 14) || 1, Math.round((R() - 0.5) * 14), R() * 6.28, 0.6 / (1 + i * 0.35)]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let h = 0; for (const [a, b, p, A] of W) h += A * Math.sin(6.2832 * (a * x + b * y) / N + p); H[y * N + x] = h; }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = H[y * N + (x + 1) % N] - H[y * N + (x + N - 1) % N], dy = H[((y + 1) % N) * N + x] - H[((y + N - 1) % N) * N + x];
      const nx = -dx * 2.2, ny = -dy * 2.2, l = Math.hypot(nx, ny, 1), o = (y * N + x) * 4; img.data[o] = (nx / l * 0.5 + 0.5) * 255; img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[o + 3] = 255; }
    g.putImageData(img, 0, 0); T.waterN = tex(c, [1, 1], false); }
  // waterfall streaks (alpha)
  { const [c, g] = canvas(64, 256); g.fillStyle = 'rgba(200,235,255,0.55)'; g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.6})`; g.fillRect(R() * 64, R() * 256, 1 + R() * 3, 20 + R() * 80); }
    T.fall = tex(c); }
  // road cross section (x across, y along)
  { const [c, g] = canvas(256, 64); g.fillStyle = '#2b2b2e'; g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.05})`; g.fillRect(R() * 256, R() * 64, 2, 2); }
    g.fillStyle = '#eee'; g.fillRect(4, 0, 3, 64); g.fillRect(249, 0, 3, 64);
    for (const x of [46, 86, 166, 206]) g.fillRect(x, 0, 3, 30);
    g.fillStyle = '#e8c547'; g.fillRect(122, 0, 3, 64); g.fillRect(131, 0, 3, 64);
    T.road = tex(c); }
  // building facade: map (wall+dark windows) and emissive (lit windows)
  { const [c, g] = canvas(128, 128); const [c2, g2] = canvas(128, 128); g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g2.fillStyle = '#000'; g2.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = '#3a4150'; g.fillRect(x * 16 + 3, y * 16 + 3, 10, 10);
      if (R() < 0.55) { g2.fillStyle = R() < 0.8 ? '#ffd98f' : '#bfe4ff'; g2.fillRect(x * 16 + 3, y * 16 + 3, 10, 10); } }
    T.facade = tex(c); T.facadeE = tex(c2); }
  // lion crest
  { const [c, g] = canvas(256, 256); g.translate(128, 128);
    g.fillStyle = '#ffcf4a'; g.beginPath(); for (let i = 0; i < 36; i++) { const a = i / 36 * PI * 2, r = i % 2 ? 92 : 122; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
    g.fillStyle = '#e8891c'; g.beginPath(); g.arc(0, 0, 86, 0, 7); g.fill();
    g.fillStyle = '#ffd77a'; g.beginPath(); g.ellipse(0, 8, 56, 66, 0, 0, 7); g.fill();
    g.fillStyle = '#120a04'; g.beginPath(); g.ellipse(-22, -8, 9, 6, 0.3, 0, 7); g.ellipse(22, -8, 9, 6, -0.3, 0, 7); g.fill();
    g.beginPath(); g.moveTo(-14, 26); g.lineTo(14, 26); g.lineTo(0, 44); g.closePath(); g.fill();
    g.lineWidth = 4; g.strokeStyle = '#120a04'; g.beginPath(); g.moveTo(0, 44); g.lineTo(0, 54); g.moveTo(-16, 60); g.quadraticCurveTo(0, 50, 16, 60); g.stroke();
    g.beginPath(); g.moveTo(-40, -50); g.lineTo(-30, -78); g.lineTo(-14, -56); g.lineTo(0, -84); g.lineTo(14, -56); g.lineTo(30, -78); g.lineTo(40, -50); g.closePath(); g.fillStyle = '#fff1b0'; g.fill();
    T.crest = tex(c); }
  // slot screen
  { const [c, g] = canvas(128, 96); g.fillStyle = '#100018'; g.fillRect(0, 0, 128, 96); g.font = 'bold 30px sans-serif'; g.textAlign = 'center';
    const s = ['7', '♛', '7']; const col = ['#ff3355', '#ffd23a', '#ff3355'];
    s.forEach((t, i) => { g.fillStyle = '#ffffff22'; g.fillRect(6 + i * 40, 20, 36, 50); g.fillStyle = col[i]; g.fillText(t, 24 + i * 40, 58); });
    g.fillStyle = '#ffd23a'; g.font = 'bold 12px sans-serif'; g.fillText("LION'S ROAR", 64, 14); T.slot = tex(c); }
  T.sky = {}; for (const n of [0, 1]) T.sky[n] = skylineTex(n, R);
}
function skylineTex(night, R) {
  const [c, g] = canvas(512, 256); const gr = g.createLinearGradient(0, 0, 0, 256);
  if (night) { gr.addColorStop(0, '#07051a'); gr.addColorStop(1, '#3a1a4a'); } else { gr.addColorStop(0, '#6fb3ee'); gr.addColorStop(1, '#f2d9b0'); }
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 40; i++) { const w = 12 + R() * 30, h = 40 + R() * 170, x = R() * 512; g.fillStyle = night ? '#120e1c' : '#8a8f9c'; g.fillRect(x, 256 - h, w, h);
    for (let y = 256 - h + 4; y < 252; y += 8) for (let xx = x + 2; xx < x + w - 3; xx += 6) if (R() < (night ? 0.5 : 0.2)) { g.fillStyle = night ? (R() < .5 ? '#ffcc66' : '#ff66cc') : '#cfe6ff'; g.fillRect(xx, y, 3, 4); } }
  return tex(c);
}
export function signTex(text, color = '#ffd23a', bg = '#120a04', w = 512, h = 128, sub = '') {
  const [c, g] = canvas(w, h); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = color; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
  let fs = h * (sub ? 0.42 : 0.55); g.font = `900 ${fs}px Georgia, serif`; while (g.measureText(text).width > w - 40) { fs -= 2; g.font = `900 ${fs}px Georgia, serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = color; g.shadowBlur = 14; g.fillStyle = '#fff8e0';
  g.fillText(text, w / 2, sub ? h * 0.4 : h / 2); g.fillStyle = color; g.fillText(text, w / 2, sub ? h * 0.4 : h / 2);
  if (sub) { g.shadowBlur = 6; g.font = `700 ${h * 0.18}px sans-serif`; g.fillText(sub, w / 2, h * 0.76); }
  return tex(c);
}
export function signMesh(p, text, color, x, y, z, w, h, ry = 0, sub = '', bg) {
  const m = neon(0xffffff, { map: signTex(text, color, bg, 512, Math.round(512 * h / w) || 128, sub) });
  const s = plane(p, m, x, y, z, w, h, 0, ry); return s;
}

// ---------- brand logos (single swap-able texture path per logo) ----------
// To swap a logo, replace the PNG at the path below (transparent PNG, any aspect ratio, ~1024px max).
// Every placement re-fits to the real image aspect on load, so nothing is ever stretched.
export const LOGOS = {
  dj: { src: 'assets/images/dj-tileo-logo.png', aspect: 826 / 1000 },     // DJ Tileo: club, billboards, casino, pool, car, elevators
  resort: { src: 'assets/images/resort-logo.png', aspect: 870 / 975 },   // TILEO KINGDOM resort: rooftop crest, lobby, desk, entrance, HUD
};
const logoMat = {}, logoFits = { dj: [], resort: [] };
export const logoReady = {};
export function logoMaterial(k) {
  if (!logoMat[k]) {
    const L = LOGOS[k];
    logoReady[k] = new Promise(res => {
      const t = new THREE.TextureLoader().load(L.src, tt => { L.aspect = tt.image.width / tt.image.height; logoFits[k].forEach(f => f()); res(true); }, undefined, () => res(false));
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      logoMat[k] = new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.03, color: new THREE.Color(1.06, 1.06, 1.06) });
    });
  }
  return logoMat[k];
}
// Logo plane fitted inside a (maxW x h) box, centered at x,y,z, facing +z rotated by ry (rx for flat placements).
// opts.back: color of a backing panel (slightly larger, behind the logo); opts.pad: panel padding.
export function logoPlane(p, k, x, y, z, h, ry = 0, opts = {}) {
  const maxW = opts.maxW || 1e9, g = new THREE.Group(); g.position.set(x, y, z); g.rotation.order = 'YXZ'; g.rotation.y = ry; g.rotation.x = opts.rx || 0; p.add(g);
  const m = new THREE.Mesh(G.plane, logoMaterial(k)); m.position.z = opts.back !== undefined ? 0.04 : 0; g.add(m);
  let back = null; if (opts.back !== undefined) { back = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ color: opts.back })); g.add(back); }
  const pad = opts.pad ?? 0.08;
  const fit = () => { const a = LOGOS[k].aspect; let hh = h, ww = h * a; if (ww > maxW) { ww = maxW; hh = maxW / a; } m.scale.set(ww, hh, 1); if (back) back.scale.set(ww * (1 + pad), hh * (1 + pad), 1); };
  fit(); logoFits[k].push(fit); return g;
}

// ---------- realistic surfaces (generated PBR sets in assets/textures; see tools-src/gen_textures.py) ----------
// pbr(name, repX, repY, opts) -> MeshStandardMaterial with albedo + normal + roughness maps. Textures load once and are shared;
// each material gets its own repeat. opts.detail: keep an existing map (e.g. road markings) and multiply the set's albedo in as
// detail. opts.macro: [scale, amount] breaks up tiling on large areas with a world-space low-frequency brightness variation.
const _tl = new THREE.TextureLoader(), _pbrSrc = {};
export const TEX_DIR = 'assets/textures/';
// linear mean of each albedo (so a detail multiply keeps the base colour)
const PBR_MEAN = { asphalt: 0.041, sidewalk: 0.486, gravel: 0.295, travertine: 0.598, marble: 0.786, carpet: 0.064, concrete: 0.445 };
export function pbrTex(name, kind, srgb = kind === 'd', ext = 'jpg') {
  const k = kind ? name + '_' + kind : name;
  if (!_pbrSrc[k]) { const clones = []; const t = _tl.load(TEX_DIR + k + '.' + ext, () => { t.userData.loaded = true; for (const c of clones) c.needsUpdate = true; });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.clones = clones; _pbrSrc[k] = t; }
  return _pbrSrc[k];
}
// a texture sharing the image of t with its own repeat; it uploads once the image has loaded (no warnings before that)
export function texClone(t, x = 1, y = 1) {
  const c = new THREE.Texture(); c.source = t.source; c.wrapS = t.wrapS; c.wrapT = t.wrapT; c.colorSpace = t.colorSpace; c.anisotropy = t.anisotropy; c.repeat.set(x, y);
  if (t.userData.loaded || (t.image && t.image.complete !== false && t.image.width)) c.needsUpdate = true; else (t.userData.clones || []).push(c);
  return c;
}
const repT = (t, x, y) => texClone(t, x, y);
export function pbr(name, rx = 1, ry = 1, o = {}) {
  const { detail, macro, normalScale = 1, rough = 1, ...rest } = o;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, metalness: 0, ...rest,
    map: detail || repT(pbrTex(name, 'd'), rx, ry), normalMap: repT(pbrTex(name, 'n'), rx, ry), roughnessMap: repT(pbrTex(name, 'r'), rx, ry) });
  m.normalScale.set(normalScale, normalScale);
  if (detail || macro) surfacePatch(m, detail ? { tex: repT(pbrTex(name, 'd'), rx, ry), gain: 1 / (PBR_MEAN[name] || 0.3) } : null, macro);
  return m;
}
// shader patch: detail albedo (sampled with the normal map's UVs) and world-space macro variation
export function surfacePatch(m, det, macro) {
  const u = { tkDetail: { value: det ? det.tex : null }, tkDetailGain: { value: det ? det.gain : 1 }, tkMacro: { value: new THREE.Vector2(macro ? macro[0] : 0.01, macro ? macro[1] : 0) } };
  m.userData.tk = u; const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { prev && prev.call(m, sh, r); Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTkW;').replace('#include <project_vertex>', `#include <project_vertex>
  { vec4 tkw = vec4( transformed, 1.0 ); 
  #ifdef USE_INSTANCING
    tkw = instanceMatrix * tkw;
  #endif
    vTkW = ( modelMatrix * tkw ).xyz; }`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vTkW; uniform sampler2D tkDetail; uniform float tkDetailGain; uniform vec2 tkMacro;
float tkH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tkN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(tkH(i), tkH(i + vec2(1, 0)), f.x), mix(tkH(i + vec2(0, 1)), tkH(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  ${det ? 'diffuseColor.rgb *= texture2D( tkDetail, vNormalMapUv ).rgb * tkDetailGain;' : ''}
  if ( tkMacro.y > 0.0 ) { float tkM = tkN( vTkW.xz * tkMacro.x ) * 0.6 + tkN( vTkW.xz * tkMacro.x * 3.7 + 17.0 ) * 0.4; diffuseColor.rgb *= 1.0 + ( tkM - 0.5 ) * tkMacro.y; }`); };
  m.customProgramCacheKey = () => 'tkSurf' + (det ? 'd' : '') + (macro ? 'm' : '');
  return m;
}
