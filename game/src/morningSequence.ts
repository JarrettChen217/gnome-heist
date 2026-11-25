// AI-use disclosure: Codex built this presentation of the committed morning plan under Hao's direction.

import type { FarmDef, FarmerContext, FarmerState, Plan, Trace } from '@gnome-heist/core';

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

export interface MorningBeat {
  stage: 'opening' | 'waiting' | 'inspect' | 'speak' | 'think' | 'ready';
  elapsed: number;
  index: number;
  trace: Trace | null;
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
  elapsedOffset?: number;
}

const TRACE_LABEL: Record<Trace['kind'], string> = {
  footprints: 'Examines footprints',
  gate: 'Checks a gate',
  openLock: 'Checks an open padlock',
  brokenFence: 'Examines a broken fence',
  emptyPedestal: 'Checks an empty pedestal',
  sighting: 'Checks where someone was spotted',
};

export function openingBeat(context: FarmerContext, outcome: string): MorningBeat {
  return {
    stage: 'opening',
    elapsed: 0,
    index: 0,
    trace: null,
    line: '',
    caption: 'The farmer steps out and looks around.',
    stamina: context.stamina,
    money: context.money,
    outcome,
    choices: [],
  };
}

/** Build the public cues from the plan that actually committed, leaving defense destinations out. */
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
      cues.push({
        beat: { ...opening, stage: 'inspect', index, trace, caption: TRACE_LABEL[trace.kind] },
        duration: 750,
      });
    }
  }

  const speak: MorningBeat = { ...opening, stage: 'speak', line: plan.line, caption: '' };
  cues.push({ beat: speak, duration: 1300 });

  const actions = plan.actions.map((action) => {
    switch (action.type) {
      case 'buy': {
        const caption = { doghouse: 'A new doghouse went up.', lamp: 'A new lamp is burning.', padlock: 'A padlock was added.' };
        return { choice: { ...BUY, label: `Buy a ${action.target}` }, caption: caption[action.target] };
      }
      case 'move': {
        const defense = farmer.layout.find((entry) => entry.id === action.target);
        const label = defense?.kind ?? 'defense';
        return { choice: { ...MOVE, label: `Move a ${label}` }, caption: `A ${label} was moved.` };
      }
      case 'repair': {
        const fence = farm.fences.some((entry) => entry.id === action.target);
        return {
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
  cues.push({ beat: think, duration: 1650 });
  // The animation displays the exact closing budget from the committed session.
  const spent = { ...think, stamina: farmer.stamina, money: farmer.money };
  cues.push({ beat: spent, duration: 1500, elapsedOffset: 1650 });
  cues.push({
    beat: { ...spent, stage: 'ready', caption: actions.map(({ caption }) => caption).join(' ') || 'The farmer made no changes.' },
    duration: Infinity,
  });
  return cues;
}

export function cueAt(cues: readonly Cue[], elapsed: number): MorningBeat | null {
  for (const cue of cues) {
    if (elapsed < cue.duration) return { ...cue.beat, elapsed: elapsed + (cue.elapsedOffset ?? 0) };
    elapsed -= cue.duration;
  }
  return null;
}
