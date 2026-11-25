AI-use disclosure: Claude (Claude Code) and Codex maintain this handoff under Hao's direction. Each snapshot is written from repository and session evidence.

# Gnome Heist handoff

Keep this file short: replace the snapshot each time, and update only your own row in Active work. Durable detail belongs in commits, PRs, and the docs.

## Snapshot (2026-11-24, Codex, T20 local prototype)

- Local main includes the two-night prototype in PR 5 at `31bb69b`. On local branch `codex/onboarding-backlog`, T20 adds a scroll at each entrance and a pixel map that remembers the player's route across both nights. Build `1b40f6f` passed strict typecheck, both builds and all eight Chrome regressions, including theft, banking and a second-night entry. The unit and Worker suite passed 212 tests during this work block.
- Chrome screenshots covered 390, 740 and 1152 px. Independent review found overlapping legend labels. The reviewer verified the correction at 390 px on `1b40f6f`. First-time player observation is still pending.
- Morning modes and local verification steps are in the [game README](../game/README.md#local-worker-checkpoint). D1 keeps the build local until delivery. D2 authorized 20 paid calls for the checkpoint and C9 step 2, subject to the recorded USD 20 limit. Previous handoff recorded one live quiet-night call. T20 used local rules.
- The Nov 23 model checkpoint outcome remains unrecorded. The next course date is the Nov 28 G2/G3 recording and post. T20 is tracked in [Asana](https://app.asana.com/1/1219142319278837/project/1220727551768593/task/1220885325664194).

## Active work

| Task | Owner | Branch | Files | Status |
| --- | --- | --- | --- | --- |
| G1 recording and post | Hao | — | outside repo | Posted; accepted by Hao 2026-11-19 |
| Asana setup and PR links (T6) | Claude, for Hao | `docs/asana-setup` → merged | `docs/asana.md`, `docs/project-plan.md`, `.github/` | Merged in PR 2 (`f3691e5`) on 2026-11-20 after a `gnome-reviewer` pass; PPP not yet posted |
| M0, T8, art pass, two-night slice and morning checkpoint (T7, T11a, T8, T17, T18, T10, T11b, T11c) | Claude and Codex, for Hao | `codex/night-farm-art-v1` (PR 5) | `core/`, `game/`, `worker/`, `maps/`, docs | Checked locally; merged in PR 5; not deployed |
| Playwright smoke suite and engine note | Claude, for Hao | `codex/night-farm-art-v1` (PR 5) | `e2e/`, `playwright.config.ts`, `README.md`, `docs/architecture.md` | 4 tests pass locally; reviewed by `gnome-reviewer`, nothing blocking; not run in CI |
| First-night orientation (T20) | Codex, for Hao | `codex/onboarding-backlog` | `game/src/scenes/`, `e2e/orientation.spec.ts`, playtest plan | Verified locally at `1b40f6f`; T14 pending |

## Open items

- **D3, the T8 rule details** (due 11-25; T15 depends on it), still open on the board:
  Coded as provisional: (1) starting padlocks: the map marks 2 gates padlocked, GDD 5.7 [Proposed] says 1 padlock and 1 lamp; code follows the map (`core/src/world.ts` `initialLayout`), no starting lamp; (2) carry one gnome at a time: with 5 nights and a 5-gnome win, any lost night makes the session unwinnable; (3) hold E 1 s for every action; picking a padlock opens the gate, re-locking closes and locks it; a kick breaks one fence tile; (4) traces appear only on the night they happen (broken fence, open lock, empty pedestal), and re-locking his open padlock is a `gate` trace; (5) the new `count` on footprint traces reaches the farmer's context (record in Configuration A2/A3 if accepted); (6) range edges inclusive, a bush covers itself, sight through an exact corner is not blocked, `loadFarm` also rejects a gate inside a safe zone; (7) the player picks the entry hole; facing breaks ties; a corner assist slides into one-tile gaps; (8) walk speed 4 tiles/s and box half-extent 0.3; greybox layout (bush moved into the window line) not yet approved as v1. After the answers, copy the boundary values into GDD 5.11.
- GDD Q10 (watch in the first playtest): with no safe-route guarantee, can danger cover every gnome for several nights so the player is stuck?
- C7: the Vertex adapter and credential setup are pending. Secondary failover has mock coverage, including the M0-review case of a schema-invalid fast primary; the implemented Anthropic path falls back to the rule farmer on error.
- C9: multi-scenario latency and the model-versus-rule comparison remain open; each paid run needs Hao's OK.
- **T2:** the plan says Done, but it is not yet ticked in Asana.
- **Workflows:** both Asana workflows target Node 20; GitHub runs them on Node 24 with a warning.
- Questions for the instructor (silent-playtester assignment, reply date, points, repository) are drafted in Hao's OneDrive G1 plan, section 5.

## Next action

Run [T14](https://app.asana.com/1/1219142319278837/project/1220727551768593/task/1220727682763412) on the local T20 build with a first-time player using the [two-night observation script](two-night-playtest.md). Record their first destination, whether they get a gnome home unaided, and their reason for their second route. Use that evidence when selecting the [doghouse encounter](https://github.com/JarrettChen217/gnome-heist/issues/7) or the [second layout](https://github.com/JarrettChen217/gnome-heist/issues/8).
