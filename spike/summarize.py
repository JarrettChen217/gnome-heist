"""Summarize measurement runs into a Markdown table.

AI-use disclosure: written by Claude (Claude Code) under Hao's direction.
Usage: python3 spike/summarize.py [--dir v0.3-sweep] [--since YYYYMMDD-HHMMSS]
Reads spike/results/*.json (one file per configuration run) and prints one row each.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

RESULTS = Path(__file__).parent / "results"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since", default="", help="only files whose name sorts at or after this stamp")
    ap.add_argument("--dir", default="", help="subfolder of spike/results, e.g. v0.3-sweep")
    args = ap.parse_args()
    rows = []
    for f in sorted((RESULTS / args.dir).glob("*.json")):
        if f.name < args.since:
            continue
        s = json.loads(f.read_text())["summary"]
        if "provider" not in s:
            continue
        if s.get("price_in_per_mtok") is not None and s.get("input_tokens_mean"):
            # Recompute: Gemini bills thinking tokens as output but reports them apart.
            out = (s.get("output_tokens_mean") or 0) + (
                (s.get("thinking_tokens_mean") or 0) if s["provider"] == "vertex" else 0)
            per_call = (s["input_tokens_mean"] * s["price_in_per_mtok"]
                        + out * s["price_out_per_mtok"]) / 1e6
            s["cost_per_call_usd"] = per_call
            s["cost_per_5_call_session_usd"] = 5 * per_call
        rows.append(s)
    order = {"anthropic": 0, "vertex": 1, "openai": 2}
    rows.sort(key=lambda s: (order.get(s["provider"], 9), s.get("model") or "", s.get("think") or ""))
    print("| Provider | Model | Thinking | Valid / calls | Same as rule | p50 s | p95 s | max s "
          "| In tok | Out tok | Thinking tok (Gemini, separate) | $ / call | $ / 5-night session |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    fmt = lambda v, n=2: "—" if v is None else (f"{v:.{n}f}" if isinstance(v, float) else str(v))
    for s in rows:
        print(f"| {s['provider']} | {s.get('model')} | {s.get('think', 'default')} "
              f"| {s['valid']}/{s['calls']} | {s.get('equals_rule', '—')}/{s.get('answered', s['calls'])} "
              f"| {fmt(s['latency_p50_s'])} | {fmt(s['latency_p95_s'])} | {fmt(s['latency_max_s'])} "
              f"| {fmt(s['input_tokens_mean'], 0)} | {fmt(s['output_tokens_mean'], 0)} "
              f"| {fmt(s.get('thinking_tokens_mean'), 0)} | {fmt(s.get('cost_per_call_usd'), 5)} "
              f"| {fmt(s.get('cost_per_5_call_session_usd'), 4)} |")


if __name__ == "__main__":
    main()
