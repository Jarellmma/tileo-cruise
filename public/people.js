// Realistic people: Microsoft Rocketbox avatars (MIT) driven by the game's own rigged skeleton.
// Every character keeps its Quaternius rig and Universal Animation Library clips (walk, run, swim, drive, sit, dance, emotes,
// the selfie arm). Each frame the rig's bone rotations are retargeted onto a Rocketbox body: per bone we take the rig's
// world-space rotation delta from its bind pose and apply it to the Rocketbox bind pose, after aligning each limb's rest
// direction (T-pose vs A-pose). Fingers follow too. The rig's own meshes are hidden while the realistic body is shown.
// Outfits: the "custom" bases have a garment mask (R skin, G top, B bottom), so tops and bottoms are recoloured at runtime
// (solid colours, tiger print, gold sequins) and the body's skin is matched to the chosen face. Faces share one UV layout
// per sex, so any face works on any body of that sex. Smile and blink use the Rocketbox face bones.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PEOPLE_BASES } from './people_data.js?v=1793988736';

export const PEOPLE_DIR = 'assets/people/';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Quaternius (UAL) bone -> Rocketbox (Bip01_*) bone; primary child for the rest-direction alignment
const MAP = [
  ['pelvis', 'Pelvis', null], ['spine_01', 'Spine', 'spine_02'], ['spine_02', 'Spine1', 'spine_03'], ['spine_03', 'Spine2', 'neck_01'], ['neck_01', 'Neck', 'Head'], ['Head', 'Head', null],
  ['clavicle_l', 'L_Clavicle', 'upperarm_l'], ['upperarm_l', 'L_UpperArm', 'lowerarm_l'], ['lowerarm_l', 'L_Forearm', 'hand_l'], ['hand_l', 'L_Hand', 'middle_01_l'],
  ['clavicle_r', 'R_Clavicle', 'upperarm_r'], ['upperarm_r', 'R_UpperArm', 'lowerarm_r'], ['lowerarm_r', 'R_Forearm', 'hand_r'], ['hand_r', 'R_Hand', 'middle_01_r'],
  ['thigh_l', 'L_Thigh', 'calf_l'], ['calf_l', 'L_Calf', 'foot_l'], ['foot_l', 'L_Foot', 'ball_l'], ['ball_l', 'L_Toe0', null],
  ['thigh_r', 'R_Thigh', 'calf_r'], ['calf_r', 'R_Calf', 'foot_r'], ['foot_r', 'R_Foot', 'ball_r'], ['ball_r', 'R_Toe0', null],
];
for (const s of ['l', 'r']) { const S = s.toUpperCase();
  for (const [q, rb] of [['thumb', '0'], ['index', '1'], ['middle', '2'], ['ring', '3'], ['pinky', '4']]) {
    MAP.push([`${q}_01_${s}`, `${S}_Finger${rb}`, `${q}_02_${s}`], [`${q}_02_${s}`, `${S}_Finger${rb}1`, `${q}_03_${s}`], [`${q}_03_${s}`, `${S}_Finger${rb}2`, `${q}_04_leaf_${s}`]); } }

// ---------------------------------------------------------------- looks
export const FACES = { m: ['malea12', 'malea04', 'mtank', 'malea09', 'malea17', 'malea16', 'mpolo', 'malea08'], f: ['businessf01', 'femalep02', 'ftank', 'femalea03', 'ftee', 'sportsf02', 'fbikini', 'femalea12'] };
export const FACE_NAMES = { malea12: 'Kofi', malea04: 'Dale', mtank: 'Marco', malea09: 'Jake', malea17: 'Rafa', malea16: 'Sven', mpolo: 'Leo', malea08: 'Tom',
  businessf01: 'Grace', femalep02: 'Mia', ftank: 'Sofia', femalea03: 'Ava', ftee: 'Emma', sportsf02: 'Zoe', fbikini: 'Lily', femalea12: 'Nina' };
