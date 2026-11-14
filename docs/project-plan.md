AI-use disclosure: Claude (Claude Code) drafted this plan and risk register from the syllabus dates and my decisions; I set the priorities and approve every change.

# Gnome Heist: Initial Project Plan and Risk Register

| | |
| --- | --- |
| Gate | G1 Concept (Initial version) |
| Version | 0.3, 2026-11-13 (after the build-plan review: Worker skeleton in M0, split T11 and T12, paper test folded into M1) |
| Accountable owner | Hao, as Producer |
| Moves to | Asana after the G1 decision (owners, acceptance criteria, dependencies, and the full Risk Register follow at G2/G3) |

Dates are America/New_York. **Course dates** come from the syllabus and the G1 discussion. **Target dates** are my own internal targets, not course deadlines.

## 1. Gate and milestone dates (course dates)

| Gate / milestone | Date | What is due | Source |
| --- | --- | --- | --- |
| G1 Concept post | Sun Nov 15, 11:59 p.m. | Recording, deck, Initial GDD and Configuration Document, Initial Project Plan | G1 discussion |
| G1 review in class | Mon Nov 16 | Live pitches (6 to 8 students) or review from recording | G1 discussion |
| G1 decision | by Tue Nov 17 | Approve or Hold, posted as a comment on my post | G1 discussion |
| Two Braintrust replies | Nov 18, 11:59 p.m. (CourseWorks checkpoint) or Thu Nov 19 (G1 page and syllabus) | Two replies to classmates' G1 posts | Sources disagree; I will reply by Nov 18 |
| Checkpoint | Mon Nov 23 | Deployed model call, isolated session state, forced-timeout fallback, in class or by recording | Syllabus |
| G2 Prototype + G3 Production recording | Sat Nov 28 (time not published) | First playable with one external playtest; Initial Playtest Log; scope-lock plan; Update GDD and Configuration Document; updated Risk Register | Syllabus |
| G2/G3 review | Mon Nov 30 | Combined review; three Braintrust responses before class | Syllabus |
| Alpha | Wed Dec 2 | All agreed features integrated | Syllabus |
| Beta | Fri Dec 4 | Content locked | Syllabus |
| Gold recording | Sat Dec 5 (time not published) | Gold build recording; external release playtest after Alpha and before this | Syllabus |
| G4 Final / Pre-Launch | Mon Dec 7 | Final GDD and Configuration Document; harness; Gold build; Update Playtest Log | Syllabus |
| G5 Retrospective / Closure | Mon Dec 14 | Final game and AAR; Playtest Log | Syllabus |
| Finals | Dec 17 to 23 (slot not yet assigned) | Retrospective, 8 to 10 minute walkthrough, live presentation | Syllabus |

## 2. First tasks through G2

Owner is always me (accountable). "Delegated to" names the production agent role from the [Configuration Document](configuration.md), Part B. Milestone names (M0 to M4) refer to the [Technical plan](architecture.md), Section 8. On 2026-11-13 I dropped the scripted mock-up demo and moved the build forward, so T7 to T12 start right after the G1 post.

