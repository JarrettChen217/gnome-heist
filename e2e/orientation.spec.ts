// AI-use disclosure: Codex wrote these keyboard-driven orientation and four-night regression tests under Hao's direction.
import { readFileSync } from 'node:fs';
import { loadFarm, tilesOf } from '@gnome-heist/core';
import { expect, test, type Page } from '@playwright/test';
import { TILE_PX } from '../game/src/constants.ts';

const farm = loadFarm(JSON.parse(readFileSync(new URL('../maps/farm.tmj', import.meta.url), 'utf8')));
const grassTiles = new Set(farm.tallGrass.flatMap(tilesOf).map(({ x, y }) => y * farm.width + x));
const vegetationTotal = farm.bushes.length + grassTiles.size;

interface Tile {
  readonly x: number;
  readonly y: number;
}

interface FieldMap {
  readonly width: number;
  readonly height: number;
  readonly visited: readonly number[];
  readonly player: Tile;
  readonly entry: Tile;
  readonly house: Tile;
}

interface OrientationState {
  readonly phase: 'choose' | 'night' | 'ended';
  readonly night: number;
  readonly entering: boolean;
  readonly entryElapsed: number | null;
  readonly entryBeat: 'estate' | 'dusk' | 'push' | 'crawl' | null;
  readonly paused: boolean;
  readonly movementHint: boolean;
  readonly footprints: number;
  readonly exploredTiles: number;
  readonly camera: {
    readonly zoom: number;
    readonly worldView: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  };
  readonly entryVisuals: {
    readonly terrainVisible: boolean;
    readonly vegetationVisible: number;
    readonly vegetationTotal: number;
    readonly sensitiveVisible: number;
    readonly sensitiveTotal: number;
    readonly dangerVisible: boolean;
    readonly fogAlpha: number;
  };
  readonly player: Tile;
  readonly playerVisible: boolean;
  readonly fieldMap: FieldMap | null;
  readonly scrollTile: Tile | null;
  readonly scrollVisible: boolean;
  readonly showScrollNote: boolean;
  readonly carrying: string | null;
  readonly interaction: { readonly action: string; readonly target: string } | null;
  readonly result: { readonly gnomeTaken: string | null; readonly traces: readonly unknown[] } | null;
  readonly world: {
    readonly gnomes: readonly string[];
    readonly gates: readonly { readonly id: string; readonly open: boolean }[];
  };
  readonly morningSource: string | null;
  readonly morningBeat: { readonly stage: string; readonly trace: { readonly id: string } | null } | null;
  readonly morningPlan: { readonly inspected: readonly string[] } | null;
  readonly banked: number;
  readonly strikes: number;
  readonly nightLimit: number;
  readonly recap: readonly string[] | null;
}

const debug = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gnomeDebug?: OrientationState }).__gnomeDebug ?? null);

const tap = (page: Page, key: string) => page.keyboard.press(key, { delay: 100 });

async function waitForControl(page: Page, timeout = 6_000): Promise<void> {
  await expect.poll(async () => (await debug(page))?.entering, { timeout, intervals: [50] }).toBe(false);
}

async function readEntryBeat(page: Page, beat: NonNullable<OrientationState['entryBeat']>, minElapsed = 0): Promise<OrientationState> {
  const frame = await page.waitForFunction(({ beat, minElapsed }) => {
    const state = (window as unknown as { __gnomeDebug?: OrientationState }).__gnomeDebug;
    return state?.entryBeat === beat && (state.entryElapsed ?? 0) >= minElapsed ? state : null;
  }, { beat, minElapsed }, { timeout: 5_000 });
  const state = await frame.jsonValue() as OrientationState;
  await frame.dispose();
  return state;
}

async function chooseEntrance(page: Page, digit: number): Promise<void> {
  await expect.poll(async () => (await debug(page))?.phase).toBe('choose');
  await tap(page, `Digit${digit}`);
  await expect.poll(async () => (await debug(page))?.phase).toBe('night');
}

