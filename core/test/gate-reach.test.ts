// AI-use disclosure: Codex wrote these first-playtest gate interaction checks under Hao's direction.
import { describe, expect, it } from 'vitest';
import { currentInteraction } from '../src/index.ts';
import { farmFrom, holdE, nightAt, run, STEP } from './helpers.ts';

describe('approaching and holding a gate', () => {
  const farm = farmFrom(['D......', '.......', '...PG..', '...F...', '.......']);
  const night = nightAt(farm, 2, 1);

  it('offers the same actionable prompt from a front approach and a diagonal corner', () => {
    for (const player of [{ x: 1.8, y: 2.5 }, { x: 2.35, y: 1.45 }]) {
      const start = { ...night, player };
      expect(currentInteraction(farm, start)).toMatchObject({ action: 'pickLock', target: 'gate1' });
      expect(holdE(farm, start, 1).night.world.gates[0]?.open).toBe(true);
    }
    expect(currentInteraction(farm, { ...night, player: { x: 1.7, y: 2.5 } })).toBeNull();
  });

  it('keeps a started gate action as the player walks past the jamb towards a fence', () => {
    const start = nightAt(farm, 2, 2);
    const held = run(farm, start, { interact: true }, 0.4).night;
    const drift = run(farm, held, { moveY: 1, interact: true }, 0.3).night;
    expect(currentInteraction(farm, { ...drift, hold: null })?.action).toBe('kickFence');
    expect(currentInteraction(farm, drift)?.action).toBe('pickLock');
    const end = run(farm, drift, { interact: true }, 0.3).night;
    expect(end.world.gates[0]?.open).toBe(true);
    expect(end.world.fenceGaps).toHaveLength(0);
  });

  it('allows slight drift beyond the acquisition radius, then cancels until E is released', () => {
    const held = run(farm, { ...night, player: { x: 1.8, y: 2.5 } }, { interact: true }, 0.5).night;
    const drift = run(farm, held, { moveX: -1, interact: true }, 0.05).night;
    expect(currentInteraction(farm, drift)?.action).toBe('pickLock');
    expect(currentInteraction(farm, { ...drift, hold: null })).toBeNull();
    const lost = run(farm, drift, { moveX: -1, interact: true }, 0.1).night;
    expect(lost.hold).toBeNull();
    const returned = run(farm, lost, { moveX: 1, interact: true }, 0.25).night;
    expect(run(farm, returned, { interact: true }, 1).night.world.gates[0]?.open).toBe(false);
    const released = run(farm, returned, {}, STEP).night;
    expect(holdE(farm, released, 1).night.world.gates[0]?.open).toBe(true);
  });

  it('cannot reach a gate through a hedge while walking past a corner', () => {
    const f = farmFrom(['D....', '..#G.', '.....']);
    const held = run(f, nightAt(f, 3, 2), { interact: true }, 0.5).night;
    const behindHedge = { ...held, player: { x: 1.7, y: 1.5 } };
    expect(currentInteraction(f, behindHedge)).toBeNull();
  });
});
