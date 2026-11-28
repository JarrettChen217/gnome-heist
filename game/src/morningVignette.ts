// AI-use disclosure: Codex built captions over the live morning scene and the private workshop close-up under Hao's direction.
import * as Phaser from 'phaser';
import { FARMER_STAMINA } from '@gnome-heist/core';
import type { MorningBeat } from './morningSequence.ts';
import { MorningShots } from './morningShots.ts';
import { playFeedback } from './feedbackSound.ts';

/** Caption the live farm and close-frame work whose location stays private. */
export class MorningVignette {
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly captionPanel: Phaser.GameObjects.Rectangle;
  private readonly shots: MorningShots;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly dialogue: Phaser.GameObjects.Text;
  private readonly footer: Phaser.GameObjects.Text;
  private lastStage = '';
  private textLayout = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.backdrop = scene.add.rectangle(0, 0, 1, 1, 0x172333).setOrigin(0).setDepth(10);
    this.shots = new MorningShots(scene);
    this.captionPanel = scene.add.rectangle(0, 0, 1, 1, 0x101720, 0.94).setOrigin(0.5, 0).setDepth(10);
    const text = { fontFamily: 'monospace', color: '#fff0d0', fontSize: '16px', align: 'center' as const, lineSpacing: 5 };
    this.heading = scene.add.text(0, 0, '', { ...text, color: '#f2c974', fontSize: '14px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(11);
    this.dialogue = scene.add.text(0, 0, '', text).setOrigin(0.5).setDepth(11);
    this.footer = scene.add.text(0, 0, '', { ...text, color: '#f2c974', fontSize: '14px' }).setOrigin(0.5).setDepth(11);
  }

  update(beat: MorningBeat | null, nextNight: number): void {
    const visible = beat !== null;
    const workshop = beat?.stage === 'work' && beat.work !== null && beat.work.prop !== 'lamp';
    this.backdrop.setVisible(workshop);
    this.shots.update(workshop ? beat : null);
    this.captionPanel.setVisible(visible && !workshop);
    this.heading.setVisible(visible);
    this.dialogue.setVisible(visible);
    this.footer.setVisible(visible);
    if (!beat) {
      this.lastStage = '';
      this.textLayout = '';
      return;
    }
    if (beat.stage === 'ready' && this.lastStage !== 'ready') playFeedback(this.scene.sound, 'morning');
    this.lastStage = beat.stage;
    const { width: w, height: h } = this.scene.scale;
    this.backdrop.setSize(w, h);
    const cue = [beat.stage, beat.index, beat.work?.prop, beat.work?.type, beat.trace?.id].join('/');
    // Keep animating the actor while the caption and its text texture remain stable.
    const layout = [cue, beat.stamina, beat.money, nextNight, w, h].join('/');
    if (this.textLayout === layout) return;
    this.textLayout = layout;
    const stageTitle = beat.stage === 'opening' || beat.stage === 'waiting' ? 'MORNING ON THE FARM' : beat.stage === 'inspect' ? `INSPECTING TRACE ${beat.index + 1}` : beat.stage === 'speak' ? 'THE FARMER SAYS' : beat.stage === 'think' ? 'THE FARMER CONSIDERS' : beat.stage === 'work' ? 'AT WORK' : `BEFORE NIGHT ${nextNight}`;
    this.heading.setText(stageTitle);
    const choices = beat.choices.map((choice) => choice.label).join(' + ');
    const words = beat.stage === 'speak' ? `“${beat.line}”`
      : beat.stage === 'think' ? `Buy · 1 stamina + 1 coin\nMove or repair · 1 stamina   Wait · free\nChosen: ${choices}`
      : beat.stage === 'work' ? beat.caption
      : beat.stage === 'ready' ? `“${beat.line}”\n${beat.caption}`
      : beat.stage === 'waiting' ? 'The farmer looks around…'
      : beat.stage === 'inspect' ? beat.caption : beat.stage === 'opening' ? `${beat.outcome}\n${beat.caption}` : '';
    const small = h < 420 || w < 500;
    this.dialogue.setFontSize(small ? 12 : 16).setOrigin(0.5, 0)
      .setWordWrapWidth(Math.max(100, Math.min(600, w - 36)), true).setText(words);
    const staminaPips = '●'.repeat(beat.stamina) + '○'.repeat(Math.max(0, FARMER_STAMINA - beat.stamina));
    const coins = '●'.repeat(Math.min(beat.money, 8));
    const resources = `Stamina ${staminaPips} ${beat.stamina}   Coins ${coins} ${beat.money}`;
    const footerText = beat.stage === 'ready' ? `${resources}   ·   Enter to continue`
      : beat.stage === 'work' || beat.stage === 'think' ? resources : '';
    this.footer.setOrigin(0.5, 0).setFontSize(small ? 12 : 14)
      .setWordWrapWidth(Math.max(100, w - 36), true).setText(footerText);
    const gap = small ? 5 : 9;
    const captionH = this.dialogue.height + (footerText ? this.footer.height + gap : 0);
    if (!workshop) {
      const padding = small ? 8 : 12;
      const panelH = padding * 2 + this.heading.height + gap + captionH;
      const panelW = Math.min(w - 16, Math.max(this.heading.width, this.dialogue.width, footerText ? this.footer.width : 0) + padding * 2);
      const top = h - panelH - 10;
      this.captionPanel.setPosition(w / 2, top).setSize(panelW, panelH);
      this.heading.setPosition(w / 2, top + padding + this.heading.height / 2);
      const textY = top + padding + this.heading.height + gap;
      this.dialogue.setPosition(w / 2, textY);
      this.footer.setPosition(w / 2, textY + this.dialogue.height + gap);
      return;
    }
    // Reserve space for the caption before sizing the workshop insert.
    const titleH = this.heading.height + 12;
    const reserved = Math.max(small ? 94 : 128, captionH + gap * 2);
    const unit = Math.max(0.1, Math.min(w / 320, (h - titleH - reserved - 8) / 180, 2.5));
    const top = Math.max(titleH, (h - 180 * unit - reserved + titleH) / 2);
    const textY = top + 180 * unit + gap;
    this.shots.image.setPosition((w - 320 * unit) / 2, top).setDisplaySize(320 * unit, 180 * unit);
    this.heading.setPosition(w / 2, top - this.heading.height / 2 - 4);
    this.dialogue.setPosition(w / 2, textY);
    this.footer.setPosition(w / 2, textY + this.dialogue.height + gap);
  }
}
