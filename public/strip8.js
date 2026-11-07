// v8: a bigger Strip with more real-landmark lookalikes (parody names, like the rest of the game) and the airport.
//   Aurum & Bravo · bronze twin crescent towers with script signatures, a garden mountain with a waterfall, a flower-carpet garden (north Strip, east)
//   Power Chord   · a ~200 m guitar-shaped hotel tower on the old volcano-resort lot (west, across from Venezia); its strings light up at night
//   Sin City International · terminal with vaulted roofs, arrivals curb with taxis, control tower, apron with parked jets, and a runway
//                   south of the Strip where planes land and take off right over the south end
//   Welcome to Sin City · an original neon welcome sign on the median at the south end
import * as THREE from 'three';
import { M, B, neon, glow, onNight, signMesh, PI, goldM, chromeM, canvas, tex, pbr, rep, T, rng } from './core.js?v=1794015301';
import { rect, arcBand, inset, Batch, facade } from './city.js?v=1794015301';
import { carParts, carMats } from './cars.js?v=1794015301';

const UP = new THREE.Vector3(0, 1, 0);
function bar(b, mat, ax, ay, az, bx, by, bz, r = 0.3, seg = 6) { const a = new THREE.Vector3(ax, ay, az), c = new THREE.Vector3(bx, by, bz), L = a.distanceTo(c), g = new THREE.CylinderGeometry(r, r, L, seg, 1);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, c.clone().sub(a).normalize()); g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))); b.add(mat, g); }
const sphere = (b, mat, x, y, z, rx, ry = rx, rz = rx, seg = 12) => b.geo(mat, new THREE.SphereGeometry(1, seg, Math.max(6, seg / 2 | 0)), x, y, z, rx, ry, rz);
const CONE8 = new THREE.ConeGeometry(1, 1, 8);
function flat(g, mat, x, z, w, d, y = 0.05) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = -PI / 2; m.position.set(x, y, z); m.receiveShadow = true; g.add(m); return m; }
let night = true; onNight(n => { night = n; });

// signature script on a transparent canvas (mirrored when it goes on the inside of a curved facade)
function scriptTex(text, color, mirror) { const w = 1024, h = 256, [c, x] = canvas(w, h); x.clearRect(0, 0, w, h); if (mirror) { x.translate(w, 0); x.scale(-1, 1); }
  let fs = h * 0.8; const f = s => `italic 700 ${s}px Georgia, 'Times New Roman', serif`; x.font = f(fs); while (x.measureText(text).width > w * 0.9) { fs -= 4; x.font = f(fs); }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = color; x.shadowBlur = 22; x.fillStyle = color; x.fillText(text, w / 2, h * 0.55); x.shadowBlur = 0; x.globalAlpha = 0.6; x.fillStyle = '#fffaf0'; x.fillText(text, w / 2, h * 0.55); return tex(c); }
// a sign that follows a concave curved facade (inside of a cylinder, so the text is drawn mirrored)
function curvedSign(g, text, color, cx, cz, r, y, h, half) { const geo = new THREE.CylinderGeometry(r, r, h, 32, 1, true, PI / 2 - half, half * 2);
  const m = new THREE.Mesh(geo, neon(0xffffff, { map: scriptTex(text, color, true), transparent: true, depthWrite: false, side: THREE.DoubleSide }, 0.9, 1.55)); m.position.set(cx, y, cz); m.renderOrder = 2; g.add(m); return m; }