export const GLASSES = [['', 'None'], ['aviator', 'Aviators'], ['round', 'Round shades']];
const CUTS = { m: { tank: 'mtank', polo: 'mpolo' }, f: { tank: 'ftank', tee: 'ftee' } };
const BOTTOMS = ['#2b3a55', '#1d1d20', '#d6c6a4', '#4f6276', '#f2efe8', '#3a2c22'];
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const srgbLum = hex => { const c = new THREE.Color(hex); return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; };
// nearest face (by skin tone) for looks saved before faces existed
export function faceFor(look) {
  const sex = look.body === 'm' ? 'm' : 'f'; if (look.face && PEOPLE_BASES[look.face] && PEOPLE_BASES[look.face].sex === sex) return look.face;
  const want = new THREE.Color(look.skin || '#d9a47c'); let best = FACES[sex][0], bd = 1e9; const salt = hashStr((look.name || '') + (look.hair || '') + (look.outfit || '')) * 0.02;
  for (const f of FACES[sex]) { const s = PEOPLE_BASES[f].skin; const d = (s[0] - want.r) ** 2 + (s[1] - want.g) ** 2 + (s[2] - want.b) ** 2 + salt * hashStr(f); if (d < bd) { bd = d; best = f; } }
  return best;
}
// the game's look -> a realistic look { b: base, f: face, bd: beard, t/o: top/bottom colour, tp/bp: 'tiger' | 'gold' | '', g: glasses }
export function realLook(look) {
  const sex = look.body === 'm' ? 'm' : 'f', st = look.style || 'solid', out = look.outfit || '#c9932e', h = hashStr(JSON.stringify([look.skin, look.hair, look.outfit, look.style, look.name, look.seed]));
  if (look.role === 'business') return { b: sex === 'm' ? 'businessm04' : 'businessf01', f: '', bd: 0, t: '', o: '', tp: '', bp: '', g: look.glasses || '' };
  if (look.fixed && PEOPLE_BASES[look.fixed] && PEOPLE_BASES[look.fixed].sex === sex) return { b: look.fixed, f: '', bd: 0, t: '', o: '', tp: '', bp: '', g: look.glasses || '' };
  const face = faceFor(look), bd = sex === 'm' && look.beard ? (look.beardLevel || 70) : 0;
  let b, t = out, o = BOTTOMS[Math.floor(h * BOTTOMS.length)], tp = '', bp = '';
  const cut = look.cut && CUTS[sex][look.cut] ? CUTS[sex][look.cut] : look.name !== undefined ? CUTS[sex].tank : (h < 0.5 ? CUTS[sex].tank : CUTS[sex][sex === 'm' ? 'polo' : 'tee']);
  if (st === 'swim') { b = sex === 'm' ? 'mtrunks' : 'fbikini'; t = out; o = out; }
  else if (st === 'white') { b = sex === 'm' ? 'mpolo' : 'ftank'; t = '#e8e5de'; o = '#e2dfd8'; }
  else if (st === 'tiger') { b = sex === 'm' ? 'mpolo' : 'ftank'; t = '#ffffff'; tp = 'tiger'; o = sex === 'f' ? '#ffffff' : '#141416'; bp = sex === 'f' ? 'tiger' : ''; }
  else if (st === 'gold') { b = sex === 'm' ? 'mpolo' : 'ftank'; t = '#e9b949'; tp = 'gold'; o = '#111113'; }
  else { b = cut; if (srgbLum(t) > 0.8 && srgbLum(o) > 0.7) o = '#2b3a55'; }
  return { b, f: face, bd, t, o, tp, bp, g: look.glasses || '' };
}
const lookKey = (L, size, n) => [L.b, L.f, L.bd, L.t, L.o, L.tp, L.bp, size, n ? 'n' : ''].join('|');

