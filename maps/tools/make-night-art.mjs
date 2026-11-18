// AI-use disclosure: Codex implemented the original farm pixel art generator under Hao's direction.
// Regenerates the art layer and PNGs from the existing ground and object layout.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const tileSize = 16;
const ink = '#141722';
const grass = '#293b41';
const stone = '#495054';
const leaf = '#294249';
const wood = '#5c4447';
const copper = '#9c735d';
const gold = '#edbd72';
const parchment = '#f5d798';
const mapUrl = new URL('../farm.tmj', import.meta.url);
const propsUrl = new URL('../../game/src/assets/environment/', import.meta.url);
const mapFile = readFileSync(mapUrl, 'utf8');
const map = JSON.parse(mapFile);
const ground = map.layers.find((layer) => layer.name === 'ground').data;
const decoration = map.layers.find((layer) => layer.name === 'decoration');
const { width, height } = map;
const at = (x, y) => x >= 0 && y >= 0 && x < width && y < height ? ground[y * width + x] : 0;
const colors = new Map();

function rgba(color) {
  if (!colors.has(color)) {
    const value = Number.parseInt(color.slice(1), 16);
    colors.set(color, [value >> 16, (value >> 8) & 255, value & 255, 255]);
  }
  return colors.get(color);
}

class Pixels {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
  }

  dot(x, y, color) {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) {
      this.data.set(rgba(color), (y * this.width + x) * 4);
    }
  }

  rect(x, y, width, height, color) {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) this.dot(x + dx, y + dy, color);
    }
  }

  line(x0, y0, x1, y1, color) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    this.dot(x0, y0, color);
    for (let step = 1; step <= steps; step++) {
      this.dot(Math.round(x0 + (x1 - x0) * step / steps), Math.round(y0 + (y1 - y0) * step / steps), color);
    }
  }

  polygon(points, color) {
    const top = Math.min(...points.map(([, y]) => y));
    const bottom = Math.max(...points.map(([, y]) => y));
    for (let row = top; row < bottom; row++) {
      const intersections = [];
      for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[(i + 1) % points.length];
        if (row >= Math.min(y1, y2) && row < Math.max(y1, y2)) {
          intersections.push(x1 + (x2 - x1) * (row + 0.5 - y1) / (y2 - y1));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length; i += 2) {
        this.line(Math.ceil(intersections[i]), row, Math.floor(intersections[i + 1]), row, color);
      }
    }
  }

  ellipse(x, y, rx, ry, color, clip = () => true) {
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if (dx ** 2 / rx ** 2 + dy ** 2 / ry ** 2 <= 1 && clip(x + dx, y + dy)) {
          this.dot(x + dx, y + dy, color);
        }
      }
    }
  }

  crop(x, y, width, height) {
    const image = new Pixels(width, height);
    for (let row = 0; row < height; row++) {
      const start = ((y + row) * this.width + x) * 4;
      this.data.copy(image.data, row * width * 4, start, start + width * 4);
    }
    return image;
  }

  paste(image, x, y) {
    for (let dy = 0; dy < image.height; dy++) {
      for (let dx = 0; dx < image.width; dx++) {
        const pixel = (dy * image.width + dx) * 4;
        if (image.data[pixel + 3] === 0) continue;
        const targetX = x + dx;
        if (targetX < 0 || targetX >= this.width || y + dy < 0 || y + dy >= this.height) continue;
        this.data.set(image.data.subarray(pixel, pixel + 4), ((y + dy) * this.width + targetX) * 4);
      }
    }
  }
}

