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
}

const debug = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gnomeDebug?: OrientationState }).__gnomeDebug ?? null);

const tap = (page: Page, key: string) => page.keyboard.press(key, { delay: 100 });

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

const entrances = [
  { name: 'west', digit: 1, width: 1280, height: 800, entry: { x: 0, y: 10 }, scroll: { x: 1, y: 10 }, key: 'ArrowRight', axis: 'x', direction: 1 },
  { name: 'east', digit: 2, width: 390, height: 740, entry: { x: 23, y: 15 }, scroll: { x: 21, y: 15 }, key: 'ArrowLeft', axis: 'x', direction: -1 },
  { name: 'south', digit: 3, width: 1280, height: 800, entry: { x: 11, y: 17 }, scroll: { x: 11, y: 15 }, key: 'ArrowUp', axis: 'y', direction: -1 },
] as const;

for (const entrance of entrances) {
  test(`walking from the ${entrance.name} entrance picks up the scroll at ${entrance.width}px`, async ({ page }) => {
    await page.setViewportSize({ width: entrance.width, height: entrance.height });
    await page.goto('/');
    await chooseEntrance(page, entrance.digit);
    const before = (await debug(page))!;
    expect(before.fieldMap).toBeNull();
    expect(before.scrollTile).toEqual(entrance.scroll);
    expect(before.scrollVisible).toBe(true);

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

test('restart restores the scroll, then banking carries the explored map and empty pedestal into night two', async ({ page }) => {
  await page.goto('/');
  await chooseEntrance(page, 1);
  await walkTo(page, 'ArrowRight', 'x', 1.5, 1);
  expect((await debug(page))?.fieldMap).not.toBeNull();

  await tap(page, 'Escape');
  await page.getByRole('button', { name: 'Restart this night' }).click();
  await chooseEntrance(page, 1);
  expect((await debug(page))?.fieldMap).toBeNull();
  expect((await debug(page))?.scrollVisible).toBe(true);

  await walkTo(page, 'ArrowRight', 'x', 3.5, 1);
  await walkTo(page, 'ArrowDown', 'y', 11.5, 1);
  expect((await debug(page))?.interaction).toMatchObject({ action: 'dig', target: 'ped_sw' });
  await page.keyboard.down('KeyE');
  try {
    await expect.poll(async () => (await debug(page))?.carrying).toBe('ped_sw');
  } finally {
    await page.keyboard.up('KeyE');
  }

  await walkTo(page, 'ArrowUp', 'y', 10.5, -1);
  await walkTo(page, 'ArrowLeft', 'x', 0.5, -1);
  const explored = (await debug(page))!.fieldMap!;
  await tap(page, 'KeyE');
  await expect.poll(async () => (await debug(page))?.morningSource).toBe('local-rule');
  expect((await debug(page))?.result?.gnomeTaken).toBe('ped_sw');

  await tap(page, 'Enter');
  await chooseEntrance(page, 2);
  const second = (await debug(page))!;
  expect(second.night).toBe(2);
  expect(second.world.gnomes).not.toContain('ped_sw');
  expect(second.fieldMap?.entry).toEqual({ x: 23, y: 15 });
  expect(second.fieldMap?.visited[11 * explored.width + 3]).toBe(1);
  expect(second.scrollTile).toBeNull();
  expect(second.showScrollNote).toBe(false);

  await tap(page, 'KeyE');
  await expect.poll(async () => (await debug(page))?.phase).toBe('ended');
  await tap(page, 'KeyR');
  await chooseEntrance(page, 1);
  const replay = (await debug(page))!;
  expect(replay.night).toBe(1);
  expect(replay.world.gnomes).toContain('ped_sw');
  expect(replay.fieldMap).toBeNull();
  expect(replay.scrollVisible).toBe(true);
});
