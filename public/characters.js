import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, M, add, box, cyl, T, PI, glow, logoPlane } from './core.js?v=1793987979';
import { Q } from './quality.js?v=1793987979';
import { realLook, buildRealBody, retexture, srcBind, setTigerSource, warmPeople, FACES as RFACES, BODIES } from './people.js?v=1793987979';
import { PEOPLE_BASES } from './people_data.js?v=1793987979';
import { carParts, carMats } from './cars.js?v=1793987979';

export const BAND_C = '#e0b24a'; // the TILEO KINGDOM guest wristband (gold); guests get one at check-in
export const STYLES = {
  solid: { n: 'Classic', price: 0 },
  swim: { n: 'Resort Swimwear', price: 150 },
  white: { n: 'White Party Look', price: 200 },
  tiger: { n: 'Tiger Print Set', price: 250 },
  gold: { n: 'Gold Sequin Clubwear', price: 400 },
};
function limb(parent, mat, x, y, len, r) { // pivot at top
  const piv = new THREE.Group(); piv.position.set(x, y, 0); parent.add(piv);
  const m = new THREE.Mesh(G.cyl6, mat); m.scale.set(r, len, r); m.position.y = -len / 2; piv.add(m); piv.userData.mesh = m; return piv;
}
function makeProcedural(look) {
  const g = new THREE.Group();
  const mats = { skin: new THREE.MeshStandardMaterial(), hair: new THREE.MeshStandardMaterial(), top: new THREE.MeshStandardMaterial(), bottom: new THREE.MeshStandardMaterial(), shoe: M(0x111111), band: new THREE.MeshBasicMaterial({ color: 0x555555 }) };
  const body = new THREE.Group(); g.add(body);
  const legL = limb(body, mats.bottom, -0.14, 0.95, 0.9, 0.12), legR = limb(body, mats.bottom, 0.14, 0.95, 0.9, 0.12);
  for (const l of [legL, legR]) add(l, G.box, mats.shoe, 0, -0.92, 0.05, 0.2, 0.1, 0.32);
  const hips = add(body, G.cyl6, mats.bottom, 0, 1.0, 0, 0.3, 0.22, 0.22);
  const torso = add(body, G.cyl, mats.top, 0, 1.38, 0, 0.3, 0.62, 0.22); torso.scale.set(0.32, 0.62, 0.22);
  const armL = limb(body, mats.skin, -0.4, 1.62, 0.7, 0.085), armR = limb(body, mats.skin, 0.4, 1.62, 0.7, 0.085);
  const band = add(armL, G.cyl6, mats.band, 0, -0.6, 0, 0.11, 0.08, 0.11); band.visible = false;
  add(body, G.cyl6, mats.skin, 0, 1.76, 0, 0.08, 0.12, 0.08);
  const head = add(body, G.sph, mats.skin, 0, 1.97, 0, 0.21, 0.24, 0.21);
  const hair = add(body, G.sph, mats.hair, 0, 2.03, -0.03, 0.23, 0.22, 0.23);
  const eyeM = M(0x111111); add(head, G.sph, eyeM, -0.35, 0.1, 0.85, 0.12, 0.12, 0.12); add(head, G.sph, eyeM, 0.35, 0.1, 0.85, 0.12, 0.12, 0.12);
  g.userData = { body, legL, legR, armL, armR, torso, hips, mats, band, head, hair, phase: Math.random() * 6 };
  applyProcLook(g, look); return g;
}
function applyProcLook(ch, look) {
  const u = ch.userData, m = u.mats; m.skin.color.set(look.skin); m.hair.color.set(look.hair);
  const st = look.style || 'solid'; m.top.map = null; m.bottom.map = null; m.top.emissive.set(0); m.bottom.emissive.set(0);
  m.top.color.set(look.outfit); m.bottom.color.set(new THREE.Color(look.outfit).multiplyScalar(0.45));
  if (st === 'tiger') { m.top.map = T.tiger; m.bottom.map = T.tiger; m.top.color.set(0xffffff); m.bottom.color.set(0xdddddd); }
  if (st === 'gold') { m.top.color.set(0xffc94a); m.top.emissive.set(0x6a4a00); m.bottom.color.set(0x111111); }
  if (st === 'white') { m.top.color.set(0xe4e2dc); m.bottom.color.set(0xdcdad3); } // real fabric albedo: pure white blooms under casino lights
  if (st === 'swim') { m.bottom.color.set(look.outfit); m.top.color.set(look.outfit); }
  // swimwear: bare legs (skin) with short torso suit
  u.legL.userData.mesh.material = u.legR.userData.mesh.material = st === 'swim' ? m.skin : m.bottom;
  u.torso.scale.y = st === 'swim' ? 0.42 : 0.62; u.torso.position.y = st === 'swim' ? 1.28 : 1.38;
  m.top.needsUpdate = m.bottom.needsUpdate = true;
  m.band.color.set(BAND_C);
  u.band.visible = !!look.banded;
  u.hair.scale.set(0.23, look.hairLong ? 0.3 : 0.22, 0.23);
}
// walk/dance/idle animation
function animateProc(ch, t, speed, mode = '') {
  const u = ch.userData, ph = t * 2 + u.phase;
  if (mode === 'dance') {
    const b = Math.sin(t * 8 + u.phase); u.body.position.y = Math.abs(b) * 0.12; u.body.rotation.y = Math.sin(t * 2 + u.phase) * 0.5;
    u.armL.rotation.z = -2.4 + Math.sin(t * 8) * 0.4; u.armR.rotation.z = 2.4 + Math.cos(t * 8) * 0.4; u.armL.rotation.x = u.armR.rotation.x = 0;
    u.legL.rotation.x = b * 0.3; u.legR.rotation.x = -b * 0.3; return;
  }
  if (mode === 'dj') { u.body.position.y = Math.abs(Math.sin(t * 6)) * 0.05; u.armL.rotation.x = -1.2 + Math.sin(t * 12) * 0.25; u.armR.rotation.x = -1.0; u.armR.rotation.z = Math.sin(t * 3) > 0.6 ? 2.6 : 0.3; u.body.rotation.y = 0; u.legL.rotation.x = u.legR.rotation.x = 0; return; }
  if (mode === 'sit') { u.body.position.y = -0.45; u.legL.rotation.x = u.legR.rotation.x = -1.5; u.armL.rotation.x = u.armR.rotation.x = -0.4; u.armL.rotation.z = u.armR.rotation.z = 0; return; }
  u.body.rotation.y = 0; u.armL.rotation.z = -0.08; u.armR.rotation.z = 0.08;
  if (speed > 0.1) { const s = Math.sin(t * speed * 1.6 + u.phase) * Math.min(0.7, speed * 0.1); u.legL.rotation.x = s; u.legR.rotation.x = -s; u.armL.rotation.x = -s * 0.8; u.armR.rotation.x = s * 0.8; u.body.position.y = Math.abs(Math.cos(t * speed * 1.6)) * 0.04; }
  else { u.legL.rotation.x *= 0.8; u.legR.rotation.x *= 0.8; u.armL.rotation.x = Math.sin(ph) * 0.05; u.armR.rotation.x = -Math.sin(ph) * 0.05; u.body.position.y = 0; }
}
export function randomLook(R) {
  const skins = ['#f1c9a5', '#d9a47c', '#b07a52', '#8a5636', '#5e3a22', '#3d2516'];
  const hairs = ['#1a1209', '#3b2412', '#7a4a1e', '#d8b45a', '#b8321c', '#e8e0d0', '#2a1a3a'];
  const outfits = ['#c9932e', '#111111', '#ffffff', '#b0102a', '#ff7a1a', '#7b2cbf', '#1f6f8b', '#e83e8c'];
  const styles = ['solid', 'solid', 'solid', 'white', 'tiger', 'gold', 'swim'];
  const pick = a => a[Math.floor(R() * a.length)];
  const body = R() < 0.5 ? 'f' : 'm';
  const FIX = { m: ['malea04', 'malea08', 'malea09', 'malea12', 'malea16', 'malea17'], f: ['femalep02', 'sportsf02', 'femalea03', 'femalea12'] };
  const L = { skin: pick(skins), hair: pick(hairs), outfit: pick(outfits), style: pick(styles), hairLong: R() < 0.5, body, hairStyle: pick(HAIRSTYLES[body]), beard: body === 'm' && R() < 0.35, banded: true,
    face: pick(RFACES[body]), seed: Math.floor(R() * 1e6), glasses: R() < 0.22 ? pick(['aviator', 'round']) : '' };
  if (L.style === 'solid' && R() < 0.45) L.fixed = pick(FIX[body]);
  return L;
}


