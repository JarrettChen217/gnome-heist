// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7) and extended it for the night rules (T8); the shapes follow docs/architecture.md Section 4 and docs/configuration.md A3.
// Codex added tall grass regions to the farm definition under Hao's direction.
//
// Engine-free types shared by the client, the Worker, and the tests.
// Positions are in tile units. Most shapes are M0 stubs: fields that belong
// to later tasks are marked with the task that fills them in.

/** A tile coordinate (integer column and row). */
export interface Tile {
  readonly x: number;
  readonly y: number;
}

/** A continuous position in tile units; (0, 0) is the top-left corner of the map. */
export interface Vec {
  readonly x: number;
  readonly y: number;
}

export type GroundKind = 'soft' | 'stone' | 'blocked';

/** A rectangle of whole tiles, as every Tiled object must be. */
export interface TileRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface FarmObject {
  readonly id: string;
  readonly rect: TileRect;
}

export interface GateDef extends FarmObject {
  readonly padlocked: boolean;
}

/** The validated farm, produced by `loadFarm` from the Tiled subset (Technical plan Section 5). */
export interface FarmDef {
  readonly width: number;
  readonly height: number;
  /** Row-major ground kinds, `width * height` entries. */
  readonly ground: readonly GroundKind[];
  readonly dogHoles: readonly FarmObject[];
  readonly pedestals: readonly FarmObject[];
  readonly gates: readonly GateDef[];
  readonly fences: readonly FarmObject[];
  readonly lampPosts: readonly FarmObject[];
  readonly doghouseSpots: readonly FarmObject[];
  readonly bushes: readonly FarmObject[];
  /** Visual foliage from an optional object layer. */
  readonly tallGrass: readonly FarmObject[];
  readonly windowSight: readonly FarmObject[];
  /** Named footprint areas; the id is the name the trace list uses. */
  readonly areas: readonly FarmObject[];
  /** Hash of the map file; client and Worker compare it on every morning. */
  readonly mapVersion: string;
}

/** Keyboard intent for one tick; each axis in [-1, 1]. Phaser only produces this. */
export interface NightInput {
  readonly moveX: number;
  readonly moveY: number;
  /** E is held down this tick. */
  readonly interact: boolean;
}

export type DefenseKind = 'lamp' | 'doghouse' | 'padlock';

export interface Defense {
  readonly id: string;
  readonly kind: DefenseKind;
  /** Slot id: a lamp post, doghouse spot, or gate. */
  readonly slot: string;
}

/** The farmer's side of a session, owned by the Durable Object. */
export interface FarmerState {
  readonly stamina: number;
  readonly money: number;
  /** His defenses. The starting set is still open (see `initialLayout`). */
  readonly layout: readonly Defense[];
  /** Up to 3 previous mornings (Configuration Document A5); filled in T10. */
  readonly memory: readonly MorningSummary[];
}

export interface MorningSummary {
  readonly traces: readonly Trace[];
  readonly actions: readonly PlanAction[];
  readonly line: string;
}

/** A gate's state. A plain gate has no padlock; a padlocked gate is locked (and closed) or picked (and open). */
export interface GateState {
  readonly id: string;
  readonly open: boolean;
  readonly padlock: 'none' | 'locked' | 'open';
}

/** One kicked gap in a fence. */
export interface FenceGap {
  readonly fence: string;
  readonly x: number;
  readonly y: number;
}

/** The farm's physical state between nights: gates, fence gaps, gnomes still on their pedestals. */
export interface WorldState {
  readonly gates: readonly GateState[];
  readonly fenceGaps: readonly FenceGap[];
  /** Pedestal ids that still hold a gnome. */
  readonly gnomes: readonly string[];
}

export interface SessionState {
  readonly night: number;
  readonly strikes: number;
  readonly farmer: FarmerState;
  readonly world: WorldState;
  readonly seed: number;
}

export type DangerKind = 'window' | 'lamp' | 'dog';

export type ActionKind = 'openGate' | 'closeGate' | 'pickLock' | 'relock' | 'kickFence' | 'dig' | 'endNight';

/** Why an action cannot be done right now. */
export type BlockReason = 'noStamina' | 'selfLock' | 'handsFull' | 'inGateway';

/** The action E would do now, as the prompt shows it (GDD 5.4, 12). */
export interface Interaction {
  readonly action: ActionKind;
  /** Object id: a gate, fence, pedestal, or dog hole. */
  readonly target: string;
  readonly tile: Tile;
  readonly cost: number;
  readonly holdSeconds: number;
  readonly blocked: BlockReason | null;
}

