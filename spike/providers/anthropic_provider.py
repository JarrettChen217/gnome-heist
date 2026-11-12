"""Claude via the official Anthropic Python SDK.

AI-use disclosure: written by Claude (Claude Code) under Hao's direction.
Environment: ANTHROPIC_API_KEY (read by the SDK), optional ANTHROPIC_BASE_URL
(read by the SDK), ANTHROPIC_MODEL (default claude-opus-5-5),
ANTHROPIC_EFFORT (default low), ANTHROPIC_FALLBACKS (default on).
"""

from __future__ import annotations

import os

import anthropic

from . import Result

REQUIRED_ENV = ("ANTHROPIC_API_KEY",)


def call(system: str, user: str, schema: dict, timeout_s: float) -> Result:
    model = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5")
    effort = os.environ.get("ANTHROPIC_EFFORT", "low")
    # Credentials and ANTHROPIC_BASE_URL are resolved by the SDK from the environment.
    client = anthropic.Anthropic(timeout=timeout_s, max_retries=0)
    kwargs = dict(
        model=model,
        max_tokens=2000,  # adaptive thinking counts toward this cap
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
    )
    if os.environ.get("ANTHROPIC_FALLBACKS", "on") != "off":
        # Server-side refusal fallback; set ANTHROPIC_FALLBACKS=off for gateways that reject it.
        r = client.beta.messages.create(
            betas=["server-side-fallback-2026-07-01"], fallbacks="default", **kwargs
        )
    else:
        r = client.messages.create(**kwargs)

    if r.stop_reason == "refusal":
        return Result(text="", model=r.model, input_tokens=r.usage.input_tokens,
                      output_tokens=r.usage.output_tokens, stop_reason="refusal")
    text = next((b.text for b in r.content if b.type == "text"), "")
    return Result(
        text=text,
        model=r.model,
        input_tokens=r.usage.input_tokens,
        output_tokens=r.usage.output_tokens,  # includes thinking tokens
        stop_reason=r.stop_reason,
    )
