// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7, T11a); it covers the placeholders, not the T10 rules.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildFarmerContext, loadFarm, newSession, ruleFarmer, validatePlan } from '../src/index.ts';
import type { Trace } from '../src/index.ts';

const farm = loadFarm(JSON.parse(readFileSync(new URL('../../maps/farm.tmj', import.meta.url), 'utf8')));
const session = newSession(farm, 7);
const traces: Trace[] = [{ id: 't1', kind: 'brokenFence', target: 'fence_east' }];
const ctx = buildFarmerContext({ farmer: session.farmer, tracesToday: traces });

describe('placeholder ruleFarmer', () => {
  it('returns a fixed plan the validator accepts', () => {
    const plan = ruleFarmer(ctx);
    expect(validatePlan(ctx, plan)).toEqual({ ok: true, plan });
    expect(ruleFarmer(ctx)).toEqual(plan);
  });
});

describe('placeholder validatePlan', () => {
  it('rejects actions until T10', () => {
    const r = validatePlan(ctx, { actions: [{ type: 'repair', target: 'fence_east', to: 'none' }], line: 'x', inspected: [] });
    expect(r.ok).toBe(false);
  });
  it('rejects an inspected id that is not a trace today', () => {
    expect(validatePlan(ctx, { actions: [], line: 'x', inspected: ['ped_nw'] }).ok).toBe(false);
    expect(validatePlan(ctx, { actions: [], line: 'x', inspected: ['t1'] }).ok).toBe(true);
  });
  it('rejects a line over 80 characters and non-objects', () => {
    expect(validatePlan(ctx, { actions: [], line: 'a'.repeat(81), inspected: [] }).ok).toBe(false);
    expect(validatePlan(ctx, 'plan').ok).toBe(false);
  });
});

describe('buildFarmerContext', () => {
  it('copies only allowlisted fields', () => {
    const leaky = { ...session.farmer, playerPath: [1, 2, 3] } as typeof session.farmer;
    const sneaky = [{ ...traces[0]!, playerStamina: 2 } as Trace];
    const json = JSON.stringify(buildFarmerContext({ farmer: leaky, tracesToday: sneaky }));
    expect(json).toBe(JSON.stringify(ctx));
  });

  it('keeps a footprint count, and only on footprints', () => {
    const t: Trace[] = [
      { id: 't1', kind: 'footprints', target: 'area_sw', count: 4 },
      { id: 't2', kind: 'gate', target: 'gate_lawn_west', count: 9 },
    ];
    expect(buildFarmerContext({ farmer: session.farmer, tracesToday: t }).tracesToday).toEqual([
      { id: 't1', kind: 'footprints', target: 'area_sw', count: 4 },
      { id: 't2', kind: 'gate', target: 'gate_lawn_west' },
    ]);
  });
});
