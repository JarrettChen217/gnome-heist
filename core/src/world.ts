// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for T8; it implements the route, distance, danger and sight rows of GDD 5.11 and the safe zone of GDD 5.2.
//
// Boundary semantics fixed here (GDD 5.11 asks for them to be fixed in code in T8):
// - Distance is straight-line between tile centres; a range includes its edge (d <= r).
// - A continuous position is on the tile floor(x), floor(y).
// - Routes take 4-neighbour steps; a closed plain gate is passable, a locked padlocked gate
//   and an intact fence tile are not (the open route lets each cost 1 stamina).
// - The window's sight line is a 1-tile-wide rectangle that starts at a wall. It watches
//   its tiles up to the first bush or blocked tile; that tile and the ones behind it are safe.
// - Player sight: a tile is seen if the segment between the two tile centres passes through
//   no hedge, house or bush tile on the way; a segment that only touches a corner is not blocked.

import { tileIndex } from './farm.ts';
import { DOG_RADIUS, LAMP_RADIUS, OPEN_ROUTE_MAX_STAMINA, PLAYER_SIGHT_RADIUS, SAFE_ZONE_RADIUS } from './rules.ts';
import type { DangerKind, Defense, FarmDef, FarmObject, GateState, Tile, Vec, WorldState } from './types.ts';

export const tileOf = (p: Vec): Tile => ({ x: Math.floor(p.x), y: Math.floor(p.y) });

/** Straight-line distance between two tile centres. */
export const tileDistance = (a: Tile, b: Tile): number => Math.hypot(a.x - b.x, a.y - b.y);

export function tilesOf(o: FarmObject): Tile[] {
  const out: Tile[] = [];
  for (let y = o.rect.y; y < o.rect.y + o.rect.h; y++) for (let x = o.rect.x; x < o.rect.x + o.rect.w; x++) out.push({ x, y });
  return out;
}

const objectAt = (objects: readonly FarmObject[], t: Tile): FarmObject | undefined =>
  objects.find((o) => t.x >= o.rect.x && t.x < o.rect.x + o.rect.w && t.y >= o.rect.y && t.y < o.rect.y + o.rect.h);

export const gateAt = (farm: FarmDef, t: Tile) => objectAt(farm.gates, t);
export const fenceAt = (farm: FarmDef, t: Tile) => objectAt(farm.fences, t);
export const pedestalAt = (farm: FarmDef, t: Tile) => objectAt(farm.pedestals, t);
export const dogHoleAt = (farm: FarmDef, t: Tile) => objectAt(farm.dogHoles, t);
export const bushAt = (farm: FarmDef, t: Tile) => objectAt(farm.bushes, t);

/** Is any tile of `o` within the entry safe zone of a dog hole (GDD 5.2)? */
export function inSafeZone(farm: FarmDef, o: FarmObject): boolean {
  return tilesOf(o).some((t) => farm.dogHoles.some((h) => tilesOf(h).some((ht) => tileDistance(t, ht) <= SAFE_ZONE_RADIUS)));
}

/**
 * The farmer's starting defenses. OPEN QUESTION for Hao: the map marks two gates
 * as padlocked while GDD 5.7 [Proposed] says he starts with 1 lamp and 1 padlock.
 * Until he decides, this keeps the M0 behaviour: a padlock on every gate the
 * map marks `padlocked`, and no lamp or doghouse.
 */
export function initialLayout(farm: FarmDef): Defense[] {
  return farm.gates.filter((g) => g.padlocked).map((g) => ({ id: `padlock_${g.id}`, kind: 'padlock', slot: g.id }));
}

/** Every gate closed, padlocks locked, fences whole, every gnome on its pedestal. */
export function initialWorld(farm: FarmDef, layout: readonly Defense[]): WorldState {
  const locks = new Set(layout.filter((d) => d.kind === 'padlock').map((d) => d.slot));
  return {
    gates: farm.gates.map((g) => ({ id: g.id, open: false, padlock: locks.has(g.id) ? 'locked' : 'none' })),
    fenceGaps: [],
    gnomes: farm.pedestals.map((p) => p.id),
  };
}

