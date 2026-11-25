// AI-use disclosure: Codex animated the private workshop close-up under Hao's direction.
import type * as Phaser from 'phaser';
import { MORNING_WORK_MS, type MorningBeat } from './morningSequence.ts';

const W = 320;
const H = 180;
const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export class MorningShots {
  private readonly sheet: Phaser.Textures.CanvasTexture;
  readonly image: Phaser.GameObjects.Image;
  private readonly ctx: CanvasRenderingContext2D;
  private lastFrame = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.sheet = scene.textures.createCanvas('morning-shot', W, H)!;
    this.ctx = this.sheet.context;
    this.ctx.imageSmoothingEnabled = false;
    this.image = scene.add.image(0, 0, this.sheet).setOrigin(0).setDepth(10).setVisible(false);
    scene.events.once('shutdown', () => scene.textures.remove(this.sheet.key));
  }

  update(beat: MorningBeat | null): void {
    this.image.setVisible(beat !== null);
    if (!beat) {
      this.lastFrame = '';
      return;
    }
    const frame = [beat.index, beat.work?.prop, beat.work?.type, Math.floor(beat.elapsed / 55)].join('/');
    if (frame === this.lastFrame) return;
    this.lastFrame = frame;
    this.workshop(beat);
    this.sheet.refresh();
  }

  private rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  private workshop(beat: MorningBeat): void {
    const work = beat.work!;
    const t = beat.elapsed;
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
    if (work.prop === 'lamp') return;
    const keys = { doghouse: ['doghouseSpot', 'doghouse'],
      padlock: ['padlockOpen', 'padlock'], fence: ['fenceGap', 'fence'] } as const;
    const source = this.scene.textures.get(keys[work.prop][complete || work.type === 'move' ? 1 : 0]).getSourceImage() as HTMLImageElement;
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
      const sparkleY = feet - source.height * scale + 5;
      this.rect(x + 15 - length, sparkleY, length * 2 + 1, 2, '#fff2bf');
      this.rect(x + 15, sparkleY + 1 - length, 2, length * 2 + 1, '#fff2bf');
    }
  }
}
