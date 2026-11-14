AI-use disclosure: Claude (Claude Code) and Codex maintain this handoff under Hao's direction; each snapshot is written from repository and session evidence. Claude wrote the T8 snapshot below.

# Gnome Heist handoff

Keep this file short: replace the snapshot each time, and update only your own row in Active work. Durable detail belongs in commits, PRs, and the docs.

## Snapshot (2026-11-13, Claude, T8 night rules)

- **Stage:** G1 Concept. Post due Sun Nov 15, 11:59 p.m. America/New_York (CourseWorks). Braintrust replies Nov 18 (CourseWorks) or Nov 19 (G1 page); the sources disagree.
- **Hao's standing decision:** local development first (`npm run dev`); cloud hosting, deployed-URL checks and GitHub Pages are deferred and not counted as done. No real model calls, no paid plan changes; push, PR, merge and deploy need his explicit OK.
- **T8 (night rules):** on branch `feat/t8-night-rules`, cut from `feat/m0-skeleton` at `fffd3fe` (includes all M0 commits). Commits `edb914b` (rules, tests, client) and `81ce93e` (review fixes), then this handoff. Local only: not pushed, no PR.
- **Implemented in `core/`:** gates (hold E), padlocks (pick, re-lock, self-lock refusal), fence gaps, digging and carrying a gnome, stamina with refusals, footprints, window/lamp/dog danger, spotting (night ends, carried gnome returns), `endNight` with traces and changes; GDD 5.11 route, open-route, distance and sight functions; `loadFarm` rejects slots in a safe zone, a window line not at a wall, and no open route at the start. Client: entry choice (keys 1-3), prompts with hold progress and red refusals, stamina pips, object states, danger on the ground, footprints, fog from the core sight rule, end-of-night trace panel.
- **Verified locally at `81ce93e`:** `npm run typecheck`, `npm test` (169 passing: core rules in Node, client text, Worker in workerd), `npm run build`. Mutation checks at `edb914b`: exclusive range edges, no self-lock check, no gnome return on spotting, no E-release latch, no corner assist each fail a test. Chrome on the local dev server at `edb914b` (synthetic held keys through Phaser): a full night from `hole_west` taking `ped_sw`; a night spotted by the window carrying `ped_center` (gnome returned, sighting trace); a fence kick, the gap passed with the corner assist, a padlock picked, then a red "No stamina left". After `81ce93e` only an HTTP 200 check; the review fixes were not replayed in the browser.
- **Reviewed:** `gnome-reviewer` (read-only) found no blocker; fixes for its medium/low code findings are in `81ce93e`. Its design findings are open items below.
- **Not verified:** CI (no PR), self-lock refusal and lamps/dog in the browser (unit tests only; the starting layout has no lamp or dog), cloud deployment (deferred).
- **Docs:** project plan T8 status; `game/README.md` controls. GDD 5.11 boundary values are not copied back yet: they wait for Hao's answers.
- **G1 deck:** unchanged this session.

## Active work

| Task | Owner | Branch | Files | Status |
| --- | --- | --- | --- | --- |
| G1 recording and post | Hao | — | outside repo | Not started; Hao records, uploads unlisted, posts |
| Build-plan docs | Claude, for Hao | `docs/build-plan-phaser-core` | `docs/`, `CLAUDE.md`, `README.md`, `spike/README.md` | Both review rounds applied; merged into `main` 2026-11-13 |
| Moved-padlock clarification | Codex, for Hao | `docs/build-plan-phaser-core` | `docs/gdd.md`, `docs/configuration.md`, `docs/HANDOFF.md` | Authorized clarification applied over `4a183cb`; committed and merged 2026-11-13; no game tests or model calls run |
| M0 skeleton and Worker skeleton (T7, T11a) | Claude, for Hao | `feat/m0-skeleton` | `core/`, `game/`, `worker/`, `maps/`, `.github/`, root config, `docs/architecture.md`, `docs/project-plan.md` | Built, checked locally, reviewed; awaiting Hao: deploy, push/PR, acceptance |
| M0 review fixes and local development decision | Codex, for Hao | `feat/m0-skeleton` | `core/`, `game/`, `worker/`, `vitest.config.ts`, `docs/architecture.md`, `docs/project-plan.md`, `docs/HANDOFF.md` | Fixes pushed at `f6af482`; 111 tests, strict typecheck and build passed; independent review found no material issues. Hao chose local development first and deferred cloud hosting. |
| T8 night rules | Claude, for Hao | `feat/t8-night-rules` | `core/`, `game/`, `maps/`, `worker/src/session.ts`, `docs/project-plan.md`, `game/README.md` | Built, tested and reviewed locally; awaiting Hao on the open rule questions, then push/PR |

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

Hao answers the T8 questions above; apply any changes, copy the agreed values into GDD 5.11, and record the trace `count` in the Configuration Document. Then, with his OK, push `feat/m0-skeleton` and `feat/t8-night-rules` and open PRs so CI runs. Next build task: T10 (rule farmer, validator, end-of-night order, morning), then T9.
