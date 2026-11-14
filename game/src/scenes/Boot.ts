// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7).
import * as Phaser from 'phaser';
import farmUrl from '@gnome-heist/maps/farm.tmj?url';
import greyboxUrl from '@gnome-heist/maps/greybox.png?url';
import { TILE_PX } from '../constants.ts';

/**
 * Tileset images by the file name the .tmj gives. Vite renames files when it
 * builds, so the map's relative image path is resolved through this table and
 * a map that names an unknown image fails loudly.
 */
export const TILESET_IMAGES: Readonly<Record<string, string>> = { 'greybox.png': greyboxUrl };

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
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
    this.makeGreyboxTextures();
    this.scene.start('Night');
  }

  /** Greybox sprites drawn with Graphics + generateTexture (Phaser 4 has no textures.generate). */
  private makeGreyboxTextures(): void {
    const T = TILE_PX;
    const g = this.make.graphics({}, false);
    const tex = (key: string, w: number, h: number, draw: () => void) => {
      g.clear();
      draw();
      g.generateTexture(key, w, h);
    };
    tex('player', 12, 18, () => {
      g.fillStyle(0x2b2b3a).fillRect(1, 4, 10, 14);
      g.fillStyle(0xd94a3a).fillTriangle(6, 0, 1, 6, 11, 6); // the hat
    });
    tex('lampPost', T, T * 2, () => {
      g.fillStyle(0x3b3b3b).fillRect(7, 6, 2, 26);
      g.fillStyle(0xf2d16b).fillRect(4, 1, 8, 6);
    });
    tex('gate', T, T, () => {
      g.fillStyle(0x9b7a4c).fillRect(0, 5, T, 3).fillRect(0, 11, T, 3);
      g.fillStyle(0x6b5232).fillRect(1, 2, 3, 14).fillRect(12, 2, 3, 14);
    });
    tex('padlock', 8, 8, () => {
      g.lineStyle(2, 0xd8d8d8).strokeRect(2, 0, 4, 5);
      g.fillStyle(0xc9a227).fillRect(0, 3, 8, 5);
    });
    tex('fence', T, T, () => {
      g.fillStyle(0xbfa57a);
      for (const y of [0, 5, 10]) g.fillRect(5, y, 6, 5);
      g.fillStyle(0x7d6647).fillRect(7, 0, 2, T);
    });
    tex('pedestal', T, T + 6, () => {
      g.fillStyle(0xb8b8b0).fillRect(3, 12, 10, 10);
      g.fillStyle(0xd94a3a).fillTriangle(8, 0, 4, 7, 12, 7);
      g.fillStyle(0xf0d0b0).fillRect(5, 7, 6, 5);
    });
    tex('doghouseSpot', T, T, () => {
      g.lineStyle(1, 0x6b4a2a).strokeRect(2, 2, 12, 12);
    });
    tex('bush', T, T + 4, () => {
      g.fillStyle(0x3f7a3a).fillCircle(8, 10, 8);
      g.fillStyle(0x58994f).fillCircle(6, 7, 4);
    });
    g.destroy();
  }
}
