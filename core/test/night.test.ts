// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7); it covers only walking and collision (the night rules are T8).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLAYER_HALF_EXTENT, boxHitsSolid, loadFarm, newSession, startNight, tick } from '../src/index.ts';
import type { NightState } from '../src/index.ts';

const farm = loadFarm(JSON.parse(readFileSync(new URL('../../maps/farm.tmj', import.meta.url), 'utf8')));
const night0 = startNight(newSession(farm, 1), farm);
const at = (x: number, y: number): NightState => ({ ...night0, player: { x, y } });
const walk = (n: NightState, moveX: number, moveY: number, seconds: number, dt = 1 / 60) => {
  let s = n;
  for (let t = 0; t < seconds; t += dt) s = tick(s, { moveX, moveY }, dt).night;
  return s;
};

describe('walking and collision (M0)', () => {
  it('starts at the centre of the first dog hole, not inside a wall', () => {
    expect(night0.player).toEqual({ x: 0.5, y: 10.5 });
    expect(boxHitsSolid(night0, night0.player)).toBe(false);
  });

  it('moves at the walking speed on open ground', () => {
    const n = tick(at(3.5, 10.5), { moveX: 1, moveY: 0 }, 0.25).night;
    expect(n.player.x).toBeCloseTo(4.5);
    expect(n.player.y).toBe(10.5);
  });

  it('stops flush against a closed gate', () => {
    // Row 10 west: the plain gate at (8,10) is closed, so it is solid in M0.
    const n = walk(at(6.5, 10.5), 1, 0, 2);
    expect(n.player.x).toBeCloseTo(8 - PLAYER_HALF_EXTENT);
  });

  it('stops flush against a hedge', () => {
    // Row 12: the hedge column at x = 8.
    const n = walk(at(6.5, 12.5), 1, 0, 2);
    expect(n.player.x).toBeCloseTo(8 - PLAYER_HALF_EXTENT);
  });

  it('cannot leave the map through the dog hole', () => {
    const n = walk(night0, -1, 0, 1);
    expect(n.player.x).toBeCloseTo(PLAYER_HALF_EXTENT);
  });

  it('slides along a wall when moving diagonally', () => {
    // Against the north hedge of the south-west beds (row 7 is hedge).
    const n = walk(at(3.5, 8.5), 1, -1, 0.5);
    expect(n.player.y).toBeCloseTo(8 + PLAYER_HALF_EXTENT);
    expect(n.player.x).toBeGreaterThan(4.5);
  });

  it('does not tunnel through a wall on a long frame', () => {
    const n = tick(at(6.5, 10.5), { moveX: 1, moveY: 0 }, 2).night;
    expect(n.player.x).toBeLessThan(8);
  });

  it('is deterministic: same input, same result', () => {
    expect(walk(at(3.5, 10.5), 0.7, 0.3, 1)).toEqual(walk(at(3.5, 10.5), 0.7, 0.3, 1));
  });
});
