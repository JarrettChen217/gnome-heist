// AI-use disclosure: Codex wrote these regression checks for the browser morning protocol under Hao's direction.
import { readFileSync } from 'node:fs';
import { loadFarm, newSession } from '@gnome-heist/core';
import type { NightResult } from '@gnome-heist/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MorningClient } from '../src/morningClient.ts';

const farm = loadFarm(JSON.parse(readFileSync(new URL('../../maps/farm.tmj', import.meta.url), 'utf8')));
const night: NightResult = { night: 1, traces: [], changes: [], gnomeTaken: null, spotted: false };
const reply = {
  morningId: 'night-1', revision: 1, mapVersion: farm.mapVersion, actedBy: 'primary',
  plan: { line: 'I should check the lanterns.', actions: [], inspected: [] },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('browser morning protocol', () => {
  it('polls a pending morning with the identical request and applies the accepted plan', async () => {
    const transport = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(Response.json(reply));
    vi.stubGlobal('fetch', transport);
    const morning = await new MorningClient().advance(farm, newSession(farm, 1), night);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[1]).toEqual(transport.mock.calls[0]);
    expect(morning).toMatchObject({ actedBy: 'primary', plan: reply.plan, session: { night: 2 } });
  });

  it('ignores an otherwise valid reply after the browser deadline', async () => {
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    vi.stubGlobal('fetch', vi.fn(async () => {
      deadline.abort(new DOMException('Morning deadline', 'TimeoutError'));
      return Response.json(reply);
    }));
    await expect(new MorningClient().advance(farm, newSession(farm, 1), night))
      .rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