// ---------------------------------------------------------------- loading and textures
const AV = { glb: {}, img: {}, looks: {}, prints: {}, maxAniso: 4 };
const loader = new GLTFLoader();
export const peopleSupported = () => typeof fetch === 'function';
function loadGLB(id) { return AV.glb[id] || (AV.glb[id] = new Promise((res, rej) => loader.load(PEOPLE_DIR + id + '.glb', res, undefined, rej)).catch(e => { delete AV.glb[id]; throw e; })); }
function loadImg(file) { return AV.img[file] || (AV.img[file] = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img ' + file)); im.src = PEOPLE_DIR + file; }).catch(e => { delete AV.img[file]; throw e; })); }
const _L2 = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; _L2[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const _S2 = new Uint8ClampedArray(4097); for (let i = 0; i <= 4096; i++) { const c = i / 4096; _S2[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); }
const toS = v => _S2[v >= 1 ? 4096 : v <= 0 ? 0 : (v * 4096) | 0];
const linOf = hex => { const c = parseInt(hex.slice(1), 16); return [_L2[c >> 16 & 255], _L2[c >> 8 & 255], _L2[c & 255]]; };
const linArr = a => a.map(v => _L2[Math.round(v * 255)]);
function canvasOf(img, size) { const cv = document.createElement('canvas'); cv.width = cv.height = size; cv.getContext('2d').drawImage(img, 0, 0, size, size); return cv; }
function texOf(src, srgb = true) { const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src); t.needsUpdate = true; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = AV.maxAniso; return t; }
// prints painted into the garment areas (tiled in texture space)
let tigerSrc = null; export function setTigerSource(canvasOrImage) { tigerSrc = canvasOrImage; }
function printData(kind, size) {
  const src = kind === 'tropical' ? AV.img['print_tropical.jpg'] && AV.img._tropical : tigerSrc; if (!src) return null;
  const pc = document.createElement('canvas'); pc.width = pc.height = size; const pg = pc.getContext('2d'); const rep = Math.max(2, Math.round(size / (kind === 'tiger' ? 220 : 170)));
  for (let y = 0; y < rep; y++) for (let x = 0; x < rep; x++) pg.drawImage(src, x * size / rep, y * size / rep, size / rep, size / rep);
  return pg.getImageData(0, 0, size, size).data;
}
async function bodyTexture(L, size) {
  const b = PEOPLE_BASES[L.b], face = L.f ? PEOPLE_BASES[L.f] : null;
  const img = await loadImg(b.id + '_b.jpg');
  const skin = face && face.id !== b.id, top = L.t && b.mask && b.topRef, bot = L.o && b.mask && b.botRef;
  if (!skin && !top && !bot) return size >= img.width ? img : canvasOf(img, size);
  const mask = await loadImg(b.id + '_m.png');
  const cv = canvasOf(img, size), g = cv.getContext('2d'), D = g.getImageData(0, 0, size, size), d = D.data;
  const M = canvasOf(mask, size).getContext('2d').getImageData(0, 0, size, size).data;
  const TP = L.tp === 'tiger' ? printData('tiger', size) : null, BP = L.bp === 'tiger' ? printData('tiger', size) : null;
  const sr = skin ? linArr(face.skin).map((v, i) => v / Math.max(1e-4, linArr(b.skin)[i])) : null;
  const tc = top ? linOf(L.t) : null, bc = bot ? linOf(L.o) : null;
  for (let i = 0; i < d.length; i += 4) {
    let r = _L2[d[i]], gg = _L2[d[i + 1]], bb = _L2[d[i + 2]];
    const ms = M[i] / 255, mt = M[i + 1] / 255, mb = M[i + 2] / 255;
    if (sr && ms > 0.01) { r += (r * sr[0] - r) * ms; gg += (gg * sr[1] - gg) * ms; bb += (bb * sr[2] - bb) * ms; }
    if (tc && mt > 0.01) { const sh = Math.pow(Math.min(1.6, (0.2126 * r + 0.7152 * gg + 0.0722 * bb) / b.topRef), 0.85);
      const c0 = TP ? _L2[TP[i]] : tc[0], c1 = TP ? _L2[TP[i + 1]] : tc[1], c2 = TP ? _L2[TP[i + 2]] : tc[2];
      r += (c0 * sh - r) * mt; gg += (c1 * sh - gg) * mt; bb += (c2 * sh - bb) * mt; }
    if (bc && mb > 0.01) { const sh = Math.pow(Math.min(1.6, (0.2126 * r + 0.7152 * gg + 0.0722 * bb) / b.botRef), 0.85);
      const c0 = BP ? _L2[BP[i]] : bc[0], c1 = BP ? _L2[BP[i + 1]] : bc[1], c2 = BP ? _L2[BP[i + 2]] : bc[2];
      r += (c0 * sh - r) * mb; gg += (c1 * sh - gg) * mb; bb += (c2 * sh - bb) * mb; }
    d[i] = toS(r); d[i + 1] = toS(gg); d[i + 2] = toS(bb);
  }
  g.putImageData(D, 0, 0); return cv;
}
async function headTexture(L, size) {
  const fid = L.f || L.b, img = await loadImg(fid + '_h.jpg');
  if (!(L.bd > 0)) return size >= img.width ? img : canvasOf(img, size);
  const beard = await loadImg('beard.png');
  const cv = canvasOf(img, size), g = cv.getContext('2d');
  const bc = document.createElement('canvas'); bc.width = bc.height = size; const bg = bc.getContext('2d');
  bg.drawImage(beard, 0, 0, size, size); const B = bg.getImageData(0, 0, size, size), bd = B.data;
  for (let i = 0; i < bd.length; i += 4) { const a = bd[i]; bd[i] = 20; bd[i + 1] = 14; bd[i + 2] = 11; bd[i + 3] = a; }
  bg.putImageData(B, 0, 0); g.globalAlpha = clamp(L.bd / 100, 0, 1); g.drawImage(bc, 0, 0); g.globalAlpha = 1; return cv;
}
async function cardsTexture(L) {
  const b = PEOPLE_BASES[L.b]; if (!b.cards) return null;
  const img = await loadImg(b.id + '_o.png'); const face = L.f ? PEOPLE_BASES[L.f] : null;
  if (!face || face.id === b.id) return img;
  const cv = canvasOf(img, img.width), g = cv.getContext('2d'), D = g.getImageData(0, 0, cv.width, cv.height), d = D.data;
  const s = linArr(b.cards), t = linArr(face.hair), k = [0, 1, 2].map(i => t[i] / Math.max(1e-4, s[i]));
  for (let i = 0; i < d.length; i += 4) { d[i] = toS(_L2[d[i]] * k[0]); d[i + 1] = toS(_L2[d[i + 1]] * k[1]); d[i + 2] = toS(_L2[d[i + 2]] * k[2]); }
  g.putImageData(D, 0, 0); return cv;
}
// gold sequins: the top area (mask G) turns metallic with glittering flakes
function sequinPatch(m, maskTex) {
  m.onBeforeCompile = sh => { sh.uniforms.tkMask = { value: maskTex };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tkMask; float tkSq(vec2 p){ return fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453); }')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  float tkTop = texture2D( tkMask, vMapUv ).g; float tkF = tkSq( vMapUv * 900.0 );\n  roughnessFactor = mix( roughnessFactor, 0.22 + 0.25 * tkF, tkTop );')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n  metalnessFactor = mix( metalnessFactor, 0.9, tkTop );')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * tkTop * pow( tkF, 24.0 ) * 1.6;'); };
  m.customProgramCacheKey = () => 'tkSequin';
}
function lookMaterials(L, size, normals) {
  const key = lookKey(L, size, normals);
  if (AV.looks[key]) { AV.looks[key].refs++; return AV.looks[key].p; }
  const b = PEOPLE_BASES[L.b], fid = L.f || L.b;
  const p = Promise.all([bodyTexture(L, size), headTexture(L, size), cardsTexture(L),
    normals ? loadImg(b.id + '_bn.jpg') : null, normals ? loadImg(fid + '_hn.jpg').catch(() => loadImg(b.id + '_hn.jpg')) : null, L.tp === 'gold' ? loadImg(b.id + '_m.png') : null]).then(([bt, ht, ct, bn, hn, mk]) => {
    const body = new THREE.MeshStandardMaterial({ map: texOf(bt), normalMap: bn ? texOf(bn, false) : null, roughness: 0.8, metalness: 0 });
    if (mk) sequinPatch(body, texOf(mk, false));
    const head = new THREE.MeshStandardMaterial({ map: texOf(ht), normalMap: hn ? texOf(hn, false) : null, roughness: 0.56, metalness: 0 });
    if (head.normalMap) head.normalScale.set(0.7, 0.7);
    const cards = ct ? new THREE.MeshStandardMaterial({ map: texOf(ct), roughness: 0.6, alphaTest: 0.42, side: THREE.DoubleSide }) : null;
    return { body, head, cards };
  });
  AV.looks[key] = { p, refs: 1 };
  p.catch(() => { delete AV.looks[key]; });
  return p;
}
function releaseLook(key) {
  const e = AV.looks[key]; if (!e) return; if (--e.refs > 0) return; delete AV.looks[key];
  e.p.then(M => { for (const m of [M.body, M.head, M.cards]) if (m) { for (const k of ['map', 'normalMap']) if (m[k]) m[k].dispose(); m.dispose(); } }).catch(() => {});
}

