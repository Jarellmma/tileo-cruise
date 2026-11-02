'use strict';
/*
 * TILEO accounts: username + password or Google sign-in, and one saved passenger profile per account.
 *
 * Storage: Postgres when DATABASE_URL is set (tables are created on start), otherwise an in-memory store
 * (optionally mirrored to ACCOUNTS_FILE) for local development.
 * Passwords are hashed with scrypt (random salt per user). Sessions are random 256-bit tokens; only their
 * SHA-256 is stored. Google sign-in verifies the Google ID token (RS256 signature against Google's public
 * keys, issuer, audience = GOOGLE_CLIENT_ID, expiry) on the server.
 */
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

const SESSION_DAYS = 90;
const MAX_PROFILE = 96 * 1024;           // bytes of JSON per saved passenger
const USER_RE = /^[A-Za-z0-9_.-]{3,20}$/;
const GOOGLE_ISS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/* ---------- storage ---------- */
class PgStore {
  constructor(url) {
    const { Pool } = require('./vendor/pg');
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url) || /sslmode=disable/.test(url);
    const internal = !/\.render\.com/.test(url.split('@')[1] || '');
    const ssl = process.env.DATABASE_SSL ? process.env.DATABASE_SSL !== 'off' : !(local || internal);
    this.pool = new Pool({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), max: 5, idleTimeoutMillis: 30000, ssl: ssl ? { rejectUnauthorized: false } : false });
    this.pool.on('error', e => console.error('db pool', e.message));
  }
  q(sql, params) { return this.pool.query(sql, params); }
  async init() {
    await this.q(`CREATE TABLE IF NOT EXISTS tileo_users (
      id BIGSERIAL PRIMARY KEY, username TEXT NOT NULL, uname TEXT NOT NULL UNIQUE, pass_hash TEXT, google_sub TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), profile JSONB, profile_at TIMESTAMPTZ)`);
    await this.q(`CREATE TABLE IF NOT EXISTS tileo_sessions (
      token_hash TEXT PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES tileo_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL)`);
    await this.q('CREATE INDEX IF NOT EXISTS tileo_sessions_user ON tileo_sessions(user_id)');
  }
  async createUser(username, passHash, googleSub) {
    try {
      const r = await this.q('INSERT INTO tileo_users (username, uname, pass_hash, google_sub) VALUES ($1, $2, $3, $4) RETURNING id, username', [username, username.toLowerCase(), passHash, googleSub]);
      return r.rows[0];
    } catch (e) { if (e.code === '23505') return null; throw e; }
  }
  async userByName(username) { const r = await this.q('SELECT id, username, pass_hash FROM tileo_users WHERE uname = $1', [username.toLowerCase()]); return r.rows[0] || null; }
  async userByGoogle(sub) { const r = await this.q('SELECT id, username FROM tileo_users WHERE google_sub = $1', [sub]); return r.rows[0] || null; }
  async createSession(hash, userId) { await this.q(`INSERT INTO tileo_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`, [hash, userId]); }
  async session(hash) {
    const r = await this.q('SELECT u.id, u.username, u.profile FROM tileo_sessions s JOIN tileo_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()', [hash]);
    return r.rows[0] || null;
  }
  async deleteSession(hash) { await this.q('DELETE FROM tileo_sessions WHERE token_hash = $1', [hash]); }
  async saveProfile(userId, json) { await this.q('UPDATE tileo_users SET profile = $2::jsonb, profile_at = now() WHERE id = $1', [userId, json]); }
  async cleanup() { await this.q('DELETE FROM tileo_sessions WHERE expires_at < now()'); }
  async count() { const r = await this.q('SELECT count(*)::int AS n FROM tileo_users'); return r.rows[0].n; }
}

