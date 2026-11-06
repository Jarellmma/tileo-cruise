// Epic or Fail: Vegas Trip skill jobs: DJ Booth Rhythm Gig and Bartending Rush. Each draws into a card element and resolves with a score.
import { RECIPES, INGREDIENTS } from './data.js?v=1794000555';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

// DJ Booth gig: tap DROP when the needle crosses the gold zone. 10 drops, faster each time. Resolves { acc (0..1), perfect, hits }
export function djGig(card, { wide = false, hype = '' } = {}) {
  return new Promise(resolve => {
    card.innerHTML = ''; const N = 10, W = wide ? 0.21 : 0.14;
    card.append(h('h2', '', '🎧 DJ Booth Gig'), h('p', 'fine', `Tap <b>DROP</b> (or Space) when the needle hits the gold zone. ${N} drops, each one faster.${wide ? ' <b>Booth Plug:</b> wider zone.' : ''}`));
    const track = h('div', 'djTrack'), zone = h('div', 'djZone'), needle = h('div', 'djNeedle'), beat = h('div', 'djBeat'); track.append(zone, needle, beat);
    const info = h('div', 'djInfo'), feed = h('div', 'gFeed', hype || '&nbsp;'), btn = h('button', 'gold gBig', 'DROP 🔊');
    card.append(track, info, feed, btn);
    let i = 0, sum = 0, perfect = 0, hits = 0, c = 0.5, ph = Math.random() * 6, last = performance.now(), wait = 0, raf = 0, done = false;
    const place = () => { c = 0.22 + Math.random() * 0.56; zone.style.left = ((c - W / 2) * 100) + '%'; zone.style.width = (W * 100) + '%'; info.textContent = `Drop ${i + 1} / ${N} · accuracy ${Math.round(sum / Math.max(1, i) * 100)}%`; };
    const pos = () => 0.5 + 0.5 * Math.sin(ph);
    function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; if (wait > 0) wait -= dt; else ph += dt * (1.7 + i * 0.2);
      needle.style.left = (pos() * 100) + '%'; beat.style.opacity = (0.25 + 0.75 * Math.max(0, Math.sin(now / 1000 * 7.2))).toFixed(2); if (!done) raf = requestAnimationFrame(frame); }
    function drop() { if (done || wait > 0) return; const d = Math.abs(pos() - c) / (W / 2); let q = 0, msg;
      if (d <= 0.35) { q = 1; perfect++; hits++; msg = ['🔥 PERFECT drop! The floor loses it.', '💥 PERFECT! Hands in the air.', '🦁 PERFECT! DJ Tileo nods.'][i % 3]; }
      else if (d <= 1) { q = 0.6; hits++; msg = ['👍 Good drop.', '🎶 Nice, on beat.', '✨ Smooth.'][i % 3]; }
      else msg = ['😬 Trainwreck! Someone dropped their drink.', '🙉 Off-beat… the crowd boos politely.', '💀 That was a ringtone, not a drop.'][i % 3];
      sum += q; i++; feed.textContent = msg; track.classList.remove('hit', 'miss'); void track.offsetWidth; track.classList.add(q ? 'hit' : 'miss'); wait = 0.35;
      if (i >= N) { done = true; cancelAnimationFrame(raf); removeEventListener('keydown', key, true); setTimeout(() => resolve({ acc: sum / N, perfect, hits }), 650); info.textContent = `Set over · accuracy ${Math.round(sum / N * 100)}%`; }
      else place(); }
    const key = e => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); e.stopPropagation(); drop(); } };
    btn.onclick = drop; btn.addEventListener('pointerdown', e => e.stopPropagation()); addEventListener('keydown', key, true);
    place(); raf = requestAnimationFrame(frame);
  });
}

// Bartending Rush: 6 customers order 3-ingredient drinks off the recipe board. Resolves { correct, tips, served }
export function bartend(card, { hype = '' } = {}) {
  return new Promise(resolve => {
    card.innerHTML = ''; const N = 6, names = Object.keys(RECIPES);
    card.append(h('h2', '', '🍹 Bartending Rush'));
    const board = h('div', 'bBoard', Object.entries(RECIPES).map(([n, r]) => `<div><b>${n}</b> · ${r.join(' + ')}</div>`).join(''));
    const order = h('div', 'bOrder'), timer = h('div', 'gTimer', '<i></i>'), glass = h('div', 'bGlass'), grid = h('div', 'bIngr'), feed = h('div', 'gFeed', hype || '&nbsp;');
    card.append(board, order, timer, glass, grid, feed);
    let k = 0, correct = 0, tips = 0, want = null, picked = [], t0 = 0, lim = 8, raf = 0, done = false, busy = false;
    const btns = INGREDIENTS.map(n => { const b = h('button', 'bI', n); b.onclick = () => pick(n, b); b.addEventListener('pointerdown', e => e.stopPropagation()); grid.append(b); return b; });
    const CUST = ['A guy in a "Bride Squad" sash', 'A sunburned tourist', 'A high roller in velvet', 'Two very tall Elvises', 'A tired croupier on break', 'A bachelorette in a tiara'];
    function next() { if (k >= N) return finish(); want = names[Math.floor(Math.random() * names.length)]; picked = []; busy = false; btns.forEach(b => b.classList.remove('on'));
      lim = Math.max(5.5, 8 - k * 0.45); t0 = performance.now(); order.innerHTML = `Customer ${k + 1} / ${N}: ${CUST[k % CUST.length]}<br>“One <b>${want}</b>, please!”`; glass.textContent = '🥃 Tap 3 ingredients'; }
    function pick(n, b) { if (done || busy || !want) return; const i = picked.indexOf(n); if (i >= 0) { picked.splice(i, 1); b.classList.remove('on'); } else if (picked.length < 3) { picked.push(n); b.classList.add('on'); }
      glass.textContent = picked.length ? '🥃 ' + picked.join(' + ') : '🥃 Tap 3 ingredients'; if (picked.length === 3) serve(); }
    function serve(timeout) { busy = true; const r = RECIPES[want], ok = !timeout && r.every(x => picked.includes(x)), left = Math.max(0, 1 - (performance.now() - t0) / 1000 / lim);
      if (ok) { correct++; const tip = 4 + Math.round(6 * left); tips += tip; feed.textContent = `✅ Perfect ${want}! +$${tip} tip`; }
      else feed.textContent = timeout ? '⌛ Too slow: they wandered off to the slots.' : `❌ That ${want} tastes like regret. No tip.`;
      k++; setTimeout(next, 750); }
    function finish() { done = true; cancelAnimationFrame(raf); order.innerHTML = `Shift over · ${correct} / ${N} perfect drinks`; setTimeout(() => resolve({ correct, tips, served: N }), 700); }
    function frame(now) { if (done) return; if (want && !busy) { const f = Math.max(0, 1 - (now - t0) / 1000 / lim); timer.firstChild.style.width = (f * 100) + '%'; if (f <= 0) serve(true); } raf = requestAnimationFrame(frame); }
    next(); raf = requestAnimationFrame(frame);
  });
}