function noise(x, y, seed = 0) {
  let n = Math.imul(x + 151, 0x1f123bb5) ^ Math.imul(y + 271, 0x5f356495) ^ Math.imul(seed, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return (n ^ (n >>> 16)) >>> 0;
}

function tuft(image, x, y, highlight) {
  image.line(x - 2, y - 1, x, y + 1, '#1f2e36');
  image.line(x, y, x + 1, y - 2, highlight);
  image.dot(x + 2, y - 1, '#394d4b');
}

function plant(image, kind, x, y, seed) {
  if (kind === 'cabbage') {
    image.ellipse(x, y, 3, 2, '#252b37');
    image.ellipse(x, y - 1, 2, 2, '#3e5755');
    image.line(x - 1, y - 1, x, y, '#627166');
    image.dot(x + 1, y - 2, '#53695e');
  } else if (kind === 'carrot') {
    image.line(x, y, x - 1, y - 3, '#4a625a');
    image.line(x, y - 1, x + 2, y - 3, '#697765');
    image.dot(x, y, '#a07462');
  } else {
    const rose = seed % 2 === 0;
    image.line(x, y, x, y - 4, '#53655d');
    image.dot(x - 1, y - 1, '#667461');
    image.dot(x + 1, y - 2, '#405a52');
    image.dot(x, y - 4, rose ? '#a07a86' : '#a28a70');
    image.dot(x + 1, y - 5, rose ? '#bc9699' : '#baa27a');
  }
}

function paintGrass(image) {
  image.rect(0, 0, image.width, image.height, grass);
  for (let y = 1; y < image.height; y++) {
    for (let x = 1; x < image.width; x++) {
      const grain = noise(x, y) % 57;
      if (grain < 9) image.dot(x, y, grain < 4 ? '#25363e' : '#344549');
      if (grain === 9 && (x + y) % 3 === 0) image.line(x, y, x + 2, y, '#27363c');
    }
  }

  // Shallow garden beds are cut into grass. Leave grass around the paths and hedge feet.
  const beds = [[20, 18, 83, 39, 'cabbage'], [281, 18, 72, 40, 'carrot'], [30, 133, 78, 21, 'flower'],
    [282, 134, 70, 22, 'cabbage'], [27, 178, 77, 24, 'carrot'], [276, 181, 65, 19, 'flower'],
    [162, 188, 63, 29, 'cabbage'], [24, 245, 77, 24, 'flower'], [280, 246, 73, 23, 'carrot'],
    [154, 240, 62, 16, 'flower']];
  for (const [x, y, w, h, crop] of beds) {
    image.polygon([[x, y + 5], [x + 4, y + 2], [x + w - 8, y], [x + w, y + 6],
      [x + w - 3, y + h - 3], [x + 9, y + h], [x + 2, y + h - 3]], '#30323c');
    for (let dy = 8; dy < h - 1; dy += 8) {
      image.line(x + 5, y + dy + 2, x + w - 6, y + dy, '#252a34');
      image.line(x + 9, y + dy + 1, x + w - 8, y + dy - 1, '#403a43');
      for (let dx = 9 + (dy % 3); dx < w - 7; dx += crop === 'cabbage' ? 8 : 6) {
        const seed = noise(x + dx, y + dy);
        if (seed % 7 !== 0) plant(image, crop, x + dx + seed % 3, y + dy - (dx > w / 2 ? 1 : 0), seed);
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (at(x, y) !== 1) continue;
      for (let i = 0; i < 5; i++) {
        const jitter = noise(x, y, i);
        const px = x * tileSize + 2 + (jitter % 12);
        const py = y * tileSize + 3 + ((jitter >>> 12) % 11);
        if (beds.some(([bx, by, w, h]) => px >= bx + 5 && px < bx + w - 4 && py >= by + 3 && py < by + h - 2)) continue;
        tuft(image, px, py, i ? '#3d5251' : '#4a6059');
        if (i === 0 && jitter % 9 === 0) {
          image.dot(px, py - 3, '#a18482');
          image.dot(px + 1, py - 3, '#b8999a');
          image.dot(px, py - 2, '#b4a08b');
        }
      }
    }
  }
}

function paintPaths(image) {
  const pavers = [stone, '#4e5359', '#4a4d57', '#51555d', '#53575a', '#454a54'];
  for (let y = 0; y < image.height; y++) {
    const course = (y + 2) % 18;
    const band = course < 5 ? 0 : course < 12 ? 1 : 2;
    const row = Math.floor((y + 2) / 18) * 3 + band;
    const rowHeight = [5, 7, 6][band];
    const edgeY = course - [0, 5, 12][band];
    const stagger = noise(row, 45) % 19;
    for (let x = 0; x < image.width; x++) {
      const tx = Math.floor(x / tileSize);
      const ty = Math.floor(y / tileSize);
      if (at(tx, ty) !== 2) continue;
      const px = x % tileSize;
      const py = y % tileSize;
      const wear = (x * 7 + y * 13) % 5 === 0 ? 1 : 0;
      const top = at(tx, ty - 1) === 1 && py < 1 + wear;
      const bottom = at(tx, ty + 1) === 1 && py > 14 - wear;
      const left = at(tx - 1, ty) === 1 && px < 1 + wear;
      const right = at(tx + 1, ty) === 1 && px > 14 - wear;
      if (top || bottom || left || right) {
        if (noise(x, y, 7) % 4 === 0) image.dot(x, y, '#40474d');
        continue;
      }
      const courseX = (x + stagger) % 29;
      const first = 8 + (row % 4);
      const second = 20 + (row % 3);
      const group = courseX < first ? 0 : courseX < second ? 1 : 2;
      const col = Math.floor((x + stagger) / 29) * 3 + group;
      const slab = noise(col, row);
      const edgeX = courseX - [0, first, second][group];
      const slabWidth = [first, second - first, 29 - second][group];
      const roundedCorner = edgeY === 0 && edgeX === 0 || edgeY === rowHeight - 2 && edgeX === slabWidth - 2;
      const crack = edgeY === rowHeight - 1 || edgeX === slabWidth - 1 || roundedCorner;
      const chalk = !crack && (edgeY === 0 && edgeX < slabWidth - 3 || edgeX === 0 && slab % 3 === 0);
      image.dot(x, y, crack ? '#363d47' : chalk ? '#5d6163' : pavers[slab % pavers.length]);
      if (!crack && !chalk && noise(x, y, 1) % 33 === 0) image.dot(x, y, '#3f444e');
      if (slab % 5 === 0 && edgeX === slabWidth - 4 + (edgeY % 2) && edgeY >= rowHeight - 3) image.dot(x, y, '#3b414b');
    }
  }
}

function paintHedges(image) {
  const isHedge = (x, y) => at(Math.floor(x / tileSize), Math.floor(y / tileSize)) === 3;
  const isCanopy = (x, y) => isHedge(x, y) &&
    (isHedge(x - 1, y) && isHedge(x + 1, y) || noise(x, y, 41) % 4 === 0) &&
    (isHedge(x, y - 1) && isHedge(x, y + 1) || noise(x, y, 46) % 4 === 0);
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      if (at(tx, ty) !== 3) continue;
      const x = tx * tileSize;
      const y = ty * tileSize;
      const close = (dx, dy) => at(tx + dx, ty + dy) === 3;
      const left = close(-1, 0) ? 0 : 1;
      const right = close(1, 0) ? 16 : 15;
      const top = close(0, -1) ? 0 : 1;
      const bottom = close(0, 1) ? 16 : 15;
      image.rect(x + left, y + top, right - left, bottom - top, '#171f2b');
    }
  }

  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      if (at(tx, ty) !== 3) continue;
      for (const [i, [cx, cy]] of [[4, 5], [11, 4], [8, 11]].entries()) {
        const grain = noise(tx, ty, i + 10);
        const x = tx * tileSize + cx + grain % 5 - 2;
        const y = ty * tileSize + cy + ((grain >>> 8) % 5) - 2;
        const rx = 4 + ((grain >>> 12) % 3);
        const ry = 4 + ((grain >>> 16) % 3);
        image.ellipse(x, y + 1, rx + 1, ry, '#172331', isCanopy);
        image.ellipse(x, y, rx, ry, grain % 3 === 0 ? '#344b52' : leaf, isCanopy);
        image.ellipse(x - 1, y - 1, rx - 2, ry - 2, grain % 7 === 0 ? '#405a57' : '#36514f', isCanopy);
        for (const [dx, dy, color] of [[-2, -2, '#526963'], [-1, -2, '#4a625c'], [1, -1, '#415e58'],
          [2, 1, '#233a43'], [1, 2, '#233a43'], [-1, 3, '#233a43']]) {
          if (isCanopy(x + dx, y + dy)) image.dot(x + dx, y + dy, color);
        }
        if (grain % 8 === 0 && isCanopy(x - 3, y)) image.dot(x - 3, y, '#80636a');
      }
    }
  }
}