// an airliner (nose toward -x), ~38 m long; used parked at the gates and flying the runway
export function makePlane(tailColor, opts = {}) { const p = new THREE.Group(), body = M(0xf4f5f7, { roughness: 0.35, metalness: 0.2 }), tm = M(tailColor, { roughness: 0.4 }), dark = M(0x262a30, { roughness: 0.5, metalness: 0.4 }), win = M(0x10161e, { roughness: 0.12, metalness: 0.7 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; p.add(m); return m; };
  add(new THREE.CylinderGeometry(2, 2, 28, 18), body, 0, 3, 0, 0, 0, PI / 2);
  const nose = add(new THREE.SphereGeometry(2, 18, 12), body, -14, 3, 0); nose.scale.set(2.6, 1, 1);
  add(new THREE.ConeGeometry(2, 9, 18), body, 18.4, 3.5, 0, 0, 0, -PI / 2);
  const flatShape = (pts, depth, mat, y, zOff = 0) => { const s = new THREE.Shape(pts.map(([a, b2]) => new THREE.Vector2(a, b2))); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.rotateX(-PI / 2); g.translate(0, y, zOff); const m = new THREE.Mesh(g, mat); m.castShadow = true; p.add(m); return m; };
  flatShape([[-4, 0], [6.2, 17], [8.6, 17], [5, 0], [8.6, -17], [6.2, -17]], 0.55, body, 2.1); // swept wing
  flatShape([[13.5, 0], [17.4, 6.4], [19, 6.4], [18.2, 0], [19, -6.4], [17.4, -6.4]], 0.3, body, 4.4); // tailplane
  { const s = new THREE.Shape([new THREE.Vector2(12, 0), new THREE.Vector2(18.6, 0), new THREE.Vector2(20.4, 7.6), new THREE.Vector2(17.4, 7.6)]); const g = new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: false }); g.translate(0, 4.5, -0.22); const m = new THREE.Mesh(g, tm); m.castShadow = true; p.add(m); }
  for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(1.1, 1.0, 4.6, 14), dark, -2.6, 1.25, s * 6.4, 0, 0, PI / 2); add(new THREE.CylinderGeometry(0.9, 0.9, 0.1, 14), tm, -4.95, 1.25, s * 6.4, 0, 0, PI / 2); }
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(22, 0.5, 0.1), win, -0.5, 3.75, s * 1.97);
  add(new THREE.BoxGeometry(1.6, 0.6, 2.4), win, -17.4, 3.9, 0, 0, 0, -0.5);
  add(new THREE.BoxGeometry(30, 0.35, 4.02), tm, 0.5, 2.35, 0); // belly stripe
  const gear = new THREE.Group(); p.add(gear); for (const [x, z] of [[-12, 0], [1.5, 2.4], [1.5, -2.4]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12), dark); w.rotation.x = PI / 2; w.position.set(x, 0.55, z); gear.add(w); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6), dark); st.position.set(x, 1.3, z); gear.add(st); }
  p.userData.gear = gear;
  if (opts.lights) { const red = B(0xff2a1a), green = B(0x1aff5a), white = B(0xffffff), land = B(0xfff4d8);
    const L = (m, x, y, z, s = 0.35) => { const q = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), m); q.position.set(x, y, z); p.add(q); return q; };
    L(red, 8.4, 2.4, 17.1); L(green, 8.4, 2.4, -17.1); const st1 = L(white, 20.2, 12.1, 0, 0.45), st2 = L(white, 22.6, 3.6, 0, 0.4), ll = L(land, -19.2, 2.9, 0, 0.6);
    p.userData.blink = t => { const on = (t * 1.1) % 1 < 0.08; st1.visible = st2.visible = on; ll.visible = night; }; }
  return p; }

export function parkedTaxis(g, list) { const K = carParts('taxi'), CM = carMats(), n = list.length, lm = new THREE.MeshBasicMaterial({ vertexColors: true }); onNight(nn => lm.color.setScalar(nn ? 1 : 0.32));
  const parts = [new THREE.InstancedMesh(K.paint, CM.paint, n), new THREE.InstancedMesh(K.glass, CM.glass, n), new THREE.InstancedMesh(K.dark, CM.dark, n), new THREE.InstancedMesh(K.alloy, CM.alloy, n), new THREE.InstancedMesh(K.lights, lm, n)];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
  list.forEach(([x, z, ry], i) => { q.setFromAxisAngle(UP, ry); m4.compose(v.set(x, 0.05, z), q, s); for (const pm of parts) pm.setMatrixAt(i, m4); parts[0].setColorAt(i, new THREE.Color(0xf2c200)); });
  for (const pm of parts) { pm.castShadow = true; pm.computeBoundingSphere(); g.add(pm); } }

