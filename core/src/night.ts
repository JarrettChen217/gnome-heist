// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7) and T8; it implements the night rules of GDD 5.2, 5.4, 5.5, 5.6, 5.9 and 5.11.

import { tileIndex } from './farm.ts';
import { ACTION_COST, CARRY_LIMIT, HOLD_SECONDS, PLAYER_STAMINA } from './rules.ts';
import type {
  ActionKind,
  BlockReason,
  FarmDef,
  GateState,
  Interaction,
  NightChange,
  NightEvent,
  NightInput,
  NightResult,
  NightState,
  SessionState,
  Tile,
  Trace,
  Vec,
  WorldState,
} from './types.ts';
import { canWalkOut, dangerGrid, dogHoleAt, fenceAt, pedestalAt, solidGrid, tileOf } from './world.ts';

/**
 * PROVISIONAL movement constants (GDD 5.11: continuous movement, collision by
 * whole tiles); not yet in the GDD, pending Hao.
 */
export const WALK_SPEED_TILES_PER_SECOND = 4;
/** Half the side of the player's square collision box, in tiles. */
export const PLAYER_HALF_EXTENT = 0.3;
/** Longest step integrated at once, so a long frame cannot tunnel through a wall. */
const MAX_STEP_TILES = 0.25;
/** Distances from the player's feet to the closest point on the gate, in tiles. */
const GATE_REACH = 1.25;
const HELD_GATE_REACH = 1.55;

