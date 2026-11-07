// v8: the arrival. Free Play and the Vegas Trip begin at Sin City International baggage claim:
//   1 · grab your bag off Carousel 11 (you pull it behind you; whoever arrives with you pulls theirs)
//   2 · Booze Library: stock the suite with drinks (optional; they wait for you on the suite's bar cart)
//   3 · pickup curb: your chauffeur holds a sign with your name; the limo drives you up the Strip to TILEO KINGDOM
//   4 · (v8.1) you get out with your bags, walk in, and check in with the concierge at the front desk:
//       the bellman loads the bags on his brass cart and wheels them to the elevators; they wait in your suite
// The trip plugs in its own money, texts and effects through setHooks(); Free Play uses Kingdom Coins.
// v8.1 also gives the trip a generic checklist (setPanel), the bell desk (bagsDown / giveBags) and the airline counter.
import * as THREE from 'three';
import { makeSuitcase, rollBag } from './airport.js?v=1794015301';
import { makeCharacter, animate } from './characters.js?v=1794015301';

export const STASH = {
  bubbly: { n: 'Bottle of bubbly', icon: '🍾', coins: 60, cash: 30, serv: 3, d: '3 glasses · pop it with a Strip view', pour: '🍾 Pop! A glass of bubbly with the Strip glittering below.' },
  tequila: { n: 'Silver tequila', icon: '🥃', coins: 45, cash: 24, serv: 4, d: '4 suite shots · salt and lime included', pour: '🥃 A suite shot of silver tequila. Salt, shot, lime. Wooo!' },
  seltzer: { n: 'Hard seltzer 6-pack', icon: '🍺', coins: 30, cash: 15, serv: 6, d: '6 cans · easy pre-game sips', pour: '🍺 Crack! An ice-cold hard seltzer from the bar cart.' },
  water: { n: 'Water 6-pack', icon: '💧', coins: 10, cash: 9, serv: 6, d: '6 bottles · Vegas is a desert', pour: '💧 Cold water from the bar cart. Hydration is self-care.' },
};
const PI = Math.PI, PI2 = PI / 2, GOLD = 0xd4a640, COMP_C = 0x7b2cbf;

