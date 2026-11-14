// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7) and T8.
// Public surface of the engine-free rules package (Technical plan Section 4).

export * from './types.ts';
export * from './rules.ts';
export { loadFarm, FarmFormatError, fnv1a, pixelsToTileRect, tileIndex } from './farm.ts';
export { startNight, tick, endNight, currentInteraction, boxHitsSolid, boxTiles, WALK_SPEED_TILES_PER_SECOND, PLAYER_HALF_EXTENT } from './night.ts';
export {
  canWalkOut,
  dangerGrid,
  hasOpenRoute,
  inSafeZone,
  initialLayout,
  initialWorld,
  lineOfSight,
  openRouteCost,
  solidGrid,
  tileDistance,
  tileOf,
  tilesOf,
  visibleTiles,
  windowLine,
} from './world.ts';
export { newSession, resolveNight, commitPlan, projectPlayerView, NotImplementedError } from './session.ts';
export { buildFarmerContext, ruleFarmer, validatePlan, PLACEHOLDER_RULE_LINE } from './farmer.ts';