class MemStore {
  constructor(file) {
    this.file = file; this.users = []; this.sessions = new Map(); this.nextId = 1;
    if (file && fs.existsSync(file)) { const j = JSON.parse(fs.readFileSync(file, 'utf8')); this.users = j.users || []; this.nextId = j.nextId || 1; this.sessions = new Map(j.sessions || []); }
  }
  persist() { if (this.file) fs.writeFileSync(this.file, JSON.stringify({ users: this.users, nextId: this.nextId, sessions: [...this.sessions] })); }
  async init() { }
  async createUser(username, passHash, googleSub) {
    if (this.users.some(u => u.uname === username.toLowerCase() || (googleSub && u.google_sub === googleSub))) return null;
    const u = { id: this.nextId++, username, uname: username.toLowerCase(), pass_hash: passHash, google_sub: googleSub, profile: null };
    this.users.push(u); this.persist(); return { id: u.id, username };
  }
  async userByName(username) { return this.users.find(u => u.uname === username.toLowerCase()) || null; }
  async userByGoogle(sub) { return this.users.find(u => u.google_sub === sub) || null; }
  async createSession(hash, userId) { this.sessions.set(hash, { userId, exp: Date.now() + SESSION_DAYS * 864e5 }); this.persist(); }
  async session(hash) { const s = this.sessions.get(hash); if (!s || s.exp < Date.now()) return null; const u = this.users.find(x => x.id === s.userId); return u ? { id: u.id, username: u.username, profile: u.profile } : null; }
  async deleteSession(hash) { this.sessions.delete(hash); this.persist(); }
  async saveProfile(userId, json) { const u = this.users.find(x => x.id === userId); if (u) { u.profile = JSON.parse(json); this.persist(); } }
  async cleanup() { for (const [k, s] of this.sessions) if (s.exp < Date.now()) this.sessions.delete(k); }
  async count() { return this.users.length; }
}

/* ---------- passwords and tokens ---------- */
const SCRYPT = { N: 16384, r: 8, p: 1, len: 64 };
function hashPassword(pw) {
  return new Promise((res, rej) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(pw, salt, SCRYPT.len, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (e, key) => e ? rej(e) : res(['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$')));
  });
}
function checkPassword(pw, stored) {
  return new Promise(res => {
    const parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return res(false);
    const [, N, r, p, salt, hash] = parts, want = Buffer.from(hash, 'base64');
    crypto.scrypt(pw, Buffer.from(salt, 'base64'), want.length, { N: +N, r: +r, p: +p }, (e, key) => res(!e && key.length === want.length && crypto.timingSafeEqual(key, want)));
  });
}
// a fixed dummy hash so unknown usernames take as long as wrong passwords
let DUMMY = null; hashPassword('not-a-real-password').then(h => DUMMY = h);
const newToken = () => crypto.randomBytes(32).toString('base64url');
const tokenHash = t => crypto.createHash('sha256').update(String(t)).digest('hex');

