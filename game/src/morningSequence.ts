// AI-use disclosure: Codex built this presentation of the committed morning plan under Hao's direction.

import { FARM_AREA_NAMES, tilesOf } from '@gnome-heist/core';
import type { DefenseKind, FarmDef, FarmerContext, FarmerState, Plan, PlanAction, Tile, Trace } from '@gnome-heist/core';

export interface MorningOption {
  readonly label: string;
  readonly stamina: number;
  readonly money: number;
}

const BUY = { label: 'Buy', stamina: 1, money: 1 };
const MOVE = { label: 'Move', stamina: 1, money: 0 };
const REPAIR = { label: 'Repair', stamina: 1, money: 0 };
const WAIT = { label: 'Do nothing', stamina: 0, money: 0 };

export const MORNING_OPENING_MS = 3000;

export interface MorningWork {
  readonly type: PlanAction['type'];
  readonly prop: DefenseKind | 'fence';
}

export const MORNING_WORK_MS = 1250;

export interface MorningBeat {
  stage: 'opening' | 'waiting' | 'inspect' | 'speak' | 'think' | 'work' | 'ready';
  elapsed: number;
  index: number;
  trace: Trace | null;
  site: Tile | null;
  work: MorningWork | null;
  line: string;
  caption: string;
  stamina: number;
  money: number;
  outcome: string;
  choices: readonly MorningOption[];
}

interface Cue {
  beat: MorningBeat;
  duration: number;
}

const TRACE_LABEL: Record<Trace['kind'], string> = {
  footprints: 'Examines footprints',
  gate: 'Checks a gate',
  openLock: 'Checks an open padlock',
  brokenFence: 'Examines a broken fence',
  emptyPedestal: 'Checks an empty pedestal',
  sighting: 'Checks where someone was spotted',
};

const TRACE_LANDMARKS: Readonly<Record<string, string>> = {
  gate_court_west: 'the west courtyard gate',
  gate_court_east: 'the east courtyard gate',
  gate_lawn_west: 'the west lawn gate',
  gate_east_beds: 'the east garden gate',
  fence_east: 'the east fence',
};

// The center-most soft tile represents a reported footprint area. No player route is available here.
function inspectionSite(farm: FarmDef, trace: Trace): Tile | null {
  if (trace.kind === 'sighting') {
    const match = /^tile_(\d+)_(\d+)$/.exec(trace.target);
    if (!match) return null;
    const x = Number(match[1]);
    const y = Number(match[2]);
    return x < farm.width && y < farm.height ? { x, y } : null;
  }
  const objects = trace.kind === 'footprints' ? farm.areas : trace.kind === 'emptyPedestal' ? farm.pedestals
    : trace.kind === 'brokenFence' ? farm.fences : farm.gates;
  const object = objects.find(({ id }) => id === trace.target);
  if (!object) return null;
  const { x, y, w, h } = object.rect;
  const cx = x + (w - 1) / 2;
  const cy = y + (h - 1) / 2;
  if (trace.kind !== 'footprints') return { x: Math.floor(cx), y: Math.floor(cy) };
  const soft = tilesOf(object).filter((tile) => farm.ground[tile.y * farm.width + tile.x] === 'soft');
  const distance = (tile: Tile) => (tile.x - cx) ** 2 + (tile.y - cy) ** 2;
  return soft.sort((a, b) => distance(a) - distance(b))[0] ?? null;
}

function inspectionCaption(farm: FarmDef, trace: Trace, site: Tile | null): string {
  const description = TRACE_LABEL[trace.kind];
  const landmark = TRACE_LANDMARKS[trace.target];
  if (landmark) {
    if (trace.kind === 'openLock') return `Checks the open padlock at ${landmark}.`;
    if (trace.kind === 'brokenFence') return `Examines the breach in ${landmark}.`;
    return `Checks ${landmark}.`;
  }

  let areaName = FARM_AREA_NAMES[trace.target];
  if (!areaName && site) {
    const area = farm.areas.find(({ rect }) => site.x >= rect.x && site.x < rect.x + rect.w && site.y >= rect.y && site.y < rect.y + rect.h);
    if (area) areaName = FARM_AREA_NAMES[area.id];
  }
  return areaName ? `${description} in ${areaName}.` : `${description}.`;
}