const gateState = (world: WorldState, id: string): GateState | undefined => world.gates.find((g) => g.id === id);

/** Can the player stand on this tile right now? */
export function solidGrid(farm: FarmDef, world: WorldState): boolean[] {
  const solid = farm.ground.map((k) => k === 'blocked');
  for (const g of farm.gates) {
    const open = gateState(world, g.id)?.open ?? false;
    for (const t of tilesOf(g)) solid[tileIndex(farm, t.x, t.y)] = !open;
  }
  for (const f of farm.fences) for (const t of tilesOf(f)) solid[tileIndex(farm, t.x, t.y)] = true;
  for (const gap of world.fenceGaps) solid[tileIndex(farm, gap.x, gap.y)] = false;
  return solid;
}

/** Route step cost into a tile: 0 passable, 1 needs a stamina action, null never (GDD 5.11 "Routes"). */
function stepCost(farm: FarmDef, world: WorldState, t: Tile): 0 | 1 | null {
  if (farm.ground[tileIndex(farm, t.x, t.y)] === 'blocked') return null;
  const gate = gateAt(farm, t);
  if (gate) return gateState(world, gate.id)?.padlock === 'locked' ? 1 : 0;
  const fence = fenceAt(farm, t);
  if (fence) return world.fenceGaps.some((g) => g.x === t.x && g.y === t.y) ? 0 : 1;
  return 0;
}

/** Cheapest route cost (0-1 BFS) from `starts` to each tile; `allowCost` false makes cost-1 tiles impassable. */
function routeCosts(farm: FarmDef, world: WorldState, starts: readonly Tile[], allowCost: boolean): number[] {
  const W = farm.width;
  const H = farm.height;
  const cost = new Array<number>(W * H).fill(Infinity);
  const deque: Tile[] = [];
  for (const s of starts) {
    if (stepCost(farm, world, s) === null) continue;
    cost[tileIndex(farm, s.x, s.y)] = 0;
    deque.push(s);
  }
  while (deque.length > 0) {
    const cur = deque.shift()!;
    const c = cost[tileIndex(farm, cur.x, cur.y)]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = { x: cur.x + dx, y: cur.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= W || n.y >= H) continue;
      const step = stepCost(farm, world, n);
      if (step === null || (step === 1 && !allowCost)) continue;
      const i = tileIndex(farm, n.x, n.y);
      if (c + step < cost[i]!) {
        cost[i] = c + step;
        if (step === 0) deque.unshift(n);
        else deque.push(n);
      }
    }
  }
  return cost;
}

/** The cheapest stamina cost from any dog hole to any remaining gnome (Infinity if none). Danger is ignored. */
export function openRouteCost(farm: FarmDef, world: WorldState): number {
  const cost = routeCosts(farm, world, farm.dogHoles.flatMap(tilesOf), true);
  const gnomes = farm.pedestals.filter((p) => world.gnomes.includes(p.id));
  return Math.min(Infinity, ...gnomes.flatMap(tilesOf).map((t) => cost[tileIndex(farm, t.x, t.y)]!));
}

/** GDD 5.7: some remaining gnome is reachable from some dog hole for at most 1 stamina. */
export const hasOpenRoute = (farm: FarmDef, world: WorldState): boolean => openRouteCost(farm, world) <= OPEN_ROUTE_MAX_STAMINA;

/** Self-lock check (GDD 5.2, 5.11): can the player walk from `from` to a dog hole with no stamina at all? */
export function canWalkOut(farm: FarmDef, world: WorldState, from: Tile): boolean {
  const cost = routeCosts(farm, world, [from], false);
  return farm.dogHoles.flatMap(tilesOf).some((t) => cost[tileIndex(farm, t.x, t.y)] === 0);
}

/** Cover for the window's sight line and for player sight: bushes and blocked ground. */
const isCover = (farm: FarmDef, t: Tile) => farm.ground[tileIndex(farm, t.x, t.y)] === 'blocked' || bushAt(farm, t) !== undefined;

