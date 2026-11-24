// AI-use disclosure: Claude Code and Codex added farmer context and plan validation tests under Hao's direction.

import { describe, expect, it } from 'vitest';
import { buildFarmerContext, commitPlan, copyFarmerContext, prepareMorning, ruleFarmer, validatePlan } from '../src/index.ts';
import type { NightResult, PlanAction, Trace } from '../src/index.ts';
import { farmFrom, sessionFor } from './helpers.ts';

const quiet: NightResult = { night: 1, changes: [], traces: [], spotted: false, gnomeTaken: null };
const plan = (actions: PlanAction[] = []) => ({ actions, line: 'Back to work.', inspected: [] });
const prepare = (farm: ReturnType<typeof farmFrom>, result = quiet) => {
  const morning = prepareMorning(farm, sessionFor(farm), result);
  if (!morning.context) throw new Error('fixture unexpectedly ended the session');
  return { ...morning, context: morning.context };
};

describe('farmer plan validation', () => {
  const { board, context } = prepare(farmFrom(['DL..L.G.Kg']), {
    ...quiet, traces: [{ id: 'trace1', kind: 'footprints', target: 'area_all', count: 4 }],
  });

  it('categorizes malformed fields and fabricated inspected traces', () => {
    expect(validatePlan(context, 'plan', board)).toMatchObject({ ok: false, kind: 'schema' });
    expect(validatePlan(context, { ...plan(), line: 'a'.repeat(81) }, board)).toMatchObject({ ok: false, kind: 'schema' });
    expect(validatePlan(context, { ...plan(), line: 'A\nB' }, board)).toMatchObject({ ok: false, kind: 'schema' });
    expect(validatePlan(context, { ...plan(), actions: [{ type: 'repair', target: 'fence1', to: 'post1' }] }, board))
      .toMatchObject({ ok: false, kind: 'schema' });
    expect(validatePlan(context, { ...plan(), actions: [{ type: 'buy', target: 'lamp', to: 'post2', forced: true }] }, board))
      .toMatchObject({ ok: false, kind: 'schema' });
    expect(validatePlan(context, { ...plan(), inspected: ['ped1'] }, board)).toMatchObject({ ok: false, kind: 'rules' });
    expect(validatePlan(context, { ...plan(), line: 'What the shit?' }, board))
      .toMatchObject({ ok: false, kind: 'rules', violations: ['line contains blocked language'] });
    expect(validatePlan(context, { ...plan(), inspected: ['trace1'] }, board)).toMatchObject({ ok: true });
  });

  it('checks stamina and money before applying actions', () => {
    const lamp = { type: 'buy', target: 'lamp', to: 'post2' } as const;
    const dog = { type: 'buy', target: 'doghouse', to: 'spot1' } as const;
    const lock = { type: 'buy', target: 'padlock', to: 'gate1' } as const;
    expect(validatePlan(context, plan([lamp, dog, lock]), board))
      .toMatchObject({ ok: false, kind: 'rules', violations: ['plan exceeds farmer stamina'] });
    expect(validatePlan({ ...context, money: 1 }, plan([lamp, dog]), board))
      .toMatchObject({ ok: false, kind: 'rules', violations: ['plan exceeds farmer money'] });
    expect(validatePlan(context, plan([lamp, dog]), board)).toMatchObject({ ok: true });
  });

  it('rejects the wrong kind of slot, safe-zone placement, occupied slots, unknown defenses and intact repairs', () => {
    expect(validatePlan(context, plan([{ type: 'buy', target: 'lamp', to: 'gate1' }]), board))
      .toMatchObject({ ok: false, violations: ['"gate1" is not a lamp slot'] });
    expect(validatePlan(context, plan([{ type: 'buy', target: 'lamp', to: 'post1' }]), board))
      .toMatchObject({ ok: false, violations: ['"post1" is in an entry safe zone'] });
    const lamp = { type: 'buy', target: 'lamp', to: 'post2' } as const;
    expect(validatePlan(context, plan([lamp, lamp]), board))
      .toMatchObject({ ok: false, violations: ['"post2" is already occupied'] });
    expect(validatePlan(context, plan([{ type: 'move', target: 'unknown', to: 'post2' }]), board))
      .toMatchObject({ ok: false, violations: ['"unknown" is not an owned defense'] });
    expect(validatePlan(context, plan([{ type: 'repair', target: 'gate1', to: 'none' }]), board))
      .toMatchObject({ ok: false, violations: ['"gate1" is not a broken fence or an open padlock'] });
  });

  it('requires a route when a purchase, move, re-lock or repair adds a barrier', () => {
    const purchase = prepare(farmFrom(['D..P.Gg']));
    expect(validatePlan(purchase.context, plan([{ type: 'buy', target: 'padlock', to: 'gate2' }]), purchase.board))
      .toMatchObject({ ok: false, kind: 'rules', violations: [expect.stringContaining('no route')] });
    const move = prepare(farmFrom(['D..P.Gg', '###P###']));
    expect(validatePlan(move.context, plan([{ type: 'move', target: 'padlock_gate3', to: 'gate2' }]), move.board))
      .toMatchObject({ ok: false, kind: 'rules', violations: [expect.stringContaining('no route')] });
    const relock = prepare(farmFrom(['D..P.Pg']), {
      ...quiet, changes: [{ kind: 'padlock', id: 'gate2', locked: false }],
    });
    expect(validatePlan(relock.context, plan([{ type: 'repair', target: 'gate2', to: 'none' }]), relock.board))
      .toMatchObject({ ok: false, kind: 'rules', violations: [expect.stringContaining('no route')] });
    const repair = prepare(farmFrom(['D..P.Fg']), {
      ...quiet, changes: [{ kind: 'fence', id: 'fence1', gaps: [{ x: 5, y: 0 }] }],
    });
    expect(validatePlan(repair.context, plan([{ type: 'repair', target: 'fence1', to: 'none' }]), repair.board))
      .toMatchObject({ ok: false, kind: 'rules', violations: [expect.stringContaining('no route')] });
  });

  it('checks the final layout and commits a move to the same state validation approved', () => {
    const farm = farmFrom(['D..P.Gg', '###G###']);
    const morning = prepare(farm);
    const candidate = plan([
      { type: 'buy', target: 'padlock', to: 'gate2' },
      { type: 'move', target: 'padlock_gate1', to: 'gate3' },
    ]);
    const checked = validatePlan(morning.context, candidate, morning.board);
    expect(checked).toEqual({ ok: true, plan: candidate });
    if (!checked.ok) throw new Error('expected a legal plan');
    const next = commitPlan(farm, morning.session, morning.context, checked.plan);
    expect(next).toMatchObject({ night: 2, farmer: { stamina: 0, money: 1 } });
    expect(next.farmer.layout).toEqual([
      { id: 'padlock_gate1', kind: 'padlock', slot: 'gate3' }, { id: 'padlock_gate2', kind: 'padlock', slot: 'gate2' },
    ]);
    expect(next.world.gates).toEqual([
      { id: 'gate1', open: false, padlock: 'none' },
      { id: 'gate2', open: false, padlock: 'locked' },
      { id: 'gate3', open: false, padlock: 'locked' },
    ]);
    expect(morning.session.world.gates[0]?.padlock).toBe('locked');
  });

  it('allows an empty plan or lamp when theft leaves no cheap route', () => {
    const farm = farmFrom(['D..g.P.P.Lg']);
    const { context, board } = prepare(farm, {
      ...quiet, gnomeTaken: 'ped1', changes: [{ kind: 'pedestal', id: 'ped1', hasGnome: false }],
    });
    expect(validatePlan(context, plan(), board)).toMatchObject({ ok: true });
    expect(validatePlan(context, plan([{ type: 'buy', target: 'lamp', to: 'post1' }]), board)).toMatchObject({ ok: true });
  });
});

