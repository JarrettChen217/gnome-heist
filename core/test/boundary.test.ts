// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T7).
// The dependency rule (Technical plan Section 3): core/ imports nothing from Phaser,
// the DOM, the network, or the clock. tsconfig (lib ES2023, no DOM, no Node types)
// catches DOM and Node globals; this test catches what ES2023 itself allows.

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../src/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));

const FORBIDDEN: [string, RegExp][] = [
  ['Phaser', /from\s+['"]phaser/],
  ['any package import', /from\s+['"](?!\.\.?\/)/],
  ['Node built-ins', /['"]node:/],
  ['clock: Date', /\bDate\b/],
  ['clock: performance', /\bperformance\b/],
  ['timers', /\bset(Timeout|Interval)\b/],
  ['unseeded randomness', /Math\.random/],
  ['network: fetch', /\bfetch\s*\(/],
  ['DOM: window/document access', /\b(window|document)\s*[.[]/],
];

describe('core/ dependency rule', () => {
  it('has source files to check', () => expect(files.length).toBeGreaterThan(0));
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .join('\n');
    for (const [what, re] of FORBIDDEN) {
      it(`${f}: no ${what}`, () => expect(src).not.toMatch(re));
    }
  }
});