/** The tiles of a window sight line, ordered from the window outwards; null if it does not start at a wall. */
export function windowLine(farm: FarmDef, w: FarmObject): Tile[] | null {
  const tiles = tilesOf(w);
  const vertical = w.rect.w === 1;
  if (w.rect.w !== 1 && w.rect.h !== 1) return null;
  const first = tiles[0]!;
  const last = tiles[tiles.length - 1]!;
  const before = vertical ? { x: first.x, y: first.y - 1 } : { x: first.x - 1, y: first.y };
  const after = vertical ? { x: last.x, y: last.y + 1 } : { x: last.x + 1, y: last.y };
  const blocked = (t: Tile) =>
    t.x >= 0 && t.y >= 0 && t.x < farm.width && t.y < farm.height && farm.ground[tileIndex(farm, t.x, t.y)] === 'blocked';
  if (blocked(before)) return tiles;
  if (blocked(after)) return tiles.reverse();
  return null;
}

/** Danger on the ground for one night (GDD 5.5, 5.11). Lamps and the dog come from the farmer's layout. */
export function dangerGrid(farm: FarmDef, layout: readonly Defense[]): (DangerKind | null)[] {
  const danger = new Array<DangerKind | null>(farm.width * farm.height).fill(null);
  const mark = (centre: Tile, radius: number, kind: DangerKind) => {
    for (let y = 0; y < farm.height; y++) {
      for (let x = 0; x < farm.width; x++) {
        const i = tileIndex(farm, x, y);
        if (danger[i] === null && farm.ground[i] !== 'blocked' && tileDistance(centre, { x, y }) <= radius) danger[i] = kind;
      }
    }
  };
  for (const w of farm.windowSight) {
    for (const t of windowLine(farm, w) ?? []) {
      if (isCover(farm, t)) break;
      danger[tileIndex(farm, t.x, t.y)] = 'window';
    }
  }
  for (const d of layout) {
    const slot =
      d.kind === 'lamp' ? farm.lampPosts.find((p) => p.id === d.slot) : d.kind === 'doghouse' ? farm.doghouseSpots.find((s) => s.id === d.slot) : undefined;
    if (slot) for (const t of tilesOf(slot)) mark(t, d.kind === 'lamp' ? LAMP_RADIUS : DOG_RADIUS, d.kind === 'lamp' ? 'lamp' : 'dog');
  }
  return danger;
}

/** Player sight from a tile (GDD 5.11): within 5 tiles, blocked by hedges, the house and bushes. */
export function visibleTiles(farm: FarmDef, from: Tile, radius: number = PLAYER_SIGHT_RADIUS): boolean[] {
  const seen = new Array<boolean>(farm.width * farm.height).fill(false);
  for (let y = 0; y < farm.height; y++) {
    for (let x = 0; x < farm.width; x++) {
      const to = { x, y };
      if (tileDistance(from, to) <= radius && lineOfSight(farm, from, to)) seen[tileIndex(farm, x, y)] = true;
    }
  }
  return seen;
}

/**
 * No cover tile strictly between the two tile centres. Exact grid traversal in
 * integers: where the segment crosses a grid corner exactly, it steps diagonally,
 * so touching a corner never blocks.
 */
export function lineOfSight(farm: FarmDef, a: Tile, b: Tile): boolean {
  const nx = Math.abs(b.x - a.x);
  const ny = Math.abs(b.y - a.y);
  const sx = Math.sign(b.x - a.x);
  const sy = Math.sign(b.y - a.y);
  let x = a.x;
  let y = a.y;
  let ix = 0;
  let iy = 0;
  while (ix < nx || iy < ny) {
    // Next vertical boundary at t = (2ix+1)/(2nx), next horizontal at (2iy+1)/(2ny); compare without division.
    const cmp = ix >= nx ? 1 : iy >= ny ? -1 : (2 * ix + 1) * ny - (2 * iy + 1) * nx;
    if (cmp < 0) {
      x += sx;
      ix++;
    } else if (cmp > 0) {
      y += sy;
      iy++;
    } else {
      x += sx;
      y += sy;
      ix++;
      iy++;
    }
    if (x === b.x && y === b.y) return true;
    if (isCover(farm, { x, y })) return false;
  }
  return true;
}
