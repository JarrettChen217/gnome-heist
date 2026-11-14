// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7, T11a); ruleFarmer and validatePlan are placeholders until T10.

import { MAX_LINE_LENGTH } from './rules.ts';
import type { FarmerContext, FarmerState, Plan, PlanAction, Trace, ValidationResult } from './types.ts';

/** Field by field, so extra fields from a model's output never reach memory or the next prompt. */
function copyAction(a: PlanAction): PlanAction {
  switch (a.type) {
    case 'buy':
      return { type: 'buy', target: a.target, to: a.to };
    case 'move':
      return { type: 'move', target: a.target, to: a.to };
    case 'repair':
      return { type: 'repair', target: a.target, to: 'none' };
  }
}

/** Field by field; `count` only for footprints. */
function copyTrace(t: Trace): Trace {
  return t.kind === 'footprints' && typeof t.count === 'number'
    ? { id: t.id, kind: t.kind, target: t.target, count: t.count }
    : { id: t.id, kind: t.kind, target: t.target };
}

/**
 * Builds the farmer's context as a new object from an explicit allowlist
 * (Technical plan Section 4.2). Never spread a larger object into it.
 */
export function buildFarmerContext(input: { farmer: FarmerState; tracesToday: readonly Trace[] }): FarmerContext {
  return {
    tracesToday: input.tracesToday.map(copyTrace),
    layout: input.farmer.layout.map((d) => ({ id: d.id, kind: d.kind, slot: d.slot })),
    stamina: input.farmer.stamina,
    money: input.farmer.money,
    memory: input.farmer.memory.map((m) => ({
      traces: m.traces.map(copyTrace),
      actions: m.actions.map(copyAction),
      line: m.line,
    })),
  };
}

export const PLACEHOLDER_RULE_LINE = 'Hmm. Quiet night, or so it seems.';

/**
 * PLACEHOLDER for M0: returns one fixed plan that is always legal (an empty
 * action list; GDD 5.7 says doing nothing is always allowed). The real
 * rule-based farmer (Configuration Document A9) replaces this in T10.
 */
export function ruleFarmer(_context: FarmerContext): Plan {
  return { actions: [], line: PLACEHOLDER_RULE_LINE, inspected: [] };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/**
 * PLACEHOLDER for M0. Checks only the plan's shape, the line length, and that
 * every inspected id is a trace today. Any non-empty action list is rejected
 * until the legality, budget and open-route checks exist (T10).
 */
export function validatePlan(context: FarmerContext, plan: unknown): ValidationResult {
  const violations: string[] = [];
  if (!isRecord(plan)) return { ok: false, violations: ['plan is not an object'] };
  const { actions, line, inspected } = plan;
  if (!Array.isArray(actions)) violations.push('actions must be an array');
  else if (actions.length > 0) violations.push('actions are not validated until T10; only an empty plan is accepted');
  if (typeof line !== 'string') violations.push('line must be a string');
  else if (line.length > MAX_LINE_LENGTH) violations.push(`line is longer than ${MAX_LINE_LENGTH} characters`);
  if (!Array.isArray(inspected) || !inspected.every((i) => typeof i === 'string')) {
    violations.push('inspected must be an array of ids');
  } else {
    const traceIds = new Set(context.tracesToday.map((t) => t.id));
    for (const id of inspected) if (!traceIds.has(id)) violations.push(`inspected "${id}" is not a trace this morning`);
  }
  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, plan: { actions: [], line: line as string, inspected: [...(inspected as string[])] } };
}
