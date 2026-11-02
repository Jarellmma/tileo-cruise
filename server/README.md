# TILEO multiplayer server

A tiny Node WebSocket relay (no database, no npm install needed: `ws` 8.22.0 is vendored in `vendor/ws`, MIT).

- `GET /health` – status and player count
- `wss://<host>/ws` – game connection

Environment variables (all optional): `ALLOWED_ORIGINS` (comma-separated, default `*`), `DECK_MAX` (16), `SHIP_MAX` (24).
Run locally with `node server.js` (listens on `$PORT`, default 10000).