describe('rule-based farmer', () => {
  it('moves an owned lamp toward today’s footprints when he cannot buy one', () => {
    const farm = farmFrom(['D..L..g.L..L'], [{ id: 'east', rect: { x: 11, y: 0, w: 1, h: 1 } }]);
    const seed = sessionFor(farm, [
      { id: 'west_lamp', kind: 'lamp', slot: 'post1' }, { id: 'east_lamp', kind: 'lamp', slot: 'post2' },
    ]);
    const prepared = prepareMorning(farm, seed, {
      ...quiet, traces: [{ id: 'trace1', kind: 'footprints', target: 'east', count: 4 }],
    });
    if (!prepared.context) throw new Error('fixture unexpectedly ended the session');
    const context = { ...prepared.context, money: 0 };
    const chosen = ruleFarmer(context, prepared.board);
    expect(chosen.actions).toEqual([{ type: 'move', target: 'east_lamp', to: 'post3' }]);
    expect(chosen.inspected).toEqual(['trace1']);
    expect(ruleFarmer(context, prepared.board)).toEqual(chosen);
    expect(validatePlan(context, chosen, prepared.board)).toEqual({ ok: true, plan: chosen });
  });
});

describe('buildFarmerContext', () => {
  it('projects allowed fields recursively and caps memory to the three newest mornings', () => {
    const session = sessionFor(farmFrom(['D..P.g']));
    const traces: Trace[] = [{ id: 't1', kind: 'brokenFence', target: 'fence_east' }];
    const oldest = { traces: [], actions: [], line: 'Oldest.' };
    const summary = { traces, actions: [{ type: 'repair', target: 'fence_east', to: 'none' } as const], line: 'Recent.' };
    const ctx = buildFarmerContext({
      farmer: { ...session.farmer, memory: [oldest, summary, summary, summary] },
      tracesToday: traces,
      eveningGates: session.world.gates,
    });
    const dirty = {
      ...ctx,
      tracesToday: traces.map((trace) => ({ ...trace, playerStamina: 2 })),
      layout: ctx.layout.map((defense) => ({ ...defense, rawPosition: [1, 2] })),
      memory: ctx.memory.map((entry) => ({
        ...entry, traces: entry.traces.map((trace) => ({ ...trace, playerPosition: 1 })),
        actions: entry.actions.map((action) => ({ ...action, actionLog: ['E'] })), world: session.world,
      })),
      eveningGates: session.world.gates.map((gate) => ({ ...gate, path: [1, 2] })),
      playerPath: [1, 2, 3],
    };
    expect(JSON.stringify(copyFarmerContext(dirty))).toBe(JSON.stringify(ctx));
    expect(ctx.memory).toEqual([summary, summary, summary]);
  });

  it('does not expose session state that differs but has the same traces, layout and budget', () => {
    const farm = farmFrom(['D..P.gg']);
    const s1 = sessionFor(farm);
    const s2 = {
      ...s1, seed: 19, strikes: 2,
      world: { ...s1.world, gnomes: ['ped2'] },
      path: [1, 2], entry: 'hole1',
    };
    expect(JSON.stringify(prepareMorning(farm, s1, quiet).context))
      .toBe(JSON.stringify(prepareMorning(farm, s2, quiet).context));
  });

  it('keeps a footprint count on footprints only', () => {
    const session = sessionFor(farmFrom(['D..P.g']));
    const tracesToday: Trace[] = [
      { id: 't1', kind: 'footprints', target: 'area_sw', count: 4 },
      { id: 't2', kind: 'gate', target: 'gate_lawn_west', count: 9 },
    ];
    expect(buildFarmerContext({ farmer: session.farmer, tracesToday }).tracesToday).toEqual([
      { id: 't1', kind: 'footprints', target: 'area_sw', count: 4 },
      { id: 't2', kind: 'gate', target: 'gate_lawn_west' },
    ]);
  });
});