function paintHouse(image) {
  const cells = ground.flatMap((gid, i) => gid === 4 ? [{ x: i % width, y: Math.floor(i / width) }] : []);
  if (cells.length === 0) return;
  const left = Math.min(...cells.map((p) => p.x));
  const top = Math.min(...cells.map((p) => p.y));
  const right = Math.max(...cells.map((p) => p.x));
  const bottom = Math.max(...cells.map((p) => p.y));
  const w = (right - left + 1) * tileSize;
  const h = (bottom - top + 1) * tileSize;
  const house = new Pixels(w, h);
  const eaves = h - 13;
  const sill = h - 3;
  const roofStart = 8;

  house.rect(3, eaves - 6, w - 6, sill - eaves + 7, ink);
  house.rect(5, eaves, w - 10, sill - eaves, wood);
  for (let y = eaves; y < sill; y += 3) {
    house.line(5, y, w - 6, y, '#322b36');
    house.line(8 + noise(y, 5) % 9, y + 1, w - 12, y + 1, '#6b4e4d');
  }
  house.rect(4, sill, w - 8, 1, '#4a4548');
  house.rect(9, eaves + 3, 7, 6, ink);
  house.rect(10, eaves + 4, 5, 4, '#3d414e');
  house.rect(w - 16, eaves + 3, 7, 6, ink);
  house.rect(w - 15, eaves + 4, 5, 4, '#3d414e');
  const windowSlot = map.layers.find((layer) => layer.name === 'windowSight').objects[0];
  const window = windowSlot ? windowSlot.x - left * tileSize + tileSize / 2 : Math.floor(w / 2);
  house.rect(window - 6, eaves, 12, 10, ink);
  house.rect(window - 5, eaves + 1, 10, 7, '#a67b62');
  house.rect(window - 4, eaves + 2, 8, 5, '#caa176');
  house.line(window - 3, eaves + 2, window + 3, eaves + 2, '#deb784');
  house.line(window, eaves + 1, window, eaves + 8, '#55404a');
  house.line(window - 5, eaves + 4, window + 4, eaves + 4, '#55404a');
  house.line(window - 7, eaves + 9, window + 6, eaves + 9, '#a98368');

  house.polygon([[0, eaves - 3], [9, roofStart], [w - 10, roofStart - 1], [w - 1, eaves - 4],
    [w - 2, eaves + 1], [1, eaves + 2]], ink);
  house.polygon([[2, eaves - 4], [10, roofStart + 1], [w - 11, roofStart], [w - 3, eaves - 4]], '#444458');
  for (let y = roofStart + 2; y < eaves - 5; y++) {
    const slope = Math.floor(9 * (eaves - 4 - y) / (eaves - roofStart - 4));
    const row = Math.floor((y - roofStart) / 5);
    for (let x = Math.max(3, slope + 2); x < w - Math.max(3, slope + 2); x++) {
      const slate = (x + (row % 2) * 4) % 8;
      const dark = y > eaves - 11 || x > w - 14;
      if ((y - roofStart) % 5 === 4 || slate === 7) house.dot(x, y, dark ? '#292b40' : '#323247');
      else if ((y - roofStart) % 5 === 0 && slate < 5) house.dot(x, y, dark ? '#3a3a50' : '#57566b');
      else if (noise(x, y, 25) % 9 === 0) house.dot(x, y, '#36364c');
    }
  }
  house.line(11, roofStart, w - 12, roofStart - 1, '#69677a');
  house.line(9, roofStart + 1, 2, eaves - 4, '#555364');
  house.line(3, eaves - 4, w - 5, eaves - 4, '#605367');
  house.line(4, eaves, w - 5, eaves - 1, '#7a5d59');
  // A crooked brick chimney breaks the roofline.
  house.polygon([[w - 24, 3], [w - 23, 1], [w - 12, 2], [w - 12, 5], [w - 14, 5],
    [w - 14, 15], [w - 22, 16], [w - 22, 5], [w - 24, 5]], ink);
  house.rect(w - 21, 5, 6, 10, '#624a55');
  house.line(w - 23, 2, w - 13, 3, '#8d6966');
  for (const y of [7, 10, 13]) house.line(w - 21, y, w - 16, y, '#3b3546');

  for (const cell of cells) {
    image.paste(house.crop((cell.x - left) * tileSize, (cell.y - top) * tileSize, tileSize, tileSize),
      cell.x * tileSize, cell.y * tileSize);
  }
}

