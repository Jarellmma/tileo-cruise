// Epic or Fail: Vegas Trip (v7 story mode for TILEO KINGDOM: Strip Life).
// Five days in Vegas with a lost wallet and lost luggage: keep Energy, Hunger, Hydration, Buzz, Vibe and outfit Freshness up,
// earn Trip Cash with skill jobs, find your wallet, look after your bestie and rack up Fun before Day 5 checkout.
// Loaded only when the player picks the trip on the 18+ gate (or ?mode=trip). main.js swaps its save object to the trip's own key first,
// so everything here (coins = Trip Cash, look, outfits) lives in 'tileoKingdom.trip.v1' and Free Play is never touched.
import { START_MIN, END_MIN, SPEEDS, TRIP_TYPES, BACKSTORIES, BESTIES, OUTFITS, ACCESSORIES, ITEMS, VENUES, WISHES, WISH_SETS, BESTIE_WISH, WANDER, BLACKOUTS, WAKE_SPOTS, BOUNCER, LIFEGUARD, RANKS, REVUE } from './data.js?v=1793987979';
import { djGig, bartend } from './games.js?v=1793987979';
import { buildTripWorld, SPOTS } from './world.js?v=1793987979';
import { createBestie, moodFace } from './bestie.js?v=1793987979';

const clamp = v => Math.max(0, Math.min(100, v)), pick = a => a[Math.random() * a.length | 0], $$ = n => '$' + Math.round(n).toLocaleString();
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
const RUN_UI = new Set(['slots', 'blackjack', 'roulette', 'photo', 'binoc']); // the clock keeps running at the tables and behind the camera
const METERS = [['energy', '⚡', 'Energy'], ['hunger', '🍔', 'Hunger'], ['hyd', '💧', 'Hydration'], ['buzz', '🍸', 'Buzz'], ['vibe', '✨', 'Vibe'], ['fresh', '👔', 'Freshness']];

