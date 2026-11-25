// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7) and added the T8 object states.
// Codex integrated the original night farm artwork and directional character frames for Hao.
import * as Phaser from 'phaser';
import farmUrl from '@gnome-heist/maps/farm.tmj?url';
import farmTilesUrl from '@gnome-heist/maps/night-farm.png?url';
// Codex generated the dawn farmhouse and four farmer poses with ImageGen under Hao's direction.
import farmerPosesUrl from '../assets/morning-farmer.webp?url';
import playerUrl from '../assets/player.png?url';
import { preloadEnvironment } from '../environment.ts';

/**
 * Tileset images by the file name the .tmj gives. Vite renames files when it
 * builds, so the map's relative image path is resolved through this table and
 * a map that names an unknown image fails loudly.
 */
export const TILESET_IMAGES: Readonly<Record<string, string>> = { 'night-farm.png': farmTilesUrl };

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.spritesheet('morning-farmer', farmerPosesUrl, { frameWidth: 96, frameHeight: 128 });
    preloadEnvironment(this);
    this.load.spritesheet('player-art', playerUrl, { frameWidth: 24, frameHeight: 32 });
    this.load.tilemapTiledJSON('farm', farmUrl);
    this.load.once(Phaser.Loader.Events.FILE_KEY_COMPLETE + 'tilemapJSON-farm', () => {
      const data = this.cache.tilemap.get('farm').data as { tilesets: { name: string; image: string }[] };
      for (const ts of data.tilesets) {
        const url = TILESET_IMAGES[ts.image];
        if (url === undefined) throw new Error(`Tileset "${ts.name}" names unknown image "${ts.image}"`);
        this.load.image(ts.name, url);
      }
    });
  }

  create(): void {
    this.scene.start('Night');
  }
}
