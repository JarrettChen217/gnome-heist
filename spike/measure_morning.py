# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai>=1.0", "anthropic>=1.0", "openai>=1.0"]
# ///
"""G1 budget measurement for the Gnome Heist farmer agent (earlier two-move contract).

The SYSTEM prompt below is kept exactly as it was measured on 2026-11-12, so it still
uses the earlier wording; the current contract is in docs/configuration.md.

AI-use disclosure: written by Claude (Claude Code) under Hao's direction.

Sends one realistic morning input N times to one provider and records
wall-clock latency, token usage, output validity, and whether the move set
equals the rule-based baseline's. Credentials come from the environment or
from a gitignored .env at the repository root; nothing is written back.

Usage:
  uv run spike/measure_morning.py --provider vertex --calls 20
  uv run spike/measure_morning.py --provider anthropic --calls 20 --price-in 4 --price-out 20
  uv run spike/measure_morning.py --provider openai --calls 20 --price-in X --price-out Y
Prices are USD per 1M tokens, copied from the provider's official price page.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import statistics
import sys
import time
from pathlib import Path

import providers

ROOT = Path(__file__).resolve().parent.parent

SYSTEM = (
    "You are the neighbor in Gnome Heist. Someone has been stealing your garden "
    "gnomes at night. Each morning you see only the traces listed below and your "
    "notes from earlier mornings. You never saw the intruder's route. Choose exactly "
    "two moves from the allowed list to make tonight harder for them. Some traces may "
    "be fake. You may not block every route to your remaining gnomes. Answer only with "
    "JSON matching the schema. Your `line` is one short, grumpy, funny sentence about "
    "what you noticed (at most 80 characters), and it must not claim knowledge you do "
    "not have. Move format: move_lamp (defense = lamp id, to = lamp post id); move_dog "
    "(defense = \"dog\", to = dog spot id); lock (defense = \"lock\", to = gate id); "
    "hold (defense = any defense id, to = \"none\")."
)

ESTATE = {
    "lamps": ["lamp_a", "lamp_b"],
    "lamp_posts": ["post_gate_north", "post_gate_east", "post_rose_east",
                   "post_fountain", "post_shed", "post_hedge_west",
                   "post_pond", "post_porch"],
    "dog_spots": ["kennel_porch", "kennel_orchard", "kennel_maze_center"],
    "gates": ["gate_north", "gate_east", "gate_west", "gate_garden"],
    "areas": ["area_rosebed_east", "area_mud_orchard", "area_tulips_west",
              "area_herb_garden", "area_lawn"],
    "pedestals": ["ped_fountain", "ped_pond", "ped_shed", "ped_maze_center", "ped_porch"],
}

MORNING_INPUT = {
    "night": 3,
    "layout": {
        "lamp_a": "post_fountain", "lamp_b": "post_gate_north",
        "dog": "kennel_porch", "lock": "gate_west",
        "gates_left_open_by_you": ["gate_garden"],
    },
    "traces_today": {
        "footprints": [
            {"area": "area_rosebed_east", "count": 9},
            {"area": "area_tulips_west", "count": 4},
        ],
        "gates_changed": [{"gate": "gate_east", "you_left": "closed", "now": "open"}],
        "empty_pedestals": ["ped_pond"],
        "sighting": None,
    },
    "memory": [
        {"night": 1, "traces": "footprints rosebed_east x7; gate_east opened; ped_shed empty",
         "moves": ["move_lamp lamp_b -> post_gate_north", "hold dog"],
         "line": "Somebody trampled my roses. Rude."},
        {"night": 2, "traces": "footprints tulips_west x5; no gates changed; nothing taken",
         "moves": ["move_lamp lamp_a -> post_fountain", "lock gate_west"],
         "line": "Tulips flattened, nothing stolen. Practicing, are we?"},
    ],
}

# Provider-neutral JSON Schema (every field required, no extra keys) so the same
# contract works with Gemini, Claude structured outputs, and OpenAI strict mode.
SCHEMA = {
    "type": "object",
    "properties": {
        "moves": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {"type": "string", "enum": ["move_lamp", "move_dog", "lock", "hold"]},
                    "defense": {"type": "string", "enum": ESTATE["lamps"] + ["dog", "lock"]},
                    "to": {"type": "string", "enum": ESTATE["lamp_posts"] + ESTATE["dog_spots"]
                           + ESTATE["gates"] + ["none"]},
                },
                "required": ["type", "defense", "to"],
                "additionalProperties": False,
            },
        },
        "line": {"type": "string"},
        "inspected": {"type": "array", "items": {
            "type": "string", "enum": ESTATE["areas"] + ESTATE["gates"] + ESTATE["pedestals"]}},
    },
    "required": ["moves", "line", "inspected"],
    "additionalProperties": False,
}

# What the rule-based baseline did with MORNING_INPUT: a lamp to the post by the
# most-trampled area, and the lock to the gate whose state changed.
RULE_MOVES = {("move_lamp", "post_rose_east"), ("lock", "gate_east")}


def load_dotenv(path: Path) -> None:
    """Minimal .env reader: KEY=VALUE lines; empty values and existing env win."""
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.split(" #", 1)[0].strip().strip('"').strip("'")
        if value and key not in os.environ:
            os.environ[key] = value


def validate(out: dict) -> list[str]:
    """Legality checks only; the reachability check needs the real map."""
    errs: list[str] = []
    moves = out.get("moves", [])
    if len(moves) != 2:
        errs.append(f"expected 2 moves, got {len(moves)}")
    defenses = ESTATE["lamps"] + ["dog", "lock"]
    touched = []
    for m in moves:
        t, d, to = m.get("type"), m.get("defense"), m.get("to")
        ok = (
            (t == "move_lamp" and d in ESTATE["lamps"] and to in ESTATE["lamp_posts"])
            or (t == "move_dog" and d == "dog" and to in ESTATE["dog_spots"])
            or (t == "lock" and d == "lock" and to in ESTATE["gates"])
            or (t == "hold" and d in defenses and to == "none")
        )
        if not ok:
            errs.append(f"illegal move {m}")
        touched.append(d)
    if len(set(touched)) != len(touched):
        errs.append("two moves on one defense")
    if len(out.get("line", "")) > 80:
        errs.append("line longer than 80 characters")
    if any(a not in ESTATE["areas"] + ESTATE["gates"] + ESTATE["pedestals"]
           for a in out.get("inspected", [])):
        errs.append("inspected an unknown place")
    return errs


def equals_rule(out: dict) -> bool:
    return {(m.get("type"), m.get("to")) for m in out.get("moves", [])} == RULE_MOVES


def pct(xs: list[float], p: float) -> float:
    xs = sorted(xs)
    return xs[max(0, min(len(xs) - 1, round(p / 100 * (len(xs) - 1))))]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", choices=providers.PROVIDERS, default="vertex")
    ap.add_argument("--calls", type=int, default=20)
    ap.add_argument("--timeout-s", type=float, default=15.0)
    ap.add_argument("--price-in", type=float, help="USD per 1M input tokens")
    ap.add_argument("--price-out", type=float, help="USD per 1M output tokens")
    ap.add_argument("--model", help="override the provider's model setting")
    ap.add_argument("--think", help="vertex: minimal|low|medium|high; anthropic: "
                    "low|medium|high|xhigh|max effort, or 'off' (Sonnet/Haiku only)")
    args = ap.parse_args()
    if args.calls > 30:
        print("Refusing more than 30 calls in a measurement run.", file=sys.stderr)
        return 2

    load_dotenv(ROOT / ".env")
    if args.model:
        os.environ[{"vertex": "VERTEX_MODEL", "anthropic": "ANTHROPIC_MODEL",
                    "openai": "OPENAI_MODEL"}[args.provider]] = args.model
    if args.think and args.provider == "vertex":
        os.environ["VERTEX_THINKING_LEVEL"] = args.think
    elif args.think == "off" and args.provider == "anthropic":
        os.environ["ANTHROPIC_THINKING"], os.environ["ANTHROPIC_EFFORT"] = "off", "low"
    elif args.think and args.provider == "anthropic":
        os.environ["ANTHROPIC_EFFORT"] = args.think
    mod = providers.get(args.provider)
    missing = [k for k in mod.REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        print(f"Missing environment for {args.provider}: {', '.join(missing)}", file=sys.stderr)
        return 2

    user = "ESTATE:\n" + json.dumps(ESTATE) + "\n\nTODAY:\n" + json.dumps(MORNING_INPUT)
    rows = []
    for i in range(args.calls):
        t0 = time.perf_counter()
        row: dict = {"i": i}
        try:
            res = mod.call(SYSTEM, user, SCHEMA, args.timeout_s)
            row.update(latency_s=round(time.perf_counter() - t0, 3), model=res.model,
                       input_tokens=res.input_tokens, output_tokens=res.output_tokens,
                       thinking_tokens=res.thinking_tokens, stop_reason=res.stop_reason)
            try:
                out = json.loads(res.text)
                row["output"] = out
                row["errors"] = validate(out)
                row["equals_rule"] = equals_rule(out)
            except (json.JSONDecodeError, TypeError) as e:
                row["errors"] = [f"parse: {e}"]
        except Exception as e:  # provider error or timeout; never print credentials
            row["latency_s"] = round(time.perf_counter() - t0, 3)
            row["errors"] = [f"call failed: {type(e).__name__}: {str(e)[:150]}"]
        rows.append(row)
        print(f"{i:2d} {row['latency_s']:6.2f}s  errors={len(row['errors'])}"
              f"  rule={'=' if row.get('equals_rule') else '≠'}")

    answered = [r for r in rows if "output" in r]
    ok = [r for r in rows if not r["errors"]]
    lat = [r["latency_s"] for r in answered]
    mean = lambda key: round(statistics.mean(r[key] for r in answered if r.get(key) is not None), 1) \
        if any(r.get(key) is not None for r in answered) else None
    summary = {
        "run_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "provider": args.provider,
        "model": answered[0]["model"] if answered else (args.model or None),
        "think": args.think or "default",
        "prompt_version": "v0.3",
        "calls": len(rows), "answered": len(answered), "valid": len(ok),
        "equals_rule": sum(1 for r in answered if r.get("equals_rule")),
        "latency_p50_s": round(statistics.median(lat), 3) if lat else None,
        "latency_p95_s": round(pct(lat, 95), 3) if lat else None,
        "latency_max_s": round(max(lat), 3) if lat else None,
        "input_tokens_mean": mean("input_tokens"),
        "output_tokens_mean": mean("output_tokens"),
        "thinking_tokens_mean": mean("thinking_tokens"),
    }
    if args.price_in is not None and args.price_out is not None and summary["input_tokens_mean"]:
        # Gemini reports thinking tokens apart from output tokens but bills them as
        # output; Anthropic's output_tokens already include thinking.
        billed_out = (summary["output_tokens_mean"] or 0) + (
            (summary["thinking_tokens_mean"] or 0) if args.provider == "vertex" else 0)
        per_call = (summary["input_tokens_mean"] * args.price_in + billed_out * args.price_out) / 1e6
        summary.update(price_in_per_mtok=args.price_in, price_out_per_mtok=args.price_out,
                       cost_per_call_usd=round(per_call, 6),
                       cost_per_5_call_session_usd=round(5 * per_call, 5))
    out_dir = Path(__file__).parent / "results"
    out_dir.mkdir(exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    path = out_dir / f"{stamp}-{args.provider}-{summary['model']}-{summary['think']}.json"
    path.write_text(json.dumps({"summary": summary, "rows": rows}, indent=2))
    print(json.dumps(summary, indent=2))
    print(f"saved {path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
