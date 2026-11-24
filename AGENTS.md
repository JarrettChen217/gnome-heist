<!-- AI-use disclosure: Codex (Codex) drafted these project instructions under Hao's direction; Hao approves every change to them. -->

# Gnome Heist: instructions for agents

Gnome Heist is Hao's individual final project for *AI in Practice: Game Design and Development* (Columbia, Fall 2026). Single-player stealth: sneak onto the farm next door at night to steal the farmer's garden gnomes; each morning the farmer, an AI agent, reads only your traces and spends a small stamina-and-money budget on his defenses.

Hao is Executive Producer and Creative Director. Agents propose and implement; Hao decides.

## Start and finish every session

- **Start:** run the `gnome-resume` skill (read-only briefing from `docs/HANDOFF.md`, git state, and the relevant docs).
- **Before asking Hao to merge or accept work:** run the read-only `gnome-reviewer` subagent with the task, acceptance criteria, and diff.
- **Stop or hand over:** run the `gnome-handoff` skill so the next session can continue from evidence.

## Sources of truth

| What | Where |
| --- | --- |
| Current state, active work, next action | `docs/HANDOFF.md` |
| Game rules, pillars, open questions, decision log | `docs/gdd.md` |
| Farmer agent contract, budgets, failure modes, production-role map | `docs/configuration.md` |
| Engine, code layout, milestones, versions | `docs/architecture.md` |
| Systems diagram | `docs/systems-diagram.md` |
| Gate dates, tasks, Risk Register | `docs/project-plan.md` |
| Model latency/cost measurements | `spike/README.md` |

Every rule in the GDD and Configuration Document carries an origin label: **[Hao]**, **[Hao, on agent proposal]**, **[Proposed]**, **[Open]**. Keep that labeling when editing.

## Rules

1. **Discuss design changes with Hao first.** Do not change rules, scope, naming, or the agent contract because a request implies it; propose, explain trade-offs, wait for his decision, then record it in the GDD decision log with its origin.
2. **Language.** Talk with Hao in Chinese; keep identifiers and technical terms in English. Everything submitted or committed (docs, code comments, slides, UI text) is in English.
3. **AI-use disclosure.** One line at the top of every written artifact and source file, saying where and how AI helped.
4. **Secrets.** API keys live only in the gitignored `.env` (locally) or Worker secrets (`wrangler secret put`; local `.dev.vars`). Never print, log, commit, or screen-share them. Before each commit, check `git status` for anything that should not be there.
5. **Git.** Work on a task branch, never directly on `main`. Commit locally on the task branch as needed. Push, open a PR, or merge only when Hao says so. Never force-push. Commit messages end with the attribution lines the session provides. Videos never go into git.
6. **Public content.** Never mention class or office-hour recordings or transcripts. Classmates stay anonymous.
7. **Dates.** Course deadlines come from CourseWorks and the syllabus. Write "time not published" when no time is given; never invent 23:59 or present an internal target as a course deadline. Course-update checks run from the parent `AIPB_Repositories` directory with its `aipb-course-updates` skill, not here.
8. **Honest evidence.** Keep implemented, verified, and planned apart. A scripted animation is never presented as agent behavior; a passing CI is not a playtest.
9. **Sign-ins.** Anything that needs a login (CourseWorks, Asana, GitHub web, Google) goes through Hao's real Chrome, never the built-in browser.

## Layout

- `docs/`: design and planning documents (above).
- `spike/`: model measurement scripts and results (Python, run with `uv`).
- `core/`: engine-free TypeScript rules shared by the client, the Worker, and the tests. Imports no Phaser, DOM, network, or clock.
- `game/`: Phaser + TypeScript client (Vite). `worker/`: Cloudflare Worker + Durable Object for the farmer. `maps/`: Tiled maps.
- These four are created at M0 (`docs/architecture.md`, Section 8).

## Engine notes

The client uses **Phaser 4.2.1**; most examples online are Phaser 3. Before writing rendering code, read the Phaser 4 list in `docs/architecture.md`, Section 7 (no `BitmapMask`/`setMask`, FX, custom pipelines, `setTintFill`, `Phaser.Geom.Point`, `Phaser.Structs.Set`, `textures.generate`/`GenerateTexture`; `Phaser.Math.TAU` is 2π; pass `roundPixels` to `camera.startFollow`; embedded tilesets only). Draw fog and danger overlays per tile, without masks or render textures.
- `.agents/skills/`: `gnome-resume`, `gnome-handoff`. `.codex/agents/`: `gnome-reviewer`.
- Loose notes, prompts, and pitch drafts live outside the repo in Hao's OneDrive folder `AI Pract Building Games/Final Game/`.

## Commands

- Model measurement: `uv run spike/measure_morning.py --provider anthropic --model claude-sonnet-5-5 --think off --calls 20 --price-in 2 --price-out 10` (needs `.env`; spends real money, so ask Hao before running).
- Game: see `game/README.md` once it exists.