/** Start a night at the chosen dog hole, with stamina refilled. */
export function startNight(session: SessionState, farm: FarmDef, entry: string = farm.dogHoles[0]?.id ?? ''): NightState {
  const hole = farm.dogHoles.find((h) => h.id === entry);
  if (hole === undefined) throw new Error(`unknown dog hole "${entry}"`);
  return {
    night: session.night,
    entry: hole.id,
    player: { x: hole.rect.x + hole.rect.w / 2, y: hole.rect.y + hole.rect.h / 2 },
    stamina: PLAYER_STAMINA,
    world: session.world,
    startWorld: session.world,
    facing: { x: 0, y: 1 },
    carrying: null,
    footprints: [],
    hold: null,
    interactLatched: false,
    ended: null,
    danger: dangerGrid(farm, session.farmer.layout),
    solid: solidGrid(farm, session.world),
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
  return boxTiles(p).some((t) => isSolid(night, t.x, t.y));
}

/** Tiles the player's collision box overlaps. */
export function boxTiles(p: Vec): Tile[] {
  const h = PLAYER_HALF_EXTENT;
  const out: Tile[] = [];
  for (let y = Math.floor(p.y - h); y <= Math.ceil(p.y + h) - 1; y++) for (let x = Math.floor(p.x - h); x <= Math.ceil(p.x + h) - 1; x++) out.push({ x, y });
  return out;
}

/** Move along one axis; on contact, stop flush against the tile edge. */
function moveAxis(night: NightState, p: Vec, axis: 'x' | 'y', delta: number): { p: Vec; bumped: boolean } {
  if (delta === 0) return { p, bumped: false };
  const next = axis === 'x' ? { x: p.x + delta, y: p.y } : { x: p.x, y: p.y + delta };
  if (!boxHitsSolid(night, next)) return { p: next, bumped: false };
  const h = PLAYER_HALF_EXTENT;
  const c = axis === 'x' ? p.x : p.y;
  const flush = delta > 0 ? Math.ceil(c + h) - h : Math.floor(c - h) + h;
  const clamped = axis === 'x' ? { x: flush, y: p.y } : { x: p.x, y: flush };
  return { p: boxHitsSolid(night, clamped) ? p : clamped, bumped: true };
}

/**
 * Corner assist: when walking along `axis` is blocked, but the tile straight
 * ahead in the player's own row (or column) is open, move up to `amount`
 * across toward that row's centre line.
 */
function nudge(night: NightState, p: Vec, axis: 'x' | 'y', dir: number, amount: number): Vec {
  const h = PLAYER_HALF_EXTENT;
  const along = axis === 'x' ? p.x : p.y;
  const across = axis === 'x' ? p.y : p.x;
  const ahead = Math.floor(along + dir * (h + 0.01));
  const lane = Math.floor(across);
  const open = axis === 'x' ? !isSolid(night, ahead, lane) : !isSolid(night, lane, ahead);
  const centre = lane + 0.5;
  if (!open || across === centre) return p;
  const moved = across + Math.sign(centre - across) * Math.min(amount, Math.abs(centre - across));
  const q = axis === 'x' ? { x: p.x, y: moved } : { x: moved, y: p.y };
  return boxHitsSolid(night, q) ? p : q;
}

const gate = (world: WorldState, id: string): GateState => {
  const g = world.gates.find((x) => x.id === id);
  if (g === undefined) throw new Error(`unknown gate "${id}"`);
  return g;
};
const withGate = (world: WorldState, next: GateState): WorldState => ({
  ...world,
  gates: world.gates.map((g) => (g.id === next.id ? next : g)),
});
const isGap = (world: WorldState, t: Tile) => world.fenceGaps.some((g) => g.x === t.x && g.y === t.y);

/** Trace to the closest point on the gate edge. Intervening solid tiles block reach. */
function canReachGate(night: NightState, tile: Tile): boolean {
  let { x, y } = tileOf(night.player);
  const dx = Math.max(tile.x, Math.min(night.player.x, tile.x + 1)) - night.player.x;
  const dy = Math.max(tile.y, Math.min(night.player.y, tile.y + 1)) - night.player.y;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  while (x !== tile.x || y !== tile.y) {
    const tx = x === tile.x || dx === 0 ? Infinity : (x + (sx > 0 ? 1 : 0) - night.player.x) / dx;
    const ty = y === tile.y || dy === 0 ? Infinity : (y + (sy > 0 ? 1 : 0) - night.player.y) / dy;
    if (tx === ty && isSolid(night, x + sx, y) && isSolid(night, x, y + sy)) return false;
    if (Math.min(tx, ty) >= 1) return true;
    if (tx <= ty) x += sx;
    if (ty <= tx) y += sy;
    if ((x !== tile.x || y !== tile.y) && isSolid(night, x, y)) return false;
  }
  return true;
}

/** The action offered by the prompt and performed by E, including any refusal reason. */
export function currentInteraction(farm: FarmDef, night: NightState): Interaction | null {
  if (night.ended !== null) return null;
  const here = tileOf(night.player);
  const hole = dogHoleAt(farm, here);
  if (hole) return make('endNight', hole.id, here, null);

  const options: { i: Interaction; d: number }[] = [];
  for (const g of farm.gates) {
    const { x, y, w, h } = g.rect;
    const dx = Math.max(x - night.player.x, 0, night.player.x - x - w);
    const dy = Math.max(y - night.player.y, 0, night.player.y - y - h);
    const holding = night.hold?.target === g.id;
    if (Math.hypot(dx, dy) > (holding ? HELD_GATE_REACH : GATE_REACH)) continue;
    const tile = { x: Math.max(x, Math.min(here.x, x + w - 1)), y: Math.max(y, Math.min(here.y, y + h - 1)) };
    if (!canReachGate(night, tile)) continue;

    const state = gate(night.world, g.id);
    const inGateway = boxTiles(night.player).some((b) => b.x >= x && b.x < x + w && b.y >= y && b.y < y + h);
    let interaction: Interaction;
    if (state.padlock === 'locked') interaction = make('pickLock', g.id, tile, null);
    else if (state.padlock === 'none') interaction = make(state.open ? 'closeGate' : 'openGate', g.id, tile, state.open && inGateway ? 'inGateway' : null);
    else {
      const locked = withGate(night.world, { ...state, open: false, padlock: 'locked' });
      const reason: BlockReason | null = inGateway ? 'inGateway' : canWalkOut(farm, locked, here) ? null : 'selfLock';
      interaction = make('relock', g.id, tile, reason);
    }
    if (holding && night.hold?.action === interaction.action) return checkStamina(interaction);
    options.push({ i: interaction, d: Math.hypot(tile.x + 0.5 - night.player.x, tile.y + 0.5 - night.player.y) });
  }
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const tile = { x: here.x + dx, y: here.y + dy };
    const d = Math.hypot(tile.x + 0.5 - night.player.x, tile.y + 0.5 - night.player.y);
    const f = fenceAt(farm, tile);
    if (f && !isGap(night.world, tile)) {
      options.push({ i: make('kickFence', f.id, tile, null), d });
      continue;
    }
    const p = pedestalAt(farm, tile);
    if (p && night.world.gnomes.includes(p.id)) {
      const full = (night.carrying === null ? 0 : 1) >= CARRY_LIMIT;
      options.push({ i: make('dig', p.id, tile, full ? 'handsFull' : null), d });
    }
  }
  // Nearest first; on a tie, the one the player faces; then the lower id.
  const facingTile = { x: here.x + night.facing.x, y: here.y + night.facing.y };
  const faced = (o: { i: Interaction }) => (o.i.tile.x === facingTile.x && o.i.tile.y === facingTile.y ? 0 : 1);
  options.sort(
    (a, b) =>
      (Math.abs(a.d - b.d) > 1e-9 ? a.d - b.d : 0) ||
      faced(a) - faced(b) ||
      (a.i.target < b.i.target ? -1 : a.i.target > b.i.target ? 1 : 0),
  );
  return options[0] ? checkStamina(options[0].i) : null;

  function checkStamina(i: Interaction): Interaction {
    return i.cost > night.stamina ? { ...i, blocked: 'noStamina' } : i;
  }

  function make(action: ActionKind, target: string, tile: Tile, blocked: BlockReason | null): Interaction {
    return { action, target, tile, cost: ACTION_COST[action], holdSeconds: HOLD_SECONDS[action], blocked };
  }
}

