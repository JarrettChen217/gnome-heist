// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T11a); it follows the one-deadline failover in Configuration Document A6. No real model is wired in M0.
// Codex added absolute-deadline guards under Hao's direction after the M0 review.
import { ruleFarmer, validatePlan } from '@gnome-heist/core';
import type { FarmerContext, MorningBoard, Plan } from '@gnome-heist/core';

/** A model call: returns the raw parsed JSON, which the validator then checks. */
export type ModelPolicy = (context: FarmerContext, signal: AbortSignal) => Promise<unknown>;

export interface Policies {
  readonly primary: ModelPolicy | null;
  readonly secondary: ModelPolicy | null;
}

/** Configuration Document A6. Milliseconds, measured from the request reaching the Durable Object. */
export interface Timing {
  /** Model calls must stop by this point (3.5 s of the 4 s morning). */
  readonly cutoffMs: number;
  /** A primary failure this early counts as "fast" and may go to the secondary. */
  readonly fastFailMs: number;
  /** The secondary is tried only if at least this much time is left before the cut-off. */
  readonly minRemainingForSecondaryMs: number;
}
export const DEFAULT_TIMING: Timing = { cutoffMs: 3500, fastFailMs: 1500, minRemainingForSecondaryMs: 1500 };

export type ActedBy = 'primary' | 'secondary' | 'rule';

export interface AttemptLog {
  readonly policy: 'primary' | 'secondary';
  readonly outcome: 'ok' | 'error' | 'timeout' | 'schema_invalid' | 'rule_invalid';
  readonly ms: number;
  readonly detail?: string;
}

export interface Decision {
  readonly plan: Plan;
  readonly actedBy: ActedBy;
  readonly attempts: readonly AttemptLog[];
}

type Attempt =
  | { kind: 'ok'; value: unknown }
  | { kind: 'error'; error: unknown }
  | { kind: 'timeout' };

/** Runs one model call against the shared cut-off; SDK retries stay off, so this is one try. */
async function attempt(policy: ModelPolicy, context: FarmerContext, msLeft: number, onLate: (v: unknown) => void): Promise<Attempt> {
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Attempt>((resolve) => {
    timer = setTimeout(() => {
      resolve({ kind: 'timeout' });
      ac.abort('cutoff');
    }, Math.max(0, msLeft));
  });
  let settled = false;
  const call = Promise.resolve().then(() => policy(context, ac.signal)).then(
    (value): Attempt => {
      if (settled) onLate(value);
      return { kind: 'ok', value };
    },
    (error: unknown): Attempt => ({ kind: 'error', error }),
  );
  const result = await Promise.race([call, timeout]);
  settled = true;
  if (timer !== undefined) clearTimeout(timer);
  return result;
}

/**
 * One morning, one deadline: primary; the secondary only after a fast primary
 * failure with enough time left; otherwise the rule-based farmer. A model
 * result after the cut-off is logged and never used.
 */
export async function decideMorning(
  context: FarmerContext,
  policies: Policies,
  timing: Timing,
  now: () => number,
  log: (entry: Record<string, unknown>) => void = () => {},
  /** When the request reached the Durable Object; the cut-off counts from here (A6). */
  start: number = now(),
  /** Map and physical state for validation only. The policy receives the allowed context. */
  board?: MorningBoard,
): Promise<Decision> {
  const attempts: AttemptLog[] = [];
  const left = () => timing.cutoffMs - (now() - start);

  const tryPolicy = async (which: 'primary' | 'secondary', policy: ModelPolicy): Promise<Plan | 'fast-fail' | null> => {
    const t0 = now();
    const remaining = left();
    // Parsing and storage reads share this deadline with the model calls.
    if (remaining <= 0) return null;
    const late = () => log({ event: 'late_model_result_ignored', policy: which });
    const r = await attempt(policy, context, remaining, late);
    const ms = now() - t0;
    // A resolved promise can win the race before an overdue timer is dispatched.
    if (r.kind === 'timeout' || left() <= 0) {
      if (r.kind === 'ok') late();
      attempts.push({ policy: which, outcome: 'timeout', ms });
      return null;
    }
    if (r.kind === 'error') {
      attempts.push({ policy: which, outcome: 'error', ms, detail: String(r.error) });
      return ms <= timing.fastFailMs ? 'fast-fail' : null;
    }
    const v = validatePlan(context, r.value, board);
    const validatedMs = now() - t0;
    if (left() <= 0) {
      late();
      attempts.push({ policy: which, outcome: 'timeout', ms: validatedMs });
      return null;
    }
    if (!v.ok) {
      const outcome = v.kind === 'schema' ? 'schema_invalid' : 'rule_invalid';
      attempts.push({ policy: which, outcome, ms: validatedMs, detail: v.violations.join('; ') });
      return v.kind === 'schema' && validatedMs <= timing.fastFailMs ? 'fast-fail' : null;
    }
    attempts.push({ policy: which, outcome: 'ok', ms: validatedMs });
    return v.plan;
  };

  if (policies.primary !== null) {
    const p = await tryPolicy('primary', policies.primary);
    if (p !== null && p !== 'fast-fail') return { plan: p, actedBy: 'primary', attempts };
    if (p === 'fast-fail' && policies.secondary !== null && left() >= timing.minRemainingForSecondaryMs) {
      const s = await tryPolicy('secondary', policies.secondary);
      if (s !== null && s !== 'fast-fail') return { plan: s, actedBy: 'secondary', attempts };
    }
  }

  const rulePlan = ruleFarmer(context, board);
  const checked = validatePlan(context, rulePlan, board);
  if (!checked.ok) throw new Error(`rule-based farmer produced an invalid plan: ${checked.violations.join('; ')}`);
  return { plan: checked.plan, actedBy: 'rule', attempts };
}
