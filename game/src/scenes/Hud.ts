// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7).
import * as Phaser from 'phaser';
import { PLAYER_STAMINA } from '@gnome-heist/core';
import type { NightHudState } from './Night.ts';

/** Fixed on screen: its own scene and camera, so the night camera's scroll and zoom do not touch it. */
export class HudScene extends Phaser.Scene {
  private status!: Phaser.GameObjects.Text;
  private corner!: Phaser.GameObjects.Text;

  constructor() {
    super('Hud');
  }

  create(): void {
    const style = { fontFamily: 'monospace', fontSize: '16px', color: '#f0ead8', backgroundColor: '#000000aa', padding: { x: 6, y: 4 } };
    this.status = this.add.text(8, 8, '', style);
    this.corner = this.add.text(0, 0, 'M0 greybox · WASD / arrows to walk', style).setOrigin(1, 1);
    this.place();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.place, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.place, this));
  }

  private place(): void {
    this.corner.setPosition(this.scale.width - 8, this.scale.height - 8);
  }

  override update(): void {
    const s = this.registry.get('hud') as NightHudState | undefined;
    if (s === undefined) return;
    this.status.setText(`Night ${s.night}   Stamina ${s.stamina}/${PLAYER_STAMINA}   Tile ${s.tile.x},${s.tile.y}`);
  }
}
