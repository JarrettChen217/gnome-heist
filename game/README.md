AI-use disclosure: Claude (Claude Code) wrote this README under my direction for M0 (T7, T11a).
Codex updated the test instructions under Hao's direction after the M0 review.
Claude (Claude Code) added the Playwright smoke-test instructions under Hao's direction.

# Running Gnome Heist

Everything runs with project-local tools; nothing is installed globally.

```sh
nvm use                # Node 24.22.3 from .nvmrc (does not change the default Node)
npm ci                 # exact versions from package-lock.json
npm run typecheck      # strict tsc: core (no DOM, no Node), core tests, game, worker
npm test               # core and client placement in Node; worker in the Workers runtime (workerd)
npm run build          # Vite build of game/ into game/dist, then a wrangler dry-run bundle
npm run dev            # build the client, then `wrangler dev`: http://127.0.0.1:8787
npm run test:e2e       # Playwright smoke tests in Chrome against a fresh local Worker on port 8790
```

`npm run test:e2e` uses the installed Google Chrome locally (with `CI` set, Playwright's own Chromium, installed by `npx playwright install chromium`). It never calls a paid model and refuses to run if `worker/.dev.vars` selects one. `npx playwright test --ui` steps through the tests; `npx playwright show-report` opens the last report, with traces for failed tests.

`npm run dev -w game` runs the client alone on Vite's dev server (no API).

## Two-night playtest

Choose an entrance with 1, 2 or 3. Walk with WASD or the arrow keys. Hold E at a gate, fence or pedestal, or press E inside a dog hole to end the night. Esc opens the pause menu. Restarting the night takes you back to entrance selection with that evening’s starting farm.

After the first night, read the farmer’s morning response and press Enter to choose an entrance for night two. Taken gnomes, changes to the farm and the farmer’s response carry over. R at the result screen starts a fresh playtest. By default the browser uses the deterministic rule farmer without making a morning API request. See the [two-night playtest plan](../docs/two-night-playtest.md).

### Local Worker checkpoint

1. Run `npm run dev` from the repository root and open `http://127.0.0.1:8787/?farmer=agent`. The browser now runs the first morning through the local Worker. With no provider binding, the Worker uses the same rule farmer.
2. For a paid test, set `FARMER_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` in the gitignored `worker/.dev.vars`, then restart the local Worker. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`. Each fresh two-night run requests the model at most once. Check the Worker log for provider, outcome, elapsed time, and token usage and estimated cost when reported.
3. For the quiet-night smoke, choose an entrance and press E without leaving the dog hole. To exercise a visible defense change with the rule farmer, take the southwest gnome and return through the west dog hole. The daybreak panel shows progress while the Worker decides. Press Enter after the plan appears to start night two. If the Worker is unreachable or misses the browser deadline, the browser switches that run to the local rule farmer. `window.__gnomeDebug.morningSource` identifies the result.
4. To reproduce the timeout, retry and isolation checks without provider calls, run `npm test -- --project worker`. The Workers test configuration uses fake providers or explicitly selects the rule farmer.

From the west entrance (1), walk east along the worn trail. Tall grass shows only the top of your cap. The dense bush beyond it hides you and any gnome you carry from sight, including lamplight. A nearby dog's alert radius still applies.

## Layout

- `core/`: engine-free rules. `tsconfig.json` has no DOM or Node types, and `test/boundary.test.ts` rejects package imports, clocks, timers, `Math.random` and `fetch`.
- `maps/farm.tmj`: the source for the playable farm layout. `npm run generate -w maps` rebuilds its decoration layer, the night tileset and the environment sprites from that layout.
- `game/`: Phaser 4.2.1 client (scenes `Boot`, `Night`, `Hud`). `window.__gnomeDebug` holds a read-only snapshot for automated checks.
- `worker/`: one Worker serving `game/dist` and the session morning and finish endpoints. One Durable Object (`FarmerSession`) per session owns the revision, budget, layout and memory.

## Deploying (ask Hao first)

`npm run deploy` builds and runs `wrangler deploy` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` loaded from the gitignored root `.env` (see `.env.example`). There is no `wrangler login`. Worker secrets go in with `wrangler secret put`; locally, in `worker/.dev.vars`.
