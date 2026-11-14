// AI-use disclosure: Claude (Claude Code) wrote these tests under my direction for T8.
import { describe, expect, it } from 'vitest';
import type { Interaction } from '@gnome-heist/core';
import { promptText, resultLines } from '../src/text.ts';

const base: Interaction = { action: 'pickLock', target: 'gate1', tile: { x: 0, y: 0 }, cost: 1, holdSeconds: 1, blocked: null };

describe('prompt wording', () => {
  it('shows the action and its stamina cost', () => {
    expect(promptText(base, null)).toEqual({ text: 'Hold E: pick the lock (1 stamina)', red: false });
    expect(promptText({ ...base, action: 'openGate', cost: 0 }, null)?.text).toBe('Hold E: open the gate');
  });
  it('turns red with the GDD wording when refused', () => {
    expect(promptText({ ...base, blocked: 'noStamina' }, null)).toEqual({ text: 'No stamina left', red: true });
    expect(promptText({ ...base, action: 'relock', blocked: 'selfLock' }, null)).toEqual({ text: "You'd lock yourself in", red: true });
  });
  it('mentions the gnome when leaving with one', () => {
    expect(promptText({ ...base, action: 'endNight', cost: 0 }, 'ped_sw')?.text).toBe('Press E: end the night, with the gnome');
  });
});

describe('end-of-night panel', () => {
  it('lists the traces, with footprint counts', () => {
    const lines = resultLines(
      { reason: 'exit', hole: 'hole_west' },
      { night: 1, traces: [{ id: 't1', kind: 'footprints', target: 'area_sw', count: 3 }], changes: [], gnomeTaken: 'ped_sw', spotted: false },
    );
    expect(lines[0]).toBe('You got away with a gnome (ped_sw).');
    expect(lines).toContain('  t1  footprints in area_sw x3');
    expect(lines.join('\n')).not.toContain('hole_west');
  });
});
