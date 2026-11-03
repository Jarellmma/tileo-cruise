# TILEO KINGDOM: Strip Life (website)

Adults-only (18+, non-explicit) lifestyle-resort sim on a parody Las Vegas Strip, realistic edition (v6.2).
three.js r186, no build step. Play coins only: nothing to buy, no real-money gambling, no cash-out.

This `kingdom` branch holds the website build only (it shares the repository with TILEO Cruise Lines, whose site
lives on `main`; nothing here touches it):

- `public/` – the game as served by the Render static site. `public/config.js` holds the multiplayer server address.
- `server/` – multiplayer (public Strips, private parties, chat) and TILEO accounts, shared with TILEO Cruise Lines.
  Node 18+, no npm install (ws and pg are vendored). See `server/README.md`.
- `render.yaml` – reference blueprint for the two Render services.

The full game source (tools, texture generators, trailer pipeline) is kept in the "TILEO KINGDOM – Realistic"
Google Drive folder; this branch is regenerated from it with `tools/build_site.py`.

Credits: realistic people from the Microsoft Rocketbox Avatar Library (MIT, `public/assets/people/LICENSE-Rocketbox.txt`);
three.js (MIT). Strip resorts are fictional parody lookalikes, not affiliated with any real resort or brand.