/** Apply a finished action. Only called when it is not blocked. */
function apply(farm: FarmDef, night: NightState, i: Interaction): NightState {
  const stamina = night.stamina - i.cost;
  switch (i.action) {
    case 'openGate':
    case 'closeGate':
    case 'pickLock':
    case 'relock': {
      const s = gate(night.world, i.target);
      const next: GateState =
        i.action === 'openGate'
          ? { ...s, open: true }
          : i.action === 'closeGate'
            ? { ...s, open: false }
            : i.action === 'pickLock'
              ? { ...s, open: true, padlock: 'open' }
              : { ...s, open: false, padlock: 'locked' };
      const world = withGate(night.world, next);
      return { ...night, stamina, world, solid: solidGrid(farm, world) };
    }
    case 'kickFence': {
      const world = { ...night.world, fenceGaps: [...night.world.fenceGaps, { fence: i.target, x: i.tile.x, y: i.tile.y }] };
      return { ...night, stamina, world, solid: solidGrid(farm, world) };
    }
    case 'dig':
      return { ...night, stamina, carrying: i.target, world: { ...night.world, gnomes: night.world.gnomes.filter((g) => g !== i.target) } };
    case 'endNight':
      return { ...night, hold: null, ended: { reason: 'exit', hole: i.target } };
  }
}

/**
 * One fixed step of the night. `dtSeconds` comes from the caller (core reads no clock).
 * Order: move, footprints, spotting, then the held action.
 */
export function tick(farm: FarmDef, night: NightState, input: NightInput, dtSeconds: number): { night: NightState; events: NightEvent[] } {
  if (night.ended !== null) return { night, events: [] };
  const events: NightEvent[] = [];

  // Movement and collision.
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
  let footprints = night.footprints;
  let spottedAt: Tile | null = null;
  const step = dist / steps;
  for (let i = 0; i < steps; i++) {
    const rx = moveAxis(night, p, 'x', dx * step);
    // Walking straight into a wall next to a one-tile opening slides you into line with it.
    const ax = rx.bumped && dy === 0 ? nudge(night, rx.p, 'x', Math.sign(dx), step) : rx.p;
    const ry = moveAxis(night, ax, 'y', dy * step);
    p = ry.bumped && dx === 0 ? nudge(night, ry.p, 'y', Math.sign(dy), step) : ry.p;
    bumped ||= rx.bumped || ry.bumped;
    // Footprints: one per soft tile entered (GDD 5.6, 5.11); counted at each sub-step so none is skipped.
    const t = tileOf(p);
    const idx = tileIndex(farm, t.x, t.y);
    if (farm.ground[idx] === 'soft' && !footprints.includes(idx)) {
      footprints = [...footprints, idx];
      events.push({ type: 'footprint', tile: t });
    }
    // Checked at every sub-step, so a long frame cannot carry the player across a danger tile.
    if (night.danger[idx]) {
      spottedAt = t;
      break;
    }
  }
  if (bumped) events.push({ type: 'bumped' });
  const facing =
    dx === 0 && dy === 0 ? night.facing : Math.abs(dx) >= Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
  let next: NightState = { ...night, player: p, footprints, facing };

  // Spotted: the centre of the player's tile is in danger (GDD 5.9, 5.11). The night ends at once.
  const here = spottedAt ?? tileOf(p);
  const danger = next.danger[tileIndex(farm, here.x, here.y)];
  if (danger) {
    const end = { reason: 'spotted', tile: here, by: danger } as const;
    // A carried gnome goes back to its pedestal.
    const gnomes = next.carrying === null ? next.world.gnomes : [...next.world.gnomes, next.carrying];
    next = { ...next, hold: null, carrying: null, world: { ...next.world, gnomes }, ended: end };
    events.push({ type: 'spotted', tile: here, by: danger }, { type: 'ended', end });
    return { night: next, events };
  }

  // Held actions (hold E; GDD 5.4, 11).
  if (!input.interact) return { night: { ...next, hold: null, interactLatched: false }, events };
  if (next.interactLatched) return { night: next, events };
  const i = currentInteraction(farm, next);
  // Drifting out of reach must not spend the same press on a neighbouring fence or exit.
  if (next.hold && next.hold.target !== i?.target && farm.gates.some((g) => g.id === next.hold!.target)) {
    return { night: { ...next, hold: null, interactLatched: true }, events };
  }
  if (i === null) return { night: { ...next, hold: null }, events };
  if (i.blocked !== null) {
    // Refused: nothing happens and no stamina is spent; report it once per press.
    events.push({ type: 'refused', action: i.action, target: i.target, reason: i.blocked });
    return { night: { ...next, hold: null, interactLatched: true }, events };
  }
  const same = next.hold !== null && next.hold.action === i.action && next.hold.target === i.target;
  const seconds = (same ? next.hold!.seconds : 0) + Math.max(0, dtSeconds);
  if (seconds + 1e-9 < i.holdSeconds) return { night: { ...next, hold: { action: i.action, target: i.target, seconds } }, events };

  next = { ...apply(farm, next, i), hold: null, interactLatched: true };
  events.push({ type: 'action', action: i.action, target: i.target });
  if (next.ended !== null) events.push({ type: 'ended', end: next.ended });
  return { night: next, events };
}