| ID | Task | GDF role | Delegated to | Acceptance criteria | Depends on | Target date | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | Create repository with Initial GDD, Configuration Document, plan, diagram | Producer | Producer, Design Lead | Docs in repo; open questions marked; linked from the G1 post | — | Nov 15 | In progress |
| T2 | Measure model latency and tokens (20 calls, realistic input) | Tech Lead | Tech Lead | p50/p95 latency, tokens, and cost per session recorded with price source; budgets filled in | Model access (C2) | Nov 13 | Done 2026-11-12 ([results](../spike/README.md)) |
| T3 | G1 deck and recording | Creative Director | Producer (draft deck and script) | 3 to 5 minutes; all 11 items shown; unlisted link works signed out. Recorded from the deck; a 15 to 20 s clip of the real greybox build is added only if it is playable in time, labeled as an early build | T1, T2 | Nov 15 | Deck done; recording not started |
| T4 | Self-playtest of the M1 greybox night, with me playing the farmer's morning by the rule and by judgment (replaces the paper test) | Design Lead | Design Lead (test sheet) | One session noted: what I did, where I hesitated, what changed | T8 | Nov 18 | Not started |
| T5 | Production agent team v1: repo `CLAUDE.md`, `gnome-reviewer` subagent, `gnome-resume` and `gnome-handoff` skills | Tech Lead | Tech Lead | Reviewer runs on one real PR; skill used once, with evidence in the PR | T1 | Nov 19 | Files created 2026-11-13; not yet used |
| T6 | Move this plan into Asana after the G1 decision | Producer | Producer (draft) | Tasks with owner, role, acceptance criteria, dependencies; PPP posted | G1 decision | Nov 18 | Not started |
| T7 | M0 skeleton: npm workspace (`core/`, `game/`, `worker/`, `maps/`), Node 24 pinned, exact dependency versions, `core/` types and transitions stubbed, greybox farm in the Tiled subset, Phaser 4.2.1 draws it with movement and collision | Tech Lead | Tech Lead | Engine checks in Technical plan Section 7 pass (else switch to 3.90.0); preview URL loads in a fresh browser; CI runs strict `tsc`, tests and build on PR; `core/` imports no Phaser, DOM, network or clock | T1 | Nov 16 to 17 | Built on `feat/m0-skeleton`, checked locally (2026-11-13); preview URL and GitHub CI not yet verified |
| T8 | M1 night rules in `core/`, wired into the client: dog holes and safe zones, soft ground and footprints, gates, padlocks and the self-lock check, fences, pedestals, stamina and red prompt, lit/sight/dog zones, spotting, end night, `NightResult` | Tech Lead | Tech Lead, QA | Deterministic tests for each rule row in GDD 5.2, 5.4, 5.6 and 5.11 pass in CI; one night playable in the preview | T7 | Nov 18 | In progress on `feat/t8-night-rules` (2026-11-13): rules, tests and client wiring done locally; awaiting review and Hao's answers on open rule details |
| T9 | M2 fog of war with "last seen" through `PlayerView` | Tech Lead | Tech Lead, QA | Stale defenses shown faded with night tag; danger overlay and prompts drawn from the projection; tests for a defense moved, added, or removed out of sight | T8 | Nov 20 | Not started |
| T10 | M2 rule-based farmer, plan validator, allowlisted farmer context, end-of-night order, morning sequence with its opening beat (all rules in `core/`) | Tech Lead | Tech Lead, Narrative | Same input gives same plan; budget, safe-zone and reachability tests; request-body knowledge-boundary test; one full night and morning playable | T8 | Nov 21 | Not started |
| T11a | M0 Worker skeleton: deployed Worker serving the client, one Durable Object per session, `POST /session/{id}/morning` answering with a placeholder `ruleFarmer` (a fixed valid plan; the real one comes in T10), two isolated sessions, injected timeout falls back | Tech Lead | Tech Lead, QA | Deployed URL answers; Workers-runtime tests for two sessions and the injected timeout pass | T7 workspace and build (M0 is accepted for T7 and T11a together) | Nov 17 | Built on `feat/m0-skeleton`, Workers-runtime tests pass locally (2026-11-13); not deployed |
| T11b | M3a first deployed model call with the final schema (C9 step 1; paid, only with my OK) | Tech Lead | Tech Lead | A logged call from the deployed Worker returns a schema-valid plan | T11a | Nov 19 | Not started |
| T11c | M3 checkpoint: morning protocol (`morningId`, revision, map version, pending record), one-deadline failover, client offline rule, logging; small re-measurement (C9 step 2) | Tech Lead | Tech Lead, QA | Checkpoint demo: live call, two sessions with separate memory, injected timeout falls back; protocol tests pass | T10, T11b | Nov 21 (Nov 22 buffer) | Not started |
| T12a | M2 five-night session in rule mode, win and loss, session log export | Tech Lead | Tech Lead | A full session plays end to end on the rule-based farmer | T9, T10 | Nov 21 | Not started |
| T12b | M4 five-night session in agent mode, agent/rule switch | Tech Lead | Tech Lead | A full session plays end to end on the model farmer, and the switch works | T11c, T12a | Nov 25 | Not started |
| T13 | Budgeted live evaluation, agent vs rule on recorded trace sequences (C9 step 3) | QA, BI | QA, BI | Table: invalid rate, fallback rate, latency, cost, agent-equals-rule rate, with N and spending | T12b | Nov 26 | Not started |
| T14 | External playtest with one player; Initial Playtest Log | Design Lead, QA, BI | Design Lead (consent script, sheet) | Consent recorded; observations before interpretation; one finding linked to a change or question | T12b | Nov 27 | Not started |
| T15 | Update GDD and Configuration Document; scope-lock plan; updated Risk Register | Producer, Design Lead, Tech Lead | All roles (drafts) | Labels updated to implemented/verified; exclusions and fallback triggers stated | T13, T14 | Nov 28 | Not started |
| T16 | G2/G3 recording and deck | Creative Director | Producer (draft) | 3 to 5 minutes; shows build, evidence, decisions | T15 | Nov 28 | Not started |

