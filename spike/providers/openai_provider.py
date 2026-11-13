"""OpenAI (or an OpenAI-compatible endpoint) via the official openai SDK.

AI-use disclosure: written by Claude (Claude Code) under Hao's direction.
Environment: OPENAI_API_KEY and optional OPENAI_BASE_URL (both read by the SDK),
OPENAI_MODEL (required; no default is assumed).
"""

from __future__ import annotations

import os

from openai import OpenAI

from . import Result

REQUIRED_ENV = ("OPENAI_API_KEY", "OPENAI_MODEL")


def call(system: str, user: str, schema: dict, timeout_s: float) -> Result:
    model = os.environ["OPENAI_MODEL"]
    client = OpenAI(timeout=timeout_s, max_retries=0)
    r = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
        response_format={
            "type": "json_schema",
            "json_schema": {"name": "morning_plan", "schema": schema, "strict": True},
        },
    )
    u = r.usage
    details = getattr(u, "completion_tokens_details", None)
    return Result(
        text=r.choices[0].message.content or "",
        model=r.model,
        input_tokens=getattr(u, "prompt_tokens", None),
        output_tokens=getattr(u, "completion_tokens", None),
        thinking_tokens=getattr(details, "reasoning_tokens", None) if details else None,
        stop_reason=r.choices[0].finish_reason,
    )
