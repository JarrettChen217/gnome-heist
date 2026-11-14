AI-use disclosure: Claude (Claude Code) maintains this handoff under Hao's direction; Codex recorded the authorized moved-padlock clarification. Each snapshot is written from repository and session evidence.

# Gnome Heist handoff

Keep this file short: replace the snapshot each time, and update only your own row in Active work. Durable detail belongs in commits, PRs, and the docs.

## Snapshot (2026-11-13, Claude, M0)

- **Stage:** G1 Concept. Post due Sun Nov 15, 11:59 p.m. America/New_York (CourseWorks). Braintrust replies Nov 18 (CourseWorks) or Nov 19 (G1 page); the sources disagree.
- **M0 (T7, T11a):** built on branch `feat/m0-skeleton` (commits `4c04c54`, `b6f2ffd`, then this handoff); not pushed, no PR. Node 24.22.3 installed with nvm with Hao's OK (default Node stays 18). Exact versions: Phaser 4.2.1, Vite 8.3.8, TypeScript 7.0.2, Vitest 4.1.12, Wrangler 4.162.0, `@cloudflare/vitest-plugin` 1.8.2 (the requested `vitest-pool-workers` is deprecated; the plugin is its new name and what the technical plan named).
- **Verified locally at `b6f2ffd`:** `npm ci`, `npm run typecheck`, `npm test` (104 tests: core in Node, worker in workerd), `npm run build` (Vite + `wrangler deploy --dry-run`). Mutation checks: removing the cut-off or sharing one Durable Object makes the worker tests fail. In Chrome via `wrangler dev` (at `4c04c54`): Phaser 4.2.1 on WebGL, no console errors; every Section 7 engine check passed, so no switch to 3.90.0 (details in Technical plan Section 7). The client's boot log of the map version (added in `b6f2ffd`) was not re-checked in the browser.
- **Reviewed:** `gnome-reviewer` (read-only) found no blocker; low findings fixed in `b6f2ffd`.
- **Not verified:** deploy (preview and deployed URL), CI on GitHub. Both need Hao: deploy needs his OK and `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in `.env`; CI runs once the branch is pushed and a PR opened.
- **G1 deck:** Google Slides "Gnome Heist - G1 Concept Pitch" (13 slides) and recording script v2 in Hao's OneDrive G1 folder; unchanged this session. A greybox clip for the recording is now possible from `npm run dev`.
- **Docs:** Technical plan Section 7 now records versions and engine-check results; README points to `game/README.md`. GDD and Configuration Document unchanged.

## Active work

| Task | Owner | Branch | Files | Status |
| --- | --- | --- | --- | --- |
| G1 recording and post | Hao | — | outside repo | Not started; Hao records, uploads unlisted, posts |
| Build-plan docs | Claude, for Hao | `docs/build-plan-phaser-core` | `docs/`, `CLAUDE.md`, `README.md`, `spike/README.md` | Both review rounds applied; merged into `main` 2026-11-13 |
| Moved-padlock clarification | Codex, for Hao | `docs/build-plan-phaser-core` | `docs/gdd.md`, `docs/configuration.md`, `docs/HANDOFF.md` | Authorized clarification applied over `4a183cb`; committed and merged 2026-11-13; no game tests or model calls run |
| M0 skeleton and Worker skeleton (T7, T11a) | Claude, for Hao | `feat/m0-skeleton` | `core/`, `game/`, `worker/`, `maps/`, `.github/`, root config, `docs/architecture.md`, `docs/project-plan.md` | Built, checked locally, reviewed; awaiting Hao: deploy, push/PR, acceptance |

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

Hao decides on M0: deploy (with the Cloudflare token in `.env`), push `feat/m0-skeleton` and open a PR so CI runs, then accept or not. After that, T8 (night rules) on a new branch.
