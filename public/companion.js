// Invite a guest (v6.3): walk up to almost any guest (Strip, casino, pool, club) and invite them to hang out.
// Your guest follows you between places, rides in the convertible's passenger seat and on the limo's J-seat,
// dances when you dance, and goes back to what they were doing when you say goodbye.
import * as THREE from 'three';
import { CHAR, makeCharacter, animate } from './characters.js?v=1793979068';

const NAMES = { f: ['Mia', 'Jasmine', 'Sofia', 'Aaliyah', 'Chloe', 'Nia', 'Valentina', 'Zoe', 'Imani', 'Lena', 'Brianna', 'Camila'],
  m: ['Marcus', 'Diego', 'Andre', 'Liam', 'Malik', 'Jalen', 'Rafael', 'Noah', 'Darius', 'Leo', 'Isaiah', 'Mateo'] };
const hashLook = L => { let h = 7; for (const ch of JSON.stringify([L.skin, L.hair, L.outfit, L.face, L.seed])) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
export const guestName = L => { const list = NAMES[L.body === 'm' ? 'm' : 'f']; return list[hashLook(L) % list.length]; };

// G: { scene, player, car, state, limo, toast, isTouch }
export function initCompanion(G) {
  const { state, player } = G, v = new THREE.Vector3(), w = new THREE.Vector3();
  let C = null; // { ch, orig, name, area, seat }
  let scanT = 0, cand = null;
  const PASS = new THREE.Vector3(-0.45, 0.25, -0.2); // convertible passenger seat (the car's right side; +x is its left)

  // a guest you can invite: visible, nearby, not the player / another player / staff
  function scan() {
    cand = null; if (C || state.driving || state.limo || state.cine || state.ride) return;
    let best = 2.2;
    for (const ch of CHAR.list) { const u = ch.userData;
      if (ch === player || u.important || u.remote || u.companion || u.noInvite || u.invited || (u.look && u.look.role === 'business')) continue;
      if (!visibleInWorld(ch)) continue;
      ch.getWorldPosition(v); const d = Math.hypot(v.x - player.position.x, v.z - player.position.z);
      if (d < best && Math.abs(v.y - player.position.y) < 1.5) { best = d; cand = ch; } }
  }
  function visibleInWorld(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
  function invite(ch) {
    const L = { ...ch.userData.look }; L.name = guestName(L); delete L.fixed;
    const c = makeCharacter(L); c.userData.companion = true; c.userData.noInvite = true; G.scene.add(c);
    ch.getWorldPosition(v); c.position.copy(v); c.rotation.y = Math.atan2(player.position.x - v.x, player.position.z - v.z);
    ch.visible = false; ch.userData.invited = true;
    C = { ch: c, orig: ch, name: L.name, area: state.area.id, seat: '', look: L };
    G.toast(`🥂 ${L.name} is hanging out with you. They'll follow you, ride in your car and join you in the limo.`);
  }
  function dismiss() { if (!C) return; const { ch, orig, name } = C; ch.removeFromParent(); const i = CHAR.list.indexOf(ch); if (i >= 0) CHAR.list.splice(i, 1);
    orig.visible = true; orig.userData.invited = false; C = null; G.toast(`👋 ${name} heads back to the party.`); }

  // behind you and a little to the right
  function followPoint(out) { const r = player.rotation.y; out.set(player.position.x - Math.sin(r) * 1.3 - Math.cos(r) * 0.8, player.position.y, player.position.z - Math.cos(r) * 1.3 + Math.sin(r) * 0.8); return out; }
  function update(dt, t) {
    scanT -= dt; if (scanT <= 0) { scanT = 0.25; scan(); }
    if (!C) return; const c = C.ch; c.updateMatrixWorld(); // keeps its distance-based detail (and the rigged, seated pose) current
    if (state.cine || state.ride) { c.visible = false; C.seat = 'away'; return; } // Sky Needle elevator / riding with another player: they wait
    c.visible = true;
    if (state.driving) { const car = G.car; v.copy(PASS); car.localToWorld(v); c.position.copy(v); c.rotation.y = car.rotation.y; C.seat = 'car'; animate(c, t, 0, 'drive'); return; }
    if (state.limo && G.limo.grp.visible) { G.limo.seatWorld(G.limo.grp, 0, v); c.position.copy(v); c.rotation.y = G.limo.grp.rotation.y + Math.PI / 2; C.seat = 'limo'; animate(c, t, 0, 'sit'); return; }
    if (C.seat === 'car') { const car = G.car, h = car.rotation.y; c.position.set(car.position.x - Math.cos(h) * 2.2, 0, car.position.z + Math.sin(h) * 2.2); } // out on the passenger side
    if (C.seat || C.area !== state.area.id) { if (C.seat !== 'car') { followPoint(w); c.position.copy(w); } C.area = state.area.id; C.seat = ''; }
    followPoint(w); const dx = w.x - c.position.x, dz = w.z - c.position.z, d = Math.hypot(dx, dz);
    if (d > 30) { c.position.copy(w); animate(c, t, 0, ''); return; }
    c.position.y = player.position.y;
    if (d > 0.5) { const sp = Math.min(12, d * 2.2 + 1.5), k = Math.min(1, sp * dt / d); c.position.x += dx * k; c.position.z += dz * k;
      const ty = Math.atan2(dx, dz); c.rotation.y += wrap(ty - c.rotation.y) * Math.min(1, dt * 10); animate(c, t, sp, ''); }
    else { c.rotation.y += wrap(player.rotation.y - c.rotation.y) * Math.min(1, dt * 4); animate(c, t, 0, state.emote === 'dance' ? 'dance' : state.emote === 'wave' ? 'wave' : ''); }
  }
  const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  // interaction offered by main.js's nearest()
  function action() {
    if (C && !state.driving && !state.limo && C.ch.visible && Math.hypot(C.ch.position.x - player.position.x, C.ch.position.z - player.position.z) < 1.8) return { label: `Say goodbye to ${C.name}`, act: dismiss };
    if (cand && !C) { const L = cand.userData.look || {}; return { label: `Invite ${guestName(L)} to hang out 🥂`, act: () => invite(cand) }; }
    return null;
  }
  return { update, action, dismiss, get active() { return C; }, get inCar() { return !!C && state.driving; }, get inLimo() { return !!C && !!state.limo; } };
}
