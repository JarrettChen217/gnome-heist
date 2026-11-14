// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7).
// Public surface of the engine-free rules package (Technical plan Section 4).

export * from './types.ts';
export * from './rules.ts';
export { loadFarm, FarmFormatError, fnv1a, pixelsToTileRect, tileIndex } from './farm.ts';
export { startNight, tick, solidTiles, boxHitsSolid, WALK_SPEED_TILES_PER_SECOND, PLAYER_HALF_EXTENT } from './night.ts';
export { newSession, endNight, resolveNight, commitPlan, projectPlayerView, NotImplementedError } from './session.ts';
export { buildFarmerContext, ruleFarmer, validatePlan, PLACEHOLDER_RULE_LINE } from './farmer.ts';
