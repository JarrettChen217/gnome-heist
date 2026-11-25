// AI-use disclosure: Codex aligned the farmhouse animation with the generated facade under Hao's direction.
import type { FarmDef } from '@gnome-heist/core';
import facade from '@gnome-heist/maps/farmhouse-facade.json';
import { TILE_PX } from './constants.ts';

/** Pixel openings measured from the center of the window sightline at the house frontage. */
export function farmhouseOpenings(farm: FarmDef) {
  const sight = farm.windowSight[0]?.rect;
  const x = ((sight?.x ?? Math.floor(farm.width / 2)) + 0.5) * TILE_PX;
  const y = (sight?.y ?? 4) * TILE_PX;
  const place = (opening: typeof facade.window) => ({ ...opening, x: x + opening.x, y: y + opening.y });
  return { window: place(facade.window), door: place(facade.door), yardY: y + TILE_PX / 2 };
}
