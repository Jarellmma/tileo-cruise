// Resort grounds along the Strip (v6.2): instead of bare desert sand around the resorts, a landscaped ground layer
// (decorative rock beds, irrigated lawns near the frontage, winding paver walks) with bushes, agaves and extra palms.
// Plants are only placed where nothing else stands: an occupancy grid is rasterised once from the Strip's own geometry,
// so they never grow out of plazas, roads, pools, lakes or buildings.
import * as THREE from 'three';
import { pbrTex, texClone, rng } from './core.js?v=1794015301';
import { palms } from './city.js?v=1794015301';
import { Q } from './quality.js?v=1794015301';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const X0 = -170, X1 = 170, Z0 = -660, Z1 = 660, CELL = 1;
function occupancy(group) {
  const W = Math.ceil((X1 - X0) / CELL), H = Math.ceil((Z1 - Z0) / CELL), occ = new Uint8Array(W * H);
  const v = new THREE.Vector3(); group.updateMatrixWorld(true);
  group.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry || o.userData.noOcc) return;
    const P = o.geometry.attributes.position; if (!P) return; const I = o.geometry.index, m = o.matrixWorld, ident = m.equals(new THREE.Matrix4());
    const n = I ? I.count : P.count, xs = [0, 0, 0], ys = [0, 0, 0], zs = [0, 0, 0];
    for (let t = 0; t < n; t += 3) {
      for (let k = 0; k < 3; k++) { const vi = I ? I.getX(t + k) : t + k; v.fromBufferAttribute(P, vi); if (!ident) v.applyMatrix4(m); xs[k] = v.x; ys[k] = v.y; zs[k] = v.z; }
      if (Math.max(ys[0], ys[1], ys[2]) < 0.04) continue;
      const a = Math.max(0, Math.floor((Math.min(xs[0], xs[1], xs[2]) - X0) / CELL)), b = Math.min(W - 1, Math.floor((Math.max(xs[0], xs[1], xs[2]) - X0) / CELL));
      const c = Math.max(0, Math.floor((Math.min(zs[0], zs[1], zs[2]) - Z0) / CELL)), d = Math.min(H - 1, Math.floor((Math.max(zs[0], zs[1], zs[2]) - Z0) / CELL));
      if (b < a || d < c) continue;
      for (let z = c; z <= d; z++) occ.fill(1, z * W + a, z * W + b + 1);
    }
  });
  const free = (x, z, r = 1) => { const cx = Math.floor((x - X0) / CELL), cz = Math.floor((z - Z0) / CELL);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { const xx = cx + dx, zz = cz + dz; if (xx < 0 || zz < 0 || xx >= W || zz >= H || occ[zz * W + xx]) return false; } return true; };
  return { free };
}
// noise used both on the GPU (ground shader) and the CPU (where plants go), so beds and lawns line up with the plants
const h2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; };
const lawnMask = (x, z) => { const n = vn(x * 0.025, z * 0.025); const near = 1 - Math.min(1, Math.max(0, (Math.abs(x) - 60) / 30)); return (n > 0.56 ? 1 : 0) * near; };

export function buildGrounds(A, cross) {
  const g = A.group;
  // ---- ground layer (two strips, one per side of the road) ----
  const gr = pbrTex('gravel', 'd'), gn = pbrTex('gravel', 'n'), lawnD = pbrTex('lawn', 'd'), paveD = pbrTex('sidewalk', 'd');
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, normalMap: texClone(gn, 148 / 4, 1320 / 4) });
  const U = { tkGravel: { value: gr }, tkLawn: { value: lawnD }, tkPave: { value: paveD } };
  mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTkW;').replace('#include <project_vertex>', '#include <project_vertex>\nvTkW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vTkW; uniform sampler2D tkGravel; uniform sampler2D tkLawn; uniform sampler2D tkPave;
