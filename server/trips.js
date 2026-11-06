'use strict';
/*
 * Epic or Fail: Vegas Trip leaderboards.
 *   POST /trip/score  { name, score, rank, kind, back, party, buddy, fun, cash, wishes }  (one per finished trip)
 *   GET  /trip/top?party=code  ->  { top: [...], week: [...], party: [...], stored: 'postgres' | 'memory' }
 * Uses the accounts Postgres (DATABASE_URL) when it is set, otherwise keeps scores in memory (lost when the server restarts).
 * Play money only; scores are just for bragging, so validation is light (bounds, known ranks and trip kinds, rate limit).
 */
const RANKS = new Set(['S', 'L', 'A+', 'A', 'B', 'C', 'F']), KINDS = new Set(['solo', 'bday', 'bach']), BACKS = new Set(['divorcee', 'dj', 'influencer', 'party']);
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f<>]/g, '').trim().slice(0, n);
const int = (v, a, b) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a; };

function createTrips(env = process.env) {
  const origins = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
  const allowOrigin = o => o && (origins.includes('*') || origins.includes(o) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));
  let pool = null, ready = false; const mem = [];
  if (env.DATABASE_URL) {
    const { Pool } = require('./vendor/pg'); const url = env.DATABASE_URL;
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || /sslmode=disable/.test(url), internal = !/\.render\.com/.test(url.split('@')[1] || '');
    const ssl = env.DATABASE_SSL ? env.DATABASE_SSL !== 'off' : !(local || internal);
    pool = new Pool({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), max: 3, idleTimeoutMillis: 30000, ssl: ssl ? { rejectUnauthorized: false } : false });
    pool.on('error', e => console.error('trips db', e.message));
    pool.query(`CREATE TABLE IF NOT EXISTS tileo_trip_scores (id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, score INT NOT NULL, rank TEXT NOT NULL, kind TEXT NOT NULL, back TEXT NOT NULL,
      party TEXT NOT NULL DEFAULT '', buddy TEXT NOT NULL DEFAULT '', data JSONB, at TIMESTAMPTZ NOT NULL DEFAULT now())`)
      .then(() => pool.query('CREATE INDEX IF NOT EXISTS tileo_trip_scores_score ON tileo_trip_scores(score DESC)')).then(() => { ready = true; console.log('trip leaderboard: postgres'); })
      .catch(e => { console.error('trip leaderboard db', e.message); pool = null; });
  } else console.log('trip leaderboard: memory (set DATABASE_URL to keep scores)');
  const hits = new Map();
  const limited = (ip) => { const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 600000); a.push(now); hits.set(ip, a); return a.length > 8; };
  setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 600000)) hits.delete(k); }, 600000).unref();
  function reply(req, res, code, body) { const h = { 'content-type': 'application/json', 'cache-control': 'no-store' }; const o = req.headers.origin; if (allowOrigin(o)) { h['access-control-allow-origin'] = o; h.vary = 'Origin'; } res.writeHead(code, h); res.end(JSON.stringify(body)); }
  const row = r => ({ name: r.name, score: r.score, rank: r.rank, kind: r.kind, back: r.back, buddy: r.buddy || '', at: new Date(r.at).toISOString() });
  async function top(party) { const week = Date.now() - 7 * 864e5;
    if (pool && ready) { const q = (w, p) => pool.query(`SELECT name, score, rank, kind, back, buddy, at FROM tileo_trip_scores WHERE ${w} ORDER BY score DESC LIMIT 20`, p).then(r => r.rows.map(row));
      const [a, b, c] = await Promise.all([q('true', []), q("at > now() - interval '7 days'", []), party ? q('party = $1', [party]) : Promise.resolve([])]); return { top: a, week: b, party: c, stored: 'postgres' }; }
    const s = mem.slice().sort((x, y) => y.score - x.score); return { top: s.slice(0, 20).map(row), week: s.filter(r => r.at > week).slice(0, 20).map(row), party: party ? s.filter(r => r.party === party).slice(0, 20).map(row) : [], stored: 'memory' }; }
  return function handle(req, res) {
    const [path, qs] = req.url.split('?'); if (!path.startsWith('/trip/')) return false;
    if (req.method === 'OPTIONS') { const h = { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' }; const o = req.headers.origin; if (allowOrigin(o)) { h['access-control-allow-origin'] = o; h.vary = 'Origin'; } res.writeHead(204, h); res.end(); return true; }
    if (path === '/trip/top' && req.method === 'GET') { const party = (/(?:^|&)party=([a-z0-9]{4,12})(?:&|$)/.exec(qs || '') || [])[1] || ''; top(party).then(b => reply(req, res, 200, b), e => reply(req, res, 500, { error: e.message })); return true; }
    if (path === '/trip/score' && req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); if (limited(ip)) { reply(req, res, 429, { error: 'Slow down: too many trips.' }); return true; }
      let n = 0; const chunks = []; req.on('data', c => { n += c.length; if (n <= 4096) chunks.push(c); });
      req.on('end', async () => { let b; try { b = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return reply(req, res, 400, { error: 'bad json' }); }
        const r = { name: clean(b.name, 16) || 'Guest', score: int(b.score, 0, 200000), rank: RANKS.has(b.rank) ? b.rank : 'C', kind: KINDS.has(b.kind) ? b.kind : 'solo', back: BACKS.has(b.back) ? b.back : 'party',
          party: /^[a-z0-9]{4,12}$/.test(b.party || '') ? b.party : '', buddy: clean(b.buddy, 16), at: Date.now(), data: { fun: int(b.fun, 0, 200000), cash: int(b.cash, 0, 100000), wishes: int(b.wishes, 0, 9) } };
        try { if (pool && ready) await pool.query('INSERT INTO tileo_trip_scores (name, score, rank, kind, back, party, buddy, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [r.name, r.score, r.rank, r.kind, r.back, r.party, r.buddy, r.data]);
          else { mem.push(r); if (mem.length > 2000) { mem.sort((x, y) => y.score - x.score); mem.length = 1500; } }
          reply(req, res, 200, { ok: true, stored: pool && ready ? 'postgres' : 'memory' }); } catch (e) { reply(req, res, 500, { error: e.message }); } });
      return true; }
    reply(req, res, 404, { error: 'not found' }); return true; };
}
module.exports = { createTrips };
