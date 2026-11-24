AI-use disclosure: Claude (Claude Code) drafted the documents in this repository under my direction; each document labels which items are my decisions and which are agent proposals.

# Gnome Heist

A short single-player stealth game: sneak onto the farm next door at night to steal the farmer's garden gnomes, while he, an AI agent, reads the traces you leave and spends a small daily budget of stamina and money on his defenses each morning.

Final project for *AI in Practice: Game Design and Development* (Fall 2026). Current stage: **G1 Concept**. The M0 skeleton (greybox farm in Phaser 4, the shared rules package `core/`, and the Worker skeleton) is on branch `feat/m0-skeleton`; how to run it is in [game/README.md](game/README.md). The build plan and milestones are in the technical plan.

The local two-night playable on the night-farm branch has [controls](game/README.md) and a [playtest plan](docs/two-night-playtest.md).

| Document | Version |
| --- | --- |
| [Initial Game Design Document](docs/gdd.md) | 0.3 (G1 Initial) |
| [Initial Configuration Document](docs/configuration.md), including the planned role-coverage map | 0.3 (G1 Initial) |
| [Technical plan](docs/architecture.md): engine, code layout, milestones | 0.2 (G1) |
| [Systems diagram](docs/systems-diagram.md) | 0.2 (G1) |
| [Initial Project Plan and Risk Register](docs/project-plan.md) | 0.3 (G1 Initial) |

Videos are never committed here; recordings are linked from the course submission.

## Engine choice: why Phaser, not Godot

The course allows any language and engine (course repository README and AGENTS.md). Cloudflare is the taught route for deployment and the AI Worker; another platform needs instructor permission. We chose **TypeScript + Phaser 4.2.1** on 2026-11-13 [Hao, on agent proposal]; the full comparison with Godot 4, Unity and others is in the [Technical plan](docs/architecture.md), Section 2. Re-checked on 2026-11-23, after seeing classmates use Godot; the choice stands:

| Question | Phaser + TypeScript (current) | Godot 4 |
| --- | --- | --- |
| Same rules in client and Worker | One `core/` package and one test suite, used by both | Rules written twice (GDScript and TypeScript), or bridged through `JavaScriptBridge` in a web export |
| Playable from a link | Small static build served by the Worker | Web export works; larger download and threading options to configure |
| Reviewing agent changes | Plain code, readable diffs | Scene files are text; workable |
| 2D lighting and fog | Our own per-tile drawing; enough, because lamp and dog ranges are whole tiles | Built in, which is Godot's main advantage here |
| Cost of switching now | None | Rewrite `game/` and the web export with G2/G3 due 2026-11-28 |

Godot is a mature open-source engine (released in 2014, MIT license), not an AI-built one, and a good choice for many class projects; it loses here only because of the shared-rules requirement and the schedule. The choice stays reversible: all rules live in `core/`, so replacing the engine means rewriting `game/` only. If the night needs richer light, the cheaper path is a lighting pass in Phaser.

## Browser testing with Playwright

Status: **local smoke suite added; CI typechecks it but does not run it** [Hao, on agent proposal, 2026-11-24]. How to run it is in [game/README.md](game/README.md). Sources: [playwright.dev](https://playwright.dev/) (intro, `webServer`, CI, screenshots and snapshots pages, release notes), read 2026-11-24.

**What it is.** Playwright is Microsoft's open-source browser automation library, with a test runner, Playwright Test (`@playwright/test`). A test script opens a real browser (Chromium, Firefox or WebKit; headless by default, `--headed` to watch), loads a page, presses keys or clicks, and asserts on what the page shows. Each test gets a fresh browser context, like a new private window, so tests do not share cookies or storage. Assertions retry until they pass or time out, which avoids hand-written waits. Latest version at reading: 1.65; the docs list Node 22, 24 or 26, and the package itself allows Node 20 or later (we pin 24.22.3).

**How it would run here.**

1. `playwright.config.ts` uses the `webServer` option to start the game before the tests (for us, the Worker under `wrangler dev`, which also serves the client), and waits for its URL to answer.
2. Tests in a separate folder (for example `e2e/`) open that URL and play through it.
3. The same tests can point at a deployed preview URL instead (`baseURL`), which checks the real deployment from a fresh browser.
4. In CI, the workflow adds `npx playwright install --with-deps` (downloads the browsers) and `npx playwright test`, then uploads the HTML report and traces as an artifact.

Debugging tools: `npx playwright test --ui` (step-by-step UI mode), traces (DOM, network, console and screenshots per step, opened from `npx playwright show-report`), and `npx playwright codegen` (records clicks into test code).

**Fit for Gnome Heist.**

| Use | Fit | Note |
| --- | --- | --- |
| Smoke test: the page boots, the canvas appears, no console errors | Good | Cheap, and catches broken builds that unit tests miss |
| Deployed preview loads in a fresh browser (open M0 check in the [Project Plan](docs/project-plan.md), T7) | Good | Point `baseURL` at the preview URL |
| Isolated sessions | Good | Two browser contexts are two separate players; check that each gets its own farmer state |
| Morning round trip, timeout fallback | Good with care | `page.route` can delay or fail the morning request to exercise the client's fallback; tests must use the rule-based farmer, never paid model calls |
| Playing a night: walking, stealing, being spotted | Partial | Phaser draws everything into one canvas, so Playwright cannot find sprites the way it finds buttons. Tests press keys and read the read-only `window.__gnomeDebug` snapshot that the Night scene already publishes, or compare screenshots |
| Screenshot comparison (`toHaveScreenshot`) | Weak at first | WebGL rendering differs by OS, GPU and headless mode; baselines are per platform and would need regenerating in CI's Linux environment. Better for occasional art checks than for every PR |
| Rules, budgets, validator | Not needed | Already covered faster by the Vitest suites in `core/` and `worker/` |

**Costs and risks.** One more dev dependency, a browser download of a few hundred MB locally and in CI, and a slower CI job. Canvas-based tests are more fragile than unit tests, so the suite should stay small. A passing browser test is still not a playtest (project rule 8).

**What is in place** (`playwright.config.ts`, `e2e/smoke.spec.ts`; `@playwright/test` 1.65.0). Four Chromium tests, run locally with the installed Google Chrome, against a fresh `wrangler dev` on port 8790 started by the `webServer` option:

1. The client boots to entrance selection with no page or console errors (the browser's automatic `/favicon.ico` 404 is ignored, since the client has no favicon).
2. Holding an arrow key walks the gardener.
3. With `?farmer=agent`, a quiet first night gets its morning plan from the local Worker (`morningSource` is `rule`).
4. With the morning request blocked by `page.route`, the browser falls back to local rules (`morningSource` is `offline-rule`).

The suite never calls a paid model: the Worker is started with `FARMER_PROVIDER` set to `none`, and the config refuses to run if `worker/.dev.vars` selects `anthropic`. Verified 2026-11-24: 4 tests passed, and 12 of 12 with `--repeat-each=3`. Learned along the way: Phaser reads keys once per frame, so the tests hold each key for 100 ms. A real player's tap is longer than a frame, so this is a test detail, not a game bug.

**Not done** [Open]: running the suite in CI (needs `npx playwright install --with-deps` and the browser download), screenshot baselines, and a deployed-preview run (deploying needs Hao's OK). Playwright MCP (`npx @playwright/mcp@latest`) lets a coding agent drive a browser; we already have browser tools for agents, so it is not needed now.
