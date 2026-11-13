AI-use disclosure: Claude (Claude Code) drafted this plan and risk register from the syllabus dates and my decisions; I set the priorities and approve every change.

# Gnome Heist: Initial Project Plan and Risk Register

| | |
| --- | --- |
| Gate | G1 Concept (Initial version) |
| Version | 0.1, 2026-11-12 |
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

Owner is always me (accountable). "Delegated to" names the production agent role from the [Configuration Document](configuration.md), Part B.

| ID | Task | GDF role | Delegated to | Acceptance criteria | Depends on | Target date | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | Create repository with Initial GDD, Configuration Document, plan, diagram | Producer | Producer, Design Lead | Docs in repo; open questions marked; linked from the G1 post | — | Nov 15 | In progress |
| T2 | Measure model latency and tokens (20 calls, realistic input) | Tech Lead | Tech Lead | p50/p95 latency, tokens, and cost per session recorded with price source; budgets filled in | Model access (C2) | Nov 13 | Done 2026-11-12 ([results](../spike/README.md)) |
| T3 | G1 deck and recording | Creative Director | Producer (draft deck and script) | 3 to 5 minutes; all 11 items shown; unlisted link works signed out | T1, T2 | Nov 15 | Not started |
| T4 | Paper test: one night and one morning, with me playing the farmer by the rule and by judgment | Design Lead | Design Lead (test sheet) | One session noted: what the player did, where they hesitated, what changed | T1 | Nov 19 | Not started |
| T5 | Production agent team v1: repo `AGENTS.md`, `gnome-reviewer` subagent, one skill | Tech Lead | Tech Lead | Reviewer runs on one real PR; skill used once, with evidence in the PR | T1 | Nov 19 | Not started |
| T6 | Move this plan into Asana after the G1 decision | Producer | Producer (draft) | Tasks with owner, role, acceptance criteria, dependencies; PPP posted | G1 decision | Nov 18 | Not started |
| T7 | Game skeleton: Phaser project, greybox farm, movement, collision, deployed preview | Tech Lead | Tech Lead | Preview URL loads in a fresh browser; CI runs on PR | T5 | Nov 19 | Not started |
| T8 | Night rules: soft ground, footprints, gates, pedestals, stamina, lit/sight/dog zones, spotting, end night | Tech Lead | Tech Lead, QA | Deterministic tests for each rule pass in CI | T7 | Nov 21 | Not started |
| T9 | Fog of war with "last seen" | Tech Lead | Tech Lead, QA | Stale defenses shown faded with night tag; test that moved defenses stay stale until seen | T7 | Nov 21 | Not started |
| T10 | Trace extractor, rule-based farmer, budget validator, morning sequence | Tech Lead | Tech Lead, Narrative | Same input gives same plan; budget, safe-zone and reachability tests; one full night and morning playable | T8 | Nov 22 | Not started |
| T11 | Worker: deployed model call, one Durable Object per session, validator, forced-timeout fallback, logging | Tech Lead | Tech Lead, QA | Checkpoint demo: live call, two sessions with separate memory, injected timeout falls back | T2, T10 | Nov 23 | Not started |
| T12 | Five-night session, win and loss, agent/rule switch, session log export | Tech Lead | Tech Lead | A full session plays end to end in each mode | T11 | Nov 25 | Not started |
| T13 | Budgeted live evaluation, agent vs rule on recorded trace sequences | QA, BI | QA, BI | Table: invalid rate, fallback rate, latency, cost, agent-equals-rule rate, with N and spending | T12 | Nov 26 | Not started |
| T14 | External playtest with one player; Initial Playtest Log | Design Lead, QA, BI | Design Lead (consent script, sheet) | Consent recorded; observations before interpretation; one finding linked to a change or question | T12 | Nov 27 | Not started |
| T15 | Update GDD and Configuration Document; scope-lock plan; updated Risk Register | Producer, Design Lead, Tech Lead | All roles (drafts) | Labels updated to implemented/verified; exclusions and fallback triggers stated | T13, T14 | Nov 28 | Not started |
| T16 | G2/G3 recording and deck | Creative Director | Producer (draft) | 3 to 5 minutes; shows build, evidence, decisions | T15 | Nov 28 | Not started |

Internal checkpoint: by **Nov 22**, one night and one morning are playable with the rule-based farmer. If not, I apply the cut list in GDD Section 13 before building T11.

## 3. Initial Risk Register

Risk Profile ratings (G1, proposed by my agent and accepted by me on 2026-11-12): IP / Concept Medium; Business / Audience Medium; Technology **High**; Team Medium; Genre / Mechanics **High**; Timeline **High**. The three High ratings share one cause: no playable night-and-morning loop exists yet. A working loop by Nov 22 would lower all three.

| Risk | Evidence or trigger | Impact and likelihood | Responsible role | Mitigation | Contingency | Status and next check |
| --- | --- | --- | --- | --- | --- | --- |
| R1. If the model call is slow, unavailable, or often invalid by Nov 23, the morning feels broken and the checkpoint fails. | Measurement; injected-timeout test | High impact, low likelihood: Sonnet 5.5 off p95 2.69 s and Flash-Lite low p95 1.73 s on Nov 12, but only from a laptop; Gemini Pro, 3.8 Flash and Gemini 4 exceeded the budget | Tech Lead | 4 s timeout behind the animation; validator; rule fallback | Play whole sessions on the rule-based farmer while fixing; ask instructor about another provider | Open; re-measure from the Worker Nov 23 |
| R2. If players cannot tell the agent farmer from the rule-based farmer by the first playtest, the agent hypothesis fails. | Paper test (T4); playtest (T14); agent-equals-rule rate (T13). Evidence from the earlier two-move contract: in the 26-configuration sweep, Opus 5.5 matched the rule 18 to 20 of 20, Sonnet 5.5 off 0 of 20 but with little variety; to be re-measured with the budget contract (C9). | High impact, high likelihood | Design Lead | Memory across nights; morning shows inspected traces; seed recorded trace sequences where the rule is exploitable | Narrow the agent to one job the rule cannot do (spotting fake trails), or cut memory and report the negative result | Open; check Nov 19 |
| R3. If the rules (fog, the farmer's budget, stamina) do not produce interesting choices, the core loop is dull with either farmer. | Paper test; first greybox | High impact, medium likelihood | Design Lead | Paper test before code; few interactables, added slowly | Adjust numbers; drop money and keep a 2-stamina budget (cut 3) | Open; check Nov 19 |
| R4. If one night and one morning are not playable by Nov 22, G2/G3 on Nov 28 has no evidence. | Internal checkpoint Nov 22 | High impact, medium likelihood: 3 weeks to Gold | Producer | Greybox art only; strict cut list; tasks ordered by dependency | Apply cuts 1 and 2 immediately; record the change and its reason | Open; check Nov 22 |
| R5. If the farmer's line reveals information he should not have, the fairness pillar breaks. | Human-labeled sample of lines (T13) | Medium impact, medium likelihood | QA | Prompt rule; length limit; no raw world state in input | Scripted lines only, keep the agent's plan | Open; check Nov 26 |
