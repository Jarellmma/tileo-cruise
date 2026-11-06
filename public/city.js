// Procedural city kit: PBR facade textures (map / night-window emissive / roughness-metalness),
// extruded footprints with real UVs, a merge batcher (few draw calls), and instanced street props.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { canvas, tex, rng, onNight, neon, M, PI , pbrTex, texClone } from './core.js?v=1794000555';
import { Q } from './quality.js?v=1794000555';

// ---------------------------------------------------------------- facade styles
// tw/th: meters covered by one texture tile. cols/rows: window bays and floors per tile.
export const STY = {
  glassBlue: { kind: 'curtain', cols: 8, rows: 12, tw: 16, th: 42, frame: '#b9c3cf', glass: ['#3e6386', '#4a7398', '#35587a', '#5a83a8'], lit: 0.42, litC: ['#ffe2b0', '#fff1d8', '#d8ecff'], gR: 0.05, gM: 0.8, fR: 0.35, fM: 0.85, mull: 3, slab: 5 },
  emerald: { kind: 'curtain', cols: 8, rows: 12, tw: 16, th: 42, frame: '#0b3a26', glass: ['#1c8a5a', '#22a066', '#16784e', '#2aa870'], lit: 0.4, litC: ['#c8ffe0', '#fff0c0', '#e8fff0'], gR: 0.05, gM: 0.85, fR: 0.3, fM: 0.9, mull: 3, slab: 6 },
  goldGlass: { kind: 'curtain', cols: 8, rows: 12, tw: 16, th: 42, frame: '#5a4218', glass: ['#b48c40', '#c69a48', '#9a7634', '#d2a856'], lit: 0.38, litC: ['#ffd590', '#ffe6b8'], gR: 0.06, gM: 0.95, fR: 0.3, fM: 0.95, mull: 2, slab: 5 },
  blackGold: { kind: 'curtain', cols: 9, rows: 12, tw: 18, th: 42, frame: '#b8904a', glass: ['#17151a', '#1d1a20', '#121014', '#24201a'], lit: 0.55, litC: ['#ffc860', '#ffb446', '#ffe0a0'], gR: 0.06, gM: 0.7, fR: 0.25, fM: 1, mull: 3, slab: 4, nightI: 1.5 },
  darkGlass: { kind: 'curtain', cols: 8, rows: 12, tw: 16, th: 42, frame: '#2a3240', glass: ['#1a2230', '#222c3c', '#141a26', '#2a3446'], lit: 0.36, litC: ['#d8ecff', '#fff0d0', '#ffe0a8'], gR: 0.05, gM: 0.8, fR: 0.35, fM: 0.8, mull: 3, slab: 5 },
  cream: { kind: 'punched', cols: 5, rows: 10, tw: 20, th: 32, wall: '#e8d8ba', glass: ['#4a5a6a', '#56677a', '#3e4e60'], ww: 0.5, wh: 0.6, lit: 0.5, litC: ['#ffd9a0', '#ffe7c0', '#ffcf8a'], gR: 0.08, gM: 0.6, fR: 0.85, fM: 0, wash: '#3a2c1c', cornice: 5 },
  white: { kind: 'strip', cols: 4, rows: 10, tw: 16, th: 32, wall: '#f1eee6', glass: ['#3a6290', '#4672a0', '#2f5680'], ww: 0.34, wh: 1, lit: 0.45, litC: ['#ffe9c4', '#fff4dc', '#d8ecff'], gR: 0.05, gM: 0.85, fR: 0.7, fM: 0, wash: '#2c2a30' },
  beige: { kind: 'punched', cols: 6, rows: 10, tw: 18, th: 32, wall: '#dcc49c', glass: ['#5a5048', '#665a50', '#4e463e'], ww: 0.42, wh: 0.62, lit: 0.52, litC: ['#ffd38a', '#ffe2b0'], gR: 0.1, gM: 0.5, fR: 0.85, fM: 0, wash: '#3a2a18', arch: true },
  pink: { kind: 'ribbon', cols: 8, rows: 12, tw: 20, th: 36, wall: '#f4a2c4', glass: ['#3a2a4a', '#4a3458', '#2e2240'], ww: 0.9, wh: 0.55, lit: 0.5, litC: ['#ffd0e8', '#ffe8c8', '#ffc0dc'], gR: 0.06, gM: 0.7, fR: 0.6, fM: 0, wash: '#40142a' },
  concrete: { kind: 'ribbon', cols: 6, rows: 10, tw: 18, th: 32, wall: '#bdb7ac', glass: ['#3a4250', '#465060', '#2e3644'], ww: 0.86, wh: 0.5, lit: 0.42, litC: ['#ffe0b0', '#e8f2ff'], gR: 0.06, gM: 0.7, fR: 0.85, fM: 0, wash: '#1e1c1a' },
  sand: { kind: 'punched', cols: 6, rows: 10, tw: 18, th: 32, wall: '#c9ab84', glass: ['#3a3a44', '#46464e'], ww: 0.55, wh: 0.55, lit: 0.48, litC: ['#ffd9a0', '#ffe9c4'], gR: 0.08, gM: 0.6, fR: 0.85, fM: 0, wash: '#30200f' },
  villa: { kind: 'villa', cols: 4, rows: 3, tw: 14, th: 12, wall: '#e3bf8e', glass: ['#3a2a20'], ww: 0.34, wh: 0.55, lit: 0.6, litC: ['#ffcf80', '#ffdc9c'], gR: 0.2, gM: 0.2, fR: 0.9, fM: 0, wash: '#3a2410' },
  brick: { kind: 'brick', cols: 2, rows: 1, tw: 7, th: 7, wall: '#b4583c', glass: ['#201812'], lit: 0, litC: ['#ffcf80'], gR: 0.9, gM: 0, fR: 0.92, fM: 0, wash: '#2a1008' },
  doge: { kind: 'doge', cols: 6, rows: 1, tw: 18, th: 9, wall: '#f0d2c8', glass: ['#3a2a28'], lit: 0.7, litC: ['#ffcf80'], gR: 0.3, gM: 0, fR: 0.8, fM: 0, wash: '#3a1a14' },
};
const facCache = {};
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }
function drawFacade(key, S, N) {
  const R = rng(key.length * 977 + key.charCodeAt(0) * 13), [c, g] = canvas(N, N), [ce, e] = canvas(N, N), NO = N / 2, [co, o] = canvas(NO, NO);
  const cw = N / S.cols, ch = N / S.rows, sx = NO / N;
  const orm = (x, y, w, h, rough, metal, glass) => { o.fillStyle = `rgb(${glass ? 0 : 255},${Math.round(rough * 255)},${Math.round(metal * 255)})`; o.fillRect(x * sx, y * sx, Math.max(1, w * sx), Math.max(1, h * sx)); };
  const pick = a => a[Math.floor(R() * a.length)];
  // base wall / frame
  const base = S.kind === 'curtain' ? S.frame : S.wall; g.fillStyle = base; g.fillRect(0, 0, N, N); orm(0, 0, N, N, S.fR, S.fM);
  e.fillStyle = '#000'; e.fillRect(0, 0, N, N);
  if (S.kind !== 'curtain') { // plaster/stone grain + floodlight wash in the emissive map
    for (let i = 0; i < N * 3; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.035)' : 'rgba(255,255,255,0.04)'; g.fillRect(R() * N, R() * N, 1 + R() * 3, 1 + R() * 3); }
    if (S.wash) { e.fillStyle = S.wash; e.fillRect(0, 0, N, N); } }
  const glassRect = (x, y, w, h, lit, row) => {
    const gc = pick(S.glass), gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, shade(gc, 1.35)); gr.addColorStop(0.45, gc); gr.addColorStop(1, shade(gc, 0.75));
    g.fillStyle = gr; g.fillRect(x, y, w, h); orm(x, y, w, h, S.gR, S.gM, true);
    if (R() < 0.18) { g.fillStyle = 'rgba(230,220,200,0.35)'; g.fillRect(x, y, w, h * (0.3 + R() * 0.5)); } // daytime blinds
    if (lit) { const lc = pick(S.litC), k = 0.55 + R() * 0.45, eg = e.createLinearGradient(0, y, 0, y + h);
      eg.addColorStop(0, shade(lc, k)); eg.addColorStop(1, shade(lc, k * 0.55)); e.fillStyle = eg; e.fillRect(x, y, w, h);
      if (R() < 0.3) { e.fillStyle = 'rgba(0,0,0,0.65)'; e.fillRect(x, y + h * (0.4 + R() * 0.4), w, h); } // drawn curtain
      if (R() < 0.06) { e.fillStyle = 'rgba(90,140,255,0.6)'; e.fillRect(x + w * 0.2, y + h * 0.3, w * 0.5, h * 0.4); } // TV glow
    } else { e.fillStyle = '#000'; e.fillRect(x, y, w, h); }
  };
  for (let j = 0; j < S.rows; j++) {
    const rowLit = R() < 0.75; // office-style lit floors
    for (let i = 0; i < S.cols; i++) {
      const x = i * cw, y = j * ch, lit = R() < S.lit * (rowLit ? 1.2 : 0.4);
      if (S.kind === 'curtain') { const m = S.mull, sl = S.slab; glassRect(x + m, y + m, cw - m * 2, ch - sl - m, lit, j);
        g.fillStyle = shade(S.glass[0], 0.55); g.fillRect(x, y + ch - sl, cw, sl); orm(x, y + ch - sl, cw, sl, S.fR, S.fM); }
      else if (S.kind === 'punched' || S.kind === 'villa') { const w = cw * S.ww, h = ch * S.wh, x0 = x + (cw - w) / 2, y0 = y + (ch - h) * 0.45;
        g.fillStyle = shade(S.wall, 0.7); g.fillRect(x0 - 2, y0 - 2, w + 4, h + 4); // reveal shadow
        glassRect(x0, y0, w, h, lit, j);
        if (S.arch || S.kind === 'villa') { g.fillStyle = S.wall; g.beginPath(); g.moveTo(x0 - 2, y0 - 2); g.lineTo(x0 + w + 2, y0 - 2); g.lineTo(x0 + w + 2, y0 + w * 0.5); g.arc(x0 + w / 2, y0 + w * 0.5, w / 2, 0, PI, true); g.closePath(); g.fill();
          e.fillStyle = S.wash || '#000'; e.fillRect(x0 - 2, y0 - 2, w + 4, w * 0.5); }
        if (S.kind === 'villa') { g.fillStyle = '#3f6a3a'; g.fillRect(x0 - w * 0.42, y0, w * 0.36, h); g.fillRect(x0 + w * 1.06, y0, w * 0.36, h); }
        g.fillStyle = shade(S.wall, 1.12); g.fillRect(x0 - 4, y0 + h, w + 8, 4); // sill
        if (S.cornice && j % S.cornice === 0) { g.fillStyle = shade(S.wall, 0.82); g.fillRect(0, y + ch - 5, N, 5); } }
      else if (S.kind === 'strip') { const w = cw * S.ww, x0 = x + (cw - w) / 2; glassRect(x0, y, w, ch - 3, lit, j); g.fillStyle = shade(S.glass[0], 0.6); g.fillRect(x0, y + ch - 3, w, 3); }
      else if (S.kind === 'ribbon') { const h = ch * S.wh, y0 = y + (ch - h) * 0.4; glassRect(x + 1, y0, cw - 2, h, lit, j); g.fillStyle = shade(S.wall, 0.85); g.fillRect(x, y0 + h, cw, 3); }
    } }
  if (S.kind === 'brick') { g.fillStyle = S.wall; g.fillRect(0, 0, N, N);
    for (let y = 0; y < N; y += 8) for (let x = (y / 8 % 2) * 8; x < N; x += 16) { g.fillStyle = shade(S.wall, 0.8 + R() * 0.4); g.fillRect(x, y, 15, 7); }
    g.fillStyle = 'rgba(40,20,10,0.5)'; for (const px of [N * 0.12, N * 0.38, N * 0.62, N * 0.88]) g.fillRect(px - 3, 0, 6, N); }
  if (S.kind === 'doge') { // Venetian-gothic diamond brickwork over an arcade of pointed arches
    for (let y = 0; y < N * 0.62; y += 16) for (let x = 0; x < N; x += 16) { g.fillStyle = (x + y) % 32 ? '#f4dcd2' : '#d89a8c'; g.beginPath(); g.moveTo(x + 8, y); g.lineTo(x + 16, y + 8); g.lineTo(x + 8, y + 16); g.lineTo(x, y + 8); g.fill(); }
    for (let i = 0; i < S.cols; i++) { const x = i * cw; glassRect(x + cw * 0.3, N * 0.18, cw * 0.4, N * 0.22, R() < 0.7, 0); g.fillStyle = '#f0e6dc';
      g.fillRect(x, N * 0.62, cw, N * 0.38); g.fillStyle = '#2a1a16'; g.beginPath(); g.moveTo(x + cw * 0.14, N); g.lineTo(x + cw * 0.14, N * 0.78); g.quadraticCurveTo(x + cw * 0.14, N * 0.66, x + cw * 0.5, N * 0.64);
      g.quadraticCurveTo(x + cw * 0.86, N * 0.66, x + cw * 0.86, N * 0.78); g.lineTo(x + cw * 0.86, N); g.fill(); e.fillStyle = '#ffb860'; e.fillRect(x + cw * 0.2, N * 0.8, cw * 0.6, N * 0.2); } }
  // relief: glass sits 12 cm behind the frame/wall; the normal map is derived from the (slightly blurred) glass mask
  const [cn, gn] = canvas(NO, NO); gn.filter = 'blur(1px)'; gn.drawImage(co, 0, 0); gn.filter = 'none';
  const src = gn.getImageData(0, 0, NO, NO).data, nd = gn.createImageData(NO, NO), H = new Float32Array(NO * NO);
  for (let i = 0; i < NO * NO; i++) H[i] = src[i * 4] / 255;
  const at = (x, y) => H[((y + NO) % NO) * NO + ((x + NO) % NO)];
  for (let y = 0; y < NO; y++) for (let x = 0; x < NO; x++) { const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2, L = Math.hypot(dx, dy, 1), i = (y * NO + x) * 4;
    nd.data[i] = (-dx / L * 0.5 + 0.5) * 255; nd.data[i + 1] = (dy / L * 0.5 + 0.5) * 255; nd.data[i + 2] = (1 / L * 0.5 + 0.5) * 255; nd.data[i + 3] = 255; }
  gn.putImageData(nd, 0, 0);
  return { map: tex(c), emi: tex(ce), orm: tex(co, [1, 1], false), nrm: tex(cn, [1, 1], false) };
}
// Interior mapping: every window cell opens onto a room (back wall, side walls, floor, ceiling) traced per pixel, so windows
// have depth from any angle. Rooms are dim by day behind reflective glass, and lit at night in the window's light colour.
export const FACADE_FX = { day: 0.05 };
const facadeU = { tkIntDay: { value: 0.05 } };
function interiorPatch(m, S) {
  const cells = new THREE.Vector2(S.cols, S.rows), cellM = new THREE.Vector2(S.tw / S.cols, S.th / S.rows);
  m.onBeforeCompile = sh => { sh.uniforms.tkCells = { value: cells }; sh.uniforms.tkCellM = { value: cellM }; sh.uniforms.tkIntDay = facadeU.tkIntDay;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec2 tkCells; uniform vec2 tkCellM; uniform float tkIntDay;
float tkHash(vec2 p){ return fract(sin(dot(p, vec2(41.31, 289.17))) * 15731.743); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    float tkGlass = 1.0 - texture2D( roughnessMap, vRoughnessMapUv ).r;
    if ( tkGlass > 0.02 ) {
      vec2 tile = floor( vMapUv ), c = fract( vMapUv ) * tkCells, id = floor( c ) + tile * tkCells; vec2 p = fract( c );
      vec3 V = normalize( vViewPosition );
      vec3 d = -V * tbn; // view ray in tangent space (x along the wall, y up, z out of the wall)
      float D = 4.2;
      vec3 dn = vec3( d.x / tkCellM.x, d.y / tkCellM.y, d.z / D );
      vec3 o = vec3( p, 0.0 );
      float tx = ( ( dn.x > 0.0 ? 1.0 : 0.0 ) - o.x ) / ( abs( dn.x ) > 1e-5 ? dn.x : 1e-5 );
      float ty = ( ( dn.y > 0.0 ? 1.0 : 0.0 ) - o.y ) / ( abs( dn.y ) > 1e-5 ? dn.y : 1e-5 );
      float tz = -1.0 / min( dn.z, -1e-4 );
      float t = min( min( tx, ty ), tz ); vec3 h = o + dn * t;
      float r = tkHash( id ), r2 = tkHash( id + 7.1 );
      vec3 wall = mix( vec3( 0.62, 0.56, 0.48 ), vec3( 0.78, 0.76, 0.72 ), r );
      vec3 col; float lightK;
      if ( t == tz ) { col = wall * 0.85; lightK = 0.75 + 0.25 * smoothstep( 0.0, 1.0, h.y );
        // furniture silhouettes against the back wall
        float fx = step( 0.18 + 0.3 * r2, h.x ) * step( h.x, 0.55 + 0.35 * r2 ) * step( h.y, 0.32 + 0.12 * r );
        col *= 1.0 - 0.55 * fx; }
      else if ( t == tx ) { col = wall * 0.7; lightK = 0.55 + 0.35 * smoothstep( 0.0, 1.0, h.y ); }
      else if ( dn.y < 0.0 ) { col = mix( vec3( 0.32, 0.24, 0.18 ), vec3( 0.42, 0.40, 0.38 ), r2 ); lightK = 0.45 + 0.4 * smoothstep( -1.0, 0.0, h.z ); }
      else { col = vec3( 0.86 ); lightK = 1.0 - 0.6 * length( h.xz - vec2( 0.5, -0.5 ) ); }
      // room light: the window's lit colour (sampled at the cell centre) and a little daylight from outside
      vec2 cuv = tile + ( floor( c ) + 0.5 ) / tkCells;
      vec3 lit = emissive * texture2D( emissiveMap, cuv ).rgb;
      vec3 room = col * ( lit * lightK * 1.25 + vec3( tkIntDay ) * ( 0.35 + 0.65 * smoothstep( -1.0, 0.0, h.z ) ) );
      float F = 0.18 + 0.82 * pow( 1.0 - saturate( dot( normal, V ) ), 5.0 );
      totalEmissiveRadiance = mix( totalEmissiveRadiance, room * ( 1.0 - F ), tkGlass );
    }
  }`); };
  m.customProgramCacheKey = () => 'tkFacadeInt';
}
export function setFacadeDaylight(v) { facadeU.tkIntDay.value = v; }
onNight((n, tod) => setFacadeDaylight(tod === 'day' ? 0.07 : tod === 'sunset' ? 0.04 : 0.004));
export function facade(key) {
  if (facCache[key]) return facCache[key];
  const S = STY[key], N = Q.tier.id === 'low' ? 256 : Q.tier.id === 'high' ? 1024 : 512, t = drawFacade(key, S, N);
  for (const x of [t.map, t.emi, t.orm, t.nrm]) x.repeat.set(1 / S.tw, 1 / S.th);
  const m = new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emi, emissive: 0xffffff, emissiveIntensity: 0, roughnessMap: t.orm, metalnessMap: t.orm, roughness: 1, metalness: 1, normalMap: t.nrm });
  m.normalScale.set(0.9, 0.9); if (Q.tier.id !== 'low') interiorPatch(m, S);
  const nI = (S.nightI || 1.25) * 0.68; onNight((n, tod) => { m.emissiveIntensity = n ? (tod === 'sunset' ? 0.55 : 1) * nI : 0; });
  return facCache[key] = m;
}
export function roofMat() { return M(0x5c5a58, { roughness: 0.92 }); }

// ---------------------------------------------------------------- footprints (x, z point lists)
export function rect(cx, cz, w, d, ry = 0, ch = 0) {
  const hw = w / 2, hd = d / 2, c = Math.min(ch, hw * 0.9, hd * 0.9);
  const p = c ? [[-hw + c, -hd], [hw - c, -hd], [hw, -hd + c], [hw, hd - c], [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c]] : [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  const cs = Math.cos(ry), sn = Math.sin(ry); return p.map(([x, z]) => [cx + x * cs + z * sn, cz - x * sn + z * cs]);
}
export function circle(cx, cz, r, seg = 28, rz = r) { const p = []; for (let i = 0; i < seg; i++) { const a = i / seg * PI * 2; p.push([cx + Math.cos(a) * r, cz + Math.sin(a) * rz]); } return p; }
export function arcBand(cx, cz, r0, r1, a0, a1, seg = 24) { const p = [];
  for (let i = 0; i <= seg; i++) { const a = a0 + (a1 - a0) * i / seg; p.push([cx + Math.cos(a) * r1, cz + Math.sin(a) * r1]); }
  for (let i = seg; i >= 0; i--) { const a = a0 + (a1 - a0) * i / seg; p.push([cx + Math.cos(a) * r0, cz + Math.sin(a) * r0]); } return p; }
export function stadium(cx, cz, len, w, ry = 0, seg = 8) { const p = [], r = w / 2, h = len / 2 - r;
  for (let i = 0; i <= seg; i++) { const a = -PI / 2 + PI * i / seg; p.push([h + Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 0; i <= seg; i++) { const a = PI / 2 + PI * i / seg; p.push([-h + Math.cos(a) * r, Math.sin(a) * r]); }
  const cs = Math.cos(ry), sn = Math.sin(ry); return p.map(([x, z]) => [cx + x * cs + z * sn, cz - x * sn + z * cs]); }
export function inset(pts, k) { let cx = 0, cz = 0; pts.forEach(p => { cx += p[0]; cz += p[1]; }); cx /= pts.length; cz /= pts.length; return pts.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]); }

// ---------------------------------------------------------------- extrusion with meter UVs
export function prismGeo(pts, y0, y1, o = {}) {
  const n = pts.length, taper = o.taper ?? 1, smooth = o.smooth ?? 0.45, uo = o.uo || 0, vo = o.vo || 0;
  let cx = 0, cz = 0, A = 0; pts.forEach(p => { cx += p[0]; cz += p[1]; }); cx /= n; cz /= n;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
  const sg = A > 0 ? 1 : -1, top = pts.map(([x, z]) => [cx + (x - cx) * taper, cz + (z - cz) * taper]);
  const fn = [], len = [], cum = [0];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], ta = top[i];
    const e = V(b[0] - a[0], 0, b[1] - a[1]), u = V(ta[0] - a[0], y1 - y0, ta[1] - a[1]); len.push(e.length()); cum.push(cum[i] + len[i]);
    const hz = V(sg * e.z, 0, -sg * e.x).normalize(); const nn = new THREE.Vector3().crossVectors(u, e).normalize(); if (nn.dot(hz) < 0) nn.negate(); fn.push(nn); }
  const pos = [], nor = [], uv = [];
  const vn = (i, side) => { const f = fn[i], adj = fn[(i + (side ? 1 : n - 1)) % n]; return f.angleTo(adj) < smooth ? f.clone().add(adj).normalize() : f; };
  for (let i = 0; i < n; i++) { if (len[i] < 1e-4) continue; const a = pts[i], b = pts[(i + 1) % n], ta = top[i], tb = top[(i + 1) % n];
    const na = vn(i, 0), nb = vn(i, 1), u0 = cum[i] + uo, u1 = cum[i] + len[i] + uo;
    const P = [[a[0], y0, a[1], na, u0, y0 + vo], [b[0], y0, b[1], nb, u1, y0 + vo], [tb[0], y1, tb[1], nb, u1, y1 + vo], [ta[0], y1, ta[1], na, u0, y1 + vo]];
    const t1 = V(P[1][0] - P[0][0], P[1][1] - P[0][1], P[1][2] - P[0][2]), t2 = V(P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]);
    const ord = new THREE.Vector3().crossVectors(t1, t2).dot(fn[i]) > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const k of ord) { const p = P[k]; pos.push(p[0], p[1], p[2]); nor.push(p[3].x, p[3].y, p[3].z); uv.push(p[4], p[5]); } }
  const wall = new THREE.BufferGeometry(); wall.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wall.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); wall.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  let cap = null;
  if (o.cap !== false) { const tris = THREE.ShapeUtils.triangulateShape(top.map(p => new THREE.Vector2(p[0], p[1])), []); const cp = [], cn = [], cu = [];
    for (const t of tris) { const [a, b, c] = t.map(k => top[k]); const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); // >0 means normal -y when z is depth
      const tri = cr > 0 ? [a, c, b] : [a, b, c]; for (const p of tri) { cp.push(p[0], y1, p[1]); cn.push(0, 1, 0); cu.push(p[0] / 4, p[1] / 4); } }
    cap = new THREE.BufferGeometry(); cap.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cap.setAttribute('normal', new THREE.Float32BufferAttribute(cn, 3)); cap.setAttribute('uv', new THREE.Float32BufferAttribute(cu, 2)); }
  return { wall, cap };
}

// ---------------------------------------------------------------- batcher: merge by material
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function norm(g) { let x = g.index ? g.toNonIndexed() : g; if (x === g) x = g.clone();
  for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv'].includes(k)) x.deleteAttribute(k);
  if (!x.attributes.normal) x.computeVertexNormals();
  if (!x.attributes.uv) x.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); x.morphAttributes = {}; return x; }
export class Batch {
  constructor() { this.map = new Map(); }
  add(mat, geo) { if (!geo) return; if (!this.map.has(mat)) this.map.set(mat, []); this.map.get(mat).push(norm(geo)); }
  prism(mat, roof, pts, y0, y1, o = {}) { const r = prismGeo(pts, y0, y1, o); this.add(mat, r.wall); if (roof && r.cap) this.add(roof, r.cap); return r; }
  // generic primitive: geometry centered like three's, placed by center position
  geo(mat, geometry, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) { const g = geometry.clone(); _e.set(rx, ry, rz, 'YXZ'); _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz)); g.applyMatrix4(_m); this.add(mat, g); return g; }
  box(mat, x, y, z, w, h, d, ry = 0) { return this.geo(mat, BOX, x, y + h / 2, z, w, h, d, ry); } // y = bottom
  cyl(mat, x, y, z, r, h, seg = 16, rt = r) { const g = new THREE.CylinderGeometry(rt, r, h, seg); g.translate(x, y + h / 2, z); this.add(mat, g); }
  flush(parent, cast = true, receive = true) { const out = [];
    for (const [mat, list] of this.map) { const g = mergeGeometries(list, false); if (!g) continue; g.computeBoundingSphere(); const m = new THREE.Mesh(g, mat);
      m.castShadow = cast && !mat.transparent && !(mat.isMeshBasicMaterial); m.receiveShadow = receive && !mat.isMeshBasicMaterial; m.matrixAutoUpdate = false; m.updateMatrix(); parent.add(m); out.push(m); list.forEach(x => x.dispose()); }
    this.map.clear(); return out; }
}
const BOX = new THREE.BoxGeometry(1, 1, 1);

// ---------------------------------------------------------------- textures for street kit
const ST = {};
function gradTex(inner, outer = 'rgba(0,0,0,0)', N = 128) { const [c, g] = canvas(N, N); const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2); gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, N, N); return tex(c); }
export function streetTex() {
  if (ST.road) return ST; const R = rng(21);
  { const [c, g] = canvas(1024, 512); g.scale(2, 2); g.fillStyle = '#3c3c3e'; g.fillRect(0, 0, 512, 256); // 28 m across x 14 m along
    for (let i = 0; i < 9000; i++) { const v = R(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${R() * 0.18})` : `rgba(200,200,200,${R() * 0.07})`; g.fillRect(R() * 512, R() * 256, 1 + R() * 2, 1 + R() * 2); }
    const px = m => (m + 14) / 28 * 512;
    for (const lane of [-12.4, -8, -3.6, 3.6, 8, 12.4]) { const gr = g.createLinearGradient(px(lane - 1.6), 0, px(lane + 1.6), 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(10,10,10,0.25)'); gr.addColorStop(0.5, 'rgba(60,60,60,0.08)'); gr.addColorStop(0.7, 'rgba(10,10,10,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(px(lane - 1.6), 0, px(lane + 1.6) - px(lane - 1.6), 256); }
    for (let i = 0; i < 6; i++) { const v = R() < 0.5 ? 26 : 52; g.fillStyle = `rgba(${v},${v},${v + 2},0.35)`; g.fillRect(R() * 512, R() * 256, 20 + R() * 60, 10 + R() * 40); } // neutral asphalt patches
    g.fillStyle = '#e8e6df'; for (const x of [-13.6, 13.6]) g.fillRect(px(x) - 3, 0, 6, 256);
    for (const x of [-10.2, -5.8, 5.8, 10.2]) { g.fillRect(px(x) - 2.5, 0, 5, 55); g.fillRect(px(x) - 2.5, 128, 5, 55); }
    g.fillStyle = '#e8c547'; for (const x of [-1.5, 1.5]) g.fillRect(px(x) - 2.5, 0, 5, 256);
    ST.road = tex(c); }
  { const [c, g] = canvas(256, 64); g.clearRect(0, 0, 256, 64); g.fillStyle = 'rgba(240,238,230,0.95)'; for (let x = 4; x < 256; x += 18) g.fillRect(x, 6, 9, 52); ST.cross = tex(c); }
  { const [c, g] = canvas(256, 256); g.fillStyle = '#c8bfb0'; g.fillRect(0, 0, 256, 256); // sidewalk pavers
    for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 32) { g.fillStyle = `rgb(${190 + R() * 30},${180 + R() * 28},${165 + R() * 25})`; g.fillRect(x + 1, y + 1, 30, 30); }
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${R() * 0.08})`; g.fillRect(R() * 256, R() * 256, 2, 2); } ST.paver = tex(c); }
  { const [c, g] = canvas(256, 256); g.fillStyle = '#c4a57c'; g.fillRect(0, 0, 256, 256); // desert sand / caliche
    for (let i = 0; i < 6000; i++) { const v = R(); g.fillStyle = v < 0.4 ? `rgba(90,60,30,${R() * 0.15})` : v < 0.8 ? `rgba(255,240,210,${R() * 0.12})` : `rgba(120,110,90,${R() * 0.3})`; g.fillRect(R() * 256, R() * 256, 1 + R() * 3, 1 + R() * 3); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(110,120,70,${0.2 + R() * 0.3})`; g.beginPath(); g.arc(R() * 256, R() * 256, 1 + R() * 3, 0, 7); g.fill(); } ST.sand = tex(c); }
  { const [c, g] = canvas(64, 256); const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, '#5a3e24'); gr.addColorStop(0.5, '#8a6a46'); gr.addColorStop(1, '#4a321c'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); // palm trunk
    for (let y = 0; y < 256; y += 10) { g.fillStyle = 'rgba(30,18,8,0.55)'; g.fillRect(0, y, 64, 3); g.fillStyle = 'rgba(200,170,120,0.25)'; g.fillRect(0, y + 3, 64, 2); } ST.trunk = tex(c); }
  { const [c, g] = canvas(256, 64); g.clearRect(0, 0, 256, 64); // palm frond: rachis + leaflets, alpha-tested
    for (let i = 0; i < 46; i++) { const x = 6 + i * 5.3, L = 26 * Math.sin(Math.min(1, (i + 3) / 46) * PI) + 4; for (const s of [-1, 1]) { g.strokeStyle = `rgb(${40 + R() * 30},${100 + R() * 50},${40 + R() * 25})`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 7, 32 + s * L); g.stroke(); } }
    g.strokeStyle = '#6a7a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 32); g.lineTo(256, 32); g.stroke(); ST.frond = tex(c); }
  ST.pool = gradTex('rgba(255,200,130,0.55)'); ST.head = gradTex('rgba(255,250,230,0.5)'); ST.soft = gradTex('rgba(255,255,255,1)');
  { const [c, g] = canvas(8, 128); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.9)'); g.fillStyle = gr; g.fillRect(0, 0, 8, 128); ST.beam = tex(c); }
  return ST;
}

