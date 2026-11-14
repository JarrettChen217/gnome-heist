AI-use disclosure: Claude (Claude Code) drew this diagram from the GDD and Configuration Document; I reviewed the boundary it shows.

# Gnome Heist: Systems diagram (G1, planned)

The diagram shows the five required elements: state, player input, agent context and actions, validation, and feedback. The dashed box is the farmer agent's knowledge boundary: only the trace list, his own layout and budget, and his memory cross into it. Nothing here is implemented yet.

```mermaid
flowchart LR
  subgraph NIGHT["Night (deterministic game code)"]
    IN["Player input<br/>move · pick lock / kick fence · dig gnome<br/>leave through a dog hole"]
    WS[("World state (authoritative)<br/>map, gates, padlocks, fences, defenses,<br/>pedestals, player position, stamina,<br/>strikes, night number, full action log")]
    PV["Player view<br/>fog of war + 'last seen' snapshot"]
    IN --> WS
    WS --> PV
  end

  TX["Trace extractor<br/>footprints by area · gates and padlocks changed<br/>broken fences · empty pedestals · sighting tile"]
  WS -- "end of night" --> TX

  subgraph AGENT["Farmer's knowledge boundary"]
    CTX["Agent context<br/>farm slots · his layout · stamina 2 · money<br/>today's traces · memory: last 3 mornings"]
    LLM["Farmer agent (Claude Sonnet 5.5)<br/>Cloudflare Worker, one session state<br/>returns a plan (buy / move / repair) + 1 line + inspected places"]
    CTX --> LLM
  end
  TX --> CTX

  VAL{"Validator<br/>schema · legal ids · within budget<br/>no dog-hole safe zone · a route stays open<br/>line check · 4 s timeout"}
  LLM --> VAL
  FB["Fallback: Gemini Flash-Lite on a fast error,<br/>otherwise the rule-based farmer<br/>(also the scripted baseline)"]
  VAL -- "invalid or late" --> FB
  FB --> APPLY
  VAL -- "valid" --> APPLY["Apply plan to world state"]
  APPLY --> WS
  APPLY --> LOG[("Trace log<br/>input, output, policy, latency, tokens")]

  APPLY --> MORN["Feedback: morning sequence<br/>farmer walks to inspected traces, says his line,<br/>thinking beat with costs, caption names the kind of change<br/>(new positions NOT shown)"]
  MORN --> PV
```

Implementation note: the night rules, trace extractor, context builder, validator, and rule-based farmer are all in the shared `core/` package, so the client and the Worker run the same code ([Technical plan](architecture.md), Section 4).

What the farmer **never** receives: the player's path, position, dog hole used, stamina, strikes, remaining nights, fog memory, or intent. See [Configuration Document, Section A2](configuration.md#a2-world-state-and-what-the-agent-knows).
