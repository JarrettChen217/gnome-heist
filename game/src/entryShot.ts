// AI-use disclosure: Codex built the dog-hole entrance animation under Hao's direction.
import * as Phaser from 'phaser';
import type { FarmDef, Tile } from '@gnome-heist/core';
import { TILE_PX } from './constants.ts';

export const ESTATE_TIMING = { dusk: 650, push: 1300, crawl: 2100, end: 3100 } as const;

// Coordinates on the 1448 × 1086 source painting, before alignment with the gameplay camera.
const PAINTED_HOLES = {
  west: { x: 184 / 1448, y: 667 / 1086 },
  east: { x: 1263 / 1448, y: 861 / 1086 },
  south: { x: 693 / 1448, y: 936 / 1086 },
};

function smoothstep(value: number): number {
  const t = Phaser.Math.Clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Presentation only: the authoritative player stays on the entrance tile. */
export class EntryShot {
  private readonly estateBackdrop: Phaser.GameObjects.Graphics;
  private readonly estate: Phaser.GameObjects.Image;
  private readonly estateLight: Phaser.GameObjects.Graphics;
  private readonly exterior: Phaser.GameObjects.Graphics;
  private readonly leaves: Phaser.GameObjects.Graphics;
  private bounds: Phaser.Geom.Rectangle | null = null;
  private player: Phaser.GameObjects.Sprite | null = null;
  private zoom = 1;
  private firstNight = false;

  constructor(private readonly scene: Phaser.Scene, private readonly farm: FarmDef) {
    this.estateBackdrop = scene.add.graphics().setDepth(100001).setVisible(false);
    this.estate = scene.add.image(0, 0, 'estate-day').setOrigin(0).setDepth(100001).setVisible(false);
    this.estateLight = scene.add.graphics().setDepth(100001).setVisible(false);
    this.exterior = scene.add.graphics().setDepth(-1000).setVisible(false);
    this.leaves = scene.add.graphics().setDepth(100003).setVisible(false);
  }

  draw(player: Phaser.GameObjects.Sprite, entryTile: Tile, inward: Tile, elapsedMs: number, durationMs: number, normalZoom: number): void {
    const cam = this.scene.cameras.main;
    const t = Phaser.Math.Clamp(elapsedMs / durationMs, 0, 1);
    if (!this.player) {
      this.player = player;
      this.zoom = normalZoom;
      this.firstNight = durationMs > 400;
      if (this.firstNight) {
        const bounds = cam.getBounds();
        this.bounds = new Phaser.Geom.Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
        // Continue the dark ground beyond the authored map; it is scenery only.
        const g = this.exterior.clear().setVisible(true);
        const { x, y, width, height } = this.bounds;
        // The opaque tilemap covers the middle of these three background bands.
        for (const [margin, shade] of [[256, 0x101a1d], [128, 0x152427], [64, 0x1c3030]] as const) {
          g.fillStyle(shade).fillRect(x - margin, y - margin, width + 2 * margin, height + 2 * margin);
        }
        const holeX = entryTile.x * TILE_PX;
        const holeY = entryTile.y * TILE_PX;
        for (let py = holeY - 144; py < holeY + 144; py += 8) {
          for (let px = holeX - 144; px < holeX + 144; px += 8) {
            if (px >= x && px < x + width && py >= y && py < y + height) continue;
            const seed = Math.abs((Math.imul(px + 13, py + 17) ^ (px * 31 + py * 11)) % 97);
            if (seed >= 18) continue;
            const distance = Math.max(x - px, px - (x + width), y - py, py - (y + height));
            g.fillStyle(distance < 64 ? 0x304943 : 0x233733).fillRect(px + seed % 5, py + 3, 2, 2);
          }
        }
        cam.stopFollow();
        cam.removeBounds();
      }
    }
    const cx = (entryTile.x + 0.5) * TILE_PX;
    const cy = (entryTile.y + 0.5) * TILE_PX;
    const crawl = this.firstNight ? Phaser.Math.Clamp((elapsedMs - 1900) / 700, 0, 1) : Phaser.Math.Clamp(t / 0.85, 0, 1);
    const ease = 1 - (1 - crawl) ** 2;
    const row = inward.x < 0 ? 1 : inward.x > 0 ? 2 : inward.y < 0 ? 3 : 0;
    const reveal = Math.max(1, Math.min(32, Math.round(11 + Math.max(0, crawl - 0.18) * 28)));
    const rise = this.firstNight ? Phaser.Math.Clamp((elapsedMs - 2450) / 450, 0, 1) : Phaser.Math.Clamp((t - 0.55) / 0.35, 0, 1);
    const spriteScaleY = 0.65 + 0.35 * rise;
    player.setVisible(!this.firstNight || elapsedMs >= 1900).setFrame(row * 4 + (crawl > 0.25 && crawl < 0.95 ? 1 + Math.floor(elapsedMs / 130) % 2 : 0))
      .setPosition(cx - inward.x * (1 - ease) * 9, cy - inward.y * (1 - ease) * 9 + (32 - reveal) * spriteScaleY)
      .setCrop(0, 0, player.frame.width, reveal).setScale(1, spriteScaleY).setDepth(100002);

    // Two small leaf tremors, drawn over the hole and never written to game state.
    const g = this.leaves.clear().setVisible(true);
    const painted = inward.x > 0 ? PAINTED_HOLES.west : inward.x < 0 ? PAINTED_HOLES.east : PAINTED_HOLES.south;
    const width = this.farm.width * TILE_PX;
    const height = this.farm.height * TILE_PX;
    const push = smoothstep((elapsedMs - ESTATE_TIMING.push) / (ESTATE_TIMING.crawl - ESTATE_TIMING.push));
    // Draw attention to the chosen hole just after the window lights, before pushing in.
    const rustle = this.firstNight ? (elapsedMs - 1110) / 680 : t;
    const pulse = Math.max(0, 1 - Math.abs(rustle - 0.18) / 0.1, 1 - Math.abs(rustle - 0.43) / 0.1);
    if (pulse > 0) {
      const leafX = this.firstNight ? Phaser.Math.Linear(painted.x * width, cx, push) : cx;
      const leafY = this.firstNight ? Phaser.Math.Linear(painted.y * height, cy, push) : cy;
      for (let i = 0; i < 5; i++) {
        const x = leafX + (i - 2) * 4 + Math.sin(elapsedMs / 45 + i) * 2 * pulse;
        const y = leafY - 7 + (i % 2) * 4 - pulse * 3;
        g.fillStyle(i % 2 ? 0x8aa66b : 0x547751).fillRect(Math.round(x), Math.round(y), 4, 3);
      }
    }
    if (this.firstNight && this.bounds) {
      const settle = smoothstep((elapsedMs - 2600) / 500);
      const fade = 1 - smoothstep((elapsedMs - 1950) / 180);
      const dusk = smoothstep((elapsedMs - ESTATE_TIMING.dusk) / (ESTATE_TIMING.push - ESTATE_TIMING.dusk));
      const windowLight = smoothstep((elapsedMs - 1000) / 170) * fade;
      const wideZoom = Math.min(this.scene.scale.width / width, this.scene.scale.height / height) * 0.94;
      const closeZoom = normalZoom * 1.6;
      const zoom = Phaser.Math.Linear(Phaser.Math.Linear(wideZoom, closeZoom, push), normalZoom, settle);
      const halfW = this.scene.scale.width / (2 * normalZoom);
      const halfH = this.scene.scale.height / (2 * normalZoom);
      const clampAxis = (value: number, min: number, size: number, half: number): number => size <= 2 * half ? min + size / 2 : Phaser.Math.Clamp(value, min + half, min + size - half);
      const targetX = clampAxis(cx + inward.x * TILE_PX * 0.5, this.bounds.x, this.bounds.width, halfW);
      const targetY = clampAxis(cy + inward.y * TILE_PX * 0.5, this.bounds.y, this.bounds.height, halfH);
      const closeX = Phaser.Math.Linear(width / 2, cx, push);
      const closeY = Phaser.Math.Linear(height / 2, cy, push);
      cam.setZoom(zoom).centerOn(Phaser.Math.Linear(closeX, targetX, settle), Phaser.Math.Linear(closeY, targetY, settle));
      const backdrop = this.estateBackdrop.clear().setVisible(fade > 0);
      backdrop.fillStyle(0x101a22, fade).fillRect(-1000, -1000, width + 2000, height + 2000);
      backdrop.fillStyle(0x101520, 0.6 * dusk * fade).fillRect(-1000, -1000, width + 2000, height + 2000);
      // Register the selected painted opening to its real tile as the camera approaches.
      const offsetX = (cx - painted.x * width) * push;
      const offsetY = (cy - painted.y * height) * push;
      this.estate.setPosition(offsetX, offsetY).setDisplaySize(width, height).setAlpha(fade).setVisible(fade > 0);
      const illustration = this.estateLight.clear().setVisible(fade > 0);
      // Cool the illustrated farm toward night, then light the farmhouse window.
      illustration.fillStyle(0x14213a, 0.67 * dusk * fade).fillRect(offsetX, offsetY, width, height);
      illustration.fillStyle(0xffd783, windowLight).fillRect(offsetX + width * 792 / 1448, offsetY + height * 264 / 1086, width * 32 / 1448, height * 38 / 1086);
      illustration.fillStyle(0x725044, windowLight).fillRect(offsetX + width * 806 / 1448, offsetY + height * 264 / 1086, 1, height * 38 / 1086)
        .fillRect(offsetX + width * 792 / 1448, offsetY + height * 282 / 1086, width * 32 / 1448, 1);

    }
  }

  clear(): void {
    this.leaves.clear().setVisible(false);
    this.exterior.clear().setVisible(false);
    this.estateBackdrop.clear().setVisible(false);
    this.estate.setVisible(false);
    this.estateLight.clear().setVisible(false);
    if (this.player) this.player.setCrop().setScale(1);
    if (this.bounds) {
      this.scene.cameras.main.setZoom(this.zoom).setBounds(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);
    }
    this.bounds = null;
    this.player = null;
  }
}