function paintHoles(image) {
  const aperture = new Pixels(tileSize, tileSize);
  aperture.polygon([[0, 15], [1, 11], [4, 11], [4, 6], [6, 4], [10, 4], [12, 7], [12, 11], [15, 12], [16, 16], [0, 16]], '#171e29');
  aperture.polygon([[4, 15], [4, 10], [5, 8], [5, 7], [7, 5], [10, 5], [11, 6], [12, 9], [12, 15], [9, 16], [6, 16]], '#644b4a');
  aperture.polygon([[6, 15], [6, 9], [8, 7], [10, 7], [11, 10], [11, 15], [10, 16], [7, 16]], '#10131d');
  aperture.line(4, 11, 3, 15, '#8c6b59');
  aperture.line(11, 8, 13, 12, '#4f3d42');
  aperture.line(6, 4, 9, 4, '#83705c');
  aperture.dot(2, 10, '#68645c');
  aperture.dot(13, 11, '#7a7464');
  aperture.dot(3, 13, '#554951');
  aperture.dot(10, 3, '#68645c');
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      if (at(tx, ty) !== 5) continue;
      for (let y = 0; y < tileSize; y++) {
        for (let x = 0; x < tileSize; x++) {
          const sourceX = tx === 0 ? y : tx === width - 1 ? 15 - y : x;
          const sourceY = tx === 0 ? 15 - x : tx === width - 1 ? x : y;
          const source = (sourceY * tileSize + sourceX) * 4;
          if (aperture.data[source + 3] === 0) continue;
          const dest = ((ty * tileSize + y) * image.width + tx * tileSize + x) * 4;
          image.data.set(aperture.data.subarray(source, source + 4), dest);
        }
      }
    }
  }
}

