// AI-use disclosure: Claude (Claude Code) wrote these tests under my direction for T8; each block names the GDD rule row it covers.

import { describe, expect, it } from 'vitest';
import {
  canWalkOut,
  currentInteraction,
  dangerGrid,
  endNight,
  hasOpenRoute,
  inSafeZone,
  initialWorld,
  lineOfSight,
  openRouteCost,
  startNight,
  tileDistance,
  visibleTiles,
} from '../src/index.ts';
import type { FarmDef, NightState, WorldState } from '../src/index.ts';
import { STEP, farmFrom, holdE, nightAt, run, sessionFor } from './helpers.ts';

const idx = (farm: FarmDef, x: number, y: number) => y * farm.width + x;
const withGate = (w: WorldState, id: string, patch: Partial<WorldState['gates'][number]>): WorldState => ({
  ...w,
  gates: w.gates.map((g) => (g.id === id ? { ...g, ...patch } : g)),
});

describe('GDD 5.2 entries: dog holes', () => {
  const farm = farmFrom([
    '#####',
    'D...#',
    '#.,.D',
    '#####',
  ]);

  it('the night starts in the chosen dog hole', () => {
    const n = startNight(sessionFor(farm), farm, 'hole2');
    expect(n.entry).toBe('hole2');
    expect(n.player).toEqual({ x: 4.5, y: 2.5 });
    expect(() => startNight(sessionFor(farm), farm, 'nope')).toThrow();
  });

  it('pressing E in a dog hole ends the night; elsewhere it does not', () => {
    const inHole = startNight(sessionFor(farm), farm, 'hole1');
    expect(currentInteraction(farm, inHole)?.action).toBe('endNight');
    const r = run(farm, inHole, { interact: true }, STEP);
    expect(r.night.ended).toEqual({ reason: 'exit', hole: 'hole1' });
    expect(currentInteraction(farm, nightAt(farm, 2, 1))).toBeNull();
  });

  it('entry safe zone: within 2 tiles of a hole, edge included', () => {
    const at = (x: number, y: number) => ({ id: 'o', rect: { x, y, w: 1, h: 1 } });
    expect(inSafeZone(farm, at(2, 1))).toBe(true); // distance 2 from hole1 (0,1)
    expect(inSafeZone(farm, at(2, 2))).toBe(true); // distance 2 from hole2 (4,2)
    const wide = farmFrom(['#######', 'D.....#', '#######']);
    expect(inSafeZone(wide, at(2, 1))).toBe(true);
    expect(inSafeZone(wide, at(3, 1))).toBe(false); // distance 3
  });

  it('a re-lock that would shut you in is refused, at no cost', () => {
    // The only way out from the right-hand room is through the padlocked gate.
    const f = farmFrom([
      '#####',
      'D.P.#',
      '#####',
    ]);
    const s = sessionFor(f);
    const n = nightAt(f, 3, 1, { ...s, world: withGate(s.world, 'gate1', { open: true, padlock: 'open' }) });
    const i = currentInteraction(f, n);
    expect(i).toMatchObject({ action: 'relock', blocked: 'selfLock' });
    const r = holdE(f, n, 1.5);
    expect(r.night.stamina).toBe(2);
    expect(r.night.world.gates[0]).toMatchObject({ padlock: 'open', open: true });
    expect(r.events).toContainEqual({ type: 'refused', action: 'relock', target: 'gate1', reason: 'selfLock' });
  });

  it('the same re-lock is allowed from the dog-hole side', () => {
    const f = farmFrom([
      '#####',
      'D.P.#',
      '#####',
    ]);
    const s = sessionFor(f);
    const world = withGate(s.world, 'gate1', { open: true, padlock: 'open' });
    const r = holdE(f, nightAt(f, 1, 1, { ...s, world }), 1.05);
    expect(r.night.world.gates[0]).toMatchObject({ padlock: 'locked', open: false });
    expect(r.night.stamina).toBe(1);
  });
});