**Sequence update [Hao, 2026-11-13]:** work locally first with `npm run dev`; discuss cloud hosting later. T7/T11a's deployed-URL checks remain unverified and are deferred, rather than a prerequisite for local T8/T10 work. Local previews are sufficient for current development; no GitHub Pages deployment is selected. The earlier internal deployment targets (Nov 17 for T11a and Nov 19 for T11b) are suspended pending that discussion. Course dates above are unchanged; check the original checkpoint requirements before claiming a local-only demo satisfies them. Paid model calls still need separate approval.

## 3. Initial Risk Register

Risk Profile ratings (G1, proposed by my agent and accepted by me on 2026-11-12): IP / Concept Medium; Business / Audience Medium; Technology **High**; Team Medium; Genre / Mechanics **High**; Timeline **High**. The three High ratings share one cause: no playable night-and-morning loop exists yet. A working loop by Nov 22 would lower all three.

| Risk | Evidence or trigger | Impact and likelihood | Responsible role | Mitigation | Contingency | Status and next check |
| --- | --- | --- | --- | --- | --- | --- |
| R1. If the model call is slow, unavailable, or often invalid by Nov 23, the morning feels broken and the checkpoint fails. | Measurement; injected-timeout test | High impact, low likelihood: Sonnet 5.5 off p95 2.69 s and Flash-Lite low p95 1.73 s on Nov 12, but only from a laptop; Gemini Pro, 3.8 Flash and Gemini 4 exceeded the budget | Tech Lead | 4 s timeout behind the animation; validator; rule fallback | Play whole sessions on the rule-based farmer while fixing; ask instructor about another provider | Open; first deployed call Nov 19 (T11b), re-measure Nov 21 (T11c) |
| R2. If players cannot tell the agent farmer from the rule-based farmer by the first playtest, the agent hypothesis fails. | Self-playtest (T4); playtest (T14); agent-equals-rule rate (T13). Evidence from the earlier two-move contract: in the 26-configuration sweep, Opus 5.5 matched the rule 18 to 20 of 20, Sonnet 5.5 off 0 of 20 but with little variety; to be re-measured with the budget contract (C9). | High impact, high likelihood | Design Lead | Memory across nights; morning shows inspected traces; seed recorded trace sequences where the rule is exploitable | Narrow the agent to one job the rule cannot do (spotting fake trails), or cut memory and report the negative result | Open; check Nov 18 |
| R3. If the rules (fog, the farmer's budget, stamina) do not produce interesting choices, the core loop is dull with either farmer. | Self-playtest (T4); first greybox | High impact, medium likelihood | Design Lead | Self-playtest of the first greybox night (T4); few interactables, added slowly | Adjust numbers; drop money and keep a 2-stamina budget (cut 3) | Open; check Nov 18 |
| R4. If one night and one morning are not playable by Nov 22, G2/G3 on Nov 28 has no evidence. | Internal checkpoint Nov 22 | High impact, medium likelihood: 3 weeks to Gold | Producer | Greybox art only; strict cut list; tasks ordered by dependency | Apply cuts 1 and 2 immediately; record the change and its reason | Open; check Nov 22 |
| R5. If the farmer's line reveals information he should not have, the fairness pillar breaks. | Human-labeled sample of lines (T13) | Medium impact, medium likelihood | QA | Prompt rule; length limit; no raw world state in input | Scripted lines only, keep the agent's plan | Open; check Nov 26 |
