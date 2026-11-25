AI-use disclosure: Claude (Claude Code) drafted this document from my design notes and its own proposals; Codex clarified the moved-padlock check with my approval. Every item is labeled with who decided it, and I reviewed and approved the decided items.

# Gnome Heist: Initial Game Design Document

| | |
| --- | --- |
| Gate | G1 Concept (Initial version) |
| Version | 0.3, 2026-11-13 (after the build-plan review: rule parameters, self-lock check, morning opening beat, end-of-night order) |
| Accountable owner | Hao, as Design Lead, with Creative Director approval |
| Companion documents | [Configuration Document](configuration.md) · [Technical plan](architecture.md) · [Systems diagram](systems-diagram.md) · [Project Plan and Risk Register](project-plan.md) |

**Status of this document.** Nothing here is implemented or verified yet. Every rule is a paper design. Each item carries one label:

- **[Hao]**: my own design decision.
- **[Hao, on agent proposal]**: proposed by my agent and accepted by me (decision log in Section 17).
- **[Proposed]**: proposed by my agent and not yet decided. Treat it as a placeholder.
- **[Open]**: an open question, listed in Section 16.

## 1. The X

**Gnome Heist is a short single-player stealth game in which you sneak onto the farm next door at night to steal the farmer's garden gnomes, and you feel him getting to know you.** [Hao]

Each morning the farmer, an AI agent, reads only the traces you left behind and spends a small daily budget of stamina and money on his defenses. Your map shows only what you last saw, so every night begins with scouting.

## 2. Player, genre, platform

- **Player:** people who like light stealth and pranks and who prefer reading a situation to fast reflexes. [Hao]
- **Motivation (Motivation Atlas):** challenge. [Hao] Observable hypothesis: a player who has understood the farmer will (a) walk across a flowerbed they never intend to use, to plant a false trail, and (b) from night two on, re-scout an area before acting there. [Hao, on agent proposal for (b)]
- **Genre:** turn-of-the-night stealth puzzle. Movement is real-time, and the dangers stand still. There is no real-time patrol in v1. [Proposed]
- **Platform:** desktop web browser, keyboard controls. [Hao, on agent proposal]
- **Camera:** angled top-down 2D in the style of Stardew Valley: square ground tiles, with the farmhouse, hedges, fences, and characters drawn so their fronts are visible. No jumping, no isometric 3D. [Hao]
- **Art direction:** hand-drawn ink look in the spirit of Neighbours from Hell: many uneven lines, hatching for shade, not flat low-poly. [Hao]

## 3. Core loop

| Step | What happens |
| --- | --- |
| **Act** (night) | You crawl in through a dog hole in the hedge, scout through fog of war, take a gnome, get past gates and fences, and leave traces, some of them on purpose. You end the night back outside the hedge. [Hao] |
| **Respond** (morning) | The farmer walks to the traces he found, says one line, and spends his stamina and money: he buys a new defense, moves one, or repairs what you broke. You see which traces he inspected and what *kind* of thing he did, but not where. [Hao, on agent proposal] |
| **Interpret** | You compare his line and the traces he inspected with your own memory of the night. Your map still shows the defenses where you last saw them. [Hao, on agent proposal] |
| **Next action** | You re-scout the areas you need, then choose a route, or plant a false trail to pull a defense away. [Hao] |

## 4. Pillars [Hao, on agent proposal]

1. **Every trace is a message.** Whatever you leave is read, including what you leave on purpose.
2. **Read before you risk.** Danger is drawn on the ground. Failure comes from a wrong judgment, not slow fingers.
3. **A fair farmer.** His information and his daily budget are limited, the player can learn those limits, and he never blocks the farm physically. Danger may cover every gnome, but because he reads only traces, the player can pull it away.

## 5. Mechanics

### 5.1 Farm map

- One farm laid out as a hedge maze with several route families. [Hao]
- v1 size about 24 × 18 tiles, with a camera that follows the player; 3 dog holes as entries, 5 gnome pedestals, 4 gates (some padlocked), at least one fence line, 2 to 3 distinct route families. [Hao, on agent proposal]
- Ground types: **soft ground** (flowerbeds, mud) records footprints; **stone paths** record nothing, but they are usually longer and better lit. [Proposed]
- Plenty of cover (bushes, hedges), readable at a glance. [Hao]
- Tall grass borders the paths. Along overgrown stretches only the gardener’s cap or upper head shows. A gardener who enters a dense bush disappears from view, including any carried gnome. [Hao]

