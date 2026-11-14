// AI-use disclosure: Codex wrote these regression tests under Hao's direction for the M0 review fixes.
import { expect, it } from 'vitest';
import { fenceSegments } from '../src/fence.ts';

it('draws every cell of a wide fence, matching its solid rectangle', () => {
  expect(fenceSegments({ id: 'fence', rect: { x: 15, y: 10, w: 2, h: 3 } })).toEqual([
    { id: 'fence', rect: { x: 15, y: 10, w: 1, h: 1 } },
    { id: 'fence', rect: { x: 16, y: 10, w: 1, h: 1 } },
    { id: 'fence', rect: { x: 15, y: 11, w: 1, h: 1 } },
    { id: 'fence', rect: { x: 16, y: 11, w: 1, h: 1 } },
    { id: 'fence', rect: { x: 15, y: 12, w: 1, h: 1 } },
    { id: 'fence', rect: { x: 16, y: 12, w: 1, h: 1 } },
  ]);
});
