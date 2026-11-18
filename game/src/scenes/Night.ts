// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7) and wired in the T8 night rules; the fog here is a pre-T9 stand-in, not the PlayerView.
// Codex fixed rectangular fence placement under Hao's direction after the M0 review.
// Codex integrated directional player art and walk animation under Hao's direction.
import * as Phaser from 'phaser';
import { PLAYER_STAMINA, currentInteraction, endNight, loadFarm, newSession, startNight, tick, tileOf, tilesOf, visibleTiles } from '@gnome-heist/core';
import type { FarmDef, FarmObject, Interaction, NightEnd, NightResult, NightState, SessionState, Tile } from '@gnome-heist/core';
import { MIN_CAMERA_ZOOM, STEP_SECONDS, TILE_PX } from '../constants.ts';
import { fenceSegments } from '../fence.ts';
import { REFUSAL, promptText, resultLines } from '../text.ts';
import type { PromptText } from '../text.ts';

/** One drawn farm object. `key` gives its texture from the night state; the ghost keeps the last texture seen. */
interface Prop {
  readonly tiles: readonly Tile[];
  readonly live: Phaser.GameObjects.Image;
  readonly ghost: Phaser.GameObjects.Image;
  readonly tag: Phaser.GameObjects.Text;
  readonly key: (n: NightState) => string | null;
}

export type Phase = 'choose' | 'night' | 'ended';

export interface NightHudState {
  phase: Phase;
  night: number;
  stamina: number;
  maxStamina: number;
  carrying: boolean;
  holes: string[];
  prompt: PromptText | null;
  /** 0..1 while E is held on an action. */
  progress: number;
  message: PromptText | null;
  result: string[] | null;
}

/** Depth from the y of an object's feet, so the player passes behind and in front of tall things. */
const depthOf = (feetYpx: number) => 10 + feetYpx;
const DANGER_COLOUR = { window: 0x8fc7ff, lamp: 0xffe27a, dog: 0xff9a4a } as const;
const WALK_FRAMES = 4;
const WALK_FRAME_PX = 6;

export class NightScene extends Phaser.Scene {
  private farm!: FarmDef;
  private session!: SessionState;
  private night!: NightState;
  private phase: Phase = 'choose';
  private result: NightResult | null = null;
  private player!: Phaser.GameObjects.Sprite;
  private walkDistancePx = 0;
  private fog!: Phaser.GameObjects.Graphics;
  private dangerLayer!: Phaser.GameObjects.Graphics;
  private printsLayer!: Phaser.GameObjects.Graphics;
  private props: Prop[] = [];
  private explored!: Uint8Array;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private acc = 0;
  private message: { text: PromptText; until: number } | null = null;
  private printsDrawn = 0;

  constructor() {
    super('Night');
  }

