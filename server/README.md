# TILEO KINGDOM multiplayer and accounts server

A small Node server with no npm install step. Vendored, MIT-licensed: `ws` 8.22.0 (`vendor/ws`) and
node-postgres 8.23 with its dependencies bundled into `vendor/pg.js` (the same files as the TILEO Cruise server).

- `GET /health` – status and player count
- `wss://<host>/ws` – game connection: `join` (public Strip, or a private party by code), `p` (presence, ~10/s), `say` (chat)
- `/api/*` – accounts: `GET /api/config`, `POST /api/signup`, `POST /api/login`, `POST /api/google`, `GET /api/me`,
  `PUT /api/profile`, `POST /api/logout`

Rooms: public Strips hold 24 players (`STRIP_MAX`); when one is full the next opens. Private parties (invite link
`#party=<code>`) hold 24 (`PARTY_MAX`). On a public Strip, chat is limited to the preset phrases (checked here, so a
modified client cannot get around it); private parties can type freely (80 characters, one line every 1.2 s).
Presence is only relayed, never stored.

Accounts are **shared with TILEO Cruise Lines**: both servers use the same Postgres tables `tileo_users` and
`tileo_sessions`, so the same username and password work in both games. Each game keeps its own saved profile:
the Cruise passenger stays in `tileo_users.profile`, TILEO KINGDOM saves its guest (coins, wardrobe, suite, look) in
`tileo_game_profiles` (`game = 'kingdom'`). Passwords are scrypt hashes; sessions are random tokens of which only a
SHA-256 is stored (90 days); logins are rate-limited per IP and per username.

Environment variables:
- `DATABASE_URL` – the same Postgres as TILEO Cruise (Render: database `tileo-accounts` → Connect → *Internal Database
  URL*). Tables are created on start. Without it, accounts stay off on Render (the game shows "Sign-in opens soon").
- `ALLOWED_ORIGINS` – the game's address, e.g. `https://tileo-kingdom.onrender.com` (comma-separated; default `*`).
- `GOOGLE_CLIENT_ID` – optional, the same Google OAuth Web client as Cruise with the Kingdom site added as an
  authorized JavaScript origin. Leave empty to hide the Google button.
- `TILEO_GAME` (`kingdom`), `STRIP_MAX` (24), `PARTY_MAX` (24), `DATABASE_SSL` (`on`/`off`, optional).

Run locally with `node server.js` (listens on `$PORT`, default 10000; without `DATABASE_URL` it keeps accounts in
memory, or in the JSON file named by `ACCOUNTS_FILE`). Point the game at it with
`window.TILEO_RELAY_URL = "ws://localhost:10000/ws"` in `config.js`.
