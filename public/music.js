// TILEO KINGDOM music (v7.1): every venue plays a rotating playlist instead of looping one song,
// the convertible / limo / suite speaker have radio stations you can change, and DJ Tileo takes requests.
// One <audio> per playlist ("deck"), so going back to a place picks up where its playlist was. Songs are levelled
// with a per-song gain (measured loudness, EBU R128) instead of being re-encoded.

// t: title · a: artist (from the files' tags) · lufs: measured integrated loudness
export const SONGS = {
  vegas: { t: 'Las Vegas We Here', a: 'DJ Tileo', f: 'lobby.mp3', lufs: -13.7 },
  liveitup: { t: 'Live It Up', a: 'DJ Tileo', f: 'club.mp3', lufs: -14.9 },
  wide: { t: 'Vegas Right (Wide St, Instrumental)', a: 'DJ Tileo', f: 'pool.mp3', lufs: -15.8 },
  gogo: { t: 'Go Go Hard', a: 'blithesixteenthnote490', f: 'go-go-hard.mp3', lufs: -13.8 },
  jackpot: { t: 'Jackpot x The Jackpot (Quick Mix)', a: 'DJ Tileo', f: 'jackpot-mashup.mp3', lufs: -13.5 },
  lastnite: { t: 'Last Nite (Synthwave)', a: 'DJ Tileo', f: 'last-nite-synthwave.mp3', lufs: -13.5 },
  moment: { t: 'Live in the Moment', a: 'blithesixteenthnote490', f: 'live-in-the-moment.mp3', lufs: -14.3 },
  panoramic: { t: 'Panoramic', a: 'DJ Tileo', f: 'panoramic.mp3', lufs: -12.7 },
  paradise: { t: 'Paradise and Freedom', a: 'DJ Tileo', f: 'paradise-and-freedom.mp3', lufs: -13.3 },
  dice: { t: 'Roll the Dice', a: 'DJ Tileo', f: 'roll-the-dice.mp3', lufs: -14.9 },
  runitback: { t: 'Run It Back (Afrobeat)', a: 'DJ Tileo', f: 'run-it-back.mp3', lufs: -13.8 },
  single: { t: 'Single Season', a: 'DJ Tileo', f: 'single-season.mp3', lufs: -13.1 },
};
// venue playlists (the first song plays first; the rest shuffle)
export const LISTS = {
  lobby: ['vegas', 'dice', 'jackpot', 'single', 'moment'],
  pool: ['wide', 'runitback', 'moment', 'single', 'paradise'],
  club: ['liveitup', 'gogo', 'jackpot', 'paradise', 'runitback', 'dice', 'single'],
  suite: ['panoramic', 'lastnite', 'moment', 'vegas', 'single', 'wide'],
  needle: ['panoramic', 'lastnite', 'vegas', 'moment'],
  airport: ['vegas', 'moment', 'panoramic', 'single', 'wide'],
};
// radio stations: convertible, limo and the suite speaker
export const STATIONS = [
  { id: 'hits', n: 'Kingdom Hits FM', icon: '📻', list: Object.keys(SONGS) },
  { id: 'party', n: 'Party 129', icon: '🔥', list: ['gogo', 'jackpot', 'liveitup', 'paradise', 'runitback', 'dice'] },
  { id: 'night', n: 'Night Drive', icon: '🌆', list: ['lastnite', 'panoramic', 'vegas', 'moment'] },
  { id: 'pool', n: 'Poolside', icon: '🌴', list: ['wide', 'runitback', 'single', 'moment', 'paradise'] },
  { id: 'off', n: 'Radio off', icon: '🔇', list: [] },
];
export const station = id => STATIONS.find(s => s.id === id) || STATIONS[0];
const TARGET = -14.5;
const gain = id => Math.min(1.25, Math.pow(10, (TARGET - SONGS[id].lufs) / 20));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
export function listFor(key) { if (!key) return []; if (key.startsWith('radio:')) return station(key.slice(6)).list; return LISTS[key] || LISTS.lobby; }

export function createMusic({ base = 'assets/audio/', onNow } = {}) {
  const decks = {}; let cur = null, vol = 0;
  function deck(key) { if (decks[key]) return decks[key]; const ids = listFor(key); if (!ids.length) return null;
    const radio = key.startsWith('radio:'), order = radio ? shuffle(ids.slice()) : [ids[0], ...shuffle(ids.slice(1))];
    const el = new Audio(); el.preload = 'auto'; const d = decks[key] = { key, el, order, i: 0, song: null };
    el.addEventListener('ended', () => advance(d)); el.addEventListener('error', () => { if (d === cur) setTimeout(() => advance(d), 400); }); load(d); return d; }
  function load(d) { d.song = d.order[d.i % d.order.length]; d.el.src = base + SONGS[d.song].f; }
  function advance(d, why = 'next') { const last = d.song; d.i++; if (d.i >= d.order.length) { d.i = 0; shuffle(d.order); if (d.order[0] === last && d.order.length > 1) d.order.push(d.order.shift()); }
    load(d); if (d === cur) { apply(); d.el.play().catch(() => {}); if (onNow) onNow(d, why); } }
  function apply() { if (cur && cur.song) cur.el.volume = Math.max(0, Math.min(1, vol * gain(cur.song))); }
  function play(key, v) { vol = v; const d = key ? deck(key) : null;
    for (const o of Object.values(decks)) if (o !== d && !o.el.paused) o.el.pause();
    if (!d) { cur = null; return; } const changed = cur !== d; cur = d; apply(); if (d.el.paused) d.el.play().catch(() => {}); if (changed && onNow) onNow(d, 'switch'); }
  function next() { if (cur) advance(cur); }
  // put a song on now (DJ requests, picking from the list)
  function request(key, id) { const d = deck(key); if (!d) return; const j = d.order.indexOf(id); if (j >= 0) { d.order.splice(j, 1); if (j <= d.i) d.i--; }
    d.order.splice(d.i + 1, 0, id); advance(d, 'request'); }
  return { play, next, request, deck, get current() { return cur ? { key: cur.key, id: cur.song, ...SONGS[cur.song], time: cur.el.currentTime, dur: cur.el.duration } : null }, decks };
}
