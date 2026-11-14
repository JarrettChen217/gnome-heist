AI-use disclosure: Claude (Claude Code) maintains this handoff under Hao's direction; each snapshot is written from repository and session evidence.

# Gnome Heist handoff

Keep this file short: replace the snapshot each time, and update only your own row in Active work. Durable detail belongs in commits, PRs, and the docs.

## Snapshot (2026-11-13, Claude)

- **Stage:** G1 Concept. Post due Sun Nov 15, 11:59 p.m. America/New_York (CourseWorks G1 discussion). Two Braintrust replies due Nov 18, 11:59 p.m. (CourseWorks) or Nov 19 (G1 page); the sources disagree.
- **Build plan (decided 2026-11-13):** no scripted mock-up demo; build the real game now. Phaser + TypeScript, all rules in an engine-free `core/` package shared by client, Worker, and tests; maps in Tiled; milestones M0 to M4 (`docs/architecture.md`). Phaser version (4.2.1 vs 3.90.0) and four other technical questions are open (TQ1 to TQ5).
- **Docs:** GDD and Configuration Document v0.2, Technical plan v0.1, Project Plan v0.2 (T7 to T12 mapped to milestones), systems diagram. Branch `docs/build-plan-phaser-core` holds the build-plan changes, pushed for an outside review; not merged into `main` (`af257a0`).
- **Deck:** Google Slides "Gnome Heist - G1 Concept Pitch", 13 slides; the references slide still says "Phaser 3" (left until TQ1 is decided). Recording script v2 in Hao's OneDrive G1 folder; the G1 recording uses the deck only, plus a greybox clip if one exists in time.
- **Measurements:** 26 configurations on 2026-11-12 with the earlier two-move contract. Default Claude Sonnet 5.5 thinking off; secondary Gemini 3.5 Flash-Lite low. Budget contract not measured yet (C9).
- **Code:** none yet. M0 needs Node 22.12+ (current Wrangler); this Mac has Node 18 and 20 only.

## Active work

| Task | Owner | Branch | Files | Status |
| --- | --- | --- | --- | --- |
| G1 recording and post | Hao | — | outside repo | Not started; Hao records, uploads unlisted, posts |
| Build-plan review | Outside reviewer (Codex), for Hao | `docs/build-plan-phaser-core` | `docs/` (read-only review) | Waiting for review |
| M0 skeleton (T7) | Not assigned | — | `core/`, `game/`, `worker/`, `maps/` | Not started; after the review |

## Before posting (Hao)

1. Make this repository public, or the staff links return 404.
2. Set the Slides deck to "anyone with the link can view".
3. Upload the recording as unlisted; open every link in a private window.

## Open items

- C7: Vertex from the Worker needs a service account; until then failover goes straight to the rule-based farmer.
- C9: re-measure with the budget contract at M3 (T11), before T13.
- Questions for the instructor (silent-playtester assignment, reply date, points, repository) are drafted in Hao's OneDrive G1 plan, section 5.

## Next action

Hao has the build plan on `docs/build-plan-phaser-core` reviewed (engine choice, `core/` contract, LLM call design, plan and GDD), decides on the findings, and merges. Then M0 starts on its own branch (run `gnome-resume` first).
