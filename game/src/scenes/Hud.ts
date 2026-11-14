// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7) and T8 (stamina pips, prompts, entry choice, end-of-night panel).
import * as Phaser from 'phaser';
import type { NightHudState } from './Night.ts';

/** Fixed on screen: its own scene and camera, so the night camera's scroll and zoom do not touch it. */
export class HudScene extends Phaser.Scene {
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
    this.place();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.place, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.place, this));
  }

  private place(): void {
    const { width, height } = this.scale;
    this.corner.setPosition(width - 8, height - 8);
    this.prompt.setPosition(width / 2, height - 48);
    this.panel.setPosition(width / 2, height / 2);
  }

  override update(): void {
    const s = this.registry.get('hud') as NightHudState | undefined;
    if (s === undefined) return;
    const pips = '●'.repeat(s.stamina) + '○'.repeat(Math.max(0, s.maxStamina - s.stamina));
    this.status.setText(`Night ${s.night}   Stamina ${pips}   ${s.carrying ? '   Carrying a gnome' : ''}`);

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
      const holes = s.holes.map((h, i) => `  ${i + 1}  ${h}`).join('\n');
      this.panel.setText(`Night ${s.night}. Choose your dog hole:\n\n${holes}`).setVisible(true);
    } else if (s.phase === 'ended' && s.result) {
      this.panel.setText([...s.result, '', 'R: play the night again (the morning comes in T10)'].join('\n')).setVisible(true);
    } else this.panel.setVisible(false);
  }
}
