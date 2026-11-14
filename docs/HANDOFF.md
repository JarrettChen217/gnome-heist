AI-use disclosure: Claude (Claude Code) maintains this handoff under Hao's direction; each snapshot is written from repository and session evidence.

# Gnome Heist handoff

Keep this file short: replace the snapshot each time, and update only your own row in Active work. Durable detail belongs in commits, PRs, and the docs.

## Snapshot (2026-11-13, Claude)

- **Stage:** G1 Concept. Post due Sun Nov 15, 11:59 p.m. America/New_York (CourseWorks G1 discussion). Two Braintrust replies due Nov 18, 11:59 p.m. (CourseWorks) or Nov 19 (G1 page); the sources disagree.
- **Build plan:** decided 2026-11-13 and revised after an outside review (Codex) the same day. Phaser 4.2.1 (fallback 3.90.0 during M0), engine-free `core/` shared by client, Worker and tests, Tiled subset, one Worker serving client and API, morning protocol with `morningId` and revision, one-deadline failover, Node 24. Rules added in GDD v0.3: self-lock check, morning opening beat, end-of-night order, rule parameters (5.11).
- **Docs:** GDD v0.3, Configuration Document v0.3, Technical plan v0.2, Project Plan v0.3 (T11 and T12 split; T4 folded into M1), systems diagram. All on branch `docs/build-plan-phaser-core`, pushed, **not merged** into `main` (`af257a0`). A second Codex review found nothing blocking M0; its small fixes are applied on the branch.
- **Deck:** Google Slides "Gnome Heist - G1 Concept Pitch", 13 slides; engine label updated to Phaser 4. Recording script v2 in Hao's OneDrive G1 folder; the G1 recording uses the deck only, plus a greybox clip if one exists in time.
- **Measurements:** 26 configurations on 2026-11-12 with the earlier two-move contract; a provisional default only. Re-measurement in three steps (C9), each paid run with Hao's OK.
- **Code:** none yet. M0 needs Node 24 installed (this Mac has 18 and 20); installing needs Hao's OK.

## Active work

| Task | Owner | Branch | Files | Status |
| --- | --- | --- | --- | --- |
| G1 recording and post | Hao | — | outside repo | Not started; Hao records, uploads unlisted, posts |
| Build-plan docs | Claude, for Hao | `docs/build-plan-phaser-core` | `docs/`, `CLAUDE.md`, `README.md`, `spike/README.md` | Both review rounds applied; Hao holds the merge for now |
| M0 skeleton and Worker skeleton (T7, T11a) | Not assigned | — | `core/`, `game/`, `worker/`, `maps/` | Not started; after the merge |

## Before posting (Hao)

1. Make this repository public, or the staff links return 404.
2. Set the Slides deck to "anyone with the link can view".
3. Upload the recording as unlisted; open every link in a private window.

## Open items

- GDD Q9 (open, decide before T10): what the never-seal rule requires when the player's own theft leaves no safe route.
- C7: Vertex from the Worker needs a service account; until then failover goes straight to the rule-based farmer.
- C9: re-measure in three steps (Nov 19, Nov 21, before T13); each paid run needs Hao's OK.
- Asana: create the project after the G1 decision (T6, about Nov 18), from `docs/project-plan.md`, with Hao's OK for each write.
- Questions for the instructor (silent-playtester assignment, reply date, points, repository) are drafted in Hao's OneDrive G1 plan, section 5.

## Next action

Hao decides when to merge `docs/build-plan-phaser-core` into `main` (both review rounds are applied). Then M0 starts on its own branch: run `gnome-resume`, install Node 24 with Hao's OK, and build T7 and T11a.
