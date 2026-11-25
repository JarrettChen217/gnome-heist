// AI-use disclosure: Codex staged the farmer's dawn walk and lamp work on the playable farm under Hao's direction.
import * as Phaser from 'phaser';
import { solidGrid, tilesOf, type FarmDef, type Tile, type WorldState } from '@gnome-heist/core';
import { MIN_CAMERA_ZOOM, TILE_PX } from './constants.ts';
import { MORNING_WORK_MS, type MorningBeat } from './morningSequence.ts';

const DAYLIGHT = [
  { name: 'peach', color: 0xd1ad83, strength: 0.38 },
  { name: 'sage', color: 0xafba83, strength: 0.42 },
  { name: 'gold', color: 0xc5b475, strength: 0.44 },
] as const;
const STRIKES = [395, 795] as const;
const SPEED = 84; // World pixels per second, independent of the size of the viewport.
const cardinal = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }] as const;
const center = (n: number) => (n + 0.5) * TILE_PX;
const clamp = Phaser.Math.Clamp;

export class MorningWorld {
  private readonly actor: Phaser.GameObjects.Sprite;
  private readonly light: Phaser.GameObjects.Graphics;
  private readonly window: Phaser.GameObjects.Graphics;
  private readonly effects: Phaser.GameObjects.Graphics;
  private readonly windowTile: Tile;
  private readonly gates = new Map<number, string>();
  private solid: boolean[] = [];
  private route: Tile[] = []; // World-pixel waypoints, including the final work stance.
  private focus: Tile | null = null;
  private lastCue = '';
  private walking = false;
  private distance = 0;
  private lightIndex = -1;
  private mounted = false;
  private hits = 0;
  private normalZoom = MIN_CAMERA_ZOOM;

  constructor(private readonly scene: Phaser.Scene, private readonly farm: FarmDef) {
    this.windowTile = farm.windowSight[0]?.rect ?? { x: Math.floor(farm.width / 2), y: 4 };
    for (const gate of farm.gates) for (const tile of tilesOf(gate)) {
      this.gates.set(tile.y * farm.width + tile.x, gate.id);
    }
    this.actor = scene.add.sprite(0, 0, 'morning-farmer', 0).setDisplaySize(19, 26).setOrigin(0.5, 0.94).setVisible(false);
    this.effects = scene.add.graphics().setVisible(false);
    this.window = scene.add.graphics().setDepth(7000).setVisible(false);
    this.light = scene.add.graphics().setDepth(8000).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }

  begin(world: WorldState, night: number, normalZoom: number): void {
    this.clear();
    this.normalZoom = normalZoom;
    this.solid = solidGrid(this.farm, world);
    // The owner can open his gates. Fences remain solid except at actual gaps.
    for (const i of this.gates.keys()) this.solid[i] = false;
    for (const object of [...this.farm.pedestals, ...this.farm.lampPosts]) {
      for (const tile of tilesOf(object)) this.solid[tile.y * this.farm.width + tile.x] = true;
    }
    this.actor.setPosition(center(this.windowTile.x), center(this.windowTile.y) - 9).setFrame(0).setFlipX(false);
    const variation = Math.floor(Math.random() * (DAYLIGHT.length - 1)) + 1;
    this.lightIndex = ((this.lightIndex < 0 ? night : this.lightIndex) + variation) % DAYLIGHT.length;
    const sun = DAYLIGHT[this.lightIndex]!;
    this.light.clear().fillStyle(sun.color, sun.strength)
      .fillRect(0, 0, this.farm.width * TILE_PX, this.farm.height * TILE_PX).setVisible(true);
    this.window.setVisible(true);
    this.effects.setVisible(true);
    this.scene.cameras.main.stopFollow();
    this.aimCamera();
  }

  clear(): void {
    this.actor.setVisible(false).setRotation(0);
    this.window.clear().setVisible(false);
    this.effects.clear().setVisible(false);
    if (this.light.visible) this.scene.cameras.main.setZoom(this.normalZoom);
    this.light.setVisible(false);
    this.route = [];
    this.focus = null;
    this.walking = false;
    this.distance = 0;
    this.mounted = false;
    this.hits = 0;
    this.lastCue = '';
  }

  get debug() {
    const { x, y } = this.actor;
    const i = Math.floor(y / TILE_PX) * this.farm.width + Math.floor(x / TILE_PX);
    // Swing the gate open as the farmer approaches its tile and close it after he leaves.
    const next = this.route[0];
    const ahead = next ? this.gates.get(Math.floor(next.y / TILE_PX) * this.farm.width + Math.floor(next.x / TILE_PX)) : undefined;
    return { x, y, walking: this.walking, site: this.focus, lampMounted: this.mounted, hammerStrikes: this.hits,
      gate: this.gates.get(i) ?? ahead ?? null, daylight: DAYLIGHT[this.lightIndex]?.name ?? null };
  }

