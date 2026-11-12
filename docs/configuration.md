AI-use disclosure: Claude (Claude Code) drafted this document from my decisions and its own proposals; I reviewed it and own every boundary decision in it.

# Gnome Heist: Initial Configuration Document

| | |
| --- | --- |
| Gate | G1 Concept (Initial version) |
| Version | 0.1, 2026-11-12 |
| Accountable owner | Hao, as Tech Lead, with Creative Director approval |
| Companion documents | [GDD](gdd.md) · [Systems diagram](systems-diagram.md) · [Project Plan and Risk Register](project-plan.md) |

**Status.** Everything below is **planned**, except the budget measurement: prompt v0 and the output schema were run 20 times on 2026-11-12 ([spike](../spike/README.md)). No game, Worker, test suite, or workflow exists yet. Where a value says *TBD*, the source of the number is named. Labels follow the GDD: **[Hao]**, **[Hao, on agent proposal]**, **[Proposed]**, **[Open]**.

Two kinds of agent appear here and stay separate:

- the **in-game agent**, the neighbor, which sees only a bounded view of one play session; and
- the **production agents**, which help me build the game and may have repository access.

## Part A. In-game agent: the neighbor

### A1. Purpose

Each morning, choose two defense moves and one line of dialogue from the traces the player left, so that the player feels the neighbor is learning their habits. [Hao, on agent proposal]

The agent does one bounded job. The rest of the game (movement, danger, detection, fog, traces, scoring) is deterministic code that works without it.

### A2. World state and what the agent knows

| Information | World state (game engine) | Neighbor agent |
| --- | --- | --- |
| Tile map, hedges, soft ground, lamp posts, kennel spots, gates | Yes | Yes, as named slots (static estate description) |
| His own defense layout and which gates he left open last evening | Yes | Yes |
| Footprints on soft ground after the night | Yes | Yes, as tile clusters per named area |
| Gates whose state differs from how he left them | Yes | Yes |
| Empty pedestals | Yes | Yes |
| Where he saw someone, if the player was spotted | Yes | Yes |
| Summaries of the previous 3 mornings (his traces and his moves) | Yes | Yes (memory) |
| The player's actual path, timing, and position | Yes | **No** |
| The player's stamina, strikes, and remaining nights | Yes | **No** |
| The player's fog and "last seen" memory | Yes | **No** |
| Which footprints the player made on purpose | Not stored (player intent) | **No** |
| Any other session, player, or game | — | **No** |

The **trace extractor** (deterministic code) builds the agent's input from world state at the end of each night. The agent never receives raw world state. [Hao, on agent proposal]

### A3. Tools and actions

The agent calls no tools. It returns one JSON object, constrained by a response schema:

```json
{
  "moves": [
    {"type": "move_lamp", "lamp": "lamp_a", "to": "post_rose_east"},
    {"type": "lock",      "gate": "gate_east"}
  ],
  "line": "Mud on the roses again. Somebody likes the east gate.",
  "inspected": ["area_rosebed_east", "gate_east"]
}
```

Allowed move types (exactly two moves per morning) [Hao, on agent proposal]:

| Type | Arguments | Meaning |
| --- | --- | --- |
| `move_lamp` | lamp id, lamp post id | Move one lamp to another post |
| `move_dog` | kennel spot id | Move the dog |
| `lock` | gate id | Move the lock to this gate (a gate that was locked is unlocked) |
| `hold` | defense id | Leave one defense where it is |

`inspected` lists the trace areas the morning animation walks to. `line` is at most 80 characters.

### A4. Prohibited actions

- Inventing defenses or slots that are not in the estate description.
- More or fewer than two moves; two moves on the same defense.
- Any move set that leaves no unlit, unlocked route from an entry to a remaining gnome (the reachability invariant).
- A `line` that states the player's real path or position, or refers to information outside its input.
- A `line` that is offensive or breaks character.

The validator enforces every item that can be checked mechanically. The last two are evaluated (Section A8).

### A5. Context sources and memory policy

Named context sources, in prompt order:

1. `system`: role, rules, move list, output schema (versioned prompt file).
2. `estate`: static slot names and adjacency (versioned data file).
3. `layout`: current defense positions and gates he left open.
4. `traces_today`: the extractor's trace list.
5. `memory`: up to 3 previous mornings, each as {traces summary, moves made, line}.

Memory policy: the game, not the model, holds memory. Each morning it appends one summary and keeps only the last 3. Memory lives in that session's isolated state and is deleted when the session ends. No player identity is stored. [Hao, on agent proposal]

Retrieval: none planned. The whole context is small enough to send each time.

### A6. Model, settings, prompt