// ---------------------------------------------------------------- accessories (sunglasses)
const ACC = {};
function makeGlasses(kind) {
  if (!ACC.ready) { ACC.ready = true;
    const s = new THREE.Shape(); s.moveTo(-2.6, 1.3); s.bezierCurveTo(-0.6, 2.0, 2.2, 1.9, 2.5, 0.9); s.bezierCurveTo(2.7, -0.8, 1.3, -2.4, -0.2, -2.4); s.bezierCurveTo(-2.2, -2.3, -3.0, -0.4, -2.6, 1.3);
    ACC.lens = new THREE.ShapeGeometry(s, 16); ACC.lensRim = new THREE.BufferGeometry().setFromPoints(s.getPoints(40).map(p => new THREE.Vector3(p.x, p.y, 0)));
    const r = new THREE.Shape(); r.absarc(0, 0, 2.05, 0, Math.PI * 2, false); ACC.round = new THREE.ShapeGeometry(r, 24); ACC.roundRim = new THREE.BufferGeometry().setFromPoints(r.getPoints(40).map(p => new THREE.Vector3(p.x, p.y, 0)));
    ACC.lensM = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 0.06, metalness: 0.6, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
    ACC.lensD = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.06, metalness: 0.5, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
    ACC.frame = new THREE.LineBasicMaterial({ color: 0xd8c08a }); ACC.metal = new THREE.MeshStandardMaterial({ color: 0xd8c08a, metalness: 0.95, roughness: 0.28 });
    ACC.arm = new THREE.BoxGeometry(0.18, 0.25, 9.5); ACC.bridge = new THREE.BoxGeometry(2.0, 0.16, 0.16); }
  const g = new THREE.Group(), round = kind === 'round';
  for (const sd of [-1, 1]) {
    const L = new THREE.Mesh(round ? ACC.round : ACC.lens, round ? ACC.lensD : ACC.lensM); L.position.set(sd * 3.25, 0, 0); if (sd < 0 && !round) L.scale.x = -1; g.add(L);
    const rim = new THREE.LineLoop(round ? ACC.roundRim : ACC.lensRim, ACC.frame); rim.position.copy(L.position); rim.scale.copy(L.scale); g.add(rim);
    const arm = new THREE.Mesh(ACC.arm, ACC.metal); arm.position.set(sd * 6.75, 0.9, -4.6); g.add(arm); }
  const br = new THREE.Mesh(ACC.bridge, ACC.metal); br.position.set(0, 1.2, 0); g.add(br);
  return g;
}