// original "Welcome to Sin City" cabinet sign (front faces the Strip, back says goodbye)
function welcomeTex(front) { const W = 512, H = 1024, [c, x] = canvas(W, H); x.clearRect(0, 0, W, H);
  const arch = () => { x.beginPath(); x.moveTo(26, H - 20); x.lineTo(26, 250); x.arc(W / 2, 250, W / 2 - 26, PI, 0); x.lineTo(W - 26, H - 20); x.closePath(); };
  arch(); const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a0a3a'); gr.addColorStop(0.55, '#14061e'); gr.addColorStop(1, '#07030c'); x.fillStyle = gr; x.fill();
  x.lineWidth = 14; x.strokeStyle = '#e8b64a'; x.stroke(); x.lineWidth = 3; x.strokeStyle = '#fff1c4'; x.stroke();
  // marquee bulbs around the arch
  x.fillStyle = '#fff4c8'; x.shadowColor = '#ffd76a'; x.shadowBlur = 10; const bulb = (u, v) => { x.beginPath(); x.arc(u, v, 6, 0, PI * 2); x.fill(); };
  for (let v = H - 44; v > 250; v -= 34) { bulb(46, v); bulb(W - 46, v); } for (let k = 0; k <= 16; k++) { const a = PI + PI * k / 16; bulb(W / 2 + Math.cos(a) * (W / 2 - 46), 250 + Math.sin(a) * (W / 2 - 46)); }
  x.shadowBlur = 0; x.textAlign = 'center'; x.textBaseline = 'middle';
  const txt = (s, y, size, col, glowC, font = '900') => { x.font = `${font} ${size}px Georgia, serif`; x.shadowColor = glowC; x.shadowBlur = 18; x.fillStyle = col; x.fillText(s, W / 2, y); x.shadowBlur = 0; };
  // crown
  x.fillStyle = '#ffcf4a'; x.shadowColor = '#ffb020'; x.shadowBlur = 16; x.beginPath(); x.moveTo(176, 238); x.lineTo(166, 150); x.lineTo(214, 196); x.lineTo(256, 128); x.lineTo(298, 196); x.lineTo(346, 150); x.lineTo(336, 238); x.closePath(); x.fill(); x.shadowBlur = 0;
  for (const u of [166, 256, 346]) { x.beginPath(); x.arc(u, u === 256 ? 122 : 144, 11, 0, PI * 2); x.fillStyle = '#ff4fa8'; x.fill(); }
  if (front) { txt('WELCOME TO', 318, 54, '#ffffff', '#9fd8ff'); txt('SIN', 470, 230, '#ff4fa8', '#ff4fa8'); txt('CITY', 668, 200, '#ffcf4a', '#ffb020');
    txt('★  LAS VEGAS  ★', 812, 46, '#9fd8ff', '#4dd8ff', '700'); txt('THE STRIP · NEVADA', 880, 34, '#f3e6c4', '#ffcf4a', '700'); }
  else { txt('DRIVE SAFE', 380, 70, '#ffcf4a', '#ffb020'); txt('Come back', 520, 96, '#ff4fa8', '#ff4fa8', 'italic 700'); txt('SOON', 660, 150, '#ffffff', '#9fd8ff'); txt('★ SIN CITY ★', 840, 44, '#9fd8ff', '#4dd8ff', '700'); }
  const t = tex(c); t.anisotropy = 4; return t; }
function welcomeSign(g, solid, x, z, ry) { const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = ry; g.add(grp); const gold = goldM(0.45, 0.25), dark = M(0x120a18, { roughness: 0.6 });
  const W = 4.4, H = 8.6, y0 = 2.6, s = new THREE.Shape(); s.moveTo(-W / 2, 0); s.lineTo(W / 2, 0); s.lineTo(W / 2, H - W / 2); s.absarc(0, H - W / 2, W / 2, 0, PI, false); s.closePath();
  const cab = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false, curveSegments: 20 }); cab.translate(0, y0, -0.25); const cm = new THREE.Mesh(cab, dark); cm.castShadow = true; grp.add(cm);
  for (const [front, zz, r] of [[true, -0.27, PI], [false, 0.27, 0]]) { const fg = new THREE.ShapeGeometry(s, 20), P = fg.attributes.position, U = fg.attributes.uv; for (let i = 0; i < P.count; i++) U.setXY(i, (P.getX(i) + W / 2) / W, P.getY(i) / H);
    const f = new THREE.Mesh(fg, neon(0xffffff, { map: welcomeTex(front) }, 0.95, 1.4)); f.position.set(0, y0, zz); f.rotation.y = r; grp.add(f); }
  for (const sx of [-1, 1]) { const pole = new THREE.Mesh(new THREE.BoxGeometry(0.45, y0 + H + 1.6, 0.3), gold); pole.position.set(sx * 1.3, (y0 + H + 1.6) / 2, 0); pole.castShadow = true; grp.add(pole); }
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 2.4), M(0x8a7a66, { roughness: 0.9 })); base.position.y = 0.25; grp.add(base);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), neon(0xffcf4a, {}, 0.8, 1.8)); star.position.set(0, y0 + H + 1.9, 0); grp.add(star);
  solid(x - 2.4, x + 2.4, z - 1.3, z + 1.3); return { grp, star }; }

