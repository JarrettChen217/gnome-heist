// AI-use disclosure: Codex animated the farmhouse window, field inspection and tool close-ups under Hao's direction.
import type * as Phaser from 'phaser';
import { loadFarm, tilesOf } from '@gnome-heist/core';
import type { Tile } from '@gnome-heist/core';
import { TILE_PX } from './constants.ts';
import { MORNING_WORK_MS, type MorningBeat } from './morningSequence.ts';

const W = 320;
const H = 180;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const ease = (t: number) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
type Source = HTMLImageElement | HTMLCanvasElement;
type TileLayer = { name: string; data?: number[] };

export class MorningShots {
  private readonly sheet: Phaser.Textures.CanvasTexture;
  readonly image: Phaser.GameObjects.Image;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly farm;
  private readonly ground = document.createElement('canvas');
  private readonly sources = new Map<string, Source>();
  private lastFrame = '';

  constructor(private readonly scene: Phaser.Scene) {
    const raw = scene.cache.tilemap.get('farm').data;
    this.farm = loadFarm(raw);
    this.ground.width = this.farm.width * TILE_PX;
    this.ground.height = this.farm.height * TILE_PX;
    const map = this.ground.getContext('2d')!;
    const atlas = this.source('nightFarm');
    const ts = raw.tilesets[0];
    // Sample the playable atlas by its embedded tile IDs. A field cut shows the same
    // stones, hedge and vegetation as the corresponding place at night.
    for (const layer of raw.layers as TileLayer[]) {
      if (!['ground', 'decoration'].includes(layer.name)) continue;
      layer.data?.forEach((gid, i) => {
        if (!gid) return;
        const id = gid - ts.firstgid;
        map.drawImage(atlas, (id % ts.columns) * TILE_PX, Math.floor(id / ts.columns) * TILE_PX,
          TILE_PX, TILE_PX, i % this.farm.width * TILE_PX, Math.floor(i / this.farm.width) * TILE_PX, TILE_PX, TILE_PX);
      });
    }
    const foliage = this.farm.bushes.map(({ rect }) => ({
      x: (rect.x + rect.w / 2) * TILE_PX, y: (rect.y + rect.h) * TILE_PX, key: 'bush',
    }));
    const grass = new Set<number>();
    for (const patch of this.farm.tallGrass) {
      for (const { x, y } of tilesOf(patch)) {
        const i = y * this.farm.width + x;
        if (grass.has(i)) continue;
        grass.add(i);
        foliage.push({ x: (x + 0.5) * TILE_PX, y: (y + 1) * TILE_PX, key: 'tallGrass' + ((x + y * 2) % 3) });
      }
    }
    for (const prop of foliage.sort((a, b) => a.y - b.y)) {
      const source = this.source(prop.key);
      map.drawImage(source, prop.x - source.width / 2, prop.y - source.height);
    }
    map.globalCompositeOperation = 'lighter';
    map.fillStyle = '#394226';
    map.fillRect(0, 0, this.ground.width, this.ground.height);
    this.sheet = scene.textures.createCanvas('morning-shot', W, H)!;
    this.ctx = this.sheet.context;
    this.ctx.imageSmoothingEnabled = false;
    this.image = scene.add.image(0, 0, this.sheet).setOrigin(0).setDepth(10).setVisible(false);
    scene.events.once('shutdown', () => scene.textures.remove(this.sheet.key));
  }

  private source(key: string): Source {
    let image = this.sources.get(key);
    if (!image) {
      image = this.scene.textures.get(key).getSourceImage() as Source;
      this.sources.set(key, image);
    }
    return image;
  }

  update(beat: MorningBeat | null): void {
    this.image.setVisible(beat !== null);
    if (!beat) { this.lastFrame = ''; return; }
    // Pixel poses change at film cadence; leave the texture resident between poses.
    const pose = beat.stage === 'ready' || beat.stage === 'speak' ? 0 : Math.floor(beat.elapsed / 55);
    const frame = [beat.stage, beat.index, beat.trace?.id, beat.work?.prop, pose].join('/');
    if (frame === this.lastFrame) return;
    this.lastFrame = frame;
    if (beat.work) this.workshop(beat);
    else if (beat.site) this.inspection(beat, beat.site);
    else this.window(beat);
    this.sheet.refresh();
  }

  private rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  private actor(frame: number, x: number, feet: number, h: number, faceLeft = false): void {
    const c = this.ctx;
    c.save();
    c.translate(Math.round(x), Math.round(feet));
    if (faceLeft) c.scale(-1, 1);
    const width = Math.round(h * 0.75);
    c.drawImage(this.source('morning-farmer'), frame * 96, 0, 96, 128, -Math.round(width / 2), -h, width, h);
    c.restore();
  }