export function openingBeat(context: FarmerContext, outcome: string): MorningBeat {
  return {
    stage: 'opening',
    elapsed: 0,
    index: 0,
    trace: null,
    site: null,
    work: null,
    line: '',
    caption: 'The farmer opens the window and looks out.',
    stamina: context.stamina,
    money: context.money,
    outcome,
    choices: [],
  };
}

/** Build the public cues from the plan that actually committed, framing lamp work at the destination post for each action. */
export function morningCues(
  farm: FarmDef,
  opening: MorningBeat,
  context: FarmerContext,
  plan: Plan,
  farmer: FarmerState,
): Cue[] {
  const cues: Cue[] = [];
  for (const [index, id] of plan.inspected.entries()) {
    const trace = context.tracesToday.find((entry) => entry.id === id);
    if (trace) {
      const site = inspectionSite(farm, trace);
      cues.push({
        beat: { ...opening, stage: 'inspect', index, trace, site, caption: inspectionCaption(farm, trace, site) },
        duration: 1100,
      });
    }
  }

  const speak: MorningBeat = { ...(cues.at(-1)?.beat ?? opening), stage: 'speak', line: plan.line, caption: '' };
  cues.push({ beat: speak, duration: 1300 });

  const actions = plan.actions.map((action): { work: MorningWork; choice: MorningOption; caption: string } => {
    switch (action.type) {
      case 'buy': {
        const caption = { doghouse: 'A new doghouse went up.', lamp: 'A new lamp is burning.', padlock: 'A padlock was added.' };
        return { work: { type: action.type, prop: action.target }, choice: { ...BUY, label: `Buy a ${action.target}` }, caption: caption[action.target] };
      }
      case 'move': {
        const defense = farmer.layout.find((entry) => entry.id === action.target);
        if (!defense) throw new Error('Moved defense missing from committed layout');
        const label = defense.kind;
        return { work: { type: action.type, prop: label }, choice: { ...MOVE, label: `Move a ${label}` }, caption: `A ${label} was moved.` };
      }
      case 'repair': {
        const fence = farm.fences.some((entry) => entry.id === action.target);
        return {
          work: { type: action.type, prop: fence ? 'fence' : 'padlock' },
          choice: { ...REPAIR, label: fence ? 'Mend a fence' : 'Re-lock a padlock' },
          caption: fence ? 'A fence was mended.' : 'A padlock was re-locked.',
        };
      }
    }
  });

  const think: MorningBeat = {
    ...speak,
    stage: 'think',
    caption: 'The farmer weighs his options.',
    choices: actions.length ? actions.map(({ choice }) => choice) : [WAIT],
  };
  cues.push({ beat: think, duration: 1450 });
  let stamina = think.stamina;
  let money = think.money;
  for (const [index, action] of actions.entries()) {
    // A lamp may move twice in one plan. Frame this step's destination, even if the final layout differs.
    const slot = plan.actions[index]!.to;
    const post = action.work.prop === 'lamp' ? farm.lampPosts.find(({ id }) => id === slot) : undefined;
    const site = post ? { x: post.rect.x, y: post.rect.y } : null;
    stamina -= action.choice.stamina;
    money -= action.choice.money;
    cues.push({
      beat: { ...think, stamina, money, stage: 'work', index, trace: null, site, work: action.work, caption: action.choice.label },
      duration: MORNING_WORK_MS,
    });
  }
  cues.push({
    beat: { ...cues.at(-1)!.beat, stage: 'ready', stamina: farmer.stamina, money: farmer.money,
      caption: actions.map(({ caption }) => caption).join(' ') || 'The farmer made no changes.' },
    duration: Infinity,
  });
  return cues;
}

export function cueAt(cues: readonly Cue[], elapsed: number): MorningBeat | null {
  for (const cue of cues) {
    if (elapsed < cue.duration) return { ...cue.beat, elapsed };
    elapsed -= cue.duration;
  }
  return null;
}