### 5.2 Entries: dog holes

- You always enter and leave through a dog hole in the outer hedge. Each dog hole is a fixed entry; v1 has three. [Hao]
- On the first night, a 2D wide shot shows the estate in daylight. The light fades and a farmhouse window glows before the chosen hedge opening rustles. The camera moves in as the player crawls through cap first, then settles with the scroll in view. The sequence lasts about 3.1 seconds. Movement gives the player immediate control. Later nights use a short crawl at the normal zoom. [Hao, on agent proposal]
- **Entries are safe zones.** The farmer may not place or move anything onto a dog hole or within 2 tiles of it; the validator rejects such a move. Danger can still reach the path beyond those 2 tiles, so being seen soon after you crawl in remains a real risk. [Hao, on agent proposal]
- Standing in a dog hole and pressing the end-night control ends the night. You cannot be stranded inside with no stamina, because walking is free. [Hao]
- To keep that promise, a re-lock that would cut you off from every dog hole is refused: the prompt says "You'd lock yourself in" and no stamina is spent. The check uses the route rules in Section 5.11. [Hao, on agent proposal]

### 5.3 Fog of war and "last seen"

- On the first night, the farm is unexplored. [Hao]
- Tiles you have seen stay revealed and show what you last saw there. They do not go dark again. [Hao]
- Defenses you saw on an earlier night are drawn faded, tagged with the night you saw them ("seen night 2"). After the farmer changes them, the faded image stays wrong until you look again. [Hao, on agent proposal]
- Within your current sight, everything is visible: lamps, the doghouse, the farmhouse window's sight line, gates, fences. [Hao]

### 5.4 Movement, actions, stamina

- Walking is free, so you can always retreat to safety. [Hao]
- Only **actions that force or fix something** cost stamina; ordinary actions cost time instead. [Hao, on agent proposal]
- You have **2 stamina per night** in the demo and the first map. [Hao for the demo; Proposed for the full game, see Q1]

| Object | Get through | Put it back | Trace if left |
| --- | --- | --- | --- |
| Plain gate | Open: free, hold E about 1 s | Close: free, hold E about 1 s (the cost is time in the open) | A gate whose state changed |
| Padlocked gate | Pick the lock: **1 stamina** | Re-lock: **1 stamina** (refused if it would lock you in, Section 5.2) | An open lock |
| Fence | Kick a gap: **1 stamina** | Cannot be fixed the same night | A broken fence, always seen next morning |
| Gnome | Dig it up: **1 stamina** | — | An empty pedestal |

[Hao, on agent proposal]

- The choice this creates: a padlocked gate is quiet, but cleaning up after it costs a second stamina; a fence is the short way, but its trace cannot be erased.
- If you try an action without enough stamina, the prompt turns red ("No stamina left") and nothing happens. [Hao]
- **False trails:** walking across soft ground leaves footprints for free; it costs time and exposure. Opening a gate you will not use is a false trail that costs only time. [Proposed]

### 5.5 Danger and cover

- Danger is static and drawn on the ground: tiles a lamp lights, the sight line from the farmhouse window, the dog's alert radius around its doghouse. Stepping into any of these means you are spotted. [Proposed]
- In the playable revision, a dense bush also shelters its occupant from lamps. The dog’s local alert still applies, including inside a bush. Ordinary tall grass only obscures the character visually. [Proposed]
- Bushes block the window's sight line. Tiles behind a bush are safe, and the blocked sight line is drawn broken on the ground. [Proposed]
- No patrols in v1. A dog that patrols is a later option for real-time tension. [Proposed]

### 5.6 Traces

