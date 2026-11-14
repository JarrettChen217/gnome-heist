AI-use disclosure: Claude (Claude Code) and Codex maintain this handoff under Hao's direction. Codex recorded the M0 review fixes and verification below from repository and session evidence.

# Gnome Heist handoff

Keep this file short: replace the snapshot each time, and update only your own row in Active work. Durable detail belongs in commits, PRs, and the docs.

## Snapshot (2026-11-13, Codex, local development decision)

- **Stage:** G1 Concept. Post due Sun Nov 15, 11:59 p.m. America/New_York (CourseWorks). Braintrust replies Nov 18 (CourseWorks) or Nov 19 (G1 page); the sources disagree.
- **Hao's decision:** use local `npm run dev` first and discuss cloud hosting later. Keep the local Worker; cloud deployment and deployed-URL checks are deferred and do not block local gameplay work. No GitHub Pages deployment is selected.
- **Local launch checked:** `npm run dev` built the client and started Wrangler with local asset and Durable Object bindings at `http://127.0.0.1:8787`; an HTTP check returned 200. Browser behavior was not rechecked. This documentation-only update did not rerun the test suite.
- **Git:** M0 commits `4c04c54`, `b6f2ffd`, `d62c884` and review fixes `f6af482` were pushed to `origin/feat/m0-skeleton` at Hao's request. Worktree was clean before this documentation update. No PR, deployment, or real model call was made in this conversation.
- **Review fixes after `d62c884`:** skip model calls when the absolute cut-off is exhausted; reject late promise results even if the timer has not fired; draw every cell of rectangular fences; reject map and tileset tiles other than 16 x 16 pixels. Client placement tests now run in Node and are included in strict typechecking. No GDD rules or dependency versions changed.
- **Fresh local verification of the fix tree:** `npm run typecheck`, `npm test` (111 passing tests: core and client placement in Node, Worker in workerd), `npm run build` (Vite + Wrangler dry-run), and `git diff --check` passed. All 7 new regression cases failed against the old behavior before the fixes. Independent read-only reviewer found no blocker or material regression.
- **Earlier evidence:** `npm ci` passed at `b6f2ffd`; Chrome engine checks passed at `4c04c54` (Technical plan Section 7). Browser rendering was not rechecked in this fix session, including the new boot log and widened-fence rendering. Node remains pinned at 24.22.3; the default Node remains 18.
- **Still unverified:** deployed preview/API (now deferred), browser recheck of the fixes, and GitHub CI. The current workflow requires a PR or manual trigger; pushing alone does not run it. Original syllabus requirements must be checked before treating a local demo as sufficient for the course checkpoint.
- **G1 deck:** Google Slides "Gnome Heist - G1 Concept Pitch" (13 slides) and recording script v2 in Hao's OneDrive G1 folder; unchanged this session. A greybox clip for the recording is now possible from `npm run dev`.
- **Docs:** architecture and project plan now record local development first and defer the earlier internal cloud targets. GDD and Configuration Document unchanged.

## Active work

| Task | Owner | Branch | Files | Status |
| --- | --- | --- | --- | --- |
| G1 recording and post | Hao | — | outside repo | Not started; Hao records, uploads unlisted, posts |
| Build-plan docs | Claude, for Hao | `docs/build-plan-phaser-core` | `docs/`, `CLAUDE.md`, `README.md`, `spike/README.md` | Both review rounds applied; merged into `main` 2026-11-13 |
| Moved-padlock clarification | Codex, for Hao | `docs/build-plan-phaser-core` | `docs/gdd.md`, `docs/configuration.md`, `docs/HANDOFF.md` | Authorized clarification applied over `4a183cb`; committed and merged 2026-11-13; no game tests or model calls run |
| M0 skeleton and Worker skeleton (T7, T11a) | Claude, for Hao | `feat/m0-skeleton` | `core/`, `game/`, `worker/`, `maps/`, `.github/`, root config, `docs/architecture.md`, `docs/project-plan.md` | Built, checked locally, reviewed; awaiting Hao: deploy, push/PR, acceptance |
| M0 review fixes and local development decision | Codex, for Hao | `feat/m0-skeleton` | `core/`, `game/`, `worker/`, `vitest.config.ts`, `docs/architecture.md`, `docs/project-plan.md`, `docs/HANDOFF.md` | Fixes pushed at `f6af482`; 111 tests, strict typecheck and build passed; independent review found no material issues. Hao chose local development first and deferred cloud hosting. |

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
- M0 stubs T8 must replace: gates and fences are always solid (only the SW beds are walkable from the west hole); walk speed 4 tiles/s, player box half-extent 0.3, first dog hole as start are provisional constants.
- For Hao: are the 2 padlocked gates in the map fixed fixtures or the farmer's starting layout (GDD 5.7 [Proposed] says he starts with 1 padlock)? The greybox layout itself is agent-made and not yet approved as v1.

## Next action

Use `npm run dev` for local development. Next implementation is T8 (night rules) on a new branch, followed by T10 (rule farmer and morning loop); decide the initial padlock layout before implementing the affected rules. Cloud deployment is deferred until Hao revisits it. PR/CI remains a separate pending step, not authorization to deploy.
