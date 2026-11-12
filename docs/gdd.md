AI-use disclosure: Claude (Claude Code) drafted this document from my design notes and its own proposals; every item is labeled with who decided it, and I reviewed and approved the decided items.

# Gnome Heist: Initial Game Design Document

| | |
| --- | --- |
| Gate | G1 Concept (Initial version) |
| Version | 0.1, 2026-11-12 |
| Accountable owner | Hao, as Design Lead, with Creative Director approval |
| Companion documents | [Configuration Document](configuration.md) · [Systems diagram](systems-diagram.md) · [Project Plan and Risk Register](project-plan.md) |

**Status of this document.** Nothing here is implemented or verified yet. Every rule is a paper design. Each item carries one label:

- **[Hao]**: my own design decision.
- **[Hao, on agent proposal]**: proposed by my agent and accepted by me (decision log in Section 17).
- **[Proposed]**: proposed by my agent and not yet decided. Treat it as a placeholder.
- **[Open]**: an open question, listed in Section 16.

## 1. The X

**Gnome Heist is a short single-player stealth game in which you sneak through a neighbor's hedge-maze estate at night to steal his garden gnomes, and you feel him getting to know you.** [Hao]

Each morning the neighbor, an AI agent, reads only the traces you left behind and moves two of his defenses. Your map shows only what you last saw, so every night begins with scouting.

## 2. Player, genre, platform

- **Player:** people who like light stealth and pranks and who prefer reading a situation to fast reflexes. [Hao]
- **Motivation (Motivation Atlas):** challenge. [Hao] Observable hypothesis: a player who has understood the neighbor will (a) walk across a flowerbed they never intend to use, to plant a false trail, and (b) from night two on, re-scout an area before acting there. [Hao, on agent proposal for (b)]
- **Genre:** turn-of-the-night stealth puzzle. Movement is real-time, and the dangers stand still. There is no real-time patrol in v1. [Proposed]
- **Platform:** desktop web browser, keyboard controls. [Hao, on agent proposal]
- **Camera:** angled top-down 2D in the style of Stardew Valley: square ground tiles, with houses, hedges, and characters drawn so their fronts are visible. No jumping, no isometric 3D. [Hao]

## 3. Core loop

| Step | What happens |
| --- | --- |
| **Act** (night) | You enter from outside the estate, scout through fog of war, take a gnome, open and close gates, and leave traces, some of them on purpose. You end the night from the safe zone outside the estate. [Hao] |
| **Respond** (morning) | The neighbor walks to the traces he found, says one line, and moves two defenses. You see which traces he inspected and what *kind* of defense moved, but not where it went. [Hao, on agent proposal] |
| **Interpret** | You compare his line and the traces he inspected with your own memory of the night. Your map still shows the defenses where you last saw them. [Hao, on agent proposal] |
| **Next action** | You re-scout the areas you need, then choose a route, or plant a false trail to pull a defense away. [Hao] |

## 4. Pillars [Proposed]

1. **Every trace is a message.** Whatever you leave is read, including what you leave on purpose.
2. **Read before you risk.** Danger is drawn on the ground. Failure comes from a wrong judgment, not slow fingers.
3. **A fair neighbor.** His information and his moves are limited, the player can learn those limits, and he never seals the estate shut.

## 5. Mechanics

### 5.1 Estate map

- One estate laid out as a hedge maze with several route families. [Hao]
- v1 size about 24 × 18 tiles, with a camera that follows the player; 3 entry points, 5 gnome pedestals, 4 gates, 2 to 3 distinct route families. [Hao, on agent proposal]
- Ground types: **soft ground** (flowerbeds, mud) records footprints; **stone paths** record nothing, but they are usually longer and better lit. [Proposed]
- Plenty of cover (bushes, hedges), readable at a glance. [Hao]

### 5.2 Fog of war and "last seen"