| Trace | Rule |
| --- | --- |
| Footprints | Left on every soft tile you step on; cannot be erased. [Proposed] |
| Gate state | Each gate is open or closed. The farmer leaves some gates open on purpose. You must remember which ones you opened; closing the wrong one is also a trace. The game gives no reminder. [Hao] |
| Open lock | A picked padlock you did not re-lock. [Hao, on agent proposal] |
| Broken fence | Always present once kicked. [Hao] |
| Empty pedestal | A stolen gnome always leaves an empty pedestal. [Hao] |
| Sighting | If you are spotted, the farmer knows the tile where he saw someone. [Hao, on agent proposal] |

### 5.7 The farmer's budget and defenses

Each morning the farmer spends a small budget. [Hao]

| Rule | v1 value |
| --- | --- |
| Stamina | Refills to **2** every morning |
| Money | Starts at **1 coin**; **+1 coin** every morning; stolen gnomes do not cost money |
| Buy and place a new defense | 1 coin + 1 stamina |
| Move a defense he owns | 1 stamina |
| Repair a fence or re-lock a padlock | 1 stamina |
| Do nothing more | Allowed; unspent coins carry over, unspent stamina does not |

[Hao for buy and move costs; Hao, on agent proposal for the other values]

- **Catalog in v1:** lamp (lights the tiles around a lamp post), doghouse (the dog's alert radius around it), padlock (on a gate). He starts with 1 lamp and 1 padlock. Decoy gnomes and traps come later, not in v1. [Hao for the catalog; Proposed for the starting set]
- Lamps go on predefined lamp posts, doghouses on predefined spots, padlocks on gates.
- There are more gnomes than lamps, so he cannot cover everything at once. If he lights every gnome he can, a false trail can draw a lamp away. [Hao]
- **He never blocks the farm physically.** Any plan that adds a barrier (buying a padlock, moving a padlock so its destination gate is locked, re-locking a picked padlock, or repairing a fence) is rejected if, afterwards, no remaining gnome can be reached from some dog hole for at most 1 stamina (one padlock to pick or one fence to kick), which leaves the player 1 stamina to dig. Every other plan, including doing nothing, is legal, so the player's own theft can never make his morning illegal. Lamps, the dog, and the window may cover any route: danger is the farmer's to place, and the player answers it with false trails and sabotage. Nothing may be placed in an entry's safe zone. The game enforces these rules, not the agent. [Hao, 2026-11-13, replacing the earlier safe-route guarantee; the barrier form on agent proposal]
- **He hates broken things.** In character, he usually repairs a broken fence or an open padlock before doing anything else. This is his personality in the prompt, not a rule: the model may ignore damage, and that choice is itself a signal to the player. The rule-based farmer always repairs first. [Hao, on agent proposal]
- How he chooses is specified in the [Configuration Document](configuration.md).

### 5.8 Morning sequence

0. The farmer comes out of the farmhouse, stretches, and looks around (about 3 s). This beat does not depend on his decision, so the model call runs during it. [Hao, on agent proposal]
1. The farmer walks to each trace he decides to inspect. He can inspect only traces that are in that morning's list.
2. He says one line, for example, *"Who kicked a hole in my fence?!"* [Hao for the animation; agent proposal for the line]
3. A short "thinking" beat shows his options with their costs and the one he picks; his stamina and money bars drop. [Hao]
4. A sound cue and a caption say what kind of thing he did ("Something was hammered by the east gate."). New positions are not shown on the player's map. [Hao, on agent proposal] (See Q5 for how much of step 3 the player should see.)

### 5.9 Being spotted

The night ends at once. A gnome you are carrying goes back to its pedestal. You get one strike, and the farmer's next trace list includes the sighting. No chase in v1. [Hao, on agent proposal]

### 5.10 Win, failure, scoring

- A session is 5 nights. You win by stealing 5 gnomes. [Proposed]
- 3 strikes ends the session as a loss. [Proposed]
- Score: gnomes stolen, nights used, strikes taken. [Proposed]
- **End of a night, in order:** the night ends; if you were spotted, the gnome you carry returns to its pedestal and you get a strike; the night's changes (gates, padlocks, fences, pedestals) are applied to the farm; the game checks whether the session is over (last gnome taken, third strike, or night 5 finished); only if it continues does the farmer's morning happen. [Hao, on agent proposal]

### 5.11 Rule parameters

Placeholder values, to be tuned in playtests. [Hao, on agent proposal]

| Rule | v1 value |
| --- | --- |
| Movement and collision | Continuous movement; collision by whole tiles |
| Routes | 4-neighbour steps between tiles, no cutting corners. Passable: open ground, a closed plain gate (it can be opened for free), a broken fence. Not passable: a locked padlocked gate, an intact fence, hedges, the house. |
| Open route (the farmer's never-block check) | A route on which every closed padlocked gate or intact fence counts as passable for 1 stamina; the route must cost at most 1 stamina in total. Danger tiles are ignored. |
| Self-lock check | Uses routes only, with no stamina allowance: it asks whether you can walk out at all. Walking through danger gets you spotted, which ends the night, so it does not strand you. |
| Distance | Straight-line distance between tile centers |
| Lamp | Lights tiles within 2. Dense bush tiles shelter their occupant in the playable revision. |
| Dog | Alert radius 2 around the doghouse |
| Player sight | 5 tiles; hedges, bushes, and the house block the line of sight |
| Spotted | The center of the player's tile is on a lit tile, on the window's sight line, or inside a dog's radius |
| Footprints | One per soft tile entered, counted per named area (the areas are drawn in the map) |

Exact boundary semantics (the unit of `dt`, how a continuous position maps to a tile, whether a range includes its edge, a line of sight that grazes a corner) are fixed in code as named constants with tests in T8, then copied back here.

## 6. Intended dynamics

- **False trails:** players plant footprints or open gates to pull a lamp or the dog away, then check whether it worked.
- **Route variety:** because the farmer remembers recent nights and his defenses grow by one coin a day, a route that worked twice is likely to be covered.
- **Cleaning up versus speed:** spending a second stamina to re-lock a gate, or kicking a fence and accepting the trace.
- **Re-scouting:** a stale map pushes players to look before they commit.
- **The fully defended night:** when every reachable gnome is covered, a good move is to steal nothing and spend the night planting false trails, or breaking a lock or fence, to pull his budget and his lamps away. [Hao; restored on 2026-11-13 when the safe-route guarantee was dropped]
- **Sabotage as a lure:** break something tonight where you do not plan to steal; tomorrow he spends stamina repairing it or moves a lamp there, and the next night you take a gnome somewhere else. It costs your stamina and leaves a trace on purpose. [Hao]

## 7. Intended aesthetics (MDA)

Challenge first, with mischief: the farmer's lines and the gnomes themselves should be funny, and the danger should feel like a prank going wrong, not horror. [Hao]

## 8. Progression

Within a session, the farmer's knowledge of your habits grows, and so does his set of defenses, one coin a day. New interactables arrive slowly in later versions, at a Neighbours from Hell pace. [Hao] v1 has no progression across sessions.

## 9. Edge cases

| Case | Handling |
| --- | --- |
| Player ends the night without entering | Empty trace list. The farmer may still buy or move with his budget. |
| A barrier (padlock bought, padlock moved so its destination gate is locked, padlock re-locked, fence repaired) would leave no open route (at most 1 stamina, Section 5.11), or a defense would touch an entry's safe zone | The validator rejects it. The fallback applies, and the case is logged. |
| The plan costs more than his stamina or money | The validator rejects it; fallback; logged. |
| Agent output is invalid or late | The fallback farmer acts instead. The player sees the same morning sequence. The case is logged. |
| Spotted while carrying a gnome | Gnome returned, strike recorded. |
| A re-lock would shut you in | Refused with "You'd lock yourself in"; no stamina spent. |
| The game cannot reach the server for a morning | The rule-based farmer runs in the browser, and the rest of the session stays on it; the log records the switch. |
| Last gnome taken, or night 5 over | Session ends at once; no morning. |
| Out of stamina inside the farm | Red prompt on any stamina action; walk back to a dog hole; walking is free. |
| Third strike | Session ends immediately as a loss. |
| Night 5 ends with fewer than 5 gnomes | Session ends; the score is shown. [Open: whether that counts as a loss or a partial result] |

## 10. Balance

All numbers in Sections 5 and 9 are placeholders chosen for a small map, not tested values: map 24 × 18, 3 dog holes, 5 pedestals, 4 gates, player 2 stamina a night, farmer 2 stamina and +1 coin a morning, 5 nights, 3 strikes. The first playtests will tune them. Main balance risks: the farmer's defenses may pile up too fast by night 4 or 5, and the fallback may be too easy or the agent too strong. All three are measured in the evaluation plan.

## 11. Controls [Proposed]

On the first night, each entrance leads past a visible scroll that the player automatically collects within their first few steps. One short message explains the theft and escape. An upper-left pixel map marks north, the farmhouse and the selected entrance, then fills in as the player explores. [Hao, on agent proposal]

Arrow keys or WASD to move; E to interact (hold E for gates); E in a dog hole to end the night; M to show the full remembered map.

## 12. Feedback

- Lit tiles, the window's sight line (drawn broken behind cover), and the dog's radius are drawn on the ground.
- Footprints appear as you make them.
- Stamina pips (red prompt when empty), strike counter, night counter.
- Faded "last seen" defenses tagged with a night number.
- The morning sequence, including the farmer's stamina and money bars (Section 5.8).

## 13. Content scope

- **Included:** one farm map with 3 dog holes; one farmer agent with a stamina-and-money budget; lamps, doghouses, padlocks; plain and padlocked gates; fences; soft-ground footprints; pedestals; false trails; fog with "last seen"; 5 nights; the morning line and thinking beat; a switch between the agent and the rule-based farmer; session logs.
- **Excluded:** real-time patrols and chases; the farmer's decoys and traps; additional or procedurally generated maps; multiplayer; voice; a story campaign; art and animation beyond placeholder quality; mobile.
- **Cut first, in order:** (1) angled art, falling back to flat top-down tiles; (2) the doghouse, keeping lamps and padlocks; (3) money, keeping a 2-stamina budget; (4) memory across nights, so the farmer reads only last night. Cut (4) weakens the agent hypothesis, so it comes last.

[Hao, on agent proposal]

## 14. References and attribution

| Reference | What I take | What I change | Terms |
| --- | --- | --- | --- |
| *Neighbours from Hell* (JoWooD Productions, 2003, Windows) | Watching the person next door for openings; pets that alert him when you fail to sneak past; being caught ends the attempt; hiding behind cover; the hand-drawn look. Per Wikipedia and a 2003 Worthplaying review, its neighbour walks a set routine that a specific prank can interrupt, and his pets alert him; neither source describes adaptation to your traces across episodes. | Inverted structure: I sneak in at night, and the farmer changes his defenses in the morning from traces only, remembering earlier nights, on a visible daily budget. | Design and style reference only. No assets, code, names, or characters used. |
| *Stardew Valley* (ConcernedApe, 2016) | The angled top-down camera, tile readability, the farm setting. | Night stealth instead of farming. | Visual reference only. No assets used. |
| "Explored but not visible" fog in real-time strategy games (e.g., *StarCraft*), where the last-seen snapshot of structures stays on the map | Stale map memory. | The stale snapshot is the core of the loop: the farmer changes things while you cannot see. | Mechanic reference only. |
| Phaser (engine; version in the [Technical plan](architecture.md), Section 7) | Engine. | — | MIT License; to confirm on install. |
| Tiled (map editor) | Authoring the farm maps. | — | The editor is GPL-licensed; the map files are my own work. Recorded in `CREDITS.md`. |
| Art assets | Hand-drawn by me and my agents, or a CC0 pack where needed. | — | Every external asset's license recorded in `CREDITS.md` before use. |
| Model providers: Claude Sonnet 5.5 (primary), Gemini 3.5 Flash-Lite on Vertex AI (secondary) | The farmer's decisions. | — | Anthropic and Google Cloud terms and use policies, recorded in the Configuration Document. |

Notes from the Nov 9 first pitch round changed the concept: listeners could not tell who played whom or how to win in my earlier interrogation game, so I chose a game whose roles and goal are visible on screen. [Hao]

## 15. The agent in one paragraph

The farmer sees a trace list, his own layout, his remaining stamina and money, and short summaries of the last three mornings. He returns a plan of actions from an enumerated list (buy, move, repair) that fits his budget, the places he inspected, and one line of dialogue. The game validates the plan and applies it; if the call fails, times out, or returns an illegal plan, a deterministic rule-based farmer acts instead. The same rule-based farmer is the scripted baseline for comparison. Full specification: [Configuration Document](configuration.md).

## 16. Open questions

| ID | Question | Current proposal | Decide by |
| --- | --- | --- | --- |
| Q1 | Are 5 nights, 5 gnomes, 3 strikes, player 2 stamina, and farmer 2 stamina plus 1 coin a day the right numbers? | Placeholders. | First external playtest (G2) |
| Q2 | Do the farmer's defenses pile up too fast? Is there a cap per type? | No cap yet; watch night 4 and 5. | M1 self-playtest (T4) |
| Q3 | Does a false trail need its own action, or is walking on soft ground enough? | Walking is enough; opening a gate is the time-cost version. | M1 self-playtest (T4) |
| Q4 | When decoy gnomes and traps arrive (after v1), are they visible only within sight, and how does a decoy differ from a real gnome? | Out of v1. | After G3 |
| Q5 | How much of the farmer's morning should the player see: the inspected traces, the thinking beat with options, the moved category? | Show inspected traces, his line, the thinking beat without positions, and the category. | First external playtest |
| Q6 | Is a 24 × 18 farm large enough to feel like exploring, and small enough to finish by Gold (Dec 5)? | 24 × 18. | Greybox prototype |
| Q7 | Does night 5 ending without 5 gnomes count as a loss or a partial result? | Partial result with score. | Rule-farmer prototype |
| Q8 | Is a plain gate's free open and close too easy? | Free, but takes about 1 s in the open. | First external playtest |
| Q9 | ~~What does the never-seal rule require when the player's own theft leaves no safe route?~~ Decided 2026-11-13 by Hao: the safe-route guarantee is dropped; the open-route check (Section 5.7) applies only to plans that add a barrier, so no plan becomes illegal because of the player's theft. | Done |
| Q10 | Without a safe-route guarantee, can danger cover every gnome for several nights, so that false trails and sabotage stop working and the player is stuck? | Watch for it; no safety net unless the evidence shows it. | First external playtest (T14) |

## 17. Decision log

| Date | Decision | Origin | Status |
| --- | --- | --- | --- |
| 2026-11-10 | Change concept from the interrogation game to Gnome Heist | Hao | Decided |
| 2026-11-10 | Angled 2D camera; hedge-maze grounds; fog with "last seen"; free walking; actions cost stamina; end the night from outside; a limited opponent (first as two moves a morning, replaced by the daily budget on 2026-11-13); more gnomes than lamps; morning animation | Hao | Decided |
| 2026-11-12 | The opponent is an LLM with structured output, a validator, and a rule-based fallback | Agent proposal, accepted by Hao | Decided |
| 2026-11-12 | Scripted baseline is a rule-based opponent with the same information and budget (not a fixed routine) | Agent proposal, accepted by Hao | Decided |
| 2026-11-12 | TypeScript + Phaser 3 in the browser; Cloudflare Pages and a Worker for the model call (Phaser version changed to 4.2.1 on 2026-11-13) | Agent proposal, accepted by Hao | Decided |
| 2026-11-12 | Map about 24 × 18; morning shows inspected traces and the kind of change, not new positions; being spotted ends the night | Agent proposal, accepted by Hao | Decided |
| 2026-11-12 | Budgets come from a measured run of the model call | Agent proposal, accepted by Hao | Decided |
| 2026-11-12 | The opponent can switch between model providers (Vertex, Anthropic, OpenAI) through one interface | Hao (library choice, Vercel AI SDK, on agent proposal) | Decided |
| 2026-11-12 | Repository is private for now | Hao | Decided |
| 2026-11-12 | Default model: Claude Sonnet 5.5 with thinking off, after a 26-configuration latency/cost sweep | Hao, on agent proposal | Decided |
| 2026-11-12 | Support both Claude Sonnet 5.5 (primary) and Gemini 3.5 Flash-Lite (secondary), with the failover rule in the Configuration Document | Hao (both); failover rule on agent proposal, accepted by Hao | Decided |
| 2026-11-12 | Pillars (Section 4) and Risk Profile ratings (Project Plan Section 3) | Agent proposal, accepted by Hao | Decided |
| 2026-11-13 | The opponent is the farmer next door; the setting is his farm; the hand-drawn ink art direction | Hao | Decided |
| 2026-11-13 | Players enter only through fixed dog holes, which are safe zones the farmer cannot block | Hao (fixed entry); agent proposal for the 2-tile safe zone, accepted by Hao | Decided |
| 2026-11-13 | Plain gates cost time, padlocks and fences cost stamina, fences cannot be fixed the same night; player has 2 stamina; red prompt when empty | Hao (stamina, red prompt); agent proposal for the gate and fence table, accepted by Hao | Decided |
| 2026-11-13 | The farmer spends a daily budget (2 stamina, +1 coin) on buy, move, and repair, replacing the earlier fixed two moves | Hao (buy and move costs); agent proposal for the other values, accepted by Hao | Decided |
| 2026-11-13 | The stolen item stays a garden gnome (the title), shown with a glow where it is the goal | Agent proposal at Hao's request, accepted by Hao | Decided |
| 2026-11-13 | Build the real game from the start instead of a scripted mock-up demo; the G1 recording uses the deck, plus a real greybox clip only if one is playable | Agent proposal, accepted by Hao | Decided |
| 2026-11-13 | Phaser + TypeScript for the full game, with all rules in one engine-free `core/` package shared by the client, the Worker, and the tests; milestones M0 to M4 | Agent proposal, accepted by Hao | Decided |
| 2026-11-13 | Farm maps authored in Tiled | Agent proposal, accepted by Hao | Decided |
| 2026-11-13 | Phaser 4.2.1, with a fallback to 3.90.0 during M0 if the engine checks fail | Agent proposal, accepted by Hao | Decided |
| 2026-11-13 | Keep the never-seal rule; reword the fully defended night as the quiet night | Agent proposal (after the outside review found the two rules contradict), accepted by Hao | Decided |
| 2026-11-13 | A re-lock that would lock the player in is refused at no cost | Agent proposal, accepted by Hao | Decided |
| 2026-11-13 | The morning opens with a fixed beat (about 3 s) that covers the model call; he inspects only traces in that morning's list | Agent proposal, accepted by Hao | Decided |
| 2026-11-13 | Rule parameters (Section 5.11), the end-of-night order (Section 5.10), and the offline rule | Agent proposal, accepted by Hao | Decided (values are placeholders) |
| 2026-11-13 | The never-seal check uses safe routes that also avoid the window's sight line; the self-lock check asks only whether you can walk out; exact boundary semantics are fixed in code in T8 | Agent proposal after the second outside review, accepted by Hao | Decided |
| 2026-11-13 | Drop the safe-route guarantee: the farmer may cover every gnome with danger, but must keep an open route of at most 1 stamina; restore the fully defended night; add sabotage as a lure. This replaces the never-seal rows above for routes. | Hao (open-route form on agent proposal) | Decided |
| 2026-11-18 | Raise vegetation around readable paths, include stretches that show only the player’s hat, and allow full concealment in walk-in bushes | Hao | Decided |
| 2026-11-13 | He hates broken things: repairing first is his personality in the prompt, not a forced rule | Agent proposal (soft, not forced), accepted by Hao | Decided |
| 2026-11-13 | Moving a padlock so its destination gate is locked also triggers the existing open-route check; the check uses the layout after the whole plan | Codex proposal, accepted by Hao | Decided |
| 2026-11-24 | Prototype the first-night scroll pickup and pixel map at all three entrances, then observe orientation and the second-night route choice. | [Hao, on agent proposal] | Decided for the first prototype |
| 2026-11-24 | Use the dog-hole entry shot to introduce the exit and the first scroll. Shorten it on later nights and let movement interrupt it. | [Hao, on agent proposal] | Decided |
| 2026-11-24 | Begin the first night with a 2D daylight view of the estate, dusk and a lit farmhouse window. Push toward the chosen hole and join the existing crawl. | [Hao, on agent proposal] | Decided for the prototype |
