// Casino table games (v6.2): Lion's Den Blackjack and Royal Roulette. Play coins only; nothing can be bought or cashed out.
// Blackjack: 6-deck shoe, dealer stands on all 17s, blackjack pays 3:2, double on the first two cards, pushes return the bet.
// Roulette: single zero; red/black, odd/even, 1-18/19-36 pay 1:1, dozens 2:1, a single number 35:1.
const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); e.innerHTML = html; return e; };

export function initCasino(C) { // C: { save, setCoins, showUI, closeUI, toast, chime, onSpin }
  // ---------------- markup ----------------
  const bj = el('div', { id: 'blackjack', class: 'overlay hidden' }, `<div class="card small casinoCard">
    <h2>Lion's Den Blackjack</h2>
    <div class="bjRow"><span>Dealer</span><div id="bjDealer" class="bjCards"></div><b id="bjDv"></b></div>
    <div class="bjRow"><span>You</span><div id="bjPlayer" class="bjCards"></div><b id="bjPv"></b></div>
    <div id="bjMsg" class="tblMsg">Pick a bet and deal.</div>
    <div class="row tbets" id="bjBets"></div>
    <div class="row"><button id="bjDeal" class="gold">DEAL</button><button id="bjHit">Hit</button><button id="bjStand">Stand</button><button id="bjDouble">Double</button></div>
    <p class="fine">Blackjack pays 3:2 · dealer stands on all 17s · play coins only, no cash value</p>
    <button class="ghost" id="bjLeave">Leave table</button></div>`);
  const rl = el('div', { id: 'roulette', class: 'overlay hidden' }, `<div class="card small casinoCard">
    <h2>Royal Roulette</h2>
    <div class="rlTop"><div id="rlBall" class="rlBall">–</div><div id="rlHist" class="rlHist"></div></div>
    <div id="rlMsg" class="tblMsg">Choose a bet, a chip and spin.</div>
    <div class="rlGrid" id="rlTypes"></div>
    <div class="row rlNum"><label>Number <input id="rlNumber" type="number" min="0" max="36" value="17"></label></div>
    <div class="row tbets" id="rlBets"></div>
    <button id="rlSpin" class="gold">SPIN</button>
    <p class="fine">Single zero · red/black, odd/even, low/high 1:1 · dozens 2:1 · a number 35:1 · play coins only</p>
    <button class="ghost" id="rlLeave">Leave table</button></div>`);
  document.body.append(bj, rl);
  const $ = id => document.getElementById(id);
  $('bjLeave').onclick = $('rlLeave').onclick = () => C.closeUI();
  const chips = (box, vals, onPick, start) => { box.innerHTML = ''; for (const v of vals) { const b = el('button', { class: 'tbet' + (v === start ? ' on' : '') }, String(v)); b.onclick = () => { box.querySelectorAll('.tbet').forEach(x => x.classList.remove('on')); b.classList.add('on'); onPick(v); }; box.appendChild(b); } };

  // ---------------- blackjack ----------------
  let shoe = [], bjBet = 10, hand = null;
  const newShoe = () => { shoe = []; for (let d = 0; d < 6; d++) for (const s of SUITS) for (const r of RANKS) shoe.push({ r, s }); for (let i = shoe.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; } };
  const draw = () => { if (shoe.length < 60) newShoe(); return shoe.pop(); };
  const val = cards => { let t = 0, aces = 0; for (const c of cards) { if (c.r === 'A') { aces++; t += 11; } else t += ['J', 'Q', 'K'].includes(c.r) ? 10 : +c.r; } while (t > 21 && aces) { t -= 10; aces--; } return t; };
  const cardHTML = (c, hidden) => hidden ? '<i class="pc back"></i>' : `<i class="pc${c.s === '♥' || c.s === '♦' ? ' red' : ''}">${c.r}<small>${c.s}</small></i>`;
  function renderBJ(reveal) {
    if (!hand) { $('bjDealer').innerHTML = $('bjPlayer').innerHTML = ''; $('bjDv').textContent = $('bjPv').textContent = ''; }
    else { $('bjDealer').innerHTML = hand.d.map((c, i) => cardHTML(c, i === 1 && !reveal)).join(''); $('bjPlayer').innerHTML = hand.p.map(c => cardHTML(c)).join('');
      $('bjDv').textContent = reveal ? val(hand.d) : val([hand.d[0]]); $('bjPv').textContent = val(hand.p); }
    const live = hand && !hand.done; $('bjDeal').disabled = !!live; $('bjHit').disabled = $('bjStand').disabled = !live; $('bjDouble').disabled = !live || hand.p.length !== 2 || C.save.coins < hand.bet;
    $('bjBets').querySelectorAll('button').forEach(b => b.disabled = !!live);
  }
  function settle(msg, ret) { hand.done = true; if (ret) C.setCoins(C.save.coins + ret); $('bjMsg').textContent = msg + ` · Balance ${C.save.coins.toLocaleString()}`; renderBJ(true); C.chime(ret > hand.bet * 2 ? 'big' : ret > hand.bet ? 'win' : 'spin'); }
  function dealerPlay() { while (val(hand.d) < 17) hand.d.push(draw()); const p = val(hand.p), d = val(hand.d);
    if (d > 21) settle(`Dealer busts with ${d}. You win ${hand.bet}!`, hand.bet * 2); else if (p > d) settle(`${p} beats ${d}. You win ${hand.bet}!`, hand.bet * 2); else if (p === d) settle(`Push at ${p}. Bet returned.`, hand.bet); else settle(`Dealer has ${d}. You lose ${hand.bet}.`, 0); }
  $('bjDeal').onclick = () => { if (hand && !hand.done) return; if (C.save.coins < bjBet) { $('bjMsg').textContent = 'Not enough coins: try the Coin Cage daily bonus.'; return; }
    C.setCoins(C.save.coins - bjBet); hand = { bet: bjBet, p: [draw(), draw()], d: [draw(), draw()], done: false }; C.chime('spin');
    const pb = val(hand.p) === 21, db = val(hand.d) === 21;
    if (pb || db) { if (pb && db) settle('Both have blackjack. Push.', hand.bet); else if (pb) settle(`BLACKJACK! You win ${Math.round(hand.bet * 1.5)}.`, Math.round(hand.bet * 2.5)); else settle('Dealer blackjack. You lose.', 0); return; }
    $('bjMsg').textContent = 'Hit, stand or double?'; renderBJ(false); };
  $('bjHit').onclick = () => { if (!hand || hand.done) return; hand.p.push(draw()); C.chime('spin'); const v = val(hand.p); if (v > 21) settle(`Bust with ${v}. You lose ${hand.bet}.`, 0); else if (v === 21) dealerPlay(); else renderBJ(false); };
  $('bjStand').onclick = () => { if (!hand || hand.done) return; dealerPlay(); };
  $('bjDouble').onclick = () => { if (!hand || hand.done || hand.p.length !== 2 || C.save.coins < hand.bet) return; C.setCoins(C.save.coins - hand.bet); hand.bet *= 2; hand.p.push(draw());
    const v = val(hand.p); if (v > 21) settle(`Bust with ${v} after doubling. You lose ${hand.bet}.`, 0); else dealerPlay(); };
  chips($('bjBets'), [10, 50, 100, 250], v => bjBet = v, 10);

  // ---------------- roulette ----------------
  const TYPES = [['red', 'Red', 2], ['black', 'Black', 2], ['odd', 'Odd', 2], ['even', 'Even', 2], ['low', '1–18', 2], ['high', '19–36', 2], ['d1', '1st 12', 3], ['d2', '2nd 12', 3], ['d3', '3rd 12', 3], ['num', 'Number', 36]];
  let rlType = 'red', rlBet = 10, rlBusy = false; const hist = [];
  const tbox = $('rlTypes'); for (const [k, n] of TYPES) { const b = el('button', { class: 'rlT' + (k === rlType ? ' on' : ''), 'data-k': k }, n); b.onclick = () => { if (rlBusy) return; rlType = k; tbox.querySelectorAll('.rlT').forEach(x => x.classList.toggle('on', x === b)); $('rlNumber').closest('.rlNum').style.opacity = k === 'num' ? 1 : 0.45; }; tbox.appendChild(b); }
  $('rlNumber').closest('.rlNum').style.opacity = 0.45;
  chips($('rlBets'), [10, 50, 100, 250], v => rlBet = v, 10);
  const colorOf = n => n === 0 ? 'green' : REDS.has(n) ? 'red' : 'black';
  const wins = (k, n, pick) => { if (k === 'num') return n === pick; if (n === 0) return false; return k === 'red' ? REDS.has(n) : k === 'black' ? !REDS.has(n) : k === 'odd' ? n % 2 === 1 : k === 'even' ? n % 2 === 0 : k === 'low' ? n <= 18 : k === 'high' ? n >= 19 : k === 'd1' ? n <= 12 : k === 'd2' ? n > 12 && n <= 24 : n > 24; };
  $('rlSpin').onclick = () => { if (rlBusy) return; const pick = Math.max(0, Math.min(36, Math.round(+$('rlNumber').value || 0)));
    if (C.save.coins < rlBet) { $('rlMsg').textContent = 'Not enough coins: try the Coin Cage daily bonus.'; return; }
    C.setCoins(C.save.coins - rlBet); rlBusy = true; $('rlSpin').disabled = true; C.onSpin && C.onSpin(true);
    const n = Math.floor(Math.random() * 37), ball = $('rlBall'); let k = 0; const label = TYPES.find(x => x[0] === rlType)[1] + (rlType === 'num' ? ' ' + pick : '');
    $('rlMsg').textContent = `${rlBet} on ${label}… no more bets.`;
    const tick = () => { const r = Math.floor(Math.random() * 37); ball.textContent = r; ball.className = 'rlBall ' + colorOf(r); if (++k < 24) { C.chime('spin'); setTimeout(tick, 60 + k * 9); } else finish(); };
    const finish = () => { ball.textContent = n; ball.className = 'rlBall ' + colorOf(n) + ' land'; hist.unshift(n); hist.length = Math.min(hist.length, 10);
      $('rlHist').innerHTML = hist.map(h => `<i class="${colorOf(h)}">${h}</i>`).join('');
      const pay = TYPES.find(x => x[0] === rlType)[2], won = wins(rlType, n, pick);
      if (won) { C.setCoins(C.save.coins + rlBet * pay); C.chime(pay > 3 ? 'big' : 'win'); }
      $('rlMsg').textContent = `${n} ${colorOf(n)}. ` + (won ? `You win ${rlBet * (pay - 1)}!` : `No win on ${label}.`) + ` · Balance ${C.save.coins.toLocaleString()}`;
      rlBusy = false; $('rlSpin').disabled = false; C.onSpin && C.onSpin(false); };
    tick(); };

  return {
    openBlackjack() { C.showUI('blackjack'); if (!hand || hand.done) $('bjMsg').textContent = `Pick a bet and deal. Balance ${C.save.coins.toLocaleString()}.`; renderBJ(hand && hand.done); },
    openRoulette() { C.showUI('roulette'); if (!rlBusy) $('rlMsg').textContent = `Choose a bet, a chip and spin. Balance ${C.save.coins.toLocaleString()}.`; },
  };
}
