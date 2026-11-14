// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7).
// Codex added unsupported tile-size regression cases under Hao's direction.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FarmFormatError, loadFarm } from '../src/index.ts';

const raw = readFileSync(new URL('../../maps/farm.tmj', import.meta.url), 'utf8');
const fresh = (): Record<string, any> => JSON.parse(raw);

function problemsOf(mutate: (m: Record<string, any>) => void): readonly string[] {
  const m = fresh();
  mutate(m);
  try {
    loadFarm(m);
  } catch (e) {
    if (e instanceof FarmFormatError) return e.problems;
    throw e;
  }
  return [];
}
const layer = (m: Record<string, any>, name: string) => m.layers.find((l: any) => l.name === name);

describe('loadFarm on the greybox farm', () => {
  const farm = loadFarm(fresh());

  it('reads the GDD 5.1 counts', () => {
    expect(farm.width).toBe(24);
    expect(farm.height).toBe(18);
    expect(farm.dogHoles).toHaveLength(3);
    expect(farm.pedestals).toHaveLength(5);
    expect(farm.gates).toHaveLength(4);
    expect(farm.gates.filter((g) => g.padlocked)).toHaveLength(2);
    expect(farm.fences.length).toBeGreaterThanOrEqual(1);
  });

  it('reads ground kinds from tileset custom properties', () => {
    expect(farm.ground[0]).toBe('blocked'); // corner hedge
    expect(new Set(farm.ground)).toEqual(new Set(['soft', 'stone', 'blocked']));
  });

  it('converts object pixels to whole tiles', () => {
    expect(farm.dogHoles.find((d) => d.id === 'hole_west')?.rect).toEqual({ x: 0, y: 10, w: 1, h: 1 });
    expect(farm.fences[0]?.rect).toEqual({ x: 15, y: 10, w: 1, h: 3 });
  });

  it('gives a stable map version that changes with the file', () => {
    expect(loadFarm(fresh()).mapVersion).toBe(farm.mapVersion);
    const m = fresh();
    layer(m, 'ground').data[30] = 2; // soft -> stone
    expect(loadFarm(m).mapVersion).not.toBe(farm.mapVersion);
  });
});

describe('loadFarm rejects maps outside the Tiled subset', () => {
  it.each<[string, (m: Record<string, any>) => void, RegExp]>([
    ['isometric', (m) => (m.orientation = 'isometric'), /orthogonal/],
    ['infinite', (m) => (m.infinite = true), /finite/],
    ['unsupported tile width', (m) => {
      m.tilewidth = 32;
      for (const l of m.layers) for (const o of l.objects ?? []) { o.x *= 2; o.width *= 2; }
    }, /16x16/],
    ['unsupported tile height', (m) => {
      m.tileheight = 32;
      for (const l of m.layers) for (const o of l.objects ?? []) { o.y *= 2; o.height *= 2; }
    }, /16x16/],
    ['unsupported tileset size', (m) => (m.tilesets[0].tilewidth = 32), /16x16/],
    ['external tileset', (m) => (m.tilesets = [{ firstgid: 1, source: 'greybox.tsx' }]), /external/],
    ['compressed data', (m) => Object.assign(layer(m, 'ground'), { encoding: 'base64', compression: 'zlib' }), /uncompressed/],
    ['unknown layer', (m) => m.layers.push({ name: 'patrols', type: 'objectgroup', objects: [] }), /unsupported layer/],
    ['missing layer', (m) => (m.layers = m.layers.filter((l: any) => l.name !== 'gates')), /missing layer "gates"/],
    ['duplicate id', (m) => (layer(m, 'pedestals').objects[1].properties[0].value = 'ped_nw'), /duplicate id "ped_nw"/],
    ['missing id', (m) => (layer(m, 'bushes').objects[0].properties = []), /needs a string "id"/],
    ['misaligned object', (m) => (layer(m, 'lampPosts').objects[0].x += 3), /whole tiles/],
    ['ellipse object', (m) => (layer(m, 'bushes').objects[0].ellipse = true), /rectangle/],
    ['gate without padlocked', (m) => (layer(m, 'gates').objects[0].properties.length = 1), /padlocked/],
    ['flipped tile', (m) => (layer(m, 'ground').data[0] |= 0x80000000), /no kind/],
    ['unknown ground kind', (m) => (m.tilesets[0].tiles[0].properties[0].value = 'lava'), /unknown kind/],
    // GDD checks (T8)
    ['lamp post in a safe zone', (m) => Object.assign(layer(m, 'lampPosts').objects[0], { x: 2 * 16, y: 10 * 16 }), /post_nw" is inside an entry safe zone/],
    ['window line not at a wall', (m) => Object.assign(layer(m, 'windowSight').objects[0], { y: 5 * 16 }), /must be one tile wide and start at a wall/],
    [
      'no open route at the start',
      (m) => (layer(m, 'pedestals').objects = [{ ...layer(m, 'pedestals').objects[0], x: 10 * 16, y: 1 * 16 }]),
      /no gnome is reachable/,
    ],
  ])('%s', (_name, mutate, pattern) => {
    expect(problemsOf(mutate).join('\n')).toMatch(pattern);
  });
});
