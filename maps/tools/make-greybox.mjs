// AI-use disclosure: Claude (Claude Code) wrote this script under my direction for M0 (T7); it generates the greybox farm and tileset, which I can then edit in Tiled.
//
// Writes maps/farm.tmj (Tiled JSON, the subset in docs/architecture.md Section 5)
// and maps/greybox.png (a flat-colour tileset). Run: npm run generate -w maps
// After the first hand edit in Tiled, the .tmj is the source and this script
// is no longer re-run on it.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = (name) => join(here, '..', name);
const T = 16; // tile size in pixels

// Ground legend: # hedge, H house, . stone path, , soft ground (beds, mud),
// D dog hole, G plain gate, P padlocked gate, F fence, g pedestal,
// L lamp post, K doghouse spot, B bush. Object tiles keep the ground named below.
const LAYOUT = [
  '########################',
  '#,,,,,,,#HHHHHH#,,,,,,,#',
  '#,,g,,,.#HHHHHH#.,,,g,,#',
  '#,,,,,,.#HHHHHH#.,,,,,,#',
  '#.......G......P.......#',
  '#...L...#..L...#...K...#',
  '#.......#,,g,B,#.......#',
  '#########......####P####',
  '#,,,,,,,#......#,,,,,,,#',
  '#,,,,,,.#..L...#.,,,g,,#',
  'D.......G......F.......#',
  '#,,,,,,.#......F,B,,,,,#',
  '#,,g,,,.#,,,,,,F,,,,,,,#',
  '#.......#,,,,K,#.......#',
  '#...L...#......#...L...#',
  '#,,,,,,,#,,,,,,#,,,,,,,D',
  '#,,,,B,,#......#,,,,,,,#',
  '###########D############',
];
const W = 24;
const H = 18;
if (LAYOUT.length !== H || LAYOUT.some((r) => r.length !== W)) throw new Error('layout must be 24 x 18');

// Tileset: index -> [name, kind | null, rgba]
const TILES = [
  ['soft', 'soft', [122, 90, 58]],
  ['stone', 'stone', [150, 150, 145]],
  ['hedge', 'blocked', [38, 82, 44]],
  ['house', 'blocked', [128, 70, 56]],
  ['dogHole', 'soft', [52, 38, 26]],
  ['flowers', null, null], // decoration only
];
const GROUND_OF = { '#': 2, H: 3, '.': 1, ',': 0, D: 4, G: 1, P: 1, F: 0, g: 0, L: 1, K: 1, B: 0 };

// ---- objects ---------------------------------------------------------------
const ids = { D: [], g: [], G: [], P: [], L: [], K: [], B: [] };
const NAMES = {
  D: { '0,10': 'hole_west', '11,17': 'hole_south', '23,15': 'hole_east' },
  g: { '3,2': 'ped_nw', '20,2': 'ped_ne', '11,6': 'ped_center', '20,9': 'ped_se', '3,12': 'ped_sw' },
  G: { '8,4': 'gate_court_west', '8,10': 'gate_lawn_west' },
  P: { '15,4': 'gate_court_east', '19,7': 'gate_east_beds' },
  L: { '4,5': 'post_nw', '11,5': 'post_court', '11,9': 'post_lawn', '4,14': 'post_sw', '19,14': 'post_se' },
  K: { '19,5': 'spot_ne', '13,13': 'spot_lawn' },
  B: { '13,6': 'bush_court', '17,11': 'bush_se', '5,16': 'bush_sw' },
};
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = LAYOUT[y][x];
    if (c in ids) {
      const id = NAMES[c][`${x},${y}`];
      if (!id) throw new Error(`no id for ${c} at ${x},${y}`);
      ids[c].push({ id, x, y, w: 1, h: 1 });
    }
  }
}
// Fence: contiguous vertical run of F.
const fenceTiles = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (LAYOUT[y][x] === 'F') fenceTiles.push({ x, y });
const fence = {
  id: 'fence_east',
  x: fenceTiles[0].x,
  y: fenceTiles[0].y,
  w: 1,
  h: fenceTiles.length,
};

const AREAS = [
  { id: 'area_nw', x: 1, y: 1, w: 7, h: 6 },
  { id: 'area_ne', x: 16, y: 1, w: 7, h: 6 },
  { id: 'area_court', x: 9, y: 4, w: 6, h: 5 },
  { id: 'area_lawn', x: 9, y: 9, w: 6, h: 8 },
  { id: 'area_sw', x: 1, y: 8, w: 7, h: 9 },
  { id: 'area_se', x: 16, y: 8, w: 7, h: 9 },
];
const WINDOW = [{ id: 'window_south', x: 12, y: 4, w: 1, h: 5 }];

