AI-use disclosure: Claude (Claude Code) drafted this technical plan from my decisions and its own proposals, revised after an independent review by another coding agent (Codex); every item is labeled with who decided it.

# Gnome Heist: Technical plan

| | |
| --- | --- |
| Gate | G1 Concept (Initial version) |
| Version | 0.2, 2026-11-13 (after the build-plan review) |
| Accountable owner | Hao, as Tech Lead, with Creative Director approval |
| Companion documents | [GDD](gdd.md) · [Configuration Document](configuration.md) · [Systems diagram](systems-diagram.md) · [Project Plan](project-plan.md) |

**Status.** Planned. No code exists yet. Labels follow the GDD: **[Hao]**, **[Hao, on agent proposal]**, **[Proposed]**, **[Open]**.

## 1. Decisions

| Decision | Origin |
| --- | --- |
| Build the real game from the start. No scripted mock-up demo: the G1 pitch uses the deck, plus a short clip of the real greybox build only if one is playable by then. | Hao, on agent proposal, 2026-11-13 |
| Browser game in **TypeScript + Phaser 4.2.1**. If the M0 checks (Section 7) find a blocker, drop to Phaser 3.90.0 during M0. | Hao, on agent proposal, 2026-11-13 |
| All game rules live in one **engine-free TypeScript package, `core/`**, used unchanged by the Phaser client, the Worker, and the tests. | Hao, on agent proposal, 2026-11-13 |
| Farm maps are authored in the **Tiled** map editor, in a fixed subset of Tiled JSON (Section 5). | Hao, on agent proposal, 2026-11-13 |
| The farmer runs in a **Cloudflare Worker** with one Durable Object per play session, calling models through the Vercel AI SDK (Configuration Document A6). The client is served as static assets by the same Worker, on the same origin as the API. | Hao, on agent proposal, 2026-11-12 and 2026-11-13 |
| The morning protocol, the end-of-night order, and the offline rule (Section 4). | Hao, on agent proposal, 2026-11-13 |

## 2. Why Phaser and TypeScript

The game is a small tile-based 2D stealth game that must be playable from a link (playtests, staff review) and must call a model from a server. The deciding factor is that the same rules run in two places: the client judges the night (stamina, gates, footprints, spotting), and the Worker judges the farmer's plan (budget, safe zones, reachability). In one language, both use one implementation and one test suite.