function drawGnome() {
  const gnome = new Pixels(10, 14);
  gnome.polygon([[1, 7], [1, 4], [3, 3], [4, 1], [8, 0], [9, 2], [6, 3], [7, 5], [8, 6],
    [8, 8], [9, 9], [10, 13], [0, 14], [0, 11], [2, 8]], ink);
  gnome.polygon([[2, 5], [4, 3], [5, 1], [8, 1], [6, 3], [6, 5], [8, 6], [7, 8], [2, 7]], '#ac464e');
  gnome.line(3, 5, 6, 2, '#e4846c');
  gnome.line(2, 6, 5, 7, '#d7635b');
  gnome.polygon([[3, 8], [6, 7], [8, 9], [9, 13], [1, 13], [1, 11]], '#526b68');
  gnome.polygon([[3, 8], [7, 7], [8, 9], [6, 12], [4, 12], [4, 11], [2, 10]], '#e2cdb0');
  gnome.dot(6, 8, '#ba856f');
  gnome.dot(4, 8, '#40323c');
  gnome.dot(7, 9, '#a7998d');
  gnome.dot(6, 10, '#ab9b8c');
  gnome.line(2, 13, 3, 13, '#879284');
  gnome.line(7, 13, 8, 13, '#879284');
  return gnome;
}

