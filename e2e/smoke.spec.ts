// AI-use disclosure: Claude and Codex wrote these tests under Hao's direction for the Playwright smoke suite.
// Browser smoke tests: the built client boots, keyboard input moves the gardener, and three mornings
// can complete through the local Worker or carry on after a fallback.
// Phaser draws into one canvas, so the tests read the read-only window.__gnomeDebug snapshot
// that the Night scene publishes every frame, rather than looking for sprites.
import { expect, test, type Page } from '@playwright/test';

interface GnomeDebug {
  readonly mapVersion: string;
  readonly phase: 'choose' | 'night' | 'ended';
  readonly player: { readonly x: number; readonly y: number };
  readonly night: number;
  readonly morningPlan: unknown;
  readonly morningSource: string | null;
  readonly morningBeat: {
    readonly stage: string;
    readonly line: string;
    readonly stamina: number;
    readonly money: number;
    readonly choices: readonly { readonly label: string; readonly stamina: number; readonly money: number }[];
  } | null;
  readonly layout: readonly { readonly kind: string; readonly slot: string }[];
}

const debug = (page: Page) =>
  page.evaluate(() => (window as unknown as { __gnomeDebug?: GnomeDebug }).__gnomeDebug ?? null);

/** Phaser reads keys once per frame, so a press needs to last longer than a frame to register. */
const tap = (page: Page, key: string) => page.keyboard.press(key, { delay: 100 });

async function startNightAtWestEntrance(page: Page): Promise<void> {
  await expect.poll(async () => (await debug(page))?.phase).toBe('choose');
  await tap(page, 'Digit1');
  await expect.poll(async () => (await debug(page))?.phase).toBe('night');
}

test('the client boots to entrance selection without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // The browser's automatic /favicon.ico request is a 404: the client has no favicon yet.
    if (m.type() === 'error' && !m.location().url.endsWith('/favicon.ico')) errors.push(m.text());
  });

  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect.poll(async () => (await debug(page))?.phase).toBe('choose');
  const state = await debug(page);
  expect(state?.mapVersion).toBeTruthy();
  expect(state?.night).toBe(1);
  expect(errors).toEqual([]);
});

test('holding a movement key walks the gardener', async ({ page }) => {
  await page.goto('/');
  await startNightAtWestEntrance(page);
  const before = (await debug(page))!.player;

  // From the west entrance the worn trail runs east (game/README.md).
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(800);
  await page.keyboard.up('ArrowRight');

  const after = (await debug(page))!.player;
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(0.5);
});

test('three mornings advance one Worker session and night four closes it', async ({ page }) => {
  test.setTimeout(60_000);
  const mornings = new Set<string>();
  page.on('request', (request) => {
    if (request.url().endsWith('/morning')) mornings.add(request.postDataJSON().morningId);
  });
  await page.goto('/?farmer=agent');
  let sessionPath = '';
  for (let night = 1; night <= 3; night++) {
    await startNightAtWestEntrance(page);
    expect((await debug(page))?.night).toBe(night);
    const committed = page.waitForResponse((response) => response.url().endsWith('/morning') && response.status() === 200);
    await tap(page, 'KeyE');
    const response = await committed;
    const path = new URL(response.url()).pathname.replace(/\/morning$/, '');
    if (night === 1) sessionPath = path;
    expect(path).toBe(sessionPath);
    expect(await response.json()).toMatchObject({ morningId: `night-${night}`, revision: night, actedBy: 'rule' });
    await expect.poll(async () => (await debug(page))?.morningBeat?.stage, { timeout: 12_000 }).toBe('ready');
    expect((await debug(page))?.morningSource).toBe('rule');
    await tap(page, 'Enter');
  }
  await startNightAtWestEntrance(page);
  expect((await debug(page))?.night).toBe(4);
  const finished = page.waitForResponse((response) => new URL(response.url()).pathname === `${sessionPath}/finish` && response.ok());
  await tap(page, 'KeyE');
  await finished;
  expect(await debug(page)).toMatchObject({ phase: 'ended', night: 4, morningPlan: null, morningBeat: null });
  expect([...mornings]).toEqual(['night-1', 'night-2', 'night-3']);
});

