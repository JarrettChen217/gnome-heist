// AI-use disclosure: Claude Code and Codex implemented session state and the shared morning transition under Hao's direction.

import { simulatePlan } from './farmer.ts';
import { FARMER_START_MONEY, FARMER_STAMINA } from './rules.ts';
import type { FarmDef, FarmerContext, NightResult, NightState, Plan, PlayerView, SessionState } from './types.ts';
import { initialLayout, initialWorld } from './world.ts';

export class NotImplementedError extends Error {
  constructor(what: string, task: string) {
    super(`${what} is not implemented yet (${task})`);
    this.name = 'NotImplementedError';
  }
}

/** Night 1 with the starting budgets and the starting layout (see `initialLayout` for the open question). */
export function newSession(farm: FarmDef, seed: number): SessionState {
  const layout = initialLayout(farm);
  return {
    night: 1,
    strikes: 0,
    seed,
    farmer: { stamina: FARMER_STAMINA, money: FARMER_START_MONEY, layout, memory: [] },
    world: initialWorld(farm, layout),
  };
}

/** Merge endNight's final object changes. A spotted player already dropped their gnome before endNight. */
export function resolveNight(session: SessionState, result: NightResult): SessionState {
  if (session.night !== result.night) throw new Error('night result does not match session');
  let world = session.world;
  for (const change of result.changes) {
    switch (change.kind) {
      case 'gate':
        world = { ...world, gates: world.gates.map((g) => g.id === change.id ? { ...g, open: change.open } : g) };
        break;
      case 'padlock':
        world = { ...world, gates: world.gates.map((g) => g.id === change.id
          ? { ...g, open: !change.locked, padlock: change.locked ? 'locked' : 'open' } : g) };
        break;
      case 'fence':
        world = { ...world, fenceGaps: [
          ...world.fenceGaps.filter((g) => g.fence !== change.id),
          ...change.gaps.map((tile) => ({ ...tile, fence: change.id })),
        ] };
        break;
      case 'pedestal':
        if (change.hasGnome !== world.gnomes.includes(change.id)) {
          world = { ...world, gnomes: change.hasGnome
            ? [...world.gnomes, change.id] : world.gnomes.filter((id) => id !== change.id) };
        }
        break;
    }
  }
  return { ...session, world, strikes: session.strikes + Number(result.spotted) };
}

/** Commit the accepted plan to a prepared morning using the same simulation as validation. */
export function commitPlan(farm: FarmDef, session: SessionState, context: FarmerContext, accepted: Plan): SessionState {
  const simulation = simulatePlan(session.farmer, { farm, world: session.world }, accepted);
  if (!simulation.ok) throw new Error(`cannot commit farmer plan: ${simulation.violations.join(', ')}`);
  const { world, layout, stamina, money } = simulation.state;
  const summary = { traces: context.tracesToday, actions: accepted.actions, line: accepted.line };
  return {
    ...session,
    night: session.night + 1,
    world,
    farmer: { layout, stamina, money, memory: [...session.farmer.memory, summary].slice(-3) },
  };
}

export function projectPlayerView(_session: SessionState, _night: NightState): PlayerView {
  throw new NotImplementedError('projectPlayerView', 'T9');
}
