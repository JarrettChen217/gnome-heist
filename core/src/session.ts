// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7); session transitions are stubs until T8 to T10.

import { FARMER_START_MONEY, FARMER_STAMINA } from './rules.ts';
import type { FarmDef, NightResult, NightState, Plan, PlayerView, SessionState } from './types.ts';

export class NotImplementedError extends Error {
  constructor(what: string, task: string) {
    super(`${what} is not implemented yet (${task})`);
    this.name = 'NotImplementedError';
  }
}

/** Night 1 with the starting budgets. The farmer's starting layout is placed in T8/T10. */
export function newSession(_farm: FarmDef, seed: number): SessionState {
  return {
    night: 1,
    strikes: 0,
    seed,
    farmer: { stamina: FARMER_STAMINA, money: FARMER_START_MONEY, layout: [], memory: [] },
  };
}

export function endNight(_night: NightState): NightResult {
  throw new NotImplementedError('endNight', 'T8');
}

export function resolveNight(_session: SessionState, _result: NightResult): SessionState {
  throw new NotImplementedError('resolveNight (end-of-night order)', 'T10');
}

export function commitPlan(_session: SessionState, _accepted: Plan): SessionState {
  throw new NotImplementedError('commitPlan', 'T10');
}

export function projectPlayerView(_session: SessionState, _night: NightState): PlayerView {
  throw new NotImplementedError('projectPlayerView', 'T9');
}