| Setting | Value |
| --- | --- |
| Provider | Gemini via Vertex AI, the course-funded default. [Hao, on agent proposal] |
| Model identifier | `gemini-3.5-flash-lite`, global endpoint (measured 2026-11-12; see [spike results](../spike/README.md)). |
| Temperature | 0.7 in the measured run. Revisit after evaluation: 14 of 20 runs matched the rule-based neighbor (Section A8). [Proposed] |
| Output | JSON with a response schema; max output about 200 tokens. |
| Where it runs | A Cloudflare Worker; one Durable Object per play session holds state. The API credential stays in Worker secrets and never reaches the browser or the repository. |

Draft system instruction (v0, not yet tested):

> You are the neighbor in Gnome Heist. Someone has been stealing your garden gnomes at night. Each morning you see only the traces listed below and your notes from earlier mornings. You never saw the intruder's route. Choose exactly two moves from the allowed list to make tonight harder for them. Some traces may be fake. You may not block every route to your remaining gnomes. Answer only with JSON matching the schema. Your `line` is one short, grumpy, funny sentence about what you noticed, and it must not claim knowledge you do not have.

### A7. Validation, timeout, retry, fallback

| Step | Rule |
| --- | --- |
| Schema | Reject anything that does not parse or match the schema. |
| Legality | Ids exist; exactly two moves; not both on one defense. |
| Reachability | Breadth-first search on the estate graph after applying the moves: at least one entry reaches at least one remaining gnome without lit, dog-alert, or locked tiles. |
| Line | At most 80 characters; word filter. |
| Timeout | 4 s. Measured p95 was 1.56 s and the maximum 2.86 s (first, cold call), so the roughly 3 s morning walk animation hides almost every call. To re-measure from the deployed Worker by Nov 23. |
| Retry | At most 1 retry, only for a timeout or parse failure, and only if time remains. |
| Fallback | The **rule-based neighbor** (Section A9) makes the moves; the line comes from a small set of scripted lines. Same morning sequence; the player is not told. |
| Logging | Each morning logs: input, raw output, validator result, which policy moved (agent or fallback), latency, token counts. |

### A8. Named failure modes and evaluation cases

| Failure mode | Deterministic test (CI, every PR) | Live evaluation (budgeted) |
| --- | --- | --- |
| Illegal or malformed move set | Validator rejects fixtures of each kind; fallback runs | Invalid-output rate per 100 mornings |
| Sealing the estate | Reachability check on crafted "all gnomes coverable" layouts | Count of reachability rejections |
| Timeout or provider error | Injected delay larger than the timeout gives fallback, and the morning still completes | Share of mornings that used fallback |
| Using knowledge it does not have | — | Lines judged for claims beyond input (human-labeled sample) |
| Behaving like the rule | Rule neighbor is deterministic: same input gives same output | Share of mornings where agent moves equal rule moves on the same input |
| Ignoring memory | — | Recorded trace sequences where a repeated route should be anticipated; compare agent vs rule |
| Session state leaking | Two concurrent sessions keep separate memory | — |

First evidence (2026-11-12, 20 calls, one night-3 input, prompt v0): all 40 moves were legal; 4 of 20 outputs failed only on the 80-character line limit; **14 of 20 move sets equaled the rule-based neighbor's** (lamp to the most-trampled area, lock the changed gate). On this input, the v0 prompt behaves mostly like the baseline. This is the largest open risk to the agent hypothesis (Risk Register R2).

### A9. Scripted baseline and fallback: the rule-based neighbor

Same input, same two moves, no model [Hao, on agent proposal]:

1. Move a lamp to the post nearest the area with the most fresh footprints (ties broken by fixed area order).
2. Lock the gate whose state changed. If none changed, lock the gate nearest the most recently emptied pedestal.
3. If a move fails the reachability check, replace it with `hold`.

It reads only today's traces, so it has no memory. In comparisons, the game runs either the agent or the rule for a whole session, chosen by a switch.

### A10. Budgets

| Budget | Value | Basis |
| --- | --- | --- |
| Model calls per session | at most 5 (one per morning), at most 10 with retries | GDD: 5 nights |
| Latency per call | p50 0.98 s, p95 1.56 s, max 2.86 s; timeout 4 s | 20 timed calls, 2026-11-12, from my laptop to the global endpoint, one night-3 input |
| Input and output tokens per call | mean 859 input, 108 output (no reasoning tokens reported) | Same run |
| Cost per session | about $0.0026 for 5 calls; at most about $0.007 for 10 calls with a longer night-5 input (est. 1,100 input, 150 output) | Vertex AI Standard pay-as-you-go, global: $0.30 per 1M input tokens, $2.50 per 1M output tokens (response and reasoning), read 2026-11-12 at cloud.google.com/vertex-ai/generative-ai/pricing |
| Spending limit | Session refuses further calls after 10; target under $0.01 per session; daily cap set in the provider console | — |

Limits of this measurement: one input, one day, 20 calls, called from a laptop rather than the Worker. The checkpoint run on Nov 23 repeats it from the deployed Worker.

### A11. Human override

