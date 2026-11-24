// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for T8; player-facing wording for prompts and the end-of-night panel.
import type { BlockReason, Interaction, NightEnd, NightResult, Plan } from '@gnome-heist/core';

const DOING: Record<Interaction['action'], string> = {
  openGate: 'open the gate',
  closeGate: 'close the gate',
  pickLock: 'pick the lock',
  relock: 're-lock the padlock',
  kickFence: 'kick a gap in the fence',
  dig: 'dig up the gnome',
  endNight: 'end the night',
};

/** GDD 5.2 and 5.4 give the first two lines word for word. */
export const REFUSAL: Record<BlockReason, string> = {
  noStamina: 'No stamina left',
  selfLock: "You'd lock yourself in",
  handsFull: 'Your hands are full',
  inGateway: 'Step out of the gateway first',
};

export interface PromptText {
  readonly text: string;
  readonly red: boolean;
}

export function promptText(i: Interaction | null, carrying: string | null): PromptText | null {
  if (i === null) return null;
  if (i.blocked !== null) return { text: REFUSAL[i.blocked], red: true };
  const cost = i.cost > 0 ? ` (${i.cost} stamina)` : '';
  if (i.action === 'endNight') return { text: `Press E: ${DOING.endNight}${carrying ? ', with the gnome' : ''}`, red: false };
  return { text: `Hold E: ${DOING[i.action]}${cost}`, red: false };
}

const TRACE: Record<string, string> = {
  footprints: 'footprints in',
  gate: 'gate left changed:',
  openLock: 'padlock left open:',
  brokenFence: 'broken fence:',
  emptyPedestal: 'empty pedestal:',
  sighting: 'seen at',
};

/** The end-of-night panel: how it ended, then the farmer's trace list as he will read it. */
export function resultLines(end: NightEnd, result: NightResult): string[] {
  const head =
    end.reason === 'spotted'
      ? `Spotted (${end.by === 'window' ? 'the farmhouse window' : end.by === 'lamp' ? 'a lamp' : 'the dog'})! Night over.`
      : result.gnomeTaken
        ? `You got away with a gnome (${result.gnomeTaken}).`
        : 'You slipped out empty-handed.';
  const traces =
    result.traces.length === 0
      ? ['  (nothing: the farm looks untouched)']
      : result.traces.map((t) => `  ${t.id}  ${TRACE[t.kind] ?? t.kind} ${t.target}${t.count !== undefined ? ` x${t.count}` : ''}`);
  return [head, '', 'What the farmer will find in the morning:', ...traces];
}

/** Compact playtest debrief. Reveal the kind of defense, leaving its exact position to discover. */
export function playtestDebrief(end: NightEnd, result: NightResult, plan: Plan | null, pending = false): string[] {
  const outcome = end.reason === 'spotted'
    ? `Spotted by ${end.by === 'window' ? 'the farmer at the window' : end.by === 'lamp' ? 'a lamp' : 'the dog'}!`
    : result.gnomeTaken ? 'You brought a gnome home!' : 'You slipped out empty-handed.';
  if (pending) return [outcome, '', 'At daybreak', 'The farmer is checking the garden…'];
  if (!plan) return [outcome, '', 'Two-night playtest complete', 'R  ·  Play again'];

  const changes = plan.actions.map(action => {
    if (action.type === 'repair') {
      const fence = result.traces.some(trace => trace.target === action.target && trace.kind === 'brokenFence');
      return fence ? 'A fence was mended.' : 'A gate was locked again.';
    }
    if (action.type === 'buy' && action.target === 'lamp') return 'A new lamp is burning.';
    return 'A defense has changed.';
  });
  return [outcome, '', 'At daybreak', `“${plan.line}”`, ...changes, '', 'Enter  ·  Choose your next entrance'];
}
