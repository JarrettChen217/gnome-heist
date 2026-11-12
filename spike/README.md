AI-use disclosure: Claude (Claude Code) wrote the measurement script and this summary; I approved the run and its spending.

# Budget measurement for the neighbor agent (G1)

**Run:** 2026-11-12 13:51 EST, `gemini-3.5-flash-lite`, Vertex AI global endpoint, temperature 0.7, 20 calls, one realistic night-3 input (2 memory entries, 2 footprint areas, 1 changed gate, 1 empty pedestal). Called from my laptop, not yet from the Worker.

Raw rows: [`results/20261112-135109-gemini-3.5-flash-lite.json`](results/20261112-135109-gemini-3.5-flash-lite.json). Reproduce:

```bash
GOOGLE_CLOUD_PROJECT=<project> GOOGLE_CLOUD_LOCATION=global COURSE_MODEL=gemini-3.5-flash-lite \
  uv run spike/measure_neighbor.py --calls 20
```

| Measure | Result |
| --- | --- |
| Calls returned | 20 of 20 |
| Latency p50 / p95 / max | 0.98 s / 1.56 s / 2.86 s (the maximum was the first call) |
| Tokens per call (mean) | 859 input, 108 output |
| Fully valid outputs | 16 of 20. All 40 moves were legal; the 4 failures were lines over 80 characters. |
| Distinct move sets | 3. The most common set (14 of 20) equals the rule-based neighbor's choice: lamp to the most-trampled area, lock the changed gate. |

**Cost.** Vertex AI Standard pay-as-you-go, global endpoint, Gemini 3.5 Flash-Lite: $0.30 per 1M input tokens and $2.50 per 1M output tokens (response and reasoning), read on 2026-11-12 from https://cloud.google.com/vertex-ai/generative-ai/pricing. That gives about $0.00053 per call, about $0.0026 per 5-night session, and at most about $0.007 with 10 calls and a longer night-5 input.

**What this does not show.** Latency from the deployed Worker; behavior on other inputs; whether players notice any difference. The 14-of-20 match with the rule is a first sign that prompt v0 adds little over the baseline on this input.
