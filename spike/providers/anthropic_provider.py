"""Claude via the official Anthropic Python SDK.

AI-use disclosure: written by Claude (Claude Code) under Hao's direction.
Environment: ANTHROPIC_API_KEY and optional ANTHROPIC_BASE_URL (both read by
the SDK), ANTHROPIC_MODEL (default claude-opus-5-5), ANTHROPIC_EFFORT
(low | medium | high | xhigh | max; default low), ANTHROPIC_THINKING
(adaptive | off; default adaptive), ANTHROPIC_FALLBACKS (on | off; default on).
"""

from __future__ import annotations

import os

import anthropic

from . import Result

REQUIRED_ENV = ("ANTHROPIC_API_KEY",)


def _thinking_off(model: str) -> dict:
    # Thinking cannot be turned off on Claude Opus 5.5. Claude Sonnet 5.5 turns it off
    # with "between_tools" (effort high or below); Claude Haiku 5.5 with "disabled"
    # (effort high or below).
    if model.startswith("claude-sonnet-5-5"):
        return {"type": "between_tools"}
    if model.startswith("claude-haiku-5-5"):
        return {"type": "disabled"}
    raise ValueError(f"thinking cannot be turned off on {model}")


def call(system: str, user: str, schema: dict, timeout_s: float) -> Result:
    model = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5")
    effort = os.environ.get("ANTHROPIC_EFFORT", "low")
    thinking = os.environ.get("ANTHROPIC_THINKING", "adaptive")
    # Credentials and ANTHROPIC_BASE_URL are resolved by the SDK from the environment.
    client = anthropic.Anthropic(timeout=timeout_s, max_retries=0)
    kwargs = dict(
        model=model,
        max_tokens=8000,  # thinking counts toward this cap
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
    )
    if thinking == "off":
        kwargs["thinking"] = _thinking_off(model)
    # Server-side refusal fallback: on by default for Opus and Sonnet; Haiku 5.5 has
    # no server-side fallback.
    use_fallbacks = (os.environ.get("ANTHROPIC_FALLBACKS", "on") != "off"
                     and not model.startswith("claude-haiku"))
    if use_fallbacks:
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
