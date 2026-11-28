AI-use disclosure: Claude (Claude Code) drafted this document from my decisions and its own proposals; Codex clarified the moved-padlock check with my approval. I reviewed it and own every boundary decision in it.

# Gnome Heist: Initial Configuration Document

| | |
| --- | --- |
| Gate | G1 Concept (Initial version) |
| Version | 0.3, 2026-11-13 (one failover rule, the morning protocol, allowlisted context, C9 in three steps) |
| Accountable owner | Hao, as Tech Lead, with Creative Director approval |
| Companion documents | [GDD](gdd.md) · [Systems diagram](systems-diagram.md) · [Project Plan and Risk Register](project-plan.md) |

## Changes since G1 (November 26, 2026)

[Hao, on agent proposal] The local four-night client defaults to the rule farmer. Local Worker mode is opt-in. The farmhouse opening is scripted. After the opening, the animation presents the committed plan's inspected evidence and actions. A local Anthropic quiet-night check returned a legal no-action plan. The footprint-heavy check used the rule farmer. See the [checkpoint instructions](../game/README.md#local-worker-checkpoint).

The [G2/G3 coverage map](../agent-team/coverage-map.md) links the working implementation and independent reviewer roles and their handoff.

[Open] The budgeted multi-scenario model-versus-rule evaluation remains pending. The earlier [model measurements](../spike/README.md) used a different contract. The G1 sections below describe the intended configuration. Labels follow the GDD: **[Hao]**, **[Hao, on agent proposal]**, **[Proposed]**, **[Open]**.

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

The **trace extractor** (deterministic code) builds the agent's input from world state at the end of each night. The agent never receives raw world state. The context is built as a new object from an explicit allowlist of fields, and a test compares the serialized model request bodies of two sessions that differ only in hidden state; they must be identical ([Technical plan](architecture.md), Section 4.2). This shows that hidden data is not sent; it does not stop the model from inferring a route from footprints, which stays in the evaluation (A8). [Hao, on agent proposal]

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

An empty `actions` list is allowed. `inspected` lists the places the morning animation walks to; each must be a trace in that morning's list. `line` is at most 80 characters.

### A4. Prohibited actions

- Inventing defenses, slots, or ids that are not in the farm description.
- A plan that costs more stamina than he has (2) or more coins than he has.
- Placing or moving anything onto a dog hole or within 2 tiles of it (entry safe zone).
- Any plan that adds a barrier (buys a padlock, moves a padlock so its destination gate is locked, re-locks a padlock, repairs a fence) after which no remaining gnome can be reached from some dog hole for at most 1 stamina (the open-route rule, GDD 5.7 and 5.11). Covering routes with lamps or the dog is allowed, and a plan without barriers is never rejected by this rule.
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

Memory policy: the game, not the model, holds memory. Each morning it appends one summary, built only from that morning's filtered trace list and the committed plan, and keeps only the last 3. Memory lives in that session's isolated state and is deleted when the session ends: at once on the client's finish notice, or by a Durable Object alarm 24 hours after the last request if no notice arrives (closed tab, offline mode). No player identity is stored. [Hao, on agent proposal]

Retrieval: none planned. The whole context is small enough to send each time.

### A6. Model, settings, prompt

