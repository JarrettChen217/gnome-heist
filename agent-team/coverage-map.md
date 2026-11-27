AI-use disclosure: Codex assembled this coverage map from project instructions, source and review history under Hao’s direction.

# G2/G3 production role coverage

| Role | Game-specific work | Evidence and handoff |
| --- | --- | --- |
| Implementation agent | Builds the four-night client and tooling under the game rules in AGENTS.md. Keeps precise player routes out of the farmer’s bounded input. | [Project instructions](../AGENTS.md), [client scene](../game/src/scenes/Night.ts), [recording handoff](handoffs/g2-recording.md) |
| Independent reviewer | Checks game rules, evidence boundaries, farmer validation, budget and fallback. Returns findings to the implementer and Hao. | [Reviewer definition](../.codex/agents/gnome-reviewer.toml), [review and producer decision](handoffs/g2-recording.md) |
| Executive Producer and Creative Director | Hao sets the gate scope, plays the build, decides design changes and owns the submission. | [Developer playtest](../docs/initial-playtest-log.md), [project plan](../docs/project-plan.md) |

External playtesting and comparative live model evaluation remain open. Automated checks cover software behavior. The self-playtest provides one designer’s interpretation of that behavior.