  create(): void {
    // The same .tmj the rules read: Phaser renders it, core/loadFarm validates it.
    this.farm = loadFarm(this.cache.tilemap.get('farm').data as unknown);
    console.info(`[gnome-heist] map version ${this.farm.mapVersion}`);

    const map = this.make.tilemap({ key: 'farm' });
    const tileset = map.addTilesetImage('nightFarm', 'nightFarm');
    if (tileset === null) throw new Error('tileset "nightFarm" missing from the map');
    map.createLayer('ground', tileset, 0, 0)?.setDepth(0);
    map.createLayer('decoration', tileset, 0, 0)?.setDepth(1);
    this.dangerLayer = this.add.graphics().setDepth(2);
    this.printsLayer = this.add.graphics().setDepth(3);

    this.player = this.add.sprite(0, 0, 'player-art', 0).setOrigin(0.5, 1).setVisible(false);
    this.fog = this.add.graphics().setDepth(100000);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.farm.width * TILE_PX, this.farm.height * TILE_PX);
    this.fitZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitZoom, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fitZoom, this));

    const kb = this.input.keyboard;
    if (kb === null) throw new Error('keyboard input unavailable');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = Object.fromEntries(
      Object.entries({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, e: K.E, r: K.R, one: K.ONE, two: K.TWO, three: K.THREE }).map(
        ([name, code]) => [name, kb.addKey(code)],
      ),
    );

    this.newSessionAndChoose();
    this.scene.launch('Hud');
  }

  /** M1: every night starts from a fresh session (the morning that carries changes over is T10). */
  private newSessionAndChoose(): void {
    this.session = newSession(this.farm, 1);
    this.night = startNight(this.session, this.farm, this.farm.dogHoles[0]!.id);
    this.phase = 'choose';
    this.result = null;
    this.explored = new Uint8Array(this.farm.width * this.farm.height);
    this.printsDrawn = 0;
    this.printsLayer.clear();
    this.player.setVisible(false);
    for (const p of this.props) [p.live, p.ghost, p.tag].forEach((o) => o.destroy());
    this.props = [];
    this.addProps();
    this.drawDanger();
    this.cameras.main.stopFollow();
    this.cameras.main.centerOn((this.farm.width * TILE_PX) / 2, (this.farm.height * TILE_PX) / 2);
  }

  private beginNight(entry: string): void {
    this.night = startNight(this.session, this.farm, entry);
    this.phase = 'night';
    this.acc = 0;
    this.walkDistancePx = 0;
    this.player.setVisible(true);
    this.syncPlayer();
    // Phaser 4: startFollow without the second argument turns the camera's roundPixels off.
    this.cameras.main.startFollow(this.player, true);
  }

  /** Integer zoom large enough that the map fills the window, so the camera always has room to follow. */
  private fitZoom(): void {
    const { width, height } = this.scale;
    const fit = Math.max(width / (this.farm.width * TILE_PX), height / (this.farm.height * TILE_PX));
    // Frame roughly fifteen tiles across on desktop, so the walk and carrying poses read at play size.
    const characterZoom = Math.floor(Math.min(width / (15 * TILE_PX), height / (11 * TILE_PX)));
    this.cameras.main.setZoom(Math.max(MIN_CAMERA_ZOOM, characterZoom, Math.ceil(fit)));
  }

  private addProps(): void {
    const f = this.farm;
    const layout = this.session.farmer.layout;
    const add = (o: FarmObject, key: (n: NightState) => string | null, overlay = false) => {
      // Feet at the bottom edge of the object's tiles.
      const x = (o.rect.x + o.rect.w / 2) * TILE_PX;
      const feetY = (o.rect.y + o.rect.h) * TILE_PX;
      // A padlock sits at the centre of the gate and sorts just above it.
      const y = overlay ? feetY - TILE_PX / 2 : feetY;
      const originY = overlay ? 0.5 : 1;
      const depth = depthOf(feetY) + (overlay ? 0.1 : 0);
      const first = key(this.night) ?? 'pedestalEmpty';
      const live = this.add.image(x, y, first).setOrigin(0.5, originY).setDepth(depth);
      const ghost = this.add.image(x, y, first).setOrigin(0.5, originY).setDepth(depth).setAlpha(0.4).setVisible(false);
      const tag = this.add
        .text(x, y - live.height - 1, 'seen n1', { fontFamily: 'monospace', fontSize: '24px', color: '#d8d8c8' })
        .setScale(0.25)
        .setOrigin(0.5, 1)
        .setDepth(100001)
        .setVisible(false);
      this.props.push({ tiles: tilesOf(o), live, ghost, tag, key });
    };
    const has = (kind: string, slot: string) => layout.some((d) => d.kind === kind && d.slot === slot);
    f.lampPosts.forEach((o) => add(o, () => (has('lamp', o.id) ? 'lampPost' : 'lampPostDark')));
    f.doghouseSpots.forEach((o) => add(o, () => (has('doghouse', o.id) ? 'doghouse' : 'doghouseSpot')));
    f.pedestals.forEach((o) => add(o, (n) => (n.world.gnomes.includes(o.id) ? 'pedestal' : 'pedestalEmpty')));
    f.bushes.forEach((o) => add(o, () => 'bush'));
    f.gates.forEach((o) => {
      const gate = (n: NightState) => n.world.gates.find((g) => g.id === o.id)!;
      add(o, (n) => (gate(n).open ? 'gateOpen' : 'gate'));
      add(o, (n) => (gate(n).padlock === 'none' ? null : gate(n).padlock === 'locked' ? 'padlock' : 'padlockOpen'), true);
    });
    f.fences.forEach((o) =>
      fenceSegments(o).forEach((seg) => add(seg, (n) => (n.world.fenceGaps.some((g) => g.x === seg.rect.x && g.y === seg.rect.y) ? 'fenceGap' : 'fence'))),
    );
  }

  /** Danger is drawn on the ground (GDD 5.5, 12). Pre-T9 it shows the real state; T9 draws it from the PlayerView. */
  private drawDanger(): void {
    const g = this.dangerLayer.clear();
    this.night.danger.forEach((d, i) => {
      if (d === null) return;
      const x = (i % this.farm.width) * TILE_PX;
      const y = Math.floor(i / this.farm.width) * TILE_PX;
      g.fillStyle(DANGER_COLOUR[d], 0.35).fillRect(x, y, TILE_PX, TILE_PX);
      g.lineStyle(1, DANGER_COLOUR[d], 0.8).strokeRect(x + 0.5, y + 0.5, TILE_PX - 1, TILE_PX - 1);
    });
  }

  override update(time: number, deltaMs: number): void {
    const k = this.keys;
    if (this.phase === 'choose') {
      const pick = [k['one'], k['two'], k['three']].findIndex((key) => key !== undefined && Phaser.Input.Keyboard.JustDown(key));
      const hole = pick >= 0 ? this.farm.dogHoles[pick] : undefined;
      if (hole) this.beginNight(hole.id);
    } else if (this.phase === 'ended') {
      if (k['r'] && Phaser.Input.Keyboard.JustDown(k['r'])) this.newSessionAndChoose();
    } else {
      const down = (...names: string[]) => names.some((n) => k[n]?.isDown === true);
      const input = {
        moveX: (down('right', 'd') ? 1 : 0) - (down('left', 'a') ? 1 : 0),
        moveY: (down('down', 's') ? 1 : 0) - (down('up', 'w') ? 1 : 0),
        // A tap shorter than a frame still counts as a press (ending the night is a press).
        interact: down('e') || (k['e'] !== undefined && Phaser.Input.Keyboard.JustDown(k['e'])),
      };
      if (input.moveX === 0 && input.moveY === 0) this.walkDistancePx = 0;
      // Fixed steps; at most a quarter second per frame so a stalled tab does not jump.
      this.acc = Math.min(this.acc + deltaMs / 1000, 0.25);
      while (this.acc >= STEP_SECONDS && this.phase === 'night') {
        const previous = this.night.player;
        const r = tick(this.farm, this.night, input, STEP_SECONDS);
        this.night = r.night;
        const distancePx = Math.hypot(r.night.player.x - previous.x, r.night.player.y - previous.y) * TILE_PX;
        this.walkDistancePx = distancePx > 1e-6 ? (this.walkDistancePx + distancePx) % (WALK_FRAMES * WALK_FRAME_PX) : 0;
        this.acc -= STEP_SECONDS;
        for (const e of r.events) {
          if (e.type === 'refused') this.flash({ text: REFUSAL[e.reason], red: true }, time);
          if (e.type === 'ended') this.finish(e.end);
        }
      }
      this.syncPlayer();
    }
    this.drawPrints();
    this.drawFogAndProps();
    this.registry.set('hud', this.hudState(time));
    this.publishDebug();
  }

  private finish(end: NightEnd): void {
    this.phase = 'ended';
    this.result = endNight(this.farm, this.night);
    console.info('[gnome-heist] night result', JSON.stringify(this.result));
    if (end.reason === 'spotted') this.cameras.main.shake(250, 0.004);
  }

  private flash(text: PromptText, time: number): void {
    this.message = { text, until: time + 1500 };
  }

  private syncPlayer(): void {
    const x = this.night.player.x * TILE_PX;
    const y = this.night.player.y * TILE_PX;
    // Rows run down, left, right, up and repeat with the gnome in the player's arms.
    const { facing, carrying } = this.night;
    const directionRow = facing.x < 0 ? 1 : facing.x > 0 ? 2 : facing.y < 0 ? 3 : 0;
    const row = directionRow + (carrying === null ? 0 : 4);
    const column = this.phase === 'night' ? Math.floor(this.walkDistancePx / WALK_FRAME_PX) : 0;
    this.player.setPosition(x, y).setDepth(depthOf(y)).setFrame(row * WALK_FRAMES + column);
  }

  /** Footprints appear as you make them (GDD 12). */
  private drawPrints(): void {
    const prints = this.night.footprints;
    for (; this.printsDrawn < prints.length; this.printsDrawn++) {
      const i = prints[this.printsDrawn]!;
      const x = (i % this.farm.width) * TILE_PX;
      const y = Math.floor(i / this.farm.width) * TILE_PX;
      // A raised rim, sole and separate heel read as footsteps even on furrowed soil.
      for (const [dx, dy] of [[4, 3], [9, 7]] as const) {
        this.printsLayer.fillStyle(0x886957, 0.9).fillRect(x + dx, y + dy + 1, 3, 3);
        this.printsLayer.fillStyle(0x231d26).fillRect(x + dx, y + dy, 3, 3).fillRect(x + dx, y + dy + 4, 2, 1);
      }
    }
  }

  /**
   * Pre-T9 fog: sight from core (GDD 5.11: 5 tiles, blocked by hedges, bushes
   * and the house); explored tiles are dimmed and show faded copies of what was
   * last seen there. Before the night starts, the whole farm is dark.
   */
  private drawFogAndProps(): void {
    const { width: W, height: H } = this.farm;
    const visible = this.phase === 'choose' ? new Array<boolean>(W * H).fill(false) : visibleTiles(this.farm, tileOf(this.night.player));
    visible.forEach((v, i) => {
      if (v) this.explored[i] = 1;
    });
    this.fog.clear();
    for (let i = 0; i < W * H; i++) {
      if (visible[i]) continue;
      this.fog.fillStyle(0x05060a, this.explored[i] ? 0.6 : 1).fillRect((i % W) * TILE_PX, Math.floor(i / W) * TILE_PX, TILE_PX, TILE_PX);
    }
    for (const prop of this.props) {
      const key = prop.key(this.night);
      const seen = prop.tiles.some((t) => visible[t.y * W + t.x]);
      const known = prop.tiles.some((t) => this.explored[t.y * W + t.x]);
      if (key !== null) prop.live.setTexture(key);
      prop.live.setVisible(seen && key !== null);
      if (seen && key !== null) prop.ghost.setTexture(key);
      prop.ghost.setVisible(!seen && known && key !== null);
      prop.tag.setVisible(!seen && known && key !== null);
    }
  }

  private interaction(): Interaction | null {
    return this.phase === 'night' ? currentInteraction(this.farm, this.night) : null;
  }

  private hudState(time: number): NightHudState {
    const i = this.interaction();
    const hold = this.night.hold;
    const progress = i && hold && hold.action === i.action && hold.target === i.target && i.holdSeconds > 0 ? hold.seconds / i.holdSeconds : 0;
    if (this.message && time > this.message.until) this.message = null;
    return {
      phase: this.phase,
      night: this.night.night,
      stamina: this.night.stamina,
      maxStamina: PLAYER_STAMINA,
      carrying: this.night.carrying !== null,
      holes: this.farm.dogHoles.map((h) => h.id),
      prompt: promptText(i, this.night.carrying),
      progress,
      message: this.message?.text ?? null,
      result: this.phase === 'ended' && this.night.ended && this.result ? resultLines(this.night.ended, this.result) : null,
    };
  }

  /** Read-only snapshot for automated checks in the browser (window.__gnomeDebug). */
  private publishDebug(): void {
    const cam = this.cameras.main;
    (window as unknown as { __gnomeDebug: unknown }).__gnomeDebug = {
      mapVersion: this.farm.mapVersion,
      phase: this.phase,
      player: { ...this.night.player },
      playerFrame: this.player.frame.name,
      tile: tileOf(this.night.player),
      stamina: this.night.stamina,
      carrying: this.night.carrying,
      hold: this.night.hold,
      interaction: this.interaction(),
      ended: this.night.ended,
      world: this.night.world,
      footprints: this.night.footprints.length,
      result: this.result,
      camera: {
        zoom: cam.zoom,
        roundPixels: cam.roundPixels,
        worldView: { x: cam.worldView.x, y: cam.worldView.y, w: cam.worldView.width, h: cam.worldView.height },
      },
      depth: { player: this.player.depth },
    };
  }
}