- On the first night, the estate is unexplored. [Hao]
- Tiles you have seen stay revealed and show what you last saw there. They do not go dark again. [Hao]
- Defenses you saw on an earlier night are drawn faded, tagged with the night you saw them ("seen night 2"). After the neighbor moves them, the faded image stays wrong until you look again. [Hao, on agent proposal]
- Within your current sight, everything is visible: lamps, the dog, the house window's sight line, gates. [Hao]

### 5.3 Movement, actions, stamina

- Walking is free, so you can always retreat to safety. [Hao]
- Only **actions** cost stamina. v1 actions: take a gnome, open a gate, close a gate. [Hao for the principle; Proposed for the list]
- About 4 actions per night. [Proposed]
- **False trails:** walking across soft ground leaves footprints, so a false trail costs no stamina; it costs time and exposure. Opening a gate you will not use is a false trail that costs stamina. [Proposed] (See Open question Q3.)
- Locked gates cannot be opened in v1. [Proposed]
- End the night by pressing the end-night control inside the safe zone outside the estate. You cannot be stranded inside with no stamina. [Hao]

### 5.4 Danger and cover

- Danger is static and drawn on the ground: tiles a lamp lights, the sight line from the neighbor's window, the dog's alert radius. Stepping into any of these means you are spotted. [Proposed]
- Bushes block the window's sight line. Tiles behind a bush are safe, and the blocked sight line is drawn broken on the ground. [Proposed]
- No patrols in v1. A patrolling dog is a later option for real-time tension. [Proposed]

### 5.5 Traces

| Trace | Rule |
| --- | --- |
| Footprints | Left on every soft tile you step on; cannot be erased. [Proposed] |
| Gate state | Each gate is open or closed. The neighbor leaves some gates open on purpose. You must remember which ones you opened; closing the wrong one is also a trace. The game gives no reminder. [Hao] |
| Empty pedestal | A stolen gnome always leaves an empty pedestal. [Hao] |
| Sighting | If you are spotted, the neighbor knows the tile where he saw someone. [Hao, on agent proposal] |

### 5.6 The neighbor's defenses

- A fixed inventory, v1: 2 lamps, 1 dog, 1 lock. [Hao for lamp, dog, lock; Proposed for the counts] Decoy gnomes and traps come later, not in v1. [Hao]
- Each morning he makes **exactly two moves** from a fixed list. "Leave a defense where it is" counts as a move. [Hao for the two-move limit; agent proposal for the exact list]
- Lamps go on predefined lamp posts, the dog on predefined kennel spots, the lock on any gate.
- There are more gnomes than lamps, so he cannot cover everything. If he lights every gnome he can, a false trail can draw a lamp away. [Hao]
- He can never leave the estate with no unlit, unlocked route from an entry to a remaining gnome. The game enforces this, not the agent. [Hao, on agent proposal]
- How he chooses is specified in the [Configuration Document](configuration.md).

### 5.7 Morning sequence

1. The neighbor walks to each trace he decides to inspect.
2. He says one line, for example, *"Mud on the roses again. Somebody likes the east gate."* [Hao for the animation; agent proposal for the line]
3. A sound cue and a caption say which kind of defense moved ("Something heavy was dragged across the lawn."). The new positions are not shown. [Hao, on agent proposal]

### 5.8 Being spotted

The night ends at once. A gnome you are carrying goes back to its pedestal. You get one strike, and the neighbor's next trace list includes the sighting. No chase in v1. [Hao, on agent proposal]

### 5.9 Win, failure, scoring

- A session is 5 nights. You win by stealing 5 gnomes. [Proposed]
- 3 strikes ends the session as a loss. [Proposed]
- Score: gnomes stolen, nights used, strikes taken. [Proposed]

## 6. Intended dynamics

- **False trails:** players plant footprints or open gates to pull a lamp or the dog away, then check whether it worked.
- **Route variety:** because the neighbor remembers recent nights, a route that worked twice is likely to be covered.
- **Re-scouting:** a stale map pushes players to look before they commit.
- **The fully defended night:** when every reachable gnome is covered, a good move is to steal nothing and spend the night planting false trails. [Hao]

## 7. Intended aesthetics (MDA)