export async function initTrip(G) {
  const { $, state, save, player } = G;
  { const u = new URL('./trip.css', import.meta.url); const q = import.meta.url.split('?')[1]; const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = u.pathname + (q ? '?' + q : ''); document.head.appendChild(l);
    await new Promise(r => { l.onload = l.onerror = r; setTimeout(r, 3000); }); }

  // ---------------- DOM ----------------
  const overlay = (id, cls = 'card tripCard') => { const o = el('div', 'overlay hidden', ''); o.id = id; const c = el('div', cls); o.append(c); document.body.append(o); return c; };
  const setupCard = overlay('tripSetup', 'card tripCard setupCard'), modalCard = overlay('tripModal'), hubCard = overlay('tripHub', 'card tripCard hubCard'), gameCard = overlay('tripGame', 'card tripCard gameCard'), recapCard = overlay('tripRecap', 'card tripCard recapCard');
  const show = el('div', 'hidden hudLayer'); show.id = 'tripShow'; show.innerHTML = '<div class="tsBar top"></div><div class="tsBar bot"><p id="tsCap"></p></div>'; document.body.append(show);
  const hud = el('div', 'hidden'); hud.id = 'tripHud'; $('hud').append(hud);
  hud.innerHTML = `<div class="thTop"><b id="thDay">Day 1</b><span id="thClock">10:00 AM</span><i id="thTod"></i><button id="thSpeed" title="Trip clock speed">1×</button></div>
    <div class="thMid"><span>💵 <b id="thCash">$0</b></span><span>⭐ <b id="thFun">0</b></span><span id="thFlags"></span></div>
    <div class="thBars">${METERS.map(([k, i, n]) => `<div class="tb" data-k="${k}" title="${n}"><i>${i}</i><s>${k === 'buzz' ? '<b class="sz"></b>' : ''}<u></u></s></div>`).join('')}</div>
    <button id="thBf" class="hidden"></button>`;
  const txt = el('div', ''); txt.id = 'tripText'; $('hud').append(txt);
  const banner = el('div', ''); banner.id = 'tripBanner'; $('hud').append(banner);
  hud.addEventListener('pointerdown', e => e.stopPropagation()); txt.addEventListener('pointerdown', e => e.stopPropagation());
  hud.onclick = e => { if (e.target.closest('#thSpeed') || e.target.closest('#thBf')) return; openHub(); };
  $('thSpeed').onclick = () => { if (!T) return; T.speed = SPEEDS[(SPEEDS.indexOf(T.speed) + 1) % SPEEDS.length]; G.toast(`⏱️ Trip clock ${speedLbl()}: 1 game hour = ${T.speed === 1 ? '1 real minute' : T.speed === 2 ? '30 real seconds' : '2 real minutes'}`); hudNow(); };
  $('thBf').onclick = () => openCheckIn();
  txt.onclick = () => { txt.classList.remove('on'); openHub('msgs'); };
  { const grid = document.querySelector('#phone .appGrid'); if (grid) { const b = el('button', '', '✈️<span>My trip</span>'); b.onclick = () => { G.closeUI(); openHub(); }; grid.prepend(b); } }

  // ---------------- state ----------------
  let T = save.trip && save.trip.v === 1 ? save.trip : null, bestie = null, world = null, busy = false, showT = -1, saveT = 0, hudT = 0, lastArea = '', zeroOpen = false, guardT = 0, dry = { x: 0, z: 0 };
  const day = () => Math.floor(T.min / 1440) + 1, hour = () => (T.min % 1440) / 60;
  const clock = (m = T.min) => { const h = (m % 1440) / 60, hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return `${(hh + 11) % 12 + 1}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`; };
  const speedLbl = () => T.speed === 0.5 ? '½×' : T.speed + '×';
  const todFor = h => (h >= 5.5 && h < 6.75) || (h >= 17.5 && h < 19.75) ? 'sunset' : h >= 6.75 && h < 17.5 ? 'day' : 'night';
  const BK = () => BACKSTORIES[T.back], top = () => T.back === 'party' ? 78 : 68;
  const running = () => !!T && !T.ended && state.started;
  const clockRuns = () => running() && !busy && !state.tripShow && (!state.ui || RUN_UI.has(state.ui));
  const persist = () => { if (T) { T.savedAt = Date.now(); G.persist(); } };

  // ---------------- money, fun, style ----------------
  const money = { get cash() { return save.coins; } };
  function earn(n, why) { G.setCoins(save.coins + n); if (T) T.stats.earned += n; if (why) G.toast(why); }
  function spend(n) { if (save.coins < n) return false; G.setCoins(save.coins - n); if (T) T.stats.spent += n; return true; }
  function addFun(n, why, raw) { if (!T) return 0; const v = Math.round(raw ? n : n * (0.5 + T.m.vibe / 100)); /* Vibe scales everyday Fun; quest rewards are fixed */ T.fun += v; if (why) G.toast(`⭐ +${v} Fun · ${why}`); return v; }
  const styleScore = () => { if (!T) return 0; let s = OUTFITS[T.wearing].style + T.accOn.reduce((a, k) => a + ACCESSORIES[k].style, 0) + (T.back === 'influencer' ? 15 : 0); if (T.m.fresh < 30) s *= 0.6; return Math.min(100, Math.round(s)); };
  const charm = () => Math.min(100, Math.round(styleScore() * 0.5 + T.m.vibe * 0.3 + T.m.fresh * 0.2 + (T.back === 'influencer' ? 15 : 0)));
  const statement = () => !!OUTFITS[T.wearing].statement || T.accOn.length > 0;

  // ---------------- outfits ----------------
  function wear(id) { T.wearing = id; const L = save.look; Object.assign(L, OUTFITS[id].look(L.body === 'm' ? 'm' : 'f')); L.acc = T.accOn.join('+'); L.banded = true; G.applyLook(player, L); persist(); }

  // ---------------- clock + meters ----------------
  function tick(h, act) {
    const m = T.m, hr = hour(), night = hr >= 22 || hr < 6, A = state.area ? state.area.id : 'strip', rest = act === 'sleep' || act === 'nap' || act === 'blackout';
    const dancing = !act && state.emote === 'dance', inClub = A === 'club', sun = !rest && state.tod === 'day' && (A === 'strip' || A === 'pool' || A === 'needle');
    const hotTub = !act && A === 'pool' && state.pmode === 'sit' && G.waterDepth(player.position) > 0.3, T0 = top();
    let dE = rest ? 12 : -4 * (night ? (T.back === 'party' ? 0.65 : 1) * 1.4 : 1);
    if (!rest) { if (dancing) dE -= 5; if (act === 'work') dE -= 4; if (m.buzz > T0) dE *= 1.3; if (m.hunger < 15 || m.hyd < 15) dE *= 1.5; if (T.hangover) dE *= 1.35; if (act === 'show' || act === 'eat') dE = -2; if (act === 'shower') dE = 0; }
    m.energy += dE * h; m.hunger -= (rest ? 2.5 : 6) * h; m.hyd -= (rest ? 2.5 : 6 * (sun ? 1.25 : 1) * (m.buzz > 40 ? 1.2 : 1)) * h; m.buzz -= (rest ? 16 : 12) * h;
    let fr = rest ? 1 : 3; if (T.wearing === 'plane' && day() >= 2) fr *= 2; if (dancing) fr *= 1.6; if (act === 'work') fr *= 1.5; if (act !== 'shower') m.fresh -= fr * h;
    const sweet = m.buzz >= 20 && m.buzz <= T0; let dv = 0;
    if (sweet) dv += 6; if (m.buzz > T0) dv -= 10; if (dancing && inClub) dv += 10; if (hotTub) dv += 5;
    if (m.hunger < 20) dv -= 6; if (m.hyd < 20) dv -= 6; if (m.energy < 20) dv -= 6; if (m.fresh < 30) dv -= 5; if (T.hangover) dv -= 4; if (T.wearing === 'plane' && day() >= 2) dv -= 3;
    if (!dv) dv = (50 - m.vibe) * 0.06; if (rest) dv = (60 - m.vibe) * 0.08; m.vibe += dv * h;
    if (!rest && !act) { let f = 0; if (sweet) f += 35; if (dancing && inClub) f += 70 * (T.back === 'dj' ? 1.5 : 1); if (hotTub) f += 15; if (state.limo) f += 40; if (A === 'needle') f += 15; if (inClub) f += 8; if (f) addFun(f * h); }
    for (const [k] of METERS) m[k] = clamp(m[k]);
    if (!rest && m.buzz > T0 + 8) { T.overdid = true; warn('sloppy', 75, '🥴 You\'re getting sloppy: past your Buzz sweet spot. Water or a smoothie, or tomorrow\'s hangover is on you.'); }
    if (bestie) bestie.tick(h, act, { dancing, area: A, vibe: m.vibe, limo: !!state.limo, hotTub, casino: A === 'lobby' && player.position.x > 20 });
  }
  function warn(k, everyMin, msg) { const l = T.lastWarn[k] ?? -1e9; if (T.min - l < everyMin) return; T.lastWarn[k] = T.min; G.toast(msg); }
  // move the clock forward (live: a few game minutes per frame; jumps: sleeping, shifts, dinners, shows) and fire time events
  function advance(mins, act = '') { let left = mins; while (left > 0 && !T.ended) { const s = Math.min(left, 10), prev = T.min; T.min += s; left -= s; tick(s / 60, act); timeEvents(prev, T.min, !!act); } }
  function timeEvents(a, b, jumping) {
    const cross = hm => { for (let d = Math.floor(a / 1440); d <= Math.floor(b / 1440); d++) { const x = d * 1440 + hm; if (a < x && b >= x) return d + 1; } return 0; };
    let d; if ((d = cross(0))) { if (d <= 5) dayBanner(`DAY ${d}`, d === 5 ? 'Checkout at 12:00 PM' : 'Midnight on the Strip'); }
    if (cross(6 * 60) && T.overdid) { T.overdid = false; T.hangover = true; G.toast('🤕 Morning hangover: Energy and Vibe drain faster until you drink water or a Recovery Smoothie.'); }
    if (bestie && bestie.lost && cross(7 * 60)) bestie.comeHome(15, `found my way back to the suite. why is there a traffic cone in our tub. also: thanks for nothing 🙃`);
    if (cross(0) === 4 && T.quest.wallet < 3) { T.quest.cold = true; if (world) world.npcs.pick.visible = false; text('Lobby Security', 'The flamingo-jacket guy checked out of town. Your wallet trail just went cold. Sorry, friend.'); }
    if (day() >= 4 && hour() >= 9 && T.quest.suitcase === 0) { T.quest.suitcase = 1; text('Budget Air', 'Great news! Your lost bag has arrived at the TILEO KINGDOM front desk. (It went to Boise. It had a nice time.) 🧳'); }
    if (bestie && !jumping && !bestie.lost && T.bf.wanderNight !== day() && hour() >= 1 && hour() < 3.5 && state.area.id !== 'room' && !state.driving && !state.limo && !state.cine && !state.ride && G.comp.active) {
      const p = (T.bf.buzz > 55 ? 0.05 : 0.008) * (b - a); if (Math.random() < p) { T.bf.wanderNight = day(); const spots = Object.keys(WANDER).filter(k => WANDER[k].area !== state.area.id); bestie.wander(pick(spots.length ? spots : Object.keys(WANDER))); } }
    if (b >= END_MIN && !T.ended) endTrip('checkout');
    const tod = todFor(hour()); if (tod !== state.tod) G.setTod(tod);
  }
  function jump(hours, act, msg, after) { busy = true; G.closeUI(); G.transition(() => { advance(hours * 60, act); if (after) after(); busy = false; hudNow(); if (msg) G.toast(msg); if (T.m.energy <= 0 && !T.ended) setTimeout(blackout, 600); persist(); }); }

  // ---------------- texts, banners ----------------
  let txtT = 0; function text(from, msg) { if (!T) return; T.msgs.unshift({ from, msg, t: T.min }); T.msgs.length = Math.min(T.msgs.length, 12); txt.innerHTML = `<b>📱 ${from}</b> ${msg}`; txt.classList.add('on'); clearTimeout(txtT); txtT = setTimeout(() => txt.classList.remove('on'), 9000); try { G.amb.chime('spin'); } catch (e) {} }
  let banT = 0; function dayBanner(big, small) { banner.innerHTML = `<b>${big}</b><small>${small}</small>`; banner.classList.remove('on'); void banner.offsetWidth; banner.classList.add('on'); clearTimeout(banT); banT = setTimeout(() => banner.classList.remove('on'), 3600); }

  // ---------------- generic dialog ----------------
  function dlg(o) { const c = modalCard; c.className = 'card small tripCard ' + (o.cls || ''); c.innerHTML = `<h2>${o.title}</h2>${o.html ? `<div class="tBody">${o.html}</div>` : ''}<div class="tList"></div><div class="tBtns"></div>`;
    const row = c.querySelector('.tBtns'); for (const [label, fn, cls] of o.buttons || [['OK', null, 'gold']]) { const b = el('button', cls || 'ghost', label); b.onclick = () => { const r = fn ? fn() : undefined; if (r !== false && state.ui === 'tripModal' && c.contains(b)) G.closeUI(); }; row.append(b); }
    G.showUI('tripModal'); return c.querySelector('.tList'); }
  const rowItem = (list, icon, name, sub, btns) => { const r = el('div', 'tRow', `<span class="tIc">${icon}</span><span class="tTx"><b>${name}</b><small>${sub}</small></span>`); const bb = el('span', 'tRb'); for (const [l, fn, cls, dis] of btns) { const b = el('button', cls || '', l); b.disabled = !!dis; b.onclick = fn; bb.append(b); } r.append(bb); list.append(r); return r; };

  // ---------------- food & drink ----------------
  function openVenue(key) { if (!running()) return G.toast('The trip is over: roam freely.'); const V = VENUES[key];
    const list = dlg({ title: `${V.icon} ${V.n}`, html: `<p class="fine">💵 ${$$(save.coins)} · 🍔 ${Math.round(T.m.hunger)} · 💧 ${Math.round(T.m.hyd)} · 🍸 ${Math.round(T.m.buzz)}% (sweet spot 20–${top()}%)${T.hangover ? ' · 🤕 hangover' : ''}</p>`, buttons: [['Close']] });
    const two = bestie && bestie.present();
    for (const id of V.items) { const it = ITEMS[id], bb = [[`Buy ${$$(it.price)}`, () => buy(id, false, key), 'gold', save.coins < it.price]];
      if (two) bb.push([`For two ${$$(it.price * 2)}`, () => buy(id, true, key), '', save.coins < it.price * 2]);
      rowItem(list, it.icon, it.n, it.d + (it.hours ? '' : ''), bb); }
    if (V.gig) rowItem(list, '🍹', 'Work a Bartending Rush shift', '1.5 h · wage $25 + tips · costs Energy', [['Work shift', () => workBar(), '', T.m.energy < 20]]); }
  function buy(id, two, venue) { const it = ITEMS[id], cost = it.price * (two ? 2 : 1); if (!spend(cost)) return G.toast('💸 Not enough Trip Cash.');
    const m = T.m, splurge = it.splurge && T.back === 'divorcee' ? 1.25 : 1, fx = it.fx || {}, as = it.as || id;
    for (const [k, v] of Object.entries(fx)) m[k] = clamp(m[k] + v);
    if (it.vibe) m.vibe = clamp(m.vibe + it.vibe * splurge);
    let msg = `${it.icon} ${it.n}${two ? ' ×2' : ''} (-${$$(cost)})`;
    if (it.cure && T.hangover) { T.hangover = false; msg += ' · hangover cured! 🙌'; }
    const tacos2 = as === 'tacos' && hour() < 4;
    if (it.fun) addFun(it.fun * splurge * (tacos2 ? 2 : 1));
    if (two && bestie) { bestie.feed(it); bestie.react(as === 'tacos' ? 'tacos' : as === 'steak' ? 'steak' : as === 'marg' ? 'marg' : 'drink'); }
    if (as === 'steak') { wish('steak'); if (two) wish('steak2'); }
    if (two && (as === 'cocktail' || as === 'marg') && venue === 'Tiger Bar') wish('shots');
    if (tacos2 && bestie && bestie.present()) wish('tacos2am');
    if (it.booze && T.m.buzz > top()) msg += ' · 🥴 too much!';
    if (it.hours) return jump(it.hours, 'eat', `🥩 Dinner at the Lion's Den${two ? ` with ${bestie.B.n}` : ''}: perfectly charred, ridiculously huge. Hunger maxed.`);
    G.toast(msg); persist(); openVenue(venue); }

  // ---------------- boutique, wardrobe, dress codes ----------------
  function openBoutique(focus) { if (!T) return; const list = dlg({ title: '🐯 Tiger Boutique', html: `<p class="fine">💵 ${$$(save.coins)} · Style ${styleScore()} · Charm ${charm()} · wearing: ${OUTFITS[T.wearing].n}</p>`, buttons: [['Close']] });
    for (const [id, o] of Object.entries(OUTFITS)) { if (id === 'plane') continue; const own = T.closet.includes(id);
      rowItem(list, o.statement ? '💎' : id === 'swim' ? '🩱' : '👕', o.n, `Style ${o.style}${o.statement ? ' · statement piece' : ''}${o.tier === 'party' ? ' · club-ready' : o.tier === 'swim' ? ' · pool only' : ' · not club-ready'}${o.d ? ' · ' + o.d : ''}`,
        [[own ? (T.wearing === id ? 'Wearing' : 'Wear') : `Buy ${$$(o.price)}`, () => { if (!own) { if (!spend(o.price)) return G.toast('💸 Not enough Trip Cash.'); T.closet.push(id); T.m.fresh = Math.max(T.m.fresh, 85); addFun(20); if (bestie) bestie.react('boutique'); G.toast(`🛍️ ${o.n}: fresh off the rack.`); }
          wear(id); if (id === 'squad' && bestie) wish('squad'); openBoutique(); }, own ? '' : 'gold', own && T.wearing === id]]); }
    for (const [id, a] of Object.entries(ACCESSORIES)) { const own = T.accOwned.includes(id), on = T.accOn.includes(id);
      rowItem(list, id === 'cap' ? '🧢' : id === 'chain' ? '⛓️' : '👟', a.n, `+${a.style} Style · statement accessory · stacks`, [[own ? (on ? 'Take off' : 'Put on') : `Buy ${$$(a.price)}`, () => { if (!own) { if (!spend(a.price)) return G.toast('💸 Not enough Trip Cash.'); T.accOwned.push(id); if (bestie) bestie.react('boutique'); addFun(15); }
        if (on) T.accOn = T.accOn.filter(k => k !== id); else T.accOn.push(id); wear(T.wearing); openBoutique(); }, own ? '' : 'gold']]); } }
  function openWardrobe() { if (!T) return; const list = dlg({ title: '🧳 Suite wardrobe', html: `<p class="fine">Style ${styleScore()} · Charm ${charm()} · Freshness ${Math.round(T.m.fresh)}% (shower to freshen up)</p>`, buttons: [['Done']] });
    for (const id of T.closet) { const o = OUTFITS[id]; rowItem(list, o.statement ? '💎' : '👕', o.n, `Style ${o.style}`, [[T.wearing === id ? 'Wearing' : 'Wear', () => { wear(id); if (id === 'squad' && bestie) wish('squad'); openWardrobe(); }, '', T.wearing === id]]); }
    for (const id of T.accOwned) { const a = ACCESSORIES[id], on = T.accOn.includes(id); rowItem(list, '✨', a.n, `+${a.style} Style`, [[on ? 'Take off' : 'Put on', () => { if (on) T.accOn = T.accOn.filter(k => k !== id); else T.accOn.push(id); wear(T.wearing); openWardrobe(); }]]); }
    if (!T.accOwned.length && T.closet.length < 2) list.append(el('p', 'fine', 'Just the plane clothes so far. Tiger Boutique is in the lobby.')); }
  function clubBlock() { const t = OUTFITS[T.wearing].tier; return t === 'plane' ? 'plane' : t === 'casual' ? 'casual' : t === 'swim' ? 'swim' : T.m.fresh < 30 ? 'stale' : null; }
  function canEnter(area) { if (!running()) return true;
    if (area === 'club') { const why = clubBlock(); if (why) { dlg({ title: '🚫 Velvet rope', html: `<p>${pick(BOUNCER[why])}</p><p class="fine">${why === 'stale' ? 'Freshness under 30%: take a hot shower in Suite 2407 (Floor 24).' : 'The Mega Club needs a party fit: Squad, White Party, Tiger Set or Gold Sequin. Tiger Boutique is in the lobby; your wardrobe is in Suite 2407.'}</p>`, buttons: [['Got it', null, 'gold']] }); return false; }
      setTimeout(() => G.toast(pick(['Bouncer: "Looking sharp. Go on in."', 'Bouncer: "Now THAT is a fit. Welcome to the Mega Club."', 'Bouncer: "You may pass, fashion royalty."'])), 900); }
    return true; }
  function poolCheck() { const d = G.waterDepth(player.position); if (d < 0.05) { dry.x = player.position.x; dry.z = player.position.z; return; }
    if (d > 0.25 && T.wearing !== 'swim' && !busy) { player.position.x = dry.x; player.position.z = dry.z; G.state.baseY = 0;
      if (performance.now() - guardT < 1500) return; guardT = performance.now(); const own = T.closet.includes('swim');
      dlg({ title: '🛟 Lifeguard', html: `<p>${pick(LIFEGUARD)}</p><p class="fine">${own ? 'You own Resort Swimwear: change right here.' : 'Resort Swimwear is $35 at Tiger Boutique in the lobby.'}</p>`, buttons: own ? [['🩱 Quick-change into swimwear', () => { wear('swim'); G.toast('🩱 Swimwear on. Cannonball!'); }, 'gold'], ['Not now']] : [['Got it', null, 'gold']] }); } }
  function areaWarnings(id) { if (!running()) return;
    if ((id === 'lobby' || id === 'strip') && T.m.fresh < 25) warn('fresh', 180, pick(['Concierge: "Pardon me, but… a shower in Suite 2407 might be in order."', 'Doorman: "Rough night? The rain shower upstairs is complimentary."']));
    else if ((id === 'lobby' || id === 'strip') && T.wearing === 'plane' && day() >= 2) warn('plane', 180, 'Doorman: "Still in the plane clothes on day ' + day() + '? Tiger Boutique is right inside."'); }

  // ---------------- suite: shower, nap, sleep ----------------
  function onShower() { if (!running()) return G.toast('🚿 Ahh.'); jump(0.5, 'shower', '🚿 Hot rain shower with a Strip view. Freshness 100%, Vibe up.', () => { T.m.fresh = 100; T.m.vibe = clamp(T.m.vibe + 8); }); }
  function onBed() { if (!running()) return G.toast('You stretch out on the tiger-print throw.'); const hr = hour(), canSleep = hr >= 20 || hr < 9.5, toTen = hr < 10 ? 10 - hr : 34 - hr;
    dlg({ title: '😴 King bed', html: `<p class="fine">${clock()} · Energy ${Math.round(T.m.energy)}%${bestie && bestie.lost ? `<br>⚠️ ${bestie.B.n} is still out there. Sleeping now will hurt their Mood a lot.` : ''}</p>`,
      buttons: [['😴 Power Nap · 3 h', () => sleep(3, 'nap'), 'gold'], [canSleep ? `🌙 Sleep until 10:00 AM (${Math.round(toTen)} h)` : '🌙 Too early to sleep (after 8 PM)', () => { if (!canSleep) { G.toast('Too early for bed: it\'s Vegas. Nap instead, or sleep after 8 PM.'); return false; } sleep(toTen, 'sleep'); }, canSleep ? '' : 'ghost'], ['Cancel']] }); }
  function sleep(h, act) { if (bestie && bestie.lost) bestie.comeHome(35, `you went to SLEEP?? i was out there alone. i ate a hot dog off a statue. -35 Mood, bestie 😤`);
    jump(h, act, act === 'nap' ? '😴 Power nap done. Energy back up.' : `☀️ Day ${Math.floor((T.min + h * 60) / 1440) + 1} · 10:00 AM. Good morning, Vegas.`, () => { if (act === 'sleep') { T.m.energy = Math.max(T.m.energy, 96); if (bestie) bestie.bf.energy = Math.max(bestie.bf.energy, 90); } }); }

  // ---------------- casino, VIP, coin cage ----------------
  function vip() { if (!running()) return G.toast('🍾 VIP is for trip guests.'); if (T.vipDay === day()) return G.toast('🍾 Your booth is yours all night.');
    const st = styleScore(); if (st < 85 && !statement()) return dlg({ title: '🍾 VIP host', html: `<p>"Bottle service needs a statement look, darling: Style 85+ or a statement piece (Tiger Set, Gold Sequin Fit, Kicks, Chain or VIP Snapback)."</p><p class="fine">Your Style: ${st}.</p>`, buttons: [['Got it', null, 'gold']] });
    if (save.coins < 120) return dlg({ title: '🍾 VIP host', html: `<p>"Bottle service is a $120 minimum. Come back when you're liquid. Financially."</p><p class="fine">You have ${$$(save.coins)}.</p>`, buttons: [['Got it', null, 'gold']] });
    dlg({ title: '🍾 VIP bottle service · $120', html: `<p>Sparklers, a booth on the LED floor and a bottle of "Kingdom Reserve" (it's very sparkling). Takes about an hour.</p>`, buttons: [['Book it · $120', () => { spend(120); const k = T.back === 'divorcee' ? 1.25 : 1; T.m.buzz = clamp(T.m.buzz + 30); T.m.vibe = clamp(T.m.vibe + 20 * k); addFun(300 * k);
      if (bestie) { bestie.react('vip'); bestie.mood(10); bestie.bf.buzz = clamp(bestie.bf.buzz + 25); } T.vipDay = day(); wish('vip'); jump(1, '', '🍾 Sparklers! The whole club turns around. You are royalty for an hour.'); }, 'gold'], ['Not now']] }); }
  function onCasino(k, d) { if (!running()) return;
    if (k === 'bj') { const prof = (d.ret || 0) - d.bet; if (prof > 0) { T.stats.wins++; wish('bjWin'); if (bestie) bestie.react('bj'); addFun(20 + prof * 0.5); } else addFun(4); }
    if (k === 'rl') { if (bestie && bestie.present()) { T.rlSpins++; if (T.rlSpins >= 3) wish('roulette3'); bestie.react('rl'); } addFun(d.won ? 15 + d.bet * (d.pay - 1) * 0.4 : 4); if (d.won) T.stats.wins++; }
    if (k === 'slots') { if (bestie && bestie.present()) bestie.react('slots'); addFun(d.win ? 8 + d.win * 0.4 : 3); if (d.win > d.bet) T.stats.wins++; } }

  // ---------------- jobs ----------------
  function openGame(run) { busy = true; G.showUI('tripGame'); return run(gameCard).then(r => { G.closeUI(); busy = false; return r; }); }
  const kevHype = () => bestie && bestie.key === 'kev' && bestie.present();
  function onDJ() { if (!running()) return G.toast('DJ Tileo: "Come back on your next trip!"');
    if (T.min - T.cdj < 180) return G.toast('DJ Tileo: "The next open slot is in a few hours. Go dance!"');
    if (T.m.energy < 25) return G.toast('😴 Too tired to DJ (Energy under 25%). Nap first.');
    openGame(c => djGig(c, { wide: T.back === 'dj', hype: kevHype() ? 'Kev, front row: "THAT\'S MY BEST FRIEND!! 🔥"' : '' })).then(r => { const k = T.back === 'dj' ? 1.45 : 1, pay = Math.round((30 + r.acc * 70) * k * (kevHype() ? 1.1 : 1));
      T.cdj = T.min; T.stats.jobs++; T.m.energy = clamp(T.m.energy - 18); earn(pay); addFun(60 + r.acc * 90); if (bestie) bestie.react('job');
      jump(2, 'work', `🎧 Set done (${Math.round(r.acc * 100)}% on beat, ${r.perfect} perfect drops): +${$$(pay)}${T.back === 'dj' ? ' with your Booth Plug bonus' : ''}.`); }); }
  function workBar() { if (T.min - T.cbar < 120) return G.toast('Bar manager: "You just worked a shift. Go spend those tips!"'); if (T.m.energy < 20) return G.toast('😴 Too tired for a bar shift.'); G.closeUI();
    openGame(c => bartend(c, { hype: kevHype() ? 'Kev at the bar: "My guy/gal is the BEST bartender in Nevada!"' : '' })).then(r => { const pay = Math.round((25 + r.tips) * (kevHype() ? 1.1 : 1));
      T.cbar = T.min; T.stats.jobs++; T.m.energy = clamp(T.m.energy - 14); earn(pay); addFun(40 + r.correct * 15); if (bestie) bestie.react('job');
      jump(1.5, 'work', `🍹 Shift done: ${r.correct}/${r.served} perfect drinks. Wage + tips: +${$$(pay)}.`); }); }
  function onShot(place, mode) { if (!running()) return; const parts = place.split(' · '), lm = parts.length > 1 && parts[1] === 'Las Vegas Strip' ? parts[0] : null, k = day() + ':' + place;
    if (T.paid[k]) return setTimeout(() => G.toast('📸 Nice! (You already sold a photo of this spot today.)'), 1400);
    if (Object.keys(T.paid).filter(x => x.startsWith(day() + ':')).length >= 8) return setTimeout(() => G.toast('📸 The tourism feed has enough of you for today. Try again tomorrow.'), 1400);
    let cash = lm ? 12 : place.startsWith('Sky Needle') ? 15 : 6, fun = lm ? 30 : 18; if (T.back === 'influencer') { cash *= 2; fun *= 2; }
    T.paid[k] = 1; T.stats.photos++; earn(cash); const f = addFun(fun);
    if (lm && !T.lm.includes(lm)) { T.lm.push(lm); if (T.lm.length >= 4) wish('photo4'); }
    if (mode === 'selfie' && lm && bestie && bestie.present() && !T.selfies.includes(lm)) { T.selfies.push(lm); if (T.selfies.length >= 2) wish('selfie2'); }
    if (mode === 'selfie' && bestie) bestie.react('selfie');
    setTimeout(() => G.toast(`📸 Photo Gig: @StripLifeDaily bought "${parts[0]}": +${$$(cash)}, +${f} Fun${T.back === 'influencer' ? ' (Do It For The Plot ×2)' : ''}`), 1400); persist(); }

  // ---------------- wallet quest, suitcase, front desk ----------------
  function onClue(n) { if (!running()) return;
    if (n === 0) dlg({ title: '🕵️ Lobby Security', html: '<p>"A guy in a <b>flamingo-pink jacket</b> speed-walked through here this morning with way too many wallets. Kept asking where the roulette pit was."</p><p class="fine">Next: ask the pit boss by the roulette wheel in the casino.</p>', buttons: [['Thanks!', () => { if (T.quest.wallet !== 0) return; T.quest.wallet = 1; addFun(50); text('Wallet trail', 'Clue 1 of 3: flamingo-pink jacket, headed for the roulette pit. 🦩'); }, 'gold']] });
    else if (n === 1) dlg({ title: '🎰 Pit Boss', html: '<p>"Flamingo jacket? He tried to tip me with a wallet that wasn\'t his. Said he\'d be watching the <b>Bellissimo Fountains</b> show \'like a classy guy\'."</p><p class="fine">Next: the Bellissimo Fountains on the Strip (🌀 Teleport → Bellissimo Fountains).</p>', buttons: [['On it', () => { if (T.quest.wallet !== 1) return; T.quest.wallet = 2; addFun(50); if (world) world.npcs.pick.visible = true; text('Wallet trail', 'Clue 2 of 3: he\'s at the Bellissimo Fountains. Go get your wallet! ⛲'); }, 'gold']] }); }
  function confront() { dlg({ title: '🦩 Gotcha!', html: '<p>The man in the flamingo jacket freezes mid-churro. "Okay, OKAY. I only took it because it matched my jacket!" He hands it over… along with a coupon for a free churro.</p>', buttons: [['💼 Take back your wallet', () => { if (T.quest.wallet !== 2) return; T.quest.wallet = 3; earn(120); addFun(300, 'Wallet recovered', true); if (world) world.npcs.pick.visible = false; G.toast('💼 Wallet recovered: +$120 and your dignity (mostly).'); persist(); }, 'gold']] }); }
  function frontDesk() { if (!T) return G.toast('Front desk: "Welcome to TILEO KINGDOM."'); const B = [];
    if (running() && T.quest.suitcase === 1) B.push(['🧳 Pick up your lost suitcase', () => { if (T.quest.suitcase !== 1) return; T.quest.suitcase = 2; earn(40); if (!T.closet.includes('tiger')) T.closet.push('tiger'); addFun(100); dlg({ title: '🧳 It\'s back!', html: '<p>Your suitcase is here, slightly damp and covered in Boise stickers. Inside: a <b>$40 airline voucher</b> and, somehow, a brand-new <b>Signature Tiger-Print Statement Set</b>.</p>', buttons: [['👕 Wear the Tiger Set', () => wear('tiger'), 'gold'], ['Later']] }); return false; }, 'gold']);
    B.push(['🔑 My keycard', () => { G.closeUI(); setTimeout(() => G.ctxOrig.checkIn(), 50); return false; }]);
    if (running()) B.push(['✈️ Early checkout', () => { dlg({ title: '✈️ Early checkout?', html: '<p>This ends your trip now and scores it. Sure?</p>', buttons: [['Check out now', () => { setTimeout(() => endTrip('early'), 50); }, 'gold'], ['Stay']] }); return false; }]);
    B.push(['Close']); dlg({ title: '🛎️ Front desk · Suite 2407', html: `<p class="fine">Prepaid VIP suite on Floor 24 · ${running() ? `Day ${day()} · ${clock()} · checkout Day 5, 12:00 PM` : 'trip over · roam as long as you like'}</p>`, buttons: B }); }

  // ---------------- $0 rule, blackout ----------------
  function zeroCheck() { if (busy || zeroOpen) return; const c = save.coins;
    if (c > 30) T.low = false; else if (c > 0 && c <= 15 && !T.low) { T.low = true; G.toast(`⚠️ Only ${$$(c)} left. Work a gig (DJ booth, any bar), sell photos, or find that wallet.`); }
    if (c > 0 || ['blackjack', 'roulette', 'slots', 'tripGame'].includes(state.ui)) return;
    if (T.zero >= 1) return endTrip('greyhound');
    zeroOpen = true; dlg({ title: '💸 You\'re at $0', html: '<p>A sweaty man in a lanyard approaches. "Hey. You look desperate. Wanna wear a <b>giant foam lion suit</b> and spin a sign on the Strip for two hours? Forty bucks."</p><p class="fine">This hustle only works once. Hit $0 again and you\'re on the bus home.</p>',
      buttons: [['🦁 Wear the suit (2 h, +$40)', () => { zeroOpen = false; T.zero = 1; G.parkCar(); jump(2, 'work', '🦁 Two hours of sign-spinning. A kid hugged you. A bachelorette party took 40 selfies. +$40.', () => { earn(40); T.m.fresh = clamp(T.m.fresh - 40); T.m.energy = clamp(T.m.energy - 12); addFun(60); G.enterArea('strip', 28, -322, Math.PI / 2); }); }, 'gold'],
        ['🚌 Take the Greyhound home', () => { zeroOpen = false; T.zero = 1; setTimeout(() => endTrip('greyhound'), 50); }]] }); }
  function blackout() { if (!running() || busy) return; busy = true; G.closeUI(); G.parkCar(); const lost = Math.floor(save.coins * 0.25), sp = pick(WAKE_SPOTS);
    dlg({ title: '🌀 BLACKOUT', cls: 'blackCard', html: `<p>Your Energy hit zero.</p><p>${pick(BLACKOUTS)}</p>`, buttons: [['Ugh… wake up', () => { G.transition(() => { advance(270, 'blackout'); T.m.energy = Math.max(T.m.energy, 32); T.m.fresh = clamp(T.m.fresh - 30); if (lost) G.setCoins(save.coins - lost); T.stats.blackouts++;
      if (bestie) bestie.mood(-20); G.enterArea(sp.area, sp.x, sp.z, sp.yaw); const q = G.safeSpot(sp.x, sp.z); player.position.set(q.x, G.areas[sp.area].floorY || 0, q.z); G.updateCamera(1); busy = false; persist();
      G.toast(`😵 You wake up ${sp.where}. ${lost ? `Missing ${$$(lost)}. ` : ''}It's ${clock()}.`); }); }, 'gold']] }); }

  // ---------------- wishes ----------------
  function wish(id) { if (!T || T.ended) return; const w = T.wishes.find(x => x.id === id); if (!w || w.done) return; w.done = true; const f = addFun(500, null, true); if (bestie) bestie.mood(15, 'WISH LIST! ✅ 🥳');
    dayBanner('✨ WISH COMPLETE', `${WISHES[id]} · +${f} Fun`); persist(); }

  // ---------------- Thunder From the Kingdom ----------------
  function onRevue() { if (!running()) return G.toast('🎟️ The revue is for trip guests.'); const hr = hour(); if (!(hr >= 19 || hr < 2)) return G.toast(`🎟️ Shows run nightly 7 PM to 2 AM. It's ${clock()}.`);
    dlg({ title: '🎟️ Thunder From the Kingdom', html: `<p>The Strip's most ridiculous dance revue: firefighters, tear-away tuxedos, a fog machine with ambition. Two hours, $35${bestie && bestie.present() ? ` (${bestie.B.n} gets the comp plus-one)` : ''}.</p>`,
      buttons: [[save.coins >= 35 ? 'Buy ticket · $35' : 'Need $35', () => { if (!spend(35)) { G.toast('💸 Not enough Trip Cash.'); return false; } setTimeout(startShow, 30); }, 'gold'], ['Not now']] }); }
  function startShow() { busy = true; G.parkCar(); state.emote = null; state.tripShow = true; world.revue(true); player.position.set(-2.4, 0, -7.2); player.rotation.y = Math.PI; G.cam.yaw = 0; showT = 0; G.showUI('tripShow'); document.body.classList.add('tripShowing'); $('tsCap').textContent = REVUE[0]; }
  function endShow() { world.revue(false); state.tripShow = false; showT = -1; document.body.classList.remove('tripShowing'); G.closeUI(); busy = false; T.m.vibe = clamp(T.m.vibe + 20); addFun(400, null, true); if (bestie) { bestie.mood(20); } wish('revue');
    jump(2, 'show', '🌹 That was… a lot. Best $35 you ever spent.'); }
  const camP = new G.THREE.Vector3(), camL = new G.THREE.Vector3(0, 2.5, -23);
  function camera(dt) { if (!state.tripShow) return false; const c = G.camera; const asp = innerWidth / innerHeight, fov = asp < 1 ? Math.min(92, 44 / Math.max(0.45, asp)) : 55; if (c.fov !== fov) { c.fov = fov; c.updateProjectionMatrix(); } const s = Math.sin(showT * 0.25) * 1.6; camP.set(s, 4.2, -9.6); c.position.lerp(camP, Math.min(1, dt * 3)); c.lookAt(camL); G.CHAR.camPos.copy(c.position); return true; }

  // ---------------- bestie check-in ----------------
  function openCheckIn() { if (!bestie) return; const B = bestie.B, bf = bestie.bf;
    if (bf.lost) return dlg({ title: `📱 ${B.n} is missing`, html: `<p>Last text: "${(T.msgs.find(m => m.from === B.n) || {}).msg || '…'}"</p><p class="fine">They're somewhere around ${WANDER[bf.lost].where}. Walk up to them to bring them back (+200 Fun). Going to bed without them costs 35 Mood.</p>`, buttons: [['Find them', null, 'gold']] });
    const bars = [['⚡', 'Energy', bf.energy], ['🍔', 'Hunger', bf.hunger], ['🍸', 'Buzz', bf.buzz], [moodFace(bf.mood), 'Mood', bf.mood]].map(([i, n, v]) => `<div class="tMeter"><span>${i} ${n}</span><s><u style="width:${v}%"></u></s><b>${Math.round(v)}%</b></div>`).join('');
    const list = dlg({ title: `${B.icon} ${B.n} · ${B.tag}`, html: `<div class="tMeters">${bars}</div><p class="fine">Loves ${B.loves}.</p>`, buttons: [['Close']] });
    rowItem(list, '💧', 'Buy them a water', 'Buzz down, a little Mood', [['$5', () => { if (!spend(5)) return G.toast('💸 Not enough Trip Cash.'); bf.buzz = clamp(bf.buzz - 20); bestie.mood(3, 'Hydration is self-care. 💧'); openCheckIn(); }, 'gold', save.coins < 5]]);
    rowItem(list, '🌮', 'Share street tacos', 'Hunger + Energy, Mood up', [['$15', () => { if (!spend(15)) return G.toast('💸 Not enough Trip Cash.'); bf.hunger = clamp(bf.hunger + 40); bf.energy = clamp(bf.energy + 8); T.m.hunger = clamp(T.m.hunger + 20); bestie.react('tacos'); if (hour() < 4) wish('tacos2am'); openCheckIn(); }, 'gold', save.coins < 15]]);
    const cd = T.min - bf.hypeAt < 120; rowItem(list, '🙌', 'Hype them up', cd ? 'You just did. They\'re hyped.' : 'Free · Mood up · every 2 game hours', [['Hype!', () => { bf.hypeAt = T.min; bestie.mood(10, pick(['STOP IT. You\'re gonna make me cry. 🥹', 'I AM the main character. Thank you.', 'Okay I feel unstoppable now.'])); addFun(25); openCheckIn(); }, '', cd]]);
    rowItem(list, '📋', 'Wish List', `${T.wishes.filter(w => w.done).length} / ${T.wishes.length} done`, [['Open', () => { openHub('wishes'); }]]); }

  // ---------------- hub ----------------
  function openHub(sec) { if (!T) return; const c = hubCard; const m = T.m, d = T.ended ? null : day();
    const meters = METERS.map(([k, i, n]) => `<div class="tMeter${m[k] < 20 && k !== 'buzz' ? ' low' : ''}"><span>${i} ${n}</span><s>${k === 'buzz' ? `<b class="sz" style="left:20%;width:${top() - 20}%"></b>` : ''}<u style="width:${m[k]}%"></u></s><b>${Math.round(m[k])}%</b></div>`).join('');
    const flags = [T.hangover && '🤕 Hangover (water or a smoothie cures it)', m.buzz > top() && '🥴 Past your sweet spot', T.wearing === 'plane' && day() >= 2 && '✈️ Still in plane clothes (Freshness drains 2× faster)'].filter(Boolean);
    const W = T.wishes.map(w => `<li class="${w.done ? 'done' : ''}">${w.done ? '✅' : '⬜'} ${WISHES[w.id]}</li>`).join('');
    const q = T.quest, wallet = q.wallet >= 3 ? '✅ Wallet recovered (+$120)' : q.cold ? '❌ The trail went cold on Day 4' : ['🕵️ Ask lobby security by the Gold Lion Fountain (Lobby)', '🎰 Ask the pit boss by the casino roulette wheel', '⛲ Confront the flamingo-jacket pickpocket at the Bellissimo Fountains (Strip)'][q.wallet] + ' · before Day 4';
    const bag = q.suitcase === 2 ? '✅ Suitcase collected' : q.suitcase === 1 ? '🧳 Your suitcase is at the front desk!' : '🧳 The airline says Day 4…';
    const bf = bestie ? `<h3>${bestie.B.icon} ${bestie.B.n} ${bestie.lost ? '· 📱 missing!' : `· ${moodFace(T.bf.mood)} Mood ${Math.round(T.bf.mood)}%`}</h3><button id="hubBf" class="gold">💬 Check in with ${bestie.B.n}</button>` : '';
    const msgs = T.msgs.slice(0, 6).map(x => `<li><b>${x.from}</b> <small>${clock(x.t)}</small><br>${x.msg}</li>`).join('') || '<li class="fine">No texts yet.</li>';
    c.innerHTML = `<h2>✈️ ${TRIP_TYPES[T.type].n}</h2>
      <p class="hubTop">${T.ended ? '🏁 Trip over · roaming' : `Day ${d} · ${clock()} · checkout Day 5, 12:00 PM`}<br>💵 ${$$(save.coins)} · ⭐ ${T.fun.toLocaleString()} Fun · ${BK().icon} ${BK().n}</p>
      ${T.ended ? '' : `<div class="hubSpeed">Clock: ${SPEEDS.map(s => `<button data-s="${s}" class="${T.speed === s ? 'on' : ''}">${s === 0.5 ? '½×' : s + '×'}</button>`).join('')}</div>`}
      <div class="tMeters">${meters}</div>${flags.length ? `<p class="hubFlags">${flags.join('<br>')}</p>` : ''}
      <p class="fine">👔 ${OUTFITS[T.wearing].n}${T.accOn.length ? ' + ' + T.accOn.map(k => ACCESSORIES[k].n).join(', ') : ''} · Style ${styleScore()} · Charm ${charm()}${statement() ? ' · 💎 statement' : ''}</p>
      ${bf}<h3 id="hubWishes">📋 Wish List</h3><ul class="hubList">${W}</ul>
      <h3>🗺️ Side quests</h3><ul class="hubList"><li>${wallet}</li><li>${bag}</li></ul>
      <h3>💼 Ways to earn</h3><ul class="hubList"><li>🎧 DJ Booth gig at the Mega Club (2 h)</li><li>🍹 Bartending Rush at any resort bar (1.5 h)</li><li>📸 Photo Gigs: snap Strip landmarks in photo mode (each spot once a day)</li><li>🎰 Or risk it at the tables…</li></ul>
      <h3 id="hubMsgs">📱 Texts</h3><ul class="hubList msgs">${msgs}</ul>
      <p class="fine">${BK().perk}: ${BK().perkD}</p>
      <div class="tBtns"><button class="ghost" id="hubFree">🎲 Back to Free Play</button><button class="gold" id="hubClose">Close</button></div>`;
    c.querySelectorAll('.hubSpeed button').forEach(b => b.onclick = () => { T.speed = +b.dataset.s; openHub(); hudNow(); });
    const hb = c.querySelector('#hubBf'); if (hb) hb.onclick = () => openCheckIn();
    c.querySelector('#hubClose').onclick = () => G.closeUI();
    c.querySelector('#hubFree').onclick = () => { persist(); const u = new URL(location.href); u.searchParams.delete('mode'); location.href = u.pathname + u.search; };
    G.showUI('tripHub'); if (sec) { const t = c.querySelector(sec === 'wishes' ? '#hubWishes' : '#hubMsgs'); if (t) t.scrollIntoView({ block: 'start' }); } }

  // ---------------- HUD ----------------
  function hudNow() { if (!T) return; const m = T.m; $('thDay').textContent = T.ended ? 'Trip over' : `Day ${day()}`; $('thClock').textContent = T.ended ? 'roaming' : clock(); $('thTod').textContent = { day: '☀️', sunset: '🌇', night: '🌙' }[state.tod] || '';
    $('thSpeed').textContent = speedLbl(); $('thSpeed').classList.toggle('hidden', T.ended); $('thCash').textContent = $$(save.coins); $('thFun').textContent = T.fun.toLocaleString();
    $('thFlags').textContent = (T.hangover ? '🤕' : '') + (m.buzz > top() ? '🥴' : '') + (bestie && bestie.lost ? '📱' : '');
    for (const [k] of METERS) { const b = hud.querySelector(`.tb[data-k="${k}"]`); b.querySelector('u').style.width = m[k] + '%'; b.classList.toggle('low', k !== 'buzz' && m[k] < 20); if (k === 'buzz') b.classList.toggle('over', m.buzz > top()); }
    const sz = hud.querySelector('.sz'); sz.style.left = '20%'; sz.style.width = (top() - 20) + '%';
    { const mw = $('miniWrap'), y = hud.offsetTop + hud.offsetHeight + 8; if (hud.offsetHeight && mw.dataset.ty !== String(y)) { mw.dataset.ty = y; mw.style.top = y + 'px'; } }
    const bb = $('thBf'); if (bestie) { bb.classList.remove('hidden'); bb.textContent = bestie.lost ? `📱 ${bestie.B.n} is missing!` : `${bestie.B.icon} ${bestie.B.n} ${moodFace(T.bf.mood)} ${Math.round(T.bf.mood)}% · 💬`; bb.classList.toggle('alert', !!bestie.lost); } else bb.classList.add('hidden'); }

  // ---------------- setup wizard ----------------
  function showSetup() { const c = setupCard; const pickS = { type: 'solo', back: 'divorcee', bestie: 'roxy' }; const old = save.trip && save.trip.v === 1 ? save.trip : null;
    const opt = (k, items) => `<div class="tOpts" data-k="${k}">${Object.entries(items).map(([id, o]) => `<button data-id="${id}" class="tOpt${pickS[k] === id ? ' on' : ''}"><b>${o.icon} ${o.n}</b><small>${k === 'back' ? `${$$(o.cash)} start · <i>${o.perk}</i>: ${o.perkD}` : k === 'bestie' ? `${o.tag} · loves ${o.loves}` : o.d}</small></button>`).join('')}</div>`;
    c.innerHTML = `<h2>✈️ Epic or Fail: Vegas Trip</h2><p class="fine">Five days. No wallet. No luggage. A prepaid suite and a dream. Survive to checkout on Day 5 at noon and make it legendary. Play money only.</p>
      ${old && !old.ended ? `<div class="tResume"><b>Saved trip</b><span>${TRIP_TYPES[old.type].n} · Day ${Math.floor(old.min / 1440) + 1}, ${clock(old.min)} · ${$$(save.coins)} · ⭐ ${old.fun.toLocaleString()}${old.bestie ? ' · with ' + BESTIES[old.bestie].n : ''}</span><button class="gold" id="tsResume">▶ Resume trip</button></div><p class="fine">…or start a fresh 5-day run (replaces the saved trip):</p>` : old && old.ended ? `<p class="fine">Last trip: ${old.rank || ''}</p>` : ''}
      <h3>1 · Trip type</h3>${opt('type', TRIP_TYPES)}<h3>2 · Your backstory</h3>${opt('back', BACKSTORIES)}<div id="tsBf"><h3>3 · Your bestie</h3>${opt('bestie', BESTIES)}</div>
      <div class="tBtns"><button class="gold" id="tsGo">Start the trip ✈️</button></div>`;
    const sync = () => { c.querySelectorAll('.tOpts').forEach(g => g.querySelectorAll('.tOpt').forEach(b => b.classList.toggle('on', pickS[g.dataset.k] === b.dataset.id))); c.querySelector('#tsBf').classList.toggle('hidden', pickS.type === 'solo'); };
    c.querySelectorAll('.tOpts').forEach(g => g.querySelectorAll('.tOpt').forEach(b => b.onclick = () => { pickS[g.dataset.k] = b.dataset.id; sync(); })); sync();
    c.querySelector('#tsGo').onclick = () => startNew(pickS.type, pickS.back, pickS.type === 'solo' ? null : pickS.bestie);
    const r = c.querySelector('#tsResume'); if (r) r.onclick = () => resume();
    G.showUI('tripSetup'); }
  function startNew(type, back, bf) { if (bestie) { bestie.dispose(); bestie = null; }
    T = save.trip = { v: 1, type, back, bestie: bf, min: START_MIN, speed: 1, m: { energy: 85, hunger: 55, hyd: 50, buzz: 0, vibe: 50, fresh: 45 }, fun: 0, overdid: false, hangover: false,
      closet: ['plane'], accOwned: [], wearing: 'plane', accOn: [], stats: { jobs: 0, photos: 0, blackouts: 0, wins: 0, spent: 0, earned: 0 }, paid: {}, lm: [], selfies: [],
      quest: { wallet: 0, cold: false, suitcase: 0 }, zero: 0, low: false, wishes: [...WISH_SETS[type], ...(bf ? [BESTIE_WISH[bf]] : [])].map(id => ({ id, done: false })),
      danceS: 0, danceTog: 0, rlSpins: 0, hotTubS: 0, needleS: 0, limoS: 0, bf: bf ? { energy: 80, hunger: 50, buzz: 0, mood: 65, lost: null, wanderNight: 0, hypeAt: -999 } : null,
      msgs: [], ended: false, endReason: '', rank: '', pos: null, lastWarn: {}, cdj: -999, cbar: -999, vipDay: 0 };
    G.setCoins(BACKSTORIES[back].cash); wear('plane'); G.setTod(todFor(hour())); if (world) world.npcs.pick.visible = false;
    G.closeUI(); G.parkCar(); G.enterArea('strip', 40, -318, -Math.PI / 2 + 0.25); G.cam.pitch = 0.18;
    if (bf) bestie = createBestie(G, T, { text, fun: (n, why) => addFun(n, why, true), toast: G.toast });
    const B = BACKSTORIES[back], bfL = bf ? `<li>Keep <b>${BESTIES[bf].n}</b> happy (fed, watered, not lost). They love ${BESTIES[bf].loves}.</li>` : '';
    dlg({ title: `🛬 Day 1 · 10:00 AM`, cls: 'introCard', html: `<p>${B.story}</p><p>Now you're at the TILEO KINGDOM curb with <b>${$$(B.cash)}</b>, a prepaid suite (2407, Floor 24) and the clothes on your back.</p>
      <ul class="hubList"><li>Survive until <b>checkout: Day 5, 12:00 PM</b> (1 real minute = 1 game hour).</li><li>Watch your meters: eat, hydrate, rest, shower. Keep your Buzz in the gold sweet spot.</li><li>A security guard by the lobby's Gold Lion Fountain saw who took your wallet. Track it down <b>before Day 4</b>.</li>${bfL}<li>Tick off your Wish List and rack up ⭐ Fun.</li></ul>
      <p class="fine">Tap the trip panel (top left) or 📱 → My trip for everything. Taco & water cart is right here on the forecourt.</p>`, buttons: [["Let's go 🎲", () => { setTimeout(() => go(`💵 ${$$(B.cash)} and a dream. Welcome to Vegas, ${save.look.name}.`), 30); }, 'gold']] });
    persist(); }
  function resume() { T = save.trip; if (bestie) { bestie.dispose(); bestie = null; } wear(T.wearing); G.closeUI(); G.parkCar();
    const P = T.pos; if (P && G.areas[P.a]) { G.enterArea(P.a, P.x, P.z, P.yaw); const q = G.safeSpot(P.x, P.z); player.position.set(q.x, G.areas[P.a].floorY || 0, q.z); } else G.enterArea('strip', 40, -318, -Math.PI / 2 + 0.25);
    G.setTod(todFor(hour())); if (T.bestie) { bestie = createBestie(G, T, { text, fun: (n, why) => addFun(n, why, true), toast: G.toast }); if (T.bf.lost) { const l = T.bf.lost; T.bf.lost = null; bestie.wander(l); } }
    if (world) world.npcs.pick.visible = T.quest.wallet === 2 && !T.quest.cold;
    go(`✈️ Welcome back: Day ${day()} · ${clock()} · ${$$(save.coins)}`); }
  function go(msg) { hud.classList.remove('hidden'); document.body.classList.add('tripPlaying'); G.beginPlay(msg); lastArea = state.area.id; hudNow(); persist(); }

  // ---------------- ending ----------------
  function endTrip(reason) { if (!T || T.ended) return; T.ended = true; T.endReason = reason; busy = false; const wDone = T.wishes.filter(w => w.done).length, cash = save.coins, fun = T.fun, mood = T.bf ? T.bf.mood : null, solo = !T.bf;
    let k; if (reason === 'greyhound') k = 'F'; else if (fun >= 6000 && wDone === T.wishes.length && (solo || mood >= 75) && cash >= 150 && T.stats.blackouts === 0) k = 'S';
    else if (!solo && mood >= 80 && wDone >= 4) k = 'A+'; else if (cash >= 400 || (fun >= 4500 && wDone >= 3)) k = 'A'; else if (fun >= 2200 || wDone >= 3) k = 'B'; else k = 'C';
    const R = RANKS.find(r => r.k === k); T.rank = `${R.n} (${R.k})`; persist(); G.closeUI(); G.parkCar();
    const st = [['💵 Final cash', $$(cash)], ['⭐ Fun points', fun.toLocaleString()], ['📋 Wishes', `${wDone} / ${T.wishes.length}`], ['🫶 Bestie happiness', solo ? 'Solo trip' : `${moodFace(mood)} ${Math.round(mood)}%`],
      ['👔 Final fit', `${OUTFITS[T.wearing].n} · Style ${styleScore()} · Charm ${charm()}`], ['💼 Jobs worked', T.stats.jobs], ['📸 Photos sold', T.stats.photos], ['😵 Blackouts', T.stats.blackouts], ['🎰 Wins', T.stats.wins], ['💼 Wallet', T.quest.wallet >= 3 ? 'recovered' : 'lost forever']];
    const why = reason === 'greyhound' ? '🚌 You hit $0 twice. The Greyhound leaves in 5 minutes.' : reason === 'early' ? '✈️ Early checkout.' : '🛎️ Day 5 · 12:00 PM · checkout time.';
    recapCard.innerHTML = `<h2>🧾 Vegas Trip Checkout</h2><p class="fine">${why} ${TRIP_TYPES[T.type].icon} ${TRIP_TYPES[T.type].n} · ${BK().icon} ${BK().n}</p>
      <div class="tRank r${k.replace('+', 'p')}"><b>${R.n}</b><span>${R.k}-Rank</span><small>${R.d}</small></div>
      <div class="tStats">${st.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('')}</div>
      <div class="tBtns"><button class="gold" id="rcNew">✈️ Start a new trip</button><button id="rcRoam">🌴 Keep roaming</button><button class="ghost" id="rcFree">🎲 Free Play</button></div>`;
    recapCard.querySelector('#rcNew').onclick = () => { G.closeUI(); showSetup(); };
    recapCard.querySelector('#rcRoam').onclick = () => { G.closeUI(); hudNow(); G.toast('🌴 The clock has stopped. Roam the Strip as long as you like.'); };
    recapCard.querySelector('#rcFree').onclick = () => { const u = new URL(location.href); u.searchParams.delete('mode'); location.href = u.pathname + u.search; };
    setTimeout(() => G.showUI('tripRecap'), 60); hudNow(); }

  // ---------------- per-frame ----------------
  function near() { if (!running() || state.area.id !== 'strip' || state.driving) return null; const p = player.position;
    if (Math.hypot(p.x - (SPOTS.cart.x - 1.9), p.z - SPOTS.cart.z) < 2.6) return { label: 'Taco & water cart · order 🌮', act: () => openVenue('cart') };
    if (T.quest.wallet === 2 && !T.quest.cold && Math.hypot(p.x - SPOTS.pickpocket.x, p.z - SPOTS.pickpocket.z) < 2.8) return { label: 'Confront the flamingo-jacket pickpocket 🦩', act: confront };
    return null; }
  function update(dt, t) {
    if (state.tripShow) { showT += dt; const k = Math.min(REVUE.length - 1, Math.floor(showT / 2.7)); $('tsCap').textContent = REVUE[k]; world.animDancers(t, k); if (showT > REVUE.length * 2.7 + 0.6) endShow(); return; }
    if (bestie) bestie.update(dt, t);
    if (!T) return;
    if (state.area.id !== lastArea) { lastArea = state.area.id; areaWarnings(lastArea); }
    if (!running()) { if ((hudT += dt) > 1) { hudT = 0; hudNow(); } return; }
    if (clockRuns()) { advance(dt * T.speed, ''); if (T.m.energy <= 0) blackout(); }
    const A = state.area.id;
    if (A === 'pool') poolCheck();
    if (!state.ui) zeroCheck();
    if (state.emote === 'dance' && A === 'club' && G.inRect(player.position, G.club.danceRect)) { T.danceS += dt; if (T.danceS >= 60) wish('dance60'); if (bestie && bestie.present()) { T.danceTog += dt; if (T.danceTog >= 60) wish('danceTogether'); if ((T.danceTog | 0) % 20 === 0 && T.danceTog - dt < (T.danceTog | 0)) bestie.react('dance'); } }
    if (A === 'needle' && state.tod === 'sunset') { T.needleS += dt; if (T.needleS >= 8) { wish('sunset'); if (bestie && T.needleS - dt < 8) { bestie.react('needle'); addFun(100, 'Sunset from 238 m'); } } }
    if (state.limo) { T.limoS += dt; if (T.limoS >= 20) { wish('limo'); if (bestie && T.limoS - dt < 20) bestie.react('limo'); } } else if (T.limoS < 20) T.limoS = 0;
    if (A === 'pool' && state.pmode === 'sit' && G.waterDepth(player.position) > 0.3 && bestie && bestie.present()) { T.hotTubS += dt; if (T.hotTubS >= 5) { wish('hotTub'); if (T.hotTubS - dt < 5) bestie.react('hotTub'); } }
    if (T.wearing === 'squad' && bestie && bestie.present()) wish('squad');
    if ((hudT += dt) > 0.25) { hudT = 0; hudNow(); }
    if ((saveT += dt) > 5) { saveT = 0; if (!state.limo && !state.cine && !state.ride) { const q = state.driving ? { x: G.car.position.x - 2, z: G.car.position.z } : player.position; T.pos = { a: A === 'needle' || A === 'room' || A === 'rooms' || A === 'pool' || A === 'club' || A === 'lobby' ? A : 'strip', x: +q.x.toFixed(2), z: +q.z.toFixed(2), yaw: +G.cam.yaw.toFixed(2) }; } persist(); }
  }

  // ---------------- hook the resort into the trip ----------------
  const C = G.ctx; G.ctxOrig = { checkIn: C.checkIn };
  C.drink = where => VENUES[where] ? openVenue(where) : G.toast('🥂 Cheers!');
  C.dailyBonus = () => G.toast('Coin Cage: "No ID, no wallet, no bonus, hon." (Trip Cash only on this trip.)');
  C.openShop = () => openBoutique(); C.openWardrobe = () => openWardrobe(); C.vipBooth = () => vip(); C.checkIn = () => frontDesk();
  for (const it of G.club.interacts) if (/VIP bottle-service/.test(typeof it.label === 'string' ? it.label : '')) it.label = 'VIP bottle service · $120 · dress code 🍾';
  for (const it of G.lobby.interacts) if (it.label === 'Coin Cage · daily bonus') it.label = 'Coin Cage';
  { const d = G.rooms.doors && G.rooms.doors.find(q => q.num === 2407); if (d) state.lastDoor = { side: d.side, z: d.z }; }
  document.querySelectorAll('.bet').forEach((b, i) => { const v = [2, 5, 20][i]; if (v) { b.dataset.bet = v; b.textContent = '$' + v; } });
  const firstBet = document.querySelector('.bet'); if (firstBet) firstBet.click();
  { const f = document.querySelector('#slots .fine'); if (f) f.textContent = f.textContent.replace(/·?\s*$/, '') + ' · bets in Trip Cash'; }
  G.C5.onShot = onShot;
  world = buildTripWorld(G, { onVenue: openVenue, onShower, onBed, onDJ, onRevue, onClue, quest: () => (T ? (T.quest.cold ? -1 : T.quest.wallet) : -1) });

  return {
    begin() { const L = save.look; if (!T || T.ended) Object.assign(L, OUTFITS.plane.look(L.body === 'm' ? 'm' : 'f')); G.applyLook(player, L);
      G.openCreator(); $('crTitle').textContent = 'Who\'s flying to Vegas?'; $('crDone').textContent = 'Next: plan the trip ✈️'; },
    afterCreator() { if (T && !T.ended) wear(T.wearing); showSetup(); },
    update, near, canEnter, camera, todTap() { if (T) G.toast(T.ended ? '🌴 The trip is over: time stands still.' : `🕐 Trip clock: Day ${day()} · ${clock()}. Change the pace with the ${speedLbl()} button.`); },
    emit(k, d) { onCasino(k, d || {}); }, bets: [2, 5, 10, 25], brokeMsg: 'Not enough Trip Cash. Work a gig or sell some photos.', money,
    // test hooks
    get T() { return T; }, get bestie() { return bestie; }, get world() { return world; }, advance: m => advance(m), startNew, resume, endTrip, openHub, openVenue, openBoutique, openCheckIn, buy, wear, onBed, onShower, blackout, wish, styleScore, charm, startShow, onDJ, onRevue, workBar, onClue, confront, frontDesk, vip, poolCheck: () => poolCheck(),
  };
}
