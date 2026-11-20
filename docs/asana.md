AI-use disclosure: Claude (Claude Code) set up the Asana project and wrote this guide from the repository, Git history and a read-only Asana check, following the Tank Trouble conventions; Hao approved the write checklist on 2026-11-19.

# Gnome Heist in Asana: setup and maintenance

**Project:** [Gnome Heist — COMS E6998 Final](https://app.asana.com/1/1219142319278837/project/1220727551768593) (`1220727551768593`). It is private, in the "My workspace" team, and was set up on 2026-11-19.

## 1. What Asana is for

Asana answers three questions at a glance. The repository remains the evidence.

1. What is still missing for the **Nov 23 model checkpoint** (deployed model call, isolated session state, forced-timeout fallback)? → section `Nov 23 checkpoint`.
2. What is blocking the **Nov 28 G2/G3 prototype recording** (time not published)? → section `Nov 28 prototype (G2/G3)` and each card's *Blocked by*.
3. What does the **next playtest** need to verify? → section `Next playtest`.

The project status update "Three questions, 2026-11-19" answers all three with links.

Truth order: git establishes files and commits, GitHub establishes PRs and CI, CourseWorks establishes course dates, and Hao's latest instruction establishes scope. Asana tracks plans and status. It links to evidence but never replaces it.

## 2. What we kept from Tank Trouble, and what we simplified

| Tank Trouble practice | Gnome Heist |
| --- | --- |
| `[ID] English title`; ID numbers are not execution order | Kept. Plan T IDs (`[T11c] …`), decisions `[D1]…`, course milestones keep their `[FINAL …]` titles |
| Course milestones are separate tasks with a deadline type | Kept. The 13 existing `[FINAL …]` tasks are shared with the midterm project, not copied |
| Status shown by section (Backlog → Done, plus Manual Testing) | Simplified. Sections follow the **delivery horizon**; status is the **Evidence** field plus the `Evidence:` line in each description |
| One `Stage` field | Two project-local single-select fields, Evidence and Date type (Section 6) |
| Native finish-to-start dependencies; no date shifting | Kept. 35 edges; no subtasks |
| Full English text, `---`, then a full Chinese translation | Simplified to English only, per CLAUDE.md |
| PR body carries the task URL; GitHub Actions attach the PR | Kept. The same two pinned Asana actions, limited to this project; see Section 9 |
| Agents never mark tasks complete; Hao accepts | Kept |
| Read before writing, reuse before creating, read back after writing | Kept. The ID → gid table in Section 5 makes reruns safe |
| Dashboard with 8 charts, built by hand | Dropped. The List and Board views plus the status update are enough |

The midterm project was renamed from "COMS E6998 — Hao Chen — Game Studio" to **"COMS E6998 Midterm — Tank Trouble Reconstruction"** (`1219141547723528`), so it no longer reads as the umbrella for the whole course.

## 3. Structure

**Sections, in order:**

1. `Nov 23 checkpoint`
2. `Nov 28 prototype (G2/G3)`
3. `Next playtest`
4. `Alpha → G5 (later)`
5. `Decisions for Hao`
6. `Done (accepted by Hao)`

**Description template.** Every card starts with an Evidence line:

```
Evidence: Not started | Implemented locally | Verified locally | Deployed | Verified with a player | Accepted by Hao — plus what is NOT yet verified
Date type: Course date | Internal target | Not published
Owner: Hao (accountable). Delegated to: <GDF role / agent>
Acceptance: …
Depends on: …
Evidence location: <branch / commit / PR / file / doc section>
AI-use disclosure: …
```

All cards are assigned to Hao, the only workspace member. "Delegated to" names the production role from Configuration Part B. Target dates are the plan's internal targets. Overdue ones stay overdue until Hao re-dates them.

## 4. Setup result (read back 2026-11-19)

- **37 tasks**: 13 reused `[FINAL …]` course milestones plus 24 new (T1–T16, including T11a/b/c and T12a/b; T17, T18; D1–D3). None are complete; Hao ticks.
- **35 dependency edges**, all read back as planned. The key chains:
  - `[FINAL CP]` (11-23) ← T11c ← T10, T11b; T11b ← T11a, D1, D2
  - `[FINAL G2/G3] recording` (11-28) ← T16 ← T15 ← T13, T14, D3; T13 ← T12b ← T11c, T12a
  - T14 ← T12b, T18; T18 ← T8, T17
  - `[FINAL G2]` (11-30) ← T14, T15; `[FINAL G3] gate` ← `[FINAL G3] brief` ← T15
- **Dates changed:** `[FINAL G1] Concept pitch recording` moved 11-14 → **11-15**, per the CourseWorks "G1 recording due Sunday" correction. T6 moved 11-18 → 11-20.
- **Spot check, milestone → task → repository:** `[FINAL CP]` → `[T11c]` → `[T10]`, whose Evidence location is `core/src/morning.ts` and `core/test/morning.test.ts`. Those files are uncommitted in the working tree of `codex/night-farm-art-v1`.
- **Hao's decisions, applied the same evening:**
  - G1 is treated as approved for planning (no instructor decision had been found). It reopens if the instructor posts Hold.
  - T1, T3 and both `[FINAL G1]` cards are complete.
  - T4 is closed as *replaced* by the two-night observation (T18/T14), not as performed. Its dependency on T8 was removed.
  - All four decisions are recorded as comments on the cards.
- **Re-dated internal targets (2026-11-19, on Hao's request).** Every finish-to-start edge now ends before its successor starts, so the Gantt view shows no conflicts. The chain still finishes before the course dates:

  | Date | Tasks |
  | --- | --- |
  | 11-19 | T7 |
  | 11-20 | T8, T11a, D1, D2, T6 |
  | 11-21 | T10, T11b, T17, T5 (11-20 to 11-21) |
  | 11-22 | T9, T11c, T18 |
  | 11-23 | T12a; `[FINAL CP]` checkpoint |
  | 11-24 | T12b |
  | 11-25 | T13, T14, D3 (11-20 to 11-25) |
  | 11-26 | T15 |
  | 11-27 | T16 |
  | 11-28 | `[FINAL G2/G3]` recording |

  T1 was set to 11-14, the actual merge date.
- **Fields filled on all 37 cards** from each `Evidence:` line:
  - *Accepted by Hao*: T1, T3 and the two G1 cards. T4 also has this value, but it was closed as replaced, not performed.
  - *Verified locally*:
    - T2: spike results.
    - T7: local checks. GitHub CI and preview URL not verified.
    - T8: local tests and review; branch not pushed.
    - T11a: Workers-runtime tests pass locally; not deployed.
  - *Implemented locally*:
    - T5: files exist, not yet used on a PR.
    - T6: this setup.
    - T10: deterministic morning only, uncommitted.
    - T12a: two-night slice only, uncommitted; no five-night session exists.
    - T17: committed on `codex/night-farm-art-v1`; farm look not yet playtested.
    - T18: uncommitted. HANDOFF reports local checks and a Chrome replay, but none of it is in git yet, and no fresh player has tried it.
  - *Not started*: everything else.
  - Date type: *Course date* for the 13 `[FINAL …]` cards; *Internal target* for the others. T16 targets 11-27, the day before the 11-28 course date.
- **Still open:** T2 is marked Done in the plan but not ticked in Asana. Hao ticks it if he agrees.

## 5. ID → Asana gid

Task URL: `https://app.asana.com/1/1219142319278837/project/1220727551768593/task/<gid>`

| ID | gid | ID | gid |
| --- | --- | --- | --- |
| T1 | 1220744086641595 | T12a | 1220727552141383 |
| T2 | 1220727578098815 | T12b | 1220727552141552 |
| T3 | 1220744086582791 | T13 | 1220727578224137 |
| T4 | 1220727578180238 | T14 | 1220727682763412 |
| T5 | 1220727441684235 | T15 | 1220727552013064 |
| T6 | 1220744086646328 | T16 | 1220727441620685 |
| T7 | 1220727441686344 | T17 | 1220744086581310 |
| T8 | 1220727552145753 | T18 | 1220727578224047 |
| T9 | 1220744086582279 | D1 | 1220727679010684 |
| T10 | 1220744086646436 | D2 | 1220744086585118 |
| T11a | 1220744086584520 | D3 | 1220727578177366 |
| T11b | 1220727578149471 | T11c | 1220727441648185 |

| Course milestone | gid | Due |
| --- | --- | --- |
| [FINAL G1] Concept pitch recording | 1219145432663863 | 11-15 |
| [FINAL G1] Concept gate and initial documents | 1219145432663866 | 11-16 |
| [FINAL CP] Deployed proxy, session isolation and fallback | 1219145432663869 | 11-23 |
| [FINAL G2/G3] Combined prototype and scope-lock recording | 1219145432663872 | 11-28 |
| [FINAL G2] Prototype and external playtest at combined review | 1219145432663875 | 11-30 |
| [FINAL G3] Share scope-lock brief | 1219145432663878 | 11-28 |
| [FINAL G3] Production gate and scope lock | 1219145432663881 | 11-30 |
| [FINAL] Alpha | 1219145432663884 | 12-02 |
| [FINAL] Beta | 1219145432663887 | 12-04 |
| [FINAL G4] Gold recording | 1219145432663890 | 12-05 |
| [FINAL G4] Gold approval and final configuration | 1219145432663893 | 12-07 |
| [FINAL G5] Draft AAR and showcase evidence | 1219145432663896 | 12-12 |
| [FINAL G5] Closure, final game, AAR and archive | 1219145432663899 | 12-14 |

Section gids:

| Section | gid |
| --- | --- |
| Nov 23 checkpoint | `1220727551768594` |
| Nov 28 prototype | `1220727578000097` |
| Next playtest | `1220727441558138` |
| Alpha → G5 | `1220727678870225` |
| Decisions for Hao | `1220727578045951` |
| Done | `1220727441548258` |

## 6. UI configuration (done in Hao's Chrome, 2026-11-19)

The connector cannot create fields, change view settings or move sections. These steps were done in the Asana web UI through Claude in Chrome:

- **Tabs:** Overview, List, Board, Timeline, Dashboard, Gantt. Hao had already added Board, Timeline, Dashboard and Gantt.
- **Gantt** (`…/gantt/1220727678744849`): zoom set to **Days** and saved. Dependencies show as FS arrows; there are no red conflict lines after the re-dating.
- **Section order** checked: it matches Section 3.
- **Custom fields** created under *Customize → Fields → Create new*, both single-select and project-local:
  - **Evidence** `1220727680057342`. Options: Not started `…343` · Implemented locally `…344` · Verified locally `…345` · Deployed `…346` · Verified with a player `…347` · Accepted by Hao `…348`
  - **Date type** `1220727680057350`. Options: Course date `…351` · Internal target `…352` · Not published `…353`
- **List** shows Name, Assignee, Due date, Evidence, Date type.

To repeat any of this by hand: open the project → *Customize* (top right) → *Fields* → *+ Add* → *Create new*, type the title, type each option and press Enter, delete the empty last option, then *Create field*. For the Gantt: open the *Gantt* tab → zoom menu (top right) → *Days* → *Save view*.

## 7. Running it again safely

1. Read the project (`1220727551768593`) and its tasks.
2. For each row, look up the gid in Section 5, or search the project for a title starting with `[ID]`. Update it if found. Create a task only if neither lookup finds it, then add its gid to Section 5 immediately.
3. Add existing tasks to the project by gid. Never recreate `[FINAL …]` cards.
4. Add dependencies only after every task exists; skip edges already present.
5. Read back the task count, key dates and dependency edges. Record any difference here, without rewriting history.
6. If a call times out, query before retrying.

## 8. Maintenance

- **When:** at every `gnome-handoff`, after a PR opens or merges, and after each playtest.
  - The session that changed the evidence updates the card's **Evidence field** and its `Evidence:` line, and appends one "Evidence update (date): …" line with the commit, PR or doc link.
  - When a date moves, keep every finish-to-start edge ending before its successor starts. The Gantt view shows a red line otherwise.
  - Move the card to the right section.
  - Hao approves the write.
- **Status update:** post a new "Three questions" status update when the answer to any of the three changes, and at least before each course date.
- **PRs:** the PR body lists every covered Asana task URL under `## Asana` (`.github/pull_request_template.md`). The commit or PR title starts with the task ID, e.g. `[T11c] feat: …`. A URL in the description is not proof of a link: check the task's GitHub attachment.
- **Never:** mark a task complete (only Hao does), move a task to fit a PR, invent a deadline, or write "23:59" when no time is published.
- **New work:** gets the next free T ID in `docs/project-plan.md` first, then a card here, then a row in Section 5.

## 9. GitHub PR ↔ Asana task links

This follows the Tank Trouble setup. Two workflows run on pull requests from this repository, not forks, and act only on tasks in this project (`allowed-projects: 1220727551768593`):

- `.github/workflows/asana-pr-attachments.yml`: on *opened, reopened, edited*, it attaches the PR as a GitHub card to every task whose full Asana URL appears in the PR description.
- `.github/workflows/asana-pr-notifications.yml`: on *opened, reopened, closed*, it comments `GitHub PR #n: state — title. url` on those tasks. It never completes a task.

Both actions are pinned to the same commit SHAs as in Tank Trouble.

**Status: active since 2026-11-20.** Hao added `ASANA_SECRET`. The attachment run after an edit to PR #2's description returned `task 1220744086646328: added a widget`, and the T6 card then listed the GitHub attachment `#2 [T6] Set up the Gnome Heist Asana project and PR links`. The notification workflow has not yet fired with the secret (next on close or reopen). GitHub warns that both actions target Node 20 and are run on Node 24.

If the secret is ever missing, both jobs log a skip and pass. To set it again, Hao:

1. Opens https://github.integrations.asana.com/auth in his own browser.
2. Signs in to Asana and authorizes the Asana GitHub integration.
3. Copies the secret it shows.
4. Adds it as a repository secret named `ASANA_SECRET` under *GitHub → gnome-heist → Settings → Secrets and variables → Actions → New repository secret*.
5. Edits any open PR description, which triggers the attachment.

Only Hao handles this credential; agents never see or store it. The Tank Trouble repository keeps its own secret. Whether generating a new secret affects that one is not verified, so check that a Tank Trouble PR still attaches afterwards.
