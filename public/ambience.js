// Ambient sound (v6.2), synthesised live with Web Audio (no sound files): Strip traffic rumble, cars passing close by,
// distant horns, crowd murmur, casino slot chimes and the odd jackpot jingle, pool water and splashes, wind on the
// rooftop and the Sky Needle deck, and a muffled crowd under the club music. It follows the area, the time of day and
// the mute button, and starts only after the player's first tap (browsers block sound before that).
const rnd = (a, b) => a + Math.random() * (b - a);
export function createAmbience() {
  let ac = null, master = null, L = null, noise = null, t = 0, nextHorn = 6, nextChime = 2, nextSplash = 3, nextBabble = 0, muted = false;
  const vol = { amb: 0.45, fx: 0.7 }; // City & crowd / Effects volume (Settings → Sound)
  function init() {
    if (ac) return true; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ac = new AC(); } catch (e) { return false; }
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    // 4 s of white noise shared by every noise layer
    noise = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = () => { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.loopStart = Math.random() * 3; s.start(0, Math.random() * 4); return s; };
    const chain = (...nodes) => { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; };
    const bq = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    const gain = v => { const g = ac.createGain(); g.gain.value = v; return g; };
    L = {}; L.bus = gain(vol.amb); L.bus.connect(master); // every ambient layer goes through this bus
    // city rumble: deep filtered noise
    L.city = gain(0); chain(src(), bq('lowpass', 260), bq('lowpass', 420), L.city, master);
    L.cityLP = bq('lowpass', 20000); L.city.disconnect(); L.city.connect(L.cityLP); L.cityLP.connect(L.bus);
    // nearby traffic: brighter band, swells as cars pass
    L.near = gain(0); chain(src(), bq('bandpass', 700, 0.6), L.near, L.cityLP);
    // wind: band-passed noise with a slowly drifting centre
    L.windF = bq('bandpass', 500, 0.8); L.wind = gain(0); chain(src(), L.windF, L.wind, L.bus);
    // water lapping
    L.water = gain(0); chain(src(), bq('lowpass', 900), bq('highpass', 120), L.water, L.bus);
    // crowd murmur: three "voices" (formant bands) whose levels flicker at speech rate
    L.crowd = gain(0); L.crowd.connect(L.bus); L.voices = [380, 820, 1650].map((f, i) => { const g = gain(0); chain(src(), bq('bandpass', f, 3.5 - i), g, L.crowd); return g; });
    // effects bus (horns, chimes, splashes)
    L.fx = gain(vol.fx); L.fx.connect(master);
    return true;
  }
  const set = (p, v, tc = 0.4) => { if (p) p.setTargetAtTime(v, ac.currentTime, tc); };
  function horn(vol) { const t0 = ac.currentTime, g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; g.connect(lp); lp.connect(L.fx);
    const dur = rnd(0.18, 0.5), f = rnd(330, 440);
    for (const k of [1, 1.26]) { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f * k; o.connect(g); o.start(t0); o.stop(t0 + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.setValueAtTime(vol, t0 + dur); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
    if (Math.random() < 0.35) setTimeout(() => ac && horn(vol * 0.9), (dur + 0.12) * 1000); }
  const PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2, 9 / 4, 5 / 2];
  function bells(vol, n = 3, base = 880, gap = 0.09) { const t0 = ac.currentTime;
    for (let i = 0; i < n; i++) { const o = ac.createOscillator(), g = ac.createGain(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = base * PENTA[Math.floor(Math.random() * PENTA.length)];
      const st = t0 + i * gap; g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(vol, st + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.5); o.connect(g); g.connect(L.fx); o.start(st); o.stop(st + 0.55); } }
  function splash(vol) { const s = ac.createBufferSource(); s.buffer = noise; const hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = rnd(900, 2200); hp.Q.value = 0.8; const g = ac.createGain(); const t0 = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + rnd(0.4, 0.9)); s.connect(hp); hp.connect(g); g.connect(L.fx); s.start(t0, Math.random() * 3); s.stop(t0 + 1); }
  // c: { area, outdoor, tod, pos: {x,z}, traffic: [{x,z}], limo, driving, inCasino, crowdK }
  function update(dt, c) {
    if (!ac) return; t += dt; const A = c.area;
    const strip = A === 'strip', pool = A === 'pool', needle = A === 'needle', club = A === 'club', lobby = A === 'lobby', rooms = A === 'rooms' || A === 'room';
    // traffic proximity
    let near = 0; if ((strip || needle) && c.traffic && !needle) for (const k of c.traffic) { const d2 = (k.x - c.pos.x) ** 2 + (k.z - c.pos.z) ** 2; near += 1 / (1 + d2 / 60); }
    const night = c.tod === 'night';
    set(L.city.gain, strip ? 0.22 : pool ? 0.07 : needle ? 0.05 : rooms ? 0.015 : 0);
    set(L.near.gain, strip ? Math.min(0.5, near * 0.35) : 0, 0.15);
    set(L.cityLP.frequency, c.limo || c.driving ? 900 : rooms ? 500 : 20000, 0.3);
    set(L.wind.gain, needle ? 0.16 : pool ? 0.05 : strip ? 0.02 : 0); L.windF.frequency.setTargetAtTime(400 + 250 * Math.sin(t * 0.21) + 120 * Math.sin(t * 0.53), ac.currentTime, 0.8);
    set(L.water.gain, pool ? 0.06 + 0.03 * Math.sin(t * 0.9) : 0, 0.3);
    const crowd = club ? 0.14 : lobby ? (c.inCasino ? 0.12 : 0.09) : pool ? 0.07 : strip ? (night ? 0.035 : 0.025) : 0;
    set(L.crowd.gain, crowd * (c.crowdK ?? 1), 0.6);
    if (crowd > 0 && t > nextBabble) { nextBabble = t + rnd(0.09, 0.22); for (const v of L.voices) set(v.gain, Math.random() < 0.35 ? 0 : rnd(0.3, 1), 0.05); }
    if (strip && t > nextHorn) { nextHorn = t + rnd(7, 22); horn(rnd(0.012, 0.035) * (c.limo ? 0.5 : 1)); }
    if (lobby && t > nextChime) { const k = c.inCasino ? 1 : 0.35; nextChime = t + rnd(0.8, 2.6) / k; if (Math.random() < 0.06) bells(0.05 * k, 9, 1046, 0.07); else bells(rnd(0.012, 0.03) * k, Math.floor(rnd(2, 5)), Math.random() < 0.5 ? 880 : 1175, rnd(0.06, 0.12)); }
    if (pool && t > nextSplash) { nextSplash = t + rnd(2.5, 7); splash(rnd(0.03, 0.08)); }
  }
  return {
    // call from a user gesture (or right after one): creates/resumes the audio context
    resume() { if (!init()) return; if (ac.state === 'suspended') ac.resume().catch(() => {}); master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.5); },
    setMuted(m) { muted = !!m; if (ac) master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.2); },
    setVolumes(v) { if (typeof v.amb === 'number') vol.amb = v.amb; if (typeof v.fx === 'number') vol.fx = v.fx; if (L) { set(L.bus.gain, vol.amb, 0.1); set(L.fx.gain, vol.fx, 0.1); } },
    bump(k = 1) { if (!ac || muted) return; const s = ac.createBufferSource(); s.buffer = noise; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; const g = ac.createGain(), t0 = ac.currentTime;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.5 * Math.min(1, k), t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35); s.connect(lp); lp.connect(g); g.connect(L.fx); s.start(t0, Math.random() * 3); s.stop(t0 + 0.4); },
    honk(d = 1) { if (!ac || muted || !L) return; horn(0.035 * Math.max(0.15, Math.min(1, d))); },
    update,
    // one-shot effects for the casino UI
    chime(kind = 'spin') { if (!ac || muted) return; if (kind === 'win') bells(0.07, 10, 1046, 0.06); else if (kind === 'big') bells(0.09, 18, 880, 0.05); else bells(0.02, 2, 1318, 0.05); },
  };
}