| Criterion | Phaser + TypeScript | Godot 4 | Unity |
| --- | --- | --- | --- |
| Rules shared with the Worker | Same code, same tests | Possible through `JavaScriptBridge` in web builds, with a bridge and packaging boundary to maintain; otherwise written twice | Written twice (C# and TypeScript) |
| Play from a link | Small static build | Web export works, larger download, threading options to configure | Heavy WebGL build, slow iteration |
| Changes made and reviewed by coding agents | Plain code, readable diffs | Scenes are text files; workable | Editor-bound assets; hard to review |
| 2D lighting and fog | Written by us; tile-based ranges are enough here | Built in | Built in |
| Map editing | Loads Tiled maps natively | Built-in editor | Built-in editor |

Also considered: **Excalibur.js** (TypeScript with an official Tiled plugin; a credible alternative with no blocking gap found, but no reason to switch); **PixiJS** (mainly a renderer and scene graph: tilemaps, cameras, and game structure would be ours to assemble); **Pygame** (web export is not mature). For this schedule, Godot's built-in lighting does not outweigh the bridge, because lamp and dog ranges are whole tiles.

Because rules live in `core/`, the engine choice is reversible: replacing Phaser means rewriting `game/` only.

## 3. Repository layout [Hao, on agent proposal]

```
gnome-heist/
  core/     engine-free rules: map model, session and night state, timers, stamina, detection,
            traces, player view, farmer context, plan validator, open-route check, rule-based farmer
  game/     Phaser client: scenes, rendering, input, camera, HUD, audio; calls core/
  worker/   Cloudflare Worker + Durable Object: morning endpoint, model call, failover, logging,
            static assets for game/; calls core/
  maps/     Tiled maps (.tmj) and tilesets
  docs/     design and planning documents
  spike/    model measurements (Python, uv)
```

One npm workspace. **Dependency rule:** `core/` imports nothing from Phaser, the DOM, the network, or the clock; time arrives as an explicit `dt`, and randomness comes from a seeded generator passed in. `game/` and `worker/` depend on `core/`, never on each other. [Hao, on agent proposal]

## 4. The `core/` contract [Hao, on agent proposal]

The function names are placeholders; the transitions and boundaries are the point. Every rule transition is in `core/`: Phaser only turns key presses into inputs and interpolates drawing, and the Worker only stores state and calls models.

### 4.1 Transitions

| Transition | Input → output |
| --- | --- |
| `loadFarm(tiledJson)` | Tiled JSON → validated `FarmDef` with a map version hash. Rejects maps that break the GDD (a slot inside a safe zone, no open route at the start, duplicate ids, unsupported Tiled features). |
| `newSession(farm, seed)` | → `SessionState`: night 1, player and farmer budgets, the farmer's starting layout, empty memory. |
| `startNight(session)` | → `NightState`: player at a dog hole, stamina refilled, fog memory carried over. |
| `tick(night, input, dt)` | → new night state + events. Owns legal movement and collision, hold-E timers, stamina spending, the red prompt, the self-lock check, footprints, and detection. |
| `endNight(night)` | → `NightResult`: the trace list (GDD 5.6) plus the final state of every changed gate, padlock, fence, and pedestal, the gnome taken, and a strike if spotted. |
| `resolveNight(session, nightResult)` | Applies the end-of-night order (Section 4.3) → new session state, and either a terminal result or a morning to run. |
| `buildFarmerContext(session)` | → `FarmerContext` (Section 4.2). |
| `validatePlan(context, plan)` | → accepted plan, or the list of violated rules (Configuration Document A7). Simulates the plan with the same function that commits it. |
| `ruleFarmer(context)` | → plan: the deterministic baseline and fallback (A9). Its output also goes through `validatePlan`. |
| `commitPlan(session, acceptedPlan)` | → new layout, budget, and memory. Accepts only a validated plan. |
| `projectPlayerView(session, night)` | → `PlayerView` (Section 4.4). |

### 4.2 The farmer's knowledge boundary

`buildFarmerContext` builds a **new object from an explicit allowlist** of fields: today's traces, his own layout, his stamina and money, the static farm slots, and his memory. It never spreads or forwards a larger object. Memory summaries are built only from earlier filtered trace lists and committed plans. A TypeScript type annotation alone does not enforce this, because extra fields survive structural typing.

Tests check the **serialized request body that would be sent to the model**: two sessions whose permitted inputs are equal but whose hidden state differs (player path, position, stamina, strikes, fog memory, action log) must produce byte-identical request bodies. This guarantees that hidden data is not sent. It cannot stop the model from inferring a route from footprints, or saying something wrong in its line; those stay in the evaluation (Configuration Document A8).

### 4.3 State ownership, the morning protocol, and the end-of-night order

- **Ownership.** The client owns the night; the game is single-player, so the trace list from the client is trusted. The Durable Object owns the farmer's side: layout, budget, memory, revision number, and the morning log. The client also keeps its own action log for replay and debugging.
- **End-of-night order** (inside `resolveNight`): end the night → if spotted, the carried gnome returns to its pedestal and a strike is recorded → merge the night's final changes (gates, padlocks, fences, pedestals) into the farm → check for the end of the session (last gnome taken, third strike, or night 5 over) → only if the session continues, refill the farmer's budget and start a morning. A finished session runs no morning and calls no model.
- **Morning request.** The client sends `POST /session/{id}/morning` with `morningId`, `expectedRevision`, `mapVersion`, and the `NightResult`. The Durable Object:
  1. returns the stored result unchanged if this `morningId` was already committed (a retried request never charges, refills, or calls twice);
  2. rejects a request whose `expectedRevision` or `mapVersion` does not match;
  3. allows **one pending morning per session**. A repeated request with the same `morningId` and the same body while that morning is pending gets "pending" back and starts no second model call; a request with the same `morningId` but a different body, or a different `morningId` for the same revision, is rejected. The pending record is written before any model call (a Durable Object can interleave other requests while it awaits an outside `fetch()`) and keeps the original deadline, so a retry never resets it. If the Worker is interrupted, an alarm at the deadline commits the rule-based plan, so a morning never stays pending;
  4. runs the failover rule (A6), validates, and commits exactly once, only if the revision is still the expected one; then returns the plan, the new layout, and the new revision.
- **Offline rule.** If the client gets no answer in time (network timeout about 6 s, above the Worker's 4 s budget), it runs `ruleFarmer` from `core/` locally and **switches the rest of this session to local rule mode**: later online responses for the session are ignored, and the log records the mode change. Reconciling a local morning back into the Durable Object is out of scope for v1.
- **End of session.** When a session ends online, the client sends a finish notice (no model call) and the Durable Object deletes the session's memory. Sessions that never send one (closed tab, offline mode) are deleted by a Durable Object alarm 24 hours after their last request.

### 4.4 The player's view

`projectPlayerView` gives the client everything it may draw: tiles in current sight show the real state; explored tiles outside sight show the last-seen snapshot, with defenses tagged by the night they were seen; unexplored tiles are hidden. The danger overlay (lit tiles, the window's sight line, the dog's radius), interaction prompts, and the full-map view are all drawn from this projection, so a moved lamp's light does not give the move away. Detection still uses the real state. Tests cover a defense that was moved, added, or removed while out of sight. The goal is that the normal UI follows GDD 5.3; hiding state from someone reading memory in DevTools is not.

## 5. Maps in Tiled [Hao, on agent proposal]

Supported subset; `loadFarm` rejects anything else:

- Orthogonal orientation, finite map, uncompressed tile arrays, embedded tilesets; every object aligned to whole tiles.
- Fixed layer names. Tile layers: `ground` (property `kind`: `soft`, `stone`, or `blocked`), `decoration`. Object layers: `dogHoles`, `pedestals`, `gates` (`padlocked` true or false), `fences`, `lampPosts`, `doghouseSpots`, `bushes`, `windowSight`, and `areas` (named footprint areas, which the farmer's trace list and the schema use as ids).
- Every object has a unique, stable string `id` property; coordinates convert to tiles one way, in one shared function.
- The Worker imports the map JSON at build time, not from a file system at run time. The client and the Worker both log the map version hash, and a morning request with the wrong hash is rejected.
- Phaser renders the tile layers; `core/loadFarm` reads the same file for the rules.
- Tiled is GPL-licensed as an editor; the map files are my own work. Recorded in `CREDITS.md` at M0.

## 6. Client, deployment, tests [Hao, on agent proposal]

- **Scenes:** `Boot` (load), `Night` (play), `Morning` (the farmer's sequence, GDD 5.8), `Hud` (stamina, strikes, night). Angled top-down view; each character and object sets its depth from the y of its feet (tile layers do not interleave with sprites on their own, so tall objects are sprites). Camera follows the player.
- **Fog and danger overlays** are drawn per tile from `PlayerView` (a tile layer or simple rectangles), without masks or render textures, which keeps them away from the parts of Phaser 4 that changed most.
- **Art:** greybox first. The hand-drawn ink look (GDD 2) comes in the M4 art pass, mainly as textures drawn ahead of time, with optional seeded decorative noise. No custom shader on the critical path. The art pass replaces visuals only; collision, sight, and map semantics do not change.
- **Deployment:** one Worker serves the client's static assets and the API on the same origin; the code stays in separate `game/` and `worker/` packages. Keys only in Worker secrets.
- **Tests:** plain Vitest for `core/` (one test per rule row in GDD 5.2, 5.4, 5.6, 5.7 and 5.11; validator fixtures; the open-route and self-lock checks; the knowledge-boundary test; the end-of-night order; `PlayerView`). Worker tests run in the Workers runtime through Cloudflare's Vitest integration (`@cloudflare/vitest-plugin`) from the first Durable Object onward, with the model mocked: duplicate `morningId`, stale revision, two sessions, injected timeout, late result.
- **CI:** GitHub Actions runs `tsc` in strict mode, tests, and build on every PR.

## 7. Versions and Phaser 4 notes [Hao, on agent proposal]

Every dependency is pinned to an exact version at M0; nothing is left at `latest`.

| Tool | Version | Note |
| --- | --- | --- |
| Phaser | **4.2.1** (2026-07-09) | Release candidates from 2025-04, stable since 4.0.0 (2026-04-10), then 4.1.0 and 4.2.0. Fallback: 3.90.0 (2025-05-23), the last 3.x. |
| Node | **24 LTS**, exact version in `.nvmrc` | Current Wrangler needs Node ≥ 22.12; Vite 8 needs ^20.19 or ≥ 22.12. The same version locally, in CI, and for deploys. Installing it on the development Mac needs Hao's OK. |
| Vite | 8.x, exact version at M0 | — |
| Wrangler, TypeScript, Vitest, `@cloudflare/vitest-plugin`, `ai` and its provider packages | exact compatible versions at M0 | For Vertex in a Worker, the edge entry point `@ai-sdk/google-vertex/edge` with credentials from Worker bindings. |

**Phaser 4 for coding agents.** Most examples online are Phaser 3. The v3-to-v4 migration guide ([`changelog/v4/4.0/MIGRATION-GUIDE.md`](https://github.com/phaserjs/phaser/blob/v4.2.1/changelog/v4/4.0/MIGRATION-GUIDE.md)) says the standard API (sprites, text, tilemaps, camera scroll and zoom) should work unchanged; the breaking changes are in rendering. Do not use these v3 forms:

- `setMask` with a `BitmapMask` (removed; masks are Filters now), FX such as Bloom or Shine, custom pipelines, `setPipeline('Light2D')` (now `setLighting(true)`);
- `setTintFill` (now `setTint(c).setTintMode(Phaser.TintModes.FILL)`);
- `Phaser.Geom.Point` (now `Phaser.Math.Vector2`); `Phaser.Structs.Set` (no longer exported);
- `scene.textures.generate` and `Phaser.Create.GenerateTexture` (removed; draw greybox textures with Graphics and `generateTexture`, or load image files);
- `Phaser.Math.TAU` meaning π/2 (in v4 it is 2π; `tsc` will not catch this);
- relying on `roundPixels` being on: the game default is now off, and `camera.startFollow(target)` without its second argument also sets the camera's `roundPixels` to false, so pass it explicitly.

Project choices (not engine requirements): use native `Map` and `Set` rather than `Phaser.Structs.Map`, which 4.2.1 still exports; use embedded tilesets only, since the 4.2.1 Tiled parser does not load external tileset files; keep characters and tall objects in one display list so depth by feet y sorts them together; if a custom font is used, wait until it has loaded before creating text.

`tsc` catches most removed APIs. **M0 acceptance for the engine:** the greybox farm loads from a real `.tmj` file in the Tiled subset (image paths and custom properties included); a per-tile fog overlay and a last-seen snapshot draw correctly and stay aligned with the map while the camera moves; a sprite passes behind and in front of a tall object by y; the camera follows; HUD text renders, updates, and stays fixed on screen; after a window resize, all of these are checked again. A blocker in any of these during M0 means switching to 3.90.0 then, while it is cheap.

## 8. Milestones [Hao, on agent proposal]

Each milestone ends in something playable or testable. Target dates are my own, not course deadlines; task IDs are in the [Project Plan](project-plan.md).

| Milestone | Contents | Tasks | Target |
| --- | --- | --- | --- |
| M0 Skeleton | Workspace, Node pinned, `core/` types and transitions stubbed (the Worker's `ruleFarmer` is a placeholder that returns a fixed valid plan until T10), Tiled subset and a greybox farm, Phaser 4 boots and passes the engine checks (Section 7), CI, and a **walking skeleton** of the Worker: deployed, one Durable Object per session, the morning endpoint answering with `ruleFarmer`, two isolated sessions, an injected timeout falling back | T7, T11a | Nov 16 to 17 |
| M1 Night | All night rules in `core/` with tests and in the client: dog holes and safe zones, gates, padlocks and the self-lock check, fences, gnomes, stamina and red prompt, dangers on the ground, spotting, end night, `NightResult`; a self-playtest replaces the paper test | T8, T4 | Nov 18 |
| M3a First real call | The first model call from the deployed Worker with the final schema (a few paid calls, run only with Hao's OK) | T11b | Nov 19 |
| M2 Full game on the rule-based farmer | Fog with "last seen" and `PlayerView`, the morning sequence with its opening beat, the budget, five nights, strikes, win and loss | T9, T10, T12a | Nov 21 |
| M3 Checkpoint | The three checkpoint items work end to end: deployed model call, isolated session state, forced-timeout fallback; morning protocol tests pass; small re-measurement with the budget contract (C9, step 2). Nov 22 is buffer. | T11c | Nov 21 (checkpoint Nov 23) |
| M4 Agent mode and polish | A full session in agent mode; the live evaluation and the first external playtest; then the ink art pass, farmer lines, sound cues, morning staging | T12b, T13, T14 | Nov 25 to 28 |

If a milestone slips, the first things to stop are fine ink art, an elaborate morning walk, shaders, and offline reconciliation; the morning stays as plain, readable feedback. Gameplay cuts follow GDD Section 13. Art cuts do not unblock the Worker, so the Worker skeleton is built first, in M0.

## 9. Technical questions

| ID | Question | Answer |
| --- | --- | --- |
| TQ1 | Phaser 4.2.1 or 3.90.0? | 4.2.1, with the M0 engine checks and the fallback in Section 7. [Hao, on agent proposal, 2026-11-13] |
| TQ2 | Should the Durable Object recompute the trace list from a night action log? | No: trust the client's `NightResult`, with revisions, de-duplication, and the offline rule (Section 4.3). The client's action log stays for replay. [Hao, on agent proposal] |
| TQ3 | Cloudflare Pages or Worker static assets? | Worker static assets, same origin as the API. [Hao, on agent proposal] |
| TQ4 | Worker test tooling? | Plain Vitest for `core/`; Cloudflare's Vitest integration for the Worker and Durable Object from the start. [Hao, on agent proposal] |
| TQ5 | How to make the ink look? | Textures drawn ahead of time, optional seeded noise, no shader on the critical path; decided in detail in the M4 art pass. [Hao, on agent proposal] |
