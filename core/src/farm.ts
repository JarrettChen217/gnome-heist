// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7); it implements the Tiled subset in docs/architecture.md Section 5.
// Codex added the rendering-grid size checks under Hao's direction after the M0 review.
//
// `loadFarm`: Tiled JSON -> validated FarmDef. Checks the file format and ids
// (M0) and the GDD (T8): no lamp post, doghouse spot or gate in an entry safe
// zone, every window sight line starts at a wall, and an open route at the start.

import type { FarmDef, FarmObject, GateDef, GroundKind, TileRect } from './types.ts';
import { hasOpenRoute, inSafeZone, initialLayout, initialWorld, windowLine } from './world.ts';

export class FarmFormatError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`Map is outside the supported Tiled subset:\n- ${problems.join('\n- ')}`);
    this.name = 'FarmFormatError';
    this.problems = problems;
  }
}

export const TILE_LAYERS = ['ground', 'decoration'] as const;
export const OBJECT_LAYERS = [
  'dogHoles',
  'pedestals',
  'gates',
  'fences',
  'lampPosts',
  'doghouseSpots',
  'bushes',
  'windowSight',
  'areas',
] as const;
type ObjectLayerName = (typeof OBJECT_LAYERS)[number];

const GROUND_KINDS: readonly GroundKind[] = ['soft', 'stone', 'blocked'];
/** Tiled stores flip and rotation in the top bits of a gid; the subset allows none. */
const GID_FLAG_MASK = 0xf0000000;

type Json = unknown;
type Obj = Record<string, Json>;

const isObj = (v: Json): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Tiled custom properties: [{ name, type, value }]. */
function readProps(v: Json, where: string, problems: string[]): Map<string, Json> {
  const out = new Map<string, Json>();
  if (v === undefined) return out;
  if (!Array.isArray(v)) {
    problems.push(`${where}: properties must be an array`);
    return out;
  }
  for (const p of v) {
    if (!isObj(p) || typeof p['name'] !== 'string') {
      problems.push(`${where}: malformed property`);
      continue;
    }
    out.set(p['name'], p['value']);
  }
  return out;
}

/** The one shared conversion from Tiled pixels to whole tiles. */
export function pixelsToTileRect(
  px: { x: number; y: number; width: number; height: number },
  tileWidth: number,
  tileHeight: number,
): TileRect | null {
  const r = {
    x: px.x / tileWidth,
    y: px.y / tileHeight,
    w: px.width / tileWidth,
    h: px.height / tileHeight,
  };
  const whole = [r.x, r.y, r.w, r.h].every((n) => Number.isInteger(n));
  if (!whole || r.w < 1 || r.h < 1) return null;
  return r;
}

