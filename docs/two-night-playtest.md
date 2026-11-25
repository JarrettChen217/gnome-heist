AI-use disclosure: Codex drafted this working plan under Hao’s direction.

# Four-night playtest

Use the existing farm for all four nights so players can recognize a changed defense.

| Work | Owner | Acceptance |
| --- | --- | --- |
| Gate reach | Core interaction | Approach head-on, diagonally and just past a gate. The visible target remains actionable while holding E. Adjacent fences remain usable. |
| First minute | Client HUD | First movement dismisses the WASD hint and moves the player. A nearby keycap fills with actual hold progress. A successful action gives visible and audible feedback. Esc pauses simulation, provides controls and volume, and can restart the current night. |
| Morning | Core session | Resolve each of the first three nights, retain world changes and select a legal, evidence-based response for the following night. Exercise spotted, successful and quiet nights. Watch for the specific trace the farmer inspects and the change his caption describes. |
| Four-night client | Integration | Play through all three mornings on the same farm. On nights three and four, check an earlier theft or defense before taking a remaining gnome. Check the final count and replay. |
| Model comparison | Follow-up | Replay the same trace sets against the rules and a real provider. Record latency, legality, fallback and the change a player can observe. Obtain approval for paid runs per the project configuration. |
| Playtest and next map | Follow-up | Observe three fresh players. Record gate overshoots, early releases and the reason each gives for their second route. Use the results to choose the next map’s central decision. |

## Playtest script

1. Start a fresh run and let the player choose an entrance. Record their first input and whether they understand which hedge the red cap selects. Let them make their first move before asking where they intend to go and what they expect to find. Record whether they watch or interrupt the entrance shot, their first destination and whether they interpret the farmhouse as a landmark or a goal. After they move, ask which features they recognized from the daylight view.
2. Observe the scroll pickup, the first interaction and the return trip. Record whether they bring a gnome back unaided. If they ask for help or get stuck, record the obstacle and the first hint you give before continuing.
3. After the morning, ask what the farmer examined and what changed. If the farmer worked on a lamp, ask what changed and where the player expects to find it. Then ask “Which way will you go tonight, and why?” Record their words, the defense that actually changed and whether they saw it on the farm or read about it in the morning panel.
4. On nights three and four, let the player choose their route again. Record which empty pedestal, mapped path or defense informed the choice. At the end, compare the count on screen with the gnomes they brought home.

For T14, record the build, entrance, viewport, farmer mode, outcome and first point of hesitation. Compare those observations with the decisions below.

## Next decisions

1. Tune gate reach with the first observer session. Record the approach direction and whether the player accidentally selected a fence. Current starting values are 1.25 tiles from the gate edge and 1.55 while holding.
2. Use the [local checkpoint steps](../game/README.md#local-worker-checkpoint) to reproduce plan validation, session isolation, request replay and the forced timeout. The quiet-night Anthropic sample returned a legal no-action plan. The footprint-heavy case was verified with the rule farmer. A live model comparison on footprint-heavy and multi-night inputs remains open.
3. For the November 28 prototype, use a first-time player's run to select the next change. If the new light goes unnoticed, improve the morning cue before designing another map. If both routes read well, build a second layout around a shortcut that leaves tracks and a longer route on stone.

The four-night build defaults to the rule farmer. Dawn starts at his window, then follows the evidence and work described by the committed plan. The opening is scripted. The selected traces, speech, actions and closing budget come from the committed plan. The local Worker mode is opt-in. Five-night balance and cross-night memory for world objects remain later work.