  private window(beat: MorningBeat): void {
    const c = this.ctx;
    const cottage = this.source('morning-farm');
    // The lit east window in the existing dawn painting, expressed in its 500x334 composition.
    c.drawImage(cottage, cottage.width * 145 / 500, cottage.height * 128 / 334,
      cottage.width * 160 / 500, cottage.height * 90 / 334, 0, 0, W, H);
    const t = beat.stage === 'opening' ? beat.elapsed : 3000;
    const open = ease((t - 220) / 760);
    const x = 111, y = 62, w = 85, h = 92;
    this.rect(x - 4, y - 4, w + 8, h + 9, '#533c33');
    this.rect(x, y, w, h, '#392e32');
    this.rect(x + 6, y + 3, w - 12, h - 5, '#51403b');
    this.rect(x + 10, y + 8, w - 20, h - 8, '#302c30');
    c.save();
    c.beginPath(); c.rect(x, y, w, h); c.clip();
    const look = beat.stage === 'waiting' ? Math.sin(beat.elapsed / 600) < -0.2 : t > 1850;
    this.actor(0, 152 + (look ? -3 : 4), 242 - 27 * ease((t - 500) / 600), 143, look);
    c.restore();
    // Two slatted shutters swing outward, progressively revealing the farmer.
    for (const side of [-1, 1]) {
      const hinge = side === -1 ? x : x + w;
      const end = hinge - side * (w / 2) * Math.cos(open * 2.32);
      const l = Math.min(end, hinge), width = Math.abs(end - hinge);
      this.rect(l, y - 1, width + 1, h + 1, '#35413a');
      this.rect(l + 2, y + 2, Math.max(0, width - 3), h - 4, '#59604a');
      for (let row = 8; row < h - 4; row += 9) {
        this.rect(l + 2, y + row, Math.max(0, width - 4), 2, '#3d493c');
        this.rect(l + 2, y + row + 2, Math.max(0, width - 4), 1, '#7a7956');
      }
    }
    this.rect(x - 6, y + h, w + 12, 4, '#e3b47a');
    this.rect(x - 7, y + h + 4, w + 14, 3, '#775447');
  }

  private inspection(beat: MorningBeat, site: Tile): void {
    const c = this.ctx;
    const px = (site.x + 0.5) * TILE_PX;
    const py = (site.y + 0.5) * TILE_PX;
    // Find a short clear approach beside the evidence in the authored geometry.
    let direction = { x: -1, y: 0 }, reach = 0;
    for (const step of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      let count = 0;
      for (let i = 1; i <= 3; i++) {
        const x = site.x + step.x * i, y = site.y + step.y * i;
        if (x < 0 || y < 0 || x >= this.farm.width || y >= this.farm.height || this.farm.ground[y * this.farm.width + x] === 'blocked') break;
        count++;
      }
      if (count > reach) { direction = step; reach = count; }
    }
    const progress = beat.stage === 'inspect' ? ease(beat.elapsed / 770) : 1;
    const distance = Math.min(reach * TILE_PX, 12 + (1 - progress) * 36);
    const ax = px + direction.x * distance, ay = py + direction.y * distance;
    const zoom = 2;
    const cutX = Math.round(clamp((px + ax) / 2 - W / (2 * zoom), 0, this.ground.width - W / zoom));
    const cutY = Math.round(clamp((py + ay) / 2 - H / (2 * zoom) - 3, 0, this.ground.height - H / zoom));
    c.drawImage(this.ground, cutX, cutY, W / zoom, H / zoom, 0, 0, W, H);
    const sx = (px - cutX) * zoom, sy = (py - cutY) * zoom;
    const kind = beat.trace?.kind;
    if (kind === 'footprints') {
      for (let i = -1; i <= 1; i++) {
        this.rect(sx + i * 9, sy + i * 3 + (i === 0 ? 3 : 0), 5, 3, '#4c4135');
        this.rect(sx + i * 9 - 2, sy + i * 3 + (i === 0 ? 6 : 3), 2, 2, '#655543');
      }
    } else if (kind === 'gate') {
      // This trace reports a changed gate without saying whether it now stands open or shut.
      // Frame the two posts and highlight a scraped hinge shared by both states.
      const gate = this.source('gate');
      for (const edge of [0, gate.width - 4]) {
        c.drawImage(gate, edge, 0, 4, gate.height, sx - gate.width + edge * zoom,
          sy + TILE_PX - gate.height * zoom, 4 * zoom, gate.height * zoom);
      }
      this.rect(sx - 10, sy + 2, 4, 2, '#ccac74');
    } else if (kind && kind !== 'sighting') {
      const key = kind === 'emptyPedestal' ? 'pedestalEmpty' : kind === 'brokenFence' ? 'fenceGap' : 'gateOpen';
      const object = this.source(key);
      c.drawImage(object, sx - object.width, sy + TILE_PX - object.height * zoom, object.width * zoom, object.height * zoom);
      if (kind === 'openLock') c.drawImage(this.source('padlockOpen'), sx - 8, sy - 8, 16, 16);
    }
    const x = (ax - cutX) * zoom, feet = (ay - cutY) * zoom + 5;
    this.rect(x - 9, feet - 4, 18, 4, '#4d5242');
    const walking = progress < 1;
    const pondering = beat.stage === 'think' || (beat.stage === 'inspect' && !walking);
    this.actor(walking ? 1 + Math.floor(beat.elapsed / 150) % 2 : 0, x, feet, pondering ? 40 : 46, direction.x > 0);
    if (pondering) {
      const wobble = Math.round(Math.sin(beat.elapsed / 220));
      this.rect(x + (direction.x > 0 ? -12 : 5), feet - 28 + wobble, 7, 4, '#b27949');
      this.rect(x + (direction.x > 0 ? -11 : 6), feet - 29 + wobble, 5, 3, '#e6a765');
    }
  }

