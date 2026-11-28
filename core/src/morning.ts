// AI-use disclosure: Codex implemented the shared morning flow under Hao's direction.
import { buildFarmerContext, ruleFarmer, validatePlan } from './farmer.ts';
import type { MorningBoard } from './farmer.ts';
import { FARMER_STAMINA, NIGHTS_PER_SESSION, STRIKE_LIMIT } from './rules.ts';
import { commitPlan, resolveNight } from './session.ts';
import type { FarmDef, FarmerContext, NightResult, Plan, SessionState } from './types.ts';

/** Resolve the night, then refill only when the session has a morning to play. */
export function prepareMorning(farm: FarmDef, session: SessionState, result: NightResult, nightLimit = NIGHTS_PER_SESSION): {
  session: SessionState;
  context: FarmerContext | null;
  board: MorningBoard;
} {
  const resolved = resolveNight(session, result);
  const board = { farm, world: resolved.world };
  if (resolved.world.gnomes.length === 0 || resolved.strikes >= STRIKE_LIMIT || resolved.night >= nightLimit) {
    return { session: resolved, context: null, board };
  }

  const farmer = { ...resolved.farmer, stamina: FARMER_STAMINA, money: resolved.farmer.money + 1 };
  const context = buildFarmerContext({ farmer, tracesToday: result.traces, eveningGates: session.world.gates });
  return { session: { ...resolved, farmer }, context, board };
}

/** Run the rule-based farmer locally using the same morning as the Worker. */
export function advanceLocalMorning(farm: FarmDef, session: SessionState, result: NightResult, nightLimit = NIGHTS_PER_SESSION): { session: SessionState; plan: Plan | null } {
  const prepared = prepareMorning(farm, session, result, nightLimit);
  if (prepared.context === null) return { session: prepared.session, plan: null };

  const plan = ruleFarmer(prepared.context, prepared.board);
  const checked = validatePlan(prepared.context, plan, prepared.board);
  if (!checked.ok) throw new Error(`rule farmer returned an invalid plan: ${checked.violations.join(', ')}`);
  return { session: commitPlan(farm, prepared.session, prepared.context, checked.plan), plan: checked.plan };
}