| Setting | Value |
| --- | --- |
| Provider | **Switchable** between Gemini on Vertex AI (course-funded), Anthropic, and OpenAI (or an OpenAI-compatible endpoint), chosen by `FARMER_PROVIDER`. Unified interface in the Worker: Vercel AI SDK, one structured-output call. [Hao, 2026-11-12, for multiple providers; library on agent proposal] Anthropic and OpenAI are paid by me; course credits cover only Vertex. Names of all settings: [`.env.example`](../.env.example). |
| Model identifier | **Default: `claude-sonnet-5-5`, thinking off** (`thinking: between_tools`). [Hao, 2026-11-12, on agent proposal] Course-funded secondary: `gemini-3.5-flash-lite`, thinking low, global endpoint. Chosen from a 26-configuration sweep of Claude Opus/Sonnet/Haiku 5.5 and Gemini 3.1 Pro, 3.8 Flash, 3.5 Flash-Lite and Gemini 4 at each thinking level ([spike results](../spike/README.md)). |
| Thinking and sampling | Thinking off for latency. In the sweep, Claude Opus 5.5 at any effort matched the rule-based baseline on 18 to 20 of 20 calls; Sonnet 5.5 off/low/medium on 0 of 20 (Section A8). Gemini temperature left at the model default. [Proposed] |
| Output | JSON with a response schema; max output about 200 tokens. |
| Where it runs | A Cloudflare Worker, which also serves the client on the same origin; one Durable Object per play session holds the farmer's state (layout, budget, memory, revision, morning log). Requests carry a `morningId` and revision so a morning is committed once ([Technical plan](architecture.md), Section 4.3). For Vertex, the edge entry point of the AI SDK provider with credentials from Worker bindings (C7). The context builder, validator, and rule-based farmer are one engine-free TypeScript package, `core/`, shared with the client and the tests ([Technical plan](architecture.md), Section 4). [Hao, on agent proposal, 2026-11-13] API keys and endpoints stay in Worker secrets (`wrangler secret put`; locally a gitignored `.dev.vars`) and never reach the browser or the repository. |
| Two supported models | **Primary:** Claude Sonnet 5.5, thinking off. **Secondary:** Gemini 3.5 Flash-Lite, thinking low. Both stay supported, configured, and covered by the live evaluation. [Hao, 2026-11-12] |
| Provider switching rules | The primary is set per session (`FARMER_PROVIDER`) and logged with every morning, so comparisons never mix providers silently. One output schema for all providers, kept simple because Vertex accepts only a subset of JSON Schema; semantic checks stay in the validator. **One morning, one deadline:** a 4 s target from the moment the request reaches the Durable Object, covering authentication, the model calls, validation, and the commit. Model calls must stop by an internal cut-off at 3.5 s, leaving about 0.5 s for the rule-based farmer, validation, and the single commit. SDK retries are off (`maxRetries: 0`) and every call gets an abort signal tied to the cut-off. The 4 s is an application target, not a guarantee about network or storage time; the client's 6 s timeout is the backstop. **At most two model attempts:** (1) the primary; (2) the secondary (`FARMER_SECONDARY`), only if the primary failed fast (a provider or connection error, or output that does not parse or match the schema, within 1.5 s) and at least 1.5 s remain. There is no same-provider retry. Anything else (a timeout, a second failure, a plan the validator rejects, too little time left) goes to the rule-based farmer. A **model** result that arrives after the cut-off is logged and never committed; the rule-based plan that replaced it is committed once, and the revision moves forward once. The log records which of the three acted. Playtests use the primary only, so the player-facing comparison stays agent vs. rule; the model comparison runs in the automated evaluation (T13). [Hao, 2026-11-12, on agent proposal; tightened into one rule on 2026-11-13, on agent proposal after the outside review] |

Draft system instruction (v1, not yet tested):

> You are the farmer in Gnome Heist. Someone keeps sneaking onto your farm at night and stealing your garden gnomes. Each morning you see only the traces listed below, your own layout, your stamina and money, and your notes from earlier mornings. You never saw the intruder's route. Spend your budget to make tonight harder: buy a defense (1 coin and 1 stamina), move one you own (1 stamina), or repair something (1 stamina). Some traces may be fake. You hate seeing your things broken. You may not touch the dog holes or lock every remaining gnome away. Answer only with JSON matching the schema. Your `line` is one short, grumpy, funny sentence about what you noticed, and it must not claim knowledge you do not have.

### A7. Validation, timeout, retry, fallback

| Step | Rule |
| --- | --- |
| Schema | Reject anything that does not parse or match the schema. |
| Legality | Ids exist; slot kind matches the defense; nothing in an entry safe zone; every `inspected` id is a trace in this morning's list. |
| Budget | Total stamina ≤ his stamina; coins ≤ his money. |
| Open route | Only for plans that add a barrier: shortest-path search on the farm graph after applying the plan, with the route rules of GDD 5.11, where a closed padlocked gate or an intact fence costs 1 stamina; at least one dog hole must reach at least one remaining gnome at a cost of at most 1. Danger is ignored. Not run once the session is over. |
| Line | At most 80 characters; word filter. |
| Timeout | 4 s for the whole morning (A6). In the sweep, Sonnet 5.5 off had p95 2.69 s. The call runs during the morning's opening beat (about 3 s, GDD 5.8 step 0), which does not depend on the model's output; the walk to the inspected traces can only start after the plan arrives. The client waits about 6 s before running the rule-based farmer locally and staying on it for the rest of the session. To re-measure from the deployed Worker (C9). |
| Retry | No same-provider retry; the only second attempt is the secondary under the rule in A6. |
| Fallback | The **rule-based farmer** (Section A9) acts; the line comes from a small set of scripted lines. Same morning sequence; the player is not told. |
| Logging | Each morning logs: input, raw output, validator result, which policy acted (primary, secondary, or rule), latency, token counts. |

### A8. Named failure modes and evaluation cases