float tkH(vec2 p){ return fract(sin(p.x * 127.1 + p.y * 311.7) * 43758.5453); }
float tkN(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); float a = tkH(i), b = tkH(i + vec2(1, 0)), c = tkH(i + vec2(0, 1)), d = tkH(i + vec2(1, 1)); return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y; }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  { vec2 w = vTkW.xz; float ax = abs( w.x );
    vec3 rock = texture2D( tkGravel, w / 4.0 ).rgb, lawnT = texture2D( tkLawn, w / 3.0 ).rgb, pave = texture2D( tkPave, w / 4.0 ).rgb * vec3( 0.5, 0.46, 0.41 );
    float lg = dot( lawnT, vec3( 0.3, 0.59, 0.11 ) ); vec3 lawn = mix( vec3( lg ), lawnT, 0.78 ) * 0.78;
    vec3 bed = rock * vec3( 0.5, 0.42, 0.36 ), desert = rock * vec3( 0.95, 0.92, 0.88 );
    float lawnM = smoothstep( 0.55, 0.57, tkN( w * 0.025 ) ) * ( 1.0 - smoothstep( 60.0, 90.0, ax ) );
    float pathM = ( 1.0 - smoothstep( 0.006, 0.011, abs( tkN( w * 0.03 + 31.0 ) - 0.5 ) ) ) * ( 1.0 - smoothstep( 90.0, 120.0, ax ) );
    float coverM = smoothstep( 0.58, 0.66, tkN( w * 0.08 + 11.0 ) ) * ( 1.0 - lawnM ) * ( 1.0 - smoothstep( 80.0, 120.0, ax ) );
    float macro = tkN( w * 0.012 + 7.0 );
    vec3 c = mix( bed * ( 0.9 + 0.2 * macro ), lawn, lawnM ); c = mix( c, lawn * 0.6, coverM * 0.85 ); c = mix( c, pave, pathM );
    c = mix( c, desert * ( 0.92 + 0.16 * macro ), smoothstep( 125.0, 160.0, ax ) );
    diffuseColor.rgb = c; }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = 0.95;'); };
  mat.customProgramCacheKey = () => 'tkGrounds';
  for (const sd of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(148, 1320).rotateX(-Math.PI / 2), mat); m.position.set(sd * (22 + 74), -0.06, 0); m.receiveShadow = true; m.userData.noOcc = true; g.add(m); }
  // ---- plants, placed on free ground only ----
  const occ = occupancy(g), R = rng(9090), near = z => cross.some(c => Math.abs(z - c) < 13);
  const bushes = [], agaves = [], extraPalms = [];
  for (let z = -640; z <= 640; z += 2.2) for (const sd of [-1, 1]) for (let x = 24.5; x <= 150; x += 2.2) {
    const px = sd * x + (R() - 0.5) * 1.6, pz = z + (R() - 0.5) * 1.6; if (near(pz)) continue;
    const lawnHere = lawnMask(px, pz) > 0.5, bedDensity = vn(px * 0.05 + 3, pz * 0.05) ;
    const frontage = x < 70 ? 1 : x < 110 ? 0.45 : 0.12;
    if (!lawnHere && bedDensity > 0.52 && R() < 0.7 * frontage) { if (occ.free(px, pz, 1)) bushes.push([px, pz, 0.45 + R() * 0.7]); }
    else if (!lawnHere && bedDensity < 0.3 && R() < 0.06 * frontage) { if (occ.free(px, pz, 1)) agaves.push([px, pz, 0.5 + R() * 0.5]); }
    if (x > 26 && x < 40 && R() < 0.012 && occ.free(px, pz, 2)) extraPalms.push([px, pz, 7 + R() * 5, 0]);
  }
  const cap = Q.key === 'low' ? 500 : Q.key === 'med' ? 1100 : 1800; if (bushes.length > cap) bushes.length = cap;
  // bush: lumpy low-poly blob, darker underneath
  const bg = new THREE.IcosahedronGeometry(1, 1); { const p = bg.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.82 + 0.3 * h2(Math.round(x * 7), Math.round(y * 7 + z * 13));
      p.setXYZ(i, x * k, Math.max(-0.35, y) * k * 0.78 + 0.32, z * k); const s = 0.55 + 0.45 * Math.min(1, (y + 1) / 1.4); cols.push(s, s, s); }
    bg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); bg.computeVertexNormals(); }
  const bm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const bush = new THREE.InstancedMesh(bg, bm, bushes.length), M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const greens = [0x2f5a24, 0x3d6b2a, 0x4a7a33, 0x56622c, 0x6a7a3a, 0x7a3a5a];
  bushes.forEach(([x, z, r], i) => { q.setFromAxisAngle(up, R() * 6.28); M4.compose(p.set(x, -0.05, z), q, s.set(r * (0.9 + R() * 0.4), r, r * (0.9 + R() * 0.4))); bush.setMatrixAt(i, M4); bush.setColorAt(i, col.set(greens[i % 9 === 0 ? 5 : Math.floor(R() * 5)])); });
  bush.castShadow = true; bush.receiveShadow = true; bush.computeBoundingSphere(); g.add(bush);
  // agave / yucca: a rosette of stiff blue-green leaves
  const leaves = []; for (let k = 0; k < 9; k++) { const c = new THREE.ConeGeometry(0.07, 1, 4); c.translate(0, 0.5, 0); c.rotateZ(0.35 + (k % 3) * 0.22); c.rotateY(k / 9 * Math.PI * 2); leaves.push(c); }
  const ag = mergeGeometries(leaves);
  const agave = new THREE.InstancedMesh(ag, new THREE.MeshStandardMaterial({ color: 0x5f8a78, roughness: 0.6 }), agaves.length);
  agaves.forEach(([x, z, r], i) => { q.setFromAxisAngle(up, R() * 6.28); M4.compose(p.set(x, -0.06, z), q, s.set(r, r * 0.9, r)); agave.setMatrixAt(i, M4); });
  agave.castShadow = true; agave.computeBoundingSphere(); g.add(agave);
  if (extraPalms.length) palms(g, extraPalms);
  return { bushes: bushes.length, agaves: agaves.length, palms: extraPalms.length };
}
