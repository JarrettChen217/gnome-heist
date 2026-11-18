AI-use disclosure: Claude (Claude Code) and Codex maintain this handoff under Hao's direction; each snapshot is written from repository and session evidence.

# Gnome Heist handoff

Keep this file short: replace the snapshot each time, and update only your own row in Active work. Durable detail belongs in commits, PRs, and the docs.

## Snapshot (2026-11-18, Codex, gardener revision)

- Hao liked the farm style and asked for a cuter, smaller playable character. The first art checkpoint is at `443eae5` on `codex/night-farm-art-v1`.
- The proposed gardener now wears a sage beret, teal overalls and an apricot scarf. At the existing map scale, visible height is 21–22 pixels across the sheet (previously 27–30). The revised cover depicts the same gardener.
- Independent review checked all 32 distinct frames, the foot baseline and carry poses. The client production build passed. Chrome replayed the standalone HTML through choosing the west entrance, walking, digging the southwest gnome, carrying it to the exit and restarting.
- Next art checkpoint: Hao compares the gardener's expression and size on the farm before any broader art work.

## Active work

| Task | Owner | Branch | Files | Status |
| --- | --- | --- | --- | --- |
| G1 recording and post | Hao | — | outside repo | Not started; Hao records, uploads unlisted, posts |
| Build-plan docs | Claude, for Hao | `docs/build-plan-phaser-core` | `docs/`, `CLAUDE.md`, `README.md`, `spike/README.md` | Both review rounds applied; merged into `main` 2026-11-13 |
| Moved-padlock clarification | Codex, for Hao | `docs/build-plan-phaser-core` | `docs/gdd.md`, `docs/configuration.md`, `docs/HANDOFF.md` | Authorized clarification applied over `4a183cb`; committed and merged 2026-11-13; no game tests or model calls run |
| M0 skeleton and Worker skeleton (T7, T11a) | Claude, for Hao | `feat/m0-skeleton` | `core/`, `game/`, `worker/`, `maps/`, `.github/`, root config, `docs/architecture.md`, `docs/project-plan.md` | Built, checked locally, reviewed; awaiting Hao: deploy, push/PR, acceptance |
| M0 review fixes and local development decision | Codex, for Hao | `feat/m0-skeleton` | `core/`, `game/`, `worker/`, `vitest.config.ts`, `docs/architecture.md`, `docs/project-plan.md`, `docs/HANDOFF.md` | Fixes pushed at `f6af482`; 111 tests, strict typecheck and build passed; independent review found no material issues. Hao chose local development first and deferred cloud hosting. |
| T8 night rules | Claude, for Hao | `feat/t8-night-rules` | `core/`, `game/`, `maps/`, `worker/src/session.ts`, `docs/project-plan.md`, `game/README.md` | Built, tested and reviewed locally; awaiting Hao on the open rule questions, then push/PR |
| First playable art pass | Codex, for Hao | `codex/night-farm-art-v1` | `game/`, `maps/`, credits | Gardener revision ready for Hao’s character and scale review |

## Before posting (Hao)

1. Make this repository public, or the staff links return 404.
2. Set the Slides deck to "anyone with the link can view".
3. Upload the recording as unlisted; open every link in a private window.

## Open items

- GDD Q10 (watch in the first playtest): with no safe-route guarantee, can danger cover every gnome for several nights so the player is stuck? Q9 was decided on 2026-11-13 (only an open route of at most 1 stamina is guaranteed, checked on barrier plans).
- C7: Vertex from the Worker needs a service account; until then failover goes straight to the rule-based farmer.
- C9: re-measure in three steps (Nov 19, Nov 21, before T13); each paid run needs Hao's OK.
- Asana: create the project after the G1 decision (T6, about Nov 18), from `docs/project-plan.md`, with Hao's OK for each write.
- Questions for the instructor (silent-playtester assignment, reply date, points, repository) are drafted in Hao's OneDrive G1 plan, section 5.
- From the M0 review, for T11b/T11c: (1) a fast primary answer that fails the schema must go to the secondary (A6); today every invalid output goes to the rule (`worker/src/failover.ts`); (2) a second request with the same `morningId` while one is in flight calls the model again and gets 409; the pending record (T11c) fixes it (`worker/src/session.ts`).
- **For Hao (T8 rule details, coded as provisional):** (1) starting padlocks: the map marks 2 gates padlocked, GDD 5.7 [Proposed] says 1 padlock and 1 lamp; code follows the map (`core/src/world.ts` `initialLayout`), no starting lamp; (2) carry one gnome at a time: with 5 nights and a 5-gnome win, any lost night makes the session unwinnable; (3) hold E 1 s for every action; picking a padlock opens the gate, re-locking closes and locks it; a kick breaks one fence tile; (4) traces appear only on the night they happen (broken fence, open lock, empty pedestal), and re-locking his open padlock is a `gate` trace; (5) the new `count` on footprint traces reaches the farmer's context (record in Configuration A2/A3 if accepted); (6) range edges inclusive, a bush covers itself, sight through an exact corner is not blocked, `loadFarm` also rejects a gate inside a safe zone; (7) the player picks the entry hole; facing breaks ties; a corner assist slides into one-tile gaps; (8) walk speed 4 tiles/s and box half-extent 0.3; greybox layout (bush moved into the window line) not yet approved as v1. After the answers, copy the boundary values into GDD 5.11.

## Next action

Hao reviews the art sample and chooses whether to continue this visual direction. For the separate T8 work, Hao answers the questions above; apply any changes, copy the agreed values into GDD 5.11, and record the trace `count` in the Configuration Document. Then, with his OK, push `feat/m0-skeleton` and `feat/t8-night-rules` and open PRs so CI runs. Next build task: T10 (rule farmer, validator, end-of-night order, morning), then T9.