describe('GDD 5.4 movement, actions, stamina', () => {
  const farm = farmFrom([
    '#########',
    'D.G..Pg.#',
    '#..F...g#',
    '#########',
  ]);

  it('walking is free', () => {
    const r = run(farm, nightAt(farm, 1, 2), { moveY: -1 }, 1);
    expect(r.night.stamina).toBe(2);
  });

  it('plain gate: hold E about 1 s to open, free; less than 1 s does nothing', () => {
    const n = nightAt(farm, 1, 1);
    expect(holdE(farm, n, 0.9).night.world.gates[0]!.open).toBe(false);
    const r = holdE(farm, n, 1.0);
    expect(r.night.world.gates[0]!.open).toBe(true);
    expect(r.night.stamina).toBe(2);
    expect(r.night.solid[idx(farm, 2, 1)]).toBe(false);
  });

  it('releasing E resets the hold', () => {
    const a = holdE(farm, nightAt(farm, 1, 1), 0.6).night;
    expect(holdE(farm, a, 0.6).night.world.gates[0]!.open).toBe(false);
  });

  it('holding E on does not chain into the next action', () => {
    const r = run(farm, nightAt(farm, 1, 1), { interact: true }, 2.5); // without the latch: open at 1 s, closed at 2 s
    expect(r.night.world.gates[0]!.open).toBe(true);
  });

  it('between two objects at the same distance, E acts on the one the player faces', () => {
    const f = farmFrom(['#######', 'D.G.G.#', '#######']);
    const n = nightAt(f, 3, 1);
    expect(currentInteraction(f, { ...n, facing: { x: 1, y: 0 } })?.target).toBe('gate2');
    expect(currentInteraction(f, { ...n, facing: { x: -1, y: 0 } })?.target).toBe('gate1');
    const walkedLeft = run(f, n, { moveX: -1 }, STEP).night;
    expect(walkedLeft.facing).toEqual({ x: -1, y: 0 });
  });

  it('closing a gate while standing in it is refused', () => {
    const s = sessionFor(farm);
    const world = withGate(s.world, 'gate1', { open: true });
    const n = nightAt(farm, 2, 1, { ...s, world });
    expect(currentInteraction(farm, n)).toMatchObject({ action: 'closeGate', blocked: 'inGateway' });
  });

  it('walking straight at a one-tile gap off-centre slides you through it', () => {
    const f = farmFrom([
      '#######',
      'D..F..#',
      '#.....#',
      '#..F..#',
      '#######',
    ]);
    // Row 2 at x = 3 is open between two fence tiles; start a little below the row's centre line.
    const n = { ...nightAt(f, 1, 2), player: { x: 1.5, y: 2.75 } };
    const r = run(f, n, { moveX: 1 }, 1).night;
    expect(r.player.x).toBeGreaterThan(4);
    expect(r.player.y + 0.3).toBeLessThanOrEqual(3); // the box now fits in row 2
  });

  it('picking a padlock costs 1 stamina and opens the gate; re-locking costs 1', () => {
    const picked = holdE(farm, nightAt(farm, 4, 1), 1).night;
    expect(picked.world.gates[1]).toMatchObject({ padlock: 'open', open: true });
    expect(picked.stamina).toBe(1);
    const relocked = holdE(farm, picked, 1).night;
    expect(relocked.world.gates[1]).toMatchObject({ padlock: 'locked', open: false });
    expect(relocked.stamina).toBe(0);
  });

  it('kicking a fence costs 1 stamina, opens that tile, and cannot be undone that night', () => {
    const r = holdE(farm, nightAt(farm, 4, 2), 1).night;
    expect(r.stamina).toBe(1);
    expect(r.world.fenceGaps).toEqual([{ fence: 'fence1', x: 3, y: 2 }]);
    expect(r.solid[idx(farm, 3, 2)]).toBe(false);
    const onGap = { ...r, player: { x: 3.5, y: 2.5 } };
    expect(currentInteraction(farm, onGap)?.action).not.toBe('kickFence');
  });

  it('digging a gnome costs 1 stamina; you carry one at a time', () => {
    const dug = holdE(farm, nightAt(farm, 7, 2), 1).night;
    expect(dug.carrying).toBe('ped2');
    expect(dug.stamina).toBe(1);
    expect(dug.world.gnomes).toEqual(['ped1']);
    const next = { ...dug, player: { x: 6.5, y: 1.5 } };
    expect(currentInteraction(farm, next)).toMatchObject({ action: 'dig', target: 'ped1', blocked: 'handsFull' });
  });

  it('out of stamina: the prompt turns red and nothing happens', () => {
    const tired = { ...nightAt(farm, 4, 1), stamina: 0 };
    expect(currentInteraction(farm, tired)).toMatchObject({ action: 'pickLock', blocked: 'noStamina' });
    const r = holdE(farm, tired, 2);
    expect(r.night.world.gates[1]!.padlock).toBe('locked');
    expect(r.events).toContainEqual({ type: 'refused', action: 'pickLock', target: 'gate2', reason: 'noStamina' });
    // Free actions still work at 0 stamina.
    expect(holdE(farm, { ...nightAt(farm, 1, 1), stamina: 0 }, 1).night.world.gates[0]!.open).toBe(true);
  });
});

