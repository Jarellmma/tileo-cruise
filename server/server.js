'use strict';
/*
 * TILEO KINGDOM multiplayer relay + accounts.
 *
 * Players connect over a WebSocket and join a room: a public "Strip" (auto-filled, a new one opens when it is full)
 * or a private party (invite code). They send their presence (name, look, area, position, animation, car) about
 * ten times a second; the server keeps each player's latest presence, hands newcomers a snapshot and forwards
 * updates to everyone else in the room. Chat lines are relayed as they come: on a public Strip only the preset
 * phrases are allowed (enforced here), private parties can type freely. Nothing about the Strip is stored.
 * Accounts (shared with TILEO Cruise Lines: same users and sessions tables) live in ./accounts.js.
 */
const http = require('http');
const { WebSocketServer } = require('./vendor/ws');
const { createAccounts } = require('./accounts');
const accounts = createAccounts();
const { createTrips } = require('./trips');
const trips = createTrips(); // v7.2: Vegas Trip leaderboards

const PORT = Number(process.env.PORT) || 10000;
const ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
const STRIP_MAX = Number(process.env.STRIP_MAX) || 24;   // players per public Strip before a new one opens
const PARTY_MAX = Number(process.env.PARTY_MAX) || 24;   // players per private party
const MAX_PRESENCE = 3072;                               // bytes of JSON per presence update
const MSG_PER_SEC = 20;                                  // per-connection message budget
// keep in sync with QUICK_SAYS in net.js
const QUICK_SAYS = new Set(['Hi!', 'Follow me!', 'Meet me at the pool', 'Club tonight?', 'Nice outfit!', 'Race you down the Strip', 'Lucky streak!', 'Want a limo ride?', 'Good game!', 'Bye!']);
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, n);

const rooms = new Map(); // name -> Map(id -> client)
let nextId = 1, totalJoins = 0;
const newId = () => 'k' + (nextId++).toString(36) + Math.random().toString(36).slice(2, 6);

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
  c.room = null; c.strip = 0; c.pres = null;
}
function pickStrip() {
  for (let d = 1; d < 1000; d++) { const r = rooms.get('strip-' + d); if (!r || r.size < STRIP_MAX) return d; }
  return 1;
}
function joinRoom(c, party) {
  leaveRoom(c);
  let name, strip = 0;
  if (party) {
    name = 'party-' + party;
    if (roomOf(name).size >= PARTY_MAX) { send(c, { t: 'full', party }); name = null; }
  }
  if (!name) { strip = pickStrip(); name = 'strip-' + strip; party = ''; }
  const r = roomOf(name);
  c.room = name; c.strip = strip; c.party = party || '';
  const peers = [];
  for (const [id, o] of r) if (o.pres) peers.push({ id, d: o.pres });
  r.set(c.id, c);
  totalJoins++;
  send(c, { t: 'welcome', id: c.id, party: c.party, strip, peers });
  console.log(`join ${c.id} -> ${name} (${r.size} here, ${countPlayers()} online)`);
}
function countPlayers() { let n = 0; for (const r of rooms.values()) n += r.size; return n; }

const server = http.createServer((req, res) => {
  if (trips(req, res)) return;
  if (accounts(req, res)) return;
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'tileo-kingdom-multiplayer', online: countPlayers(), rooms: rooms.size, joins: totalJoins }));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
});

const wss = new WebSocketServer({
  server, path: '/ws', maxPayload: 8 * 1024, perMessageDeflate: false,
  verifyClient: info => ORIGINS.includes('*') || ORIGINS.includes(info.origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(info.origin || '')
});

wss.on('connection', ws => {
  const c = { id: newId(), ws, room: null, strip: 0, party: '', pres: null, budget: MSG_PER_SEC, last: Date.now(), sayT: 0 };
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
      const party = typeof m.party === 'string' && /^[a-z0-9]{4,12}$/.test(m.party) ? m.party : '';
      joinRoom(c, party);
    } else if (m.t === 'p' && c.room) {
      if (buf.length > MAX_PRESENCE + 64) return;
      const d = m.d; if (!d || typeof d !== 'object' || Array.isArray(d)) return;
      c.pres = d;
      broadcast(c.room, { t: 'p', id: c.id, d }, c.id);
    } else if (m.t === 'say' && c.room) {
      const x = clean(m.x, 80); if (!x || now - c.sayT < 1200) return;
      if (!c.party && !QUICK_SAYS.has(x)) return; // strangers on a public Strip: preset phrases only
      c.sayT = now;
      broadcast(c.room, { t: 'say', id: c.id, x, at: now }, c.id);
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

server.listen(PORT, '0.0.0.0', () => console.log(`TILEO KINGDOM multiplayer listening on ${PORT} (origins: ${ORIGINS.join(', ')})`));
