#!/usr/bin/env bash
# AI-use disclosure: written by Claude (Claude Code) under Hao's direction.
# Model x thinking-level sweep for the neighbor agent: 20 calls per configuration,
# 6 configurations at a time (calls within one configuration run one after another).
# Prices: USD per 1M input / output tokens, list prices read on 2026-11-12.
# Optional 6th column: calls for that configuration (Gemini 4 Argon/Carbon: 5, often timing out).
# Argon/Carbon prices are the rate through 2026-11-30; from 2026-12-01 they are 4 / 20.
set -euo pipefail
cd "$(dirname "$0")/.."
CALLS="${CALLS:-20}"

configs=(
  "anthropic claude-opus-5-5   low     4    20"
  "anthropic claude-opus-5-5   medium  4    20"
  "anthropic claude-opus-5-5   high    4    20"
  "anthropic claude-sonnet-5-5 off     2    10"
  "anthropic claude-sonnet-5-5 low     2    10"
  "anthropic claude-sonnet-5-5 medium  2    10"
  "anthropic claude-sonnet-5-5 high    2    10"
  "anthropic claude-haiku-5-5  off     0.10 0.50"
  "anthropic claude-haiku-5-5  low     0.10 0.50"
  "anthropic claude-haiku-5-5  medium  0.10 0.50"
  "anthropic claude-haiku-5-5  high    0.10 0.50"
  "vertex gemini-3.1-pro-preview low     2    12"
  "vertex gemini-3.1-pro-preview medium  2    12"
  "vertex gemini-3.1-pro-preview high    2    12"
  "vertex gemini-3.8-flash       low     1.50 7.50"
  "vertex gemini-3.8-flash       medium  1.50 7.50"
  "vertex gemini-3.8-flash       high    1.50 7.50"
  "vertex gemini-3.5-flash-lite  minimal 0.30 2.50"
  "vertex gemini-3.5-flash-lite  low     0.30 2.50"
  "vertex gemini-3.5-flash-lite  medium  0.30 2.50"
  "vertex gemini-3.5-flash-lite  high    0.30 2.50"
  "vertex gemini-4-hydrogen      low     1.50 7.50"
  "vertex gemini-4-hydrogen      medium  1.50 7.50"
  "vertex gemini-4-hydrogen      high    1.50 7.50"
  "vertex gemini-4-argon         high    2    10   5"
  "vertex gemini-4-carbon        high    2    10   5"
)

mkdir -p spike/results/logs
printf '%s\n' "${configs[@]}" | xargs -P 6 -L 1 bash -c '
  provider=$0 model=$1 think=$2 pin=$3 pout=$4 n=${5:-'"$CALLS"'}
  uv run -q spike/measure_neighbor.py --provider "$provider" --model "$model" \
    --think "$think" --calls "$n" --timeout-s 60 --price-in "$pin" --price-out "$pout" \
    > "spike/results/logs/$model-$think.log" 2>&1 \
    && echo "done $model $think" || echo "FAILED $model $think"
'