describe('GDD 5.6 traces and the NightResult', () => {
  const farm = farmFrom(
    [
      '#########',
      'D,,.G.,g#',
      '#,,.F.P.#',
      '#########',
    ],
    [
      { id: 'area_west', rect: { x: 0, y: 0, w: 4, h: 4 } },
      { id: 'area_east', rect: { x: 4, y: 0, w: 5, h: 4 } },
    ],
  );
  const exit = (n: NightState) => {
    const back = { ...n, player: { x: 0.5, y: 1.5 } };
    return endNight(farm, run(farm, back, { interact: true }, STEP).night);
  };

  it('a night with no entry leaves an empty trace list', () => {
    expect(exit(nightAt(farm, 0, 1))).toEqual({ night: 1, traces: [], changes: [], gnomeTaken: null, spotted: false });
  });

  it('footprints: one per soft tile entered, counted per area; stone leaves none', () => {
    let n = startNight(sessionFor(farm), farm, 'hole1');
    n = run(farm, n, { moveX: 1 }, 0.6).night; // across (1,1) and (2,1)
    n = run(farm, n, { moveY: 1 }, 0.3).night; // down to (2,2)
    n = run(farm, n, { moveY: -1 }, 0.3).night; // back over (2,1): no new print
    n = run(farm, n, { moveX: 1 }, 0.3).night; // onto stone (3,1)
    expect(exit(n).traces).toEqual([{ id: 't1', kind: 'footprints', target: 'area_west', count: 3 }]);
  });

  it('gate trace only if its state differs from how he left it', () => {
    const opened = holdE(farm, nightAt(farm, 3, 1), 1).night;
    expect(exit(opened).traces).toEqual([{ id: 't1', kind: 'gate', target: 'gate1' }]);
    expect(exit(opened).changes).toEqual([{ kind: 'gate', id: 'gate1', open: true }]);
    const closedAgain = holdE(farm, { ...opened, player: { x: 3.5, y: 1.5 } }, 1).night;
    expect(exit(closedAgain).traces).toEqual([]);
  });

  it('open lock if not re-locked; a re-lock leaves no lock trace', () => {
    const picked = holdE(farm, nightAt(farm, 7, 2), 1).night;
    expect(exit(picked).traces).toEqual([{ id: 't1', kind: 'openLock', target: 'gate2' }]);
    expect(exit(picked).changes).toEqual([{ kind: 'padlock', id: 'gate2', locked: false }]);
    const relocked = holdE(farm, picked, 1).night;
    expect(exit(relocked).traces).toEqual([]);
  });

  it('a broken fence is always a trace', () => {
    const kicked = holdE(farm, nightAt(farm, 3, 2), 1).night;
    expect(exit(kicked).traces).toEqual([{ id: 't1', kind: 'brokenFence', target: 'fence1' }]);
    expect(exit(kicked).changes).toEqual([{ kind: 'fence', id: 'fence1', gaps: [{ x: 4, y: 2 }] }]);
  });

  it('taking a gnome leaves an empty pedestal and names the gnome', () => {
    const dug = holdE(farm, nightAt(farm, 7, 1), 1).night;
    const r = exit(dug);
    expect(r.gnomeTaken).toBe('ped1');
    expect(r.traces).toContainEqual({ id: expect.any(String), kind: 'emptyPedestal', target: 'ped1' });
    expect(r.changes).toContainEqual({ kind: 'pedestal', id: 'ped1', hasGnome: false });
  });

  it('trace ids run t1, t2, ... in a fixed order', () => {
    let n = holdE(farm, nightAt(farm, 3, 2), 1).night; // fence
    n = holdE(farm, { ...n, player: { x: 3.5, y: 1.5 } }, 1).night; // gate
    expect(exit(n).traces.map((t) => [t.id, t.kind])).toEqual([
      ['t1', 'brokenFence'],
      ['t2', 'gate'],
    ]);
  });

  it('the result holds no path, entry, position, timing or player stamina (Configuration A2)', () => {
    const dug = holdE(farm, nightAt(farm, 7, 1), 1).night;
    const json = JSON.stringify(exit(dug));
    for (const banned of ['hole1', 'entry', 'player', 'stamina', 'seconds', 'facing']) expect(json).not.toContain(banned);
    expect(Object.keys(exit(dug)).sort()).toEqual(['changes', 'gnomeTaken', 'night', 'spotted', 'traces']);
  });

  it('endNight refuses a night that has not ended', () => {
    expect(() => endNight(farm, nightAt(farm, 1, 1))).toThrow();
  });
});

