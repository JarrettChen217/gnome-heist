// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7) and T8; the values are copied from GDD 5.2, 5.4, 5.7, 5.11 and Configuration Document A3, except those marked provisional.

/** Player stamina per night (GDD 5.4). */
export const PLAYER_STAMINA = 2;
/** The farmer's stamina, refilled every morning (GDD 5.7). */
export const FARMER_STAMINA = 2;
/** The farmer's starting money (GDD 5.7). */
export const FARMER_START_MONEY = 1;
/** Nights in a session (GDD 5.10). */
export const NIGHTS_PER_SESSION = 5;
/** Longest farmer line (Configuration Document A3). */
export const MAX_LINE_LENGTH = 80;

/** Entry safe zone: nothing within this distance of a dog hole (GDD 5.2). */
export const SAFE_ZONE_RADIUS = 2;
/** A lamp lights tiles within this distance (GDD 5.11). */
export const LAMP_RADIUS = 2;
/** The dog's alert radius around its doghouse (GDD 5.11). */
export const DOG_RADIUS = 2;
/** Player sight in tiles (GDD 5.11); hedges, bushes and the house block it. */
export const PLAYER_SIGHT_RADIUS = 5;
/** The open route the farmer must leave costs at most this much stamina (GDD 5.7, 5.11). */
export const OPEN_ROUTE_MAX_STAMINA = 1;
/** Stamina cost of each night action (GDD 5.4). */
export const ACTION_COST = {
  openGate: 0,
  closeGate: 0,
  pickLock: 1,
  relock: 1,
  kickFence: 1,
  dig: 1,
  endNight: 0,
} as const;
/**
 * Seconds E is held to finish each action. GDD 5.4 gives "about 1 s" for a
 * plain gate; the other durations are PROVISIONAL (T8) until Hao confirms.
 * Ending the night is a press.
 */
export const HOLD_SECONDS = {
  openGate: 1,
  closeGate: 1,
  pickLock: 1,
  relock: 1,
  kickFence: 1,
  dig: 1,
  endNight: 0,
} as const;
/** PROVISIONAL (T8): one gnome carried at a time; the NightResult names one gnome taken. */
export const CARRY_LIMIT = 1;
