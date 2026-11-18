AI-use disclosure: Claude (Claude Code) wrote this README under my direction for M0 (T7, T11a).
Codex updated the test instructions under Hao's direction after the M0 review.

# Running Gnome Heist

Everything runs with project-local tools; nothing is installed globally.

```sh
nvm use                # Node 24.22.3 from .nvmrc (does not change the default Node)
npm ci                 # exact versions from package-lock.json
npm run typecheck      # strict tsc: core (no DOM, no Node), core tests, game, worker
npm test               # core and client placement in Node; worker in the Workers runtime (workerd)
npm run build          # Vite build of game/ into game/dist, then a wrangler dry-run bundle
npm run dev            # build the client, then `wrangler dev`: http://127.0.0.1:8787
```

`npm run dev -w game` runs the client alone on Vite's dev server (no API).

Controls (T8): press 1, 2 or 3 to choose a dog hole; WASD or arrow keys to walk; hold E to open or close a gate, pick or re-lock a padlock, kick a gap in a fence, or dig up a gnome; press E in a dog hole to end the night; R after the night to play it again. The rules live in `core/` (GDD 5.2, 5.4 to 5.6, 5.9, 5.11). There is no morning yet (T10): every night starts from a fresh farm. The fog uses the GDD sight rule, but its dimmed "seen n1" memory is still a client-side stand-in for the T9 player view, and danger is drawn from the real state.

From the west entrance (1), walk east along the worn trail. Tall grass shows only the top of your cap. The dense bush beyond it hides you and any gnome you carry from sight, including lamplight. A nearby dog's alert radius still applies.

## Layout

- `core/`: engine-free rules. `tsconfig.json` has no DOM or Node types, and `test/boundary.test.ts` rejects package imports, clocks, timers, `Math.random` and `fetch`.
- `maps/farm.tmj`: the source for the playable farm layout. `npm run generate -w maps` rebuilds its decoration layer, the night tileset and the environment sprites from that layout.
- `game/`: Phaser 4.2.1 client (scenes `Boot`, `Night`, `Hud`). `window.__gnomeDebug` holds a read-only snapshot for automated checks.
- `worker/`: one Worker serving `game/dist` and `POST /session/{id}/morning`, one Durable Object (`FarmerSession`) per session. No real model is called in M0; the morning answers with the placeholder `ruleFarmer`.

## Deploying (ask Hao first)

`npm run deploy` builds and runs `wrangler deploy` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` loaded from the gitignored root `.env` (see `.env.example`). There is no `wrangler login`. Worker secrets go in with `wrangler secret put`; locally, in `worker/.dev.vars`.