export function createArrival(C) { // C: { $, state, player, cam, save, prefs, areas, limo, comp, toast, transition, enterArea, showUI, closeUI, setCoins, persist, openSlots, updateCamera, syncButtons, renderMini, parkCar, strip }
  const { $, state, player, save, areas } = C, AP = areas.airport, LB = areas.lobby, RM = areas.room;
  let H = {}, S = { active: false }, mine = null, comp = null, compOf = null, panelFn = null, depCarry = false;
  const hk = (k, ...a) => (H[k] ? H[k](...a) : undefined);
  const fmt = n => H.fmt ? H.fmt(n) : `${n} coins`, price = it => H.fmt ? it.cash : it.coins;
  const spend = n => { if (H.spend) return H.spend(n); if (save.coins < n) return false; C.setCoins(save.coins - n); return true; };
  const bagWord = () => H.bagWord || 'bag';
  // ---- DOM: checklist chip, Booze Library card, suite bar-cart card ----
  const panel = document.createElement('div'); panel.id = 'arrival'; panel.className = 'hidden'; $('hud').append(panel); panel.addEventListener('pointerdown', e => e.stopPropagation());
  const ov = (id) => { const o = document.createElement('div'); o.id = id; o.className = 'overlay hidden'; const c = document.createElement('div'); c.className = 'card small arrCard'; o.append(c); document.body.append(o); return c; };
  const shopCard = ov('boozeLib'), cartCard = ov('barCart');

  function stepsHtml() { const st = [[S.bag, `🧳 Grab your ${bagWord()} · Carousel 11`], [S.shop, '🍾 Booze Library · drinks for the suite', true], ...(H.report ? [[S.report, H.report, true]] : []),
      [S.ride, '🚘 Pickup curb · limo to TILEO KINGDOM'], [S.done, '🛎️ Check in with the concierge (front desk) · the bellman takes your bags up']];
    return `<b>🛬 Welcome to Las Vegas</b><ul>${st.map(([d, t, opt]) => `<li class="${d ? 'done' : ''}">${d ? '✅' : '⬜'} ${t}${opt && !d ? ' <i>optional</i>' : ''}</li>`).join('')}</ul><button id="arrSkip" title="Skip the airport">⏭ Skip to TILEO</button>`; }
  let lastHtml = ''; function render() { const html = S.active ? stepsHtml() : panelFn ? panelFn() : null; if (!html) { panel.classList.add('hidden'); lastHtml = ''; return; } panel.classList.remove('hidden'); if (html === lastHtml) return; lastHtml = html; panel.innerHTML = html;
    const sk = panel.querySelector('#arrSkip'); if (sk) sk.onclick = e => { e.stopPropagation(); skip(); }; panel.querySelectorAll('[data-act]').forEach(b => b.onclick = e => { e.stopPropagation(); hk('panelAct', b.dataset.act); }); }

  // ---- bags: yours (gold, pink tag) and your companion's (purple) ----
  function carry(on) { if (on && !mine) mine = rollBag(player, makeSuitcase(GOLD, { tag: true })); if (!on && mine) { if (mine.parent) mine.parent.remove(mine); mine = null; } }
  const companion = () => { const a = C.comp && C.comp.active; return a && a.ch ? a.ch : null; };
  function syncComp() { const ch = companion(), want = !!ch && (S.active || depCarry);
    if (comp && (!want || compOf !== ch)) { if (comp.parent) comp.parent.remove(comp); comp = null; compOf = null; }
    if (want && !comp) { comp = rollBag(ch, makeSuitcase(COMP_C, { metal: 0.35 })); compOf = ch; } }

  function start(o = {}) { const st = H.store ? H.store() : null; S = st || { bag: 0, shop: 0, report: 0, ride: 0, done: 0 }; S.active = true; if (st && st.done) { S.active = false; return false; }
    AP.setName(save.look.name); if (AP.curbLimo && AP.curbLimo.userData.paint) AP.curbLimo.userData.paint.color.set(C.prefs.limoColor === 'black' ? 0x0c0c0e : 0xf4f2ee); carry(!!S.bag); if (!S.bag) AP.bag.start(o.resume ? 1 : 4); else AP.bag.take();
    if (!o.noEnter) { C.parkCar(); C.enterArea('airport', AP.spawnElev.x, AP.spawnElev.z, AP.spawnElev.yaw); C.cam.pitch = 0.2; }
    render(); return true; }
  function grabBag() { if (!AP.bag.on) return; AP.bag.take(); S.bag = 1; carry(true); C.toast(H.bagMsg || '🧳 Got it: your gold hard-shell. Next stop the Booze Library (left of the carousels), then out the front doors to your limo.'); hk('onBag'); C.persist(); render(); }
  // ---- Booze Library ----
  const stashN = () => Object.values(save.stash || {}).reduce((a, b) => a + b, 0);
  function shop() { const sv = save.stash || (save.stash = {}); const money = H.fmt ? H.money() : `🪙 ${save.coins.toLocaleString()} Kingdom Coins`, cap = H.maxBuys || 0, left = cap ? cap - (S.buys || 0) : 0;
    shopCard.innerHTML = `<h2>🍾 Booze Library</h2><p class="fine">"Check out a bottle, return it never." Everything you buy waits on the bar cart in your suite. ${money}${cap ? ` · you can carry ${Math.max(0, left)} more` : ''}</p><div class="arrList"></div><div class="tBtns"><button class="gold" id="blDone">Done</button></div>`;
    const list = shopCard.querySelector('.arrList');
    for (const [id, it] of Object.entries(STASH)) { const r = document.createElement('div'); r.className = 'arrRow'; const p = price(it), have = sv[id] || 0;
      r.innerHTML = `<span class="tIc">${it.icon}</span><span class="tTx"><b>${it.n}</b><small>${it.d}${have ? ` · ${have} in your stash` : ''}</small></span>`; const bt = document.createElement('button'); bt.className = 'gold'; bt.textContent = `Buy ${fmt(p)}`;
      bt.onclick = () => { if (cap && (S.buys || 0) >= cap) return C.toast('🛍️ Your arms are full: that\'s all you can carry to the limo.'); if (!spend(p)) return C.toast(H.broke || 'Not enough coins.'); sv[id] = (sv[id] || 0) + it.serv; S.shop = 1; S.buys = (S.buys || 0) + 1;
        C.toast(`${it.icon} ${it.n} checked out (-${fmt(p)}). It'll be on your suite's bar cart.`); hk('onBuy', id); C.persist(); render(); shop(); }; r.append(bt); list.append(r); }
    shopCard.querySelector('#blDone').onclick = () => C.closeUI(); C.showUI('boozeLib'); }
  // ---- suite bar cart ----
  function openCart() { const sv = save.stash || {}; cartCard.innerHTML = `<h2>🍸 Suite bar cart</h2><p class="fine">Your Booze Library stash.</p><div class="arrList"></div><div class="tBtns"><button class="gold" id="bcDone">Done</button></div>`;
    const list = cartCard.querySelector('.arrList'); for (const [id, it] of Object.entries(STASH)) { const n = sv[id] || 0; if (!n) continue; const r = document.createElement('div'); r.className = 'arrRow';
      r.innerHTML = `<span class="tIc">${it.icon}</span><span class="tTx"><b>${it.n}</b><small>${n} left</small></span>`; const bt = document.createElement('button'); bt.className = 'gold'; bt.textContent = id === 'water' ? 'Drink' : 'Pour one';
      bt.onclick = () => { if (!(sv[id] > 0)) return; if (H.drink && H.drink(id) === false) return; sv[id]--; if (!H.drink) C.toast(it.pour); C.persist(); syncCart(); stashN() ? openCart() : C.closeUI(); }; r.append(bt); list.append(r); }
    cartCard.querySelector('#bcDone').onclick = () => C.closeUI(); C.showUI('barCart'); }
  const cart = new THREE.Group(); cart.position.set(6.9, 0, 1.6); RM.group.add(cart);
  { const gold = new THREE.MeshStandardMaterial({ color: 0xc9a040, metalness: 1, roughness: 0.28 }), glassT = new THREE.MeshStandardMaterial({ color: 0x0e0d0c, roughness: 0.15 });
    for (const y of [0.35, 0.85]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 1.0), glassT); s.position.y = y; cart.add(s); }
    for (const [x, z] of [[-0.28, -0.47], [0.28, -0.47], [-0.28, 0.47], [0.28, 0.47]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), gold); l.position.set(x, 0.45, z); cart.add(l); } }
  const BOT = {}; { const mk = (col, h, r, x, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r, h, 10), new THREE.MeshStandardMaterial({ color: col, roughness: 0.12, metalness: 0.2 })); m.position.set(x, 0.87 + h / 2, z); m.visible = false; cart.add(m); return m; };
    BOT.bubbly = mk(0x1e4a2a, 0.34, 0.05, 0, -0.3); BOT.tequila = mk(0xcfe4ea, 0.3, 0.05, 0, -0.05); BOT.seltzer = mk(0xe8e8f0, 0.13, 0.035, 0.05, 0.2); BOT.water = mk(0x9fd0f0, 0.24, 0.035, -0.05, 0.4); }
  const bagIn = makeSuitcase(GOLD, { tag: true }); bagIn.position.set(-6.1, 0, 1.3); bagIn.rotation.y = 0.6; bagIn.visible = false; RM.group.add(bagIn);
  const bagIn2 = makeSuitcase(COMP_C, { metal: 0.35 }); bagIn2.position.set(-6.2, 0, 2.1); bagIn2.rotation.y = 0.9; bagIn2.visible = false; RM.group.add(bagIn2);
  function syncCart() { const sv = save.stash || {}; for (const k in BOT) BOT[k].visible = (sv[k] || 0) > 0; bagIn.visible = !!save.bagIn; bagIn2.visible = !!save.bagIn && !!save.bagIn2; }
  RM.aabbs.push([6.55, 7.25, 1.05, 2.15]);
  RM.interacts.push({ x: 5.7, z: 1.6, r: 1.45, when: () => stashN() > 0, label: () => `Bar cart · your Booze Library stash (${stashN()}) 🍾`, act: openCart });
  RM.interacts.push({ x: -5.5, z: 1.4, r: 1.2, when: () => !!save.bagIn, label: 'Your suitcase 🧳', act: () => C.toast(H.bagInMsg || '🧳 Unpacked: seven outfits for a three-day trip. Perfectly reasonable.') });

  // ---- lobby: bell desk, the bellman and his brass luggage cart ----
  const BELL = { x: -14.2, z: 12.6 }, DESK = { x: -12.6, z: 0 }, CART0 = new THREE.Vector3(-12.4, 0, 13.4);
  const ROUTE = [[-12.4, 13.4], [-7, 11], [-7, -14], [-3, -21.6]];
  const bellman = makeCharacter({ skin: '#b07a52', hair: '#1a1209', outfit: '#7a1020', style: 'solid', body: 'm', hairStyle: 'buzzed', role: 'business', name: 'Bellman' }); bellman.userData.noInvite = true; LB.group.add(bellman);
  const lcart = new THREE.Group(), cartBags = new THREE.Group(); LB.group.add(lcart); lcart.add(cartBags);
  { const brass = new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 1, roughness: 0.25, emissive: 0x3a2800, emissiveIntensity: 0.3 }), red = new THREE.MeshStandardMaterial({ color: 0x7a1020, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const add = (geo, mat, x, y, z, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; lcart.add(m); return m; };
    add(new THREE.BoxGeometry(1.25, 0.06, 0.66), brass, 0, 0.2, 0); add(new THREE.BoxGeometry(1.2, 0.03, 0.6), red, 0, 0.245, 0);
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 8), brass, s * 0.58, 1.05, 0); for (const z of [-0.28, 0.28]) add(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), dark, s * 0.52, 0.07, z, PI2); }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.025, 8, 24, PI), brass); arch.position.y = 1.9; lcart.add(arch); add(new THREE.CylinderGeometry(0.02, 0.02, 1.16, 8), brass, 0, 1.55, 0, PI2); }
  const stand = new THREE.Group(); stand.position.set(BELL.x - 1.1, 0, BELL.z); LB.group.add(stand);
  { const wood = new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.4 }), brass = new THREE.MeshStandardMaterial({ color: 0xd8b04a, metalness: 1, roughness: 0.25 });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.15, 0.9), wood); b1.position.y = 0.575; stand.add(b1); const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 1.0), brass); b2.position.y = 1.18; stand.add(b2);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, PI * 2, 0, PI / 2), brass); bell.position.set(0.15, 1.21, 0.2); stand.add(bell);
    const [cv, x] = [document.createElement('canvas'), null]; cv.width = 256; cv.height = 64; const g2 = cv.getContext('2d'); g2.fillStyle = '#120c06'; g2.fillRect(0, 0, 256, 64); g2.fillStyle = '#ffcf4a'; g2.font = '900 34px Georgia, serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('BELL DESK', 128, 34);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.2), new THREE.MeshBasicMaterial({ map: t })); sg.position.set(0.41, 0.95, 0); sg.rotation.y = PI2; stand.add(sg); }
  LB.aabbs.push([BELL.x - 1.55, BELL.x - 0.65, BELL.z - 0.5, BELL.z + 0.5]);
  const BM = { go: false, t: 0, seg: 0, p: new THREE.Vector3(), away: 0 };
  function bellHome() { BM.go = false; BM.seg = 0; BM.away = 0; lcart.visible = bellman.visible = true; lcart.position.copy(CART0); lcart.rotation.y = 0; bellman.position.set(BELL.x, 0, BELL.z); bellman.rotation.y = PI2; }
  bellHome();
  LB.anim.push((t, dt) => { if (BM.go) { const [ax, az] = ROUTE[BM.seg], [bx, bz] = ROUTE[BM.seg + 1], dx = bx - lcart.position.x, dz = bz - lcart.position.z, d = Math.hypot(dx, dz), sp = 1.35;
      if (d < 0.1) { BM.seg++; if (BM.seg >= ROUTE.length - 1) { BM.go = false; BM.away = 10; lcart.visible = bellman.visible = false; cartBags.clear(); } }
      else { const st = Math.min(d, sp * dt); lcart.position.x += dx / d * st; lcart.position.z += dz / d * st; const h = Math.atan2(dx, dz); lcart.rotation.y = h + PI2; bellman.position.set(lcart.position.x - Math.sin(h) * 1.05, 0, lcart.position.z - Math.cos(h) * 1.05); bellman.rotation.y = h; }
      animate(bellman, t, sp, ''); return; }
    if (BM.away > 0) { BM.away -= dt; if (BM.away <= 0) bellHome(); return; }
    animate(bellman, t, 0, ''); });
  function bagOnCart(colorOrObj, i) { const bg = colorOrObj.isObject3D ? colorOrObj : makeSuitcase(colorOrObj, colorOrObj === GOLD ? { tag: true } : { metal: 0.35 }); if (bg.parent) bg.parent.remove(bg);
    bg.position.set(-0.28 + i * 0.52, 0.26, 0.05); bg.rotation.set(0, PI2, 0); cartBags.add(bg); return bg; }
  // check-in with the concierge: the bags go on the bellman's cart and up to the suite
  function concierge() { if (!S.active) return false; cartBags.clear(); bellHome(); let n = 0; const hadComp = !!comp;
    if (mine) { bagOnCart(mine, n++); mine = null; } else bagOnCart(GOLD, n++); if (comp) { bagOnCart(comp, n++); comp = null; compOf = null; }
    save.bagIn2 = hadComp; setTimeout(() => { BM.go = true; BM.seg = 0; }, 1600); finish('checkin'); return true; }
  // trip departure: bags come down to the bell desk, you pick them up
  function bagsDown(two) { save.bagIn = false; save.bagIn2 = false; syncCart(); cartBags.clear(); bellHome(); bagOnCart(GOLD, 0); if (two) bagOnCart(COMP_C, 1); C.persist(); }
  function bagsUp(two) { cartBags.clear(); save.bagIn = true; save.bagIn2 = !!two; syncCart(); C.persist(); }
  function giveBags() { cartBags.clear(); depCarry = true; carry(true); syncComp(); C.persist(); }
  function dropBags() { depCarry = false; carry(false); syncComp(); }

  // ---- the ride ----
  function limoLabel() { return !S.active ? 'Ride a limo up the Strip 🚘' : S.bag ? 'Ride your limo to TILEO KINGDOM 🚘' : `Your limo 🚘 (grab your ${bagWord()} first)`; }
  function limoRide() { if (S.active && !S.bag) return C.toast(`🧳 Grab your ${bagWord()} from Carousel 11 first: it's the gold one with the pink tag.`);
    C.closeUI(); C.transition(() => { C.parkCar(); C.enterArea('strip', 30, 596, PI2); if (S.active) S.ride = 1;
      C.limo.start(C.prefs.limoColor || 'white', { s: 19, stop: S.active ? 'TILEO KINGDOM' : null, msg: S.active ? '🚘 Your chauffeur loads the bags in the trunk. Next stop: TILEO KINGDOM, all the way up the Strip.' : null });
      C.updateCamera(1); C.syncButtons(); C.renderMini(true); render(); C.persist(); }); }
  function toStrip() { C.closeUI(); C.transition(() => { C.enterArea('strip', 40, 593, PI2); C.updateCamera(1); C.syncButtons(); C.renderMini(true); }); }
  function finish(how) { if (!S.active) return; S.active = false; S.done = 1; S.bag = S.ride = 1; carry(false); syncComp(); save.bagIn = true; syncCart(); AP.marker.hide(); LM.visible = false; AP.bag.take(); render(); C.persist();
    if (how === 'checkin') setTimeout(() => C.toast(H.doneMsg || '🛎️ The bellman is wheeling your bags up to your suite. Enjoy TILEO KINGDOM!'), 3300); hk('onDone', how); }
  // skip the airport: straight to the lobby with your bags; check in with the concierge to finish
  function skip() { if (!S.active) return; S.bag = S.ride = 1; S.shopSeen = 1; AP.bag.take(); carry(true); C.closeUI();
    C.transition(() => { if (state.limo || C.limo.leaving.on) C.limo.abort(); C.parkCar(); C.enterArea('lobby', -8.5, 2, -PI2); C.updateCamera(1); C.syncButtons(); C.renderMini(true); C.toast('🛎️ Check in with the concierge at the front desk: the bellman takes your bags up.'); render(); C.persist(); }); }
  // ---- markers: airport steps, then the front desk in the lobby ----
  const LM = new THREE.Group(); { const mm = new THREE.MeshBasicMaterial({ color: 0xffcf4a, transparent: true, opacity: 0.85, depthWrite: false }); const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 36), mm); ring.rotation.x = -PI2; ring.position.y = 0.04; LM.add(ring);
    const ar = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 4), new THREE.MeshBasicMaterial({ color: 0xffcf4a })); ar.rotation.x = PI; ar.position.y = 2.7; LM.add(ar); LM.userData.ar = ar; } LM.visible = false; LB.group.add(LM);
  LB.anim.push(t => { if (LM.visible) { LM.userData.ar.position.y = 2.7 + Math.sin(t * 3) * 0.25; LM.userData.ar.rotation.y = t * 1.5; } });
  const SHOP = { x: -25.6, z: 13 }, CURB = { x: 6.5, z: 32.2 };
  function update() { const hide = state.limo || state.driving || state.ride || state.cine; if (mine) mine.visible = !hide; syncComp(); if (comp) comp.visible = !hide;
    if (state.area === LB) { const tg = S.active ? DESK : hk('lobbyTarget'); LM.visible = !!tg; if (tg) LM.position.set(tg.x, 0, tg.z); }
    if (state.area !== AP) return; if (!S.active) { const tg = hk('airportTarget'); if (tg) AP.marker.at(tg.x, tg.z); else AP.marker.hide(); return; }
    if (!S.bag) { if (AP.bag.shown) AP.marker.at(AP.bag.x, AP.bag.z, 0.6); else AP.marker.at(-9.6, -10); }
    else if (!S.shop && !S.shopSeen && player.position.z < 25) AP.marker.at(SHOP.x, SHOP.z); else AP.marker.at(CURB.x, CURB.z);
    if (S.bag && !S.shopSeen && player.position.z > 26) S.shopSeen = 1; }
  function time() { if (H.clock) return H.clock(); const d = new Date(); return { h: d.getHours(), m: d.getMinutes() }; }
  function onEnter(id) { if (id === 'room') syncCart(); if (id === 'lobby' && S.active && S.ride) C.toast('🛎️ Concierge is at the front desk (left). The bellman will take your bags up.'); }
  function onLimoArrive(name) { if (S.active && name === 'TILEO KINGDOM') { S.ride = 1; render(); C.persist(); setTimeout(() => C.toast('🚪 Get out with your bags, walk in, and check in with the concierge at the front desk.'), 1800); } }
  // the bell desk (trip departure) and the airline counter at the airport
  LB.interacts.push({ x: BELL.x + 0.6, z: BELL.z, r: 2.2, when: () => !!hk('bellLabel'), label: () => hk('bellLabel'), act: () => hk('bell') });
  syncCart();
  return { start, finish, skip, grabBag, shop, openCart, limoLabel, limoRide, toStrip, update, time, onEnter, onLimoArrive, render, stashN, syncCart, concierge, bagsDown, bagsUp, giveBags, dropBags,
    setHooks(h) { H = h || {}; render(); }, setPanel(fn) { panelFn = fn; render(); }, get active() { return !!S.active; }, get S() { return S; }, get carrying() { return !!mine; }, get compBag() { return !!comp; }, get bellman() { return { go: BM.go, away: BM.away, x: lcart.position.x, z: lcart.position.z, bags: cartBags.children.length }; }, BELL, DESK,
    counter: () => (H.counter ? H.counter() : C.toast('✈️ Budget Air: "No flight home today? Smart. Vegas isn\'t done with you yet."')),
    bagLabel: () => `🧳 Grab your ${bagWord()} (gold hard-shell, pink tag)`, shopLabel: () => 'Booze Library · stock the suite 🍾', servicesLabel: () => H.servicesLabel || 'Baggage Services 🧾',
    services: () => { if (H.services) return H.services(); C.toast(S.bag || !S.active ? '🧾 Agent: "All your bags made it? A Vegas miracle. Have a fabulous trip!"' : '🧾 Agent: "Carousel 11 is unloading TK 777 right now, hon. Look for the gold one."'); } };
}
