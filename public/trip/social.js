// Epic or Fail: Vegas Trip, Stage 4: a real friend in the bestie slot (over the website's multiplayer) + trip leaderboards.
// Pairing needs no server changes: each player's presence carries `tr` = { k: trip type, d: day, b: the name of the buddy they asked,
// w: wishes done, f: fun, e: trip over }. Two players who name each other are trip buddies. Together (same place, within 25 m) everyday
// Fun is +25%, and when your buddy completes a wish with you there you get +250 Fun. If your buddy drops out, an NPC bestie can take over.
// Leaderboards: POST /trip/score and GET /trip/top on the TILEO KINGDOM server; every device also keeps its own best trips.
import { RANKS, TRIP_TYPES, BACKSTORIES, BESTIES } from './data.js?v=1793988736';
const BEST_KEY = 'tileoKingdom.tripBest';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createSocial(G, getT, api) { // api: { addFun, toast, text, dlg, rowItem, el, persist, running, day, wish, callBestie(key) }
  const net = G.net, online = () => !!(net && net.N && net.N.on && net.N.open), me = () => (G.save.look.name || 'Guest').slice(0, 16);
  const B = () => { const T = getT(); return T.buddy || (T.buddy = { want: '', name: '', together: 0, played: 0, seenW: 0 }); };
  const peers = () => online() ? net.peers().filter(R => R.tr && !R.tr.e && R.name) : [];
  const find = n => peers().find(R => R.name === n);
  function paired() { const b = B(); if (!b.want) return null; const R = find(b.want); return R && R.tr.b === me() ? R : null; }
  function presence() { const T = getT(); if (!T) return 0; return { k: T.type, d: api.day(), b: B().want || '', w: T.wishes.filter(w => w.done).length, f: Math.round(T.fun), e: T.ended ? 1 : 0 }; }
  const shown = {}; let lastSeen = 0;
  function update(dt) { const T = getT(); if (!T || !api.running()) return; const b = B(); b.played += dt;
    for (const R of peers()) if (R.tr.b === me() && b.want !== R.name && !shown[R.name]) { shown[R.name] = 1; api.text(R.name, 'wants you as their trip bestie! 📱 → My trip → Trip buddy to accept. 👥'); }
    const P = paired(); b.near = false;
    if (P) { lastSeen = performance.now(); if (b.name !== P.name || !b.hello) { b.name = P.name; b.hello = 1; b.lost = 0; api.text(P.name, "You're trip besties now! Stick together for +25% Fun. 🫶"); }
      b.near = P.area === G.state.area.id && Math.hypot(P.tpos.x - G.player.position.x, P.tpos.z - G.player.position.z) < 25;
      if (b.near) { b.together += dt; if (P.tr.w > b.seenW && b.seenW >= 0 && b.synced) api.addFun(250, `${P.name}'s wish came true with you there`, true); if (b.together >= 60) api.wish('buddyHour'); }
      b.seenW = Math.max(b.seenW, P.tr.w); b.synced = 1; }
    else if (b.hello && !b.lost && performance.now() - lastSeen > 90000) { b.lost = 1; api.text('Trip buddy', `${b.name || 'Your buddy'} went offline. Keep going, or call in an NPC bestie from 📱 → My trip.`); } }
  const funMult = () => (getT() && B().near ? 1.25 : 1);
  const togetherPct = () => { const b = B(); return b.played > 30 ? Math.round(b.together / b.played * 100) : 0; };
  function ask(name) { const b = B(); b.want = name; b.hello = 0; b.synced = 0; b.seenW = 0; api.persist(); api.toast(`👥 Asked ${name} to be your trip bestie. They need to ask you back (or accept).`); }

  function hubHtml() { const T = getT(); if (!net || !net.N || !net.N.on) return T.buddyMode ? '<p class="fine">Trip buddies need the website version (online). Call in an NPC bestie below.</p>' : '';
    const P = paired(), b = B(), list = peers();
    let h = P ? `<p>🫶 <b>${esc(P.name)}</b> is your trip bestie · Day ${P.tr.d} · ⭐ ${P.tr.f.toLocaleString()} · ${b.near ? '📍 with you (+25% Fun)' : '📍 somewhere else'} · together ${togetherPct()}%</p>` : b.want ? `<p class="fine">Waiting for <b>${esc(b.want)}</b> to ask you back…</p>` : '<p class="fine">Pair up with a friend who is also on a Vegas Trip (same Strip or private party).</p>';
    h += list.length ? '<div class="tList" id="budList"></div>' : `<p class="fine">${online() ? 'Nobody else here is on a trip right now. Start a private party (👥) and send a friend the invite link.' : 'Connecting to the server…'}</p>`;
    return h; }
  function bindHub(c) { const box = c.querySelector('#budList'); if (!box) return; const b = B();
    for (const R of peers()) { const asked = R.tr.b === me(), mine = b.want === R.name; api.rowItem(box, '✈️', esc(R.name), `${TRIP_TYPES[R.tr.k].n} · Day ${R.tr.d} · ⭐ ${R.tr.f.toLocaleString()}${asked ? ' · asked you!' : ''}`, [[mine ? (asked ? 'Buddies ✓' : 'Asked') : asked ? 'Accept' : 'Ask', () => { ask(R.name); api.reopen(); }, asked && !mine ? 'gold' : '', mine]]); } }

  // ---------------- scores + leaderboards ----------------
  function score() { const T = getT(), w = T.wishes.filter(x => x.done).length, happy = T.bf ? T.bf.mood : T.buddyMode ? togetherPct() : 50;
    return Math.max(0, Math.round(T.fun + G.save.coins * 3 + w * 400 + happy * 5 + (T.nights || 0) * 150 + (T.crewEver || []).length * 100 - T.stats.blackouts * 300)); }
  function localBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY) || '[]'); } catch (e) { return []; } }
  function submit(rankK) { const T = getT(), s = T.score = score(), rec = { name: me(), score: s, rank: rankK, kind: T.type, back: T.back, buddy: B().name || '', at: new Date().toISOString() };
    try { const a = localBest(); a.push(rec); a.sort((x, y) => y.score - x.score); localStorage.setItem(BEST_KEY, JSON.stringify(a.slice(0, 10))); } catch (e) {}
    const base = net && net.A && net.A.base; if (!base || !net.N.on) return Promise.resolve(null);
    return fetch(base + '/trip/score', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...rec, party: net.N.party || '', fun: T.fun, cash: G.save.coins, wishes: T.wishes.filter(x => x.done).length }) }).then(r => r.json()).catch(() => null); }
  const rows = a => a.length ? `<ol class="lbList">${a.map(r => `<li${r.name === me() ? ' class="me"' : ''}><b>${esc(r.name)}</b><span>${r.score.toLocaleString()}</span><small>${(RANKS.find(x => x.k === r.rank) || { n: r.rank }).n} · ${TRIP_TYPES[r.kind] ? TRIP_TYPES[r.kind].icon : ''} ${BACKSTORIES[r.back] ? BACKSTORIES[r.back].icon : ''}${r.buddy ? ' · with ' + esc(r.buddy) : ''}</small></li>`).join('')}</ol>` : '<p class="fine">No trips yet. Be the first.</p>';
  function board(tab = 'device') { const base = net && net.A && net.A.base, on = !!(base && net.N.on), tabs = [['device', '📱 This device'], ...(on ? [['all', '🌎 Everyone'], ['week', '📅 This week'], ...(net.N.party ? [['party', '👥 Your party']] : [])] : [])];
    const list = api.dlg({ title: '🏆 Vegas Trip leaderboard', html: `<div class="hubSpeed lbTabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</div><div id="lbBody">${tab === 'device' ? rows(localBest()) : '<p class="fine">Loading…</p>'}</div>${on ? '' : '<p class="fine">Online leaderboards are on the website version.</p>'}`, buttons: [['Close']] });
    const card = list.closest('.card'); card.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => board(b.dataset.tab));
    if (tab !== 'device') fetch(base + '/trip/top' + (net.N.party ? '?party=' + net.N.party : ''), { cache: 'no-store' }).then(r => r.json()).then(j => { const el = card.querySelector('#lbBody'); if (el) el.innerHTML = rows(j[tab === 'all' ? 'top' : tab] || []) + (j.stored === 'memory' ? '<p class="fine">Scores reset when the server restarts (until accounts are switched on).</p>' : ''); })
      .catch(() => { const el = card.querySelector('#lbBody'); if (el) el.innerHTML = '<p class="fine">The server is waking up. Try again in a few seconds.</p>'; }); }
  return { update, presence, funMult, togetherPct, paired, hubHtml, bindHub, score, submit, board, localBest, get near() { return !!(getT() && B().near); } };
}
export const NPC_BESTIES = BESTIES;