function drawPedestal(gnome) {
  const p = new Pixels(16, 24);
  p.ellipse(8, 22, 7, 1, '#151e29');
  p.polygon([[2, 14], [5, 13], [11, 13], [14, 14], [14, 17], [12, 18], [12, 21], [14, 22], [13, 24],
    [3, 24], [2, 22], [4, 20], [4, 17], [2, 16]], ink);
  p.rect(5, 17, 6, 5, '#61656c');
  p.line(5, 17, 5, 21, '#97978c');
  p.line(10, 18, 10, 21, '#424852');
  p.line(6, 21, 8, 19, '#454b56');
  p.rect(3, 22, 10, 1, '#788277');
  p.polygon([[3, 14], [6, 13], [11, 13], [13, 14], [12, 16], [4, 16]], '#8c9089');
  p.line(4, 16, 11, 16, '#5c606a');
  if (gnome) p.paste(gnome, 3, 0);
  else p.line(6, 14, 9, 14, '#4e5358');
  return p;
}

function drawLamp(lit) {
  const p = new Pixels(16, 32);
  p.ellipse(8, 30, 5, 1, '#18212b');
  p.rect(5, 28, 6, 3, ink);
  p.rect(6, 28, 4, 2, '#53525d');
  p.rect(6, 10, 4, 19, ink);
  p.rect(7, 11, 2, 17, '#5b555e');
  p.line(7, 13, 7, 21, '#908077');
  p.dot(8, 25, '#3d394a');
  p.polygon([[1, 5], [3, 3], [5, 2], [7, 0], [9, 0], [10, 2], [13, 3], [15, 5], [13, 7], [12, 12],
    [10, 14], [6, 14], [4, 12], [3, 7]], ink);
  p.line(3, 4, 7, 2, lit ? gold : '#6f6570');
  p.line(8, 2, 12, 4, '#685460');
  p.line(3, 5, 13, 5, '#84645a');
  p.polygon([[4, 6], [12, 6], [11, 11], [10, 12], [6, 12], [5, 11]], lit ? gold : '#3d4757');
  p.line(6, 6, 6, 10, lit ? '#bd774e' : '#545763');
  p.line(10, 6, 10, 10, lit ? '#986348' : '#232938');
  if (lit) p.rect(7, 7, 3, 3, parchment);
  p.line(6, 12, 10, 12, lit ? '#ac7151' : '#6a5a62');
  return p;
}

function drawGate(open) {
  const p = new Pixels(16, 16);
  for (const x of open ? [0] : [0, 12]) {
    p.polygon([[x, 14], [x, 3], [x + 1, 1], [x + 3, 2], [x + 4, 4], [x + 4, 15], [x + 2, 16]], ink);
    p.rect(x + 1, 3, 2, 11, wood);
    p.line(x + 1, 3, x + 1, 9, copper);
    p.dot(x + 2, 4, '#4e3b45');
  }
  if (open) {
    p.polygon([[2, 3], [5, 1], [7, 3], [7, 11], [3, 15], [2, 14]], ink);
    p.line(3, 5, 5, 3, copper);
    p.line(3, 11, 6, 8, wood);
    p.line(6, 3, 6, 10, '#7a5850');
  } else {
    p.rect(3, 5, 10, 3, ink);
    p.rect(3, 10, 10, 3, ink);
    p.line(3, 6, 12, 6, '#886354');
    p.line(3, 11, 12, 11, '#886354');
    p.line(5, 10, 10, 7, '#694e48');
    p.dot(3, 6, '#c18e70');
    p.dot(12, 11, '#aa816a');
  }
  return p;
}