// =====================================================================================
// Rigged, skinned humanoids (Quaternius Universal Base Characters + Universal Animation
// Library 1 & 2, all CC0). Meshopt-compressed GLB in assets/models/. The procedural lowpoly
// avatar above stays as (a) the instant placeholder while GLBs stream in and (b) the far LOD.
// Public API is unchanged: makeCharacter(look) / applyLook(ch, look) / animate(ch, t, speed, mode).
// =====================================================================================
export const HAIRSTYLES = { f: ['long', 'buns', 'parted', 'buzzedfemale'], m: ['parted', 'buzzed', 'long', 'buns'] };
export const HAIR_NAMES = { long: 'Long', buns: 'Buns', parted: 'Side part', buzzed: 'Buzz cut', buzzedfemale: 'Pixie buzz', beard: 'Beard' };
const HAIR_FILES = { long: 'hair_long', buns: 'hair_buns', parted: 'hair_simpleparted', buzzed: 'hair_buzzed', buzzedfemale: 'hair_buzzedfemale', beard: 'hair_beard' };
export const EMOTES = { dance: ['Dance_Loop', 'Dance', '💃'], wave: ['Idle_Rail_Call', 'Wave', '👋'], yes: ['Yes', 'Nod', '😉'], no: ['Idle_No_Loop', 'Nope', '🙅'],
  fold: ['Idle_FoldArms_Loop', 'Cool pose', '😎'], phone: ['Idle_TalkingPhone_Loop', 'On the phone', '📱'], talk: ['Idle_Talking_Loop', 'Chat', '💬'], sit: ['Sitting_Idle_Loop', 'Sit', '🪑'] };
const SCALE = 1.08; // world was laid out for slightly tall avatars
const DIMS = { // bind-pose (T-pose) landmarks in metres, measured from the meshes
  f: { ankle: 0.12, knee: 0.53, crotch: 0.86, waist: 1.06, neck: 1.44, sh: 0.17, tee: 0.30, tank: 0.19, long: 0.6 },
  m: { ankle: 0.13, knee: 0.54, crotch: 0.88, waist: 1.08, neck: 1.48, sh: 0.22, tee: 0.36, tank: 0.24, long: 0.66 } };
