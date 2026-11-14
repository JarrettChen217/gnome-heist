// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7); the fog here is an engine check, not the T9 player view.
import * as Phaser from 'phaser';
import { loadFarm, newSession, startNight, tick } from '@gnome-heist/core';
import type { FarmDef, FarmObject, NightState } from '@gnome-heist/core';
import { MIN_CAMERA_ZOOM, DEBUG_FOG_RADIUS_TILES, STEP_SECONDS, TILE_PX } from '../constants.ts';

/** One drawn farm object, with a faded "last seen" copy for the fog check. */
interface Prop {
  readonly tiles: readonly { x: number; y: number }[];
  readonly live: Phaser.GameObjects.Image;
  readonly ghost: Phaser.GameObjects.Image;
  readonly tag: Phaser.GameObjects.Text;
}

export interface NightHudState {
  night: number;
  stamina: number;
  tile: { x: number; y: number };
}

/** Depth from the y of an object's feet, so the player passes behind and in front of tall things. */
const depthOf = (feetYpx: number) => 10 + feetYpx;

export class NightScene extends Phaser.Scene {
  private farm!: FarmDef;
  private night!: NightState;
  private player!: Phaser.GameObjects.Image;
  private fog!: Phaser.GameObjects.Graphics;
  private props: Prop[] = [];
  private explored!: Uint8Array;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private acc = 0;

  constructor() {
    super('Night');
  }

