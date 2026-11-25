// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7) and wired in the T8 night rules. Codex sequenced the farmer’s morning from the committed plan and implemented the first-night estate sequence and entry camera handoff under Hao’s direction.
// Codex fixed rectangular fence placement under Hao's direction after the M0 review.
// Codex integrated directional player art and walk animation under Hao's direction.
// Codex implemented tall grass rendering and bush feedback under Hao's direction.
// Codex connected the local Worker morning and offline fallback under Hao's direction.
// Codex implemented the first-night scroll and remembered path under Hao's direction.
import * as Phaser from 'phaser';
import { PLAYER_STAMINA, advanceLocalMorning, bushAt, currentInteraction, endNight, loadFarm, newSession, prepareMorning, startNight, tallGrassAt, tick, tileOf, tilesOf, visibleTiles } from '@gnome-heist/core';
import type { FarmerContext, FarmDef, FarmObject, Interaction, NightEnd, NightResult, NightState, SessionState, Tile } from '@gnome-heist/core';
import { MIN_CAMERA_ZOOM, STEP_SECONDS, TILE_PX } from '../constants.ts';
import { EntryShot, ESTATE_TIMING } from '../entryShot.ts';
import { fenceSegments } from '../fence.ts';
import { MorningClient } from '../morningClient.ts';
import { cueAt, morningCues, MORNING_OPENING_MS, openingBeat } from '../morningSequence.ts';
import type { MorningBeat } from '../morningSequence.ts';
import { REFUSAL, nightOutcome, promptText } from '../text.ts';
import type { PromptText } from '../text.ts';

/** One drawn farm object. `key` gives its texture from the night state; the ghost keeps the last texture seen. */
interface Prop {
  readonly tiles: readonly Tile[];
  readonly live: Phaser.GameObjects.Image;
  readonly ghost: Phaser.GameObjects.Image;
  readonly tag: Phaser.GameObjects.Text | null;
  readonly key: (n: NightState) => string | null;
}

export type { MorningBeat } from '../morningSequence.ts';

export type Phase = 'choose' | 'night' | 'ended';
type Cover = 'none' | 'tallGrass' | 'bush';
interface FieldMap {
  width: number;
  height: number;
  visited: Uint8Array;
  player: Tile;
  entry: Tile;
  house: Tile;
}

export interface NightHudState {
  phase: Phase;
  paused: boolean;
  entering: boolean;
  showMovementHint: boolean;
  fieldMap: FieldMap | null;
  showScrollNote: boolean;
  targetScreen: { x: number; y: number } | null;
  feedback: { id: number; action: Interaction['action'] | 'bush' | 'bank' } | null;
  night: number;
  stamina: number;
  maxStamina: number;
  carrying: boolean;
  inBush: boolean;
  holes: string[];
  prompt: PromptText | null;
  /** 0..1 while E is held on an action. */
  progress: number;
  message: PromptText | null;
  result: string[] | null;
  morningBeat: MorningBeat | null;
  banked: number;
}

/** Depth from the y of an object's feet, so the player passes behind and in front of tall things. */
const depthOf = (feetYpx: number) => 10 + feetYpx;
const DANGER_COLOUR = { window: 0x8fc7ff, lamp: 0xffe27a, dog: 0xff9a4a } as const;
const WALK_FRAMES = 4;
const WALK_FRAME_PX = 6;
const FOG_DEPTH = 100000;
const GRASS_HEAD_DEPTH = FOG_DEPTH + 1;
const SEEN_TAG_DEPTH = FOG_DEPTH + 2;
// In all player frames, rows 10 or 11 through 16 show the top of the beret.
const GRASS_CROP_HEIGHT = 17;
const GRASS_TEXTURES = ['tallGrass0', 'tallGrass1', 'tallGrass2'] as const;
// Orientation landmarks for the prototype farm. Each scroll is on the inward trail.
const SCROLL_BY_ENTRY: Readonly<Partial<Record<string, Tile>>> = {
  hole_west: { x: 1, y: 10 },
  hole_east: { x: 21, y: 15 },
  hole_south: { x: 11, y: 15 },
};
const FARMHOUSE: Tile = { x: 12, y: 2 };
const SCROLL_NOTE_SECONDS = 7;
const RETURN_ENTRY_MS = 400;

