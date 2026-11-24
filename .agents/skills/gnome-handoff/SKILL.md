---
name: gnome-handoff
description: Use when pausing, finishing, or handing over Gnome Heist work, or after a PR or merge, so the next session can continue from evidence. Updates docs/HANDOFF.md and only the docs whose content actually changed; never declares unfinished work done.
---

# Hand off Gnome Heist

AI-use disclosure: Codex (Codex) authored this skill under Hao's direction; the structure follows the Tank Trouble `tank-handoff` skill.

Run at a meaningful stop: end of a session, a task milestone, a PR, or an authorized merge. Unfinished work can be handed off; say so.

## Capture

Collect evidence, not memory: `git status --short`, current branch, `git log` since the last handoff, the PR and CI state if any, which checks actually ran and their results, Hao's decisions in this session, blockers, and the first next action.

## Update

- **`docs/HANDOFF.md`** (always): replace the Snapshot; update only your own row in Active work (task, owner, branch, files, status); refresh Open items and Next action. Keep it to one screen. Re-read the file just before saving in case someone else changed it.
- **`docs/gdd.md`**: only if Hao decided a design change. Add a decision-log row with its origin label and update the affected sections.
- **`docs/configuration.md`**: only if the agent contract, model settings, budgets, failure modes, or a production role changed.
- **`docs/project-plan.md`**: only if a task's status, a date, or a risk changed.
- **`README.md`**: only if how to run the project changed. Do not advertise unmerged work as `main`.
- **`AGENTS.md`**: only if Hao changed a durable rule. Never add per-session state there.

Write each statement against its source: "tests pass on `prototype/g1-demo` at `abc1234`", not "tests pass". Keep implemented, verified, reviewed, accepted, and merged separate. No secrets, keys, or transcripts.

## Finish

Commit the handoff on the current task branch with the session's attribution lines. Do not push, open a PR, merge, delete branches, or message anyone just because this skill ran; do those only when Hao has asked in this session. Report in Chinese: what was updated, what was left unchanged, what is pending, and the next action.