  create(): void {
    // The same .tmj the rules read: Phaser renders it, core/loadFarm validates it.
    const json = this.cache.tilemap.get('farm').data as unknown;
    this.farm = loadFarm(json);
    this.night = startNight(newSession(this.farm, 1), this.farm);
    this.explored = new Uint8Array(this.farm.width * this.farm.height);

    const map = this.make.tilemap({ key: 'farm' });
    const tileset = map.addTilesetImage('greybox', 'greybox');
    if (tileset === null) throw new Error('tileset "greybox" missing from the map');
    map.createLayer('ground', tileset, 0, 0)?.setDepth(0);
    map.createLayer('decoration', tileset, 0, 0)?.setDepth(1);

    this.addProps();
    this.player = this.add.image(0, 0, 'player').setOrigin(0.5, 1);
    this.syncPlayer();

    this.fog = this.add.graphics().setDepth(100000);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.farm.width * TILE_PX, this.farm.height * TILE_PX);
    this.fitZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitZoom, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fitZoom, this));
    // Phaser 4: startFollow without the second argument turns the camera's roundPixels off.
    cam.startFollow(this.player, true);

    const kb = this.input.keyboard;
    if (kb === null) throw new Error('keyboard input unavailable');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP), down: kb.addKey(K.DOWN), left: kb.addKey(K.LEFT), right: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W), a: kb.addKey(K.A), s: kb.addKey(K.S), d: kb.addKey(K.D),
    };

    this.scene.launch('Hud');
    this.publishDebug();
  }

  /** Integer zoom large enough that the map fills the window, so the camera always has room to follow. */
  private fitZoom(): void {
    const { width, height } = this.scale;
    const fit = Math.max(width / (this.farm.width * TILE_PX), height / (this.farm.height * TILE_PX));
    this.cameras.main.setZoom(Math.max(MIN_CAMERA_ZOOM, Math.ceil(fit)));
  }

  private addProps(): void {
    const f = this.farm;
    const add = (o: FarmObject, key: string, originY = 1) => {
      // Feet at the bottom edge of the object's tiles.
      const x = (o.rect.x + o.rect.w / 2) * TILE_PX;
      const y = (o.rect.y + o.rect.h) * TILE_PX;
      const live = this.add.image(x, y, key).setOrigin(0.5, originY).setDepth(depthOf(y));
      const ghost = this.add.image(x, y, key).setOrigin(0.5, originY).setDepth(depthOf(y)).setAlpha(0.4).setVisible(false);
      const tag = this.add
        .text(x, y - live.height - 1, 'seen n1', { fontFamily: 'monospace', fontSize: '24px', color: '#d8d8c8' })
        .setScale(0.25)
        .setOrigin(0.5, 1)
        .setDepth(100001)
        .setVisible(false);
      const tiles = [];
      for (let ty = o.rect.y; ty < o.rect.y + o.rect.h; ty++) for (let tx = o.rect.x; tx < o.rect.x + o.rect.w; tx++) tiles.push({ x: tx, y: ty });
      this.props.push({ tiles, live, ghost, tag });
    };
    f.lampPosts.forEach((o) => add(o, 'lampPost'));
    f.doghouseSpots.forEach((o) => add(o, 'doghouseSpot'));
    f.pedestals.forEach((o) => add(o, 'pedestal'));
    f.bushes.forEach((o) => add(o, 'bush'));
    f.gates.forEach((o) => {
      add(o, 'gate');
      if (o.padlocked) add(o, 'padlock', 0);
    });
    f.fences.forEach((o) => {
      for (let y = o.rect.y; y < o.rect.y + o.rect.h; y++) add({ id: o.id, rect: { x: o.rect.x, y, w: 1, h: 1 } }, 'fence');
    });
  }

  override update(_time: number, deltaMs: number): void {
    const k = this.keys;
    const input = {
      moveX: (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0),
      moveY: (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0),
    };
    // Fixed steps; at most a quarter second per frame so a stalled tab does not jump.
    this.acc = Math.min(this.acc + deltaMs / 1000, 0.25);
    while (this.acc >= STEP_SECONDS) {
      this.night = tick(this.night, input, STEP_SECONDS).night;
      this.acc -= STEP_SECONDS;
    }
    this.syncPlayer();
    this.drawFog();
    this.registry.set('hud', this.hudState());
    this.publishDebug();
  }

  private syncPlayer(): void {
    const x = this.night.player.x * TILE_PX;
    const y = this.night.player.y * TILE_PX;
    this.player.setPosition(x, y).setDepth(depthOf(y));
  }

  private playerTile() {
    return { x: Math.floor(this.night.player.x), y: Math.floor(this.night.player.y) };
  }

  private hudState(): NightHudState {
    return { night: this.night.night, stamina: this.night.stamina, tile: this.playerTile() };
  }

  /**
   * ENGINE CHECK: a per-tile overlay drawn in world space (no masks, no render
   * textures). Visible = within a plain radius; explored = dimmed, with faded
   * "last seen" copies of objects; unexplored = black.
   */
  private drawFog(): void {
    const { width: W, height: H } = this.farm;
    const p = this.night.player;
    const r2 = DEBUG_FOG_RADIUS_TILES * DEBUG_FOG_RADIUS_TILES;
    const visible = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - p.x;
        const dy = y + 0.5 - p.y;
        if (dx * dx + dy * dy <= r2) {
          visible[y * W + x] = 1;
          this.explored[y * W + x] = 1;
        }
      }
    }
    this.fog.clear();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (visible[i]) continue;
        this.fog.fillStyle(0x05060a, this.explored[i] ? 0.6 : 1).fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
      }
    }
    for (const prop of this.props) {
      const seen = prop.tiles.some((t) => visible[t.y * W + t.x]);
      const known = prop.tiles.some((t) => this.explored[t.y * W + t.x]);
      prop.live.setVisible(seen);
      prop.ghost.setVisible(!seen && known);
      prop.tag.setVisible(!seen && known);
    }
  }

  /** Read-only snapshot for automated checks in the browser (window.__gnomeDebug). */
  private publishDebug(): void {
    const cam = this.cameras.main;
    (window as unknown as { __gnomeDebug: unknown }).__gnomeDebug = {
      mapVersion: this.farm.mapVersion,
      player: { ...this.night.player },
      tile: this.playerTile(),
      camera: { scrollX: cam.scrollX, scrollY: cam.scrollY, zoom: cam.zoom, width: cam.width, height: cam.height, roundPixels: cam.roundPixels, worldView: { x: cam.worldView.x, y: cam.worldView.y, w: cam.worldView.width, h: cam.worldView.height } },
      depth: { player: this.player.depth },
    };
  }
}
