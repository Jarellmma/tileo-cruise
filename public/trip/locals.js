// Epic or Fail: Vegas Trip, Stage 3: crew + romance. Eight named Vegas locals with their own schedules, tastes and voices.
// Chat (flirty / funny / sincere) builds Connection; at 40 they'll join your crew (max 3), at 70+ a romance-eligible local may come back
// to your suite at night (fade to black, morning-after note). Rules: they can say no and it holds for the night; anyone who has had too much
// goes home instead; you can't ask while you're past your own sweet spot. Non-explicit throughout.

// schedule periods: day 10–17, sunset 17–20, night 20–24, late 0–4 (4–10 they're asleep)
export const PERIODS = h => h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'sunset' : h >= 20 ? 'night' : h < 4 ? 'late' : 'off';
const NEEDLE = 'needle';
export const LOCALS = {
  sienna: { n: 'Sienna', role: 'Sunset photographer', icon: '📸', tone: 'sincere', look: { body: 'f', face: 'femalep02', outfit: '#f2efe8', style: 'white', glasses: 'aviator' },
    sched: { day: ['pool', -26, -36, 0.6, 'phone'], sunset: [NEEDLE, 0.9, 0, 0, 'phone'], night: ['lobby', -6.5, 12.5, 2.2, 'talk'], late: ['club', 8, 15, 3.4, 'dance'] },
    where: { day: 'the pool deck', sunset: 'the Sky Needle deck', night: 'the lobby lounge', late: 'the Mega Club' },
    intro: '"Hold still, the light on you is perfect… oh! Sorry. I\'m Sienna. I shoot the Strip at golden hour."',
    prompts: ['"What\'s the most beautiful thing you\'ve seen in Vegas so far?"', '"Do you ever take a photo and realize you were happier than you knew?"', '"If you could freeze one moment from this trip, which one?"'],
    yes: '"I\'d like that. Show me the view from your floor?"', morning: 'Sienna is gone when you wake up, but she left a sunrise photo of the Strip from your window and a note: "Golden hour, same place tonight? 📸"' },
  nia: { n: 'Nia', role: 'Blackjack pro', icon: '🃏', tone: 'funny', look: { body: 'f', face: 'ftee', outfit: '#111111', style: 'solid', cut: 'tee', glasses: 'round' },
    sched: { day: ['lobby', 58.5, 18.6, 3.1, 'fold'], sunset: ['lobby', 13.5, -13.5, 2.4, 'talk'], night: ['lobby', 58.5, 18.6, 3.1, 'fold'], late: ['lobby', 58.5, 18.6, 3.1, 'phone'] },
    where: { day: 'the blackjack tables', sunset: 'outside the Lion\'s Den Steakhouse', night: 'the blackjack tables', late: 'the blackjack tables' },
    intro: '"You\'re standing like you\'re about to split tens. Don\'t. I\'m Nia. I count cards. Legally. In my heart."',
    prompts: ['"Quick: hit or stand on sixteen against a dealer seven?"', '"I\'m up eleven hundred play-dollars. Should I buy a yacht or a churro?"', '"Tell me your worst Vegas decision so far. I\'ll rate it."'],
    yes: '"Okay. But I\'m bringing my lucky deck."', morning: 'Nia left early for the morning tables. On your pillow: a single ace of hearts and "Dealer stands on 17. I stand on you. — N 🃏"' },
  valentina: { n: 'Valentina', role: 'Fashion buyer', icon: '👠', tone: 'flirty', look: { body: 'f', face: 'ftank', outfit: '#ffffff', style: 'tiger', glasses: '' },
    sched: { day: ['lobby', 9.5, 18.5, 2.0, 'phone'], sunset: ['pool', 12, -24, 3.0, 'talk'], night: ['club', -20, 2, 1.57, 'dance'], late: ['club', -20, 2, 1.57, 'talk'] },
    where: { day: 'by Tiger Boutique', sunset: 'the pool deck', night: 'the Mega Club VIP row', late: 'the Mega Club VIP row' },
    intro: '"Who dressed you? No, don\'t tell me. Let me guess… the airline. I\'m Valentina. I buy for the boutiques."',
    prompts: ['"Be honest: is this jacket too much or exactly enough?"', '"What would you wear if nobody was watching?"', '"Rate this city out of ten. Then rate me. Kidding. Mostly."'],
    yes: '"Lead the way, darling. I hope your suite has good lighting."', morning: 'Valentina kissed your cheek on the way out and left a boutique card: "Come by today, I\'m pulling something in your size. 💋"' },
  zara: { n: 'Zara', role: 'Stand-up comedian', icon: '🎤', tone: 'funny', look: { body: 'f', face: 'femalea03', outfit: '#7b2cbf', style: 'solid', cut: 'tank', glasses: '' },
    sched: { day: ['strip', 18.6, 122, -1.57, 'phone'], sunset: ['lobby', 5, 18, 3.14, 'talk'], night: ['club', 8, 15, 3.4, 'talk'], late: ['strip', 24, -303.5, -1.4, ''] },
    where: { day: 'the Strip by Flamingo Pink', sunset: 'the lobby, by the doors', night: 'the Mega Club', late: 'the taco cart outside TILEO KINGDOM' },
    intro: '"Hey! You look like material. I mean that nicely. I\'m Zara, I do stand-up at the lounge. Badly. Ten o\'clock."',
    prompts: ['"Give me your best Vegas joke. I\'ll steal it if it\'s good."', '"Why do they call it Sin City and not Snack City? Look at these tacos."', '"Okay, honestly: what brought you here?"'],
    yes: '"Yes. But if this becomes a bit in my set, you signed a waiver."', morning: 'Zara left at dawn, after writing "my new opener" on the hotel notepad: a five-minute bit about your snoring. It\'s… really good. 🎤' },
  mateo: { n: 'Mateo', role: 'Salsa instructor', icon: '💃', tone: 'flirty', look: { body: 'm', face: 'malea16', outfit: '#b0102a', style: 'solid', cut: 'polo', glasses: '' },
    sched: { day: ['pool', 10, -30, 3.0, 'talk'], sunset: ['lobby', 2, 18.5, 3.14, 'talk'], night: ['club', -4, -6, 0, 'dance'], late: ['club', -4, -6, 0, 'dance'] },
    where: { day: 'the pool deck', sunset: 'the lobby', night: 'the Mega Club dance floor', late: 'the Mega Club dance floor' },
    intro: '"You move like someone who\'s afraid of the beat. I can fix that. Mateo. I teach salsa downstairs."',
    prompts: ['"One-two-three, five-six-seven. Are you counting or are you feeling it?"', '"What\'s your move when the DJ drops your song?"', '"Life\'s short, the night is long. What are you saying yes to tonight?"'],
    yes: '"I thought you\'d never ask. Let\'s go."', morning: 'Mateo left a note under the coffee cup: "Class at 3. Front row is yours. 💃"' },
  theo: { n: 'Theo', role: 'Mixologist', icon: '🍸', tone: 'funny', look: { body: 'm', face: 'mtank', outfit: '#1f6f8b', style: 'solid', cut: 'tank', glasses: '' },
    sched: { day: ['pool', -46, -34, 3.0, 'talk'], sunset: ['pool', 44, -34, 3.0, 'talk'], night: ['club', -6, 18.5, 3.14, 'talk'], late: ['lobby', 23.5, 15, 1.2, 'fold'] },
    where: { day: 'the west tiki bar', sunset: 'the east tiki bar', night: 'the Tiger Bar in the Mega Club', late: 'the Lion Lounge in the casino' },
    intro: '"You look like a Velvet Roar kind of person. Or a water kind of person. Both valid. I\'m Theo. I make the drinks taste like decisions."',
    prompts: ['"Name a cocktail after your trip so far. Go."', '"Tequila: friend or enemy?"', '"What do you actually want out of tonight?"'],
    yes: '"I\'ll bring the good mixers. Kidding. Water. I\'ll bring water."', morning: 'Theo left you a glass of water, two aspirin and a note: "Hydrate. Then come see me at the Tiger Bar. 🍸"' },
  dre: { n: 'Dre', role: 'Music producer', icon: '🎚️', tone: 'sincere', look: { body: 'm', face: 'malea08', outfit: '#ffc94a', style: 'gold', glasses: 'aviator' },
    sched: { day: ['lobby', -5, 18.5, 3.14, 'phone'], sunset: [NEEDLE, -0.9, 0, 0, 'phone'], night: ['club', 8, -18.5, -0.4, 'talk'], late: ['club', 8, -18.5, -0.4, 'phone'] },
    where: { day: 'the lobby', sunset: 'the Sky Needle deck', night: 'by the DJ booth', late: 'by the DJ booth' },
    intro: '"You were nodding to that bassline. Nobody nods to the bassline. I\'m Dre. I produced half of what DJ Tileo plays tonight."',
    prompts: ['"What song is the soundtrack of your trip?"', '"Real talk: what are you running from, or running to?"', '"If tonight had a drop, when would it hit?"'],
    yes: '"Yeah. Let\'s get out of this noise for a while."', morning: 'Dre left his headphones on your nightstand with a track queued: "untitled (2407)". It\'s beautiful. 🎚️' },
  kai: { n: 'Kai', role: 'Surf instructor on vacation', icon: '🏄', tone: 'sincere', look: { body: 'm', face: 'malea04', outfit: '#2fb5c9', style: 'swim', glasses: 'round' },
    sched: { day: ['pool', -39.4, 24, -1.57, ''], sunset: ['pool', -3.2, 36.4, 3.1, 'talk'], night: ['lobby', -15, 11.5, 1.2, 'talk'], late: ['pool', -39.4, 24, -1.57, ''] },
    where: { day: 'the rooftop hot tubs', sunset: 'the pool Grotto', night: 'the lobby, by the front desk', late: 'the rooftop hot tubs' },
    intro: '"No waves here, but this hot tub is gnarly. Kai. I teach surfing in Oahu. Here I mostly float."',
    prompts: ['"When did you last do nothing and feel great about it?"', '"Desert or ocean? You can only pick one forever."', '"What does a perfect day look like for you?"'],
    yes: '"Sure, if we can watch the sunrise. That\'s non-negotiable."', morning: 'Kai woke you up for the sunrise. He was right. Then he left a shell on the windowsill: "From home. Come visit. 🏄"' },
};
export const TONES = { flirty: ['😏', 'Flirty'], funny: ['😂', 'Funny'], sincere: ['🙂', 'Sincere'] };
const REACT = {
  liked: ['{n} laughs, really laughs. "Okay, I like you."', '{n} lights up. "That\'s exactly the right answer."', '"Oh, you\'re good," {n} says, stepping closer.'],
  ok: ['{n} smiles. "Fair."', '"Ha. Okay, okay," says {n}.', '{n} nods along, amused.'],
  meh: ['{n} raises an eyebrow. "…Interesting choice."', '"Hm." {n} glances at their phone.', '{n} gives you a polite smile. Not your best.'],
  sloppy: ['You\'re slurring a little. {n} hands you a water and changes the subject.'],
};
export const NIGHT_TEXT = ['The door clicks shut on the Strip\'s noise. You put the Night Drive station on, order way too many fries from room service, and talk until the sky over the Strip turns pink.', 'You both kick your shoes off by the window. The city glitters 24 floors down. The rest of the night is yours. Fade to black.'];
export const INTERESTS = { everyone: ['💞', 'Everyone'], f: ['👩', 'Women'], m: ['👨', 'Men'], none: ['🤝', 'Just the crew'] };
const R = a => a[Math.random() * a.length | 0];

