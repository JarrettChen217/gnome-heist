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
