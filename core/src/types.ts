// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7); the shapes follow docs/architecture.md Section 4 and docs/configuration.md A3.
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
  /** Starting placement is decided in T8/T10; empty in M0. */
  readonly layout: readonly Defense[];
  /** Up to 3 previous mornings (Configuration Document A5); filled in T10. */
  readonly memory: readonly MorningSummary[];
}

export interface MorningSummary {
  readonly traces: readonly Trace[];
  readonly actions: readonly PlanAction[];
  readonly line: string;
}

export interface SessionState {
  readonly night: number;
  readonly strikes: number;
  readonly farmer: FarmerState;
  readonly seed: number;
}

export interface NightState {
  readonly night: number;
  /** Player feet position, tile units. */
  readonly player: Vec;
  readonly stamina: number;
  /** Solid tiles, row-major; derived from the farm and the night's gate and fence state. */
  readonly solid: readonly boolean[];
  readonly width: number;
  readonly height: number;
}

export type NightEvent = { readonly type: 'bumped' };

/** One entry of the trace list (GDD 5.6). Concrete kinds are filled in T8. */
export interface Trace {
  readonly id: string;
  readonly kind: 'footprints' | 'gate' | 'openLock' | 'brokenFence' | 'emptyPedestal' | 'sighting';
  readonly target: string;
}

/** What the client sends at the end of a night (GDD 5.6, Technical plan Section 4.1). */
export interface NightResult {
  readonly night: number;
  readonly traces: readonly Trace[];
  /** Final state of every changed gate, padlock, fence and pedestal; T8. */
  readonly changes: readonly { readonly id: string; readonly state: string }[];
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
}

export type ValidationResult =
  | { readonly ok: true; readonly plan: Plan }
  | { readonly ok: false; readonly violations: readonly string[] };

/** What the client may draw (Technical plan Section 4.4); filled in T9. */
export interface PlayerView {
  readonly width: number;
  readonly height: number;
}
