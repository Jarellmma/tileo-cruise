# TILEO Cruise Lines

A 3D party-cruise game that runs in the browser. Make a passenger, explore the Tileo Infinity,
ride slides, surf, play mini golf, trivia and casino games (play chips only), decorate your suite,
take day trips to three islands and party with other players.

- `public/` is the whole game (static files). Open `public/index.html` from any web server.
- `render.yaml` deploys it to Render as a free static site.
- `server/` is the multiplayer and accounts server (Node, Render web service `tileo-multiplayer`, Postgres `tileo-accounts`).
  `public/config.js` points the game at it; if that address is empty, the game falls back to peer-to-peer multiplayer
  and passengers are saved on the device only.
- Use the People button in game to start a private ship and share an invite link.

Third-party licenses: `public/vendor/LICENSES.txt`.