| Failure mode | Deterministic test (CI, every PR) | Live evaluation (budgeted) |
| --- | --- | --- |
| Illegal or malformed plan | Validator rejects fixtures of each kind; fallback runs | Invalid-output rate per 100 mornings |
| Overspending | Plans that cost 3 stamina or more coins than owned are rejected | Count of budget rejections |
| Blocking an entry or locking the farm | Safe-zone and open-route checks on crafted layouts, including a padlock purchase, a padlock move that locks its destination gate, or a fence repair that would close the last route of at most 1 stamina; a padlock move that leaves a route of at most 1 stamina must pass this check; an empty plan after the player took the only cheaply reachable gnome must stay legal | Count of rejections |
| Timeout or provider error | Injected delay larger than the timeout gives fallback, and the morning still completes | Share of mornings that used fallback |
| Using knowledge it does not have | — | Lines judged for claims beyond input (human-labeled sample) |
| Behaving like the rule | The rule-based farmer is deterministic: same input gives same output | Share of mornings where the agent's plan equals the rule's on the same input |
| Ignoring memory | — | Recorded trace sequences where a repeated route should be anticipated; compare agent vs rule |
| Session state leaking | Two concurrent sessions keep separate memory | — |
| Hidden state reaching the model | Two sessions that differ only in hidden state produce identical serialized request bodies | — |
| A morning committed twice, or a stale one | A repeated `morningId` returns the stored result without a second call or charge; a stale revision or map version is rejected; a result after the deadline is not committed | — |
| Two different tomorrows | After the client falls back locally, later online responses are ignored and the session stays in local rule mode | Count of sessions that switched |
| Primary provider down | Injected fast primary error: secondary answers within the budget; injected primary timeout: rule-based farmer acts | Share of mornings served by primary, secondary, and rule |

**Evidence so far (earlier two-move contract, 2026-11-12).** These runs used a fixed "exactly two moves" output, before the budget rules; they give a first estimate of latency and cost, and they show one behavior worth keeping in mind. With 20 calls per configuration on one night-3 input, deeper thinking copied the rule-based baseline more often (Opus 5.5 18 to 20 of 20 at every effort; Sonnet 5.5 14 of 20 at high, 0 of 20 at off/low/medium). Sonnet 5.5 off still chose one plan on most calls, so "different from the rule" is not yet "adapts to the player". Two earlier sweeps failed on the contract, not the models (an unconstrained `inspected` field; an empty string inside an enum, which Gemini rejects); ids are now enumerated in the schema itself. The budget contract will be re-measured in three steps (C9), the last of them before T13 (Risk Register R2).

### A9. Scripted baseline and fallback: the rule-based farmer

Same input, same budget, no model [Hao, on agent proposal]:

1. If a fence was broken or a padlock left open, repair it (1 stamina).
2. If there are fresh footprints and he has a coin and stamina left, buy a lamp and place it on the free post nearest the area with the most fresh footprints (ties broken by fixed area order). If that post would be rejected, try the next nearest, in order of distance and then id.
3. Otherwise, if there are fresh footprints and he has stamina left, move his nearest lamp to that post, with the same order.
   With no fresh footprints, he skips steps 2 and 3.
4. Skip any action that the safe-zone or open-route check would reject.
5. Ties are broken by the lowest id; if no action is possible, he does nothing and keeps his coins. His plan goes through the same validator as the agent's.

It reads only today's traces, so it has no memory. In comparisons, the game runs either the agent or the rule for a whole session, chosen by a switch.

### A10. Budgets

| Budget | Value | Basis |
| --- | --- | --- |
| Model calls per session | at most 4 mornings (no morning after the last night), at most 2 attempts each (primary, then secondary under the A6 rule); every attempt counts toward the cap of 10 | GDD: 5 nights |
| Latency per call | Sonnet 5.5 off: p50 1.75 s, p95 2.69 s, max 2.85 s. Flash-Lite low: p50 1.43 s, p95 1.73 s. Timeout 4 s. | 20 timed calls per configuration, 2026-11-12, laptop to provider, one night-3 input, earlier two-move contract (schema v0.3) |
| Input and output tokens per call | Sonnet 5.5 off: 1,687 input, 126 output. Flash-Lite low: 1,090 input, 93 output. Token counts for the budget contract are not measured yet (C9). | Same runs (tokenizers differ by provider) |
| Cost per session | Sonnet 5.5 off: about $0.023 for 5 calls at the earlier contract's average; the budget contract's cost is not measured yet (C9), under $0.05 at the 10-call cap. Flash-Lite low: about $0.003 for 5 calls. | Anthropic pricing page ($2 / $10 per 1M input/output tokens) and Vertex AI pricing page, global ($0.30 / $2.50), both read 2026-11-12. Anthropic usage is paid by me; Vertex is course-funded. |
| Spending limit | Session refuses further calls after 10; target under $0.05 per session; daily cap set in the provider console | — |

