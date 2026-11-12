"""Gemini on Vertex AI via Google Application Default Credentials.

AI-use disclosure: written by Claude (Claude Code) under Hao's direction.
Environment: GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, VERTEX_MODEL.
"""

from __future__ import annotations

import os

from google import genai
from google.genai import types

from . import Result

REQUIRED_ENV = ("GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION", "VERTEX_MODEL")


def _to_gemini(schema: dict) -> dict:
    """Convert standard JSON Schema to the Gemini response_schema subset."""
    out: dict = {}
    for k, v in schema.items():
        if k == "additionalProperties":
            continue
        if k == "type":
            out[k] = v.upper()
        elif k == "properties":
            out[k] = {p: _to_gemini(s) for p, s in v.items()}
        elif k == "items":
            out[k] = _to_gemini(v)
        else:
            out[k] = v
    return out


def call(system: str, user: str, schema: dict, timeout_s: float) -> Result:
    model = os.environ["VERTEX_MODEL"]
    client = genai.Client(
        vertexai=True,
        project=os.environ["GOOGLE_CLOUD_PROJECT"],
        location=os.environ["GOOGLE_CLOUD_LOCATION"],
        http_options=types.HttpOptions(timeout=int(timeout_s * 1000)),
    )
    temperature = float(os.environ.get("VERTEX_TEMPERATURE", "0.7"))
    r = client.models.generate_content(
        model=model,
        contents=user,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            response_mime_type="application/json",
            response_schema=_to_gemini(schema),
            max_output_tokens=400,
        ),
    )
    u = r.usage_metadata
    return Result(
        text=r.text or "",
        model=model,
        input_tokens=getattr(u, "prompt_token_count", None),
        output_tokens=getattr(u, "candidates_token_count", None),
        thinking_tokens=getattr(u, "thoughts_token_count", None),
    )
