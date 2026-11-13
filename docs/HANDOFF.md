AI-use disclosure: Claude (Claude Code) maintains this handoff under Hao's direction; each snapshot is written from repository and session evidence.

# Gnome Heist handoff

Keep this file short: replace the snapshot each time, and update only your own row in Active work. Durable detail belongs in commits, PRs, and the docs.

## Snapshot (2026-11-13, Claude)

- **Stage:** G1 Concept. Post due Sun Nov 15, 11:59 p.m. America/New_York (CourseWorks G1 discussion). Two Braintrust replies due Nov 18, 11:59 p.m. (CourseWorks) or Nov 19 (G1 page); the sources disagree.
- **Docs:** GDD and Configuration Document v0.2 (the farmer, dog-hole entries, gate and fence costs, stamina-and-money budget), systems diagram, Project Plan and Risk Register. `main` at `077d236` before this handoff commit.
- **Deck:** Google Slides "Gnome Heist - G1 Concept Pitch" (Hao's Drive), 13 slides, updated to v0.2 wording; PDF copy and recording script v2 in Hao's OneDrive G1 folder.
- **Measurements:** 26 model/thinking configurations on 2026-11-12 with the earlier two-move contract. Default Claude Sonnet 5.5 thinking off (p95 2.69 s, about $0.023 per game); secondary Gemini 3.5 Flash-Lite low. The budget contract is not measured yet (Configuration Document C9).
- **Code:** none yet. The concept demo (Phaser 3 + TypeScript in `game/`) is the next task; its prompt is in Hao's OneDrive G1 folder (`原型Prompt_Phaser概念演示.md`).

## Active work

| Task | Owner | Branch | Files | Status |
| --- | --- | --- | --- | --- |
| G1 recording and post | Hao | — | outside repo | Not started; Hao records, uploads unlisted, posts |
| Concept demo (T7 seed) | Demo session (Claude) | `prototype/g1-demo` | `game/` | Not started |

## Before posting (Hao)

1. Make this repository public, or the staff links return 404.
2. Set the Slides deck to "anyone with the link can view".
3. Upload the recording as unlisted; open every link in a private window.

## Open items

- C7: Vertex from the Worker needs a service account; until then failover goes straight to the rule-based farmer.
- C9: re-measure with the budget contract before T13.
- Questions for the instructor (silent-playtester assignment, reply date, points, repository) are drafted in Hao's OneDrive G1 plan, section 5.

## Next action

Start the concept demo on `prototype/g1-demo` (run `gnome-resume` first).