  /** Freeze the presentation clock until the actor finishes the walk to this beat's location. */
  update(beat: MorningBeat, deltaMs: number): boolean {
    const lamp = beat.work?.prop === 'lamp' && beat.site !== null;
    const cue = [beat.stage, beat.index, beat.trace?.id, beat.work?.type, beat.site?.x, beat.site?.y].join('/');
    if (cue !== this.lastCue) {
      this.lastCue = cue;
      if (beat.stage === 'work') { this.hits = 0; this.mounted = false; }
      if (beat.stage === 'inspect' || (beat.stage === 'work' && lamp)) {
        this.focus = beat.site;
        this.route = beat.site ? this.routeBeside(beat.site, lamp) : [];
      } else if (beat.work && !lamp) {
        this.focus = null;
      }
    }
    this.effects.clear();
    const atWindow = beat.stage === 'opening' || beat.stage === 'waiting';
    this.window.clear();
    if (atWindow) this.drawWindow(beat);
    this.actor.setVisible(!atWindow || (beat.stage === 'opening' && beat.elapsed >= 1700) || beat.stage === 'waiting');
    this.walking = this.route.length > 0;
    if (this.walking) {
      this.walk(deltaMs);
      this.actor.setFrame(1 + Math.floor(this.distance / 5) % 2);
    } else {
      if (this.focus) this.actor.setFlipX(this.actor.x > center(this.focus.x));
      this.actor.setFrame(0);
    }
    this.actor.setDepth(10 + this.actor.y + 0.2);
    this.effects.setDepth(10 + Math.max(this.actor.y + 1, this.focus ? (this.focus.y + 1) * TILE_PX + 1 : 0));
    this.actor.setRotation(0);
    if (beat.stage === 'think' && !this.walking) this.ponder(beat.elapsed);
    if (lamp) this.drawLamp(beat, beat.site!);
    else if (beat.trace?.kind === 'footprints' && this.focus && beat.stage !== 'work') {
      const x = center(this.focus.x), y = center(this.focus.y);
      for (const dx of [-5, 0, 5]) this.effects.fillStyle(0x4f443a).fillRect(x + dx, y + (dx === 0 ? 2 : 0), 2, 2);
    }
    this.aimCamera();
    return !this.walking;
  }

  private drawWindow(beat: MorningBeat): void {
    const t = beat.stage === 'opening' ? beat.elapsed : 3000;
    const x = center(this.windowTile.x), y = this.windowTile.y * TILE_PX - 11;
    const open = clamp((t - 160) / 480, 0, 1);
    const shutter = Math.round(4 * (1 - open));
    const g = this.window;
    g.fillStyle(0x3c322d).fillRect(x - 4, y, 8, 6);
    if (shutter) g.fillStyle(0x5a604b).fillRect(x - 4, y, shutter, 6).fillRect(x + 4 - shutter, y, shutter, 6);
    if (open > 0) {
      g.fillStyle(0x747058).fillRect(x - 5 - open, y, 1 + open, 6).fillRect(x + 4, y, 1 + open, 6);
      if (t > 430 && t < 1510) {
        const look = t < 990 ? 1 : -1;
        g.fillStyle(0xd3a36a).fillRect(x - 1, y + 2, 3, 3);
        g.fillStyle(0xd49a49).fillRect(x - 2, y + 1, 4, 1).fillRect(x - 2 + look, y + 2, 5, 1);
        g.fillStyle(0x40342f).fillRect(x + look, y + 3, 1, 1);
      }
    }
    if (beat.stage === 'opening' && t >= 1660) {
      // The window and thresholds share one facade. Step out onto the south path.
      const p = clamp((t - 1660) / 650, 0, 1);
      this.actor.y = center(this.windowTile.y) - (1 - p) * 9;
      this.actor.setAlpha(p);
    } else this.actor.setAlpha(1);
  }

  private aimCamera(): void {
    const cam = this.scene.cameras.main;
    const { width, height } = this.scene.scale;
    // Keep the farmer above the caption strip at all aspect ratios.
    const zoom = Math.max(MIN_CAMERA_ZOOM, Math.ceil(width / (this.farm.width * TILE_PX)),
      Math.ceil(height / (this.farm.height * TILE_PX)));
    cam.setZoom(zoom).centerOn(this.actor.x, this.actor.y - 12 + height / zoom * 0.08);
  }

