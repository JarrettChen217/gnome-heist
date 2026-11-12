# /// script
# requires-python = ">=3.11"
# dependencies = ["google-genai>=1.0"]
# ///
"""G1 budget measurement for the Gnome Heist neighbor agent.

AI-use disclosure: written by Claude (Claude Code) under Hao's direction.

Sends one realistic morning input N times to a Gemini model on Vertex AI and
records wall-clock latency, token usage, and output validity. Uses Google
Application Default Credentials; no key is read from or written to any file.

Required environment: GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, COURSE_MODEL.
Usage: uv run spike/measure_neighbor.py --calls 20
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

from google import genai
from google.genai import types

SYSTEM = (
    "You are the neighbor in Gnome Heist. Someone has been stealing your garden "
    "gnomes at night. Each morning you see only the traces listed below and your "
    "notes from earlier mornings. You never saw the intruder's route. Choose exactly "
    "two moves from the allowed list to make tonight harder for them. Some traces may "
    "be fake. You may not block every route to your remaining gnomes. Answer only with "
    "JSON matching the schema. Your `line` is one short, grumpy, funny sentence about "
    "what you noticed, and it must not claim knowledge you do not have."
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

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "moves": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "type": {"type": "STRING", "enum": ["move_lamp", "move_dog", "lock", "hold"]},
                    "lamp": {"type": "STRING"},
                    "to": {"type": "STRING"},
                    "spot": {"type": "STRING"},
                    "gate": {"type": "STRING"},
                    "defense": {"type": "STRING"},
                },
                "required": ["type"],
            },
        },
        "line": {"type": "STRING"},
        "inspected": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["moves", "line", "inspected"],
}


def validate(out: dict) -> list[str]:
    """Legality checks only; the reachability check needs the real map."""
    errs: list[str] = []
    moves = out.get("moves", [])
    if len(moves) != 2:
        errs.append(f"expected 2 moves, got {len(moves)}")
    touched = []
    for m in moves:
        t = m.get("type")
        if t == "move_lamp":
            if m.get("lamp") not in ESTATE["lamps"] or m.get("to") not in ESTATE["lamp_posts"]:
                errs.append(f"bad lamp move {m}")
            touched.append(m.get("lamp"))
        elif t == "move_dog":
            if m.get("spot") not in ESTATE["dog_spots"]:
                errs.append(f"bad dog move {m}")
            touched.append("dog")
        elif t == "lock":
            if m.get("gate") not in ESTATE["gates"]:
                errs.append(f"bad lock move {m}")
            touched.append("lock")
        elif t == "hold":
            d = m.get("defense")
            if d not in ESTATE["lamps"] + ["dog", "lock"]:
                errs.append(f"bad hold {m}")
            touched.append(d)
        else:
            errs.append(f"unknown move {m}")
    if len(set(touched)) != len(touched):
        errs.append("two moves on one defense")
    if len(out.get("line", "")) > 80:
        errs.append("line longer than 80 characters")
    if any(a not in ESTATE["areas"] + ESTATE["gates"] + ESTATE["pedestals"]
           for a in out.get("inspected", [])):
        errs.append("inspected an unknown place")
    return errs


def pct(xs: list[float], p: float) -> float:
    xs = sorted(xs)
    k = max(0, min(len(xs) - 1, round(p / 100 * (len(xs) - 1))))
    return xs[k]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--calls", type=int, default=20)
    ap.add_argument("--temperature", type=float, default=0.7)
    ap.add_argument("--timeout-s", type=float, default=15.0)
    args = ap.parse_args()
    if args.calls > 30:
        print("Refusing more than 30 calls in a measurement run.", file=sys.stderr)
        return 2

    missing = [k for k in ("GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION", "COURSE_MODEL")
               if not os.environ.get(k)]
    if missing:
        print(f"Missing environment: {', '.join(missing)}", file=sys.stderr)
        return 2
    model = os.environ["COURSE_MODEL"]
    client = genai.Client(vertexai=True, project=os.environ["GOOGLE_CLOUD_PROJECT"],
                          location=os.environ["GOOGLE_CLOUD_LOCATION"],
                          http_options=types.HttpOptions(timeout=int(args.timeout_s * 1000)))
    user = ("ESTATE:\n" + json.dumps(ESTATE) + "\n\nTODAY:\n" + json.dumps(MORNING_INPUT))
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM, temperature=args.temperature,
        response_mime_type="application/json", response_schema=SCHEMA,
        max_output_tokens=400)

    rows = []
    for i in range(args.calls):
        t0 = time.perf_counter()
        row: dict = {"i": i}
        try:
            r = client.models.generate_content(model=model, contents=user, config=config)
            row["latency_s"] = round(time.perf_counter() - t0, 3)
            u = r.usage_metadata
            row["input_tokens"] = getattr(u, "prompt_token_count", None)
            row["output_tokens"] = getattr(u, "candidates_token_count", None)
            row["thinking_tokens"] = getattr(u, "thoughts_token_count", None)
            try:
                out = json.loads(r.text)
                row["errors"] = validate(out)
                row["output"] = out
            except (json.JSONDecodeError, TypeError) as e:
                row["errors"] = [f"parse: {e}"]
        except Exception as e:  # provider error or timeout
            row["latency_s"] = round(time.perf_counter() - t0, 3)
            row["errors"] = [f"call failed: {type(e).__name__}: {e}"[:300]]
        rows.append(row)
        print(f"{i:2d} {row['latency_s']:6.2f}s  errors={len(row['errors'])}")

    ok = [r for r in rows if not r["errors"]]
    lat = [r["latency_s"] for r in rows if "output" in r]
    summary = {
        "run_at": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
        "model": model, "location": os.environ["GOOGLE_CLOUD_LOCATION"],
        "temperature": args.temperature, "calls": len(rows), "valid": len(ok),
        "latency_p50_s": round(statistics.median(lat), 3) if lat else None,
        "latency_p95_s": round(pct(lat, 95), 3) if lat else None,
        "latency_max_s": round(max(lat), 3) if lat else None,
        "input_tokens_mean": round(statistics.mean(r["input_tokens"] for r in ok if r.get("input_tokens")), 1) if ok else None,
        "output_tokens_mean": round(statistics.mean(r["output_tokens"] for r in ok if r.get("output_tokens")), 1) if ok else None,
        "price_source": "fill in: official price page URL and date",
    }
    out_dir = Path(__file__).parent / "results"
    out_dir.mkdir(exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    path = out_dir / f"{stamp}-{model}.json"
    path.write_text(json.dumps({"summary": summary, "rows": rows}, indent=2))
    print(json.dumps(summary, indent=2))
    print(f"saved {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