describe('GDD 5.5 and 5.9 danger and being spotted', () => {
  it('the window watches its line up to a bush; behind the bush is safe', () => {
    const f = farmFrom([
      '#####',
      '#.W.#',
      '#.W.#',
      '#.B.#',
      '#.,.#',
      'D...#',
      '#####',
    ]);
    const d = dangerGrid(f, []);
    expect(d[idx(f, 2, 1)]).toBe('window');
    expect(d[idx(f, 2, 2)]).toBe('window');
    expect(d[idx(f, 2, 3)]).toBeNull();
  });

  it('a bush inside the sight line covers itself and every tile behind it', () => {
    const f = farmFrom([
      '#####',
      '#.W.#',
      '#.B.#',
      '#.W.#',
      'D...#',
      '#####',
    ]);
    // The window rectangle spans (2,1)-(2,3); the bush at (2,2) blocks it.
    const d = dangerGrid(f, []);
    expect([d[idx(f, 2, 1)], d[idx(f, 2, 2)], d[idx(f, 2, 3)]]).toEqual(['window', null, null]);
  });

  it('a lamp lights tiles within 2, edge included; the dog alerts within 2', () => {
    const f = farmFrom([
      '#########',
      'D.......#',
      '#...L...#',
      '#.......#',
      '#.......#',
      '#########',
    ]);
    const lit = dangerGrid(f, [{ id: 'l', kind: 'lamp', slot: 'post1' }]);
    expect(lit[idx(f, 6, 2)]).toBe('lamp'); // distance 2
    expect(lit[idx(f, 6, 3)]).toBeNull(); // distance sqrt 5
    expect(lit[idx(f, 4, 4)]).toBe('lamp'); // distance 2
    const fd = farmFrom(['#######', 'D.....#', '#..K..#', '#######']);
    const dog = dangerGrid(fd, [{ id: 'd', kind: 'doghouse', slot: 'spot1' }]);
    expect(dog[idx(fd, 5, 2)]).toBe('dog');
    expect(dog[idx(fd, 1, 1)]).toBeNull(); // distance sqrt 5
  });

  it('spotted when the centre of your tile is lit: the night ends, the gnome goes back, a sighting is left', () => {
    const f = farmFrom([
      '#######',
      'D.g...#',
      '#...L.#',
      '#######',
    ]);
    const s = sessionFor(f, [{ id: 'l', kind: 'lamp', slot: 'post1' }]);
    let n = nightAt(f, 1, 1, s);
    n = holdE(f, n, 1).night;
    expect(n.carrying).toBe('ped1');
    // (2,1) is at distance sqrt 5 from the lamp: safe. (3,1) is at sqrt 2: lit.
    n = run(f, n, { moveX: 1 }, 0.25).night;
    expect(n.ended).toBeNull();
    const r = run(f, n, { moveX: 1 }, 0.5);
    expect(r.night.ended).toEqual({ reason: 'spotted', tile: { x: 3, y: 1 }, by: 'lamp' });
    expect(r.night.carrying).toBeNull();
    expect(r.night.world.gnomes).toEqual(['ped1']);
    const result = endNight(f, r.night);
    expect(result).toMatchObject({ spotted: true, gnomeTaken: null });
    expect(result.traces[0]).toEqual({ id: 't1', kind: 'sighting', target: 'tile_3_1' });
    expect(result.traces.some((t) => t.kind === 'emptyPedestal')).toBe(false);
  });

  it('a tile is judged by its centre: the box may overlap a lit tile while the feet are not on it', () => {
    const f = farmFrom(['######', 'D..L.#', '######']);
    const s = sessionFor(f, [{ id: 'l', kind: 'lamp', slot: 'post1' }]);
    // Lamp at (3,1) lights x >= 1. Standing on hole (0,1) next to lit (1,1) is safe.
    const n = { ...nightAt(f, 0, 1, s), player: { x: 0.95, y: 1.5 } };
    expect(run(f, n, {}, STEP).night.ended).toBeNull();
  });
});