export function createLocals(G, T, api) { // api: { dlg, rowItem, toast, addFun, spend, earn, text, charm, top, hour, day, clock, jump, bestie(), wish, persist, el }
  const { THREE, state, player, areas } = G;
  T.loc = T.loc || {}; T.crew = T.crew || []; T.interest = T.interest || 'everyone'; T.nights = T.nights || 0;
  const S = id => T.loc[id] || (T.loc[id] = { c: 0, met: false, last: -999, drinks: 0, dDay: 0, no: 0, nights: 0, buzz: 0, gone: 0 });
  const chars = {}, tags = {}, v = new THREE.Vector3(); let trail = [], lastArea = '';
  const period = () => PERIODS(api.hour());
  const spotFor = (id, p = period()) => { if (T.crew.includes(id)) return null; const s = S(id); if (s.gone === api.day()) return null; const sp = LOCALS[id].sched[p]; if (!sp) return null;
    if (sp[0] === NEEDLE) { const N = G.needleA, a = Math.atan2(N.spawn.z - N.ring.cz, N.spawn.x - N.ring.cx) + sp[1] * 0.35, r = Math.hypot(N.spawn.x - N.ring.cx, N.spawn.z - N.ring.cz); return ['needle', N.ring.cx + Math.cos(a) * r, N.ring.cz + Math.sin(a) * r, Math.atan2(Math.cos(a), Math.sin(a)), sp[4]]; } // facing out over the view
    return sp; };
  for (const [id, L] of Object.entries(LOCALS)) { const ch = G.makeCharacter({ name: L.n, banded: true, hairStyle: L.look.body === 'm' ? 'parted' : 'long', skin: '#d9a47c', hair: '#1a1209', ...L.look }); ch.userData.noInvite = true; ch.visible = false; G.scene.add(ch); chars[id] = ch;
    const tg = document.createElement('div'); tg.className = 'ntag locTag'; tg.innerHTML = '<span class="nname"></span>'; G.$('nameTags').appendChild(tg); tags[id] = tg; }
  const canRomance = id => T.interest !== 'none' && (T.interest === 'everyone' || LOCALS[id].look.body === T.interest);
  const crewChars = () => T.crew.map(id => chars[id]);

  // place everyone where their schedule says (or behind you if they're in your crew)
  function place() { const A = state.area.id;
    for (const id of Object.keys(LOCALS)) { const ch = chars[id];
      if (T.crew.includes(id)) continue;
      const sp = spotFor(id); if (!sp || sp[0] !== A) { ch.visible = false; continue; }
      ch.visible = true; ch.position.set(sp[1], (areas[sp[0]].floorY || 0) - (sp[0] === 'pool' && G.waterDepth({ x: sp[1], z: sp[2] }) > 0.3 ? Math.min(0.6, G.waterDepth({ x: sp[1], z: sp[2] })) : 0), sp[2]); ch.rotation.y = sp[3]; } }
  function crewFollow(dt, t) { const hide = state.driving || state.limo || state.cine || state.ride || state.tripShow;
    const A = state.area.id, p = player.position; if (A !== lastArea) { lastArea = A; trail = []; crewChars().forEach((ch, k) => { ch.position.set(p.x - Math.sin(player.rotation.y) * (2 + k), p.y, p.z - Math.cos(player.rotation.y) * (2 + k)); }); }
    if (!trail.length || Math.hypot(trail[0].x - p.x, trail[0].z - p.z) > 0.45) { trail.unshift({ x: p.x, z: p.z }); if (trail.length > 40) trail.length = 40; }
    crewChars().forEach((ch, k) => { ch.visible = !hide; if (hide) return; const tg = trail[Math.min(trail.length - 1, 5 + k * 3)] || p, side = (k % 2 ? 1 : -1) * 0.7;
      const tx = tg.x + Math.cos(player.rotation.y) * side, tz = tg.z - Math.sin(player.rotation.y) * side, dx = tx - ch.position.x, dz = tz - ch.position.z, d = Math.hypot(dx, dz);
      ch.position.y = p.y - (state.pmode === 'swim' ? 0 : 0); if (d > 25) { ch.position.x = tx; ch.position.z = tz; }
      if (d > 0.4) { const sp = Math.min(11, d * 2 + 1.2), f = Math.min(1, sp * dt / d); ch.position.x += dx * f; ch.position.z += dz * f; const ty = Math.atan2(dx, dz); let dr = ty - ch.rotation.y; while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI; ch.rotation.y += dr * Math.min(1, dt * 10); G.animate(ch, t, sp, ''); }
      else G.animate(ch, t, 0, state.emote === 'dance' ? 'dance' : 'talk'); }); }
  let lastP = '', placeT = 0;
  function update(dt, t) {
    const p = period(); placeT -= dt; if (p !== lastP || state.area.id !== lastArea || placeT <= 0) { lastP = p; placeT = 2; place(); }
    crewFollow(dt, t);
    const A = state.area.id;
    for (const id of Object.keys(LOCALS)) { const ch = chars[id], tg = tags[id];
      if (!T.crew.includes(id) && ch.visible) { const sp = spotFor(id); G.animate(ch, t, 0, sp ? sp[4] : ''); }
      const s = S(id), show = ch.visible && !state.ui && state.started && !state.tripShow && !document.body.classList.contains('photoMode');
      if (!show) { tg.style.display = 'none'; continue; }
      v.set(ch.position.x, ch.position.y + 2.0, ch.position.z); const d = v.distanceTo(G.camera.position); v.project(G.camera);
      if (v.z > 1 || d > (s.met ? 22 : 12)) { tg.style.display = 'none'; continue; }
      const L = LOCALS[id], txt = s.met ? `${L.icon} ${L.n} · ${'❤️'.repeat(s.c >= 70 ? 1 : 0)}${Math.round(s.c)}%${T.crew.includes(id) ? ' · crew' : ''}` : `${L.icon} ${L.role}`;
      const nm = tg.firstChild; if (nm.textContent !== txt) nm.textContent = txt; tg.style.display = ''; tg.style.transform = `translate(${((v.x + 1) / 2 * innerWidth).toFixed(1)}px, ${((1 - v.y) / 2 * innerHeight).toFixed(1)}px) translate(-50%, -100%)`; }
  }
  function tick(h) { for (const id of Object.keys(LOCALS)) { const s = S(id); s.buzz = Math.max(0, s.buzz - 12 * h); }
    for (const id of [...T.crew]) { const s = S(id); s.mood = Math.max(0, Math.min(100, (s.mood ?? 60) + ((60 - (s.mood ?? 60)) * 0.04 + (T.m.vibe > 65 ? 4 : T.m.vibe < 30 ? -6 : 0)) * h)); if (s.mood < 15) leaveCrew(id, `${LOCALS[id].n}: "This is kinda dead. I'm gonna bounce. Text me later?"`); } }
  function nearest(r = 2.3) { let best = null, bd = r; for (const id of Object.keys(LOCALS)) { const ch = chars[id]; if (!ch.visible || T.crew.includes(id)) continue; const d = Math.hypot(ch.position.x - player.position.x, ch.position.z - player.position.z); if (d < bd) { bd = d; best = id; } } return best; }
  function near() { const id = nearest(); if (!id) return null; const L = LOCALS[id], s = S(id); return { label: s.met ? `Chat with ${L.n} ${L.icon}` : `Say hi to the ${L.role.toLowerCase()} 👋`, act: () => chat(id) }; }

  // ---------------- chat ----------------
  function chat(id, after) { const L = LOCALS[id], s = S(id), first = !s.met; s.met = true; const cool = !first && T.min - s.last < 60 && !after;
    const bar = `<div class="tMeter"><span>❤️ Connection</span><s><u style="width:${s.c}%"></u></s><b>${Math.round(s.c)}%</b></div>`;
    const hint = s.chats >= 2 ? `<p class="fine">${L.n} seems to like <b>${TONES[L.tone][1].toLowerCase()}</b> answers.</p>` : '';
    const body = after ? `<p>${after}</p>` : first ? `<p>${L.intro}</p>` : cool ? `<p>"${R(['Back already? I like the persistence.', 'Hey you. Give me a minute, I\'m mid-thought.', 'Twice in an hour? People will talk.'])}"</p>` : `<p>${R(L.prompts)}</p>`;
    const list = api.dlg({ title: `${L.icon} ${L.n} · ${L.role}`, html: `${body}<div class="tMeters">${bar}</div>${hint}`, buttons: [['Bye for now']] });
    if (!cool && !after) { const row = api.el('div', 'tToneRow'); for (const [k, [ic, n]] of Object.entries(TONES)) { const b = api.el('button', 'gold', `${ic} ${n}`); b.onclick = () => answer(id, k); row.append(b); } list.append(row); }
    const nightOK = api.hour() >= 20 || api.hour() < 3.5, sloppy = T.m.buzz > api.top();
    if (s.dDay !== api.day()) { s.dDay = api.day(); s.drinks = 0; }
    api.rowItem(list, '🍸', `Buy ${L.n} a drink`, s.drinks >= 2 ? `"I'm good, just water for me. Thanks though!"` : '+Connection · $15', [['$15', () => { if (!api.spend(15)) return api.toast('💸 Not enough Trip Cash.'); s.drinks++; s.buzz = Math.min(100, s.buzz + 20); s.c = Math.min(100, s.c + 6); api.addFun(15); chat(id, `${L.n} clinks your glass. "Cheers to bad decisions. Small ones."`); }, '', s.drinks >= 2 || save().coins < 15]]);
    if (!T.crew.includes(id)) api.rowItem(list, '🤝', 'Invite to your crew', s.c >= 40 ? (T.crew.length >= 3 ? 'Your crew is full (3)' : 'They\'ll tag along tonight · more Fun, more rounds to buy') : `Needs 40% Connection`, [['Invite', () => joinCrew(id), '', s.c < 40 || T.crew.length >= 3 || period() === 'off']]);
    else api.rowItem(list, '👋', 'Let them go for now', 'They head back to their usual spot', [['Goodnight', () => { leaveCrew(id, `${L.n}: "Text me! Seriously."`); G.closeUI(); }]]);
    if (canRomance(id)) { const why = !nightOK ? 'After 8 PM' : s.c < 70 ? 'Needs 70% Connection' : s.no === api.day() ? `${L.n} said not tonight` : sloppy ? 'You\'ve had too much to ask' : T.m.energy < 25 ? 'You\'re too tired' : '';
      api.rowItem(list, '🌙', 'Invite back to your suite', why || 'They might say yes. They might not. Either is fine.', [['Ask', () => askSuite(id), '', !!why]]); }
  }
  function answer(id, tone) { const L = LOCALS[id], s = S(id); s.last = T.min; s.chats = (s.chats || 0) + 1;
    const sloppy = T.m.buzz > api.top(), k = sloppy ? 'sloppy' : tone === L.tone ? 'liked' : (tone === 'flirty' && L.tone === 'sincere') || (tone === 'sincere' && L.tone === 'flirty') ? 'meh' : 'ok';
    const base = { liked: 14, ok: 6, meh: -4, sloppy: 1 }[k], mult = 0.6 + api.charm() / 100 * 0.8, gain = Math.round(base > 0 ? base * mult : base);
    s.c = Math.max(0, Math.min(100, s.c + gain)); if (gain > 0) api.addFun(10 + gain); if (T.crew.includes(id)) s.mood = Math.min(100, (s.mood ?? 60) + 5);
    chat(id, `${R(REACT[k]).replace('{n}', L.n)} <b>${gain >= 0 ? '+' : ''}${gain}%</b>`); api.persist(); }
  function joinCrew(id) { const L = LOCALS[id], s = S(id); if (T.crew.includes(id) || T.crew.length >= 3) return; T.crew.push(id); s.mood = 65; T.crewMax = Math.max(T.crewMax || 0, T.crew.length); T.crewEver = [...new Set([...(T.crewEver || []), id])];
    G.closeUI(); api.toast(`🤝 ${L.n} joined your crew! (${T.crew.length}/3) Rounds cost more, but everything's more fun.`); trail = []; lastArea = ''; if (T.crew.length >= 3) api.wish('crew3'); api.persist(); }
  function leaveCrew(id, msg) { const i = T.crew.indexOf(id); if (i < 0) return; T.crew.splice(i, 1); chars[id].visible = false; placeT = 0; if (msg) api.text(LOCALS[id].n, msg.replace(/^.*?: /, '')); api.persist(); }
  function disband(msg) { if (!T.crew.length) return; const names = T.crew.map(id => LOCALS[id].n).join(', '); for (const id of [...T.crew]) leaveCrew(id); api.text('Crew', msg || `${names}: "Best night ever. Same time tomorrow?" 🫶`); }

  // ---------------- the suite question ----------------
  function askSuite(id) { const L = LOCALS[id], s = S(id); G.closeUI();
    if (s.buzz > 60) { s.gone = api.day(); if (T.crew.includes(id)) leaveCrew(id); place(); return api.dlg({ title: `${L.icon} ${L.n}`, html: `<p>"Honestly? I've had a few too many to make good decisions tonight. I'm heading home. Rain check?"</p><p class="fine">They head home for the night. No hard feelings: ask another night.</p>`, buttons: [['Get home safe 👋', null, 'gold']] }); }
    const score = s.c + api.charm() * 0.3 + T.m.vibe * 0.2;
    if (score < 100) { s.no = api.day(); s.c = Math.max(0, s.c - 3); return api.dlg({ title: `${L.icon} ${L.n}`, html: `<p>${R(['"Not tonight. But I really did have fun."', '"I\'m going to say no, but ask me again sometime."', '"Tempting! But I\'m calling it a night. Solo."'])}</p><p class="fine">A no holds for tonight. Build more Connection, look sharp, keep your Vibe up.</p>`, buttons: [['Totally fair', null, 'gold']] }); }
    const B = api.bestie(); api.dlg({ title: `${L.icon} ${L.n}`, html: `<p>${L.yes}</p>${B && B.present() ? `<p class="fine">${B.B.n} will be on their own for the rest of the night.</p>` : ''}`, buttons: [['🌙 Head up to Suite 2407', () => { setTimeout(() => night(id), 30); }, 'gold'], ['Actually, not tonight', null]] }); }
  function night(id) { const L = LOCALS[id], s = S(id), B = api.bestie(); if (B && B.present()) B.mood(-15, `You're ditching me?! …Fine. Have fun. 😒`);
    if (T.crew.includes(id)) leaveCrew(id); disband(`The crew scattered when you left. "Get it!!" — the group chat`);
    G.closeUI(); G.parkCar(); G.transition(() => { G.enterArea('room', 0, 6.5, 0); const ch = chars[id]; ch.visible = true; ch.position.set(1.2, 0, 5.4); ch.rotation.y = Math.PI;
      api.dlg({ title: '🌙 Suite 2407', cls: 'blackCard', html: `<p>${R(NIGHT_TEXT)}</p>`, buttons: [['☀️ Morning…', () => { const h = api.hour(), toNine = h < 9.5 ? 9.5 - h : 33.5 - h;
        api.sleepAway(toNine, () => { ch.visible = false; s.nights++; T.nights++; T.nightLog = [...(T.nightLog || []), id]; s.c = Math.min(100, s.c + 10); T.m.vibe = Math.min(100, T.m.vibe + 15); T.m.energy = Math.max(T.m.energy, 80); api.addFun(500, null, true); s.gone = 0;
          setTimeout(() => api.dlg({ title: `☀️ The morning after`, html: `<p>${L.morning}</p><p class="fine">+500 Fun · Connection ${Math.round(s.c)}%${s.nights >= 2 ? ' · this is becoming a thing 💘' : ''}</p>`, buttons: [['Good morning, Vegas', null, 'gold']] }), 700); }); }, 'gold']] }); }); }

  // the hub's "people" section
  function hubHtml() { const met = Object.keys(LOCALS).filter(id => S(id).met); if (!met.length) return '<p class="fine">You haven\'t met anyone yet. Look for name tags around the resort and the Strip (they keep their own schedules).</p>';
    return '<ul class="hubList">' + met.map(id => { const L = LOCALS[id], s = S(id), p = period(); return `<li>${L.icon} <b>${L.n}</b> · ${L.role} · ❤️ ${Math.round(s.c)}%${T.crew.includes(id) ? ' · 🤝 in your crew' : ''}${s.nights ? ` · 🌙 ×${s.nights}` : ''}<br><small>${p === 'off' ? 'Asleep till 10 AM' : T.crew.includes(id) ? 'With you' : 'Now: ' + LOCALS[id].where[p]}</small></li>`; }).join('') + '</ul>'; }
  function save() { return G.save; }
  function dispose() { for (const id of Object.keys(LOCALS)) { const ch = chars[id]; ch.removeFromParent(); const i = G.CHAR.list.indexOf(ch); if (i >= 0) G.CHAR.list.splice(i, 1); tags[id].remove(); } }
  const loveStory = () => { const c = {}; for (const id of T.nightLog || []) c[id] = (c[id] || 0) + 1; const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; return best && best[1] >= 2 && S(best[0]).c >= 90 ? LOCALS[best[0]].n : null; };
  return { update, tick, near, chat, joinCrew, leaveCrew, disband, askSuite, hubHtml, dispose, canRomance, loveStory, place, get crew() { return T.crew; }, chars, S };
}
