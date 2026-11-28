// AI-use disclosure: Codex tested the committed morning shots and captions under Hao's direction.
import { readFileSync } from 'node:fs';
import { commitPlan, loadFarm, newSession, prepareMorning, startNight, tilesOf } from '@gnome-heist/core';
import type { Plan, Trace } from '@gnome-heist/core';
import { expect, it } from 'vitest';
import { morningCues, openingBeat } from '../src/morningSequence.ts';

const farm = loadFarm(JSON.parse(readFileSync(new URL('../../maps/farm.tmj', import.meta.url), 'utf8')));

it('distinguishes selected footprints in plan order and omits uninspected evidence', () => {
  const traces: Trace[] = [
    { id: 't1', kind: 'footprints', target: 'area_se', count: 2 },
    { id: 't2', kind: 'footprints', target: 'area_sw', count: 4 },
    { id: 't3', kind: 'openLock', target: 'gate_court_east' },
  ];
  const prepared = prepareMorning(farm, newSession(farm, 1), {
    night: 1, gnomeTaken: null, changes: [], traces, spotted: false,
  });
  const context = prepared.context!;
  const cues = morningCues(farm, openingBeat(context, ''), context, {
    line: 'Boot prints again!', actions: [], inspected: ['t2', 't1'],
  }, prepared.session.farmer);
  expect(cues.filter(({ beat }) => beat.stage === 'inspect').map(({ beat }) => beat.caption)).toEqual([
    'Examines footprints in the southwest beds.',
    'Examines footprints in the southeast beds.',
  ]);
  const inspections = cues.filter(({ beat }) => beat.stage === 'inspect');
  for (const { beat } of inspections) {
    const area = farm.areas.find((area) => area.id === beat.trace?.target)!;
    expect(tilesOf(area)).toContainEqual(beat.site);
    expect(farm.ground[beat.site!.y * farm.width + beat.site!.x]).toBe('soft');
  }
  expect(cues.find(({ beat }) => beat.stage === 'think')?.beat.site).toEqual(inspections.at(-1)?.beat.site);
  expect(cues.some(({ beat }) => beat.stage === 'work')).toBe(false);
});

it('frames a real pedestal and each installed lamp in plan order', () => {
  const prepared = prepareMorning(farm, newSession(farm, 1), {
    night: 1, gnomeTaken: 'ped_sw', changes: [{ kind: 'pedestal', id: 'ped_sw', hasGnome: false }],
    traces: [{ id: 't1', kind: 'emptyPedestal', target: 'ped_sw' }], spotted: false,
  });
  const context = prepared.context!;
  const plan: Plan = {
    inspected: ['t1'], line: 'Time for better lighting.',
    actions: [{ type: 'buy', target: 'lamp', to: 'post_sw' }, { type: 'buy', target: 'lamp', to: 'post_se' }],
  };
  const { farmer } = commitPlan(farm, prepared.session, context, plan);
  const cues = morningCues(farm, openingBeat(context, ''), context, plan, farmer);
  expect(cues[0]!.beat.site).toEqual({ x: 3, y: 12 });
  const work = cues.filter(({ beat }) => beat.stage === 'work').map(({ beat }) => beat);
  expect(work.map(({ index, site, trace, work }) => ({ index, site, trace, work }))).toEqual(
    [{ x: 4, y: 14 }, { x: 19, y: 14 }].map((site, index) => ({ index, site, trace: null, work: { type: 'buy', prop: 'lamp' } })),
  );
  expect(work.map(({ stamina, money }) => [stamina, money])).toEqual([
    [context.stamina - 1, context.money - 1], [farmer.stamina, farmer.money],
  ]);
  expect(cues.at(-1)?.beat).toMatchObject({ stage: 'ready', site: { x: 19, y: 14 }, stamina: farmer.stamina, money: farmer.money });
});

it('frames a moved lamp at its new slot and clears its site for other work', () => {
  const session = newSession(farm, 1);
  const lamp = { id: 'lamp_test', kind: 'lamp', slot: 'post_sw' } as const;
  const prepared = prepareMorning(farm, {
    ...session, farmer: { ...session.farmer, layout: [...session.farmer.layout, lamp] },
  }, { night: 1, gnomeTaken: null, changes: [], traces: [], spotted: false });
  const context = prepared.context!;
  const plan: Plan = { inspected: [], line: 'I know just the spot.', actions: [
    { type: 'move', target: lamp.id, to: 'post_se' },
    { type: 'buy', target: 'doghouse', to: 'spot_ne' },
  ] };
  const committed = commitPlan(farm, prepared.session, context, plan);
  const { farmer } = committed;
  const cues = morningCues(farm, openingBeat(context, ''), context, plan, farmer);
  expect(cues.filter(({ beat }) => beat.stage === 'work').map(({ beat }) => [beat.work, beat.site])).toEqual([
    [{ type: 'move', prop: 'lamp' }, { x: 19, y: 14 }],
    [{ type: 'buy', prop: 'doghouse' }, null],
  ]);
  expect(cues.at(-1)?.beat).toMatchObject({ stage: 'ready', work: { prop: 'doghouse' }, site: null });
  const nextNight = startNight(committed, farm, 'hole_west');
  expect(nextNight.danger[14 * farm.width + 19]).toBe('lamp');
  expect(nextNight.danger[14 * farm.width + 4]).not.toBe('lamp');

  const widePlot = { ...farm, lampPosts: farm.lampPosts.map(post => post.id === 'post_se'
    ? { ...post, rect: { ...post.rect, w: 2, h: 2 } } : post) };
  const wideCues = morningCues(widePlot, openingBeat(context, ''), context, plan, farmer);
  expect(wideCues.find(({ beat }) => beat.stage === 'work')?.beat.site).toEqual({ x: 19.5, y: 15 });
});
