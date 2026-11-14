// AI-use disclosure: Codex extracted the greybox fence placement under Hao's direction for the M0 review fixes.
import type { FarmObject } from '@gnome-heist/core';

/** Individual sprites covering a fence's collision rectangle. */
export function fenceSegments(fence: FarmObject): FarmObject[] {
  const segments: FarmObject[] = [];
  for (let y = fence.rect.y; y < fence.rect.y + fence.rect.h; y++) {
    for (let x = fence.rect.x; x < fence.rect.x + fence.rect.w; x++) {
      segments.push({ id: fence.id, rect: { x, y, w: 1, h: 1 } });
    }
  }
  return segments;
}
