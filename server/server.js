'use strict';
/*
 * TILEO Cruise Lines multiplayer relay.
 *
 * Players connect over a WebSocket, join a room (an auto-filled public deck or a private ship),
 * and send their "presence" (name, outfit, position, animation, speech bubble...). The server keeps
 * each player's latest presence, hands newcomers a snapshot, and forwards updates to everyone else
 * in the room. Nothing about the ship is stored; a restart simply empties it.
 * Accounts (sign-in and saved passengers) live in ./accounts.js and use Postgres when DATABASE_URL is set.
 */
const http = require('http');
const { WebSocketServer } = require('./vendor/ws');
const { createAccounts } = require('./accounts');
const accounts = createAccounts();

const PORT = Number(process.env.PORT) || 10000;
const ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
const DECK_MAX = Number(process.env.DECK_MAX) || 16;   // players per public deck before a new deck opens
const SHIP_MAX = Number(process.env.SHIP_MAX) || 24;   // players per private ship
const MAX_PRESENCE = 4096;                             // bytes of JSON per presence update
const MSG_PER_SEC = 20;                                // per-connection message budget
// on public decks (strangers) speech bubbles are limited to these friendly presets; private ships allow free text
const QUICK_SAYS = new Set(['Hi!', 'Follow me!', 'Meet at the pool', 'Dance party in the dome!', 'Race you down the slides', 'Nice outfit!', 'Want to visit my suite?', 'See you ashore!', 'Good game!', 'Bye!']);

const rooms = new Map(); // name -> Map(id -> client)
let nextId = 1, totalJoins = 0;
const newId = () => 'p' + (nextId++).toString(36) + Math.random().toString(36).slice(2, 6);

function roomOf(name) { let r = rooms.get(name); if (!r) rooms.set(name, r = new Map()); return r; }
function send(c, msg) { if (c.ws.readyState === 1) c.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); }
function broadcast(roomName, msg, exceptId) {
  const r = rooms.get(roomName); if (!r) return;
  const data = JSON.stringify(msg);
  for (const [id, c] of r) if (id !== exceptId) send(c, data);
}
function leaveRoom(c) {
  if (!c.room) return;
  const r = rooms.get(c.room);
  if (r) { r.delete(c.id); if (!r.size) rooms.delete(c.room); }
  broadcast(c.room, { t: 'leave', id: c.id });
  c.room = null; c.deck = 0; c.pres = null;
}
function pickDeck() {
  for (let d = 1; d < 1000; d++) { const r = rooms.get('deck-' + d); if (!r || r.size < DECK_MAX) return d; }
  return 1;
}
function joinRoom(c, ship) {
  leaveRoom(c);
  let name, deck = 0;
  if (ship) {
    name = 'ship-' + ship;
    if (roomOf(name).size >= SHIP_MAX) { send(c, { t: 'full', ship }); name = null; }
  }
  if (!name) { deck = pickDeck(); name = 'deck-' + deck; ship = ''; }
  const r = roomOf(name);
  c.room = name; c.deck = deck; c.ship = ship || '';
  const peers = [];
  for (const [id, o] of r) if (o.pres) peers.push({ id, d: o.pres });
  r.set(c.id, c);
  totalJoins++;
  send(c, { t: 'welcome', id: c.id, ship: c.ship, deck, peers });
  console.log(`join ${c.id} -> ${name} (${r.size} aboard, ${countPlayers()} online)`);
}
function countPlayers() { let n = 0; for (const r of rooms.values()) n += r.size; return n; }

function cleanPresence(c, d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  if (!c.ship && d.say && typeof d.say === 'object' && !QUICK_SAYS.has(String(d.say.x || ''))) delete d.say;
  return d;
}

const server = http.createServer((req, res) => {
  if (accounts(req, res)) return;
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'tileo-multiplayer', online: countPlayers(), rooms: rooms.size, joins: totalJoins }));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
});

const wss = new WebSocketServer({
  server, path: '/ws', maxPayload: 16 * 1024, perMessageDeflate: false,
  verifyClient: info => ORIGINS.includes('*') || ORIGINS.includes(info.origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(info.origin || '')
});

wss.on('connection', ws => {
  const c = { id: newId(), ws, room: null, deck: 0, ship: '', pres: null, budget: MSG_PER_SEC, last: Date.now() };
  ws.isDead = false;
  ws.on('pong', () => { ws.isDead = false; });
  ws.on('message', (buf, isBinary) => {
    const now = Date.now();
    c.budget = Math.min(MSG_PER_SEC, c.budget + (now - c.last) / 1000 * MSG_PER_SEC); c.last = now;
    if (c.budget < 1) return; c.budget -= 1;
    if (isBinary) return;
    let m; try { m = JSON.parse(buf.toString('utf8')); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (m.t === 'join') {
      const ship = typeof m.ship === 'string' && /^[a-z0-9]{4,12}$/.test(m.ship) ? m.ship : '';
      joinRoom(c, ship);
    } else if (m.t === 'p' && c.room) {
      if (buf.length > MAX_PRESENCE + 64) return;
      const d = cleanPresence(c, m.d); if (!d) return;
      c.pres = d;
      broadcast(c.room, { t: 'p', id: c.id, d }, c.id);
    } else if (m.t === 'ping') {
      send(c, { t: 'pong', now });
    }
  });
  ws.on('close', () => { if (c.room) console.log(`leave ${c.id} <- ${c.room}`); leaveRoom(c); });
  ws.on('error', () => { });
});

// drop connections that stopped answering (closed laptops, lost signal)
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isDead) { ws.terminate(); continue; }
    ws.isDead = true; ws.ping();
  }
}, 25000);

server.listen(PORT, '0.0.0.0', () => console.log(`TILEO multiplayer relay listening on ${PORT} (origins: ${ORIGINS.join(', ')})`));
