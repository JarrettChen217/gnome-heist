// AI-use disclosure: Claude (Claude Code) wrote the original HUD under Hao's direction.
// Codex illustrated the entry screen and built the contextual controls and feedback under Hao's direction.
import * as Phaser from 'phaser';
import { playFeedback } from '../feedbackSound.ts';
import { PauseMenu } from '../pauseMenu.ts';
import type { NightHudState } from './Night.ts';

const CREAM = '#f0ead8';
const style = { fontFamily: 'monospace', fontSize: '16px', color: CREAM, backgroundColor: '#101720', padding: { x: 6, y: 4 } };

/** The HUD has its own camera so text stays at screen scale while following the farm objects. */
export class HudScene extends Phaser.Scene {
  private entry!: Phaser.GameObjects.Container;
  private cover!: Phaser.GameObjects.Image;
  private entryBand!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private choices!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private fieldMap!: Phaser.GameObjects.Graphics;
  private mapKey!: Phaser.GameObjects.Text;
  private scrollNote!: Phaser.GameObjects.Text;
  private cap!: Phaser.GameObjects.Graphics;
  private letter!: Phaser.GameObjects.Text;
  private panel!: Phaser.GameObjects.Text;
  private corner!: Phaser.GameObjects.Text;
  private tutorial!: Phaser.GameObjects.Container;
  private veil!: Phaser.GameObjects.Rectangle;
  private movementKeys!: Phaser.GameObjects.Container;
  private pauseMenu!: PauseMenu;
  private feedbackId: number | null = null;

  constructor() {
    super('Hud');
  }

