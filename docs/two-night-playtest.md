# Two-night playtest

Codex drafted this working plan under Hao’s direction. Use the existing farm for both nights so players can recognize a changed defense.

| Work | Owner | Acceptance |
| --- | --- | --- |
| Gate reach | Core interaction | Approach head-on, diagonally and just past a gate. The visible target remains actionable while holding E. Adjacent fences remain usable. |
| First minute | Client HUD | First movement dismisses the WASD hint and moves the player. A nearby keycap fills with actual hold progress. A successful action gives visible and audible feedback. Esc pauses simulation, provides controls and volume, and can restart the current night. |
| Morning | Core session | Resolve the first night, retain world changes and select a legal, evidence-based response for the second night. Exercise spotted, successful and quiet nights. |
| Two-night client | Integration | Play from entry selection through the first result and morning into the second night. End the slice with a replay option. |
| Model comparison | Follow-up | Replay the same trace sets against the rules and a real provider. Record latency, legality, fallback and the change a player can observe. Obtain approval for paid runs per the project configuration. |
| Playtest and next map | Follow-up | Observe three fresh players. Record gate overshoots, early releases and the reason each gives for their second route. Use the results to choose the next map’s central decision. |

## Playtest script

Start a fresh run and let the player choose an entrance. Observe the first movement and gate interaction without explaining the controls. Ask the player to bring a gnome home. After the morning, ask which route they want to take and why. Record what they actually saw and distinguish it from what the farmer said. The acceptance column also applies to the related Asana tasks.

## Next decisions

1. Tune gate reach with the first observer session. Record the approach direction and whether the player accidentally selected a fence. Current starting values are 1.25 tiles from the gate edge and 1.55 while holding.
2. Use the [local checkpoint steps](../game/README.md#local-worker-checkpoint) to reproduce plan validation, session isolation, request replay and the forced timeout. The quiet-night Anthropic sample returned a legal no-action plan. The footprint-heavy case was verified with the rule farmer. A live model comparison on footprint-heavy and multi-night inputs remains open.
3. For the November 28 prototype, use a first-time player's run to select the next change. If the new light goes unnoticed, improve the morning cue before designing another map. If both routes read well, build a second layout around a shortcut that leaves tracks and a longer route on stone.

The two-night build uses a compact text morning and defaults to the rule farmer. The local Worker mode is opt-in. Five-night balance, cross-night fog memory and the animated morning remain later work.