let nextObjectId = 1;
const prop = (name, type, value) => ({ name, type, value });
const obj = (o, extra = []) => ({
  id: nextObjectId++,
  name: o.id,
  type: '',
  x: o.x * T,
  y: o.y * T,
  width: o.w * T,
  height: o.h * T,
  rotation: 0,
  visible: true,
  properties: [prop('id', 'string', o.id), ...extra],
});
let nextLayerId = 1;
const objectLayer = (name, objects) => ({
  id: nextLayerId++,
  name,
  type: 'objectgroup',
  draworder: 'topdown',
  opacity: 1,
  visible: true,
  x: 0,
  y: 0,
  objects,
});

// ---- tile layers -----------------------------------------------------------
const ground = [];
const decoration = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = LAYOUT[y][x];
    ground.push(GROUND_OF[c] + 1); // gid = firstgid (1) + tile index
    // A few flowers on soft beds, on a fixed pattern.
    decoration.push(c === ',' && (x * 7 + y * 3) % 11 === 0 ? 6 : 0);
  }
}
const tileLayer = (name, data) => ({
  id: nextLayerId++,
  name,
  type: 'tilelayer',
  width: W,
  height: H,
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  data,
});

const map = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.11.2',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  width: W,
  height: H,
  tilewidth: T,
  tileheight: T,
  nextlayerid: 0,
  nextobjectid: 0,
  properties: [
    prop(
      'disclosure',
      'string',
      'AI-use disclosure: Claude (Claude Code) generated this greybox layout under my direction for M0 (T7), with maps/tools/make-greybox.mjs.',
    ),
  ],
  tilesets: [
    {
      firstgid: 1,
      name: 'greybox',
      tilewidth: T,
      tileheight: T,
      tilecount: TILES.length,
      columns: TILES.length,
      margin: 0,
      spacing: 0,
      image: 'greybox.png',
      imagewidth: T * TILES.length,
      imageheight: T,
      tiles: TILES.flatMap(([name, kind], id) =>
        kind ? [{ id, properties: [prop('kind', 'string', kind), prop('name', 'string', name)] }] : [],
      ),
    },
  ],
  layers: [
    tileLayer('ground', ground),
    tileLayer('decoration', decoration),
    objectLayer('dogHoles', ids.D.map((o) => obj(o))),
    objectLayer('pedestals', ids.g.map((o) => obj(o))),
    objectLayer('gates', [
      ...ids.G.map((o) => obj(o, [prop('padlocked', 'bool', false)])),
      ...ids.P.map((o) => obj(o, [prop('padlocked', 'bool', true)])),
    ]),
    objectLayer('fences', [obj(fence)]),
    objectLayer('lampPosts', ids.L.map((o) => obj(o))),
    objectLayer('doghouseSpots', ids.K.map((o) => obj(o))),
    objectLayer('bushes', ids.B.map((o) => obj(o))),
    objectLayer('windowSight', WINDOW.map((o) => obj(o))),
    objectLayer('areas', AREAS.map((o) => obj(o))),
  ],
};
map.nextlayerid = nextLayerId;
map.nextobjectid = nextObjectId;
writeFileSync(out('farm.tmj'), JSON.stringify(map, null, 1) + '\n');

// ---- tileset PNG -----------------------------------------------------------
function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const IW = T * TILES.length;
const IH = T;
const raw = Buffer.alloc((IW * 4 + 1) * IH);
for (let y = 0; y < IH; y++) {
  raw[y * (IW * 4 + 1)] = 0; // filter: none
  for (let x = 0; x < IW; x++) {
    const tile = Math.floor(x / T);
    const lx = x % T;
    let rgba = [0, 0, 0, 0];
    const colour = TILES[tile][2];
    if (colour) {
      // Flat colour with a 1 px darker edge so the grid reads.
      const edge = lx === 0 || y === 0;
      rgba = [...colour.map((v) => (edge ? Math.round(v * 0.85) : v)), 255];
    } else if ((lx === 4 && y === 5) || (lx === 11 && y === 9) || (lx === 7 && y === 12)) {
      rgba = [235, 150, 190, 255]; // flower dots
    }
    raw.set(rgba, y * (IW * 4 + 1) + 1 + x * 4);
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(IW, 0);
ihdr.writeUInt32BE(IH, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(out('greybox.png'), png);
console.log('wrote maps/farm.tmj and maps/greybox.png');