export const CHAR = { camPos: new THREE.Vector3(), list: [], frame: 0 };
const RIG = { ready: false, failed: false, src: {}, lod: {}, hair: {}, clips: {} };
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const load = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));
const firstSkinned = o => { let m = null; o.traverse(c => { if (!m && c.isSkinnedMesh) m = c; }); return m; };
export const rigReady = (async () => {
  try {
    const P = 'assets/models/', hk = Object.keys(HAIR_FILES);
    const all = await Promise.all([load(P + 'body_f.glb'), load(P + 'body_m.glb'), load(P + 'body_f_lod.glb'), load(P + 'body_m_lod.glb'), load(P + 'anims_ual1.glb'), load(P + 'anims_ual2.glb'), ...hk.map(k => load(P + HAIR_FILES[k] + '.glb'))]);
    RIG.src.f = all[0].scene; RIG.src.m = all[1].scene; RIG.lod.f = firstSkinned(all[2].scene); RIG.lod.m = firstSkinned(all[3].scene);
    for (const g of [all[4], all[5]]) for (const c of g.animations) RIG.clips[c.name] = c;
    hk.forEach((k, i) => { RIG.hair[k] = firstSkinned(all[6 + i].scene); });
    RIG.ready = true; return true;
  } catch (e) { console.warn('[characters] rigged models unavailable, keeping lowpoly avatars', e); RIG.failed = true; return false; }
})();
export const rigStatus = () => (RIG.ready ? 'rigged' : RIG.failed ? 'failed' : 'loading');

