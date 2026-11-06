// Epic or Fail: Vegas Trip: places and people that only exist on a trip (built when the trip loads; Free Play never sees them).
const SPOTS = {
  cart: { x: 27.5, z: -309.5 },              // Strip, on the TILEO KINGDOM forecourt by the curb
  pickpocket: { x: -19.6, z: 226.5 },        // Strip sidewalk at the Bellissimo Fountains
};
export { SPOTS };

export function buildTripWorld(G, A) { // A: { onVenue(key), onSteak(), onShower(), onBed(), onDJ(), onRevue(), onFrontDesk(), quest(): stage, onClue(n) }
  const { THREE, areas, makeCharacter, animate } = G;
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.05 }, o));
  const gold = M(0xffc94a, { metalness: 0.9, roughness: 0.28 }), dark = M(0x0e0d0c, { roughness: 0.4 }), chrome = M(0xdfe4ea, { metalness: 0.95, roughness: 0.15 });
  const bx = (p, m, x, y0, z, w, h, d) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y0 + h / 2, z); o.castShadow = o.receiveShadow = true; p.add(o); return o; };
  const cy = (p, m, x, y0, z, r, h, seg = 18) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y0 + h / 2, z); o.castShadow = true; p.add(o); return o; };
  const sign = (p, lines, x, y, z, w, h, ry, col = '#ffcf4a', bg = '#0e0d0c') => { const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = col; g.lineWidth = 6; g.strokeRect(8, 8, c.width - 16, c.height - 16); g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    const L = Array.isArray(lines) ? lines : [lines]; L.forEach((t, i) => { const fs = i === 0 ? Math.min(c.height / (L.length + 0.6), 64) : Math.min(c.height / (L.length + 1.6), 34); g.font = `bold ${fs}px system-ui,sans-serif`; g.fillText(t, c.width / 2, c.height * (i + 0.5) / L.length, c.width - 30); });
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tx, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.55, roughness: 0.6 })); m.position.set(x, y, z); m.rotation.y = ry; p.add(m); return m; };
  const person = (area, look, x, z, ry, mode = '') => { const ch = makeCharacter({ name: '', ...look }); ch.userData.noInvite = true; ch.position.set(x, areas[area].floorY || 0, z); ch.rotation.y = ry; areas[area].group.add(ch);
    areas[area].anim.push(t => { if (ch.visible) animate(ch, t, 0, typeof mode === 'function' ? mode() : mode); }); return ch; };
  const out = { npcs: {} };

  // ---------- Strip: late-night taco & water cart ----------
  { const S = areas.strip, g = new THREE.Group(), { x, z } = SPOTS.cart; g.position.set(x, 0, z); g.rotation.y = -Math.PI / 2; S.group.add(g); // the serving side faces the sidewalk (-x)
    bx(g, M(0xe8e2d6, { metalness: 0.6, roughness: 0.3 }), 0, 0.35, 0, 2.6, 0.95, 1.2); bx(g, M(0xd0342c), 0, 1.3, 0.62, 2.62, 0.18, 0.06); bx(g, chrome, 0, 1.3, 0, 2.7, 0.06, 1.3);
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 16), dark); w.rotation.x = Math.PI / 2; w.position.set(sx * 0.9, 0.32, -0.66); g.add(w); }
    cy(g, chrome, 0, 1.36, 0, 0.04, 1.6); const um = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.7, 12, 1, true), M(0xffd23a, { side: THREE.DoubleSide })); um.position.set(0, 3.15, 0); g.add(um);
    const um2 = new THREE.Mesh(new THREE.ConeGeometry(1.92, 0.71, 12, 1, true, 0, Math.PI / 6), M(0xd0342c, { side: THREE.DoubleSide })); for (let k = 0; k < 6; k++) { const s = um2.clone(); s.rotation.y = k * Math.PI / 3; s.position.copy(um.position); g.add(s); }
    sign(g, ['TACOS · AGUA', 'open 24/7 · cash only'], 0, 1.95, 0.66, 2.2, 0.55, 0, '#1a1206', '#ffd23a');
    const l = new THREE.PointLight(0xffd08a, 6, 10, 1.5); l.position.set(0, 2.6, 0.8); g.add(l);
    S.aabbs.push([x - 0.8, x + 0.8, z - 1.5, z + 1.5]);
    out.npcs.cart = person('strip', { body: 'm', face: 'malea17', outfit: '#ffffff', style: 'solid', cut: 'tank' }, x + 0.9, z, -Math.PI / 2); }

  // ---------- Strip: the flamingo-jacket pickpocket (wallet quest, step 3) ----------
  out.npcs.pick = person('strip', { body: 'm', face: 'malea04', outfit: '#ff6ec7', style: 'solid', cut: 'polo', glasses: 'aviator' }, SPOTS.pickpocket.x, SPOTS.pickpocket.z, Math.PI / 2, () => A.quest() === 2 ? 'phone' : '');
  out.npcs.pick.visible = false;

  // ---------- Lobby & casino ----------
  { const L = areas.lobby, g = L.group;
    // Lion Lounge Bar on the casino floor (south wall)
    bx(g, dark, 28, 0, 20.2, 7, 1.15, 1.2); bx(g, gold, 28, 1.15, 20.2, 7.2, 0.08, 1.35); bx(g, M(0x2a1f12), 28, 0, 24.3, 8, 3.4, 0.8);
    for (let k = 0; k < 9; k++) cy(g, M([0xffd23a, 0x66ccff, 0xff3355][k % 3], { emissive: [0xffb000, 0x2288ff, 0xff2244][k % 3], emissiveIntensity: 0.6 }), 24.8 + k * 0.8, 1.45 + (k % 2) * 0.9, 24.05, 0.07, 0.42, 10);
    sign(g, ['LION LOUNGE', 'cocktails · burgers · water'], 28, 4.3, 24.62, 5.4, 1.3, Math.PI);
    for (let k = 0; k < 4; k++) cy(g, gold, 25.4 + k * 1.75, 0, 18.9, 0.26, 0.78, 12);
    L.aabbs.push([24.4, 31.6, 19.5, 21]); L.aabbs.push([23.9, 32.1, 23.8, 25]);
    out.npcs.bar = person('lobby', { body: 'f', face: 'femalea03', outfit: '#111111', style: 'solid', cut: 'tee' }, 28, 22.2, Math.PI, 'talk');
    L.interacts.push({ x: 28, z: 17.7, r: 2.6, label: 'Lion Lounge Bar · order', act: () => A.onVenue('lionbar') });
    // Lion's Den Steakhouse host stand (east wall of the lobby, by the elevators)
    bx(g, dark, 16.8, 0, -17, 0.9, 1.15, 0.7); bx(g, gold, 16.8, 1.15, -17, 1, 0.05, 0.8);
    sign(g, ["LION'S DEN", 'STEAKHOUSE · prime tomahawk'], 19.42, 4.2, -17, 6, 1.6, -Math.PI / 2);
    const sl = new THREE.PointLight(0xffb070, 8, 12, 1.6); sl.position.set(17.5, 3.2, -17); g.add(sl);
    L.aabbs.push([16.3, 17.3, -17.4, -16.6]);
    out.npcs.host = person('lobby', { body: 'm', face: 'mpolo', outfit: '#111111', style: 'solid', cut: 'polo', role: 'business' }, 17.8, -17.6, -Math.PI / 2);
    L.interacts.push({ x: 15.2, z: -17, r: 2.4, label: "Lion's Den Steakhouse · table for…", act: () => A.onVenue('steak') });
    // wallet quest: lobby security by the Gold Lion Fountain, the casino pit boss
    out.npcs.guard = person('lobby', { body: 'm', face: 'malea12', outfit: '#111111', style: 'solid', role: 'business', glasses: 'aviator' }, 6.6, -2.2, -Math.PI / 2 - 0.3);
    L.aabbs.push([6.15, 7.05, -2.65, -1.75]);
    L.interacts.push({ x: 6.6, z: -2.2, r: 2.4, when: () => A.quest() === 0, label: 'Ask lobby security about your wallet 🕵️', act: () => A.onClue(0) });
    out.npcs.boss = person('lobby', { body: 'f', face: 'businessf01', outfit: '#111111', style: 'solid', role: 'business' }, 45.4, 9.6, -Math.PI / 2 - 0.5, 'fold');
    L.interacts.push({ x: 45.4, z: 9.6, r: 2.3, when: () => A.quest() === 1, label: 'Ask the pit boss about the flamingo jacket 🦩', act: () => A.onClue(1) }); }

  // ---------- Suite 2407: rain shower with a Strip view ----------
  { const R = areas.room, g = R.group, glass = new THREE.MeshPhysicalMaterial({ color: 0xc8d8e0, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
    bx(g, M(0xe8e4dc, { roughness: 0.25 }), 6, 0, -8.3, 3.2, 0.12, 2.8);
    for (const [x, z, w, d] of [[4.42, -8.3, 0.03, 2.8], [6, -6.92, 3.2, 0.03]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(w, 2.5, d), glass); p.position.set(x, 1.37, z); g.add(p); }
    bx(g, chrome, 4.42, 0.12, -6.92, 0.06, 2.5, 0.06); cy(g, chrome, 6, 3.1, -8.3, 0.35, 0.05, 20); cy(g, chrome, 6, 3.15, -8.3, 0.03, 1.4, 8);
    sign(g, ['RAIN SHOWER'], 6, 3.6, -9.88, 1.8, 0.4, 0);
    R.aabbs.push([4.35, 7.6, -9.8, -6.85]);
    R.interacts.push({ x: 3.4, z: -7.7, r: 1.7, label: 'Hot rain shower (30 min) 🚿', act: () => A.onShower() });
    const bed = R.interacts.find(i => i.label === 'Lie down (rest)'); if (bed) { bed.label = 'Bed · nap or sleep 😴'; bed.act = () => A.onBed(); } }

  // ---------- Mega Club: DJ gigs, Thunder From the Kingdom ----------
  { const C = areas.club, g = C.group;
    C.interacts.push({ x: -5.4, z: -19.6, r: 2.1, label: 'Work a DJ Booth gig (2 h) 🎧', act: () => A.onDJ() });
    bx(g, dark, -17, 0, 18, 1.4, 1.1, 0.8); bx(g, gold, -17, 1.1, 18, 1.5, 0.06, 0.9); cy(g, gold, -17, 0, 19, 0.06, 3.4);
    sign(g, ['THUNDER FROM THE KINGDOM', 'dance revue · nightly 7 PM to 2 AM · $35'], -17, 3.9, 19.02, 4.6, 1.15, Math.PI, '#ffcf4a', '#3a0a18');
    C.aabbs.push([-17.8, -16.2, 17.5, 18.5]);
    C.interacts.push({ x: -17, z: 16.6, r: 2.3, label: 'Thunder From the Kingdom · tickets 🎟️', act: () => A.onRevue() }); }

  // revue performers (made on demand, removed after the show)
  out.revue = (on) => { const C = areas.club; if (!on) { for (const p of out.dancers || []) { p.removeFromParent(); const i = G.CHAR.list.indexOf(p); if (i >= 0) G.CHAR.list.splice(i, 1); } out.dancers = null; return; }
    const looks = [{ body: 'm', face: 'mtank', style: 'gold' }, { body: 'm', face: 'malea17', style: 'tiger' }, { body: 'm', face: 'malea16', style: 'tiger' }, { body: 'm', face: 'malea08', style: 'gold' }];
    out.dancers = looks.map((L, i) => { const ch = makeCharacter({ name: '', outfit: '#ffc94a', glasses: i % 2 ? 'aviator' : '', ...L }); ch.userData.noInvite = true; ch.userData.important = true; ch.position.set([-6.2, -3.2, 3.2, 6.2][i], 1.6, -22.3); C.group.add(ch); return ch; }); };
  out.animDancers = (t, k) => { for (const [i, ch] of (out.dancers || []).entries()) animate(ch, t, 0, k === 2 || k === 5 ? (i % 2 ? 'wave' : 'yes') : 'dance'); };
  return out;
}
