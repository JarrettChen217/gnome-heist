// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7); only walking and collision are implemented, the other night rules come in T8.

import { tileIndex } from './farm.ts';
import type { FarmDef, NightEvent, NightInput, NightState, SessionState, Vec } from './types.ts';
import { PLAYER_STAMINA } from './rules.ts';

/**
 * Provisional movement constants (GDD 5.11: continuous movement, collision by
 * whole tiles). T8 fixes the exact boundary semantics with tests and copies
 * them back into the GDD.
 */
export const WALK_SPEED_TILES_PER_SECOND = 4;
/** Half the side of the player's square collision box, in tiles. */
export const PLAYER_HALF_EXTENT = 0.3;
/** Longest step integrated at once, so a long frame cannot tunnel through a wall. */
const MAX_STEP_TILES = 0.25;

/** Solid tiles for M0: blocked ground, every gate (closed) and every fence (intact). */
export function solidTiles(farm: FarmDef): boolean[] {
  const solid = farm.ground.map((k) => k === 'blocked');
  for (const o of [...farm.gates, ...farm.fences]) {
    for (let y = o.rect.y; y < o.rect.y + o.rect.h; y++) {
      for (let x = o.rect.x; x < o.rect.x + o.rect.w; x++) solid[tileIndex(farm, x, y)] = true;
    }
  }
  return solid;
}

export function startNight(session: SessionState, farm: FarmDef): NightState {
  const hole = farm.dogHoles[0];
  if (hole === undefined) throw new Error('farm has no dog hole');
  // M0: always the first dog hole; choosing one is T8.
  return {
    night: session.night,
    player: { x: hole.rect.x + hole.rect.w / 2, y: hole.rect.y + hole.rect.h / 2 },
    stamina: PLAYER_STAMINA,
    solid: solidTiles(farm),
    width: farm.width,
    height: farm.height,
  };
}

function isSolid(night: NightState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= night.width || y >= night.height) return true;
  return night.solid[tileIndex(night, x, y)] === true;
}

/** Does the square box around `p` overlap a solid tile? Box edges are half-open. */
export function boxHitsSolid(night: NightState, p: Vec): boolean {
  const h = PLAYER_HALF_EXTENT;
  const x0 = Math.floor(p.x - h);
  const x1 = Math.ceil(p.x + h) - 1;
  const y0 = Math.floor(p.y - h);
  const y1 = Math.ceil(p.y + h) - 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (isSolid(night, x, y)) return true;
  return false;
}

/** Move along one axis; on contact, stop flush against the tile edge. */
function moveAxis(night: NightState, p: Vec, axis: 'x' | 'y', delta: number): { p: Vec; bumped: boolean } {
  if (delta === 0) return { p, bumped: false };
  const next = axis === 'x' ? { x: p.x + delta, y: p.y } : { x: p.x, y: p.y + delta };
  if (!boxHitsSolid(night, next)) return { p: next, bumped: false };
  const h = PLAYER_HALF_EXTENT;
  const c = axis === 'x' ? p.x : p.y;
  // The edge the box was approaching: the next tile boundary in the direction of travel.
  const flush = delta > 0 ? Math.ceil(c + h) - h : Math.floor(c - h) + h;
  const clamped = axis === 'x' ? { x: flush, y: p.y } : { x: p.x, y: flush };
  return { p: boxHitsSolid(night, clamped) ? p : clamped, bumped: true };
}

/**
 * One fixed step of the night. `dtSeconds` is supplied by the caller (core reads no clock).
 * M0: walking and collision only; actions, stamina, traces and detection are T8.
 */
export function tick(
  night: NightState,
  input: NightInput,
  dtSeconds: number,
): { night: NightState; events: NightEvent[] } {
  let dx = Math.max(-1, Math.min(1, input.moveX));
  let dy = Math.max(-1, Math.min(1, input.moveY));
  const len = Math.hypot(dx, dy);
  if (len > 1) {
    dx /= len;
    dy /= len;
  }
  const dist = WALK_SPEED_TILES_PER_SECOND * Math.max(0, dtSeconds);
  const steps = Math.max(1, Math.ceil(dist / MAX_STEP_TILES));
  let p = night.player;
  let bumped = false;
  for (let i = 0; i < steps; i++) {
    const rx = moveAxis(night, p, 'x', (dx * dist) / steps);
    const ry = moveAxis(night, rx.p, 'y', (dy * dist) / steps);
    p = ry.p;
    bumped ||= rx.bumped || ry.bumped;
  }
  const events: NightEvent[] = bumped ? [{ type: 'bumped' }] : [];
  return { night: { ...night, player: p }, events };
}