  private routeBeside(site: Tile, lamp: boolean): Tile[] {
    const { width, height } = this.farm;
    const start = Math.floor(this.actor.y / TILE_PX) * width + Math.floor(this.actor.x / TILE_PX);
    const visited = new Int32Array(width * height).fill(-1);
    visited[start] = start;
    const queue = [start];
    for (let n = 0; n < queue.length; n++) {
      const here = queue[n]!, x = here % width, y = Math.floor(here / width);
      for (const d of cardinal) {
        const nx = x + d.x, ny = y + d.y, next = ny * width + nx;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || this.solid[next] || visited[next] !== -1) continue;
        visited[next] = here;
        queue.push(next);
      }
    }
    const sx = Math.floor(site.x), sy = Math.floor(site.y);
    // Prefer a sideways stance at the post so the hammer head and glass stay in view.
    const neighbors = cardinal.map(d => ({ x: sx + d.x, y: sy + d.y })).filter(p =>
      p.x >= 0 && p.y >= 0 && p.x < width && p.y < height && visited[p.y * width + p.x] !== -1);
    const candidates = lamp && neighbors.some(p => p.y === sy) ? neighbors.filter(p => p.y === sy) : neighbors;
    const goal = queue.find(i => candidates.some(p => p.y * width + p.x === i));
    if (goal === undefined) return [];
    const path: Tile[] = [];
    for (let i = goal; i !== start; i = visited[i]!) path.push({ x: center(i % width), y: center(Math.floor(i / width)) });
    path.push({ x: center(start % width), y: center(Math.floor(start / width)) });
    path.reverse();
    if (lamp) {
      const stand = path[path.length - 1]!;
      // Lean toward the hook while keeping both feet inside the adjacent cell.
      path.push({ x: stand.x + clamp(center(site.x) - stand.x, -5, 5), y: stand.y });
    }
    return path;
  }

  private walk(deltaMs: number): void {
    let remaining = SPEED * clamp(deltaMs, 0, 100) / 1000;
    const actor = this.actor;
    while (remaining > 0 && this.route.length) {
      const next = this.route[0]!, dx = next.x - actor.x, dy = next.y - actor.y;
      const length = Math.hypot(dx, dy);
      const step = Math.min(remaining, length);
      if (length > 0) {
        actor.x += dx * step / length;
        actor.y += dy * step / length;
        if (dx !== 0) actor.setFlipX(dx < 0);
        this.distance += step;
      }
      remaining -= step;
      if (length <= step) this.route.shift();
    }
  }

  private ponder(elapsed: number): void {
    const face = this.actor.flipX ? -1 : 1;
    const lean = clamp(elapsed / 300, 0, 1);
    const nod = Math.sin(elapsed / 260) * 0.025;
    this.actor.setRotation(face * (0.075 + nod) * lean);
    // Bend the near elbow and tap the chin while looking down at the reported evidence.
    const x = this.actor.x, y = this.actor.y;
    const elbowX = x + face * 4, elbowY = y - 9;
    const wristX = x + face * (5 + lean), wristY = y - 12 - 5 * lean;
    this.effects.lineStyle(3, 0xb17b47).lineBetween(x + face * 2, y - 15, elbowX, elbowY);
    this.effects.lineStyle(2, 0xb98851).lineBetween(elbowX, elbowY, wristX, wristY);
    this.effects.fillStyle(0xe9b779).fillRect(Math.round(wristX) - 1, Math.round(wristY) - 1, 3, 2);
  }

  private drawLamp(beat: MorningBeat, site: Tile): void {
    const t = beat.stage === 'ready' ? MORNING_WORK_MS : beat.elapsed;
    const x = center(site.x), baseY = (site.y + 1) * TILE_PX;
    const hookX = x + 4, hookY = baseY - 24;
    const moved = beat.work?.type === 'move';
    const far = Math.hypot(this.actor.x - x, this.actor.y - center(site.y)) > TILE_PX * 1.7;
    const g = this.effects;
    if (!this.walking && !far) {
      this.hits = moved ? 0 : Number(t >= STRIKES[0]) + Number(t >= STRIKES[1]);
      this.mounted = t >= STRIKES[1];
    }
    if (moved && !this.mounted) {
      const lift = this.walking ? 0 : clamp(t / STRIKES[1], 0, 1);
      const handX = this.actor.x + (this.actor.flipX ? -6 : 6), handY = this.actor.y - 10;
      const carryX = Math.round(handX + (hookX - handX) * lift), carryY = Math.round(handY + (hookY - handY) * lift);
      g.fillStyle(0x5d4938).fillRect(carryX - 2, carryY, 4, 6);
      g.fillStyle(0xf4ce7a).fillRect(carryX - 1, carryY + 2, 2, 3);
      return;
    }
    if (this.walking || far || moved) return;
    const facing = hookX >= this.actor.x ? 1 : -1;
    if (t < STRIKES[1] + 65) {
      const next = t <= STRIKES[0] + 65 ? STRIKES[0] : STRIKES[1];
      const lift = clamp((next - t) / 205, 0, 1);
      const headX = hookX - facing * lift * 5, headY = hookY - lift * 7;
      const gripX = headX - facing * 4, gripY = headY + 6;
      g.lineStyle(3, 0x9c713f).lineBetween(this.actor.x + facing * 2, this.actor.y - 16, gripX, gripY);
      g.lineStyle(1, 0xd0a567).lineBetween(gripX, gripY, headX, headY);
      g.fillStyle(0x899295).fillRect(Math.round(headX) - 2, Math.round(headY) - 2, 5, 2);
      g.fillStyle(0xe7af75).fillRect(Math.round(gripX) - 1, Math.round(gripY) - 1, 3, 3);
    }
    if (t > STRIKES[1] && t < STRIKES[1] + 210) {
      const alpha = Math.sin(Math.PI * (t - STRIKES[1]) / 210) * 0.65;
      g.fillStyle(0xffefbd, alpha).fillRect(hookX, hookY + 6, 2, 1).fillRect(hookX + 1, hookY + 5, 1, 3);
    }
  }
}
