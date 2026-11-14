AI-use disclosure: Claude (Claude Code) drafted this technical plan from my decisions and its own proposals; every item is labeled with who decided it.

# Gnome Heist: Technical plan

| | |
| --- | --- |
| Gate | G1 Concept (Initial version) |
| Version | 0.1, 2026-11-13 |
| Accountable owner | Hao, as Tech Lead, with Creative Director approval |
| Companion documents | [GDD](gdd.md) · [Configuration Document](configuration.md) · [Systems diagram](systems-diagram.md) · [Project Plan](project-plan.md) |

**Status.** Planned. No code exists yet. Labels follow the GDD: **[Hao]**, **[Hao, on agent proposal]**, **[Proposed]**, **[Open]**.

## 1. Decisions

| Decision | Origin |
| --- | --- |
| Build the real game from the start. No scripted mock-up demo: the G1 pitch uses the deck, plus a short clip of the real greybox build only if one is playable by then. | Hao, on agent proposal, 2026-11-13 |
| Browser game in **TypeScript + Phaser**. | Hao, on agent proposal (2026-11-12; reconfirmed for the full game 2026-11-13) |
| All game rules live in one **engine-free TypeScript package, `core/`**, used unchanged by the Phaser client, the Worker, and the tests. | Hao, on agent proposal, 2026-11-13 |
| Farm maps are authored in the **Tiled** map editor and stored as Tiled JSON. | Hao, on agent proposal, 2026-11-13 |
| The farmer runs in a **Cloudflare Worker** with one Durable Object per play session, calling models through the Vercel AI SDK (Configuration Document A6). | Hao, on agent proposal, 2026-11-12 |
| Exact versions (Section 7) and the open technical questions (Section 9). | Proposed |

## 2. Why Phaser and TypeScript

The game is a small tile-based 2D stealth game that must be playable from a link (playtests, staff review) and must call a model from a server. The deciding factor is that the same rules must run in two places: the client judges the night (stamina, gates, footprints, spotting), and the Worker judges the farmer's plan (budget, safe zones, reachability). One language for both means one implementation and one test suite.

