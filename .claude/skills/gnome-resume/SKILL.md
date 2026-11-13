---
name: gnome-resume
description: Use when starting a session in the Gnome Heist repository, returning after a break, or taking over a task with missing context. Read-only briefing from the handoff, git state, and the relevant docs; it does not edit anything or restart settled design.
---

# Resume Gnome Heist

AI-use disclosure: Claude (Claude Code) authored this skill under Hao's direction; the structure follows the Tank Trouble `tank-resume` skill.

Restore enough context to continue the requested work. This phase is **read-only**: no edits, branch switches, fetch or pull, stash, installs, test or game runs, model calls, or pushes while gathering context.

1. Read `CLAUDE.md`, then `docs/HANDOFF.md`.
2. Check the checkout: `git status --short`, `git branch --show-current`, `git log -5 --oneline`. Treat uncommitted or untracked files as someone's live work; never discard them or fold them into your commit.
3. If the task concerns a PR, read its real state with `gh pr view` / `gh pr checks`. If GitHub is unreachable, say the PR state is unverified.
4. Read only the doc sections the task needs: rules and open questions in `docs/gdd.md`; the agent contract, budgets, and failure modes in `docs/configuration.md`; dates, tasks, and risks in `docs/project-plan.md`. Keep settled decisions (the GDD decision log); do not reopen them unless Hao asks or you find a concrete conflict.
5. When sources disagree, git establishes files and commits, GitHub establishes PR and CI state, CourseWorks establishes course dates, and Hao's latest instruction establishes scope. Name the conflict instead of silently picking the older document.
6. Check the Active work table before proposing anything parallel. Overlapping files or an unknown owner means "ask Hao", not "free".

Return a short briefing in Chinese:

- current stage and the nearest course date;
- the task and its acceptance criteria;
- branch and working-tree state;
- blockers, overlaps, and what is unverified;
- the next concrete action.

If Hao already asked for a task, continue with it after the briefing; otherwise stop at the briefing.