interface FieldMemory {
  visited: Uint8Array;
  hasMap: boolean;
}

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
  private dangerOutline!: Phaser.GameObjects.Graphics;
  private trampledLeaves!: Phaser.GameObjects.Graphics;
  private printsLayer!: Phaser.GameObjects.Graphics;
  private props: Prop[] = [];
  private bushSprites = new Map<string, Phaser.GameObjects.Image>();
  private occupiedBush: FarmObject | undefined;
  private cover: Cover = 'none';
  private explored!: Uint8Array;
  private fieldMemory!: FieldMemory;
  private nightStartMemory!: FieldMemory;
  private scroll!: Phaser.GameObjects.Graphics;
  private scrollTile: Tile | null = null;
  private scrollNoteRemaining = 0;
  private entryTile!: Tile;
  private entryShot!: EntryShot;
  private entryCinematic: { inward: Tile; duration: number; elapsed: number } | null = null;
  private entryFacing: Tile | null = null;
  private normalZoom = MIN_CAMERA_ZOOM;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private acc = 0;
  private message: { text: PromptText; until: number } | null = null;
  private printsDrawn = 0;
  private paused = false;
  private movementLearned = false;
  private requireRelease = false;
  private feedback: NightHudState['feedback'] = null;
  private feedbackId = 0;
  private banked = 0;
  private morningBeat: MorningBeat | null = null;
  private morningCues: ReturnType<typeof morningCues> = [];
  private morningElapsed = 0;
  private morning: ReturnType<typeof advanceLocalMorning> | null = null;
  private morningClient: MorningClient | null = null;
  private morningSource: 'local-rule' | 'offline-rule' | 'primary' | 'secondary' | 'rule' | null = null;

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
    // Keep the danger border legible over tall leaves, under the fog and the exposed cap.
    // Bent stems are the visible surface of a soft-ground footprint in dense foliage.
    this.trampledLeaves = this.add.graphics().setDepth(FOG_DEPTH - 2);
    this.dangerOutline = this.add.graphics().setDepth(FOG_DEPTH - 1);
    this.printsLayer = this.add.graphics().setDepth(3);

    this.player = this.add.sprite(0, 0, 'player-art', 0).setOrigin(0.5, 1).setVisible(false);
    this.entryShot = new EntryShot(this, this.farm);
    this.scroll = this.add.graphics().setVisible(false);
    // A dark outline, rolled ends, parchment and a seal remain legible at integer zoom.
    this.scroll.fillStyle(0x262131).fillRect(-6, -5, 12, 9).fillRect(-5, -6, 10, 11);
    this.scroll.fillStyle(0xcfa979).fillRect(-5, -4, 10, 7);
    this.scroll.fillStyle(0xffe6ad).fillRect(-4, -5, 8, 2).fillRect(-4, -3, 7, 4).fillRect(-3, 2, 8, 2);
    this.scroll.fillStyle(0x974454).fillRect(0, -1, 3, 2);
    this.fog = this.add.graphics().setDepth(FOG_DEPTH);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.farm.width * TILE_PX, this.farm.height * TILE_PX);
    this.fitZoom();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitZoom, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fitZoom, this));

    const kb = this.input.keyboard;
    if (kb === null) throw new Error('keyboard input unavailable');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = Object.fromEntries(
      Object.entries({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, e: K.E, r: K.R, esc: K.ESC, enter: K.ENTER, one: K.ONE, two: K.TWO, three: K.THREE }).map(
        ([name, code]) => [name, kb.addKey(code)],
      ),
    );

    this.game.events.on('hud-resume', this.resumeNight, this);
    this.game.events.on('hud-restart', this.restartNight, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('hud-resume', this.resumeNight, this);
      this.game.events.off('hud-restart', this.restartNight, this);
      this.finishMorningClient();
    });
    this.newRun();
    this.scene.launch('Hud');
  }

  private resumeNight(): void {
    if (!this.paused) return;
    this.paused = false;
    this.requireRelease = true;
  }

  private restartNight(): void {
    if (this.paused) this.chooseEntry(this.session);
  }

  private finishMorningClient(): void {
    this.morningClient?.finish();
    this.morningClient = null;
  }

  private newRun(): void {
    this.finishMorningClient();
    const workerMode = location.protocol !== 'file:' && new URLSearchParams(location.search).get('farmer') === 'agent';
    this.morningClient = workerMode && typeof crypto.randomUUID === 'function' ? new MorningClient() : null;
    this.morningSource = null;
    this.banked = 0;
    this.nightStartMemory = { visited: new Uint8Array(this.farm.width * this.farm.height), hasMap: false };
    this.chooseEntry(newSession(this.farm, 1));
  }

  private chooseEntry(session: SessionState): void {
    this.entryCinematic = null;
    this.entryFacing = null;
    this.entryShot.clear();
    this.session = session;
    this.morning = null;
    this.morningBeat = null;
    this.morningCues = [];
    this.morningElapsed = 0;
    this.feedback = null;
    this.message = null;
    this.paused = false;
    this.requireRelease = true;
    for (const key of Object.values(this.keys)) Phaser.Input.Keyboard.JustDown(key);
    this.night = startNight(this.session, this.farm, this.farm.dogHoles[0]!.id);
    this.phase = 'choose';
    this.result = null;
    this.fieldMemory = { visited: this.nightStartMemory.visited.slice(), hasMap: this.nightStartMemory.hasMap };
    this.scrollTile = null;
    this.scroll.setVisible(false);
    this.scrollNoteRemaining = 0;
    this.explored = new Uint8Array(this.farm.width * this.farm.height);
    this.printsDrawn = 0;
    this.printsLayer.clear();
    this.trampledLeaves.clear();
    this.player.setVisible(false).setCrop();
    this.cover = 'none';
    this.occupiedBush = undefined;
    this.tweens.killTweensOf([...this.bushSprites.values()]);
    this.bushSprites.clear();
    for (const p of this.props) {
      p.live.destroy();
      p.ghost.destroy();
      p.tag?.destroy();
    }
    this.props = [];
    this.addProps();
    this.drawDanger();
    this.cameras.main.stopFollow();
    this.cameras.main.setZoom(this.normalZoom);
    this.cameras.main.centerOn((this.farm.width * TILE_PX) / 2, (this.farm.height * TILE_PX) / 2);
  }

  private beginNight(entry: string): void {
    this.night = startNight(this.session, this.farm, entry);
    this.phase = 'night';
    this.acc = 0;
    this.walkDistancePx = 0;
    this.entryTile = tileOf(this.night.player);
    const { x, y } = this.entryTile;
    const inward = x === 0 ? { x: 1, y: 0 }
      : x === this.farm.width - 1 ? { x: -1, y: 0 }
      : { x: 0, y: y === 0 ? 1 : -1 };
    this.entryFacing = inward;
    this.entryCinematic = { inward, duration: this.night.night === 1 ? ESTATE_TIMING.end : RETURN_ENTRY_MS, elapsed: 0 };
    // Clear key presses queued while the entrance picker was open.
    for (const key of Object.values(this.keys)) Phaser.Input.Keyboard.JustDown(key);
    this.requireRelease = this.keys['e']!.isDown;
    this.scrollTile = this.night.night === 1 && !this.fieldMemory.hasMap ? SCROLL_BY_ENTRY[entry] ?? null : null;
    if (this.scrollTile) {
      const x = (this.scrollTile.x + 0.5) * TILE_PX;
      const y = (this.scrollTile.y + 0.5) * TILE_PX;
      this.scroll.setPosition(x, y).setDepth(depthOf(y));
    }
    this.syncPlayer();
    // The shorter return shot keeps the gameplay zoom and framing.
    this.cameras.main.centerOn(this.player.x, this.player.y);
  }

  private completeEntryShot(): void {
    this.entryCinematic = null;
    this.entryShot.clear();
    this.cameras.main.setZoom(this.normalZoom);
    this.updateFieldMemory();
    this.syncPlayer();
    // Phaser 4: startFollow without the second argument turns roundPixels off.
    this.cameras.main.startFollow(this.player, true);
  }

  /** Integer zoom large enough that the map fills the window, so the camera always has room to follow. */
  private fitZoom(): void {
    const { width, height } = this.scale;
    const fit = Math.max(width / (this.farm.width * TILE_PX), height / (this.farm.height * TILE_PX));
    // Frame roughly fifteen tiles across on desktop, so the walk and carrying poses read at play size.
    const characterZoom = Math.floor(Math.min(width / (15 * TILE_PX), height / (11 * TILE_PX)));
    this.normalZoom = Math.max(MIN_CAMERA_ZOOM, characterZoom, Math.ceil(fit));
    const camera = this.cameras.main;
    if (!this.entryCinematic) camera.setZoom(this.normalZoom);
    else if (this.night.night > 1) {
      camera.setZoom(this.normalZoom).centerOn(this.night.player.x * TILE_PX, this.night.player.y * TILE_PX);
    }
  }

  private addProps(): void {
    const f = this.farm;
    const layout = this.session.farmer.layout;
    const add = (o: FarmObject, key: (n: NightState) => string | null, { overlay = false, showTag = true } = {}) => {
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
      const tag = showTag
        ? this.add
            .text(x, y - live.height - 1, `seen n${this.session.night}`, { fontFamily: 'monospace', fontSize: '24px', color: '#d8d8c8' })
            .setScale(0.25)
            .setOrigin(0.5, 1)
            .setDepth(SEEN_TAG_DEPTH)
            .setVisible(false)
        : null;
      this.props.push({ tiles: tilesOf(o), live, ghost, tag, key });
      return live;
    };
    const has = (kind: string, slot: string) => layout.some((d) => d.kind === kind && d.slot === slot);
    f.lampPosts.forEach((o) => add(o, () => (has('lamp', o.id) ? 'lampPost' : 'lampPostDark')));
    f.doghouseSpots.forEach((o) => add(o, () => (has('doghouse', o.id) ? 'doghouse' : 'doghouseSpot')));
    f.pedestals.forEach((o) => add(o, (n) => (n.world.gnomes.includes(o.id) ? 'pedestal' : 'pedestalEmpty')));
    f.bushes.forEach((o) => this.bushSprites.set(o.id, add(o, () => 'bush', { showTag: false })));
    const grassTiles = new Set<number>();
    for (const patch of f.tallGrass) {
      for (const tile of tilesOf(patch)) {
        const index = tile.y * f.width + tile.x;
        if (grassTiles.has(index)) continue;
        grassTiles.add(index);
        const texture = GRASS_TEXTURES[(tile.x + tile.y * 2) % GRASS_TEXTURES.length]!;
        // Each tile sorts and enters fog independently, including tiles in the same patch.
        add({ id: patch.id, rect: { ...tile, w: 1, h: 1 } }, () => texture, { showTag: false });
      }
    }
    f.gates.forEach((o) => {
      const gate = (n: NightState) => n.world.gates.find((g) => g.id === o.id)!;
      add(o, (n) => (gate(n).open ? 'gateOpen' : 'gate'));
      add(o, (n) => (gate(n).padlock === 'none' ? null : gate(n).padlock === 'locked' ? 'padlock' : 'padlockOpen'), { overlay: true });
    });
    f.fences.forEach((o) =>
      fenceSegments(o).forEach((seg) => add(seg, (n) => (n.world.fenceGaps.some((g) => g.x === seg.rect.x && g.y === seg.rect.y) ? 'fenceGap' : 'fence'))),
    );
  }

  /** Danger is drawn on the ground (GDD 5.5, 12). Pre-T9 it shows the real state; T9 draws it from the PlayerView. */
  private drawDanger(): void {
    const g = this.dangerLayer.clear();
    const outline = this.dangerOutline.clear();
    this.night.danger.forEach((d, i) => {
      if (d === null) return;
      const x = (i % this.farm.width) * TILE_PX;
      const y = Math.floor(i / this.farm.width) * TILE_PX;
      g.fillStyle(DANGER_COLOUR[d], 0.35).fillRect(x, y, TILE_PX, TILE_PX);
      outline.lineStyle(1, DANGER_COLOUR[d], 0.8).strokeRect(x + 0.5, y + 0.5, TILE_PX - 1, TILE_PX - 1);
    });
  }

  override update(time: number, deltaMs: number): void {
    const k = this.keys;
    const escape = Phaser.Input.Keyboard.JustDown(k['esc']!);
    const enter = Phaser.Input.Keyboard.JustDown(k['enter']!);
    const replay = Phaser.Input.Keyboard.JustDown(k['r']!);
    if (escape && this.phase === 'night') {
      if (this.paused) this.resumeNight();
      else {
        this.paused = true;
        this.acc = 0;
        this.night = { ...this.night, hold: null };
      }
    }
    if (this.phase === 'choose') {
      const pick = [k['one'], k['two'], k['three']].findIndex((key) => key !== undefined && Phaser.Input.Keyboard.JustDown(key));
      const hole = pick >= 0 ? this.farm.dogHoles[pick] : undefined;
      if (hole) this.beginNight(hole.id);
    } else if (this.phase === 'ended') {
      if (replay) this.newRun();
      else if (enter && this.morningBeat?.stage === 'ready' && this.morning) {
        this.nightStartMemory = this.fieldMemory;
        this.chooseEntry(this.morning.session);
      } else this.updateMorning(deltaMs);
    } else if (!this.paused) {
      this.updateNight(time, deltaMs);
    }
    const entry = this.entryCinematic;
    if (entry) this.entryShot.draw(this.player, this.entryTile, entry.inward, entry.elapsed, entry.duration, this.normalZoom);
    this.drawPrints();
    this.drawFogAndProps();
    const hud = this.hudState(time);
    this.registry.set('hud', hud);
    this.publishDebug(hud);
  }

  private updateNight(time: number, deltaMs: number): void {
    const entry = this.entryCinematic;
    const k = this.keys;
    const down = (...names: string[]) => {
      let active = false;
      for (const name of names) {
        const key = k[name]!;
        const fresh = Phaser.Input.Keyboard.JustDown(key);
        active ||= key.isDown || (entry !== null && fresh);
      }
      return active;
    };
    const pressedE = Phaser.Input.Keyboard.JustDown(k['e']!);
    const holdingE = k['e']!.isDown;
    if (!holdingE && !pressedE) this.requireRelease = false;
    const right = down('right', 'd');
    const left = down('left', 'a');
    const up = down('up', 'w');
    const downwards = down('down', 's');
    const input = {
      moveX: Number(right) - Number(left),
      moveY: Number(downwards) - Number(up),
      // A tap shorter than a frame still counts as a press (ending the night is a press).
      interact: !this.requireRelease && (holdingE || pressedE),
    };
    if (entry) {
      const interrupt = right || left || up || downwards || input.interact;
      entry.elapsed += deltaMs;
      if (!interrupt && entry.elapsed < entry.duration) return;
      this.completeEntryShot();
      // Preserve a tap and let the first movement input take effect on this frame.
      deltaMs = interrupt ? Math.max(deltaMs, STEP_SECONDS * 1000) : 0;
    }
    if (input.moveX || input.moveY) this.movementLearned = true;
    else this.walkDistancePx = 0;
    // Fixed steps; at most a quarter second per frame so a stalled tab does not jump.
    this.acc = Math.min(this.acc + deltaMs / 1000, 0.25);
    while (this.acc >= STEP_SECONDS && this.phase === 'night') {
      const previous = this.night.player;
      const r = tick(this.farm, this.night, input, STEP_SECONDS);
      this.night = r.night;
      this.scrollNoteRemaining = Math.max(0, this.scrollNoteRemaining - STEP_SECONDS);
      this.updateFieldMemory();
      const distancePx = Math.hypot(r.night.player.x - previous.x, r.night.player.y - previous.y) * TILE_PX;
      if (distancePx > 1e-6) this.entryFacing = null;
      this.walkDistancePx = distancePx > 1e-6 ? (this.walkDistancePx + distancePx) % (WALK_FRAMES * WALK_FRAME_PX) : 0;
      this.acc -= STEP_SECONDS;
      for (const e of r.events) {
        if (e.type === 'action' && e.action !== 'endNight') this.signal(e.action);
        if (e.type === 'refused') this.flash({ text: REFUSAL[e.reason], red: true }, time);
        if (e.type === 'ended') this.finish(e.end);
      }
    }
    this.syncPlayer();
  }

  private updateFieldMemory(): void {
    const tile = tileOf(this.night.player);
    this.fieldMemory.visited[tile.y * this.farm.width + tile.x] = 1;
    if (this.scrollTile?.x === tile.x && this.scrollTile.y === tile.y) {
      this.fieldMemory.hasMap = true;
      this.scrollTile = null;
      this.scrollNoteRemaining = SCROLL_NOTE_SECONDS;
    }
  }

  private finish(end: NightEnd): void {
    this.phase = 'ended';
    this.result = endNight(this.farm, this.night);
    if (this.result.gnomeTaken) {
      this.banked += 1;
      this.signal('bank');
    }
    const context = this.session.night === 1 ? prepareMorning(this.farm, this.session, this.result).context : null;
    if (context) {
      const opening = openingBeat(context, nightOutcome(end, this.result));
      this.morningBeat = opening;
      void this.resolveMorning(this.result, context, opening);
    } else this.finishMorningClient();
    console.info('[gnome-heist] night result', JSON.stringify(this.result));
    if (end.reason === 'spotted') this.cameras.main.shake(250, 0.004);
  }

  private async resolveMorning(result: NightResult, context: FarmerContext, opening: MorningBeat): Promise<void> {
    const session = this.session;
    const client = this.morningClient;
    let morning: ReturnType<typeof advanceLocalMorning>;
    if (client === null) {
      morning = advanceLocalMorning(this.farm, session, result);
      this.morningSource = 'local-rule';
    } else {
      try {
        const remote = await client.advance(this.farm, session, result);
        if (client !== this.morningClient) return;
        morning = remote;
        this.morningSource = remote.actedBy;
      } catch {
        if (client !== this.morningClient) return;
        this.finishMorningClient();
        morning = advanceLocalMorning(this.farm, session, result);
        this.morningSource = 'offline-rule';
        console.info('[gnome-heist] morning mode switched to local rules', { night: session.night });
      }
    }
    this.morning = morning;
    if (morning.plan) this.morningCues = morningCues(this.farm, opening, context, morning.plan, morning.session.farmer);
  }

  private updateMorning(deltaMs: number): void {
    const beat = this.morningBeat;
    if (!beat) return;
    if (beat.stage === 'opening') {
      const elapsed = beat.elapsed + deltaMs;
      if (elapsed < MORNING_OPENING_MS) {
        this.morningBeat = { ...beat, elapsed };
        return;
      }
      this.morningBeat = cueAt(this.morningCues, 0) ?? {
        ...beat, stage: 'waiting', elapsed: 0, caption: 'The farmer takes a moment to survey the farm.',
      };
      return;
    }
    if (beat.stage === 'waiting') {
      this.morningBeat = cueAt(this.morningCues, 0) ?? { ...beat, elapsed: beat.elapsed + deltaMs };
      return;
    }
    this.morningElapsed += deltaMs;
    this.morningBeat = cueAt(this.morningCues, this.morningElapsed);
  }

  private signal(action: NonNullable<NightHudState['feedback']>['action']): void {
    this.feedback = { id: ++this.feedbackId, action };
  }

  private flash(text: PromptText, time: number): void {
    this.message = { text, until: time + 1500 };
  }

  private syncPlayer(): void {
    const x = this.night.player.x * TILE_PX;
    const y = this.night.player.y * TILE_PX;
    // Rows run down, left, right, up and repeat with the gnome in the player's arms.
    const { carrying } = this.night;
    // Keep the shot’s pose until the player moves. Rules still use NightState.facing.
    const facing = this.entryFacing ?? this.night.facing;
    const directionRow = facing.x < 0 ? 1 : facing.x > 0 ? 2 : facing.y < 0 ? 3 : 0;
    const row = directionRow + (carrying === null ? 0 : 4);
    const column = this.phase === 'night' ? Math.floor(this.walkDistancePx / WALK_FRAME_PX) : 0;
    const tile = tileOf(this.night.player);
    const bush = bushAt(this.farm, tile);
    if (bush && bush !== this.occupiedBush) {
      this.rustleBush(bush);
      this.signal('bush');
    }
    this.occupiedBush = bush;
    this.cover = bush ? 'bush' : tallGrassAt(this.farm, tile) ? 'tallGrass' : 'none';

    this.player.setPosition(x, y).setFrame(row * WALK_FRAMES + column).setVisible(this.cover !== 'bush');
    if (this.cover === 'tallGrass') {
      // The cropped beret stays visible where rows of grass or tile fog overlap its pixels.
      this.player.setCrop(0, 0, this.player.frame.width, GRASS_CROP_HEIGHT).setDepth(GRASS_HEAD_DEPTH);
    } else {
      this.player.setCrop().setDepth(depthOf(y));
    }
  }

  private rustleBush(bush: FarmObject): void {
    const leaves = this.bushSprites.get(bush.id);
    if (leaves === undefined) return;
    const x = (bush.rect.x + bush.rect.w / 2) * TILE_PX;
    this.tweens.killTweensOf(leaves);
    leaves.setX(x);
    this.tweens.add({ targets: leaves, x: x + 1, duration: 75, ease: 'Sine.easeInOut', yoyo: true, repeat: 1 });
  }

  /** Footprints appear as you make them (GDD 12). */
  private drawPrints(): void {
    const prints = this.night.footprints;
    for (; this.printsDrawn < prints.length; this.printsDrawn++) {
      const i = prints[this.printsDrawn]!;
      const x = (i % this.farm.width) * TILE_PX;
      const y = Math.floor(i / this.farm.width) * TILE_PX;
      const tile = { x: i % this.farm.width, y: Math.floor(i / this.farm.width) };
      if (tallGrassAt(this.farm, tile) || bushAt(this.farm, tile)) {
        this.trampledLeaves.fillStyle(0x253639).fillRect(x + 3, y + 9, 5, 2).fillRect(x + 9, y + 12, 4, 2);
        this.trampledLeaves.fillStyle(0xb5a47c).fillRect(x + 3, y + 8, 3, 1).fillRect(x + 6, y + 9, 2, 1)
          .fillRect(x + 9, y + 11, 2, 1).fillRect(x + 11, y + 12, 2, 1);
        continue;
      }
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
    if (!this.entryCinematic) {
      visible.forEach((v, i) => {
        if (v) this.explored[i] = 1;
      });
    }
    this.scroll.setVisible(this.phase === 'night' && (!this.entryCinematic || this.entryBeat() === 'crawl') &&
      this.scrollTile !== null && visible[this.scrollTile.y * W + this.scrollTile.x] === true);
    this.fog.clear();
    for (let i = 0; i < W * H; i++) {
      if (visible[i]) continue;
      this.fog.fillStyle(0x05060a, this.explored[i] ? 0.6 : 1).fillRect((i % W) * TILE_PX, Math.floor(i / W) * TILE_PX, TILE_PX, TILE_PX);
    }
    for (const prop of this.props) {
      const key = prop.key(this.night);
      const seen = prop.tiles.some((t) => visible[t.y * W + t.x]);
      const known = prop.tiles.some((t) => this.explored[t.y * W + t.x]);
      if (key !== null && prop.live.texture.key !== key) prop.live.setTexture(key);
      prop.live.setVisible(seen && key !== null);
      if (seen && key !== null && prop.ghost.texture.key !== key) prop.ghost.setTexture(key);
      prop.ghost.setVisible(!seen && known && key !== null);
      prop.tag?.setVisible(!seen && known && key !== null);
    }
  }

  private interaction(): Interaction | null {
    return this.phase === 'night' && !this.entryCinematic ? currentInteraction(this.farm, this.night) : null;
  }

  private hudState(time: number): NightHudState {
    const i = this.interaction();
    const hold = this.night.hold;
    const progress = i && hold && hold.action === i.action && hold.target === i.target && i.holdSeconds > 0 ? hold.seconds / i.holdSeconds : 0;
    if (this.message && time > this.message.until) this.message = null;
    const cam = this.cameras.main;
    const result = this.night.ended && this.result && !this.morningBeat ? [
      nightOutcome(this.night.ended, this.result), '',
      'Two-night playtest complete', `Gnomes banked: ${this.banked} / 2`, 'R  ·  Play again',
    ] : null;
    return {
      paused: this.paused,
      entering: this.entryCinematic !== null,
      showMovementHint: !this.movementLearned && this.phase === 'night' && !this.paused && !this.entryCinematic,
      fieldMap: this.phase === 'night' && !this.entryCinematic && this.fieldMemory.hasMap ? {
        width: this.farm.width,
        height: this.farm.height,
        visited: this.fieldMemory.visited,
        player: tileOf(this.night.player),
        entry: this.entryTile,
        house: FARMHOUSE,
      } : null,
      showScrollNote: this.phase === 'night' && !this.paused && this.scrollNoteRemaining > 0,
      targetScreen: i ? {
        x: ((i.tile.x + 0.5) * TILE_PX - cam.worldView.x) * cam.zoom,
        y: (i.tile.y * TILE_PX - cam.worldView.y) * cam.zoom,
      } : null,
      feedback: this.feedback,
      phase: this.phase,
      night: this.night.night,
      stamina: this.night.stamina,
      maxStamina: PLAYER_STAMINA,
      carrying: this.night.carrying !== null,
      inBush: this.cover === 'bush',
      holes: this.farm.dogHoles.map((h) => h.id),
      prompt: promptText(i, this.night.carrying),
      progress,
      message: this.message?.text ?? null,
      result,
      morningBeat: this.morningBeat,
      banked: this.banked,
    };
  }

  private entryBeat(): 'estate' | 'dusk' | 'push' | 'crawl' | null {
    const shot = this.entryCinematic;
    if (!shot) return null;
    if (this.night.night > 1 || shot.elapsed >= ESTATE_TIMING.crawl) return 'crawl';
    if (shot.elapsed >= ESTATE_TIMING.push) return 'push';
    if (shot.elapsed >= ESTATE_TIMING.dusk) return 'dusk';
    return 'estate';
  }

  /** Read-only snapshot for automated checks in the browser (window.__gnomeDebug). */
  private publishDebug(hud: NightHudState): void {
    const cam = this.cameras.main;
    (window as unknown as { __gnomeDebug: unknown }).__gnomeDebug = {
      mapVersion: this.farm.mapVersion,
      phase: this.phase,
      player: { ...this.night.player },
      night: this.session.night,
      paused: this.paused,
      entering: hud.entering,
      entryElapsed: this.entryCinematic?.elapsed ?? null,
      entryBeat: this.entryBeat(),
      exploredTiles: this.explored.reduce((count, tile) => count + tile, 0),
      movementHint: hud.showMovementHint,
      fieldMap: hud.fieldMap ? {
        ...hud.fieldMap,
        visited: Array.from(hud.fieldMap.visited),
        entry: { ...hud.fieldMap.entry },
        house: { ...hud.fieldMap.house },
      } : null,
      showScrollNote: hud.showScrollNote,
      scrollTile: this.scrollTile ? { ...this.scrollTile } : null,
      scrollVisible: this.scroll.visible,
      morningBeat: hud.morningBeat,
      banked: this.banked,
      morningPlan: this.morning?.plan ?? null,
      morningSource: this.morningSource,
      layout: this.session.farmer.layout,
      playerFrame: this.player.frame.name,
      cover: this.cover,
      playerVisible: this.player.visible,
      playerCropHeight: !hud.entering && this.player.isCropped ? GRASS_CROP_HEIGHT : null,
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
