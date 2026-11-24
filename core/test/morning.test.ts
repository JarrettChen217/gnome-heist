// AI-use disclosure: Codex wrote these local-morning regression tests under Hao's direction.
import { describe, expect, it } from 'vitest';
import { advanceLocalMorning, endNight, startNight } from '../src/index.ts';
import type { NightResult } from '../src/index.ts';
import { farmFrom, sessionFor } from './helpers.ts';

const quiet: NightResult = { night: 1, changes: [], traces: [], spotted: false, gnomeTaken: null };

describe('local morning', () => {
  it('banks a gnome, repairs an open padlock and spends one coin on a lamp by the strongest tracks', () => {
    const farm = farmFrom(['D..P.L.g.Lg'], [
      { id: 'west', rect: { x: 0, y: 0, w: 4, h: 1 } }, { id: 'east', rect: { x: 8, y: 0, w: 3, h: 1 } },
    ]);
    const s = sessionFor(farm);
    const n = startNight(s, farm, 'hole1');
    const result = endNight(farm, { ...n, ended: { reason: 'exit', hole: 'hole1' },
      carrying: 'ped1', footprints: [1, 8, 9], world: { ...n.world, gnomes: ['ped2'], gates: [{ id: 'gate1', open: true, padlock: 'open' }] } });
    const morning = advanceLocalMorning(farm, s, result);
    expect(morning).toEqual(advanceLocalMorning(farm, s, result));
    expect(morning.plan?.actions).toEqual([
      { type: 'repair', target: 'gate1', to: 'none' }, { type: 'buy', target: 'lamp', to: 'post2' },
    ]);
    const second = startNight(morning.session, farm, 'hole1');
    expect(second.night).toBe(2);
    expect(second.world.gnomes).toEqual(['ped2']);
    expect(second.world.gates).toEqual(s.world.gates);
    expect(second.danger[9]).toBe('lamp');
    expect(morning.session.farmer).toMatchObject({ money: 1, stamina: 0, memory: [{ traces: result.traces }] });
    expect(s.farmer.layout).toHaveLength(1);
    expect(s.world.gnomes).toHaveLength(2);
  });

  it('retains a fence gap when repairing it would seal the remaining gnome behind two barriers', () => {
    const farm = farmFrom(['D..PFg']);
    const s = sessionFor(farm);
    const morning = advanceLocalMorning(farm, s, { ...quiet,
      changes: [{ kind: 'fence', id: 'fence1', gaps: [{ x: 4, y: 0 }] }],
      traces: [{ id: 't1', kind: 'brokenFence', target: 'fence1' }] });
    expect(morning.plan?.actions).toEqual([]);
    expect(morning.session.world.fenceGaps).toEqual([{ fence: 'fence1', x: 4, y: 0 }]);
  });

  it('leaves a safe-zone post empty even with a footprint trace there', () => {
    const farm = farmFrom(['DL...g']);
    const morning = advanceLocalMorning(farm, sessionFor(farm), { ...quiet, traces: [{ kind: 'footprints', id: 't1', target: 'area_all' }] });
    expect(morning.session.farmer.layout).toEqual([]);
    expect(morning.plan?.inspected).toEqual(['t1']);
  });

  it('carries a changed plain gate across a quiet morning and refills the budget', () => {
    const farm = farmFrom(['D..G.g']);
    const morning = advanceLocalMorning(farm, sessionFor(farm), { ...quiet, changes: [{ kind: 'gate', id: 'gate1', open: true }] });
    expect(morning.plan?.actions).toEqual([]);
    expect(morning.session.world.gates[0]?.open).toBe(true);
    expect(morning.session.farmer).toMatchObject({ money: 2, stamina: 2 });
  });

  it('counts a sighting and checks all session endings before spending morning resources', () => {
    const farm = farmFrom(['D..g']);
    const s = sessionFor(farm);
    const caught = { ...quiet, spotted: true, traces: [{ id: 't1', kind: 'sighting' as const, target: 'tile_2_0' }] };
    const morning = advanceLocalMorning(farm, s, caught);
    expect(morning.session.strikes).toBe(1);
    expect(morning.session.world.gnomes).toEqual(['ped1']);
    expect(morning.plan?.inspected).toEqual(['t1']);
    expect(advanceLocalMorning(farm, { ...s, strikes: 2 }, caught)).toMatchObject({
      plan: null, session: { night: 1, strikes: 3, farmer: s.farmer },
    });
    expect(advanceLocalMorning(farm, { ...s, night: 5 }, { ...quiet, night: 5 }).plan).toBeNull();
    expect(advanceLocalMorning(farm, s, { ...quiet, gnomeTaken: 'ped1', changes: [{ kind: 'pedestal', id: 'ped1', hasGnome: false }] }).plan).toBeNull();
  });
});