export type NightEnd =
  | { readonly reason: 'exit'; readonly hole: string }
  | { readonly reason: 'spotted'; readonly tile: Tile; readonly by: DangerKind };

export interface NightState {
  readonly night: number;
  /** The dog hole the player came in by. Client-side only: it never goes into the NightResult. */
  readonly entry: string;
  /** Player feet position, tile units. */
  readonly player: Vec;
  readonly stamina: number;
  readonly world: WorldState;
  /** The world as the farmer left it this evening; traces are the differences. */
  readonly startWorld: WorldState;
  /** Last direction walked, one axis (unit step); breaks ties between equally near objects. */
  readonly facing: Tile;
  /** Pedestal id of the gnome being carried. */
  readonly carrying: string | null;
  /** Soft tiles stepped on tonight, as tile indices in the order first entered. */
  readonly footprints: readonly number[];
  readonly hold: { readonly action: ActionKind; readonly target: string; readonly seconds: number } | null;
  /** After an action completes, E must be released before the next one starts. */
  readonly interactLatched: boolean;
  readonly ended: NightEnd | null;
  /** Danger per tile, row-major; fixed for the night (dangers stand still, GDD 2). */
  readonly danger: readonly (DangerKind | null)[];
  /** Solid tiles, row-major; follows gates and fence gaps. */
  readonly solid: readonly boolean[];
  readonly width: number;
  readonly height: number;
}

export type NightEvent =
  | { readonly type: 'bumped' }
  | { readonly type: 'footprint'; readonly tile: Tile }
  | { readonly type: 'action'; readonly action: ActionKind; readonly target: string }
  | { readonly type: 'refused'; readonly action: ActionKind; readonly target: string; readonly reason: BlockReason }
  | { readonly type: 'spotted'; readonly tile: Tile; readonly by: DangerKind }
  | { readonly type: 'ended'; readonly end: NightEnd };

/** One entry of the trace list (GDD 5.6). */
export interface Trace {
  readonly id: string;
  readonly kind: 'footprints' | 'gate' | 'openLock' | 'brokenFence' | 'emptyPedestal' | 'sighting';
  /** An area, gate, fence or pedestal id, or `tile_X_Y` for a sighting. */
  readonly target: string;
  /** Footprints only: soft tiles with prints in that area. */
  readonly count?: number;
}

/** Final state of one changed object (Technical plan Section 4.1, `endNight`). */
export type NightChange =
  | { readonly kind: 'gate'; readonly id: string; readonly open: boolean }
  | { readonly kind: 'padlock'; readonly id: string; readonly locked: boolean }
  | { readonly kind: 'fence'; readonly id: string; readonly gaps: readonly Tile[] }
  | { readonly kind: 'pedestal'; readonly id: string; readonly hasGnome: boolean };

/** What the client sends at the end of a night (GDD 5.6, Technical plan Section 4.1). */
export interface NightResult {
  readonly night: number;
  readonly traces: readonly Trace[];
  readonly changes: readonly NightChange[];
  readonly gnomeTaken: string | null;
  readonly spotted: boolean;
}

export type PlanAction =
  | { readonly type: 'buy'; readonly target: DefenseKind; readonly to: string }
  | { readonly type: 'move'; readonly target: string; readonly to: string }
  | { readonly type: 'repair'; readonly target: string; readonly to: 'none' };

/** The farmer's output (Configuration Document A3). */
export interface Plan {
  readonly actions: readonly PlanAction[];
  readonly line: string;
  readonly inspected: readonly string[];
}

/** The only data the farmer may see (Technical plan Section 4.2). */
export interface FarmerContext {
  readonly tracesToday: readonly Trace[];
  readonly layout: readonly Defense[];
  readonly stamina: number;
  readonly money: number;
  readonly memory: readonly MorningSummary[];
  /** The gate states the farmer left when the previous night began. */
  readonly eveningGates?: readonly GateState[];
}

export type ValidationResult =
  | { readonly ok: true; readonly plan: Plan }
  | { readonly ok: false; readonly kind: 'schema' | 'rules'; readonly violations: readonly string[] };

/** What the client may draw (Technical plan Section 4.4); filled in T9. */
export interface PlayerView {
  readonly width: number;
  readonly height: number;
}