Limits of this measurement: one input, one day, 20 calls per configuration, called from a laptop rather than the Worker, and the earlier two-move contract. Gemini 3.1 Pro, Gemini 3.8 Flash and Gemini 4 had p95 latencies of 9.5 to 30 s that day and are excluded for now. These numbers support the current models as a provisional default only; they do not cover the new schema, the Worker, or Vertex authentication from a Worker. C9 re-measures in three steps.

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

G1 plans the team; working roles and gaps are shown at G2/G3. My accountability does not move: I am Executive Producer and Creative Director, and I make every gate proposal. Shared models are allowed. All roles below are **planned**; the Producer skills and the QA subagent exist as files since 2026-11-13 but have no evidence of use yet. The repository's `CLAUDE.md` holds the rules every production agent follows.

| Role | Executable artifact (planned) | Purpose | Context | Tools and permissions | Outputs | Recipient and handoff | Evaluation | Human approval boundary |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Producer | Claude Code skills `gnome-resume` and `gnome-handoff` (in `.claude/skills/`, created 2026-11-13, not yet used); a PPP skill later | Restore context at session start; record state, evidence, and next action at each stop; keep plan, risks, and weekly PPP current | `docs/project-plan.md`, git log, PR list | Read repo; edit plan docs; from G2, draft Asana updates | Plan updates, PPP drafts, cut proposals | Me; Tech Lead for task order | Plan matches merged PRs at each gate | I approve plan changes and all Asana writes |
| Design Lead | Claude Code skill `design-lead` | Maintain GDD, playtest questions, balance proposals | GDD, playtest logs | Edit `docs/gdd.md` in PRs | GDD diffs, test questions, balance proposals | Tech Lead (specs), QA (checks) | Every rule has a label and a test or open question | I decide all design changes |
| Tech Lead | Claude Code implementation session following the repo's `CLAUDE.md` | Build game, Worker, validator, CI | Repo, GDD, this document | Edit code on branches; run tests; open PRs | PRs with tests | QA for review; me for merge | CI green; QA review passed | I merge; no deploy to production without my OK |
| Art Lead | Claude Code skill `art-lead` | Choose readable placeholder art and check licenses | GDD feedback section, asset packs | Read/download only from listed CC0 sources; edit `CREDITS.md` | Asset list, readability checklist, credits | Tech Lead | Every asset has a recorded license | I approve the visual direction |
| Narrative and Audio | Style guide `docs/farmer-voice.md` + skill | The farmer's voice, scripted fallback lines, sound cue list | GDD, prompt | Edit voice and line files | Lines, cue list | Tech Lead; prompt owner | Lines stay in character in review sample | I approve tone |
| QA | Read-only reviewer subagent `gnome-reviewer` (`.claude/agents/`, created 2026-11-13, not yet used) | Independent review of each change against acceptance criteria | Task, acceptance criteria, diff, test output (not the implementer's reasoning) | Read, grep, run tests; no edits | Review report with reproductions | Tech Lead; me | Finds seeded defects in a check | I decide on disputed findings |
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
| C7 | Vertex from a Cloudflare Worker cannot use my laptop's Application Default Credentials; it needs a service-account credential stored as a Worker secret. Is that allowed for the course project? Until then the deployed secondary is unavailable and failover goes straight to the rule-based farmer. This does not block the Nov 23 checkpoint (Anthropic primary, isolated Durable Objects, and the rule fallback cover it); it blocks only the claim that the deployed secondary works. | Before claiming the deployed secondary |
| C8 | ~~Default model?~~ Decided 2026-11-12 by Hao: Claude Sonnet 5.5, thinking off; Gemini 3.5 Flash-Lite low as the secondary. | Done |
| C9 | Re-measure with the budget contract (buy, move, repair), in three steps: (1) a few calls from the deployed Worker with the final schema, to check compatibility (M3a, T11b); (2) a small multi-scenario run before the checkpoint: cold and warm starts, full memory, no legal purchase, a nearly sealed farm, a primary fast failure; schema-invalid, rule-invalid, fallback rate, and total time counted separately (M3, T11c); (3) the formal agent-vs-rule comparison (T13). Every paid run needs my OK. | Steps by Nov 19, Nov 21, Nov 26 |