// ---------------------------------------------------------------- palms (instanced, curved trunks, alpha-tested fronds)
let palmGeo = null;
function buildPalmGeo() {
  const trunk = new THREE.CylinderGeometry(0.2, 0.34, 1, 8, 10, true); trunk.translate(0, 0.5, 0);
  const p = trunk.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.9 * y * y); } trunk.computeVertexNormals();
  const fronds = [];
  for (let i = 0; i < 11; i++) { const f = new THREE.PlaneGeometry(4.4, 1.6, 8, 2); const fp = f.attributes.position;
    for (let k = 0; k < fp.count; k++) { const x = fp.getX(k) + 2.2, y = fp.getY(k); fp.setXYZ(k, x, -0.11 * x * x + Math.abs(y) * 0.35 + 0.3 * x, y); }
    f.computeVertexNormals(); f.rotateZ(i % 2 ? 0.12 : -0.18); f.rotateY(i / 11 * PI * 2 + (i % 3) * 0.2); fronds.push(f); }
  const nuts = new THREE.IcosahedronGeometry(0.42, 0); nuts.translate(0, -0.25, 0);
  const crown = mergeGeometries(fronds.map(norm)); return { trunk, crown, nuts };
}
export function palms(parent, list) {
  palmGeo ||= buildPalmGeo(); const S = streetTex(), n = list.length;
  const tt = (k, s) => texClone(pbrTex('trunk', k, s), 1, 5);
  const trunkM = new THREE.MeshStandardMaterial({ map: tt('d', true), normalMap: tt('n', false), roughness: 0.92 });
  const ft = pbrTex('frond', '', true, 'png'); const frondM = new THREE.MeshStandardMaterial({ map: ft, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.68, alphaToCoverage: !!Q.tier.msaa });
  const tr = new THREE.InstancedMesh(palmGeo.trunk, trunkM, n), lf = new THREE.InstancedMesh(palmGeo.crown, frondM, n), nu = new THREE.InstancedMesh(palmGeo.nuts, M(0x4a3a1a), n);
  const R = rng(n * 7 + 3), m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  list.forEach(([x, z, h = 9, y = 0], i) => { const ry = R() * PI * 2, k = 0.9 + R() * 0.25; q.setFromAxisAngle(up, ry);
    m.compose(p.set(x, y, z), q, s.set(k, h, k)); tr.setMatrixAt(i, m);
    const ox = 0.9 * k, tx = x + Math.cos(ry) * ox, tz = z - Math.sin(ry) * ox; q.setFromAxisAngle(up, R() * PI * 2);
    m.compose(p.set(tx, y + h, tz), q, s.set(k * (0.9 + h / 30), k, k * (0.9 + h / 30))); lf.setMatrixAt(i, m); nu.setMatrixAt(i, m); });
  for (const x of [tr, lf, nu]) { x.castShadow = true; x.receiveShadow = x !== lf; x.computeBoundingSphere(); parent.add(x); }
  return [tr, lf];
}

