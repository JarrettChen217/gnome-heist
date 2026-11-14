AI-use disclosure: Claude (Claude Code) wrote this README under my direction for M0 (T7, T11a).

# Running Gnome Heist (M0 greybox)

Everything runs with project-local tools; nothing is installed globally.

```sh
nvm use                # Node 24.22.3 from .nvmrc (does not change the default Node)
npm ci                 # exact versions from package-lock.json
npm run typecheck      # strict tsc: core (no DOM, no Node), core tests, game, worker
npm test               # core in Node; worker in the Workers runtime (workerd)
npm run build          # Vite build of game/ into game/dist, then a wrangler dry-run bundle
npm run dev            # build the client, then `wrangler dev`: http://127.0.0.1:8787
```

`npm run dev -w game` runs the client alone on Vite's dev server (no API).

Controls in M0: WASD or arrow keys to walk. Gates and fences are solid until the night rules land (T8). The fog and "seen n1" labels are an engine check drawn from a plain radius, not the player view from `core` (T9).

## Layout

- `core/`: engine-free rules. `tsconfig.json` has no DOM or Node types, and `test/boundary.test.ts` rejects package imports, clocks, timers, `Math.random` and `fetch`.
- `maps/farm.tmj`: the greybox farm in the Tiled subset (Technical plan Section 5), with `maps/greybox.png` embedded as its tileset. Both come from `npm run generate -w maps`; after a hand edit in Tiled, the `.tmj` is the source.
- `game/`: Phaser 4.2.1 client (scenes `Boot`, `Night`, `Hud`). `window.__gnomeDebug` holds a read-only snapshot for automated checks.
- `worker/`: one Worker serving `game/dist` and `POST /session/{id}/morning`, one Durable Object (`FarmerSession`) per session. No real model is called in M0; the morning answers with the placeholder `ruleFarmer`.

## Deploying (ask Hao first)

`npm run deploy` builds and runs `wrangler deploy` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` loaded from the gitignored root `.env` (see `.env.example`). There is no `wrangler login`. Worker secrets go in with `wrangler secret put`; locally, in `worker/.dev.vars`.