/* ---------- Google ID tokens ---------- */
let jwks = { keys: [], exp: 0 }, jwksP = null;
function fetchJson(url) {
  return new Promise((res, rej) => {
    https.get(url, r => {
      let s = ''; r.on('data', d => s += d);
      r.on('end', () => { try { const m = /max-age=(\d+)/.exec(r.headers['cache-control'] || ''); res({ body: JSON.parse(s), maxAge: m ? +m[1] : 3600 }); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}
async function googleKeys(force) {
  if (!force && jwks.exp > Date.now() && jwks.keys.length) return jwks.keys;
  jwksP = jwksP || fetchJson('https://www.googleapis.com/oauth2/v3/certs').then(({ body, maxAge }) => { jwks = { keys: body.keys || [], exp: Date.now() + maxAge * 1000 }; jwksP = null; return jwks.keys; }).catch(e => { jwksP = null; throw e; });
  return jwksP;
}
async function verifyGoogle(idToken, clientId, keysFn = googleKeys) {
  const parts = String(idToken || '').split('.'); if (parts.length !== 3) throw new Error('bad token');
  const dec = s => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
  const head = dec(parts[0]), body = dec(parts[1]);
  if (head.alg !== 'RS256' || !head.kid) throw new Error('bad alg');
  let keys = await keysFn(false), jwk = keys.find(k => k.kid === head.kid);
  if (!jwk) { keys = await keysFn(true); jwk = keys.find(k => k.kid === head.kid); }
  if (!jwk) throw new Error('unknown key');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('bad signature');
  const now = Date.now() / 1000;
  if (!GOOGLE_ISS.has(body.iss)) throw new Error('bad issuer');
  if (body.aud !== clientId) throw new Error('bad audience');
  if (!(body.exp > now - 30)) throw new Error('expired');
  if (body.iat && body.iat > now + 300) throw new Error('issued in the future');
  if (!body.sub) throw new Error('no subject');
  return body;
}

/* ---------- rate limiting ---------- */
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(); let h = hits.get(key);
  if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
  h.n++; return h.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (h.reset < now) hits.delete(k); }, 60000).unref();

/* ---------- HTTP API ---------- */
function createAccounts(opts = {}) {
  const env = opts.env || process.env;
  const origins = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim()).filter(Boolean);
  const googleClientId = (env.GOOGLE_CLIENT_ID || '').trim();
  // on Render without a database, accounts stay off (an in-memory store would lose everyone at the next restart)
  const store = env.DATABASE_URL ? new PgStore(env.DATABASE_URL) : env.RENDER ? null : new MemStore(env.ACCOUNTS_FILE);
  const keysFn = opts.googleKeys || googleKeys;
  let ready = false, initError = store ? '' : 'no database';
  if (!store) console.log('accounts off: set DATABASE_URL to the Postgres internal URL to turn them on');
  const init = () => !store ? null : store.init().then(() => { ready = true; initError = ''; console.log('accounts ready (' + (env.DATABASE_URL ? 'postgres' : 'memory') + ')'); }).catch(e => { initError = e.message; console.error('accounts init failed:', e.message); setTimeout(init, 15000); });
  init();
  setInterval(() => { if (ready && store) store.cleanup().catch(() => { }); }, 6 * 3600 * 1000).unref();

  const allowOrigin = o => o && (origins.includes('*') || origins.includes(o) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o));
  const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  function reply(req, res, code, body) {
    const h = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    const o = req.headers.origin; if (allowOrigin(o)) { h['access-control-allow-origin'] = o; h['vary'] = 'Origin'; }
    res.writeHead(code, h); res.end(JSON.stringify(body));
  }
  function readBody(req, max) {
    return new Promise((res, rej) => {
      let n = 0; const chunks = [];
      req.on('data', c => { n += c.length; if (n > max * 4) req.destroy(); else if (n <= max) chunks.push(c); });
      req.on('end', () => {
        if (n > max) return rej(Object.assign(new Error('too large'), { status: 413 }));
        try { res(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { rej(Object.assign(new Error('bad json'), { status: 400 })); }
      });
      req.on('error', rej);
    });
  }
  async function startSession(user) {
    const token = newToken(); await store.createSession(tokenHash(token), user.id);
    return token;
  }
  async function auth(req) {
    const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization || '');
    return m ? store.session(tokenHash(m[1])) : null;
  }
  async function uniqueName(base) {
    let b = String(base || '').normalize('NFKD').replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 16);
    if (b.length < 3) b = 'Sailor';
    for (let i = 0; i < 40; i++) {
      const name = i ? (b + (i < 10 ? i + 1 : Math.floor(Math.random() * 9000 + 1000))).slice(0, 20) : b;
      if (!(await store.userByName(name))) return name;
    }
    return 'Sailor' + crypto.randomInt(100000, 999999);
  }

  // returns true when the request was an API call
  return function handle(req, res) {
    const url = req.url.split('?')[0];
    if (!url.startsWith('/api/')) return false;
    if (req.method === 'OPTIONS') {
      const o = req.headers.origin, h = { 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400' };
      if (allowOrigin(o)) { h['access-control-allow-origin'] = o; h['vary'] = 'Origin'; }
      res.writeHead(204, h); res.end(); return true;
    }
    (async () => {
      if (url === '/api/config' && req.method === 'GET') return reply(req, res, 200, { accounts: ready, setup: !store, google: googleClientId || '' });
      if (!ready) return reply(req, res, 503, { error: 'Accounts are starting up. Try again in a moment.' });
      const ip = ipOf(req);
      if (url === '/api/signup' && req.method === 'POST') {
        if (limited('su:' + ip, 8, 3600e3)) return reply(req, res, 429, { error: 'Too many new accounts from here. Try again later.' });
        const b = await readBody(req, 4096), u = String(b.username || '').trim(), p = String(b.password || '');
        if (!USER_RE.test(u)) return reply(req, res, 400, { error: 'Usernames are 3 to 20 letters, numbers, dots, dashes or underscores.' });
        if (p.length < 8 || p.length > 128) return reply(req, res, 400, { error: 'Passwords need at least 8 characters.' });
        if (p.toLowerCase() === u.toLowerCase()) return reply(req, res, 400, { error: 'Pick a password that is different from your username.' });
        const user = await store.createUser(u, await hashPassword(p), null);
        if (!user) return reply(req, res, 409, { error: 'That username is taken.' });
        console.log('signup', user.id);
        return reply(req, res, 200, { token: await startSession(user), user: { name: user.username }, profile: null });
      }
      if (url === '/api/login' && req.method === 'POST') {
        const b = await readBody(req, 4096), u = String(b.username || '').trim(), p = String(b.password || '');
        if (limited('li:' + ip, 30, 900e3) || limited('lu:' + u.toLowerCase(), 10, 900e3)) return reply(req, res, 429, { error: 'Too many tries. Wait 15 minutes and try again.' });
        const user = USER_RE.test(u) ? await store.userByName(u) : null;
        const ok = await checkPassword(p, user && user.pass_hash ? user.pass_hash : DUMMY);
        if (!user || !user.pass_hash || !ok) return reply(req, res, 401, { error: 'Wrong username or password.' });
        const s = await startSession(user), full = await store.session(tokenHash(s));
        return reply(req, res, 200, { token: s, user: { name: user.username }, profile: full ? full.profile : null });
      }
      if (url === '/api/google' && req.method === 'POST') {
        if (!googleClientId) return reply(req, res, 400, { error: 'Google sign-in is not set up yet.' });
        if (limited('g:' + ip, 30, 900e3)) return reply(req, res, 429, { error: 'Too many tries. Try again later.' });
        const b = await readBody(req, 8192);
        let claims; try { claims = await verifyGoogle(b.credential, googleClientId, keysFn); } catch (e) { return reply(req, res, 401, { error: 'Google sign-in failed. Try again.' }); }
        let user = await store.userByGoogle(claims.sub);
        if (!user) {
          for (let i = 0; i < 3 && !user; i++) user = await store.createUser(await uniqueName(claims.given_name || claims.name), null, claims.sub);
          if (!user) user = await store.userByGoogle(claims.sub);
          if (!user) return reply(req, res, 500, { error: 'Could not create your account. Try again.' });
          console.log('google signup', user.id);
        }
        const s = await startSession(user), full = await store.session(tokenHash(s));
        return reply(req, res, 200, { token: s, user: { name: user.username }, profile: full ? full.profile : null });
      }
      if (url === '/api/me' && req.method === 'GET') {
        const me = await auth(req); if (!me) return reply(req, res, 401, { error: 'Signed out' });
        return reply(req, res, 200, { user: { name: me.username }, profile: me.profile || null });
      }
      if (url === '/api/profile' && req.method === 'PUT') {
        const me = await auth(req); if (!me) return reply(req, res, 401, { error: 'Signed out' });
        if (limited('pf:' + me.id, 120, 600e3)) return reply(req, res, 429, { error: 'Saving too often.' });
        const b = await readBody(req, MAX_PROFILE + 1024);
        const p = b && b.profile; if (!p || typeof p !== 'object' || Array.isArray(p)) return reply(req, res, 400, { error: 'No profile' });
        const json = JSON.stringify(p); if (json.length > MAX_PROFILE) return reply(req, res, 413, { error: 'Profile too large' });
        await store.saveProfile(me.id, json);
        return reply(req, res, 200, { ok: true });
      }
      if (url === '/api/logout' && req.method === 'POST') {
        const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization || ''); if (m) await store.deleteSession(tokenHash(m[1]));
        return reply(req, res, 200, { ok: true });
      }
      return reply(req, res, 404, { error: 'Not found' });
    })().catch(e => { if (!res.headersSent) reply(req, res, e.status || 500, { error: e.status === 413 ? 'Too large' : e.status === 400 ? 'Bad request' : 'Something went wrong. Try again.' }); if (!e.status) console.error('api', e.message); });
    return true;
  };
}

module.exports = { createAccounts, verifyGoogle, hashPassword, checkPassword };
