// AI-use disclosure: Codex built the dog-hole entrance animation under Hao's direction.
import * as Phaser from 'phaser';
import type { FarmDef, Tile } from '@gnome-heist/core';
import { TILE_PX } from './constants.ts';

export const ESTATE_TIMING = { dusk: 650, push: 1300, crawl: 2100, end: 3100 } as const;

function smoothstep(value: number): number {
  const t = Phaser.Math.Clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Presentation only: the authoritative player stays on the entrance tile. */
export class EntryShot {
  private readonly daylight: Phaser.GameObjects.Graphics;
  private readonly window: Phaser.GameObjects.Graphics;
  private readonly exterior: Phaser.GameObjects.Graphics;
  private readonly leaves: Phaser.GameObjects.Graphics;
  private bounds: Phaser.Geom.Rectangle | null = null;
  private player: Phaser.GameObjects.Sprite | null = null;
  private zoom = 1;
  private firstNight = false;

  constructor(private readonly scene: Phaser.Scene, private readonly farm: FarmDef) {
    this.daylight = scene.add.graphics().setDepth(99990).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.window = scene.add.graphics().setDepth(99991).setVisible(false);
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
    const width = this.farm.width * TILE_PX;
    const height = this.farm.height * TILE_PX;
    const push = smoothstep((elapsedMs - ESTATE_TIMING.push) / (ESTATE_TIMING.crawl - ESTATE_TIMING.push));
    // Draw attention to the chosen hole just after the window lights, before pushing in.
    const rustle = this.firstNight ? (elapsedMs - 1110) / 680 : t;
    const pulse = Math.max(0, 1 - Math.abs(rustle - 0.18) / 0.1, 1 - Math.abs(rustle - 0.43) / 0.1);
    if (pulse > 0) {
      const leafX = cx;
      const leafY = cy;
      for (let i = 0; i < 5; i++) {
        const x = leafX + (i - 2) * 4 + Math.sin(elapsedMs / 45 + i) * 2 * pulse;
        const y = leafY - 7 + (i % 2) * 4 - pulse * 3;
        g.fillStyle(i % 2 ? 0x8aa66b : 0x547751).fillRect(Math.round(x), Math.round(y), 4, 3);
      }
    }
    if (this.firstNight && this.bounds) {
      const settle = smoothstep((elapsedMs - 2600) / 500);
      const dusk = smoothstep((elapsedMs - ESTATE_TIMING.dusk) / (ESTATE_TIMING.push - ESTATE_TIMING.dusk));
      const windowLight = smoothstep((elapsedMs - 1000) / 170);
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
      // Add a muted green-gold light while retaining the underlying pixel contrast.
      this.daylight.clear().setVisible(true).fillStyle(0x9aab65, 0.48 * (1 - dusk))
        .fillRect(0, 0, width, height);
      // The farmhouse art occupies rows 1–3; make-night-art.mjs puts its pane
      // at eaves + 2, centered on the windowSight column.
      const sight = this.farm.windowSight[0];
      const windowX = sight ? (sight.rect.x + 0.5) * TILE_PX : width / 2;
      const windowY = 3 * TILE_PX + 5;
      const pane = this.window.clear().setVisible(true);
      const overview = 1 - smoothstep((elapsedMs - 1900) / 700);
      pane.fillStyle(0x222f3b, (1 - windowLight) * overview).fillRect(windowX - 4, windowY, 8, 5);
      pane.fillStyle(0xe6a963, windowLight * overview).fillRect(windowX - 4, windowY, 8, 5);
      pane.fillStyle(0xffd98e, windowLight * overview).fillRect(windowX - 3, windowY, 3, 2).fillRect(windowX + 1, windowY + 1, 2, 2);
      pane.fillStyle(0x55404a, overview).fillRect(windowX, windowY - 1, 1, 7).fillRect(windowX - 4, windowY + 2, 8, 1);

    }
  }

  clear(): void {
    this.leaves.clear().setVisible(false);
    this.exterior.clear().setVisible(false);
    this.daylight.clear().setVisible(false);
    this.window.clear().setVisible(false);
    if (this.player) this.player.setCrop().setScale(1);
    if (this.bounds) {
      this.scene.cameras.main.setZoom(this.zoom).setBounds(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);
    }
    this.bounds = null;
    this.player = null;
  }
}
