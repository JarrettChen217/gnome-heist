// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7).
import * as Phaser from 'phaser';
import { BootScene } from './scenes/Boot.ts';
import { HudScene } from './scenes/Hud.ts';
import { NightScene } from './scenes/Night.ts';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0d0f0c',
  pixelArt: true,
  // Phaser 4 defaults roundPixels to off; greybox pixel art wants it on (Technical plan Section 7).
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: [BootScene, NightScene, HudScene],
});
