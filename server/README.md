# TILEO multiplayer and accounts server

A small Node server with no npm install step. Vendored, MIT-licensed: `ws` 8.22.0 (`vendor/ws`) and
node-postgres 8.23 with its dependencies bundled into `vendor/pg.js`.

- `GET /health` – status and player count
- `wss://<host>/ws` – game connection (rooms, presence, chat)
- `/api/*` – accounts (see `accounts.js`):
  `GET /api/config`, `POST /api/signup`, `POST /api/login`, `POST /api/google`, `GET /api/me`, `PUT /api/profile`, `POST /api/logout`

Accounts: usernames and passwords (scrypt hashes, random salt), or Google sign-in (the Google ID token is verified
on the server: RS256 signature against Google's keys, issuer, audience and expiry). Sessions are random tokens of
which only a SHA-256 is stored; they last 90 days. Each account keeps one saved passenger (JSON, up to 96 KB).
Logins are rate-limited per IP and per username.

Environment variables:
- `DATABASE_URL` – Postgres connection string (Render: the database's *Internal Database URL*). Tables are created on start.
  Without it, accounts stay off on Render; locally an in-memory store is used (`ACCOUNTS_FILE` keeps it in a JSON file).
- `GOOGLE_CLIENT_ID` – OAuth client ID of a Google Cloud "Web application" client whose authorized JavaScript
  origin is the game's address. Leave empty to hide the Google button.
- `ALLOWED_ORIGINS` (comma-separated, default `*`), `DECK_MAX` (16), `SHIP_MAX` (24), `DATABASE_SSL` (`on`/`off`, optional).

Run locally with `node server.js` (listens on `$PORT`, default 10000).