| Criterion | Phaser + TypeScript | Godot 4 | Unity |
| --- | --- | --- | --- |
| Rules shared with the Worker | Same code, same tests | Rules written twice (GDScript and TypeScript) | Written twice (C# and TypeScript) |
| Play from a link | Small static build | Web export works, larger download, threading options to configure | Heavy WebGL build, slow iteration |
| Changes made and reviewed by coding agents | Plain code, readable diffs | Scenes are text files; workable | Editor-bound assets; hard to review |
| 2D lighting and fog | Written by us; tile-based ranges are enough here | Built in | Built in |
| Map editing | Loads Tiled maps natively | Built-in editor | Built-in editor |

Rejected: **Godot 4** (its strength, lighting, is not needed because lamp and dog ranges are whole tiles; the duplicated rules are a permanent cost); **Unity** (build weight and editor dependence); **PixiJS** (a renderer only: tilemaps, cameras and input would be ours to write); **Pygame** (web export is not mature). **Excalibur.js** is a credible TypeScript alternative with less documentation and fewer examples than Phaser.

Because rules live in `core/`, the engine choice is reversible: replacing Phaser means rewriting `game/` only.

## 3. Repository layout [Hao, on agent proposal]

```
gnome-heist/
  core/     engine-free rules: map model, world state, night actions, stamina, traces,
            fog memory, farmer context, plan validator, reachability, rule-based farmer
  game/     Phaser client: scenes, rendering, input, camera, HUD, audio; calls core/
  worker/   Cloudflare Worker + Durable Object: model call, failover, timeout, logging; calls core/
  maps/     Tiled maps (.tmj) and tilesets
  docs/     design and planning documents
  spike/    model measurements (Python, uv)
```

One npm workspace. **Dependency rule:** `core/` imports nothing from Phaser, the DOM, the network, or the clock; randomness comes from a seeded generator passed in. `game/` and `worker/` depend on `core/`, never on each other. [Proposed]

## 4. The `core/` contract [Proposed]

The names are placeholders; the boundaries are the point.

| Function | Input → output | Used by |
| --- | --- | --- |
| `loadFarm(tiledJson)` | Tiled JSON → validated `FarmDef` (rejects maps that break the GDD's rules, such as a slot inside a safe zone or no open route) | game, worker, tests |
| `applyNightAction(state, action)` | `NightState` + move / interact / end night → new state + events | game, tests |
| `extractTraces(state)` | end-of-night state → `TraceList` (GDD 5.6) | game, tests |
| `buildFarmerContext(farmerState, traces)` | → `FarmerContext`: the only object the farmer receives (Configuration Document A2) | worker, tests |
| `validatePlan(context, plan)` | → accepted plan, or the list of violated rules (A7) | worker, game (offline), tests |
| `ruleFarmer(context)` | → plan; deterministic baseline and fallback (A9) | worker, game (offline), tests |
| `applyPlan(farmerState, plan)` | → new layout, budget, memory | worker, game, tests |

The knowledge boundary is enforced by type: `FarmerContext` is built only from the trace list, the farmer's own layout and budget, and his memory, so the player's path, position, stamina, and fog memory cannot reach the model by accident. A test asserts this.

**Who owns which state [Proposed; see TQ2].** The client owns the night (single-player, so cheating is not a concern). The Durable Object owns the farmer's side: layout, budget, memory, and the morning log. At the end of a night the client sends the night result (trace list, gnome taken, strike); the Worker returns the validated plan and the new layout. If the Worker cannot be reached in time, the client runs `ruleFarmer` from `core/` locally, so the game stays playable offline and the forced-timeout fallback has a second line.

## 5. Maps in Tiled [Hao, on agent proposal]

- Tile layers: ground (soft, stone, blocked), decoration.
- Object layers with custom properties: `dogHoles`, `pedestals`, `gates` (padlocked or not), `fences`, `lampPosts`, `doghouseSpots`, `bushes`, `windowSight`.
- Phaser renders the tile layers; `core/loadFarm` reads the same file for the rules, so the map has one source.
- Tiled is GPL-licensed as an editor; the map files are our own work. Recorded in `CREDITS.md` at M0.

## 6. Client, deployment, tests [Proposed]

- **Scenes:** `Boot` (load), `Night` (play), `Morning` (the farmer's sequence, GDD 5.8), `Hud` (stamina, strikes, night). Angled top-down view with depth sorted by y; camera follows the player.
- **Art:** greybox first. The hand-drawn ink look (GDD 2) comes in the M4 art pass; its technique (textures drawn ahead of time or generated at load) is TQ5.
- **Deployment:** static client on Cloudflare (Pages, or Worker static assets; TQ3); the Worker as its own service; keys only in Worker secrets.
- **Tests:** Vitest for `core/` (one test per rule row in GDD 5.4, 5.7 and 5.2; validator fixtures; reachability; the knowledge-boundary test); Worker tests with the model mocked, including an injected timeout; a browser smoke test later.
- **CI:** GitHub Actions runs typecheck, tests, and build on every PR.

## 7. Versions [Proposed, confirm and pin at M0]

Read from the npm registry on 2026-11-13.

| Tool | Candidate | Note |
| --- | --- | --- |
| Phaser | **4.2.1** (2026-07-09) | Phaser 4 stable since 4.0.0 (2026-04-10). Fallback: 3.90.0 (2025-05-23), the last 3.x release, with more examples online. See TQ1. |
| Vite | 8.x (8.3.8 latest) | Needs Node ^20.19 or ≥ 22.12. |
| Wrangler | latest | Needs Node ≥ 22.12. The development Mac has Node 18 and 20 only, so M0 installs a Node 22 or 24 LTS and pins it in `.nvmrc` (with Hao's OK). |
| TypeScript, Vitest, Vercel AI SDK | pinned at M0 | — |

## 8. Milestones [Hao, on agent proposal]

Each milestone ends in something playable or testable. Target dates are my own, not course deadlines; task IDs are in the [Project Plan](project-plan.md).

| Milestone | Contents | Tasks | Target |
| --- | --- | --- | --- |
| M0 Skeleton | Workspace, `core/` types and interfaces, Tiled format and a greybox farm, Phaser boots and draws it, CI, preview deploy | T7 | Nov 16 |
| M1 Night | Movement, dog holes and safe zones, gates, padlocks, fences, gnomes, stamina and red prompt, dangers on the ground, spotting, end night, trace list | T8 | Nov 18 |
| M2 Full game on the rule-based farmer | Fog with "last seen", morning sequence, budget, five nights, strikes, win and loss | T9, T10, T12 | Nov 21 |
| M3 Model farmer | Worker, one Durable Object per session, validator, failover, forced-timeout fallback, logging; re-measure with the budget contract (C9) | T11 | Nov 22 (checkpoint Nov 23) |
| M4 Polish | Ink art pass, farmer lines, sound cues, morning staging | after T12 | before G2/G3 (Nov 28) |

Then the live evaluation (T13) and the first external playtest (T14).

## 9. Open technical questions

| ID | Question | Current proposal | Decide by |
| --- | --- | --- | --- |
| TQ1 | Phaser 4.2.1 or 3.90.0? Phaser 4 is current and maintained; 3.x has more tutorials, plugins, and examples that coding agents have seen. | 4.2.1, unless the M0 spike finds a blocker (Tiled loading, depth sorting, text, camera). | M0 |
| TQ2 | Should the Durable Object recompute the trace list from a night action log instead of trusting the client's list? | Trust the client (single-player); revisit only if logs need to be tamper-proof for evaluation. | M3 |
| TQ3 | Cloudflare Pages or Worker static assets for the client? | Whichever needs fewer moving parts at M0. | M0 |
| TQ4 | Worker test tooling: the Cloudflare Vitest pool or plain unit tests with the model and storage mocked? | Plain unit tests first; the Cloudflare pool if Durable Object behavior needs it. | M3 |
| TQ5 | How to make the ink look: textures drawn ahead of time, textures generated at load from a fixed seed, or a shader? | Decide in the M4 art pass after a small test. | M4 |