// ---------------------------------------------------------------- source rig bind data (per sex, from the untouched template)
const SRC = {};
function srcBind(sex, template, scale) {
  if (SRC[sex]) return SRC[sex];
  template.updateMatrixWorld(true);
  const byName = {}; template.traverse(o => { if (o.isBone) byName[o.name] = o; });
  const q = {}, p = {}, rootInv = new THREE.Matrix4().copy(template.matrixWorld).invert(), m = new THREE.Matrix4(), s = new THREE.Vector3(), qq = new THREE.Quaternion();
  for (const n in byName) { m.multiplyMatrices(rootInv, byName[n].matrixWorld); const pos = new THREE.Vector3(); m.decompose(pos, qq, s); q[n] = qq.clone(); p[n] = pos.multiplyScalar(scale); }
  return SRC[sex] = { q, p };
}
// world (character-space) rotation and position of a source bone, walking up to the rig root (cached per frame)
function srcXf(b, root, cache) {
  let e = cache.get(b); if (e) return e;
  if (b === root) { e = { q: b.quaternion.clone(), p: b.position.clone(), s: b.scale.x }; cache.set(b, e); return e; }
  const P = srcXf(b.parent, root, cache);
  e = { q: P.q.clone().multiply(b.quaternion), p: b.position.clone().multiplyScalar(P.s).applyQuaternion(P.q).add(P.p), s: P.s * b.scale.x }; cache.set(b, e); return e;
}

