AI-use disclosure: Claude (Claude Code) drew this diagram from the GDD and Configuration Document; I reviewed the boundary it shows.

# Gnome Heist: Systems diagram (G1, planned)

The diagram shows the five required elements: state, player input, agent context and actions, validation, and feedback. The dashed box is the neighbor agent's knowledge boundary: only the trace list, his own layout, and his memory cross into it. Nothing here is implemented yet.

```mermaid
flowchart LR
  subgraph NIGHT["Night (deterministic game code)"]
    IN["Player input<br/>move · take gnome · open/close gate<br/>end night in safe zone"]
    WS[("World state (authoritative)<br/>map, gates, defenses, pedestals,<br/>player position, stamina, strikes,<br/>night number, full action log")]
    PV["Player view<br/>fog of war + 'last seen' snapshot"]
    IN --> WS
    WS --> PV
  end

  TX["Trace extractor<br/>footprints by area · gates changed vs his layout<br/>empty pedestals · sighting tile"]
  WS -- "end of night" --> TX

  subgraph AGENT["Neighbor's knowledge boundary"]
    CTX["Agent context<br/>estate slots · his layout · today's traces<br/>memory: last 3 mornings"]
    LLM["Neighbor agent (LLM)<br/>Cloudflare Worker, one session state<br/>returns 2 moves + 1 line + inspected areas"]
    CTX --> LLM
  end
  TX --> CTX

  VAL{"Validator<br/>schema · legal ids · exactly 2 moves<br/>reachability invariant · line check<br/>timeout"}
  LLM --> VAL
  FB["Fallback: rule-based neighbor<br/>(also the scripted baseline)"]
  VAL -- "invalid or timeout" --> FB
  FB --> APPLY
  VAL -- "valid" --> APPLY["Apply moves to world state"]
  APPLY --> WS
  APPLY --> LOG[("Trace log<br/>input, output, policy, latency, tokens")]

  APPLY --> MORN["Feedback: morning sequence<br/>neighbor walks to inspected traces,<br/>says his line, caption names the moved category<br/>(new positions NOT shown)"]
  MORN --> PV
```

What the neighbor **never** receives: the player's path, position, stamina, strikes, remaining nights, fog memory, or intent. See [Configuration Document, Section A2](configuration.md#a2-world-state-and-what-the-agent-knows).
