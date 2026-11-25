// AI-use disclosure: Codex tested the committed farmer inspection captions under Hao's direction.
import { readFileSync } from 'node:fs';
import { loadFarm, newSession, prepareMorning } from '@gnome-heist/core';
import type { Trace } from '@gnome-heist/core';
import { expect, it } from 'vitest';
import { morningCues, openingBeat } from '../src/morningSequence.ts';

it('distinguishes selected footprints in plan order and omits uninspected evidence', () => {
  const farm = loadFarm(JSON.parse(readFileSync(new URL('../../maps/farm.tmj', import.meta.url), 'utf8')));
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
});
