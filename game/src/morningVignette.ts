// AI-use disclosure: Codex drew and animated this morning vignette under Hao's direction.
import * as Phaser from 'phaser';
import type { MorningBeat } from './morningSequence.ts';
import { playFeedback } from './feedbackSound.ts';

/** A little theatrical cutaway: scenery is illustrative, never a map of defenses. */
export class MorningVignette {
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly scenery: Phaser.GameObjects.Image;
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly farmer: Phaser.GameObjects.Sprite;
  private farmerX = 85;
  private walkFrom = 85;
  private previousCue = '';
  private readonly heading: Phaser.GameObjects.Text;
  private readonly dialogue: Phaser.GameObjects.Text;
  private readonly footer: Phaser.GameObjects.Text;
  private lastStage = '';
  private textLayout = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.backdrop = scene.add.rectangle(0, 0, 1, 1, 0x172333).setOrigin(0).setDepth(10);
    this.scenery = scene.add.image(0, 0, 'morning-farm').setOrigin(0).setDepth(10);
    this.art = scene.add.graphics().setDepth(10);
    this.farmer = scene.add.sprite(0, 0, 'morning-farmer', 0).setOrigin(0.5, 0.94).setDepth(10);
    const text = { fontFamily: 'monospace', color: '#fff0d0', fontSize: '16px', align: 'center' as const, lineSpacing: 5 };
    this.heading = scene.add.text(0, 0, '', { ...text, color: '#f2c974', fontSize: '14px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(11);
    this.dialogue = scene.add.text(0, 0, '', text).setOrigin(0.5).setDepth(11);
    this.footer = scene.add.text(0, 0, '', { ...text, color: '#f2c974', fontSize: '14px' }).setOrigin(0.5).setDepth(11);
  }

  update(beat: MorningBeat | null): void {
    const visible = beat !== null;
    this.backdrop.setVisible(visible);
    this.scenery.setVisible(visible);
    this.art.setVisible(visible);
    this.farmer.setVisible(visible);
    this.heading.setVisible(visible);
    this.dialogue.setVisible(visible);
    this.footer.setVisible(visible);
    if (!beat) {
      this.lastStage = '';
      this.previousCue = '';
      this.textLayout = '';
      this.farmerX = 85;
      return;
    }
    if (beat.stage === 'ready' && this.lastStage !== 'ready') playFeedback(this.scene.sound, 'morning');
    this.lastStage = beat.stage;
    const { width: w, height: h } = this.scene.scale;
    const g = this.art.clear();
    const unit = Math.min(w / 320, Math.max(0.35, (h - 195) / (320 / 1.5)), 2.3);
    const sceneW = 320 * unit;
    const left = (w - sceneW) / 2;
    const top = Math.max(32, h * 0.1);
    const rect = (x: number, y: number, rw: number, rh: number, color: number): void => {
      g.fillStyle(color).fillRect(Math.round(left + x * unit), Math.round(top + y * unit), Math.ceil(rw * unit), Math.ceil(rh * unit));
    };
    this.backdrop.setSize(w, h);
    this.scenery.setPosition(left, top).setDisplaySize(sceneW, (320 / 1.5) * unit);
    // An inspection prop is symbolic of the committed trace, not its farm location.
    const trace = beat.trace;
    if (trace && ['inspect', 'speak'].includes(beat.stage)) {
      if (trace.kind === 'footprints') {
        for (let i = 0; i < 3; i++) rect(239 + i * 9, 184 + (i % 2) * 5, 5, 3, 0x654e45);
      } else if (trace.kind === 'brokenFence') {
        rect(236, 175, 5, 31, 0xd4b28a); rect(260, 175, 5, 31, 0xd4b28a); rect(239, 185, 11, 4, 0xd4b28a); rect(255, 196, 10, 4, 0xd4b28a);
      } else if (trace.kind === 'emptyPedestal') {
        rect(238, 193, 27, 7, 0x777c73); rect(242, 181, 19, 12, 0xaab0a0); rect(245, 177, 13, 4, 0xc1c6af);
      } else if (trace.kind === 'sighting') {
        rect(242, 171, 14, 14, 0xeac575); rect(246, 174, 3, 3, 0x523e40); rect(252, 174, 3, 3, 0x523e40); rect(246, 182, 8, 2, 0x523e40);
      } else {
        rect(237, 169, 5, 37, 0x71584b); rect(262, 169, 5, 37, 0x71584b); rect(242, 177, 20, 4, 0xc7a478); rect(242, 194, 20, 4, 0xc7a478);
        if (trace.kind === 'openLock') { rect(247, 183, 9, 8, 0xe3c275); rect(253, 178, 3, 6, 0xe3c275); }
      }
    }
    const walking = beat.stage === 'opening' || beat.stage === 'inspect';
    const progress = Math.min(1, beat.elapsed / (beat.stage === 'opening' ? 1400 : 650));
    const cue = `${beat.stage}:${beat.index}`;
    if (cue !== this.previousCue) { this.walkFrom = this.farmerX; this.previousCue = cue; }
    const destination = beat.stage === 'opening' ? 93 : beat.stage === 'inspect' ? 221 + (beat.index % 2) * 8 : this.farmerX;
    if (walking) this.farmerX = this.walkFrom + (destination - this.walkFrom) * progress;
    const y = beat.stage === 'opening' ? 164 + 26 * progress : 190;
    const stretch = beat.stage === 'opening' && beat.elapsed > 1400 && beat.elapsed < 2400;
    const frame = stretch ? 3 : walking && progress < 1 ? 1 + Math.floor(beat.elapsed / 170) % 2 : 0;
    this.farmer.setFrame(frame).setPosition(left + this.farmerX * unit, top + y * unit).setDisplaySize(28 * unit, 37 * unit);
    // Keep animating the actor while the caption and its text texture remain stable.
    const layout = [cue, beat.stamina, beat.money, w, h].join('/');
    if (this.textLayout === layout) return;
    this.textLayout = layout;
    const stageTitle = beat.stage === 'opening' || beat.stage === 'waiting' ? 'MORNING ON THE FARM' : beat.stage === 'inspect' ? `INSPECTING TRACE ${beat.index + 1}` : beat.stage === 'speak' ? 'THE FARMER SAYS' : beat.stage === 'think' ? 'THE FARMER CONSIDERS' : 'BEFORE NIGHT TWO';
    this.heading.setText(stageTitle).setPosition(w / 2, Math.max(22, top - 16));
    const choices = beat.choices.map((choice) => choice.label).join(' + ');
    const words = beat.stage === 'speak' ? `“${beat.line}”`
      : beat.stage === 'think' ? `Buy · 1 stamina + 1 coin\nMove or repair · 1 stamina\nWait · free\n\nChosen: ${choices}`
      : beat.stage === 'ready' ? `“${beat.line}”\n${beat.caption}`
      : beat.stage === 'waiting' ? 'The farmer looks around…'
      : beat.stage === 'inspect' ? beat.caption : beat.stage === 'opening' ? beat.outcome : '';
    const textY = top + (320 / 1.5) * unit + 10;
    this.dialogue.setFontSize(h < 420 || (beat.stage === 'think' && w < 500) ? 12 : 16);
    this.dialogue.setOrigin(0.5, 0).setWordWrapWidth(Math.max(100, Math.min(600, w - 36)), true).setText(words).setPosition(w / 2, textY);
    const pips = '●'.repeat(Math.min(beat.stamina, 8));
    const coins = '●'.repeat(Math.min(beat.money, 8));
    const resources = `Stamina ${pips} ${beat.stamina}   Coin ${coins} ${beat.money}`;
    this.footer.setOrigin(0.5, 0).setFontSize(h < 420 ? 12 : 14)
      .setWordWrapWidth(Math.max(100, w - 36), true)
      .setText(beat.stage === 'think' ? resources : beat.stage === 'ready' ? 'Press Enter to continue' : '')
      .setPosition(w / 2, textY + this.dialogue.height + (h < 420 ? 5 : 12));
  }
}