  create(): void {
    this.status = this.add.text(8, 8, '', style);
    this.fieldMap = this.add.graphics().setDepth(1);
    this.mapKey = this.add.text(0, 0, 'N ↑     House    Entry    You', { ...style, fontSize: '10px' });
    this.scrollNote = this.add.text(0, 0, 'Dig up a garden gnome. The farmhouse is north. Escape through a hedge opening.', { ...style, color: '#382a1c', backgroundColor: '#ead6a4', padding: { x: 8, y: 6 }, fontSize: '13px', lineSpacing: 3 });
    this.prompt = this.add.text(0, 0, '', { ...style, fontSize: '14px', align: 'center' }).setOrigin(0.5, 1);
    this.cap = this.add.graphics();
    this.letter = this.add.text(0, 0, 'E', { fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold', color: CREAM, stroke: '#253039', strokeThickness: 3 }).setOrigin(0.5);
    this.panel = this.add.text(0, 0, '', { ...style, backgroundColor: '#101720f5', padding: { x: 14, y: 12 }, lineSpacing: 3 }).setOrigin(0.5);
    this.corner = this.add.text(0, 0, 'Esc · Pause', { ...style, fontSize: '13px' }).setOrigin(1, 1);
    this.cover = this.add.image(0, 0, 'night-cover').setOrigin(0.5);
    this.entryBand = this.add.rectangle(0, 0, 1, 1, 0x101724).setOrigin(0);
    this.title = this.add.text(0, 0, 'Gnome Heist', { fontFamily: 'Georgia, serif', fontStyle: 'bold italic', fontSize: '44px', color: '#ffe4a0' });
    this.choices = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ede6d7', lineSpacing: 6 });
    this.entry = this.add.container(0, 0, [this.cover, this.entryBand, this.title, this.choices]);
    this.veil = this.add.rectangle(0, 0, 1, 1, 0x0b0e13, 0.58).setOrigin(0);
    this.movementKeys = this.add.container(0, 0);
    for (const [i, key] of ['W', 'A', 'S', 'D'].entries()) {
      const x = i === 0 ? 0 : (i - 2) * 40;
      const y = i === 0 ? -38 : 0;
      this.movementKeys.add([
        this.add.rectangle(x, y + 3, 32, 32, 0x77715e),
        this.add.rectangle(x, y, 32, 32, 0x283239).setStrokeStyle(2, 0xe3cca1),
        this.add.text(x, y, key, { fontFamily: 'monospace', fontSize: '18px', color: CREAM }).setOrigin(0.5),
      ]);
    }
    this.movementKeys.add(this.add.text(0, 28, 'WASD or arrow keys to walk', style).setOrigin(0.5, 0));
    this.tutorial = this.add.container(0, 0, [this.veil, this.movementKeys]).setDepth(8).setVisible(false);
    this.pauseMenu = new PauseMenu(
      () => this.game.events.emit('hud-resume'),
      () => this.game.events.emit('hud-restart'),
      (volume) => this.sound.setVolume(volume),
      this.sound.volume,
    );
    this.place();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.place, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.place, this);
      this.pauseMenu.destroy();
    });
  }

  private place(): void {
    const { width, height } = this.scale;
    const stacked = width < 780;
    const bandHeight = stacked ? 130 : 100;
    const top = Math.max(0, height - bandHeight);
    const scale = Math.max(width / this.cover.width, top / this.cover.height);
    const coverWidth = this.cover.width * scale;
    const cropLeft = Phaser.Math.Clamp(coverWidth * 0.64 - width / 2, 0, coverWidth - width);
    this.cover.setPosition(coverWidth / 2 - cropLeft, top / 2).setScale(scale);
    this.choices.setFontSize(width < 370 ? 13 : 16);
    this.entryBand.setPosition(0, top).setSize(width, bandHeight);
    this.title.setPosition(stacked ? 16 : 32, top + (stacked ? 6 : 20));
    this.choices.setPosition(stacked ? 16 : Math.max(330, width * 0.45), top + (stacked ? 66 : 24));
    this.corner.setPosition(width - 8, height - 8);
    this.panel.setPosition(width / 2, height / 2).setWordWrapWidth(Math.min(640, width - 52), true);
    this.veil.setSize(width, height);
    this.movementKeys.setPosition(width / 2, Math.min(height - 70, height / 2 + 105));
    this.prompt.setWordWrapWidth(Math.min(440, width - 40), true);
    this.scrollNote.setWordWrapWidth(Math.max(100, Math.min(245, width - 28)), true);
  }

  private drawFieldMap(s: NightHudState): void {
    const map = s.fieldMap;
    const visible = s.phase === 'night' && !s.paused && !s.showMovementHint;
    this.fieldMap.clear().setVisible(visible && map !== null);
    this.mapKey.setVisible(visible && map !== null);
    this.scrollNote.setVisible(visible && s.showScrollNote);
    if (!visible) return;

    const left = 8;
    const top = this.status.y + this.status.height + 6;
    let bottom = top;
    if (map) {
      const cell = Math.max(2, Math.min(5, Math.floor((this.scale.width - 32) / map.width)));
      const mapWidth = map.width * cell;
      const mapHeight = map.height * cell;
      const g = this.fieldMap;
      g.fillStyle(0x101720, 0.94).fillRect(left, top, mapWidth + 12, mapHeight + 12);
      g.lineStyle(1, 0x817b65).strokeRect(left, top, mapWidth + 12, mapHeight + 12);
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          if (map.visited[y * map.width + x]) {
            g.fillStyle(0x50685e).fillRect(left + 6 + x * cell, top + 6 + y * cell, cell, cell);
          }
        }
      }
      const center = (point: { x: number; y: number }): { x: number; y: number } => ({
        x: left + 6 + (point.x + 0.5) * cell,
        y: top + 6 + (point.y + 0.5) * cell,
      });
      const house = center(map.house);
      const entry = center(map.entry);
      const player = center(map.player);
      // Reuse the same pixel symbols on the map and its key.
      const houseIcon = (x: number, y: number): void => {
        g.fillStyle(0x392c2a).fillRect(x - 5, y - 5, 11, 11);
        g.fillStyle(0xe3bc7b).fillRect(x - 3, y, 7, 5);
        g.fillStyle(0xe27b62).fillRect(x - 4, y - 2, 9, 2).fillRect(x - 2, y - 4, 5, 2);
        g.fillStyle(0x594139).fillRect(x, y + 2, 2, 3);
      };
      const entryIcon = (x: number, y: number): void => {
        g.fillStyle(0x152422).fillRect(x - 5, y - 4, 11, 9);
        g.fillStyle(0x7bd8a1).fillRect(x - 4, y - 3, 2, 7).fillRect(x + 3, y - 3, 2, 7);
        g.fillRect(x - 4, y - 3, 9, 2);
      };
      const playerIcon = (x: number, y: number): void => {
        g.fillStyle(0x102b3a).fillRect(x - 4, y - 4, 9, 9);
        g.fillStyle(0x70dafa).fillRect(x - 2, y - 2, 5, 5);
        g.fillStyle(0xffffff).fillRect(x, y, 1, 1);
      };
      houseIcon(Math.round(house.x), Math.round(house.y));
      entryIcon(Math.round(entry.x), Math.round(entry.y));
      playerIcon(Math.round(player.x), Math.round(player.y));
      bottom = top + mapHeight + 12;
      this.mapKey.setPosition(left, bottom + 2);
      const keyY = bottom + 11;
      houseIcon(left + 30, keyY);
      entryIcon(left + 84, keyY);
      playerIcon(left + 138, keyY);
      bottom += this.mapKey.height + 2;
    }
    this.scrollNote.setPosition(left, bottom + 5);
  }

  private drawInteraction(s: NightHudState, time: number): void {
    this.cap.clear();
    this.letter.setVisible(false);
    const p = s.message ?? s.prompt;
    if (!p || s.phase !== 'night' || s.paused || s.showMovementHint) {
      this.prompt.setVisible(false);
      return;
    }
    this.prompt.setText(p.text).setColor(p.red ? '#ffa691' : CREAM).setVisible(true);
    const { width, height } = this.scale;
    if (s.message || !s.targetScreen) {
      this.prompt.setPosition(width / 2, height - 42);
      return;
    }

    const x = Phaser.Math.Clamp(s.targetScreen.x, 18, width - 18);
    const y = Phaser.Math.Clamp(s.targetScreen.y - 19, this.prompt.height + 31, height - 25);
    const labelX = Phaser.Math.Clamp(x, this.prompt.width / 2 + 6, width - this.prompt.width / 2 - 6);
    this.prompt.setPosition(labelX, y - 18);
    if (p.red) return;
    const fill = Phaser.Math.Clamp(s.progress, 0, 1);
    const shake = fill > 0.66 ? Math.round(Math.sin(time / 24) * 1.7) : 0;
    const left = Math.round(x - 14) + shake;
    const top = Math.round(y - 14) + (fill > 0 ? 2 : 0);
    this.cap.fillStyle(0x716b5b).fillRect(left, top + 3, 28, 28);
    this.cap.fillStyle(0x293139).fillRect(left, top, 28, 28);
    const pixels = Math.round(fill * 24);
    this.cap.fillStyle(0xe0bd75).fillRect(left + 2, top + 26 - pixels, 24, pixels);
    this.cap.lineStyle(2, 0xffe4aa).strokeRect(left + 1, top + 1, 26, 26);
    this.letter.setPosition(left + 14, top + 14).setVisible(true);
  }

  private feedback(s: NightHudState): void {
    const event = s.feedback;
    if (!event || event.id === this.feedbackId) return;
    this.feedbackId = event.id;
    playFeedback(this.sound, event.action);
    if (event.action !== 'pickLock' && event.action !== 'kickFence' && event.action !== 'relock') return;
    const { x, y } = this.letter;
    for (const [dx, dy, rotation] of [[-18, -14, -40], [17, -10, 65], [11, 12, 35]] as const) {
      const chip = this.add.rectangle(x + Math.sign(dx) * 8, y, 6, 3, 0xf1cf8b).setDepth(5);
      this.tweens.add({ targets: chip, x: x + dx, y: y + dy, angle: rotation, alpha: 0, duration: 230, ease: 'Quad.easeOut', onComplete: () => chip.destroy() });
    }
  }

  override update(time: number): void {
    const s = this.registry.get('hud') as NightHudState | undefined;
    if (s === undefined) return;
    this.entry.setVisible(s.phase === 'choose');
    this.status.setVisible(s.phase === 'night');
    this.corner.setVisible(s.phase === 'night');
    const pips = '●'.repeat(s.stamina) + '○'.repeat(Math.max(0, s.maxStamina - s.stamina));
    const status = `Night ${s.night}   Stamina ${pips}${s.carrying ? '   Carrying a gnome' : ''}`;
    this.status.setText(s.inBush && s.phase === 'night' ? `${status}\nBush cover · Dogs can hear you` : status);

    this.drawFieldMap(s);
    this.feedback(s);
    this.drawInteraction(s, time);
    this.tutorial.setVisible(s.phase === 'night' && s.showMovementHint && !s.paused);
    this.pauseMenu.setVisible(s.paused);
    if (s.phase === 'choose') {
      const entrances = s.holes.map((id, i) => `[${i + 1}] ${id.replace(/^hole_/, '').toUpperCase()}`);
      this.choices.setText(`Night ${s.night} · Choose your entrance\n${entrances.join('   ')}`);
      this.panel.setVisible(false);
    } else if (s.phase === 'ended' && s.result) {
      this.panel.setText(s.result.join('\n')).setVisible(true);
      this.panel.setScale(Math.min(1, (this.scale.height - 24) / this.panel.height));
    } else this.panel.setVisible(false);
  }
}
