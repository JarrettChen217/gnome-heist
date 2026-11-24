// AI-use disclosure: Codex added this provider regression test under Hao's direction. Fetch is mocked.
import type { FarmerContext, Plan } from '@gnome-heist/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFarmerPolicies } from '../src/provider.ts';

const fixture: FarmerContext = {
  tracesToday: [{ id: 't1', kind: 'footprints', target: 'area_sw', count: 4 }],
  layout: [{ id: 'my_lamp', kind: 'lamp', slot: 'post_sw' }],
  stamina: 2,
  money: 1,
  memory: [{ traces: [], actions: [], line: 'My poor garden.' }],
};
const plan: Plan = { actions: [], line: 'Somebody trampled my garden.', inspected: ['t1'] };
const configured = { FARMER_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'fake-test-key' };
const response = (content: string) => Response.json({
  model: 'claude-sonnet-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: content }],
  usage: { input_tokens: 1600, output_tokens: 130 },
});

afterEach(() => vi.restoreAllMocks());

describe('Anthropic farmer provider', () => {
  it('projections at the request boundary keep hidden fields out of identical requests', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      // Exercise Workerd's request option parsing even though the transport is mocked.
      expect(new Request(input, init).redirect).toBe('manual');
      return response(JSON.stringify(plan));
    });
    const logs: Record<string, unknown>[] = [];
    const { primary } = createFarmerPolicies(configured, (entry) => logs.push(entry));
    const signal = new AbortController().signal;
    const withHiddenFields = (value: number) => ({
      ...fixture,
      tracesToday: fixture.tracesToday.map((trace) => ({ ...trace, hiddenPosition: value })),
      layout: fixture.layout.map((defense) => ({ ...defense, hiddenTiming: value })),
      memory: fixture.memory.map((item) => ({ ...item, hiddenEntry: value })),
      hiddenPath: [value],
    });
    expect(await primary!(withHiddenFields(1), signal)).toEqual(plan);
    expect(await primary!(withHiddenFields(2), signal)).toEqual(plan);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [url, options] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe('https://api.anthropic.com/v1/messages');
    expect(options).toMatchObject({ method: 'POST', signal, redirect: 'manual' });
    expect(options?.body).toBe(fetchSpy.mock.calls[1]![1]?.body);
    const sent = JSON.parse(options?.body as string);
    const context = JSON.parse(sent.messages[0].content);
    expect(context).toMatchObject(fixture);
    expect(Object.keys(context).sort()).toEqual(['farm', 'layout', 'memory', 'money', 'stamina', 'tracesToday']);
    expect(sent).toMatchObject({
      max_tokens: 512, thinking: { type: 'between_tools' },
      output_config: { format: { type: 'json_schema', schema: {
        required: ['actions', 'line', 'inspected'],
        additionalProperties: false,
        properties: { inspected: { items: { enum: ['t1'] } } },
      } } },
    });
    expect(sent.output_config.format.schema.properties.actions.items.anyOf).toContainEqual(expect.objectContaining({
      properties: { type: { type: 'string', enum: ['move'] }, target: { type: 'string', enum: ['my_lamp'] }, to: expect.anything() },
    }));
    expect(logs[1]).toMatchObject({ outcome: 'parsed', provider: 'anthropic', inputTokens: 1600, outputTokens: 130, estimatedCostUsd: 0.0045 });
    expect(JSON.stringify(logs)).not.toContain('fake-test-key');
  });

  it.each([302, 429])('rejects HTTP %i without retrying or including provider body contents in logs', async (status) => {
    const headers = new Headers();
    if (status === 302) headers.set('location', 'https://example.invalid/redirect');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('private error body', { status, headers }));
    const logs: Record<string, unknown>[] = [];
    const { primary } = createFarmerPolicies(configured, (entry) => logs.push(entry));
    await expect(primary!(fixture, new AbortController().signal)).rejects.toThrow(`Anthropic returned HTTP ${status}`);
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(logs[1]).toMatchObject({ outcome: 'http_error', status });
    expect(JSON.stringify(logs)).not.toContain('private error body');
  });

  it('leaves credentials unused without opt-in and returns malformed model output to validation', async () => {
    expect(createFarmerPolicies({ ANTHROPIC_API_KEY: 'fake-test-key' }).primary).toBeNull();
    expect(createFarmerPolicies({ FARMER_PROVIDER: 'anthropic' }).primary).toBeNull();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response('Not JSON'));
    const { primary } = createFarmerPolicies(configured);
    expect(await primary!(fixture, new AbortController().signal)).toBeUndefined();
  });
});