/**
 * The night's result (GDD 5.6; Technical plan 4.1): the trace list and the
 * final state of every changed object. It never contains the path, the entry
 * hole, the timing, or the player's stamina (Configuration Document A2).
 */
export function endNight(farm: FarmDef, night: NightState): NightResult {
  if (night.ended === null) throw new Error('the night has not ended');
  const start = night.startWorld;
  const end = night.world;
  const raw: Omit<Trace, 'id'>[] = [];
  const changes: NightChange[] = [];

  if (night.ended.reason === 'spotted') raw.push({ kind: 'sighting', target: `tile_${night.ended.tile.x}_${night.ended.tile.y}` });

  for (const f of farm.fences) {
    const before = start.fenceGaps.filter((g) => g.fence === f.id);
    const after = end.fenceGaps.filter((g) => g.fence === f.id);
    if (after.length > before.length) {
      raw.push({ kind: 'brokenFence', target: f.id });
      changes.push({ kind: 'fence', id: f.id, gaps: after.map((g) => ({ x: g.x, y: g.y })) });
    }
  }
  for (const g of farm.gates) {
    const a = gate(start, g.id);
    const b = gate(end, g.id);
    if (a.padlock !== b.padlock) {
      changes.push({ kind: 'padlock', id: g.id, locked: b.padlock === 'locked' });
      if (b.padlock === 'open') raw.push({ kind: 'openLock', target: g.id });
      // Re-locking a padlock he left open also changes the gate from how he left it (GDD 5.6).
      else raw.push({ kind: 'gate', target: g.id });
    } else if (a.padlock === 'none' && a.open !== b.open) {
      raw.push({ kind: 'gate', target: g.id });
      changes.push({ kind: 'gate', id: g.id, open: b.open });
    }
  }
  const taken = night.ended.reason === 'exit' ? night.carrying : null;
  for (const p of farm.pedestals) {
    if (start.gnomes.includes(p.id) && !end.gnomes.includes(p.id)) {
      raw.push({ kind: 'emptyPedestal', target: p.id });
      changes.push({ kind: 'pedestal', id: p.id, hasGnome: false });
    }
  }
  for (const a of farm.areas) {
    const count = night.footprints.filter((idx) => {
      const x = idx % farm.width;
      const y = Math.floor(idx / farm.width);
      return x >= a.rect.x && x < a.rect.x + a.rect.w && y >= a.rect.y && y < a.rect.y + a.rect.h;
    }).length;
    if (count > 0) raw.push({ kind: 'footprints', target: a.id, count });
  }

  return {
    night: night.night,
    traces: raw.map((t, n) => ({ id: `t${n + 1}`, ...t })),
    changes,
    gnomeTaken: taken,
    spotted: night.ended.reason === 'spotted',
  };
}
