AI-use disclosure: Claude (Claude Code) wrote the measurement scripts, ran the runs I approved, and drafted this summary; the model choice is mine.

# Budget measurement for the neighbor agent (G1)

All runs send one realistic night-3 input (2 memory entries, 2 footprint areas, 1 changed gate, 1 empty pedestal) and ask for exactly two moves, one line, and the inspected places. Calls go from my laptop, not yet from the Worker. Prices are list prices read on 2026-11-12 from the official pages (Anthropic pricing page; Vertex AI generative AI pricing page, global endpoint).

## Main result: v0.3 sweep (2026-11-12, 14:41 to 14:53 EST)

20 calls per configuration (5 for Gemini 4 Argon and Carbon), timeout 60 s, six configurations at a time. Output schema v0.3: every field required, and `defense`, `to`, `inspected` limited to real estate ids. "Same as rule" counts calls whose two moves equal the rule-based neighbor's choice on this input (lamp to the post by the most-trampled area, lock the changed gate). Claude output tokens include thinking; Gemini reports thinking separately and bills it as output, which the cost columns include.

| Provider | Model | Thinking | Valid / calls | Same as rule | p50 s | p95 s | max s | In tok | Out tok | Thinking tok (Gemini, separate) | $ / call | $ / 5-night session |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| anthropic | claude-haiku-5-5 | high | 19/20 | 4/20 | 5.10 | 6.12 | 7.64 | 1688 | 1059 | — | 0.00070 | 0.0035 |
| anthropic | claude-haiku-5-5 | low | 18/20 | 4/20 | 0.95 | 3.51 | 3.61 | 1688 | 249 | — | 0.00029 | 0.0015 |
| anthropic | claude-haiku-5-5 | medium | 18/20 | 5/20 | 4.09 | 4.95 | 5.03 | 1688 | 836 | — | 0.00059 | 0.0029 |
| anthropic | claude-haiku-5-5 | off | 19/20 | 1/20 | 1.19 | 1.76 | 1.91 | 1687 | 128 | — | 0.00023 | 0.0012 |
| anthropic | claude-opus-5-5 | high | 20/20 | 20/20 | 5.07 | 5.81 | 6.41 | 1688 | 447 | — | 0.01570 | 0.0785 |
| anthropic | claude-opus-5-5 | low | 20/20 | 18/20 | 2.41 | 2.97 | 3.40 | 1688 | 134 | — | 0.00944 | 0.0472 |
| anthropic | claude-opus-5-5 | medium | 20/20 | 20/20 | 4.80 | 6.01 | 6.70 | 1688 | 405 | — | 0.01484 | 0.0742 |
| anthropic | claude-sonnet-5-5 | high | 19/20 | 14/20 | 5.34 | 7.01 | 8.81 | 1688 | 659 | — | 0.00997 | 0.0498 |
| anthropic | claude-sonnet-5-5 | low | 20/20 | 0/20 | 2.04 | 3.10 | 3.40 | 1688 | 128 | — | 0.00466 | 0.0233 |
| anthropic | claude-sonnet-5-5 | medium | 20/20 | 0/20 | 2.12 | 2.93 | 3.40 | 1688 | 126 | — | 0.00463 | 0.0232 |
| anthropic | claude-sonnet-5-5 | off | 19/20 | 0/20 | 1.75 | 2.69 | 2.85 | 1687 | 126 | — | 0.00464 | 0.0232 |
| vertex | gemini-3.1-pro-preview | high | 19/20 | 9/19 | 15.19 | 19.84 | 21.01 | 1090 | 121 | 1332 | 0.01962 | 0.0981 |
| vertex | gemini-3.1-pro-preview | low | 20/20 | 5/20 | 6.75 | 9.55 | 11.60 | 1090 | 129 | 399 | 0.00851 | 0.0426 |
| vertex | gemini-3.1-pro-preview | medium | 20/20 | 6/20 | 10.24 | 13.56 | 13.78 | 1090 | 127 | 771 | 0.01295 | 0.0648 |
| vertex | gemini-3.5-flash-lite | high | 20/20 | 0/20 | 6.34 | 8.48 | 11.42 | 1090 | 91 | 1982 | 0.00551 | 0.0275 |
| vertex | gemini-3.5-flash-lite | low | 20/20 | 2/20 | 1.43 | 1.73 | 1.77 | 1090 | 93 | — | 0.00056 | 0.0028 |
| vertex | gemini-3.5-flash-lite | medium | 20/20 | 0/20 | 2.45 | 9.44 | 23.34 | 1090 | 96 | 995 | 0.00305 | 0.0153 |
| vertex | gemini-3.5-flash-lite | minimal | 20/20 | 1/20 | 1.50 | 1.75 | 1.94 | 1090 | 116 | — | 0.00062 | 0.0031 |
| vertex | gemini-3.8-flash | high | 20/20 | 11/20 | 15.24 | 27.25 | 27.79 | 1090 | 82 | 2094 | 0.01795 | 0.0898 |
| vertex | gemini-3.8-flash | low | 20/20 | 15/20 | 3.41 | 12.39 | 29.25 | 1090 | 111 | 297 | 0.00470 | 0.0235 |
| vertex | gemini-3.8-flash | medium | 20/20 | 9/20 | 7.60 | 16.82 | 24.52 | 1090 | 96 | 696 | 0.00757 | 0.0379 |
| vertex | gemini-4-argon | high | 4/5 | 2/4 | 28.56 | 30.14 | 30.14 | 1227 | 108 | 1462 | 0.01815 | 0.0907 |
| vertex | gemini-4-carbon | high | 0/5 | 0/0 | — | — | — | — | — | — | — | — |
| vertex | gemini-4-hydrogen | high | 20/20 | 18/20 | 11.17 | 21.47 | 23.66 | 1227 | 122 | 1382 | 0.01312 | 0.0656 |
| vertex | gemini-4-hydrogen | low | 20/20 | 12/20 | 5.63 | 23.53 | 35.66 | 1227 | 148 | 520 | 0.00685 | 0.0342 |
| vertex | gemini-4-hydrogen | medium | 20/20 | 17/20 | 11.48 | 24.12 | 36.73 | 1227 | 123 | 1422 | 0.01342 | 0.0671 |

