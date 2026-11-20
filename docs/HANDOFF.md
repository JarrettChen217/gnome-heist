AI-use disclosure: Claude (Claude Code) and Codex maintain this handoff under Hao's direction. Each snapshot is written from repository and session evidence.

# Gnome Heist handoff

Keep this file short: replace the snapshot each time, and update only your own row in Active work. Durable detail belongs in commits, PRs, and the docs.

## Snapshot (2026-11-20, Claude, after merging PR 2; D1/D2 decided)

- **Course stage:** G1 is posted. Hao treats it as approved for planning: no instructor decision was found in the Canvas digests, and it reopens if a Hold appears.
  - Next course dates: the model checkpoint on Mon Nov 23, whose course wording asks for a deployed model call, isolated session state and a forced-timeout fallback. The G2/G3 recording is on Sat Nov 28 (time not published).
- **Local only until delivery [Hao, 2026-11-20, D1].**
  - Nothing is deployed before delivery, and there is no `npm run deploy`. The Worker runs only on Hao's machine (`npm run dev`), because deployment puts Hao's money at risk.
  - The checkpoint demo will be local. Whether the course accepts a local demo for "deployed model call" is not confirmed.
  - D2: 20 paid model calls are approved for T11b and C9 step 2, all from the local Worker, with no dollar cap stated. More calls need a new approval.
- **Asana is live.** Project: [Gnome Heist — COMS E6998 Final](https://app.asana.com/1/1219142319278837/project/1220727551768593).
  - Contents: 37 cards (13 shared `[FINAL …]` course milestones and 24 new: T1–T18, D1–D3), 34 dependencies, and the Evidence and Date type fields.
  - Hao's 2026-11-19 decisions are applied: T1, T3 and the G1 cards are complete; T4 is replaced by the two-night observation; internal targets are re-dated to a strict chain from T7 (11-19) to T16 (11-27), and the Gantt view shows no conflicts.
  - Setup, gid map and maintenance rules: [asana.md](asana.md).
  - The midterm project was renamed "COMS E6998 Midterm — Tank Trouble Reconstruction".
- **PR ↔ Asana links are active.** Hao added `ASANA_SECRET` on 2026-11-20.
  - PR 2 is attached to T6, and the merge posted "GitHub PR #2: merged …" on T6. Both were confirmed by the Action logs and the Asana read-back.
  - A task URL in the `## Asana` section of the PR body (`.github/pull_request_template.md`) attaches the PR.
- **`main` is at `f3691e5`:** the docs, the Asana guide, and the PR-link workflows. It has no game code yet.
- **Game code lives only on unmerged branches:**
  - `feat/m0-skeleton`: T7 and T11a, checked locally, not deployed; `origin` is behind by `fffd3fe`.
  - `feat/t8-night-rules`: T8, checked and reviewed locally, not pushed.
  - `codex/night-farm-art-v1`: T17 art pass committed. The T18 two-night slice (morning, gate reach, pause menu, `docs/two-night-playtest.md`) is **uncommitted** in that branch's working tree, along with a newer `docs/HANDOFF.md` that Codex is editing.

## Active work

| Task | Owner | Branch | Files | Status |
| --- | --- | --- | --- | --- |
| G1 recording and post | Hao | — | outside repo | Posted; accepted by Hao 2026-11-19 |
| Asana setup and PR links (T6) | Claude, for Hao | `docs/asana-setup` → merged | `docs/asana.md`, `docs/project-plan.md`, `.github/` | Merged in PR 2 (`f3691e5`) on 2026-11-20 after a `gnome-reviewer` pass; PPP not yet posted |
| M0 skeleton and Worker skeleton (T7, T11a) | Claude and Codex, for Hao | `feat/m0-skeleton` | `core/`, `game/`, `worker/`, `maps/` | Checked locally; not deployed; no PR |
| T8 night rules | Claude, for Hao | `feat/t8-night-rules` | `core/`, `game/`, `maps/` | Reviewed locally; awaiting D3 rule answers; not pushed |
| Art pass and two-night slice (T17, T18) | Codex, for Hao | `codex/night-farm-art-v1` | `game/`, `maps/`, `core/`, `docs/` | T17 committed; T18 uncommitted working-tree changes |

## Open items

- **Decision still open on the board:** D3, the eight T8 rule details (due 11-25; T15 depends on it). D1 and D2 were decided on 2026-11-20 (see the Snapshot).
- **T2:** the plan says Done, but it is not yet ticked in Asana.
- **HANDOFF conflict:** the uncommitted `docs/HANDOFF.md` on `codex/night-farm-art-v1` started from the 11-13 version. Merge it with this snapshot when that work is committed.
- **Workflows:** both Asana workflows target Node 20; GitHub runs them on Node 24 with a warning.
- **Still open from before:**
  - GDD Q10 (watch in the first playtest).
  - C7: the Vertex service account.
  - C9 re-measurement, where each paid run needs Hao's OK.
  - From the M0 review: a schema-invalid fast primary must fail over to the secondary (A6), and a duplicate in-flight `morningId` needs the pending record (T11c).

## Next action

Follow the Asana chain toward the Nov 23 checkpoint, all on Hao's machine: T8 and T11a (11-20), then T10 and T11b (11-21; the first real model call from the local Worker, within the 20 approved calls), then T11c (11-22). When a session changes evidence, it updates the card's Evidence field and links its PR under `## Asana`.