// Read the published player position while the key is down so frame rates do not dictate the route.
async function walkTo(page: Page, key: string, axis: 'x' | 'y', threshold: number, direction: 1 | -1): Promise<void> {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(
      ({ axis, threshold, direction }) => {
        const state = (window as unknown as { __gnomeDebug?: OrientationState }).__gnomeDebug;
        return state !== undefined && (state.player[axis] - threshold) * direction >= 0;
      },
      { axis, threshold, direction },
      { timeout: 5_000 },
    );
  } finally {
    await page.keyboard.up(key);
  }
}

async function dig(page: Page, pedestal: string): Promise<void> {
  expect((await debug(page))?.interaction).toMatchObject({ action: 'dig', target: pedestal });
  await page.keyboard.down('KeyE');
  try {
    await expect.poll(async () => (await debug(page))?.carrying).toBe(pedestal);
  } finally {
    await page.keyboard.up('KeyE');
  }
}

const entrances = [
  { name: 'west', digit: 1, width: 1280, height: 800, entry: { x: 0, y: 10 }, scroll: { x: 1, y: 10 }, key: 'ArrowRight', axis: 'x', direction: 1 },
  { name: 'east', digit: 2, width: 390, height: 740, entry: { x: 23, y: 15 }, scroll: { x: 21, y: 15 }, key: 'ArrowLeft', axis: 'x', direction: -1 },
  { name: 'south', digit: 3, width: 1280, height: 800, entry: { x: 11, y: 17 }, scroll: { x: 11, y: 15 }, key: 'ArrowUp', axis: 'y', direction: -1 },
] as const;

test('arrow keys move the gnome and Enter confirms the focused entrance', async ({ page }) => {
  await page.goto('/');
  const west = page.getByRole('button', { name: 'West hedge' });
  const east = page.getByRole('button', { name: 'East hedge' });
  await expect(west).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('button', { name: 'South hedge' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(east).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => debug(page)).toMatchObject({ phase: 'night', player: { x: 23.5, y: 15.5 } });
  await expect(east).toBeHidden();
});

test.describe('touch entrance selector', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 740 } });
  test('tapping a row directly enters that hedge', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'South hedge' }).tap();
    await expect.poll(() => debug(page)).toMatchObject({ phase: 'night', player: { x: 11.5, y: 17.5 } });
  });
});