function drawPadlock(open) {
  const p = new Pixels(8, 8);
  if (open) {
    p.line(4, 4, 4, 1, ink);
    p.line(4, 1, 6, 0, '#988f94');
    p.line(6, 0, 7, 2, '#c2b5a8');
  } else {
    p.polygon([[1, 5], [1, 2], [2, 0], [5, 0], [6, 2], [7, 5]], ink);
    p.line(2, 4, 2, 2, '#a8a19d');
    p.line(2, 1, 5, 1, '#c2b5a8');
    p.line(5, 2, 5, 4, '#7d7985');
  }
  p.polygon([[0, 4], [1, 3], [6, 3], [7, 4], [7, 7], [6, 8], [1, 8], [0, 7]], ink);
  p.rect(1, 4, 6, 3, open ? '#ab6e61' : '#d4a46a');
  p.line(1, 4, 5, 4, open ? '#d18e75' : parchment);
  p.line(3, 5, 3, 6, '#563f43');
  return p;
}

function drawFence(gap) {
  const p = new Pixels(16, 16);
  for (const [start, stop] of gap ? [[0, 3], [12, 15]] : [[0, 15]]) {
    p.rect(5, start, 7, stop - start + 1, ink);
    p.rect(6, start, 5, stop - start + 1, wood);
    p.line(6, start, 6, stop, copper);
    p.line(9, start, 9, stop, '#3e3540');
  }
  if (gap) {
    p.line(7, 3, 9, 5, '#b2896c');
    p.line(6, 12, 8, 11, '#b2896c');
    p.line(11, 8, 14, 9, '#715750');
    p.dot(4, 8, '#846252');
  } else {
    for (const y of [0, 5, 10, 15]) {
      p.line(5, y, 10, y, '#392f3b');
      p.line(6, y + 1, 8, y + 1, '#ac7c60');
    }
  }
  return p;
}

function drawDoghouse() {
  const p = new Pixels(16, 22);
  p.ellipse(8, 20, 7, 1, '#171f29');
  p.polygon([[0, 10], [3, 7], [5, 4], [7, 2], [9, 2], [13, 7], [16, 11], [14, 12], [14, 20],
    [3, 21], [2, 19], [2, 12], [0, 11]], ink);
  p.rect(3, 10, 10, 10, wood);
  p.line(4, 10, 4, 19, copper);
  p.line(12, 11, 12, 19, '#3d323b');
  p.polygon([[5, 20], [5, 14], [7, 12], [9, 12], [11, 14], [11, 20]], ink);
  p.line(5, 14, 8, 12, '#96705e');
  p.line(6, 19, 10, 19, '#292636');
  p.polygon([[1, 10], [7, 3], [9, 3], [14, 10], [11, 10], [8, 6], [4, 11]], '#575068');
  p.line(3, 7, 7, 3, '#867086');
  p.line(8, 4, 13, 9, '#7a6376');
  p.dot(8, 9, '#b59277');
  return p;
}

function drawSpot() {
  const p = new Pixels(16, 16);
  p.polygon([[1, 12], [3, 6], [10, 5], [14, 8], [15, 13], [11, 15], [3, 15]], '#37363d');
  p.line(3, 10, 5, 8, '#6e615b');
  p.line(5, 13, 8, 12, '#604f4c');
  p.line(10, 9, 12, 10, '#6e615b');
  p.dot(11, 13, '#776758');
  p.dot(7, 8, '#55494b');
  p.dot(13, 12, '#555158');
  return p;
}

