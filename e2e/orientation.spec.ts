// AI-use disclosure: Codex wrote these keyboard-driven T20 regression tests under Hao's direction.
import { expect, test, type Page } from '@playwright/test';

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
  readonly paused: boolean;
  readonly movementHint: boolean;
  readonly footprints: number;
  readonly camera: { readonly zoom: number };
  readonly player: Tile;
  readonly fieldMap: FieldMap | null;
  readonly scrollTile: Tile | null;
  readonly scrollVisible: boolean;
  readonly showScrollNote: boolean;
  readonly carrying: string | null;
  readonly interaction: { readonly action: string; readonly target: string } | null;
  readonly result: { readonly gnomeTaken: string | null } | null;
  readonly world: { readonly gnomes: readonly string[] };
  readonly morningSource: string | null;
  readonly morningBeat: { readonly stage: string; readonly trace: { readonly id: string } | null } | null;
  readonly morningPlan: { readonly inspected: readonly string[] } | null;
  readonly banked: number;
}

const debug = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gnomeDebug?: OrientationState }).__gnomeDebug ?? null);

const tap = (page: Page, key: string) => page.keyboard.press(key, { delay: 100 });

async function waitForControl(page: Page, timeout = 4_000): Promise<void> {
  await expect.poll(async () => (await debug(page))?.entering, { timeout, intervals: [50] }).toBe(false);
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
      { timeout: 3_000 },
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

for (const entrance of entrances) {
  test(`the ${entrance.name} reveal leaves the scroll on the ground at ${entrance.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: entrance.width, height: entrance.height });
    await page.goto('/');
    await chooseEntrance(page, entrance.digit);
    const reveal = (await debug(page))!;
    const spawn = { x: entrance.entry.x + 0.5, y: entrance.entry.y + 0.5 };
    expect(reveal).toMatchObject({ entering: true, movementHint: false, player: spawn, footprints: 0 });
    const midShot = await page.waitForFunction(() => {
      const state = (window as unknown as { __gnomeDebug?: OrientationState }).__gnomeDebug;
      return state?.entering && (state.entryElapsed ?? 0) >= 750 ? state : null;
    });
    expect(await midShot.jsonValue()).toMatchObject({ player: spawn, footprints: 0, fieldMap: null });
    await midShot.dispose();
    await waitForControl(page);
    const playable = (await debug(page))!;
    expect(reveal.camera.zoom).toBeGreaterThan(playable.camera.zoom);
    expect(playable).toMatchObject({
      phase: 'night',
      player: spawn,
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
    expect(map.visited[2 * map.width + 20]).toBe(0);
  });
}

test('the first movement key takes over the entry shot and moves the gardener', async ({ page }) => {
  await page.goto('/');
  await chooseEntrance(page, 1);
  expect((await debug(page))?.entering).toBe(true);
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

test('restart restores the scroll, then two entrances lead to two banked gnomes and a fresh replay', async ({ page }) => {
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
  expect(secondReveal).toMatchObject({ entering: true, footprints: 0 });
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

  await walkTo(page, 'ArrowLeft', 'x', 20.55, -1);
  await walkTo(page, 'ArrowUp', 'y', 10.5, -1);
  await dig(page, 'ped_se');
  await walkTo(page, 'ArrowDown', 'y', 15.5, 1);
  await walkTo(page, 'ArrowRight', 'x', 23.5, 1);
  await tap(page, 'KeyE');
  await expect.poll(async () => (await debug(page))?.phase).toBe('ended');
  expect(await debug(page)).toMatchObject({ result: { gnomeTaken: 'ped_se' }, banked: 2 });

  await tap(page, 'KeyR');
  await chooseEntrance(page, 1);
  await waitForControl(page);
  const replay = (await debug(page))!;
  expect(replay.night).toBe(1);
  expect(replay.world.gnomes).toContain('ped_sw');
  expect(replay.world.gnomes).toContain('ped_se');
  expect(replay.banked).toBe(0);
  expect(replay.fieldMap).toBeNull();
  expect(replay.scrollVisible).toBe(true);
});