/** FNV-1a 32-bit over a string, as 8 hex digits. Deterministic and engine-free. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function loadFarm(tiledJson: Json): FarmDef {
  const problems: string[] = [];
  if (!isObj(tiledJson)) throw new FarmFormatError(['map is not a JSON object']);
  const m = tiledJson;

  if (m['type'] !== 'map') problems.push('type must be "map"');
  if (m['orientation'] !== 'orthogonal') problems.push('orientation must be orthogonal');
  if (m['infinite'] !== false) problems.push('map must be finite');
  const width = m['width'];
  const height = m['height'];
  const tw = m['tilewidth'];
  const th = m['tileheight'];
  if (![width, height, tw, th].every((n) => typeof n === 'number' && Number.isInteger(n) && n > 0)) {
    throw new FarmFormatError([...problems, 'width, height, tilewidth and tileheight must be positive integers']);
  }
  const W = width as number;
  const H = height as number;
  const TW = tw as number;
  const TH = th as number;
  if (TW !== 16 || TH !== 16) problems.push('map tiles must be 16x16 pixels');

  // Tilesets: embedded only, each tile's ground kind as a custom property.
  const kindByGid = new Map<number, GroundKind>();
  const tilesets = Array.isArray(m['tilesets']) ? m['tilesets'] : [];
  if (tilesets.length === 0) problems.push('at least one embedded tileset is required');
  for (const [i, ts] of tilesets.entries()) {
    if (!isObj(ts)) {
      problems.push(`tileset ${i}: not an object`);
      continue;
    }
    if ('source' in ts) {
      problems.push(`tileset ${i}: external tilesets are not supported; embed it`);
      continue;
    }
    if (typeof ts['image'] !== 'string') problems.push(`tileset ${i}: needs a single image`);
    if (ts['tilewidth'] !== 16 || ts['tileheight'] !== 16) problems.push(`tileset ${i}: tiles must be 16x16 pixels`);
    const firstgid = ts['firstgid'];
    if (typeof firstgid !== 'number') {
      problems.push(`tileset ${i}: missing firstgid`);
      continue;
    }
    for (const t of Array.isArray(ts['tiles']) ? ts['tiles'] : []) {
      if (!isObj(t) || typeof t['id'] !== 'number') continue;
      const kind = readProps(t['properties'], `tileset ${i} tile ${t['id']}`, problems).get('kind');
      if (kind === undefined) continue;
      if (!GROUND_KINDS.includes(kind as GroundKind)) {
        problems.push(`tileset ${i} tile ${t['id']}: unknown kind "${String(kind)}"`);
        continue;
      }
      kindByGid.set(firstgid + t['id'], kind as GroundKind);
    }
  }

  // Layers: fixed names, plain tile arrays, rectangle objects.
  const layers = Array.isArray(m['layers']) ? m['layers'] : [];
  const seenLayers = new Set<string>();
  let ground: GroundKind[] = [];
  const objects = new Map<ObjectLayerName, Obj[]>();

  for (const layer of layers) {
    if (!isObj(layer) || typeof layer['name'] !== 'string') {
      problems.push('malformed layer');
      continue;
    }
    const name = layer['name'];
    if (seenLayers.has(name)) problems.push(`layer "${name}" appears twice`);
    seenLayers.add(name);
    if ((layer['offsetx'] ?? 0) !== 0 || (layer['offsety'] ?? 0) !== 0) {
      problems.push(`layer "${name}": layer offsets are not supported`);
    }

    if ((TILE_LAYERS as readonly string[]).includes(name)) {
      if (layer['type'] !== 'tilelayer') {
        problems.push(`layer "${name}" must be a tile layer`);
        continue;
      }
      if (layer['encoding'] !== undefined && layer['encoding'] !== 'csv') {
        problems.push(`layer "${name}": tile data must be an uncompressed array`);
        continue;
      }
      if (layer['compression'] !== undefined && layer['compression'] !== '') {
        problems.push(`layer "${name}": compressed tile data is not supported`);
        continue;
      }
      const data = layer['data'];
      if (!Array.isArray(data) || data.length !== W * H || layer['width'] !== W || layer['height'] !== H) {
        problems.push(`layer "${name}": data must be a ${W}x${H} array`);
        continue;
      }
      if (name === 'ground') {
        ground = data.map((gid, idx) => {
          const g = typeof gid === 'number' ? gid : -1;
          const kind = (g & GID_FLAG_MASK) === 0 ? kindByGid.get(g) : undefined;
          if (kind === undefined) {
            problems.push(`ground tile (${idx % W}, ${Math.floor(idx / W)}) has no kind`);
            return 'blocked';
          }
          return kind;
        });
      } else {
        for (const gid of data) {
          if (typeof gid !== 'number' || (gid & GID_FLAG_MASK) !== 0) {
            problems.push(`layer "${name}": flipped or rotated tiles are not supported`);
            break;
          }
        }
      }
    } else if ((OBJECT_LAYERS as readonly string[]).includes(name)) {
      if (layer['type'] !== 'objectgroup') {
        problems.push(`layer "${name}" must be an object layer`);
        continue;
      }
      objects.set(name as ObjectLayerName, (Array.isArray(layer['objects']) ? layer['objects'] : []).filter(isObj));
    } else {
      problems.push(`unsupported layer "${name}"`);
    }
  }
  for (const required of [...TILE_LAYERS, ...OBJECT_LAYERS]) {
    if (!seenLayers.has(required)) problems.push(`missing layer "${required}"`);
  }

  // Objects: whole-tile rectangles with a unique string id.
  const ids = new Set<string>();
  const read = (layer: ObjectLayerName): { obj: FarmObject; props: Map<string, Json> }[] =>
    (objects.get(layer) ?? []).flatMap((o) => {
      const where = `${layer} object ${String(o['id'])}`;
      if (o['ellipse'] || o['point'] || o['polygon'] || o['polyline'] || o['text'] || o['gid'] !== undefined) {
        problems.push(`${where}: only rectangle objects are supported`);
        return [];
      }
      if ((o['rotation'] ?? 0) !== 0) problems.push(`${where}: rotation is not supported`);
      const props = readProps(o['properties'], where, problems);
      const id = props.get('id');
      if (typeof id !== 'string' || id === '') {
        problems.push(`${where}: needs a string "id" property`);
        return [];
      }
      if (ids.has(id)) problems.push(`duplicate id "${id}"`);
      ids.add(id);
      const rect = pixelsToTileRect(
        { x: Number(o['x']), y: Number(o['y']), width: Number(o['width']), height: Number(o['height']) },
        TW,
        TH,
      );
      if (rect === null) {
        problems.push(`${where} ("${id}"): must be aligned to whole tiles`);
        return [];
      }
      if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > W || rect.y + rect.h > H) {
        problems.push(`${where} ("${id}"): outside the map`);
      }
      return [{ obj: { id, rect }, props }];
    });
  const plain = (layer: ObjectLayerName): FarmObject[] => read(layer).map((r) => r.obj);

  const gates: GateDef[] = read('gates').map(({ obj, props }) => {
    const padlocked = props.get('padlocked');
    if (typeof padlocked !== 'boolean') problems.push(`gate "${obj.id}": needs a boolean "padlocked" property`);
    return { ...obj, padlocked: padlocked === true };
  });

  const farm: FarmDef = {
    width: W,
    height: H,
    ground,
    dogHoles: plain('dogHoles'),
    pedestals: plain('pedestals'),
    gates,
    fences: plain('fences'),
    lampPosts: plain('lampPosts'),
    doghouseSpots: plain('doghouseSpots'),
    bushes: plain('bushes'),
    windowSight: plain('windowSight'),
    areas: plain('areas'),
    mapVersion: fnv1a(JSON.stringify(m)),
  };

  if (problems.length > 0) throw new FarmFormatError(problems);

  // GDD checks on a well-formed map.
  for (const o of [...farm.lampPosts, ...farm.doghouseSpots, ...farm.gates]) {
    if (inSafeZone(farm, o)) problems.push(`"${o.id}" is inside an entry safe zone (GDD 5.2)`);
  }
  for (const w of farm.windowSight) {
    if (windowLine(farm, w) === null) problems.push(`window sight "${w.id}" must be one tile wide and start at a wall`);
  }
  if (farm.dogHoles.length === 0) problems.push('the map needs at least one dog hole');
  else if (!hasOpenRoute(farm, initialWorld(farm, initialLayout(farm)))) {
    problems.push('no gnome is reachable from a dog hole for at most 1 stamina at the start (GDD 5.7)');
  }
  if (problems.length > 0) throw new FarmFormatError(problems);
  return farm;
}

export function tileIndex(farm: { width: number }, x: number, y: number): number {
  return y * farm.width + x;
}