test('losing the Worker after one committed morning carries the run through local fallback', async ({ page }) => {
  test.setTimeout(55_000);
  const requested = new Set<string>();
  await page.route('**/session/*/morning', (route) => {
    const { morningId } = route.request().postDataJSON();
    requested.add(morningId);
    return morningId === 'night-1' ? route.continue() : route.abort('connectionrefused');
  });
  await page.goto('/?farmer=agent');
  for (const source of ['rule', 'offline-rule', 'offline-rule']) {
    await startNightAtWestEntrance(page);
    await tap(page, 'KeyE');
    await expect.poll(async () => (await debug(page))?.morningSource).toBe(source);
    await expect.poll(async () => (await debug(page))?.morningBeat?.stage, { timeout: 12_000 }).toBe('ready');
    expect(await debug(page)).toMatchObject({
      morningPlan: { actions: [] },
      morningBeat: { choices: [{ label: 'Do nothing', stamina: 0, money: 0 }] },
    });
    await tap(page, 'Enter');
  }
  await expect.poll(async () => (await debug(page))?.night).toBe(4);
  expect([...requested]).toEqual(['night-1', 'night-2']);
});

test('the morning waits through a pending reply and presents a legal agent purchase before night two', async ({ page }) => {
  const action = { type: 'buy', target: 'lamp', to: 'post_sw' };
  const line = 'I could use more light by the beds.';
  let attempts = 0;
  let releaseReply!: () => void;
  const reply = new Promise<void>((resolve) => { releaseReply = resolve; });
  await page.route('**/session/*/morning', async (route) => {
    const { morningId, expectedRevision, mapVersion } = route.request().postDataJSON();
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 202, json: { status: 'pending', morningId, revision: expectedRevision, mapVersion } });
      return;
    }
    await reply;
    await route.fulfill({
      json: { morningId, revision: expectedRevision + 1, mapVersion, actedBy: 'primary', plan: { actions: [action], inspected: [], line } },
    });
  });

  await page.goto('/?farmer=agent');
  await startNightAtWestEntrance(page);
  await tap(page, 'KeyE');
  try {
    await expect.poll(async () => (await debug(page))?.morningBeat?.stage).toBe('waiting');
    await expect.poll(() => attempts).toBe(2);
    await tap(page, 'Enter');
    expect(await debug(page)).toMatchObject({ phase: 'ended', night: 1, morningPlan: null });
  } finally {
    releaseReply();
  }

  await expect.poll(async () => (await debug(page))?.morningBeat?.stage, { intervals: [50] }).toBe('speak');
  const speaking = (await debug(page))!.morningBeat!;
  expect(speaking.line).toBe(line);
  await tap(page, 'Enter');
  expect((await debug(page))?.phase).toBe('ended');
  await expect.poll(async () => (await debug(page))?.morningBeat?.stage, { intervals: [50] }).toBe('work');
  expect((await debug(page))?.morningBeat).toMatchObject({
    work: { type: 'buy', prop: 'lamp' }, site: { x: 4, y: 14 }, trace: null,
  });
  await expect.poll(async () => (await debug(page))?.morningBeat?.stage, { timeout: 12_000 }).toBe('ready');
  expect(await debug(page)).toMatchObject({
    morningSource: 'primary',
    morningPlan: { actions: [action] },
    morningBeat: {
      site: { x: 4, y: 14 },
      stamina: speaking.stamina - 1,
      money: speaking.money - 1,
      choices: [{ label: 'Buy a lamp', stamina: 1, money: 1 }],
    },
  });
  await tap(page, 'Enter');
  await expect.poll(async () => (await debug(page))?.night).toBe(2);
  expect((await debug(page))?.layout).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'lamp', slot: 'post_sw' })]));
});

test('a Worker still pending at the client deadline finishes the morning through the rule fallback', async ({ page }) => {
  await page.route('**/session/*/morning', (route) => route.fulfill({ status: 202, json: { status: 'pending' } }));
  await page.goto('/?farmer=agent');
  await startNightAtWestEntrance(page);
  await tap(page, 'KeyE');
  await expect.poll(async () => (await debug(page))?.morningBeat?.stage).toBe('waiting');
  await expect.poll(async () => (await debug(page))?.morningSource, { timeout: 8_000 }).toBe('offline-rule');
  await expect.poll(async () => (await debug(page))?.morningBeat?.stage, { timeout: 8_000 }).toBe('ready');
  await tap(page, 'Enter');
  await expect.poll(async () => (await debug(page))?.night).toBe(2);
});