Raw rows: [`results/v0.3-sweep/`](results/v0.3-sweep/). Rebuild the table with `python3 spike/summarize.py --dir v0.3-sweep`.

## What the numbers say

- **Inside the 4 s budget (p95 under 4 s):** Claude Sonnet 5.5 with thinking off, low, or medium (p95 2.7 to 3.1 s); Claude Opus 5.5 low (3.0 s); Claude Haiku 5.5 off or low (1.8 to 3.5 s); Gemini 3.5 Flash-Lite minimal or low (1.75 s). Gemini 3.1 Pro, Gemini 3.8 Flash, and all Gemini 4 models have p95 between 9.5 and 30 s on this day; Gemini 4 Carbon timed out on 5 of 5 calls.
- **Validity:** with schema v0.3 almost every configuration returns legal moves. The remaining failures are lines over 80 characters (Haiku most often) and one empty Gemini 3.1 Pro response.
- **Deeper thinking copies the rule.** Opus 5.5 matches the rule-based neighbor on 18 to 20 of 20 calls at every effort level; Sonnet 5.5 matches it 14 of 20 at high effort and 0 of 20 at off, low, or medium.
- **"Different from the rule" is not yet "better."** Sonnet low still chose one move set on 17 of 20 calls (lock the east gate, dog to the orchard): different from the rule, but just as fixed on this input. Gemini 3.5 Flash-Lite varied most (7 distinct move sets) but once invented a detail ("my poor ceramic duck"). Whether the agent reads memory and fake trails better than the rule needs a designed set of trace sequences (Project Plan T13) and playtests, not this single input.
- **Cost is small for every candidate:** $0.001 to $0.05 per five-night session for the configurations inside the latency budget.

## Recommendation (agent proposal; decision is Hao's, Configuration Document C8)

- Default: **Claude Sonnet 5.5, thinking off** (p95 2.69 s, 19/20 valid, about $0.023 per session). Its key fits in a Worker secret, which avoids the Vertex service-account question (C7).
- Course-funded alternative: **Gemini 3.5 Flash-Lite, thinking low** (p95 1.73 s, 20/20 valid, about $0.003 per session), if Vertex works from the Worker.
- Not used: Opus (copies the rule, highest cost), Gemini Pro, Gemini 3.8 Flash, Gemini 4 (too slow today).

## Earlier runs, kept for the record

| Folder | What it was | What we learned |
| --- | --- | --- |
| [`results/v0/`](results/v0/) | 13:51 first measurement, Gemini 3.5 Flash-Lite only, prompt v0, 20 calls | p95 1.56 s; 14 of 20 matched the rule |
| [`results/v0.1-sweep/`](results/v0.1-sweep/) | 14:15 sweep with schema v0.1 | The `inspected` field was unconstrained; Claude wrote labels like `footprints:area_rosebed_east`, which the validator rejected. A contract bug, fixed in v0.2. The raw file for Gemini 3.5 Flash-Lite low was deleted by mistake during cleanup; its summary was 20/20 valid, 5/20 same as rule, p95 1.91 s. |
| [`results/v0.2-sweep-failed-gemini/`](results/v0.2-sweep-failed-gemini/) | 14:36 sweep with schema v0.2 | Every Gemini call failed: Gemini rejects an empty string in an enum. Fixed in v0.3 by using `"none"`. |

## Running it

Copy `.env.example` to `.env` (gitignored) and fill in the providers you use. Then either one configuration:

```bash
uv run spike/measure_neighbor.py --provider anthropic --model claude-sonnet-5-5 --think off --calls 20 --price-in 2 --price-out 10
```

or the whole sweep: `./spike/run_matrix.sh` (configurations and prices are listed in the script).

**Limits:** one input, one day, laptop network; latency from the deployed Worker is re-measured for the Nov 23 checkpoint. Preview and newly released models (Gemini 3.1 Pro preview, Gemini 4) may change speed quickly.