Challenge first, with mischief: the neighbor's lines and the gnomes themselves should be funny, and the danger should feel like a prank going wrong, not horror. [Hao]

## 8. Progression

Within a session, the neighbor's knowledge of your habits grows, while his inventory stays fixed. New interactables arrive slowly in later versions, at a Neighbours from Hell pace. [Hao] v1 has no progression across sessions.

## 9. Edge cases

| Case | Handling |
| --- | --- |
| Player ends the night without entering | Empty trace list. The neighbor still makes two moves ("leave in place" is allowed). |
| Every gnome would be covered | The reachability check rejects the move set. The fallback rule applies, and the case is logged. |
| Agent output is invalid or late | The fallback rule neighbor makes the moves. The player sees the same morning sequence. The case is logged. |
| Spotted while carrying a gnome | Gnome returned, strike recorded. |
| Out of stamina inside the estate | Walk back to the safe zone; walking is free. |
| Third strike | Session ends immediately as a loss. |
| Night 5 ends with fewer than 5 gnomes | Session ends; the score is shown. [Open: whether that counts as a loss or a partial result] |

## 10. Balance

All numbers in Sections 5 and 9 are placeholders chosen for a small map, not tested values: map 24 × 18, 5 pedestals, 4 gates, 2 lamps, 1 dog, 1 lock, 4 actions per night, 5 nights, 3 strikes. The first playtests will tune them. Main balance risk: the fallback rule may be too easy or the agent too strong. Both are measured in the evaluation plan.

## 11. Controls [Proposed]

Arrow keys or WASD to move; E to interact (take, open, close); Enter in the safe zone to end the night; M to show the full remembered map.

## 12. Feedback

- Lit tiles, the window's sight line (drawn broken behind cover), and the dog radius are drawn on the ground.
- Footprints appear as you make them.
- Stamina pips, strike counter, night counter.
- Faded "last seen" defenses tagged with a night number.
- The morning sequence (Section 5.7).

## 13. Content scope

- **Included:** one estate map; one neighbor agent; 2 lamps, 1 dog, 1 lock; soft-ground footprints; gates; pedestals; false trails; fog with "last seen"; 5 nights; the morning line; a switch between the agent and the rule-based neighbor; session logs.
- **Excluded:** real-time patrols and chases; the neighbor's decoys and traps; additional or procedurally generated maps; multiplayer; voice; a story campaign; art and animation beyond placeholder quality; mobile.
- **Cut first, in order:** (1) angled art, falling back to flat top-down tiles; (2) the dog, keeping lamps and the lock; (3) the stamina system, replaced by a fixed 4 actions per night; (4) memory across nights, so the neighbor reads only last night. Cut (4) weakens the agent hypothesis, so it comes last.

[Hao, on agent proposal]

## 14. References and attribution