export function buildLandmarks8(K) {
  const { g, A, solid, sign, facadeSign, landmark, T0, fins, band, cap, roofKit, gold, stone, gray, aviation, makeWater, palms } = K;
  const R = rng(8080), out = {};

  // ===================== Aurum & Bravo (north Strip, east): bronze twin crescents, concave to the Strip =====================
  { const b = new Batch(), CX = 22, rim = M(0x4a3518, { roughness: 0.3, metalness: 0.9 }), podRoof = M(0x3a3026, { roughness: 0.85 });
    const twin = (cz, H, name, col, accent) => { const a = 0.33, pts = arcBand(CX, cz, 64, 79, -a, a, 18);
      T0(b, 'goldGlass', pts, 12, H); fins(b, 'goldGlass', pts, 12, H, T0.uo); band(b, rim, pts, H - 0.8, 0.8, 1.0);
      const mid = arcBand(CX, cz, 65.6, 77.4, -a * 0.64, a * 0.64, 12); T0(b, 'goldGlass', mid, H, H + 12, { roof: podRoof }); cap(b, rim, mid, H + 12, 1.4, 1.004); roofKit(b, mid, H + 13.4, 2);
      for (const s of [-1, 1]) cap(b, rim, arcBand(CX, cz, 64.4, 78.6, s > 0 ? a * 0.64 : -a, s > 0 ? a : -a * 0.64, 5), H, 0.9, 1.0); // the end bays step down
      const pod = rect(85, cz, 50, 48); T0(b, 'darkGlass', pod, 0, 12, { roof: podRoof }); band(b, gold, pod, 11.4, 0.6, 1.004); band(b, neon(accent, {}, 0.3, 1.5), pod, 3.2, 0.3, 1.006);
      curvedSign(g, name, col, CX, cz, 63.3, H - 8, 9, 0.26); solid(60, 110, cz - 24, cz + 24); landmark(name, 85, cz); };
    twin(-238, 180, 'Aurum', '#ffe6b0', 0xffc870); twin(-162, 186, 'Bravo', '#ffb0bc', 0xff5a78);
    // Aurum: a garden mountain with pines and a waterfall into a lake hides the resort from the Strip
    { const cz = -238, leaf = M(0x35612c, { roughness: 0.95 }), leaf2 = M(0x2a5026, { roughness: 0.95 }), pine = M(0x1d3a20, { roughness: 0.9 }), trunk = M(0x4a3420, { roughness: 0.9 }), rock = M(0x8c7c68, { roughness: 0.95 });
      const mounds = [[46, cz + 2, 15, 22, 21], [36, cz - 13, 10, 14, 9], [38, cz + 16, 10, 16, 7.5], [54, cz - 11, 9, 18, 12], [55, cz + 14, 8, 20, 9]];
      for (const [x, z, rx, ry, rz] of mounds) sphere(b, R() < 0.5 ? leaf : leaf2, x, 0, z, rx, ry, rz, 18);
      const hAt = (x, z) => { let h = 0; for (const [mx, mz, rx, ry, rz] of mounds) { const q = 1 - ((x - mx) / rx) ** 2 - ((z - mz) / rz) ** 2; if (q > 0) h = Math.max(h, ry * Math.sqrt(q)); } return h; };
      for (let k = 0; k < 60; k++) { const x = 27 + R() * 36, z = cz - 22 + R() * 44, y = hAt(x, z); if (y < 2.5) continue; const s = 0.7 + R() * 0.7; b.cyl(trunk, x, y - 0.6, z, 0.25 * s, 2.2 * s, 6); b.geo(pine, CONE8, x, y + 1.4 * s + 3.6 * s, z, 2.3 * s, 7.2 * s, 2.3 * s); }
      const wfM = new THREE.MeshStandardMaterial({ map: rep(T.water, 1, 4), color: 0xeaf6ff, emissive: 0x2a4a5a, emissiveIntensity: 0.4, transparent: true, opacity: 0.86, roughness: 0.2, depthWrite: false });
      onNight(n => { wfM.emissiveIntensity = n ? 1.1 : 0.35; });
      const wf = new THREE.Mesh(new THREE.PlaneGeometry(9, 15.8), wfM); wf.position.set(32.9, 8.1, cz + 2); wf.rotation.order = 'YXZ'; wf.rotation.set(-0.275, -PI / 2, 0); // leans back against the mountain g.add(wf); A.anim.push(t => { wfM.map.offset.y = (t * 0.9) % 1; });
      for (const [x, z, s] of [[30.6, cz - 4, 2.2], [30.9, cz + 8.4, 2.6], [31.6, cz + 2, 1.5], [29.8, cz - 8, 1.6]]) sphere(b, rock, x, 0.5, z, s, s * 0.8, s, 8);
      b.prism(stone, stone, rect(28, cz + 2, 10.8, 23), 0, 0.28); makeWater(g, 10, 22, 28, 0.34, cz + 2, { color: 0x14506a, size: 2 });
      solid(23, 60, cz - 24, cz + 24); sign('AURUM', '#ffe6b0', 25, cz - 32, 'RESORT · CASINO'); }
    // Bravo: glass porte-cochère and a flower-carpet garden
    { const cz = -162, bed = M(0x2f5a28, { roughness: 0.95 }), fl = [M(0xd8243c, { roughness: 0.7 }), M(0xff6f9a, { roughness: 0.7 }), M(0xfff4f4, { roughness: 0.7 })], canopy = M(0x24252a, { roughness: 0.45, metalness: 0.6 });
      b.box(canopy, 51, 6, cz, 14, 0.5, 30); b.box(gold, 44, 5.95, cz, 0.15, 0.6, 30.2); for (const dz of [-13, 13]) { b.cyl(gold, 46, 0, cz + dz, 0.35, 6, 12); solid(45.5, 46.5, cz + dz - 0.5, cz + dz + 0.5); }
      b.box(neon(0xffe0d0, {}, 0.2, 1.1), 51, 5.95, cz, 12, 0.05, 28);
      for (const [x0, x1, z0, z1] of [[24, 42, cz - 22, cz - 7], [24, 42, cz + 7, cz + 22]]) { b.prism(stone, bed, rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0), 0, 0.5); solid(x0, x1, z0, z1);
        for (let k = 0; k < 80; k++) sphere(b, fl[k % 3], x0 + 0.8 + R() * (x1 - x0 - 1.6), 0.56, z0 + 0.8 + R() * (z1 - z0 - 1.6), 0.5, 0.32, 0.5, 6); }
      for (const dz of [-22, 22]) for (const x of [28, 38]) palms.push([x, cz + dz, 9 + R() * 3, 0.5]);
      facadeSign('BRAVO', '#ffb0bc', 59.7, 9.2, cz, 18, 3.4, 1); sign('BRAVO', '#ffb0bc', 25, cz - 26, 'RESORT · CASINO'); }
    b.flush(g); }

  // ===================== Power Chord (west, the old volcano-resort lot across from Venezia): guitar-shaped hotel tower =====================
  { const cz = -100, X = -100, Y = 10, b = new Batch(), PH = 14;
    const pod = rect(-99, cz, 82, 92, 0, 3); T0(b, 'darkGlass', pod, 0, PH, { roof: M(0x2a2a30, { roughness: 0.9 }) }); band(b, neon(0xb46cff, {}, 0.3, 1.6), pod, PH - 0.6, 0.6, 1.004); band(b, gold, pod, 4, 0.3, 1.006);
    const ex = (shape, depth, z0, bev = 1.2) => { const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 28 }); geo.translate(0, 0, z0); return geo; };
    const place = (mat, geo) => b.geo(mat, geo, X, Y, cz, 1, 1, 1, PI / 2); // shape u -> world -z, v -> up, depth -> +x (toward the Strip)
    const body = new THREE.Shape(); body.moveTo(0, 0);
    body.bezierCurveTo(20, 0, 37, 7, 37, 25); body.bezierCurveTo(37, 37, 28, 40, 28, 50); body.bezierCurveTo(28, 60, 31, 70, 22, 74); body.bezierCurveTo(16, 77, 11, 70, 8, 62);
    body.lineTo(-8, 62); body.bezierCurveTo(-11, 72, -16, 84, -24, 82); body.bezierCurveTo(-32, 80, -31, 62, -29, 52); body.bezierCurveTo(-27, 42, -37, 38, -37, 25); body.bezierCurveTo(-37, 7, -20, 0, 0, 0);
    place(facade('glassBlue'), ex(body, 28, -14));
    const neck = new THREE.Shape(); neck.moveTo(-7.5, 56); neck.lineTo(7.5, 56); neck.lineTo(6.4, 150);
    neck.bezierCurveTo(9.5, 153, 11.5, 159, 10.5, 165); neck.bezierCurveTo(9.5, 175, 4, 183, -3, 183); neck.bezierCurveTo(-9.5, 183, -11.5, 177, -10.5, 171); neck.lineTo(-7.6, 156); neck.lineTo(-6.4, 150); neck.closePath();
    place(facade('darkGlass'), ex(neck, 12, 2));
    const FX = X + 15.2; // the guitar's face (world x)
    const fb = new THREE.Shape([new THREE.Vector2(-7, 60), new THREE.Vector2(7, 60), new THREE.Vector2(6, 150), new THREE.Vector2(-6, 150)]); place(M(0x2a1a12, { roughness: 0.55 }), ex(fb, 0.5, 15.2, 0));
    const pg = new THREE.Shape(); pg.moveTo(-8.5, 62); pg.lineTo(8.5, 62); pg.bezierCurveTo(12, 66, 19, 64, 22, 56); pg.bezierCurveTo(25, 46, 24, 34, 18, 26); pg.bezierCurveTo(13, 19, 4, 16, -4, 19);
    pg.bezierCurveTo(-12, 22, -16, 34, -16, 44); pg.bezierCurveTo(-16, 54, -12, 60, -8.5, 62); place(M(0xf3eee6, { roughness: 0.3 }), ex(pg, 0.4, 15.2, 0));
    const fretM = goldM(0.6, 0.2), pearl = M(0xf8f4ea, { roughness: 0.2 }), chrome = chromeM(0.15), blackM = M(0x0c0c0e, { roughness: 0.4 });
    const Lsc = 122.4, nut = 150, at = v => cz; // straight neck
    for (let k = 1; k <= 21; k++) { const v = nut - Lsc * (1 - Math.pow(2, -k / 12)), hw = 7 - (v - 60) / 90; b.box(fretM, FX + 0.55, Y + v - 0.2, at(v), 0.3, 0.4, hw * 2); }
    for (const k of [3, 5, 7, 9, 12, 15, 17, 19]) { const v = nut - Lsc * (1 - Math.pow(2, -(k - 0.5) / 12)); for (const dz of k === 12 ? [-2.6, 2.6] : [0]) sphere(b, pearl, FX + 0.55, Y + v, cz + dz, 0.15, 1.1, 1.1, 10); }
    b.box(pearl, FX + 0.5, Y + nut - 0.6, cz, 0.7, 1.2, 12.8);
    const bridgeV = nut - Lsc; b.box(chrome, FX + 0.7, Y + bridgeV - 1.5, cz, 1.2, 3, 13); for (const [v, w] of [[38, 12], [47, 12], [56, 12]]) { b.box(blackM, FX + 0.6, Y + v - 1.5, cz, 0.9, 3, w); for (let s = 0; s < 6; s++) sphere(b, chrome, FX + 1.06, Y + v, cz - 5 + s * 2, 0.1, 0.45, 0.45, 8); }
    for (const [u, v] of [[15, 31], [18, 37], [19.5, 44]]) bar(b, chrome, FX + 0.3, Y + v, cz - u, FX + 1.5, Y + v, cz - u, 1.5, 14);
    // tuners on the headstock
    const posts = [[-5.6, 160], [-5.6, 166], [-5.6, 172], [5.6, 157], [5.6, 162], [5.6, 167]]; for (const [u, v] of posts) bar(b, chrome, FX + 0.1, Y + v, cz - u, FX + 1.8, Y + v, cz - u, 0.8, 12);
    b.flush(g); solid(-140, -58, cz - 46, cz + 46);
    // six strings (bridge -> nut -> tuner posts), light-chase colours at night; a glowing outline around the body
    const strM = []; for (let s = 0; s < 6; s++) { const m = new THREE.MeshBasicMaterial({ color: 0xc8ccd4 }); strM.push(m); const sb = new Batch(), ub = -5 + s * 2, un = -4.5 + s * 1.8, [pu, pv] = posts[s];
      bar(sb, m, FX + 1.25, Y + bridgeV, cz - ub, FX + 1.25, Y + nut, cz - un, 0.16 + (5 - s) * 0.03, 5); bar(sb, m, FX + 1.25, Y + nut, cz - un, FX + 1.8, Y + pv, cz - pu, 0.14, 5); sb.flush(g, false, false); }
    const op = body.getPoints(90).map(p => new THREE.Vector3(FX + 0.5, Y + p.y, cz - p.x)), outline = new THREE.MeshBasicMaterial({ color: 0xb46cff });
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(op, true), 260, 0.45, 6, true), outline));
    const nk = [new THREE.Vector2(7.43, 62), ...neck.getPoints(40).filter(p => p.y > 149), new THREE.Vector2(-7.43, 62)].map(p => new THREE.Vector3(FX + 0.1, Y + p.y, cz - p.x)); g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(nk, false), 160, 0.35, 6, false), outline));
    const cS = new THREE.Color(), DAY = new THREE.Color(0xc8ccd4);
    A.anim.push(t => { for (let s = 0; s < 6; s++) { if (night) strM[s].color.setHSL((t * 0.12 + s / 6) % 1, 0.95, 0.5 + 0.2 * Math.max(0, Math.sin(t * 4 - s * 0.8))).multiplyScalar(1.7); else strM[s].color.copy(DAY); }
      if (night) outline.color.setHSL((0.78 + 0.06 * Math.sin(t * 0.5)) % 1, 0.9, 0.55).multiplyScalar(1.6); else outline.color.set(0x6a4a8a); });
    // forecourt: entrance canopy, palms, signage
    const fb2 = new Batch(); fb2.box(M(0x24252a, { roughness: 0.45, metalness: 0.6 }), -62, 6, cz, 8, 0.5, 34); fb2.box(neon(0xd8b0ff, {}, 0.2, 1.1), -62, 5.95, cz, 7, 0.05, 32); for (const dz of [-15, 15]) { fb2.cyl(gold, -66, 0, cz + dz, 0.3, 6, 10); solid(-66.5, -65.5, cz + dz - 0.5, cz + dz + 0.5); }
    fb2.flush(g); for (const dz of [-36, -24, 24, 36]) palms.push([-34, cz + dz, 9 + R() * 3, 0.4]);
    facadeSign('POWER CHORD', '#d49cff', -57.7, 9.5, cz, 26, 4.2, -1); sign('POWER CHORD', '#d49cff', -25, cz - 28, 'HOTEL · CASINO · LIVE'); landmark('Power Chord', -100, cz); }

  // ===================== Sin City International: terminal, arrivals curb, control tower =====================
  { const cz = 593, b = new Batch(), white = M(0xf3f2ee, { roughness: 0.45, metalness: 0.25 }), conc = M(0xd9d4ca, { roughness: 0.85 }), asph = pbr('asphalt', 12 / 4, 100 / 4, { color: 0x8e8e90, macro: [0.04, 0.2] });
    const paver = pbr('sidewalk', 1, 1, { macro: [0.03, 0.18], color: 0xc4c0bb }), curb = pbr('concrete', 0.25, 0.25, { color: 0xe8e4dc }), stripe = M(0xf2f2ee, { roughness: 0.6 }), yel = M(0xe8c547, { roughness: 0.6 });
    const term = rect(113, cz, 134, 82); T0(b, 'glassBlue', term, 0, 15, { roof: white }); fins(b, 'glassBlue', term, 0, 15, T0.uo); band(b, white, term, 14.2, 1, 1.003);
    const VW = 82 / 3, vault = (w, rise) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.quadraticCurveTo(0, rise * 2, w / 2, 0); s.lineTo(w / 2 - 0.7, 0); s.quadraticCurveTo(0, rise * 2 - 1.6, -w / 2 + 0.7, 0); s.closePath(); return s; };
    const lun = w => { const s = new THREE.Shape(); s.moveTo(-w / 2 + 0.7, 0); s.quadraticCurveTo(0, 6.5 * 2 - 1.6, w / 2 - 0.7, 0); s.closePath(); return new THREE.ShapeGeometry(s, 16); };
    for (let i = 0; i < 3; i++) { const zc = 552 + VW * (i + 0.5); b.geo(white, new THREE.ExtrudeGeometry(vault(VW + 1, 6.5), { depth: 146, bevelEnabled: false, curveSegments: 18 }), 40, 15, zc, 1, 1, 1, PI / 2);
      b.geo(facade('glassBlue'), lun(VW + 1), 46.2, 15, zc, 1, 1, 1, -PI / 2); b.geo(facade('glassBlue'), lun(VW + 1), 179.8, 15, zc, 1, 1, 1, PI / 2); }
    solid(46, 180, 552, 634);
    // arrivals road + sidewalk under a long canopy
    flat(g, asph, 30, cz, 12, 100, 0.05); for (let z = 548; z < 640; z += 8) b.box(stripe, 30, 0.06, z, 0.2, 0.02, 4);
    for (const z of [545, 641]) { flat(g, asph, 18, z, 8.2, 8, 0.17); flat(g, asph, 22.5, z, 3, 8, 0.07); }
    b.prism(curb, paver, rect(41, cz, 10, 86), 0, 0.15); b.box(yel, 36.05, 0.15, cz, 0.12, 0.02, 86);
    b.box(white, 35, 7.2, cz, 22, 0.7, 76); b.box(M(0xb8bcc2, { roughness: 0.4, metalness: 0.6 }), 24.1, 6.6, cz, 0.3, 1.9, 76);
    const dl = neon(0xfff0d8, {}, 0.25, 1.15); for (let z = cz - 34; z <= cz + 34; z += 6) for (const x of [28, 34, 40]) b.box(dl, x, 7.15, z, 1.2, 0.04, 0.5);
    for (let z = cz - 33; z <= cz + 33; z += 11) { b.cyl(white, 37, 0.15, z, 0.35, 7.05, 12); solid(36.6, 37.4, z - 0.4, z + 0.4); }
    signMesh(g, 'ARRIVALS · BAGGAGE CLAIM · TAXI · LIMO', '#ffffff', 23.9, 7.55, cz, 26, 1.7, -PI / 2, '', '#123050');
    signMesh(g, 'SIN CITY INTERNATIONAL', '#8fdcff', 45.7, 11.4, cz, 54, 4.6, -PI / 2, '', '#0a1420');
    signMesh(g, 'AIRPORT', '#ffffff', 45.6, 17.4, 565.7, 12, 2.4, -PI / 2, '', '#0a1420'); signMesh(g, '✈', '#ffcf4a', 45.6, 17.4, 620.3, 3, 2.4, -PI / 2, '', '#0a1420');
    // sliding glass doors (open as you walk up)
    const frame = M(0x5a6068, { roughness: 0.3, metalness: 0.8 }), dglass = new THREE.MeshStandardMaterial({ color: 0xa8c4d8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.45, depthWrite: false });
    b.box(frame, 45.9, 0, cz - 3.6, 0.4, 3.6, 0.3); b.box(frame, 45.9, 0, cz + 3.6, 0.4, 3.6, 0.3); b.box(frame, 45.9, 3.4, cz, 0.4, 0.3, 7.5); b.box(B(0x0b0f16), 46.05, 0, cz, 0.1, 3.4, 7);
    const dL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.3, 3.5), dglass), dR = dL.clone(); dL.position.set(45.75, 1.65, cz - 1.75); dR.position.set(45.75, 1.65, cz + 1.75); g.add(dL, dR);
    const D = { k: 0, want: 0 }; A.anim.push((t, dt, P) => { const near = P && Math.hypot(P.x - 43, P.z - cz) < 7; D.k += ((near || D.want ? 1 : 0) - D.k) * Math.min(1, dt * 4); dL.position.z = cz - 1.75 - D.k * 3.1; dR.position.z = cz + 1.75 + D.k * 3.1; });
    parkedTaxis(g, [[30, 571, PI], [30, 579, PI], [30, 615, PI], [30, 623, PI]]); for (const z of [571, 579, 615, 623]) solid(28.8, 31.2, z - 2.5, z + 2.5);
    // control tower
    { const tx = 166, tz = 538, cab = glow(0x1a2a3a, 0x8fd0ff, 0.05, 0.7, { roughness: 0.08, metalness: 0.7 }); b.cyl(conc, tx, 0, tz, 5, 4, 18); b.cyl(conc, tx, 4, tz, 3.4, 56, 18, 2.7);
      b.cyl(white, tx, 60, tz, 2.7, 1.6, 16, 6.4); b.cyl(cab, tx, 61.6, tz, 6.4, 5, 12, 7.2); b.cyl(white, tx, 66.6, tz, 7.8, 1, 12); b.cyl(gray, tx, 67.6, tz, 2.2, 2.6, 8);
      b.box(gray, tx, 70.2, tz, 0.25, 9, 0.25); sphere(b, aviation, tx, 79.6, tz, 0.6, 0.6, 0.6, 8); solid(tx - 5, tx + 5, tz - 5, tz + 5); }
    b.flush(g); out.airport = { doorX: 46, doorZ: cz, doors: D }; landmark('Sin City International', 113, cz);
    sign('SIN CITY INT\'L', '#8fdcff', 25, 536, 'AIRPORT · ARRIVALS'); }

  // ===================== airfield: apron with parked jets, runway 8/26 south of the Strip, planes landing and taking off =====================
  { const asph = M(0x45464a, { roughness: 0.95 }), mark = M(0xf4f4f0, { roughness: 0.7 }), b = new Batch(), RZ = 742;
    flat(g, asph, 340, 625, 320, 150, 0.04); flat(g, asph, 330, 703, 30, 80, 0.045); flat(g, M(0x3a3b3e, { roughness: 0.95 }), 1230, RZ, 2340, 46, 0.05);
    for (let x = 140; x < 2380; x += 60) b.box(mark, x, 0.06, RZ, 30, 0.02, 0.9); for (let k = 0; k < 8; k++) for (const s of [-1, 1]) b.box(mark, 85, 0.06, RZ + s * (3 + k * 2.4), 40, 0.02, 1.6);
    for (const s of [-1, 1]) b.box(mark, 1230, 0.06, RZ + s * 21.5, 2340, 0.02, 0.6);
    for (let k = 0; k < 3; k++) { const z = 566 + k * 27, jet = makePlane([0xff6a00, 0x7b2cbf, 0x1f6fb8][k]); jet.position.set(219, 0, z); g.add(jet); b.box(M(0xd9d4ca, { roughness: 0.8 }), 190, 4, z + 3.4, 20, 3, 3); b.box(gray, 199, 0, z + 3.4, 1, 4, 1); }
    const n = 2 * Math.ceil(2340 / 60), lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), neon(0xfff2c0, {}, 0.15, 2.4), n), m4 = new THREE.Matrix4(); let i = 0;
    for (let x = 60; x < 2400 && i < n; x += 60) for (const s of [-1, 1]) m4.makeTranslation(x, 0.4, RZ + s * 23.5), lights.setMatrixAt(i++, m4); lights.count = i; g.add(lights);
    b.flush(g);
    // two planes: one landing on 26L (from the east), one taking off on 26R (west, climbing out over the south end of the Strip)
    const land = makePlane(0xff6a00, { lights: true }), up = makePlane(0x7b2cbf, { lights: true }); g.add(land, up); land.visible = up.visible = false;
    A.anim.push(t => { const P = 80;
      { const s = t % P; land.visible = s < 55; if (land.visible) { let x, y = 0, pitch = -0.03; if (s < 30) { x = 3400 - 63.3 * s; y = (x - 1500) * 0.0524; } else { const u = s - 30; x = 1500 - (63.3 * u - 1.1 * u * u); pitch = u < 3 ? -0.03 * (1 - u / 3) : 0; }
          land.position.set(x, y, RZ - 8); land.rotation.z = pitch; land.userData.gear.visible = true; land.userData.blink(t); } }
      { const s = (t + 40) % P; up.visible = s < 78; if (up.visible) { let x, y = 0, pitch = 0; if (s < 35) { x = 2300 - 1.1 * s * s; } else { const u = s - 35; x = 953 - 77 * u; y = Math.min(0.14 * 77 * u, 0.14 * 77 * u); pitch = -Math.min(0.14, u * 0.05); }
          up.position.set(x, y, RZ + 8); up.rotation.z = pitch; up.userData.gear.visible = y < 60; up.userData.blink(t); } } }); }

  // ===================== Welcome to Sin City (median, south end; faces the Strip) =====================
  { const w = welcomeSign(g, solid, 0, 606, 0); A.anim.push(t => { w.star.rotation.y = t * 0.8; }); }
  return out;
}
