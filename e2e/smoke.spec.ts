// AI-use disclosure: Claude (Claude Code) wrote these tests under Hao's direction for the Playwright smoke suite.
// Browser smoke tests: the built client boots, keyboard input moves the gardener, and the first
// morning completes through the local Worker (rule farmer) or falls back to local rules.
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

test('the first morning completes through the local Worker with the rule farmer', async ({ page }) => {
  await page.goto('/?farmer=agent');
  await startNightAtWestEntrance(page);

  const morning = page.waitForResponse((r) => /\/session\/[^/]+\/morning$/.test(new URL(r.url()).pathname) && r.status() === 200);
  // Pressing E inside the dog hole ends a quiet night.
  await tap(page, 'KeyE');
  await expect.poll(async () => (await debug(page))?.phase).toBe('ended');
  await morning;

  await expect.poll(async () => (await debug(page))?.morningSource).toBe('rule');
  expect((await debug(page))?.morningPlan).not.toBeNull();
});

test('an unreachable Worker switches the morning to local rules', async ({ page }) => {
  await page.route('**/session/*/morning', (route) => route.abort('connectionrefused'));
  await page.goto('/?farmer=agent');
  await startNightAtWestEntrance(page);

  await tap(page, 'KeyE');
  await expect.poll(async () => (await debug(page))?.morningSource).toBe('offline-rule');
  expect((await debug(page))?.morningPlan).not.toBeNull();
});
