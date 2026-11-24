AI-use disclosure: Claude (Claude Code) and Codex maintain this handoff under Hao's direction. Each snapshot is written from repository and session evidence.

# Gnome Heist handoff

Keep this file short: replace the snapshot each time, and update only your own row in Active work. Durable detail belongs in commits, PRs, and the docs.

## Snapshot (2026-11-24, Claude, PR 5 opened and `main` merged in)

- **PR 5 is open** ([#5](https://github.com/JarrettChen217/gnome-heist/pull/5), `codex/night-farm-art-v1` → `main`). It carries all game code so far: M0 (T7, T11a), T8 night rules, the T17 art pass, the T18 two-night slice and the local morning checkpoint (T10, T11b, T11c), plus a local Playwright smoke suite and the Codex agent setup. `main` (T6 Asana docs, PRs 2 to 4) was merged into the branch on 2026-11-24 and the `HANDOFF.md` / `project-plan.md` conflicts were resolved. Awaiting Hao's review and merge.
- **Morning checkpoint (Codex, 2026-11-22).** T10 shares morning preparation and commit across the browser and Worker. The model receives a field-by-field farmer context. The validator checks ownership, budget, permitted slots, entry safe zones and the final open route when a plan adds a barrier. The Worker keeps session state in a Durable Object; identical in-flight retries return pending, and one result commits per morning. A forced provider timeout uses the rule farmer. The two-night client defaults to local rules and can opt in to the Worker with `?farmer=agent`.
- **Evidence.** Strict typecheck, 212 tests and the client and Worker dry-run builds passed. Chrome ran both nights in default rule mode, with the Worker rule farmer, and after an interrupted request; the southwest lamp and the taken gnome carried into night two. T11b used one confirmed Anthropic Sonnet 5.5 request from the local Worker on an empty-trace fixture: a no-action plan committed in 2,997 ms; an identical retry returned the stored result without another call; 2,715 input and 50 output tokens, estimated USD 0.00593. See the [local checkpoint steps](../game/README.md#local-worker-checkpoint).
- **Playwright (Claude, 2026-11-24).** Four Chromium smoke tests in `e2e/` (`npm run test:e2e`) passed locally, 12 of 12 with `--repeat-each=3`; they never call a paid model. CI typechecks them but does not run them. README also records why the game stays on Phaser rather than Godot.
- **Decisions in force.** D1 [Hao, 2026-11-20]: nothing is deployed before delivery; the Worker runs only on Hao's machine. D2 [Hao, 2026-11-20]: 20 paid model calls for T11b and C9 step 2 from the local Worker; the Nov 22 authorization covers the official Anthropic API up to USD 20 ([Project Plan](project-plan.md)). One call used so far.
- **Course dates.** The model checkpoint was Mon Nov 23; whether the course accepts a local demo for "deployed model call" is not confirmed, and the demo outcome is not recorded here. G2/G3 recording and post: Sat Nov 28 (see `COURSE_UPDATES.md` in the parent folder for the time).
- **Asana is live** ([project](https://app.asana.com/1/1219142319278837/project/1220727551768593); setup in [asana.md](asana.md)). PR ↔ Asana links work through a `## Asana` section in the PR body; PR 5's body has none yet, so it is not attached to any card.

## Active work

| Task | Owner | Branch | Files | Status |
| --- | --- | --- | --- | --- |
| G1 recording and post | Hao | — | outside repo | Posted; accepted by Hao 2026-11-19 |
| Asana setup and PR links (T6) | Claude, for Hao | `docs/asana-setup` → merged | `docs/asana.md`, `docs/project-plan.md`, `.github/` | Merged in PR 2 (`f3691e5`) on 2026-11-20 after a `gnome-reviewer` pass; PPP not yet posted |
| M0, T8, art pass, two-night slice and morning checkpoint (T7, T11a, T8, T17, T18, T10, T11b, T11c) | Claude and Codex, for Hao | `codex/night-farm-art-v1` (PR 5) | `core/`, `game/`, `worker/`, `maps/`, docs | Checked locally; not deployed; PR 5 awaiting Hao |
| Playwright smoke suite and engine note | Claude, for Hao | `codex/night-farm-art-v1` (PR 5) | `e2e/`, `playwright.config.ts`, `README.md`, `docs/architecture.md` | 4 tests pass locally; reviewed by `gnome-reviewer`, nothing blocking; not run in CI |

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

Hao reviews PR 5 (add the T-card URLs under `## Asana` in its body if it should attach to the cards), then merges. Then run the [two-night observation script](two-night-playtest.md) with a fresh player for the Nov 28 G2/G3 evidence, and update the Asana Evidence fields for T7 to T11c.