  private workshop(beat: MorningBeat): void {
    const work = beat.work!;
    const t = beat.stage === 'ready' ? MORNING_WORK_MS : beat.elapsed;
    const complete = t >= 830;
    // Close framing conceals the destination. The prop uses the same sprite seen at night.
    this.rect(0, 0, W, H, '#343b3c');
    for (let y = 0; y < H; y += 20) {
      this.rect(0, y, W, 1, '#484d47');
      this.rect(0, y + 2, W, 2, '#293332');
      this.rect(26 + (y * 3) % 88, y + 10, 21, 1, '#474c44');
    }
    this.rect(0, 142, W, 4, '#927452');
    this.rect(0, 146, W, 34, '#655544');
    this.rect(0, 151, W, 2, '#574938');
    this.rect(128, 143, 64, 4, '#4a4439');
    const keys = { lamp: ['lampPostDark', 'lampPost'], doghouse: ['doghouseSpot', 'doghouse'],
      padlock: ['padlockOpen', 'padlock'], fence: ['fenceGap', 'fence'] } as const;
    const source = this.source(keys[work.prop][complete || work.type === 'move' ? 1 : 0]);
    const scale = work.prop === 'padlock' ? 7 : 4;
    const shift = work.type === 'move' ? Math.round(-44 * (1 - ease(t / 880))) : 0;
    const x = 160 + shift, feet = 146;
    this.ctx.drawImage(source, x - source.width * scale / 2, feet - source.height * scale, source.width * scale, source.height * scale);
    const strike = t > 130 && t < 830;
    if (strike) {
      const beatNo = Math.floor((t - 130) / 140);
      const swing = Math.sin((t - 130) / 140 * Math.PI);
      for (const side of [-1, 1]) {
        const hit = (beatNo % 2 === 0) === (side === 1);
        const hx = x + side * (42 + (hit ? 0 : 12));
        const hy = 86 + (hit ? Math.round(10 * Math.abs(swing)) : 10);
        this.rect(hx - (side === 1 ? 0 : 17), hy + 3, 19, 10, '#ae7d38');
        this.rect(hx - 5, hy, 11, 10, '#724e3a');
        this.rect(hx - 4, hy + 1, 9, 7, '#e9b67b');
        if (hit && work.type !== 'move') {
          const c = this.ctx;
          c.save(); c.translate(hx, hy); c.rotate(side * (-0.65 - Math.abs(swing) * 0.75));
          this.rect(-2, -18, 4, 20, '#a87547');
          this.rect(-8, -23, 17, 7, '#a6aca0');
          this.rect(-8, -24, 17, 2, '#dbe1c8'); c.restore();
        }
      }
      const plume = (t - 130) / 700;
      for (let i = 0; i < 5; i++) {
        const p = (plume * 2 + i / 5) % 1;
        this.ctx.globalAlpha = Math.min(0.75, (1 - p) * 1.1);
        const dx = x + (i - 2) * (7 + p * 12), dy = 92 - p * 39;
        this.rect(dx, dy - 3, 10, 9, '#d0cdbc');
        this.rect(dx - 3, dy, 16, 4, '#efe9d4');
      }
      this.ctx.globalAlpha = 1;
    }
    if (complete && t < MORNING_WORK_MS) {
      const length = Math.round(9 * Math.sin(Math.PI * (t - 830) / (MORNING_WORK_MS - 830)));
      const sparkleY = work.prop === 'lamp' ? feet - (32 - 14) * scale : feet - source.height * scale + 5;
      this.rect(x + 15 - length, sparkleY, length * 2 + 1, 2, '#fff2bf');
      this.rect(x + 15, sparkleY + 1 - length, 2, length * 2 + 1, '#fff2bf');
    }
  }
}
