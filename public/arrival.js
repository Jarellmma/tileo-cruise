// v8: the arrival. Free Play and the Vegas Trip begin at Sin City International baggage claim:
//   1 · grab your bag off Carousel 11 (you then pull it behind you)
//   2 · Booze Library: stock the suite with drinks (optional; they wait for you on the suite's bar cart)
//   3 · pickup curb: your chauffeur holds a sign with your name; the limo drives you up the Strip to TILEO KINGDOM
// The trip plugs in its own money, texts and effects through setHooks(); Free Play uses Kingdom Coins.
import * as THREE from 'three';
import { makeSuitcase, rollBag } from './airport.js?v=1794000555';

export const STASH = {
  bubbly: { n: 'Bottle of bubbly', icon: '🍾', coins: 60, cash: 30, serv: 3, d: '3 glasses · pop it with a Strip view', pour: '🍾 Pop! A glass of bubbly with the Strip glittering below.' },
  tequila: { n: 'Silver tequila', icon: '🥃', coins: 45, cash: 24, serv: 4, d: '4 suite shots · salt and lime included', pour: '🥃 A suite shot of silver tequila. Salt, shot, lime. Wooo!' },
  seltzer: { n: 'Hard seltzer 6-pack', icon: '🍺', coins: 30, cash: 15, serv: 6, d: '6 cans · easy pre-game sips', pour: '🍺 Crack! An ice-cold hard seltzer from the bar cart.' },
  water: { n: 'Water 6-pack', icon: '💧', coins: 10, cash: 9, serv: 6, d: '6 bottles · Vegas is a desert', pour: '💧 Cold water from the bar cart. Hydration is self-care.' },
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createArrival(C) { // C: { $, state, player, cam, save, prefs, areas, limo, toast, transition, enterArea, showUI, closeUI, setCoins, persist, openSlots, updateCamera, syncButtons, renderMini, parkCar, strip }
  const { $, state, player, save, areas } = C, AP = areas.airport;
  let H = {}, S = { active: false }, mine = null;
  const hk = (k, ...a) => (H[k] ? H[k](...a) : undefined);
  const fmt = n => H.fmt ? H.fmt(n) : `${n} coins`, price = it => H.fmt ? it.cash : it.coins;
  const spend = n => { if (H.spend) return H.spend(n); if (save.coins < n) return false; C.setCoins(save.coins - n); return true; };
  const bagWord = () => H.bagWord || 'bag';
  // ---- DOM: checklist chip, Booze Library card, suite bar-cart card ----
  const panel = document.createElement('div'); panel.id = 'arrival'; panel.className = 'hidden'; $('hud').append(panel); panel.addEventListener('pointerdown', e => e.stopPropagation());
  const ov = (id) => { const o = document.createElement('div'); o.id = id; o.className = 'overlay hidden'; const c = document.createElement('div'); c.className = 'card small arrCard'; o.append(c); document.body.append(o); return c; };
  const shopCard = ov('boozeLib'), cartCard = ov('barCart');

  function stepsHtml() { const st = [[S.bag, `🧳 Grab your ${bagWord()} · Carousel 11`], [S.shop, '🍾 Booze Library · drinks for the suite', true], ...(H.report ? [[S.report, H.report, true]] : []), [S.ride, '🚘 Pickup curb · limo to TILEO KINGDOM']];
    return `<b>🛬 Welcome to Las Vegas</b><ul>${st.map(([d, t, opt]) => `<li class="${d ? 'done' : ''}">${d ? '✅' : '⬜'} ${t}${opt && !d ? ' <i>optional</i>' : ''}</li>`).join('')}</ul><button id="arrSkip" title="Skip the arrival">⏭ Skip to TILEO</button>`; }
  function render() { if (!S.active) { panel.classList.add('hidden'); return; } panel.innerHTML = stepsHtml(); panel.classList.remove('hidden'); panel.querySelector('#arrSkip').onclick = e => { e.stopPropagation(); skip(); }; }

  // the bag you pull behind you
  function carry(on) { if (on && !mine) mine = rollBag(player, makeSuitcase(0xd4a640, { tag: true })); if (mine) mine.visible = !!on; if (!on && mine) { player.remove(mine); mine = null; } }

  function start(o = {}) { const st = H.store ? H.store() : null; S = st || { bag: 0, shop: 0, report: 0, ride: 0, done: 0 }; S.active = true; if (st && st.done) { S.active = false; return false; }
    AP.setName(save.look.name); if (AP.curbLimo && AP.curbLimo.userData.paint) AP.curbLimo.userData.paint.color.set(C.prefs.limoColor === 'black' ? 0x0c0c0e : 0xf4f2ee); carry(!!S.bag); if (!S.bag) AP.bag.start(o.resume ? 1 : 4); else AP.bag.take();
    if (!o.noEnter) { C.parkCar(); C.enterArea('airport', AP.spawnElev.x, AP.spawnElev.z, AP.spawnElev.yaw); C.cam.pitch = 0.2; }
    render(); return true; }
  function grabBag() { if (!AP.bag.on) return; AP.bag.take(); S.bag = 1; carry(true); C.toast(H.bagMsg || '🧳 Got it: your gold hard-shell. Next stop the Booze Library (left of the carousels), then out the front doors to your limo.'); hk('onBag'); C.persist(); render(); }
  // ---- Booze Library ----
  const stashN = () => Object.values(save.stash || {}).reduce((a, b) => a + b, 0);
  function shop() { const sv = save.stash || (save.stash = {}); const money = H.fmt ? H.money() : `🪙 ${save.coins.toLocaleString()} Kingdom Coins`;
    shopCard.innerHTML = `<h2>🍾 Booze Library</h2><p class="fine">"Check out a bottle, return it never." Everything you buy waits on the bar cart in your suite. ${money}</p><div class="arrList"></div><div class="tBtns"><button class="gold" id="blDone">Done</button></div>`;
    const list = shopCard.querySelector('.arrList');
    for (const [id, it] of Object.entries(STASH)) { const r = document.createElement('div'); r.className = 'arrRow'; const p = price(it), have = sv[id] || 0;
      r.innerHTML = `<span class="tIc">${it.icon}</span><span class="tTx"><b>${it.n}</b><small>${it.d}${have ? ` · ${have} in your stash` : ''}</small></span>`; const bt = document.createElement('button'); bt.className = 'gold'; bt.textContent = `Buy ${fmt(p)}`;
      bt.onclick = () => { if (!spend(p)) return C.toast(H.broke || 'Not enough coins.'); sv[id] = (sv[id] || 0) + it.serv; S.shop = 1; C.toast(`${it.icon} ${it.n} checked out (-${fmt(p)}). It'll be on your suite's bar cart.`); hk('onBuy', id); C.persist(); render(); shop(); }; r.append(bt); list.append(r); }
    shopCard.querySelector('#blDone').onclick = () => C.closeUI(); C.showUI('boozeLib'); }
  // ---- suite bar cart ----
  function openCart() { const sv = save.stash || {}; cartCard.innerHTML = `<h2>🍸 Suite bar cart</h2><p class="fine">Your Booze Library stash.</p><div class="arrList"></div><div class="tBtns"><button class="gold" id="bcDone">Done</button></div>`;
    const list = cartCard.querySelector('.arrList'); for (const [id, it] of Object.entries(STASH)) { const n = sv[id] || 0; if (!n) continue; const r = document.createElement('div'); r.className = 'arrRow';
      r.innerHTML = `<span class="tIc">${it.icon}</span><span class="tTx"><b>${it.n}</b><small>${n} left</small></span>`; const bt = document.createElement('button'); bt.className = 'gold'; bt.textContent = id === 'water' ? 'Drink' : 'Pour one';
      bt.onclick = () => { if (!(sv[id] > 0)) return; if (H.drink && H.drink(id) === false) return; sv[id]--; if (!H.drink) C.toast(it.pour); C.persist(); syncCart(); stashN() ? openCart() : C.closeUI(); }; r.append(bt); list.append(r); }
    cartCard.querySelector('#bcDone').onclick = () => C.closeUI(); C.showUI('barCart'); }
  // bar cart + your suitcase in the suite
  const RM = areas.room, cart = new THREE.Group(); cart.position.set(6.9, 0, 1.6); RM.group.add(cart);
  { const gold = new THREE.MeshStandardMaterial({ color: 0xc9a040, metalness: 1, roughness: 0.28 }), glassT = new THREE.MeshStandardMaterial({ color: 0x0e0d0c, roughness: 0.15 });
    for (const y of [0.35, 0.85]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 1.0), glassT); s.position.y = y; cart.add(s); }
    for (const [x, z] of [[-0.28, -0.47], [0.28, -0.47], [-0.28, 0.47], [0.28, 0.47]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), gold); l.position.set(x, 0.45, z); cart.add(l); } }
  const BOT = {}; { const mk = (col, h, r, x, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r, h, 10), new THREE.MeshStandardMaterial({ color: col, roughness: 0.12, metalness: 0.2 })); m.position.set(x, 0.87 + h / 2, z); m.visible = false; cart.add(m); return m; };
    BOT.bubbly = mk(0x1e4a2a, 0.34, 0.05, 0, -0.3); BOT.tequila = mk(0xcfe4ea, 0.3, 0.05, 0, -0.05); BOT.seltzer = mk(0xe8e8f0, 0.13, 0.035, 0.05, 0.2); BOT.water = mk(0x9fd0f0, 0.24, 0.035, -0.05, 0.4); }
  const bagIn = makeSuitcase(0xd4a640, { tag: true }); bagIn.position.set(-6.1, 0, 1.3); bagIn.rotation.y = 0.6; bagIn.visible = false; RM.group.add(bagIn);
  function syncCart() { const sv = save.stash || {}; for (const k in BOT) BOT[k].visible = (sv[k] || 0) > 0; bagIn.visible = !!save.bagIn; }
  RM.aabbs.push([6.55, 7.25, 1.05, 2.15]);
  RM.interacts.push({ x: 5.7, z: 1.6, r: 1.45, when: () => stashN() > 0, label: () => `Bar cart · your Booze Library stash (${stashN()}) 🍾`, act: openCart });
  RM.interacts.push({ x: -5.5, z: 1.2, r: 1.2, when: () => !!save.bagIn, label: 'Your suitcase 🧳', act: () => C.toast(H.bagInMsg || '🧳 Unpacked: seven outfits for a three-day trip. Perfectly reasonable.') });
  // ---- the ride ----
  function limoLabel() { return !S.active ? 'Ride a limo up the Strip 🚘' : S.bag ? 'Ride your limo to TILEO KINGDOM 🚘' : `Your limo 🚘 (grab your ${bagWord()} first)`; }
  function limoRide() { if (S.active && !S.bag) return C.toast(`🧳 Grab your ${bagWord()} from Carousel 11 first: it's the gold one with the pink tag.`);
    C.closeUI(); C.transition(() => { C.parkCar(); C.enterArea('strip', 30, 596, PI2); if (S.active) S.ride = 1;
      C.limo.start(C.prefs.limoColor || 'white', { s: 19, stop: S.active ? 'TILEO KINGDOM' : null, msg: S.active ? '🚘 Your chauffeur loads your bag. Next stop: TILEO KINGDOM, all the way up the Strip.' : null });
      C.updateCamera(1); C.syncButtons(); C.renderMini(true); render(); C.persist(); }); }
  function toStrip() { C.closeUI(); C.transition(() => { C.enterArea('strip', 40, 593, PI2); C.updateCamera(1); C.syncButtons(); C.renderMini(true); }); }
  function finish(how) { if (!S.active) return; S.active = false; S.done = 1; S.bag = 1; carry(false); save.bagIn = true; syncCart(); AP.marker.hide(); AP.bag.take(); render(); C.persist();
    C.toast(H.doneMsg || (save.room ? '🛎️ Welcome back to TILEO KINGDOM! A bellhop whisks your bag up to your suite.' : '🛎️ Welcome to TILEO KINGDOM! A bellhop takes your bag: it will be in your suite once you check in at the front desk.')); hk('onDone', how); }
  function skip() { if (!S.active) return; const inAir = state.area && state.area.id === 'airport'; finish('skip');
    if (inAir || (state.area && state.area.id === 'strip' && !state.limo)) C.transition(() => { const d = C.strip.tileo; C.enterArea('strip', d.doorX - 8, d.doorZ, PI2); C.updateCamera(1); C.syncButtons(); C.renderMini(true); }); }
  // ---- per frame: marker, bag visibility ----
  const SHOP = { x: -25.6, z: 13 }, CURB = { x: 6.5, z: 32.2 };
  function update() { if (mine) mine.visible = !state.limo && !state.driving && !state.ride && !state.cine;
    if (state.area !== AP) return; if (!S.active) { AP.marker.hide(); return; }
    if (!S.bag) { if (AP.bag.shown) AP.marker.at(AP.bag.x, AP.bag.z, 0.6); else AP.marker.at(-9.6, -10); }
    else if (!S.shop && !S.shopSeen && player.position.z < 25) AP.marker.at(SHOP.x, SHOP.z); else AP.marker.at(CURB.x, CURB.z);
    if (S.bag && !S.shopSeen && player.position.z > 26) S.shopSeen = 1; }
  function time() { if (H.clock) return H.clock(); const d = new Date(); return { h: d.getHours(), m: d.getMinutes() }; }
  function onEnter(id) { if (id === 'room') syncCart(); if (S.active && id === 'lobby') finish('lobby'); }
  function onLimoArrive(name) { if (S.active && name === 'TILEO KINGDOM') finish('limo'); }
  syncCart();
  return { start, finish, skip, grabBag, shop, openCart, limoLabel, limoRide, toStrip, update, time, onEnter, onLimoArrive, render, stashN, syncCart,
    setHooks(h) { H = h || {}; render(); }, get active() { return !!S.active; }, get S() { return S; },
    bagLabel: () => `🧳 Grab your ${bagWord()} (gold hard-shell, pink tag)`, shopLabel: () => 'Booze Library · stock the suite 🍾', servicesLabel: () => H.servicesLabel || 'Baggage Services 🧾',
    services: () => { if (H.services) return H.services(); C.toast(S.bag || !S.active ? '🧾 Agent: "All your bags made it? A Vegas miracle. Have a fabulous trip!"' : '🧾 Agent: "Carousel 11 is unloading TK 777 right now, hon. Look for the gold one."'); } };
}
const PI2 = Math.PI / 2;