const lin = new THREE.Color();
const REF_SKIN = new THREE.Color().setRGB(0.671, 0.471, 0.325, THREE.SRGBColorSpace); // median skin of the base texture
function bodyMaterial(src, deq) {
  const m = src.clone();
  const u = m.userData.u = { uDeq: { value: deq || new THREE.Vector4(1, 0, 0, 0) }, uSkin: { value: new THREE.Color(1, 1, 1) }, uTop: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uShoe: { value: new THREE.Color() },
    uCut: { value: new THREE.Vector4() }, uMode: { value: new THREE.Vector4() }, uBody: { value: new THREE.Vector4() }, uTiger: { value: T.tiger || null } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBind; uniform vec4 uDeq;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position * uDeq.x + uDeq.yzw;'); // dequantize (meshopt) to bind-pose metres
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vBind; uniform vec3 uSkin, uTop, uBot, uShoe; uniform vec4 uCut, uMode, uBody; uniform sampler2D uTiger;
float tkHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  vec3 tkTex = diffuseColor.rgb; vec3 b = vBind; float ax = abs(b.x);
  float tkMx = max(tkTex.r, max(tkTex.g, tkTex.b)), tkMn = min(tkTex.r, min(tkTex.g, tkTex.b));
  float tkUw = (1.0 - smoothstep(0.16, 0.3, (tkMx - tkMn) / max(tkMx, 1e-4))) * step(b.y, uBody.w); // grey base underwear (below the neck)
  float tkLum = clamp(dot(tkTex, vec3(0.299, 0.587, 0.114)) / 0.22, 0.7, 1.2);
  vec3 tkCol = tkTex * uSkin;
  float tkArm = step(uBody.z, ax); // beyond the shoulder joint (T-pose arms): sleeves wrap the whole arm
  float tkNeckY = uBody.w - 0.02 - 0.075 * step(0.0, b.z) * (1.0 - smoothstep(0.07, 0.11, ax)); // scoop neckline at the front
  float tkTopY = mix(tkNeckY, 9.0, tkArm);
  float tkTop = step(uCut.y, b.y) * step(b.y, tkTopY) * step(ax, uCut.x);
  float tkTrim = tkTop * (1.0 - tkArm) * (step(tkTopY - 0.014, b.y) + step(b.y, uCut.y + 0.012)) + tkTop * tkArm * step(uCut.x - 0.014, ax); // hem/neckline/cuff bands
  float tkBot = step(uCut.z, b.y) * step(b.y, uCut.w) * (1.0 - tkTop);
  float tkShoe = step(b.y, uBody.x) * uMode.w;
  float tkSpark = pow(tkHash(floor(b * 160.0)), 12.0);
  vec3 tkTiger = texture2D(uTiger, vec2(b.x * 1.6 + b.z * 1.1, b.y * 1.25)).rgb;
  vec3 tkTopC = uMode.y > 1.5 ? uTop * (0.75 + 1.6 * tkSpark) : (uMode.y > 0.5 ? tkTiger : uTop);
  vec3 tkBotC = uMode.z > 1.5 ? uBot * (0.75 + 1.6 * tkSpark) : (uMode.z > 0.5 ? tkTiger * 0.9 : uBot);
  float tkSwim = uMode.x;
  vec3 tkUwC = mix(tkBotC, tkTopC, step(uCut.w + 0.12, b.y));
  tkCol = mix(tkCol, tkUwC * tkLum, tkUw);
  tkCol = mix(tkCol, tkTopC * tkLum * (1.0 - 0.35 * min(tkTrim, 1.0)), tkTop * (1.0 - tkSwim));
  tkCol = mix(tkCol, tkBotC * tkLum, tkBot * (1.0 - tkSwim));
  tkCol = mix(tkCol, uShoe, tkShoe);
  float tkCloth = max(max(tkTop, tkBot) * (1.0 - tkSwim), max(tkUw, tkShoe));
  float tkSeq = (uMode.y > 1.5 ? tkTop : 0.0) + (uMode.z > 1.5 ? tkBot : 0.0);
  if (tkSwim > 0.5) tkSeq = 0.0;
  diffuseColor.rgb = tkCol;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor, mix(0.78, 0.32, tkSeq), tkCloth);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = mix(metalnessFactor, 0.0, tkCloth) + tkSeq * 0.55;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += uTop * tkSeq * (0.04 + tkSpark * 0.8);`);
  };
  m.customProgramCacheKey = () => 'tileoBody1';
  return m;
}
function setBodyLook(mats, look, sex) { for (const m of mats) setBodyLook1(m, look, sex); }
function setBodyLook1(mat, look, sex) {
  const u = mat.userData.u, D = DIMS[sex], st = look.style || 'solid', out = new THREE.Color(look.outfit || '#c9932e');
  lin.set(look.skin || '#d9a47c'); u.uSkin.value.setRGB(lin.r / REF_SKIN.r, lin.g / REF_SKIN.g, lin.b / REF_SKIN.b);
  const f = sex === 'f'; let top = out.clone(), bot = out.clone().multiplyScalar(0.45), shoe = new THREE.Color(0x141414);
  let sleeve = f ? D.tank : D.tee, topLow = D.waist - 0.05, hem = D.ankle + 0.02, mode = [0, 0, 0, 1];
  if (st === 'swim') { mode = [1, 0, 0, 0]; bot = out.clone(); }
  if (st === 'white') { top.set(0xe4e2dc); bot.set(0xdcdad3); shoe.set(f ? 0xd8b45a : 0xf4f4f4); if (f) { hem = D.knee + 0.13; sleeve = D.tank; } }
  if (st === 'tiger') { mode = [0, 1, f ? 1 : 0, 1]; top.set(0xffffff); bot.set(0x101010); if (f) { hem = D.knee + 0.16; } }
  if (st === 'gold') { mode = [0, 2, 0, 1]; top.set(0xffc94a); bot.set(0x0d0d0d); shoe.set(0xd8a83a); if (f) { hem = D.knee + 0.12; sleeve = D.tank; } else sleeve = D.long; }
  u.uTop.value.copy(top); u.uBot.value.copy(bot); u.uShoe.value.copy(shoe);
  u.uCut.value.set(sleeve, topLow, hem, D.waist + 0.02); u.uMode.value.set(...mode); u.uBody.value.set(D.ankle, D.crotch, D.sh, D.neck);
  if (!u.uTiger.value && T.tiger) u.uTiger.value = T.tiger;
}
function hairMaterial(src, color) { const m = src.clone(); lin.set(color); m.color.setRGB(lin.r, lin.g, lin.b).multiplyScalar(3.4); m.userData.hairTint = true; return m; }
function rebind(src, boneMap, mat) { // attach a skinned mesh from another GLB (same 65-bone rig) to this character's bones
  const sk = new THREE.Skeleton(src.skeleton.bones.map(b => boneMap[b.name]), src.skeleton.boneInverses);
  const m = new THREE.SkinnedMesh(src.geometry, mat); m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
  m.bind(sk, src.bindMatrix); return m;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
function attachAlong(boneA, boneB, obj, t) { // place obj on the segment boneA→boneB (bind pose), its +Y along the bone
  boneA.getWorldPosition(_a); boneB.getWorldPosition(_b); const dir = _b.clone().sub(_a).normalize(); const p = _a.clone().lerp(_b, t);
  obj.position.copy(boneA.worldToLocal(p)); boneA.getWorldQuaternion(_q).invert(); obj.quaternion.setFromUnitVectors(UP, dir.applyQuaternion(_q)); boneA.add(obj);
}
// meshopt quantization stores positions as normalized int16; the dequantize transform lives in the inverse bind matrices.
// Recover it (bind-pose metres = position * s + offset) from the untouched source so the outfit cut heights work in metres.
function deqOf(mesh) { if (mesh.userData.deq) return mesh.userData.deq; let top = mesh; while (top.parent) top = top.parent; top.updateMatrixWorld(true);
  const D = new THREE.Matrix4().copy(mesh.bindMatrixInverse).multiply(mesh.skeleton.bones[0].matrixWorld).multiply(mesh.skeleton.boneInverses[0]).multiply(mesh.bindMatrix), e = D.elements;
  return mesh.userData.deq = new THREE.Vector4(Math.hypot(e[0], e[1], e[2]), e[12], e[13], e[14]); }
function buildRig(ch, look) {
  const u = ch.userData, sex = look.body === 'm' ? 'm' : 'f';
  if (u.rig) { u.rig.root.parent && u.rig.root.parent.remove(u.rig.root); u.rig.mixer.stopAllAction(); }
  let srcBody = null; RIG.src[sex].traverse(o => { if (o.isSkinnedMesh && /Superhero/i.test(o.material.name || '')) srcBody = o; });
  const deqB = deqOf(srcBody), deqL = deqOf(RIG.lod[sex]);
  const root = SkeletonUtils.clone(RIG.src[sex]); root.scale.setScalar(SCALE);
  let body = null, brows = null; const meshes = [];
  root.traverse(o => { if (!o.isSkinnedMesh) return; meshes.push(o); const n = o.material.name || '';
    if (/Superhero/i.test(n)) body = o; else if (/Hair/i.test(n)) brows = o; });
  const bones = {}; body.skeleton.bones.forEach(b => bones[b.name] = b);
  const lodMat = bodyMaterial(body.material, deqL); body.material = bodyMaterial(body.material, deqB); brows.material = hairMaterial(brows.material, look.hair || '#1a1209');
  const lod = rebind(RIG.lod[sex], bones, lodMat); body.parent.add(lod); lod.visible = false;
  for (const o of [...meshes, lod]) { o.castShadow = false; o.receiveShadow = false; }
  root.updateMatrixWorld(true);
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x555555, emissive: 0x000000, roughness: 0.5 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.035, 14, 1, true), bandMat); band.material.side = THREE.DoubleSide;
  attachAlong(bones.lowerarm_l, bones.hand_l, band, 0.82);
  if (u.real) dropReal(ch);
  const rig = u.rig = { root, sex, body, brows, lod, meshes, bones, band, bandMat, hair: null, hairKey: '', beard: null, mixer: new THREE.AnimationMixer(root), actions: {}, cur: null, acc: 0, lod_: -1, srcBind: srcBind(sex, RIG.src[sex], SCALE) };
  ch.add(root); setRigLook(ch, look);
  if (u.onRig) u.onRig(rig);
  return rig;
}
function setRigLook(ch, look) {
  const u = ch.userData, r = u.rig; setBodyLook([r.body.material, r.lod.material], look, r.sex);
  r.brows.material.color.copy(new THREE.Color(look.hair || '#1a1209')).multiplyScalar(3.4);
  const hs = HAIRSTYLES[r.sex].includes(look.hairStyle) ? look.hairStyle : (look.hairLong ? 'long' : HAIRSTYLES[r.sex][r.sex === 'f' ? 1 : 0]);
  if (hs !== r.hairKey) { if (r.hair) r.hair.parent.remove(r.hair); r.hair = rebind(RIG.hair[hs], r.bones, hairMaterial(RIG.hair[hs].material, look.hair)); r.body.parent.add(r.hair); r.hairKey = hs; }
  r.hair.material.color.copy(new THREE.Color(look.hair || '#1a1209')).multiplyScalar(3.4);
  const wantBeard = r.sex === 'm' && !!look.beard;
  if (wantBeard && !r.beard) { r.beard = rebind(RIG.hair.beard, r.bones, r.hair.material); r.body.parent.add(r.beard); }
  if (r.beard) { r.beard.visible = wantBeard; r.beard.material = r.hair.material; }
  r.band.visible = !!look.banded; r.bandMat.color.set(BAND_C); r.bandMat.emissive.set(BAND_C).multiplyScalar(0.35);
  r.lod_ = -1; // force visibility refresh
}
function setLod(ch, lod, real) {
  const u = ch.userData, r = u.rig, key = lod * 2 + (real ? 1 : 0); if (!r || r.lod_ === key) return; r.lod_ = key;
  const sh = !!Q.tier.shadow && lod === 0;
  r.root.visible = lod < 2; u.body.visible = lod === 2 || !r;
  for (const o of r.meshes) { o.visible = lod === 0 && !real; o.castShadow = sh; }
  r.lod.visible = lod === 1 && !real; r.lod.castShadow = false;
  if (r.hair) { r.hair.visible = lod < 2 && !u.hideHair && !real; r.hair.castShadow = sh; }
  if (r.beard) r.beard.visible = lod === 0 && !!u.look.beard && r.sex === 'm' && !real;
  r.band.visible = lod === 0 && !!u.look.banded && !real;
  if (u.extra) u.extra.visible = lod < 2 && !real;
  const rb = u.real && u.real.rb; if (rb) { rb.holder.visible = !!real && lod < 2; rb.setShadows(sh); if (u.extraReal) u.extraReal.visible = !!real; if (rb.band) rb.band.visible = !!real && lod === 0 && !!u.look.banded; }
}
function clipFor(u, speed, mode) {
  if (mode === 'dj') return ['Dance_Loop', 0.8];
  if (mode === 'drive') return ['Driving_Loop', 1];
  if (EMOTES[mode]) return [EMOTES[mode][0], 1];
  if (mode === 'swim') return speed > 0.3 ? ['Swim_Fwd_Loop', Math.min(1.6, Math.max(0.6, speed / 2.3))] : ['Swim_Idle_Loop', 1];
  if (mode === 'jump') return ['Jump_Loop', 1.2];
  if (speed < 0.1) return ['Idle_Loop', 1];
  const s = speed / SCALE;
  if (s < 2.4) return ['Walk_Loop', Math.min(2.2, Math.max(0.7, s / 0.97))];
  if (s < 7.6) return ['Jog_Fwd_Loop', Math.min(1.5, Math.max(0.6, s / 5.36))];
  return ['Sprint_Loop', Math.min(1.5, Math.max(0.7, s / 8.25))];
}
function play(r, name, ts) {
  let a = r.actions[name]; if (!a) { const c = RIG.clips[name]; if (!c) return; a = r.actions[name] = r.mixer.clipAction(c); }
  a.timeScale = ts; if (r.cur === a) return;
  a.reset().setEffectiveWeight(1).play(); if (r.cur) a.crossFadeFrom(r.cur, 0.22, false); else a.time = Math.random() * a.getClip().duration;
  r.cur = a;
}
function lodFor(ch) {
  const u = ch.userData; if (u.important) return 0; const e = ch.matrixWorld.elements, c = Q.tier.chars || [18, 55, 12];
  const d = Math.hypot(e[12] - CHAR.camPos.x, e[13] - CHAR.camPos.y, e[14] - CHAR.camPos.z);
  return d < c[0] ? 0 : d < c[1] ? 1 : 2;
}

export function makeCharacter(look, opts = {}) {
  const g = makeProcedural(look); g.userData.look = { ...look }; g.userData.important = !!opts.important; CHAR.list.push(g); return g;
}
export function applyLook(ch, look) {
  const u = ch.userData; u.look = { ...look }; applyProcLook(ch, look);
  if (u.rig) { if ((look.body === 'm' ? 'm' : 'f') !== u.rig.sex) buildRig(ch, look); else setRigLook(ch, look); }
  if (u.real) ensureReal(ch);
}
// per-frame: called by every character's owner while its area is visible
export function animate(ch, t, speed, mode = '') {
  const u = ch.userData; const dt = u.lastT === undefined ? 0 : Math.max(0, Math.min(0.1, t - u.lastT)); u.lastT = t;
  if (RIG.ready && !u.rig && !u.noRig) { const lod = lodFor(ch); if (lod < 2) buildRig(ch, u.look); }
  if (!u.rig) { u.body.visible = true; animateProc(ch, t, speed, mode); return; }
  const lod = lodFor(ch), real = wantReal(ch, u, lod); setLod(ch, lod, real && u.real && u.real.rb);
  if (lod === 2) { animateProc(ch, t, speed, mode); return; }
  const r = u.rig; const [name, ts] = clipFor(u, speed, mode); play(r, name, ts);
  r.acc += dt; const step = lod === 0 ? 0 : 1 / ((Q.tier.chars || [0, 0, 12])[2]);
  if (r.acc >= step) { r.mixer.update(r.acc); r.acc = 0; u.mixF = CHAR.frame; }
  u.animF = CHAR.frame; u.mode = mode;
}
export function rigBones(ch) { return ch.userData.rig ? ch.userData.rig.bones : null; }

// ---------------- DJ Tileo: original lion-headed character on the rigged body ----------------
function lionHead() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0xd99a3c, roughness: 0.75 });
  const furLight = new THREE.MeshStandardMaterial({ color: 0xf3d29a, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.45 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 1, roughness: 0.25, emissive: 0x5a3a00, emissiveIntensity: 0.6 });
  // skull: sculpted sphere (brow ridge, muzzle push, flattened sides)
  const sk = new THREE.SphereGeometry(0.15, 40, 30); const p = sk.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const f = Math.max(0, v.z / 0.15);
    v.z += Math.pow(f, 3) * 0.07 * (v.y < 0.03 ? 1 : 0.4); v.x *= 1 - 0.12 * f; v.y *= v.y > 0 ? 0.95 : 1.05; if (v.y > 0.04 && v.z > 0.07) v.z += 0.012; p.setXYZ(i, v.x, v.y, v.z); }
  sk.computeVertexNormals(); add(g, sk, fur, 0, 0, 0);
  // muzzle pads, chin, nose bridge
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.055, 24, 18), furLight, s * 0.045, -0.045, 0.165, 1, 0.85, 1);
  add(g, new THREE.SphereGeometry(0.045, 20, 14), furLight, 0, -0.095, 0.14, 1, 0.7, 1);
  add(g, new THREE.BoxGeometry(0.06, 0.05, 0.14, 2, 2, 2), fur, 0, 0.015, 0.16).rotation.x = -0.35;
  const nose = add(g, new THREE.SphereGeometry(0.032, 20, 14), dark, 0, -0.012, 0.215, 1.25, 0.75, 0.9);
  add(g, new THREE.SphereGeometry(0.012, 10, 8), dark, 0, -0.06, 0.205, 2.4, 0.5, 0.6);
  // eyes: amber with pupils + brows
  const eyeM = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff8a00, emissiveIntensity: 0.5, roughness: 0.15 });
  for (const s of [-1, 1]) { const e = add(g, new THREE.SphereGeometry(0.022, 18, 14), eyeM, s * 0.058, 0.045, 0.125); add(e, new THREE.SphereGeometry(0.011, 12, 10), dark, 0, 0, 0.016, 0.6, 1, 0.6);
    const br = add(g, new THREE.CapsuleGeometry(0.012, 0.04, 4, 8), fur, s * 0.06, 0.075, 0.125); br.rotation.z = PI / 2 + s * 0.25; br.rotation.y = s * 0.3; }
  // ears
  for (const s of [-1, 1]) { const ear = add(g, new THREE.SphereGeometry(0.045, 16, 12, 0, PI * 2, 0, PI / 2), fur, s * 0.1, 0.12, -0.01, 1, 0.9, 0.45); ear.rotation.z = -s * 0.5;
    add(g, new THREE.SphereGeometry(0.03, 12, 10, 0, PI * 2, 0, PI / 2), dark, s * 0.1, 0.122, 0.006, 1, 0.8, 0.3).rotation.z = -s * 0.5; }
  // mane: ~260 tapered locks on a shell behind / around the face, vertex-coloured gold → rust
  const locks = []; const cone = new THREE.ConeGeometry(0.03, 0.2, 6, 1); cone.translate(0, 0.1, 0);
  const R = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(7); const cA = new THREE.Color(0xf0a33a), cB = new THREE.Color(0x8a3a10), tmp = new THREE.Object3D();
  for (let i = 0; i < 260; i++) {
    const th = R() * PI * 2, ph = Math.acos(1 - 2 * R()); const d = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    if (d.z > 0.55 && d.y < 0.75) continue; // keep the face open
    const len = 0.7 + R() * 0.9 + (d.y < -0.2 ? 0.5 : 0);
    tmp.position.copy(d).multiplyScalar(0.13); tmp.position.z -= 0.02; tmp.quaternion.setFromUnitVectors(UP, d.clone().add(new THREE.Vector3(0, -0.35, -0.15)).normalize()); tmp.scale.set(1 + R() * 0.6, len, 1 + R() * 0.6); tmp.updateMatrix();
    const gg = cone.clone().applyMatrix4(tmp.matrix); const col = cA.clone().lerp(cB, Math.min(1, R() * 0.6 + (1 - d.y) * 0.25)); const n = gg.attributes.position.count, ca = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) col.toArray(ca, k * 3); gg.setAttribute('color', new THREE.BufferAttribute(ca, 3)); locks.push(gg); }
  const mane = new THREE.Mesh(mergeGeometries(locks), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); mane.castShadow = true; g.add(mane);
  // gold headphones + small crown (brand cue, original design)
  const band = add(g, new THREE.TorusGeometry(0.17, 0.014, 8, 32, PI), gold, 0, 0.02, -0.02); band.rotation.y = PI / 2; band.rotation.z = 0;
  for (const s of [-1, 1]) { const cup = add(g, new THREE.CylinderGeometry(0.055, 0.055, 0.04, 24), gold, s * 0.17, 0.0, -0.01); cup.rotation.z = PI / 2;
    add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.042, 24), dark, s * 0.172, 0.0, -0.01).rotation.z = PI / 2; }
  const crown = new THREE.Group(); crown.position.set(0, 0.2, -0.01); g.add(crown);
  add(crown, new THREE.CylinderGeometry(0.06, 0.065, 0.03, 24, 1, true), gold, 0, 0, 0);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * PI * 2; add(crown, new THREE.ConeGeometry(0.014, 0.045, 6), gold, Math.sin(a) * 0.062, 0.035, Math.cos(a) * 0.062); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function makeDJ() {
  const look = { skin: '#c98a3a', hair: '#e8891c', outfit: '#ffffff', style: 'tiger', body: 'm', hairStyle: 'buzzed', banded: false };
  const ch = makeCharacter(look, { important: true }); const u = ch.userData;
  // lowpoly fallback lion head (while loading / if GLBs fail)
  u.hair.visible = false; const gm = M(0xffc94a, { metalness: 0.9, roughness: 0.3 });
  add(u.body, G.ico, M(0xd8701a), 0, 2.0, -0.05, 0.42, 0.44, 0.36); add(u.body, G.sph, M(0xffcf7a), 0, 1.93, 0.17, 0.12, 0.09, 0.08);
  for (const s of [-1, 1]) { add(u.body, G.sph, M(0xd8701a), s * 0.2, 2.25, 0, 0.08, 0.08, 0.05); add(u.body, G.cyl, gm, s * 0.24, 2.0, 0, 0.09, 0.06, 0.09).rotation.z = PI / 2; }
  u.hideHair = true; u.djSetup = false;
  const orig = ch.userData; orig.onRig = r => { // hide the human head (bone scale → 0) and mount the detailed lion head on the neck
    r.bones.Head.scale.setScalar(0.001); r.root.updateMatrixWorld(true);
    const head = lionHead(); const neck = r.bones.neck_01; const hp = r.bones.Head.getWorldPosition(new THREE.Vector3()); hp.y += 0.1 * SCALE; hp.z += 0.01;
    head.position.copy(neck.worldToLocal(hp)); neck.getWorldQuaternion(_q); const wq = new THREE.Quaternion(); r.root.getWorldQuaternion(wq);
    head.quaternion.copy(_q.invert().multiply(wq)); head.scale.setScalar(1.12 / SCALE); neck.add(head); u.extra = head; };
  u.hideRealHead = true;
  u.onReal = rb => { const h = lionHead(), hb = rb.byName.Head, p = new THREE.Vector3().setFromMatrixPosition(rb.bindM.Head); p.y += 0.07; p.z += 0.015;
    rb.attach(hb, h, p, new THREE.Quaternion(), 1.06); u.extraReal = h; };
  return ch;
}

// --- lowpoly lion statue (facing +z) ---
export function makeLion(mat, s = 1) {
  const g = new THREE.Group();
  box(g, mat, 0, 0.9, -0.2, 1.1, 1.1, 2.4);
  for (const [x, z] of [[-0.35, 0.8], [0.35, 0.8], [-0.35, -1.1], [0.35, -1.1]]) box(g, mat, x, 0, z, 0.3, 1.0, 0.3);
  add(g, G.ico, mat, 0, 2.1, 0.9, 0.85, 0.95, 0.75); // mane
  add(g, G.sph, mat, 0, 2.05, 1.45, 0.45, 0.48, 0.42); // face
  add(g, G.box, mat, 0, 1.85, 1.85, 0.3, 0.25, 0.3); // muzzle
  add(g, G.box, mat, 0, 1.5, -1.5, 0.12, 0.12, 0.9).rotation.x = 0.8;
  g.scale.setScalar(s); return g;
}

// --- convertible (facing +z): v6 realistic body from cars.js, piano-black clearcoat, gold rims, tiger-print seats, DJ Tileo livery ---
export function makeCar() {
  const g = new THREE.Group(), K = carParts('convertible'), P = K.P, F = K.F, CM = carMats();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x0b0b10, metalness: 0.6, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b24a, metalness: 1, roughness: 0.2, side: THREE.DoubleSide });
  const screen = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.28, roughness: 0.04, metalness: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const mesh = (geo, m, cast = true) => { const x = new THREE.Mesh(geo, m); x.castShadow = cast; x.receiveShadow = true; g.add(x); return x; };
  mesh(K.paint, paint); mesh(K.glass, screen, false); mesh(K.dark, CM.dark); mesh(K.alloy, gold);
  const hl = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.6, roughness: 0.3 }); g.userData.headMat = hl; mesh(K.head, hl, false);
  mesh(K.tail, glow(0xff2222, 0xff0000, 0.3, 2), false);
  // cockpit: tiger seats, dashboard, steering wheel, gold sill trims
  const seat = new THREE.MeshStandardMaterial({ map: T.tiger, roughness: 0.7 }), dash = M(0x0c0c0e, { roughness: 0.5 });
  // v6.3: seats at real height (cushion top 0.74, measured against the seated pose) so people sit on them, not inside them
  box(g, seat, -0.45, 0.42, -0.46, 0.62, 0.32, 0.5); box(g, seat, 0.45, 0.42, -0.46, 0.62, 0.32, 0.5);
  for (const x of [-0.45, 0.45]) { const bk = box(g, seat, x, 0.7, -0.79, 0.6, 0.72, 0.14); bk.rotation.x = -0.12; add(g, G.sph, seat, x, 1.48, -0.84, 0.17, 0.12, 0.07); }
  box(g, dash, 0, 0.82, 0.62, 1.6, 0.22, 0.34);
  const steer = add(g, G.torus, M(0x1a1a1c), 0.45, 1.13, -0.07, 0.17, 0.17, 0.17); /* rim where the seated driver's hands are (measured) */ /* left-hand drive (+x is the car's left) */ steer.rotation.x = -1.0;
  for (const sd of [-1, 1]) box(g, gold, sd * (F.hw(-0.2) * 0.86), P.belt - 0.02, -0.25, 0.04, 0.03, 1.75);
  // DJ Tileo livery: hood (follows the hood slope) + both doors
  const hz = 1.5, hy = F.top(hz), slope = Math.atan2(F.top(hz + 0.1) - F.top(hz - 0.1), 0.2);
  logoPlane(g, 'dj', 0, hy + 0.012, hz, 0.95, PI, { rx: -PI / 2 + slope });
  const dz = -0.15; logoPlane(g, 'dj', F.hw(dz) + 0.006, 0.66, dz, 0.42, PI / 2); logoPlane(g, 'dj', -F.hw(dz) - 0.006, 0.66, dz, 0.42, -PI / 2);
  // switchable headlights (L / 💡): one shadowless spot + emissive lenses
  const beam = new THREE.SpotLight(0xfff2d0, 0, 70, 0.55, 0.5, 1.2); beam.position.set(0, 0.6, 2.4); beam.target.position.set(0, -0.6, 14); g.add(beam, beam.target); g.userData.beam = beam;
  return g;
}

// =====================================================================================
// Realistic people (people.js): a Rocketbox body follows this character's rig. The player, DJ Tileo and the nearest
// guests (tier cap: Low 4, Med 12, High 24) are realistic; everyone else keeps the rigged or lowpoly stylized body.
// =====================================================================================
export const PEOPLE = { on: true, cands: [], shown: 0 };
export const FACES = RFACES;
export const peopleReady = rigReady.then(ok => { if (ok) { setTigerSource(T.tiger && T.tiger.image); warmPeople(['ftank', 'mtank', 'mpolo', 'ftee', 'fbikini', 'mtrunks', ...(Q.key === 'low' ? [] : ['malea04', 'malea12', 'femalep02', 'femalea03', 'businessm04', 'businessf01'])]); } return ok; });
const SMILE = { dance: 1, dj: 1, wave: 0.9, talk: 0.8, yes: 0.9, phone: 0.6 };
function wantReal(ch, u, lod) {
  if (!PEOPLE.on || lod === 2 || !u.rig || u.noReal) { if (u.real && !u.real.loading) u.realIdle = (u.realIdle || 0) + 1; if (u.real && u.realIdle > 240) dropReal(ch); return false; }
  const e = ch.matrixWorld.elements, d = Math.hypot(e[12] - CHAR.camPos.x, e[13] - CHAR.camPos.y, e[14] - CHAR.camPos.z);
  if (!u.important) PEOPLE.cands.push([u.remote || u.companion ? d * 0.35 : d, ch]); // other players get realistic bodies first
  const want = u.important || !!u.realSlot;
  if (want) { u.realIdle = 0; if (!u.real) ensureReal(ch); }
  else if (u.real && !u.real.loading && ++u.realIdle > 240) dropReal(ch);
  return want;
}
function realOpts(u) { const hi = Q.key === 'high'; return u.important ? { size: Q.key === 'low' ? 512 : 1024, normals: Q.key !== 'low', hideHead: !!u.hideRealHead, smile: 0.55 } : { size: 512, normals: hi, smile: 0.35 + Math.random() * 0.4 }; }
function ensureReal(ch) {
  const u = ch.userData, r = u.rig; if (!r) return; const L = realLook({ ...u.look, body: r.sex });
  if (u.real && u.real.base === L.b) { const R = u.real; R.L = L; if (R.rb) { retexture(R.rb, L, realOpts(u)).catch(() => {}); if ((R.rb.L.g || '') !== (L.g || '')) R.rb.setGlasses(L.g); R.rb.L = L; R.rb.setBand(u.look.banded ? BAND_C : null); R.rb.setAcc(u.look.acc || ''); r.lod_ = -1; } return; }
  if (u.real) dropReal(ch);
  const R = u.real = { base: L.b, rb: null, loading: true, L };
  buildRealBody(r, L, realOpts(u)).then(rb => {
    if (u.real !== R || u.rig !== r) { rb.dispose(); return; }
    R.rb = rb; R.loading = false; rb.holder.visible = false; ch.add(rb.holder);
    rb.setBand(u.look.banded ? BAND_C : null); rb.setAcc(u.look.acc || '');
    if (u.onReal) u.onReal(rb);
    if (JSON.stringify(R.L) !== JSON.stringify(L)) ensureReal(ch);
    r.lod_ = -1;
  }).catch(e => { console.warn('[people]', e); if (u.real === R) { R.loading = false; u.noReal = true; u.real = null; } });
}
function dropReal(ch) { const u = ch.userData, R = u.real; u.real = null; u.realIdle = 0; if (R && R.rb) R.rb.dispose(); if (u.extraReal) u.extraReal = null; if (u.rig) u.rig.lod_ = -1; }
// once per frame, after every character has been animated (and after the selfie arm pose)
export function syncCharacters(dt) {
  const f = CHAR.frame; let shown = 0;
  for (const ch of CHAR.list) { const u = ch.userData, rb = u.real && u.real.rb; if (!rb || !rb.holder.visible || u.animF !== f) continue;
    if (u.important || u.mixF === f || !rb.synced) { rb.sync(u.important ? dt : 1 / 12, SMILE[u.mode]); rb.synced = true; } shown++; }
  PEOPLE.shown = shown;
  // pick the nearest guests for next frame (with a little hysteresis so nobody flickers at the edge)
  const c = PEOPLE.cands, cap = PEOPLE.on ? (Q.tier.people ?? 12) : 0; c.sort((a, b) => a[0] - b[0]);
  const cut = c.length > cap ? c[cap][0] : 1e9;
  for (let i = 0; i < c.length; i++) { const u = c[i][1].userData; u.realSlot = i < cap && (u.realSlot ? true : c[i][0] < cut * 0.97 || c.length <= cap); }
  PEOPLE.cands = []; CHAR.frame++;
}
// remove a character for good (multiplayer: a player left)
export function disposeCharacter(ch) { const i = CHAR.list.indexOf(ch); if (i >= 0) CHAR.list.splice(i, 1); const u = ch.userData; if (u.real) dropReal(ch); if (u.rig && u.rig.mixer) u.rig.mixer.stopAllAction(); ch.removeFromParent(); }
export function setPeople(on) { PEOPLE.on = !!on; if (!on) for (const ch of CHAR.list) if (ch.userData.real) dropReal(ch); }
