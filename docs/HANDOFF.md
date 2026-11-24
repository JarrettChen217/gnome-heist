AI-use disclosure: Claude (Claude Code) and Codex maintain this handoff under Hao's direction; each snapshot is written from repository and session evidence.

# Gnome Heist handoff

Keep this file short: replace the snapshot each time, and update only your own row in Active work. Durable detail belongs in commits, PRs, and the docs.

## Snapshot (2026-11-22, local morning checkpoint)

- T10 shares morning preparation and commit across the browser and Worker. The model receives a field-by-field farmer context. The validator checks ownership, budget, permitted slots, entry safe zones and the final open route when a plan adds a barrier.
- The Worker keeps session state in a Durable Object. Identical in-flight retries return pending, and one result commits per morning. A forced provider timeout uses the rule farmer. The two-night client defaults to local rules and can opt in to the Worker with `?farmer=agent`.
- Strict typecheck, 212 tests and the client and Worker dry-run builds passed. Chrome ran both nights in default rule mode, with the Worker rule farmer, and after an interrupted request. The southwest lamp and the taken gnome carried into night two.
- T11b used one confirmed Anthropic Sonnet 5.5 request from the local Worker on an empty-trace fixture. It accepted and committed a no-action plan in 2,997 ms. An identical retry returned the stored result without another model call. Provider usage was 2,715 input and 50 output tokens, estimated at USD 0.00593. The first attempt failed in Workerd before sending because of its redirect option. The adapter now rejects redirects without following them. See the [local checkpoint steps](../game/README.md#local-worker-checkpoint).

## Active work

| Task | Owner | Branch | Files | Status |
| --- | --- | --- | --- | --- |
| G1 recording and post | Hao | — | outside repo | Not started; Hao records, uploads unlisted, posts |
| Build-plan docs | Claude, for Hao | `docs/build-plan-phaser-core` | `docs/`, `CLAUDE.md`, `README.md`, `spike/README.md` | Both review rounds applied; merged into `main` 2026-11-13 |
| Moved-padlock clarification | Codex, for Hao | `docs/build-plan-phaser-core` | `docs/gdd.md`, `docs/configuration.md`, `docs/HANDOFF.md` | Authorized clarification applied over `4a183cb`; committed and merged 2026-11-13; no game tests or model calls run |
| M0 skeleton and Worker skeleton (T7, T11a) | Claude, for Hao | `feat/m0-skeleton` | `core/`, `game/`, `worker/`, `maps/`, `.github/`, root config, `docs/architecture.md`, `docs/project-plan.md` | Built, checked locally, reviewed; awaiting Hao: deploy, push/PR, acceptance |
| M0 review fixes and local development decision | Codex, for Hao | `feat/m0-skeleton` | `core/`, `game/`, `worker/`, `vitest.config.ts`, `docs/architecture.md`, `docs/project-plan.md`, `docs/HANDOFF.md` | Fixes pushed at `f6af482`; 111 tests, strict typecheck and build passed; independent review found no material issues. Hao chose local development first and deferred cloud hosting. |
| T8 night rules | Claude, for Hao | `feat/t8-night-rules` | `core/`, `game/`, `maps/`, `worker/src/session.ts`, `docs/project-plan.md`, `game/README.md` | Built, tested and reviewed locally; awaiting Hao on the open rule questions, then push/PR |
| First playable art pass | Codex, for Hao | `codex/night-farm-art-v1` | `game/`, `maps/`, credits | Gardener look approved; redesigned farm and cover ready for playtest |
| Local morning checkpoint (T10, T11b, T11c) | Codex, for Hao | `codex/night-farm-art-v1` | `core/`, `game/`, `worker/`, docs | Implementation and checks are in the working tree. Live coverage is one quiet night. No service deployed |

## Before posting (Hao)

1. Make this repository public, or the staff links return 404.
2. Set the Slides deck to "anyone with the link can view".
3. Upload the recording as unlisted; open every link in a private window.

## Open items

- GDD Q10 (watch in the first playtest): with no safe-route guarantee, can danger cover every gnome for several nights so the player is stuck? Q9 was decided on 2026-11-13 (only an open route of at most 1 stamina is guaranteed, checked on barrier plans).
- C7: the Vertex adapter and credential setup are pending. Secondary failover has mock coverage. The implemented Anthropic path falls back to the rule farmer on error.
- C9: the first local live smoke is recorded above. Multi-scenario latency and the model-versus-rule comparison remain open. Course acceptance of a local checkpoint recording also remains unverified.
- Questions for the instructor (silent-playtester assignment, reply date, points, repository) are drafted in Hao's OneDrive G1 plan, section 5.
- **For Hao (T8 rule details, coded as provisional):** (1) starting padlocks: the map marks 2 gates padlocked, GDD 5.7 [Proposed] says 1 padlock and 1 lamp; code follows the map (`core/src/world.ts` `initialLayout`), no starting lamp; (2) carry one gnome at a time: with 5 nights and a 5-gnome win, any lost night makes the session unwinnable; (3) hold E 1 s for every action; picking a padlock opens the gate, re-locking closes and locks it; a kick breaks one fence tile; (4) traces appear only on the night they happen (broken fence, open lock, empty pedestal), and re-locking his open padlock is a `gate` trace; (5) the new `count` on footprint traces reaches the farmer's context (record in Configuration A2/A3 if accepted); (6) range edges inclusive, a bush covers itself, sight through an exact corner is not blocked, `loadFarm` also rejects a gate inside a safe zone; (7) the player picks the entry hole; facing breaks ties; a corner assist slides into one-tile gaps; (8) walk speed 4 tiles/s and box half-extent 0.3; greybox layout (bush moved into the window line) not yet approved as v1. After the answers, copy the boundary values into GDD 5.11.

## Next action

Use the [local checkpoint steps](../game/README.md#local-worker-checkpoint) for the November 23 demo. Run the [two-night observation script](two-night-playtest.md) with a fresh player and capture what they infer from the morning and why they pick their second route.