describe('GDD 5.11 rule parameters', () => {
  it('routes take 4-neighbour steps and never cut a corner', () => {
    const f = farmFrom([
      '#####',
      'D.###',
      '##.##',
      '#####',
    ]);
    // (2,2) touches (1,1) only diagonally.
    expect(canWalkOut(f, initialWorld(f, []), { x: 2, y: 2 })).toBe(false);
  });

  it('a closed plain gate is passable; a locked padlock and an intact fence are not', () => {
    const plain = farmFrom(['######', 'D.G.g#', '######']);
    expect(canWalkOut(plain, initialWorld(plain, []), { x: 4, y: 1 })).toBe(true);
    const locked = farmFrom(['######', 'D.P.g#', '######']);
    const lw = initialWorld(locked, [{ id: 'p', kind: 'padlock', slot: 'gate1' }]);
    expect(canWalkOut(locked, lw, { x: 4, y: 1 })).toBe(false);
    const fence = farmFrom(['######', 'D.F.g#', '######']);
    expect(canWalkOut(fence, initialWorld(fence, []), { x: 4, y: 1 })).toBe(false);
    expect(canWalkOut(fence, { ...initialWorld(fence, []), fenceGaps: [{ fence: 'fence1', x: 2, y: 1 }] }, { x: 4, y: 1 })).toBe(true);
  });

  it('open route: each locked padlock or intact fence costs 1; the route may cost at most 1; danger is ignored', () => {
    const one = farmFrom(['#######', 'D.F..g#', '#######']);
    expect(openRouteCost(one, initialWorld(one, []))).toBe(1);
    expect(hasOpenRoute(one, initialWorld(one, []))).toBe(true);
    const two = farmFrom(['#######', 'D.F.Pg#', '#######']);
    const tw = initialWorld(two, [{ id: 'p', kind: 'padlock', slot: 'gate1' }]);
    expect(openRouteCost(two, tw)).toBe(2);
    expect(hasOpenRoute(two, tw)).toBe(false);
    const free = farmFrom(['#######', 'D.G.Lg#', '#######']);
    expect(openRouteCost(free, initialWorld(free, []))).toBe(0);
    // A taken gnome no longer counts.
    expect(openRouteCost(free, { ...initialWorld(free, []), gnomes: [] })).toBe(Infinity);
  });

  it('distance is straight-line between tile centres', () => {
    expect(tileDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(tileDistance({ x: 2, y: 2 }, { x: 3, y: 3 })).toBeCloseTo(Math.SQRT2);
  });

  it('player sight: 5 tiles, edge included', () => {
    const f = farmFrom(['D' + '.'.repeat(7) + '#', '#'.repeat(9)]);
    const seen = visibleTiles(f, { x: 0, y: 0 });
    expect(seen[idx(f, 5, 0)]).toBe(true);
    expect(seen[idx(f, 6, 0)]).toBe(false);
  });

  it('player sight: hedges and bushes block; the blocking tile itself is seen', () => {
    const f = farmFrom([
      'D.#..',
      '..B..',
      '.....',
    ]);
    expect(lineOfSight(f, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(true); // the hedge itself
    expect(lineOfSight(f, { x: 0, y: 0 }, { x: 3, y: 0 })).toBe(false);
    expect(lineOfSight(f, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(false); // bush
    expect(lineOfSight(f, { x: 0, y: 2 }, { x: 4, y: 2 })).toBe(true);
  });

  it('player sight: a line that only touches a corner is not blocked', () => {
    const f = farmFrom([
      '.#.',
      '#..',
      '...',
    ]);
    // (0,0) -> (2,2) passes exactly through the corners of the hedges at (1,0) and (0,1).
    expect(lineOfSight(f, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(true);
    // (0,0) -> (2,1) crosses the hedge at (1,0).
    expect(lineOfSight(f, { x: 0, y: 0 }, { x: 2, y: 1 })).toBe(false);
  });

  it('self-lock check has no stamina allowance (a fence counts as closed)', () => {
    const f = farmFrom(['#######', 'D.F.P.#', '#######']);
    const s = sessionFor(f, []);
    const world = withGate(s.world, 'gate1', { open: true, padlock: 'open' });
    const n = nightAt(f, 5, 1, { ...s, world });
    expect(currentInteraction(f, n)).toMatchObject({ action: 'relock', blocked: 'selfLock' });
  });
});