// ---------------------------------------------------------------- traffic cars (4 instanced draw calls)
export function carKitGeo() {
  const prof = [[-2.25, 0.32], [2.25, 0.32], [2.3, 0.6], [2.15, 0.82], [1.05, 0.98], [0.35, 1.42], [-0.95, 1.44], [-1.65, 1.0], [-2.28, 0.92]];
  const sh = new THREE.Shape(prof.map(([x, y]) => new THREE.Vector2(x, y)));
  const body = new THREE.ExtrudeGeometry(sh, { depth: 1.76, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 1 });
  body.translate(0, 0, -0.88); body.rotateY(-PI / 2);
  const gp = [[1.02, 1.0], [0.36, 1.45], [-0.96, 1.47], [-1.62, 1.02]]; const gs = new THREE.Shape(gp.map(([x, y]) => new THREE.Vector2(x, y)));
  const glass = new THREE.ExtrudeGeometry(gs, { depth: 1.84, bevelEnabled: false }); glass.translate(0, 0, -0.92); glass.rotateY(-PI / 2);
  const w = []; for (const x of [-0.9, 0.9]) for (const z of [-1.45, 1.4]) { const c = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12); c.rotateZ(PI / 2); c.translate(x, 0.36, z); w.push(norm(c)); }
  const wheels = mergeGeometries(w);
  const lp = [], lc = []; const quad = (x, y, z, w2, h2, dz, col) => { const pts = [[x - w2, y - h2], [x + w2, y - h2], [x + w2, y + h2], [x - w2, y - h2], [x + w2, y + h2], [x - w2, y + h2]];
    for (const [a, b] of (dz > 0 ? pts : pts.map(([a, b]) => [a, b]).reverse())) { lp.push(a, b, z); lc.push(...col); } };
  for (const x of [-0.65, 0.65]) { quad(x, 0.68, 2.36, 0.26, 0.09, 1, [4, 3.8, 3.2]); quad(x, 0.8, -2.37, 0.3, 0.08, -1, [3.5, 0.15, 0.1]); }
  const lights = new THREE.BufferGeometry(); lights.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lights.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
  return { body, glass, wheels, lights };
}
export { gradTex };
