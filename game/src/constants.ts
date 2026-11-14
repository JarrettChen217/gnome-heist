// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7).

/** Pixels per tile in maps/farm.tmj. */
export const TILE_PX = 16;
/** Smallest camera zoom. The zoom stays an integer (crisp pixel art with roundPixels on) and grows until the map covers the window. */
export const MIN_CAMERA_ZOOM = 3;
/** Fixed rules step; core/ receives dt explicitly (it reads no clock). */
export const STEP_SECONDS = 1 / 60;
