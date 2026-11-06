// Epic or Fail: Vegas Trip, Stage 2: your bestie. A 3D companion who follows you everywhere (car, limo, pools, club),
// with their own Energy / Hunger / Buzz / Mood, a floating name tag + speech bubble, loved activities, and a 2 AM habit of wandering off.
import { BESTIES, WANDER, WANDER_TEXT, OUTFITS } from './data.js?v=1793986352';

const clamp = v => Math.max(0, Math.min(100, v));
export const moodFace = m => m >= 80 ? '🤩' : m >= 60 ? '😀' : m >= 40 ? '😐' : m >= 20 ? '😕' : '😤';

export function createBestie(G, T, api) { // api: { text(from, msg), fun(n, why), toast }
  const key = T.bestie; if (!key || !BESTIES[key]) return null;
  const B = BESTIES[key], bf = T.bf, { state, player } = G;
  const base = { name: B.n, skin: '#d9a47c', hair: '#1a1209', banded: true, hairStyle: B.look.body === 'm' ? 'parted' : 'long', ...B.look };
  if (G.faceFor && G.faceFor(G.save.look) === base.face) base.face = B.alt; // never your twin
  G.comp.adopt(base, { depth: p => G.waterDepth(p) });
  let lookKey = '', bubT = 12, bubUntil = 0, bubTxt = '', v = new G.THREE.Vector3();
  const tag = document.createElement('div'); tag.className = 'ntag bfTag'; tag.innerHTML = '<i class="nbub"></i><span class="nname"></span>'; G.$('nameTags').appendChild(tag);
  const nm = tag.querySelector('.nname'), bub = tag.querySelector('.nbub'); nm.style.setProperty('--band', '#ff6ec7');
  const ch = () => G.comp.active && G.comp.active.ch;

  function wantLook() { const L = { ...base }; const w = T.wearing, bd = L.body;
    if (state.area && state.area.id === 'pool') { L.style = 'swim'; L.outfit = B.look.outfit; }
    else if (w === 'squad') Object.assign(L, OUTFITS.squad.look(bd));
    return L; }
  function say(txt, secs = 6) { bubTxt = txt; bubUntil = performance.now() + secs * 1000; bubT = 20 + Math.random() * 12; }
  function request() { // what they want right now
    if (bf.lost) return null;
    if (bf.hunger < 28) return ['I am STARVING. Tacos? Burger? Anything? 🌮', 'Feed me or I turn into a gremlin.'][Math.random() * 2 | 0];
    if (bf.buzz > 72) return 'Water. Waterrr. 💧 (Check-in menu)';
    if (bf.energy < 22) return 'I need a nap. Or a Red Bull IV. 😴';
    if (bf.mood < 35) return 'This trip is kinda mid so far… 😕';
    if (bf.mood > 85) return ['BEST. TRIP. EVER. 🤩', 'I love you. I love Vegas. I love this carpet.'][Math.random() * 2 | 0];
    return B.lines[Math.random() * B.lines.length | 0]; }

  function update(dt, t) {
    const C = G.comp.active; if (!C) return;
    const L = wantLook(), k = L.style + L.outfit + (L.cut || ''); if (k !== lookKey) { lookKey = k; G.comp.setLook(L); }
    C.mood = bf.energy < 15 ? '' : ''; // idle pose stays default; dancing / swimming mirror you (companion.js)
    // rescue: walk up to them where they wandered off
    if (bf.lost) { const S = WANDER[bf.lost]; if (state.area && state.area.id === S.area && Math.hypot(player.position.x - S.x, player.position.z - S.z) < 3) rescue(); }
    // speech bubble
    bubT -= dt; if (bubT <= 0 && !bf.lost) { const r = request(); if (r) say(r); else bubT = 15; }
    const c = ch(), talking = performance.now() < bubUntil;
    nm.textContent = `${B.n} ${moodFace(bf.mood)} ${Math.round(bf.mood)}%`;
    if (bub.dataset.x !== (talking ? bubTxt : '')) { bub.dataset.x = talking ? bubTxt : ''; bub.textContent = talking ? bubTxt : ''; bub.style.display = talking ? '' : 'none'; }
    const show = c && c.visible && !state.ui && state.started && !document.body.classList.contains('photoMode') && !state.tripShow;
    if (!show) { tag.style.display = 'none'; return; }
    const seat = C.seat === 'car' || C.seat === 'limo'; v.set(c.position.x, c.position.y + (seat ? 1.55 : 2.0), c.position.z); const d = v.distanceTo(G.camera.position); v.project(G.camera);
    if (v.z > 1 || d > 45) { tag.style.display = 'none'; return; }
    tag.style.display = ''; tag.style.transform = `translate(${((v.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - v.y) / 2 * innerHeight).toFixed(1)}px) translate(-50%, -100%)`; tag.style.opacity = d > 25 ? Math.max(0.4, 1 - (d - 25) / 30).toFixed(2) : ''; }

  // meters, per game hour h; act: '' | 'sleep' | 'nap' | 'work' | 'show'
  function tick(h, act, ctx) {
    const rest = act === 'sleep' || act === 'nap';
    if (bf.lost) { bf.energy = clamp(bf.energy - 3 * h); bf.hunger = clamp(bf.hunger - 5 * h); bf.buzz = clamp(bf.buzz - 10 * h); return; }
    bf.energy = clamp(bf.energy + (rest ? 12 : -4 - (ctx.dancing ? 4 : 0)) * h); bf.hunger = clamp(bf.hunger - (rest ? 2.5 : 6) * h); bf.buzz = clamp(bf.buzz - (rest ? 16 : 12) * h);
    let dm = (55 - bf.mood) * 0.05; // drift
    if (bf.hunger < 25) dm -= 6; if (bf.energy < 20) dm -= 6; if (bf.buzz > 80) dm -= 7; if (ctx.vibe > 70) dm += 4; if (ctx.vibe < 25) dm -= 3;
    if (ctx.dancing && ctx.area === 'club') dm += B.likes.includes('dance') ? 14 : 6;
    if (ctx.area === 'needle' && B.likes.includes('needle')) dm += 8; if (ctx.limo && B.likes.includes('limo')) dm += 10; if (ctx.hotTub) dm += B.likes.includes('hotTub') ? 14 : 4;
    if (ctx.casino && (B.likes.includes('slots') || B.likes.includes('rl') || B.likes.includes('bj'))) dm += 3;
    if (rest) dm = (65 - bf.mood) * 0.1;
    bf.mood = clamp(bf.mood + dm * h); }

  function mood(n, line) { bf.mood = clamp(bf.mood + n); if (line) say(line, 5); }
  // you did something: they love it, like it, or just tag along
  function react(k) { if (!present()) return 0; if (B.likes.includes(k)) { mood(12, ['YESSS. This is why I came. 🙌', 'Okay THIS is the trip. 🤩', 'You get me. You really get me.'][Math.random() * 3 | 0]); return 2; } mood(3); return 1; }
  function feed(item) { const fx = item.fx || {}; if (fx.hunger) bf.hunger = clamp(bf.hunger + fx.hunger); if (fx.energy) bf.energy = clamp(bf.energy + fx.energy); if (fx.buzz) bf.buzz = clamp(bf.buzz + fx.buzz); mood(5); }
  function present() { return !!G.comp.active && !bf.lost; }

  // 2 AM wander-off: they slip away to a landmark and text you a clue
  function wander(spot) { const S = WANDER[spot]; bf.lost = spot; bf.lostAt = T.min; G.comp.hold({ area: S.area, x: S.x, z: S.z, ry: S.ry, mode: S.mode, y: 0 });
    const lines = WANDER_TEXT[spot]; api.text(B.n, lines[Math.random() * lines.length | 0]); }
  function rescue() { const S = WANDER[bf.lost]; bf.lost = null; G.comp.hold(null); mood(15, ['FOUND ME! 🥹 Best friend ever.', 'You came for me!! Ride or die. 🫶'][Math.random() * 2 | 0]); api.fun(200, `Rescued ${B.n} from ${S.where}`); }
  function comeHome(penalty, msg) { if (!bf.lost) return; bf.lost = null; G.comp.hold(null); mood(-penalty); api.text(B.n, msg); }
  function dispose() { tag.remove(); G.comp.release(); }
  return { B, key, bf, update, tick, mood, react, feed, present, wander, rescue, comeHome, say, dispose, get lost() { return bf.lost; } };
}
