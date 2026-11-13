AI-use disclosure: Claude (Claude Code) drafted this document from my decisions and its own proposals; I reviewed it and own every boundary decision in it.

# Gnome Heist: Initial Configuration Document

| | |
| --- | --- |
| Gate | G1 Concept (Initial version) |
| Version | 0.2, 2026-11-13 (the farmer's stamina-and-money budget replaces the earlier fixed two moves) |
| Accountable owner | Hao, as Tech Lead, with Creative Director approval |
| Companion documents | [GDD](gdd.md) · [Systems diagram](systems-diagram.md) · [Project Plan and Risk Register](project-plan.md) |

**Status.** Everything below is **planned**, except the latency and cost measurement, which was run on 2026-11-12 with the earlier two-move contract ([spike](../spike/README.md)). No game, Worker, test suite, or workflow exists yet. Labels follow the GDD: **[Hao]**, **[Hao, on agent proposal]**, **[Proposed]**, **[Open]**.

Two kinds of agent appear here and stay separate:

- the **in-game agent**, the farmer, which sees only a bounded view of one play session; and
- the **production agents**, which help me build the game and may have repository access.

## Part A. In-game agent: the farmer

### A1. Purpose

Each morning, choose how to spend the farmer's stamina and money (buy, move, or repair defenses) and say one line, using only the traces the player left, so that the player feels the farmer is learning their habits. [Hao, on agent proposal]

The agent does one bounded job. The rest of the game (movement, danger, detection, fog, traces, scoring) is deterministic code that works without it.

### A2. World state and what the agent knows

| Information | World state (game engine) | Farmer agent |
| --- | --- | --- |
| Tile map, hedges, soft ground, lamp posts, doghouse spots, gates, fences, dog holes and their safe zones | Yes | Yes, as named slots (static farm description) |
| His own defense layout, which gates he left open last evening, which padlocks were locked | Yes | Yes |
| His stamina (2) and money this morning | Yes | Yes |
| Footprints on soft ground after the night | Yes | Yes, as tile clusters per named area |
| Gates whose state differs from how he left them; open padlocks; broken fences | Yes | Yes |
| Empty pedestals | Yes | Yes |
| Where he saw someone, if the player was spotted | Yes | Yes |
| Summaries of the previous 3 mornings (his traces and his actions) | Yes | Yes (memory) |
| The player's actual path, timing, position, and dog hole used | Yes | **No** |
| The player's stamina, strikes, and remaining nights | Yes | **No** |
| The player's fog and "last seen" memory | Yes | **No** |
| Which footprints the player made on purpose | Not stored (player intent) | **No** |
| Any other session, player, or game | — | **No** |

The **trace extractor** (deterministic code) builds the agent's input from world state at the end of each night. The agent never receives raw world state. [Hao, on agent proposal]

### A3. Tools and actions

The agent calls no tools. It returns one JSON object, constrained by a response schema with every id enumerated:

```json
{
  "actions": [
    {"type": "repair", "target": "fence_east", "to": "none"},
    {"type": "buy", "target": "doghouse", "to": "spot_fence_east"}
  ],
  "line": "Who kicked a hole in my fence?!",
  "inspected": ["fence_east", "ped_pond"]
}
```

Allowed actions [Hao for buy and move costs; Hao, on agent proposal for the rest]:

| Type | `target` | `to` | Cost |
| --- | --- | --- | --- |
| `buy` | `lamp`, `doghouse`, or `padlock` | a lamp post, doghouse spot, or gate | 1 coin + 1 stamina |
| `move` | an owned defense id | a slot of the same kind | 1 stamina |
| `repair` | a broken fence or an open padlock | `none` | 1 stamina |

An empty `actions` list is allowed. `inspected` lists the places the morning animation walks to. `line` is at most 80 characters.

### A4. Prohibited actions

- Inventing defenses, slots, or ids that are not in the farm description.
- A plan that costs more stamina than he has (2) or more coins than he has.
- Placing or moving anything onto a dog hole or within 2 tiles of it (entry safe zone).
- Any plan that leaves no unlit, unguarded route from some dog hole to some remaining gnome (the reachability invariant).
- A `line` that states the player's real path or position, or refers to information outside its input.
- A `line` that is offensive or breaks character.

The validator enforces every item that can be checked mechanically. The last two are evaluated (Section A8).

### A5. Context sources and memory policy

Named context sources, in prompt order:

1. `system`: role, rules, action list and costs, output schema (versioned prompt file).
2. `farm`: static slot names, adjacency, entry safe zones (versioned data file).
3. `layout`: current defense positions, gate and padlock states he left, his stamina and money.
4. `traces_today`: the extractor's trace list.
5. `memory`: up to 3 previous mornings, each as {traces summary, actions taken, line}.

Memory policy: the game, not the model, holds memory. Each morning it appends one summary and keeps only the last 3. Memory lives in that session's isolated state and is deleted when the session ends. No player identity is stored. [Hao, on agent proposal]

Retrieval: none planned. The whole context is small enough to send each time.

### A6. Model, settings, prompt

| Setting | Value |
| --- | --- |
| Provider | **Switchable** between Gemini on Vertex AI (course-funded), Anthropic, and OpenAI (or an OpenAI-compatible endpoint), chosen by `FARMER_PROVIDER`. Unified interface in the Worker: Vercel AI SDK, one structured-output call. [Hao, 2026-11-12, for multiple providers; library on agent proposal] Anthropic and OpenAI are paid by me; course credits cover only Vertex. Names of all settings: [`.env.example`](../.env.example). |
| Model identifier | **Default: `claude-sonnet-5-5`, thinking off** (`thinking: between_tools`). [Hao, 2026-11-12, on agent proposal] Course-funded secondary: `gemini-3.5-flash-lite`, thinking low, global endpoint. Chosen from a 26-configuration sweep of Claude Opus/Sonnet/Haiku 5.5 and Gemini 3.1 Pro, 3.8 Flash, 3.5 Flash-Lite and Gemini 4 at each thinking level ([spike results](../spike/README.md)). |
| Thinking and sampling | Thinking off for latency. In the sweep, Claude Opus 5.5 at any effort matched the rule-based baseline on 18 to 20 of 20 calls; Sonnet 5.5 off/low/medium on 0 of 20 (Section A8). Gemini temperature left at the model default. [Proposed] |
| Output | JSON with a response schema; max output about 200 tokens. |
| Where it runs | A Cloudflare Worker; one Durable Object per play session holds state. API keys and endpoints stay in Worker secrets (`wrangler secret put`; locally a gitignored `.dev.vars`) and never reach the browser or the repository. |
| Two supported models | **Primary:** Claude Sonnet 5.5, thinking off. **Secondary:** Gemini 3.5 Flash-Lite, thinking low. Both stay supported, configured, and covered by the live evaluation. [Hao, 2026-11-12] |
| Provider switching rules | The primary is set per session (`FARMER_PROVIDER`) and logged with every morning, so comparisons never mix providers silently. One output schema for all providers. **Failover within the 4 s budget:** if the primary fails fast (provider or connection error within 1.5 s), the same request goes once to the secondary (`FARMER_SECONDARY`) with the remaining time; a timeout, or less than 1.5 s left, goes straight to the rule-based farmer. The log records which of the three acted. Playtests use the primary only, so the player-facing comparison stays agent vs. rule; the model comparison runs in the automated evaluation (T13). [Hao, 2026-11-12, on agent proposal] |

Draft system instruction (v1, not yet tested):

> You are the farmer in Gnome Heist. Someone keeps sneaking onto your farm at night and stealing your garden gnomes. Each morning you see only the traces listed below, your own layout, your stamina and money, and your notes from earlier mornings. You never saw the intruder's route. Spend your budget to make tonight harder: buy a defense (1 coin and 1 stamina), move one you own (1 stamina), or repair something (1 stamina). Some traces may be fake. You may not touch the dog holes or block every route to your remaining gnomes. Answer only with JSON matching the schema. Your `line` is one short, grumpy, funny sentence about what you noticed, and it must not claim knowledge you do not have.

### A7. Validation, timeout, retry, fallback

| Step | Rule |
| --- | --- |
| Schema | Reject anything that does not parse or match the schema. |
| Legality | Ids exist; slot kind matches the defense; nothing in an entry safe zone. |
| Budget | Total stamina ≤ his stamina; coins ≤ his money. |
| Reachability | Breadth-first search on the farm graph after applying the plan: at least one dog hole reaches at least one remaining gnome without lit, dog-alert, or locked tiles. |
| Line | At most 80 characters; word filter. |
| Timeout | 4 s. In the sweep, Sonnet 5.5 off had p95 2.69 s, so the roughly 3 s morning walk animation hides almost every call. To re-measure from the deployed Worker by Nov 23. |
| Retry | At most 1 retry, only for a timeout or parse failure, and only if time remains. |
| Fallback | The **rule-based farmer** (Section A9) acts; the line comes from a small set of scripted lines. Same morning sequence; the player is not told. |
| Logging | Each morning logs: input, raw output, validator result, which policy acted (primary, secondary, or rule), latency, token counts. |

### A8. Named failure modes and evaluation cases

| Failure mode | Deterministic test (CI, every PR) | Live evaluation (budgeted) |
| --- | --- | --- |
| Illegal or malformed plan | Validator rejects fixtures of each kind; fallback runs | Invalid-output rate per 100 mornings |
| Overspending | Plans that cost 3 stamina or more coins than owned are rejected | Count of budget rejections |
| Blocking an entry or sealing the farm | Safe-zone and reachability checks on crafted layouts | Count of rejections |
| Timeout or provider error | Injected delay larger than the timeout gives fallback, and the morning still completes | Share of mornings that used fallback |
| Using knowledge it does not have | — | Lines judged for claims beyond input (human-labeled sample) |
| Behaving like the rule | The rule-based farmer is deterministic: same input gives same output | Share of mornings where the agent's plan equals the rule's on the same input |
| Ignoring memory | — | Recorded trace sequences where a repeated route should be anticipated; compare agent vs rule |
| Session state leaking | Two concurrent sessions keep separate memory | — |
| Primary provider down | Injected fast primary error: secondary answers within the budget; injected primary timeout: rule-based farmer acts | Share of mornings served by primary, secondary, and rule |

**Evidence so far (earlier two-move contract, 2026-11-12).** These runs used a fixed "exactly two moves" output, before the budget rules; they still bound latency and cost, and they show one behavior worth keeping in mind. With 20 calls per configuration on one night-3 input, deeper thinking copied the rule-based baseline more often (Opus 5.5 18 to 20 of 20 at every effort; Sonnet 5.5 14 of 20 at high, 0 of 20 at off/low/medium). Sonnet 5.5 off still chose one plan on most calls, so "different from the rule" is not yet "adapts to the player". Two earlier sweeps failed on the contract, not the models (an unconstrained `inspected` field; an empty string inside an enum, which Gemini rejects); ids are now enumerated in the schema itself. The budget contract will be re-measured before T13 (Risk Register R2).

### A9. Scripted baseline and fallback: the rule-based farmer

Same input, same budget, no model [Hao, on agent proposal]:

1. If a fence was broken or a padlock left open, repair it (1 stamina).
2. If he has a coin and stamina left, buy a lamp and place it on the free post nearest the area with the most fresh footprints (ties broken by fixed area order).
3. Otherwise, with stamina left, move his nearest lamp to that post.
4. Skip any action that the safe-zone or reachability check would reject.

It reads only today's traces, so it has no memory. In comparisons, the game runs either the agent or the rule for a whole session, chosen by a switch.

### A10. Budgets

| Budget | Value | Basis |
| --- | --- | --- |
| Model calls per session | at most 5 (one per morning), at most 10 with retries | GDD: 5 nights |
| Latency per call | Sonnet 5.5 off: p50 1.75 s, p95 2.69 s, max 2.85 s. Flash-Lite low: p50 1.43 s, p95 1.73 s. Timeout 4 s. | 20 timed calls per configuration, 2026-11-12, laptop to provider, one night-3 input, earlier two-move contract (schema v0.3) |
| Input and output tokens per call | Sonnet 5.5 off: 1,687 input, 126 output. Flash-Lite low: 1,090 input, 93 output. The budget contract adds a few dozen input tokens. | Same runs (tokenizers differ by provider) |
| Cost per session | Sonnet 5.5 off: about $0.023 for 5 calls, under $0.05 at the 10-call cap. Flash-Lite low: about $0.003 for 5 calls. | Anthropic pricing page ($2 / $10 per 1M input/output tokens) and Vertex AI pricing page, global ($0.30 / $2.50), both read 2026-11-12. Anthropic usage is paid by me; Vertex is course-funded. |
| Spending limit | Session refuses further calls after 10; target under $0.05 per session; daily cap set in the provider console | — |

Limits of this measurement: one input, one day, 20 calls per configuration, called from a laptop rather than the Worker, and the earlier two-move contract. Gemini 3.1 Pro, Gemini 3.8 Flash and Gemini 4 had p95 latencies of 9.5 to 30 s that day and are excluded for now. The checkpoint run on Nov 23 repeats the chosen configuration from the deployed Worker with the budget contract.

### A11. Human override

- A developer switch forces the rule-based farmer for a session (used in playtests and A/B comparison).
- Any agent decision can be replayed from the log and compared with the rule's decision on the same input.
- Prompt, farm file, and validator changes are made only through PRs I approve.

### A12. Executable extension artifact (syllabus requirement)

The farmer ships as a **function-calling interface**: a Worker endpoint, `POST /session/{id}/morning`, which takes the trace input and returns a validated plan. A common manifest (`agent/farmer.manifest.json`, planned) carries the syllabus's required fields:

| Manifest field | Planned content |
| --- | --- |
| Purpose and available tools | Section A1; no tools; action list in A3 |
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
| Narrative and Audio | Style guide `docs/farmer-voice.md` + skill | The farmer's voice, scripted fallback lines, sound cue list | GDD, prompt | Edit voice and line files | Lines, cue list | Tech Lead; prompt owner | Lines stay in character in review sample | I approve tone |
| QA | Read-only reviewer subagent `gnome-reviewer` | Independent review of each change against acceptance criteria | Task, acceptance criteria, diff, test output (not the implementer's reasoning) | Read, grep, run tests; no edits | Review report with reproductions | Tech Lead; me | Finds seeded defects in a check | I decide on disputed findings |
| Business Intelligence | Script `tools/analyze_logs` + skill | Route overlap across nights, false-trail counts, latency, cost, fallback rate | Session logs (anonymous) | Read logs; write reports | Tables with sample sizes and limits | Design Lead; me | Numbers reproduce from logs | I interpret findings |
| Publishing and Release | Skill `release` (wrangler deploy, checklist) | Deploy builds and keep release instructions | Repo, release checklist | Deploy to a preview environment; production only on my OK | Deployed URL, release notes | Me; playtesters | A fresh browser can reach and play the build | I approve every production deploy and the Gold tag |


## Part C. Open configuration questions

| ID | Question | Decide by |
| --- | --- | --- |
| C1 | ~~Which Gemini model and timeout pass the measurement?~~ Answered 2026-11-12: `gemini-3.5-flash-lite`, 4 s. | Done |
| C2 | ~~Is Vertex AI access working?~~ Answered 2026-11-12: yes, 20 of 20 calls returned. | Done |
| C3 | Does the morning line need a separate cheaper call, or is one call enough? | First live evaluation |
| C4 | How large a live suite per change is affordable (trials × sessions)? | After the budget contract is re-measured |
| C5 | Which repository location and visibility does the course expect? | Instructor answer |
| C6 | How do I make the agent differ from the rule where it matters (fake trails, repeated routes) without hard-coding the answer? | Before T13 |
| C7 | Vertex from a Cloudflare Worker cannot use my laptop's Application Default Credentials; it needs a service-account credential stored as a Worker secret. Is that allowed for the course project? Until then the deployed secondary is unavailable and failover goes straight to the rule-based farmer. | Before T11 (Nov 23 checkpoint) |
| C8 | ~~Default model?~~ Decided 2026-11-12 by Hao: Claude Sonnet 5.5, thinking off; Gemini 3.5 Flash-Lite low as the secondary. | Done |
| C9 | Re-measure latency, cost, validity, and agent-equals-rule rate with the budget contract (buy, move, repair). | Before T13 |