// ---------------------------------------------------------------- the realistic body
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3();
export const BODIES = new Set();
export class RealBody {
  constructor(base, gltf, L, rig, opts = {}) {
    this.base = base; this.L = L; this.rig = rig; BODIES.add(this);
    this.holder = new THREE.Group(); this.holder.name = 'realBody'; this.inner = new THREE.Group(); this.holder.add(this.inner);
    const sc = SkeletonUtils.clone(gltf.scene); this.inner.add(sc); this.model = sc; this.meshes = [];
    sc.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; this.meshes.push(o); } });
    this.kinds = this.meshes.map(m => [].concat(m.material).map(x => /head/.test(x.name) ? 'head' : /opacity/.test(x.name) ? 'cards' : 'body'));
    const byName = {}; sc.traverse(o => { if (o.isBone) byName[o.name.replace(/^Bip01_/, '')] = o; }); this.byName = byName;
    const wp = o => o.getWorldPosition(new THREE.Vector3());
    // face +z like the game's characters (forward = heel -> toe)
    this.holder.updateMatrixWorld(true);
    const fwd = wp(byName.L_Toe0).sub(wp(byName.L_Foot)).add(wp(byName.R_Toe0).sub(wp(byName.R_Foot))); fwd.y = 0; fwd.normalize();
    this.inner.quaternion.setFromUnitVectors(fwd, new THREE.Vector3(0, 0, 1)); this.holder.updateMatrixWorld(true);
    // scale so the hips sit at the rig's hip height (seats, car and pool edges were laid out for the rig)
    const S = rig.srcBind, hipSrc = S.p.pelvis.y, box = new THREE.Box3();
    for (const m of this.meshes) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); }
    const hip0 = wp(byName.Pelvis).y - box.min.y, s = hipSrc / Math.max(0.3, hip0) * (opts.scale || 1);
    this.inner.scale.setScalar(s); this.inner.position.y = -box.min.y * s; this.holder.updateMatrixWorld(true);
    this.height = (box.max.y - box.min.y) * s;
    // retarget table, parents first
    const hq = new THREE.Quaternion(); this.holder.getWorldQuaternion(hq); const hInv = hq.clone().invert();
    const hm = new THREE.Matrix4().copy(this.holder.matrixWorld).invert();
    const dq = b => hInv.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
    const dp = b => wp(b).applyMatrix4(hm);
    const depth = b => { let d = 0; while (b.parent) { d++; b = b.parent; } return d; };
    const rows = [];
    for (const [sn, dn, child] of MAP) {
      const sb = rig.bones[sn], db = byName[dn]; if (!sb || !db || !S.q[sn]) continue;
      rows.push({ sn, sb, db, child, Bs: S.q[sn].clone(), Bd: dq(db), depth: depth(db), qal: new THREE.Quaternion() }); }
    rows.sort((a, b) => a.depth - b.depth);
    const bySrc = {}; rows.forEach(r => bySrc[r.sn] = r);
    for (const r of rows) {
      const c = r.child && bySrc[r.child];
      if (c && r.sn !== 'pelvis') { const ds = S.p[r.child].clone().sub(S.p[r.sn]).normalize(), dd = dp(c.db).sub(dp(r.db)).normalize(); if (ds.lengthSq() > 0.5 && dd.lengthSq() > 0.5) r.qal.setFromUnitVectors(dd, ds); }
      else { let pr = r.db.parent; const pRow = rows.find(x => x.db === pr); if (pRow && r.sn !== 'pelvis' && r.sn !== 'Head') r.qal.copy(pRow.qal); }
    }
    for (const r of rows) { r.A = r.qal.clone().multiply(r.Bd); r.BsInv = r.Bs.clone().invert(); r.W = new THREE.Quaternion(); }
    this.rows = rows; this.rowOf = new Map(rows.map(r => [r.db, r]));
    this.pelvis = byName.Pelvis; this.pelvisParentInv = new THREE.Matrix4().copy(this.holder.matrixWorld).invert().multiply(this.pelvis.parent.matrixWorld).invert();
    this.hipRatio = 1; this.bindM = {};
    for (const n of ['Head', 'L_Forearm', 'Spine2', 'L_Foot', 'R_Foot']) if (byName[n]) this.bindM[n] = new THREE.Matrix4().copy(hm).multiply(byName[n].matrixWorld);
    this.accP = { neck: byName.Neck ? dp(byName.Neck) : null, lf: byName.L_Foot ? dp(byName.L_Foot) : null, lt: byName.L_Toe0 ? dp(byName.L_Toe0) : null, rf: byName.R_Foot ? dp(byName.R_Foot) : null, rt: byName.R_Toe0 ? dp(byName.R_Toe0) : null }; this.accObjs = []; this.accKey = '';
    // head measurements (glasses), wrist socket (wristband)
    this.measureHead(); this.handA = dp(byName.L_Forearm); this.handB = dp(byName.L_Hand);
    this.band = null;
    // face rig: smile and blink
    this.face = []; this.blink = [];
    const toLocal = (b, v) => v.clone().applyQuaternion(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert()).divideScalar(b.parent.getWorldScale(new THREE.Vector3()).x);
    for (const [n, v] of [['LMouthCorner', [0.0035, 0.0045, -0.002]], ['RMouthCorner', [-0.0035, 0.0045, -0.002]], ['LCheek', [0.001, 0.0025, 0]], ['RCheek', [-0.001, 0.0025, 0]], ['MBottomLip', [0, -0.0008, 0]]]) { const b = byName[n]; if (b) this.face.push({ b, rest: b.position.clone(), v: toLocal(b, new THREE.Vector3(...v)) }); }
    for (const [n, v] of [['LEyeBlinkTop', [0, -0.0085, 0.001]], ['REyeBlinkTop', [0, -0.0085, 0.001]], ['LEyeBlinkBottom', [0, 0.0018, 0]], ['REyeBlinkBottom', [0, 0.0018, 0]]]) { const b = byName[n]; if (b) this.blink.push({ b, rest: b.position.clone(), v: toLocal(b, new THREE.Vector3(...v)) }); }
    this.blinkT = 2 + Math.random() * 3; this.blinkA = 0; this.smile = opts.smile ?? 0.5; this.smileA = this.smile;
    this.cache = new Map(); this.matKey = '';
    this.setGlasses(L.g);
  }
  measureHead() {
    const B = this.byName, headB = B.Head; let top = -1e9, front = -1e9, back = 1e9, minX = 1e9, maxX = -1e9, n = 0; const c = new THREE.Vector3();
    const eyeL = B.LEye ? B.LEye.getWorldPosition(new THREE.Vector3()) : null, eyeR = B.REye ? B.REye.getWorldPosition(new THREE.Vector3()) : null;
    const headP = headB.getWorldPosition(new THREE.Vector3()); const eyeY = eyeL && eyeR ? (eyeL.y + eyeR.y) / 2 : headP.y + 0.08;
    for (const m of this.meshes) { if (!m.isSkinnedMesh) continue; const bi = m.skeleton.bones.indexOf(headB); if (bi < 0) continue;
      const P = m.geometry.attributes.position, SI = m.geometry.attributes.skinIndex, SW = m.geometry.attributes.skinWeight;
      for (let i = 0; i < P.count; i++) { const w = (SI.getX(i) === bi ? SW.getX(i) : 0) + (SI.getY(i) === bi ? SW.getY(i) : 0) + (SI.getZ(i) === bi ? SW.getZ(i) : 0) + (SI.getW(i) === bi ? SW.getW(i) : 0);
        if (w < 0.6) continue; c.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld);
        if (c.y > top) top = c.y; if (Math.abs(c.y - (eyeY + 0.035)) < 0.02) { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); front = Math.max(front, c.z); back = Math.min(back, c.z); n++; } } }
    if (!n) { top = headP.y + 0.2; minX = headP.x - 0.08; maxX = headP.x + 0.08; front = headP.z + 0.1; back = headP.z - 0.1; }
    this.headInfo = { top, eyeY, w: maxX - minX, cx: (minX + maxX) / 2, front, depth: front - back, eyeL, eyeR };
  }
  // attach an object given in holder space (bind pose) to a bone so it follows it
  attach(bone, obj, posH, quatH = new THREE.Quaternion(), scaleH = 1) {
    const bm = new THREE.Matrix4().copy(this.bindM[bone.name.replace(/^Bip01_/, '')]).invert();
    const m = new THREE.Matrix4().compose(posH, quatH, new THREE.Vector3(scaleH, scaleH, scaleH)); m.premultiply(bm);
    m.decompose(obj.position, obj.quaternion, obj.scale); bone.add(obj); return obj;
  }
  setGlasses(kind) {
    if (this.glassObj) { this.glassObj.parent && this.glassObj.parent.remove(this.glassObj); this.glassObj = null; }
    const H = this.headInfo; if (!kind || !H.eyeL || !H.eyeR) return;
    // eye positions were measured in world space at construction (holder at the origin), i.e. holder space
    const mid = H.eyeL.clone().add(H.eyeR).multiplyScalar(0.5), ipd = H.eyeL.distanceTo(H.eyeR);
    this.glassObj = this.attach(this.byName.Head, makeGlasses(kind), new THREE.Vector3(mid.x, mid.y + 0.001, Math.max(mid.z + 0.022, H.front - 0.012)), new THREE.Quaternion(), ipd / 6.5);
  }
  // v7 (Vegas Trip) statement accessories: 'cap' (DJ Tileo VIP snapback), 'chain' (heavy Cuban lion chain), 'kicks' (gold-trim sneakers)
  setAcc(list) {
    const key = (list || '').split(/[+,]/).filter(Boolean).sort().join('+'); if (key === this.accKey) return; this.accKey = key;
    for (const o of this.accObjs) o.parent && o.parent.remove(o); this.accObjs = []; if (!key) return;
    const H = this.headInfo, P = this.accP, gold = new THREE.MeshStandardMaterial({ color: 0xffcf5a, metalness: 0.7, roughness: 0.32, emissive: 0x4a3200, emissiveIntensity: 0.6 }), has = k => key.split('+').includes(k);
    if (has('cap') && H) { const g = new THREE.Group(), ipd = H.eyeL && H.eyeR ? H.eyeL.distanceTo(H.eyeR) : 0.064, r = Math.max(ipd * 1.7, Math.min(H.w * 0.6, ipd * 2.2)), mid = H.eyeL && H.eyeR ? H.eyeL.clone().add(H.eyeR).multiplyScalar(0.5) : new THREE.Vector3(H.cx, H.eyeY, H.front - 0.02), cz = mid.z - ipd * 1.15; // sits on top of the hair (the realistic hair rises above the skull)
      const black = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.85 }), under = new THREE.MeshStandardMaterial({ color: 0x3a2a12, roughness: 0.9 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), black); dome.scale.set(1, 0.74, 1.12); g.add(dome); const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.01, 0.03, 20, 1, true), black); band.position.y = -0.014; band.scale.z = 1.12; g.add(band);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.98, 0.009, 20, 1, false, -Math.PI * 0.4, Math.PI * 0.8), [black, black, under]); brim.position.set(0, -0.026, r * 0.5); brim.scale.set(1, 1, 1.45); brim.rotation.x = 0.1; g.add(brim);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(r * 0.98, 0.0035, 4, 20, Math.PI * 0.8), gold); edge.rotation.set(Math.PI / 2, 0, Math.PI * 0.1); edge.position.copy(brim.position); edge.scale.set(1, 1.45, 1); g.add(edge);
      const badge = new THREE.Mesh(new THREE.CircleGeometry(r * 0.26, 16), gold); badge.position.set(0, r * 0.3, r * 1.08); badge.rotation.x = -0.32; g.add(badge);
      const btn = new THREE.Mesh(new THREE.SphereGeometry(r * 0.09, 8, 6), gold); btn.position.y = r * 0.74; g.add(btn);
      this.accObjs.push(this.attach(this.byName.Head, g, new THREE.Vector3(mid.x, Math.max(mid.y + ipd * 0.85, H.top + 0.025 - r * 0.74), cz), new THREE.Quaternion(), 1)); }
    if (has('chain') && P.neck && this.bindM.Spine2) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.0095, 6, 28), gold); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.85, 0, 0));
      const pend = new THREE.Mesh(new THREE.OctahedronGeometry(0.018), gold); pend.position.set(0, 0.088, -0.01); t.add(pend);
      this.accObjs.push(this.attach(this.byName.Spine2, t, new THREE.Vector3(P.neck.x, P.neck.y - 0.02, P.neck.z + 0.022), q, 1)); }
    if (has('kicks')) for (const [f, to, bn] of [[P.lf, P.lt, 'L_Foot'], [P.rf, P.rt, 'R_Foot']]) { if (!f || !to || !this.bindM[bn]) continue;
      const len = Math.hypot(to.x - f.x, to.z - f.z) + 0.11, m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, len), gold), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(to.x - f.x, to.z - f.z), 0));
      this.accObjs.push(this.attach(this.byName[bn], m, new THREE.Vector3((f.x + to.x) / 2, 0.018, (f.z + to.z) / 2 - 0.01), q, 1)); }
  }
  setBand(color) {
    if (!this.band) { const B = this.byName, a = this.handA.clone(), b = this.handB.clone();
      const dir = b.clone().sub(a).normalize(), p = a.clone().lerp(b, 0.86);
      this.bandMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.45 });
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.033, 0.03, 18, 1, true), this.bandMat); m.material.side = THREE.DoubleSide; m.castShadow = false;
      this.band = this.attach(B.L_Forearm, m, p, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); }
    this.band.visible = !!color; if (color) { this.bandMat.color.set(color); this.bandMat.emissive.set(color).multiplyScalar(0.35); }
  }
  setMaterials(M) { this.meshes.forEach((m, i) => { const mats = this.kinds[i].map(k => k === 'head' ? (this.hideHead ? HIDDEN : M.head) : k === 'cards' ? (this.hideHead ? HIDDEN : (M.cards || M.head)) : M.body); m.material = mats.length === 1 ? mats[0] : mats; }); this.M = M; }
  // copy the rig's pose (call after the mixer and any procedural bone tweaks)
  sync(dt, smileWant) {
    const rig = this.rig, cache = this.cache; cache.clear();
    const W = new Map();
    const dstQ = b => { if (b === this.holder || !b) return new THREE.Quaternion(); const w = W.get(b); if (w) return w.clone(); const pq = dstQ(b.parent).multiply(b.quaternion); W.set(b, pq.clone()); return pq; };
    for (const r of this.rows) {
      const S = srcXf(r.sb, rig.root, cache);
      r.W.copy(S.q).multiply(r.BsInv).multiply(r.A); // delta from the rig's bind, applied to the realistic bind (aligned)
      const pq = dstQ(r.db.parent);
      r.db.quaternion.copy(pq.invert().multiply(r.W)); W.set(r.db, r.W.clone());
    }
    // hips: same character-space position as the rig's pelvis
    const P = srcXf(rig.bones.pelvis, rig.root, cache); this.pelvis.position.copy(_v.copy(P.p)).applyMatrix4(this.pelvisParentInv);
    // face: relaxed smile, bigger when dancing or chatting, and blinking
    this.smileA = lerp(this.smileA, smileWant ?? this.smile, 1 - Math.exp(-4 * dt));
    for (const f of this.face) f.b.position.copy(f.rest).addScaledVector(f.v, this.smileA);
    this.blinkT -= dt; if (this.blinkT < 0) { this.blinkT = 2.5 + Math.random() * 4; this.blinkA = 1; }
    const bl = this.blinkA > 0 ? Math.sin(Math.min(1, this.blinkA) * Math.PI) : 0; this.blinkA = Math.max(0, this.blinkA - dt * 7);
    for (const e of this.blink) e.b.position.copy(e.rest).addScaledVector(e.v, bl);
  }
  setShadows(on) { for (const m of this.meshes) m.castShadow = on; }
  dispose() { if (this.holder.parent) this.holder.parent.remove(this.holder); BODIES.delete(this); if (this.matKey) releaseLook(this.matKey); this.matKey = ''; }
}
const HIDDEN = new THREE.MeshBasicMaterial({ visible: false });

