// AI-use disclosure: Claude (Claude Code) wrote this test helper under my direction for T8.
// Builds small FarmDefs from ASCII so each rule test sets up only what it needs.

import { initialLayout, initialWorld, newSession, startNight, tick } from '../src/index.ts';
import type { Defense, FarmDef, FarmObject, GateDef, GroundKind, NightEvent, NightInput, NightState, SessionState } from '../src/index.ts';

/**
 * Legend: # hedge, . stone, , soft, D dog hole (stone), G plain gate, P padlocked gate,
 * F fence (one object per tile), g pedestal (soft), L lamp post, K doghouse spot,
 * B bush (soft), W window sight tile (stone; a run of W is one sight line).
 * Ids are numbered in reading order: hole1, gate1, fence1, ped1, post1, spot1, bush1.
 * One area, "area_all", covers the map unless `areas` is given.
 */
export function farmFrom(rows: string[], areas?: FarmObject[]): FarmDef {
  const H = rows.length;
  const W = rows[0]!.length;
  const ground: GroundKind[] = [];
  const objs: Record<string, FarmObject[]> = { D: [], g: [], F: [], L: [], K: [], B: [] };
  const gates: GateDef[] = [];
  const windowTiles: { x: number; y: number }[] = [];
  const names: Record<string, string> = { D: 'hole', g: 'ped', F: 'fence', L: 'post', K: 'spot', B: 'bush' };
  rows.forEach((row, y) => {
    if (row.length !== W) throw new Error('ragged rows');
    [...row].forEach((c, x) => {
      ground.push(c === '#' ? 'blocked' : c === ',' || c === 'g' || c === 'B' ? 'soft' : 'stone');
      const rect = { x, y, w: 1, h: 1 };
      if (c === 'G' || c === 'P') gates.push({ id: `gate${gates.length + 1}`, rect, padlocked: c === 'P' });
      else if (c === 'W') windowTiles.push({ x, y });
      else if (c in objs) objs[c]!.push({ id: `${names[c]}${objs[c]!.length + 1}`, rect });
    });
  });
  const windowSight: FarmObject[] = [];
  if (windowTiles.length > 0) {
    const xs = windowTiles.map((t) => t.x);
    const ys = windowTiles.map((t) => t.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    windowSight.push({ id: 'window1', rect: { x, y, w: Math.max(...xs) - x + 1, h: Math.max(...ys) - y + 1 } });
  }
  return {
    width: W,
    height: H,
    ground,
    dogHoles: objs['D']!,
    pedestals: objs['g']!,
    gates,
    fences: objs['F']!,
    lampPosts: objs['L']!,
    doghouseSpots: objs['K']!,
    bushes: objs['B']!,
    windowSight,
    areas: areas ?? [{ id: 'area_all', rect: { x: 0, y: 0, w: W, h: H } }],
    mapVersion: 'test',
  };
}

export function sessionFor(farm: FarmDef, layout: Defense[] = initialLayout(farm)): SessionState {
  const s = newSession(farm, 1);
  return { ...s, farmer: { ...s.farmer, layout }, world: initialWorld(farm, layout) };
}

export const STEP = 1 / 60;

/** Runs ticks for `seconds` with one input, collecting events. */
export function run(farm: FarmDef, night: NightState, input: Partial<NightInput>, seconds: number) {
  const full: NightInput = { moveX: 0, moveY: 0, interact: false, ...input };
  let n = night;
  const events: NightEvent[] = [];
  const ticks = Math.round(seconds / STEP);
  for (let i = 0; i < ticks; i++) {
    const r = tick(farm, n, full, STEP);
    n = r.night;
    events.push(...r.events);
  }
  return { night: n, events };
}

/** A night with the player placed at the centre of tile (x, y). */
export function nightAt(farm: FarmDef, x: number, y: number, session: SessionState = sessionFor(farm)): NightState {
  return { ...startNight(session, farm, farm.dogHoles[0]!.id), player: { x: x + 0.5, y: y + 0.5 } };
}

/** Hold E for `seconds`, then release for one tick. */
export function holdE(farm: FarmDef, night: NightState, seconds: number) {
  const a = run(farm, night, { interact: true }, seconds);
  const b = run(farm, a.night, {}, STEP);
  return { night: b.night, events: [...a.events, ...b.events] };
}