for (const entrance of entrances) {
  test(`the ${entrance.name} reveal frames the live farm and leaves the scroll on the ground at ${entrance.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: entrance.width, height: entrance.height });
    await page.goto('/');
    await chooseEntrance(page, entrance.digit);
    const spawn = { x: entrance.entry.x + 0.5, y: entrance.entry.y + 0.5 };
    const estate = await readEntryBeat(page, 'estate');
    const dusk = await readEntryBeat(page, 'dusk');
    const push = await readEntryBeat(page, 'push');
    const crawl = await readEntryBeat(page, 'crawl', 2_200);
    for (const frame of [estate, dusk, push, crawl]) {
      expect(frame).toMatchObject({
        entering: true, movementHint: false, player: spawn, footprints: 0, exploredTiles: 0, fieldMap: null,
      });
    }
    expect(estate.playerVisible).toBe(false);
    expect(dusk.playerVisible).toBe(false);
    expect(crawl.playerVisible).toBe(true);
    for (const frame of [estate, dusk, push]) {
      expect(frame.entryVisuals).toMatchObject({
        terrainVisible: true,
        vegetationVisible: vegetationTotal,
        vegetationTotal,
        sensitiveVisible: 0,
        dangerVisible: false,
        fogAlpha: 0,
      });
      expect(frame.entryVisuals.sensitiveTotal).toBeGreaterThan(0);
      expect(frame.scrollVisible).toBe(false);
    }
    const wide = estate.camera.worldView;
    expect(wide.x).toBeLessThanOrEqual(1);
    expect(wide.y).toBeLessThanOrEqual(1);
    expect(wide.x + wide.w).toBeGreaterThanOrEqual(farm.width * TILE_PX - 1);
    expect(wide.y + wide.h).toBeGreaterThanOrEqual(farm.height * TILE_PX - 1);
    const close = crawl.camera.worldView;
    expect(Math.abs(close.x + close.w / 2 - spawn.x * TILE_PX)).toBeLessThan(1);
    expect(Math.abs(close.y + close.h / 2 - spawn.y * TILE_PX)).toBeLessThan(1);
    expect(crawl.camera.zoom).toBeGreaterThan(estate.camera.zoom);
    await waitForControl(page);
    const playable = (await debug(page))!;
    expect(estate.camera.zoom).toBeLessThan(playable.camera.zoom);
    expect(playable).toMatchObject({
      phase: 'night',
      player: spawn,
      playerVisible: true,
      carrying: null,
      fieldMap: null,
      scrollTile: entrance.scroll,
      scrollVisible: true,
      showScrollNote: false,
      movementHint: true,
    });

    await walkTo(page, entrance.key, entrance.axis, entrance.scroll[entrance.axis] + 0.5, entrance.direction);
    const pickedUp = (await debug(page))!;
    expect(pickedUp.scrollTile).toBeNull();
    expect(pickedUp.showScrollNote).toBe(true);
    expect(pickedUp.fieldMap).toMatchObject({ entry: entrance.entry, player: entrance.scroll });
    const map = pickedUp.fieldMap!;
    expect(map.house.y).toBeLessThan(map.entry.y);
    expect(map.visited).toHaveLength(map.width * map.height);
    expect(map.visited[map.entry.y * map.width + map.entry.x]).toBe(1);
    expect(map.visited[map.player.y * map.width + map.player.x]).toBe(1);
    expect(playable.exploredTiles).toBeGreaterThan(0);
    expect(playable.exploredTiles).toBeLessThan(map.width * map.height);
    const visited = map.visited.flatMap((seen, index) => seen === 1 ? [{ x: index % map.width, y: Math.floor(index / map.width) }] : []);
    const between = (value: number, start: number, end: number) => value >= Math.min(start, end) && value <= Math.max(start, end);
    expect(visited.every((tile) => between(tile.x, entrance.entry.x, entrance.scroll.x) && between(tile.y, entrance.entry.y, entrance.scroll.y))).toBe(true);
  });
}

test('the first movement key takes over the estate overview and moves the gardener', async ({ page }) => {
  await page.goto('/');
  await chooseEntrance(page, 1);
  expect((await debug(page))?.entryBeat).toBe('estate');
  await page.keyboard.down('ArrowRight');
  try {
    await page.waitForFunction(() => {
      const state = (window as unknown as { __gnomeDebug?: OrientationState }).__gnomeDebug;
      return state?.entering === false && state.player.x >= 1;
    }, undefined, { timeout: 850 });
  } finally {
    await page.keyboard.up('ArrowRight');
  }
  expect((await debug(page))?.movementHint).toBe(false);
});

test('interact takes over the push to the entrance and ends a quiet night', async ({ page }) => {
  await page.goto('/');
  await chooseEntrance(page, 2);
  await readEntryBeat(page, 'push');
  await tap(page, 'KeyE');
  await expect.poll(() => debug(page)).toMatchObject({
    phase: 'ended', entering: false, entryBeat: null, result: { gnomeTaken: null, traces: [] },
  });
});

test('pausing an entry shot allows a clean restart with a different entrance', async ({ page }) => {
  await page.goto('/');
  await chooseEntrance(page, 1);
  expect((await debug(page))?.entering).toBe(true);
  await tap(page, 'Escape');
  await expect.poll(async () => (await debug(page))?.paused).toBe(true);
  const paused = (await debug(page))!;
  expect(paused).toMatchObject({ entering: true, footprints: 0, fieldMap: null });
  expect(paused.entryElapsed).not.toBeNull();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect((await debug(page))?.entryElapsed).toBe(paused.entryElapsed);
  await page.getByRole('button', { name: 'Restart this night' }).click();
  await expect.poll(() => debug(page)).toMatchObject({ phase: 'choose', entering: false, paused: false });

  await chooseEntrance(page, 2);
  expect((await debug(page))?.entering).toBe(true);
  await waitForControl(page);
  expect(await debug(page)).toMatchObject({
    player: { x: 23.5, y: 15.5 },
    scrollTile: { x: 21, y: 15 },
    scrollVisible: true,
  });
});

test('restart restores the scroll, then four heists and three mornings lead to a fresh replay', async ({ page }) => {
  test.setTimeout(110_000);
  await page.goto('/');
  await chooseEntrance(page, 1);
  await walkTo(page, 'ArrowRight', 'x', 1.5, 1);
  expect((await debug(page))?.fieldMap).not.toBeNull();

  await tap(page, 'Escape');
  await page.getByRole('button', { name: 'Restart this night' }).click();
  await chooseEntrance(page, 1);
  await waitForControl(page);
  expect((await debug(page))?.fieldMap).toBeNull();
  expect((await debug(page))?.scrollVisible).toBe(true);

  await walkTo(page, 'ArrowRight', 'x', 3.5, 1);
  await walkTo(page, 'ArrowDown', 'y', 11.5, 1);
  await dig(page, 'ped_sw');

  await walkTo(page, 'ArrowUp', 'y', 10.5, -1);
  await walkTo(page, 'ArrowLeft', 'x', 0.5, -1);
  const explored = (await debug(page))!.fieldMap!;
  await tap(page, 'KeyE');
  await expect.poll(async () => (await debug(page))?.morningSource).toBe('local-rule');
  expect((await debug(page))?.result?.gnomeTaken).toBe('ped_sw');
  expect((await debug(page))?.banked).toBe(1);

  await expect.poll(async () => (await debug(page))?.morningBeat?.stage, { intervals: [50] }).toBe('inspect');
  const inspected = (await debug(page))!;
  expect(inspected.morningPlan?.inspected).toContain(inspected.morningBeat?.trace?.id);
  await expect.poll(async () => (await debug(page))?.morningBeat?.stage, { timeout: 12_000 }).toBe('ready');
  await tap(page, 'Enter');
  await chooseEntrance(page, 2);
  const secondReveal = (await debug(page))!;
  expect(secondReveal).toMatchObject({ entering: true, entryBeat: 'crawl', footprints: 0, exploredTiles: 0 });
  await waitForControl(page, 1_000);
  const second = (await debug(page))!;
  expect(second.camera.zoom).toBe(secondReveal.camera.zoom);
  expect(second.night).toBe(2);
  expect(second.player).toEqual({ x: 23.5, y: 15.5 });
  expect(second.world.gnomes).not.toContain('ped_sw');
  expect(second.fieldMap?.entry).toEqual({ x: 23, y: 15 });
  expect(second.fieldMap?.visited[11 * explored.width + 3]).toBe(1);
  expect(second.scrollTile).toBeNull();
  expect(second.showScrollNote).toBe(false);

  await walkTo(page, 'ArrowLeft', 'x', 22.5, -1);
  await walkTo(page, 'ArrowUp', 'y', 10.5, -1);
  await walkTo(page, 'ArrowLeft', 'x', 20.55, -1);
  await dig(page, 'ped_se');
  await walkTo(page, 'ArrowRight', 'x', 22.5, 1);
  await walkTo(page, 'ArrowDown', 'y', 15.5, 1);
  await walkTo(page, 'ArrowRight', 'x', 23.5, 1);
  await tap(page, 'KeyE');
  await expect.poll(() => debug(page)).toMatchObject({
    phase: 'ended', result: { gnomeTaken: 'ped_se' }, banked: 2, morningSource: 'local-rule',
  });
  await expect.poll(async () => (await debug(page))?.morningBeat?.stage, { timeout: 12_000 }).toBe('ready');

  await tap(page, 'Enter');
  await chooseEntrance(page, 3);
  await waitForControl(page);
  const third = (await debug(page))!;
  expect(third).toMatchObject({ night: 3, nightLimit: 4, banked: 2, strikes: 0 });
  expect(third.world.gnomes).toEqual(expect.arrayContaining(['ped_center', 'ped_ne', 'ped_nw']));
  expect(third.world.gnomes).toHaveLength(3);
  await walkTo(page, 'ArrowUp', 'y', 7.5, -1);
  await dig(page, 'ped_center');
  await walkTo(page, 'ArrowDown', 'y', 17.5, 1);
  await tap(page, 'KeyE');
  await expect.poll(() => debug(page)).toMatchObject({
    phase: 'ended', result: { gnomeTaken: 'ped_center' }, banked: 3, morningSource: 'local-rule',
  });
  await expect.poll(async () => (await debug(page))?.morningBeat?.stage, { timeout: 12_000 }).toBe('ready');

  await tap(page, 'Enter');
  await chooseEntrance(page, 2);
  await waitForControl(page);
  const fourth = (await debug(page))!;
  expect(fourth).toMatchObject({ night: 4, banked: 3, strikes: 0 });
  expect(fourth.world.gnomes).toEqual(expect.arrayContaining(['ped_ne', 'ped_nw']));
  expect(fourth.world.gnomes).toHaveLength(2);
  await walkTo(page, 'ArrowLeft', 'x', 22.5, -1);
  await walkTo(page, 'ArrowUp', 'y', 9.5, -1);
  await walkTo(page, 'ArrowLeft', 'x', 19.5, -1);
  await walkTo(page, 'ArrowUp', 'y', 8.5, -1);
  expect((await debug(page))?.interaction).toMatchObject({ action: 'pickLock', target: 'gate_east_beds' });
  await page.keyboard.down('KeyE');
  try {
    await expect.poll(async () => (await debug(page))?.world.gates.find(({ id }) => id === 'gate_east_beds')?.open).toBe(true);
  } finally {
    await page.keyboard.up('KeyE');
  }
  await walkTo(page, 'ArrowUp', 'y', 2.5, -1);
  await dig(page, 'ped_ne');
  await walkTo(page, 'ArrowDown', 'y', 9.5, 1);
  await walkTo(page, 'ArrowRight', 'x', 22.5, 1);
  await walkTo(page, 'ArrowDown', 'y', 15.5, 1);
  await walkTo(page, 'ArrowRight', 'x', 23.5, 1);
  await tap(page, 'KeyE');
  await expect.poll(() => debug(page)).toMatchObject({
    phase: 'ended', night: 4, result: { gnomeTaken: 'ped_ne' }, banked: 4, strikes: 0,
    morningBeat: null, morningSource: null, morningPlan: null,
    recap: ['You brought a gnome home!', '', 'Four-night playtest complete', 'Gnomes banked: 4 / 4', 'Strikes: 0 / 3', 'R  ·  Play again'],
  });
  await tap(page, 'Enter');
  expect(await debug(page)).toMatchObject({ phase: 'ended', night: 4, banked: 4 });

  await tap(page, 'KeyR');
  await chooseEntrance(page, 1);
  await waitForControl(page);
  const replay = (await debug(page))!;
  expect(replay.night).toBe(1);
  expect(replay.world.gnomes).toEqual(farm.pedestals.map(({ id }) => id));
  expect(replay.banked).toBe(0);
  expect(replay.strikes).toBe(0);
  expect(replay.fieldMap).toBeNull();
  expect(replay.scrollVisible).toBe(true);
});