// create (or update) a realistic body for a rigged character. Resolves to the RealBody or null.
export async function buildRealBody(rig, L, o = {}) {
  const base = PEOPLE_BASES[L.b]; if (!base) throw new Error('people: unknown base ' + L.b);
  const size = o.size || 512, normals = !!o.normals;
  const [g, M] = await Promise.all([loadGLB(L.b), lookMaterials(L, size, normals)]);
  const rb = new RealBody(base, g, L, rig, o); rb.hideHead = !!o.hideHead; rb.setMaterials(M); rb.matKey = lookKey(L, size, normals);
  return rb;
}
export async function retexture(rb, L, o = {}) { // same base, new colours / face / beard
  const size = o.size || 512, normals = !!o.normals, key = lookKey(L, size, normals); if (key === rb.matKey || key === rb.pendingKey) return;
  const seq = rb.seq = (rb.seq || 0) + 1; rb.pendingKey = key;
  const M = await lookMaterials(L, size, normals);
  if (seq !== rb.seq || !BODIES.has(rb)) { releaseLook(key); return; } // a newer look won (or the body is gone)
  const old = rb.matKey; rb.matKey = key; rb.pendingKey = ''; rb.L = L; rb.setMaterials(M); if (old) releaseLook(old);
}
export function warmPeople(ids) { for (const id of ids) loadGLB(id).catch(() => {}); }
export function setMaxAniso(n) { AV.maxAniso = Math.min(8, n || 4); }
export { SRC, srcBind };