| Reference | What I take | What I change | Terms |
| --- | --- | --- | --- |
| *Neighbours from Hell* (JoWooD Productions, 2003, Windows) | Watching a neighbor's routine to find openings; pets that alert him when you fail to sneak past; being caught ends the attempt; hiding behind cover. Per Wikipedia and a 2003 Worthplaying review, he walks a set routine that a specific prank can interrupt, and his pets alert him; neither source describes him adapting to your traces across episodes. | Inverted structure: I sneak in at night, and he changes his defenses in the morning from traces only, remembering earlier nights. | Design reference only. No assets, code, names, or characters used. |
| *Stardew Valley* (ConcernedApe, 2016) | The angled top-down camera and tile readability. | Night setting; stealth instead of farming. | Visual reference only. No assets used. |
| "Explored but not visible" fog in real-time strategy games (e.g., *StarCraft*), where the last-seen snapshot of structures stays on the map | Stale map memory. | The stale snapshot is the core of the loop: the neighbor moves things while you cannot see. | Mechanic reference only. |
| Phaser 3 (planned engine) | Engine. | — | MIT License; to confirm on install. |
| Art assets (planned: a CC0 top-down tile pack, such as one of Kenney's) | Placeholder tiles and sprites. | — | Each pack's license to be checked and recorded in `CREDITS.md` before use. |
| Model provider (planned: Gemini via Vertex AI, course default) | The neighbor's decisions. | — | Provider terms and use policy to be recorded when configured. |

Notes from the Nov 9 first pitch round changed the concept: listeners could not tell who played whom or how to win in my earlier interrogation game, so I chose a game whose roles and goal are visible on screen. [Hao]

## 15. The agent in one paragraph

The neighbor sees a trace list, his own layout, and short summaries of the last three mornings. He returns exactly two moves from an enumerated list and one line of dialogue. The game validates the moves and applies them; if the call fails, times out, or returns an illegal set, a deterministic rule-based neighbor moves instead. The same rule-based neighbor is the scripted baseline for comparison. Full specification: [Configuration Document](configuration.md).

## 16. Open questions

| ID | Question | Current proposal | Decide by |
| --- | --- | --- | --- |
| Q1 | Are 5 nights, 5 gnomes, 3 strikes, and 4 actions per night the right numbers? | Placeholders. | First external playtest (G2) |
| Q2 | Should "leave in place" count as one of the two moves, or should he be allowed fewer than two? | Counts as a move. | Rule-neighbor prototype |
| Q3 | Does a false trail need its own action, or is walking on soft ground enough? | Walking is enough; opening a gate is the stamina-cost version. | Paper test |
| Q4 | When decoy gnomes and traps arrive (after v1), are they visible only within sight, and how does a decoy differ from a real gnome? | Out of v1. | After G3 |
| Q5 | Does the morning sequence say enough for the player to interpret it, without showing new positions? | Show the inspected traces, one line, and the moved category. | First external playtest |
| Q6 | Is a 24 × 18 estate large enough to feel like exploring, and small enough to finish by Gold (Dec 5)? | 24 × 18. | Greybox prototype |
| Q7 | Does night 5 ending without 5 gnomes count as a loss or a partial result? | Partial result with score. | Rule-neighbor prototype |
| Q8 | Is a lock pickable at a stamina cost, or simply impassable? | Impassable in v1. | Paper test |

## 17. Decision log

| Date | Decision | Origin | Status |
| --- | --- | --- | --- |
| 2026-11-10 | Change concept from the interrogation game to Gnome Heist | Hao | Decided |
| 2026-11-10 | Angled 2D camera; hedge-maze estate; fog with "last seen"; free walking; actions cost stamina; end night from safe zone; neighbor limited to two moves; more gnomes than lamps; morning animation | Hao | Decided |
| 2026-11-12 | Neighbor is an LLM with structured output, a validator, and a rule-based fallback | Agent proposal, accepted by Hao | Decided |
| 2026-11-12 | Scripted baseline is a rule-based neighbor with the same information and two-move budget (not a fixed routine) | Agent proposal, accepted by Hao | Decided |
| 2026-11-12 | TypeScript + Phaser 3 in the browser; Cloudflare Pages and a Worker for the model call | Agent proposal, accepted by Hao | Decided |
| 2026-11-12 | Map about 24 × 18; morning shows inspected traces and the moved category, not new positions; being spotted ends the night | Agent proposal, accepted by Hao | Decided |
| 2026-11-12 | Budgets come from a measured run of the model call | Agent proposal, accepted by Hao | Decided |
| 2026-11-12 | The neighbor can switch between model providers (Vertex, Anthropic, OpenAI) through one interface | Hao (library choice, Vercel AI SDK, on agent proposal) | Decided |
| 2026-11-12 | Repository is private for now | Hao | Decided |
| 2026-11-12 | Default neighbor model: Claude Sonnet 5.5 with thinking off, after a 26-configuration latency/cost sweep | Hao, on agent proposal | Decided |
| 2026-11-12 | Support both Claude Sonnet 5.5 (primary) and Gemini 3.5 Flash-Lite (secondary); failover rule proposed in the Configuration Document | Hao (both); failover rule on agent proposal, accepted by Hao | Decided |
| — | Pillars; Risk Profile ratings | Agent proposal | Awaiting Hao |