- A developer switch forces the rule-based neighbor for a session (used in playtests and A/B comparison).
- Any agent decision can be replayed from the log and compared with the rule's decision on the same input.
- Prompt, estate file, and validator changes are made only through PRs I approve.

### A12. Executable extension artifact (syllabus requirement)

The neighbor ships as a **function-calling interface**: a Worker endpoint, `POST /session/{id}/morning`, which takes the trace input and returns validated moves. A common manifest (`agent/neighbor.manifest.json`, planned) carries the syllabus's required fields:

| Manifest field | Planned content |
| --- | --- |
| Purpose and available tools | Section A1; no tools; move list in A3 |
| Explicit prohibited actions | Section A4 |
| Memory policy and named context sources | Section A5 |
| Model choice and prompts/system instructions | Section A6; prompt file path |
| Named failure modes and evaluation cases | Section A8 |
| Logging policy and human override points | Sections A7, A11 |
| Test command and CI workflow path | **TBD**, planned `npm test` and `.github/workflows/ci.yml` |

Also recorded there: model id and settings, configuration version, timeout, retry and spending limits, fallback behavior, and a pointer to Section A2 for the world-state and knowledge boundary.

## Part B. Production agents: role-coverage map

G1 plans the team; working roles and gaps are shown at G2/G3. My accountability does not move: I am Executive Producer and Creative Director, and I make every gate proposal. Shared models are allowed. All roles below are **planned**, with no executable artifact yet.

| Role | Executable artifact (planned) | Purpose | Context | Tools and permissions | Outputs | Recipient and handoff | Evaluation | Human approval boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Producer | Claude Code skill `producer` | Keep plan, risks, and weekly PPP current | `docs/project-plan.md`, git log, PR list | Read repo; edit plan docs; from G2, draft Asana updates | Plan updates, PPP drafts, cut proposals | Me; Tech Lead for task order | Plan matches merged PRs at each gate | I approve plan changes and all Asana writes |
| Design Lead | Claude Code skill `design-lead` | Maintain GDD, playtest questions, balance proposals | GDD, playtest logs | Edit `docs/gdd.md` in PRs | GDD diffs, test questions, balance proposals | Tech Lead (specs), QA (checks) | Every rule has a label and a test or open question | I decide all design changes |
| Tech Lead | Claude Code implementation session with repo `AGENTS.md` | Build game, Worker, validator, CI | Repo, GDD, this document | Edit code on branches; run tests; open PRs | PRs with tests | QA for review; me for merge | CI green; QA review passed | I merge; no deploy to production without my OK |
| Art Lead | Claude Code skill `art-lead` | Choose readable placeholder art and check licenses | GDD feedback section, asset packs | Read/download only from listed CC0 sources; edit `CREDITS.md` | Asset list, readability checklist, credits | Tech Lead | Every asset has a recorded license | I approve the visual direction |
| Narrative and Audio | Style guide `docs/neighbor-voice.md` + skill | Neighbor's voice, scripted fallback lines, sound cue list | GDD, prompt | Edit voice and line files | Lines, cue list | Tech Lead; prompt owner | Lines stay in character in review sample | I approve tone |
| QA | Read-only reviewer subagent `gnome-reviewer` | Independent review of each change against acceptance criteria | Task, acceptance criteria, diff, test output (not the implementer's reasoning) | Read, grep, run tests; no edits | Review report with reproductions | Tech Lead; me | Finds seeded defects in a check | I decide on disputed findings |
| Business Intelligence | Script `tools/analyze_logs` + skill | Route overlap across nights, false-trail counts, latency, cost, fallback rate | Session logs (anonymous) | Read logs; write reports | Tables with sample sizes and limits | Design Lead; me | Numbers reproduce from logs | I interpret findings |
| Publishing and Release | Skill `release` (wrangler deploy, checklist) | Deploy builds and keep release instructions | Repo, release checklist | Deploy to a preview environment; production only on my OK | Deployed URL, release notes | Me; playtesters | A fresh browser can reach and play the build | I approve every production deploy and the Gold tag |

## Part C. Open configuration questions

| ID | Question | Decide by |
| --- | --- | --- |
| C1 | ~~Which Gemini model and timeout pass the measurement?~~ Answered 2026-11-12: `gemini-3.5-flash-lite`, 4 s. | Done |
| C2 | ~~Is Vertex AI access working?~~ Answered 2026-11-12: yes, 20 of 20 calls returned. | Done |
| C6 | How do I make the agent differ from the rule where it matters (fake trails, repeated routes) without hard-coding the answer? 14 of 20 measured runs matched the rule. | Before T13 |
| C3 | Does the morning line need a separate cheaper call, or is one call enough? | First live evaluation |
| C4 | How large a live suite per change is affordable (trials × sessions)? | After C1 |
| C5 | Which repository location and visibility does the course expect? | Instructor answer |
