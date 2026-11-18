// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7) and T8 (stamina pips, prompts, entry choice, end-of-night panel).
// Codex illustrated the entry selection for the first playable art review.
// Codex added the dense bush cover status under Hao's direction.
import * as Phaser from 'phaser';
import type { NightHudState } from './Night.ts';

/** Fixed on screen: its own scene and camera, so the night camera's scroll and zoom do not touch it. */
export class HudScene extends Phaser.Scene {
  private entry!: Phaser.GameObjects.Container;
  private cover!: Phaser.GameObjects.Image;
  private entryBand!: Phaser.GameObjects.Rectangle;
  private title!: Phaser.GameObjects.Text;
  private choices!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private bar!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Text;
  private corner!: Phaser.GameObjects.Text;

  constructor() {
    super('Hud');
  }

  create(): void {
    const style = { fontFamily: 'monospace', fontSize: '16px', color: '#f0ead8', backgroundColor: '#000000aa', padding: { x: 6, y: 4 } };
    this.status = this.add.text(8, 8, '', style);
    this.prompt = this.add.text(0, 0, '', { ...style, fontSize: '18px' }).setOrigin(0.5, 1);
    this.bar = this.add.graphics();
    this.panel = this.add.text(0, 0, '', { ...style, backgroundColor: '#000000dd', padding: { x: 14, y: 12 }, lineSpacing: 4 }).setOrigin(0.5);
    this.corner = this.add.text(0, 0, 'WASD / arrows: walk · hold E: act · E in a dog hole: end the night', { ...style, fontSize: '13px' }).setOrigin(1, 1);
    this.cover = this.add.image(0, 0, 'night-cover').setOrigin(0.5);
    this.entryBand = this.add.rectangle(0, 0, 1, 1, 0x101724).setOrigin(0);
    this.title = this.add.text(0, 0, 'Gnome Heist', { fontFamily: 'Georgia, serif', fontStyle: 'bold italic', fontSize: '44px', color: '#ffe4a0' });
    this.choices = this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '16px', color: '#ede6d7', lineSpacing: 6 });
    this.entry = this.add.container(0, 0, [this.cover, this.entryBand, this.title, this.choices]);
    this.place();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.place, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.place, this));
  }

  private place(): void {
    const { width, height } = this.scale;
    const stacked = width < 780;
    const bandHeight = stacked ? 130 : 100;
    const top = Math.max(0, height - bandHeight);
    const scale = Math.max(width / this.cover.width, top / this.cover.height);
    const coverWidth = this.cover.width * scale;
    // Keep the thief and gnome in a portrait crop. Clamp to the image edges.
    const cropLeft = Phaser.Math.Clamp(coverWidth * 0.64 - width / 2, 0, coverWidth - width);
    this.cover.setPosition(coverWidth / 2 - cropLeft, top / 2).setScale(scale);
    this.choices.setFontSize(width < 370 ? 13 : 16);
    this.entryBand.setPosition(0, top).setSize(width, bandHeight);
    this.title.setPosition(stacked ? 16 : 32, top + (stacked ? 6 : 20));
    this.choices.setPosition(stacked ? 16 : Math.max(330, width * 0.45), top + (stacked ? 66 : 24));
    this.corner.setPosition(width - 8, height - 8);
    this.prompt.setPosition(width / 2, height - 48);
    this.panel.setPosition(width / 2, height / 2);
  }

  override update(): void {
    const s = this.registry.get('hud') as NightHudState | undefined;
    if (s === undefined) return;
    this.entry.setVisible(s.phase === 'choose');
    this.status.setVisible(s.phase !== 'choose');
    this.corner.setVisible(s.phase !== 'choose');
    const pips = '●'.repeat(s.stamina) + '○'.repeat(Math.max(0, s.maxStamina - s.stamina));
    const status = `Night ${s.night}   Stamina ${pips}${s.carrying ? '   Carrying a gnome' : ''}`;
    this.status.setText(s.inBush && s.phase === 'night' ? `${status}\nBush cover · Dogs can hear you` : status);

    const p = s.message ?? s.prompt;
    this.prompt.setText(p?.text ?? '').setVisible(p !== null && s.phase === 'night');
    this.prompt.setColor(p?.red ? '#ff5a4a' : '#f0ead8');

    this.bar.clear();
    if (s.progress > 0 && s.phase === 'night') {
      const w = 160;
      const x = this.prompt.x - w / 2;
      const y = this.prompt.y + 6;
      this.bar.fillStyle(0x000000, 0.6).fillRect(x, y, w, 6).fillStyle(0xf0ead8, 1).fillRect(x, y, w * Math.min(1, s.progress), 6);
    }

    if (s.phase === 'choose') {
      const entrances = s.holes.map((id, i) => `[${i + 1}] ${id.replace(/^hole_/, '').toUpperCase()}`);
      this.choices.setText(`Night ${s.night} · Choose your entrance\n${entrances.join('   ')}`);
      this.panel.setVisible(false);
    } else if (s.phase === 'ended' && s.result) {
      this.panel.setText([...s.result, '', 'R: play the night again (the morning comes in T10)'].join('\n')).setVisible(true);
    } else this.panel.setVisible(false);
  }
}