function drawBush() {
  const p = new Pixels(16, 20);
  p.ellipse(8, 17, 7, 2, '#19212d');
  for (const [x, y, rx, ry] of [[7, 8, 4, 5], [11, 10, 4, 5], [4, 12, 4, 4], [9, 13, 5, 5]]) p.ellipse(x, y, rx, ry, ink);
  for (const [x, y, rx, ry] of [[7, 7, 3, 3], [11, 9, 3, 3], [4, 11, 3, 3], [8, 13, 5, 4]]) {
    p.ellipse(x, y, rx, ry, leaf);
    p.line(x - 1, y, x, y - 2, '#526a60');
    p.line(x + 1, y + 1, x + 2, y, '#385552');
    p.dot(x - 2, y + 1, '#1d333c');
  }
  p.line(5, 16, 7, 14, '#1b2b37');
  p.line(9, 15, 11, 13, '#1b2b37');
  p.dot(5, 10, '#9b6f75');
  p.dot(11, 11, '#805a6b');
  p.dot(7, 5, '#8e6d72');
  return p;
}

function png(image) {
  const chunk = (name, bytes) => {
    const data = Buffer.concat([Buffer.from(name, 'ascii'), bytes]);
    let crc = ~0;
    for (const byte of data) {
      crc ^= byte;
      for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    const len = Buffer.alloc(4);
    const check = Buffer.alloc(4);
    len.writeUInt32BE(bytes.length);
    check.writeUInt32BE(~crc >>> 0);
    return Buffer.concat([len, data, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header[8] = 8;
  header[9] = 6; // RGBA
  const stride = image.width * 4;
  const rows = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y++) image.data.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('tEXt', Buffer.from('AI-use disclosure\0Original pixel art generated by Codex under Hao\'s direction.')),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const farm = new Pixels(width * tileSize, height * tileSize);
paintGrass(farm);
paintPaths(farm);
paintHedges(farm);
paintHouse(farm);
paintHoles(farm);

// The first five tiles keep their ground GIDs and semantic properties. Art thereafter is display-only.
const variants = [1, 2, 3, 4, 5].map((gid) => {
  const atIndex = Math.max(0, ground.indexOf(gid));
  return farm.crop((atIndex % width) * tileSize, Math.floor(atIndex / width) * tileSize, tileSize, tileSize);
});
const gidByArt = new Map();
decoration.data = ground.map((_, i) => {
  const tile = farm.crop((i % width) * tileSize, Math.floor(i / width) * tileSize, tileSize, tileSize);
  const key = tile.data.toString('base64');
  if (!gidByArt.has(key)) {
    variants.push(tile);
    gidByArt.set(key, variants.length);
  }
  return gidByArt.get(key);
});

const columns = 24;
const atlas = new Pixels(columns * tileSize, Math.ceil(variants.length / columns) * tileSize);
for (const [i, tile] of variants.entries()) {
  atlas.paste(tile, (i % columns) * tileSize, Math.floor(i / columns) * tileSize);
}
Object.assign(map.tilesets[0], {
  name: 'nightFarm',
  image: 'night-farm.png',
  tilecount: variants.length,
  imagewidth: atlas.width,
  imageheight: atlas.height,
  columns,
});
const disclosure = 'Art generated by Codex under Hao\'s direction with maps/tools/make-night-art.mjs.';
const property = map.properties.find((entry) => entry.name === 'disclosure');
if (!property.value.includes(disclosure)) property.value += ` ${disclosure}`;
writeFileSync(new URL('../night-farm.png', import.meta.url), png(atlas));
const nextMapFile = JSON.stringify(map, null, 1) + '\n';
if (nextMapFile !== mapFile) writeFileSync(mapUrl, nextMapFile);

const gnome = drawGnome();
const props = {
  lampPost: drawLamp(true), lampPostDark: drawLamp(false),
  gate: drawGate(false), gateOpen: drawGate(true),
  padlock: drawPadlock(false), padlockOpen: drawPadlock(true),
  fence: drawFence(false), fenceGap: drawFence(true),
  pedestal: drawPedestal(gnome), pedestalEmpty: drawPedestal(), gnome,
  doghouse: drawDoghouse(), doghouseSpot: drawSpot(), bush: drawBush(),
};
mkdirSync(propsUrl, { recursive: true });
for (const [name, sprite] of Object.entries(props)) writeFileSync(new URL(`${name}.png`, propsUrl), png(sprite));
console.log('Wrote night farm tiles and environment sprites.');
