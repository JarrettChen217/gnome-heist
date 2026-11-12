"""One adapter per model provider for the budget measurement.

AI-use disclosure: written by Claude (Claude Code) under Hao's direction.

Each adapter exposes ``call(system, user, schema, timeout_s) -> Result`` and
returns the raw JSON text plus token usage, so measurements stay comparable.
Credentials come only from the environment (or ``.env``), never from code.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Result:
    text: str
    model: str
    input_tokens: int | None
    output_tokens: int | None
    thinking_tokens: int | None = None
    stop_reason: str | None = None


PROVIDERS = ("vertex", "anthropic", "openai")


def get(provider: str):
    if provider == "vertex":
        from . import vertex as mod
    elif provider == "anthropic":
        from . import anthropic_provider as mod
    elif provider == "openai":
        from . import openai_provider as mod
    else:
        raise ValueError(f"unknown provider {provider!r}; choose from {PROVIDERS}")
    return mod
