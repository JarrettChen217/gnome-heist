// AI-use disclosure: Codex wrote the local Anthropic adapter under Hao's direction for T11b.
import { copyFarmerContext, inSafeZone, MAX_LINE_LENGTH } from '@gnome-heist/core';
import type { DefenseKind, FarmerContext, FarmObject } from '@gnome-heist/core';
import type { ModelPolicy, Policies } from './failover.ts';
import { FARM } from './farm.ts';

export interface FarmerProviderEnv {
  readonly FARMER_PROVIDER?: string;
  readonly ANTHROPIC_API_KEY?: string;
  readonly ANTHROPIC_BASE_URL?: string;
  readonly ANTHROPIC_MODEL?: string;
  readonly ANTHROPIC_EFFORT?: string;
}

const ANTHROPIC_ORIGIN = 'https://api.anthropic.com';
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_OUTPUT_TOKENS = 512;
const SYSTEM = [
  'You are the farmer in Gnome Heist. Someone keeps sneaking onto your farm at night to steal your garden gnomes.',
  'You only know the named farm locations, your layout and budget, the traces you found, and the notes from earlier mornings. You never saw the intruder’s route. Some traces may be fake.',
  'Use at most your available stamina. Buying a lamp, doghouse, or padlock costs one coin and one stamina. Moving an owned defense to a vacant slot of the same kind or repairing an open lock or broken fence costs one stamina.',
  'Use only the listed placement slots and keep a route open to a remaining gnome. Do nothing if no action is supported by the evidence. Any inspected IDs must be traces from this morning.',
  `Your line is one short, grumpy and funny sentence of at most ${MAX_LINE_LENGTH} characters about what you observed. Do not claim to know the intruder’s route or use information outside this input.`,
].join(' ');

function namedLocations(objects: readonly FarmObject[]) {
  return objects.map(({ id, rect: { x, y, w, h } }) => ({ id, x, y, w, h }));
}

const FARM_DESCRIPTION = {
  lampPosts: namedLocations(FARM.lampPosts.filter((post) => !inSafeZone(FARM, post))),
  doghouseSpots: namedLocations(FARM.doghouseSpots.filter((spot) => !inSafeZone(FARM, spot))),
  gates: namedLocations(FARM.gates),
  fences: namedLocations(FARM.fences),
  dogHoles: namedLocations(FARM.dogHoles),
  pedestals: namedLocations(FARM.pedestals),
  areas: namedLocations(FARM.areas),
};
const SLOTS = {
  lamp: FARM_DESCRIPTION.lampPosts.map(({ id }) => id),
  doghouse: FARM_DESCRIPTION.doghouseSpots.map(({ id }) => id),
  padlock: FARM.gates.filter((gate) => !inSafeZone(FARM, gate)).map(({ id }) => id),
} satisfies Record<DefenseKind, readonly string[]>;

const stringEnum = (choices: readonly string[]) => ({ type: 'string', enum: choices });
function actionSchema(type: 'buy' | 'move' | 'repair', targets: readonly string[], destinations: readonly string[]) {
  return {
    type: 'object',
    properties: { type: stringEnum([type]), target: stringEnum(targets), to: stringEnum(destinations) },
    required: ['type', 'target', 'to'],
    additionalProperties: false,
  };
}

function planSchema(context: FarmerContext) {
  const actions: ReturnType<typeof actionSchema>[] = [];
  for (const kind of ['lamp', 'doghouse', 'padlock'] as const) {
    const slots = SLOTS[kind];
    if (slots.length === 0) continue;
    actions.push(actionSchema('buy', [kind], slots));
    const owned = context.layout.filter((defense) => defense.kind === kind).map(({ id }) => id);
    if (owned.length > 0) actions.push(actionSchema('move', owned, slots));
  }
  const repairIds = [...FARM_DESCRIPTION.fences, ...FARM_DESCRIPTION.gates].map(({ id }) => id);
  if (repairIds.length > 0) actions.push(actionSchema('repair', repairIds, ['none']));
  const traceIds = context.tracesToday.map(({ id }) => id);
  // The provider does not support maxItems or maxLength. The core validator still
  // checks the line length, budget, and all inspected IDs, including an empty trace list.
  return {
    type: 'object',
    properties: {
      actions: {
        type: 'array',
        items: { anyOf: actions },
        description: 'Use at most one action per available stamina. Use [] for no action.',
      },
      line: { type: 'string', description: `One sentence of at most ${MAX_LINE_LENGTH} characters.` },
      inspected: {
        type: 'array',
        items: traceIds.length > 0 ? stringEnum(traceIds) : { type: 'string' },
        description: traceIds.length > 0 ? 'The IDs of traces inspected this morning.' : 'No traces were found. Return [].',
      },
    },
    required: ['actions', 'line', 'inspected'],
    additionalProperties: false,
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  return undefined;
}

function tokenCount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  return undefined;
}

function logUsage(endpoint: URL, configuredModel: string, message: Record<string, unknown>) {
  const model = typeof message['model'] === 'string' ? message['model'] : configuredModel;
  const usage = asRecord(message['usage']);
  const inputTokens = tokenCount(usage?.['input_tokens']);
  const outputTokens = tokenCount(usage?.['output_tokens']);
  const cacheReadTokens = tokenCount(usage?.['cache_read_input_tokens']) ?? 0;
  const cacheCreationTokens = tokenCount(usage?.['cache_creation_input_tokens']) ?? 0;
  const basePricing = endpoint.origin === ANTHROPIC_ORIGIN && model === DEFAULT_MODEL;
  const estimatedCostUsd = basePricing && inputTokens !== undefined && outputTokens !== undefined && cacheCreationTokens === 0
    ? (2 * inputTokens + 10 * outputTokens + 0.10 * cacheReadTokens) / 1_000_000
    : null;
  return { model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, estimatedCostUsd };
}

function messagesEndpoint(baseUrl: string | undefined): URL | undefined {
  try {
    const endpoint = new URL(baseUrl?.trim() || ANTHROPIC_ORIGIN);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) return undefined;
    endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/v1/messages`;
    return endpoint;
  } catch {
    return undefined;
  }
}

/** Provider settings are bound to the local Worker. Without an explicit opt-in it uses the rule farmer. */
export function createFarmerPolicies(env: FarmerProviderEnv, log: (entry: Record<string, unknown>) => void = () => {}): Policies {
  const key = env.ANTHROPIC_API_KEY?.trim();
  const endpoint = messagesEndpoint(env.ANTHROPIC_BASE_URL);
  if (env.FARMER_PROVIDER !== 'anthropic' || !key || !endpoint) return { primary: null, secondary: null };

  const model = env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
  const effort = env.ANTHROPIC_EFFORT === 'medium' || env.ANTHROPIC_EFFORT === 'high' ? env.ANTHROPIC_EFFORT : 'low';
  const primary: ModelPolicy = async (input, signal) => {
    const context = copyFarmerContext(input);
    const started = Date.now();
    let outcome = 'network_error';
    let status: number | undefined;
    let usage: ReturnType<typeof logUsage> | undefined;
    log({ event: 'farmer_model_call_started', provider: 'anthropic', model });
    try {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: MAX_OUTPUT_TOKENS,
            system: SYSTEM,
            messages: [{ role: 'user', content: JSON.stringify({ ...context, farm: FARM_DESCRIPTION }) }],
            output_config: { effort, format: { type: 'json_schema', schema: planSchema(context) } },
            ...(model.startsWith(DEFAULT_MODEL) ? { thinking: { type: 'between_tools' } } : {}),
          }),
          signal,
          // Workerd supports manual redirects. Reject the response below without forwarding the key.
          redirect: 'manual',
        });
      } catch {
        throw new Error(signal.aborted ? 'Anthropic request aborted' : 'Anthropic network request failed');
      }
      status = response.status;
      if (!response.ok) {
        outcome = 'http_error';
        throw new Error(`Anthropic returned HTTP ${response.status}`);
      }
      outcome = 'invalid_response';
      const message = asRecord(await response.json().catch(() => undefined));
      if (message === undefined) return undefined;
      usage = logUsage(endpoint, model, message);
      if (message['stop_reason'] !== 'end_turn' || !Array.isArray(message['content'])) return undefined;
      const block = message['content'].map(asRecord).find((item) => item?.['type'] === 'text');
      if (typeof block?.['text'] !== 'string') return undefined;
      try {
        const plan: unknown = JSON.parse(block['text']);
        outcome = 'parsed';
        return plan;
      } catch {
        return undefined;
      }
    } finally {
      log({
        event: 'farmer_model_call_finished',
        provider: 'anthropic',
        model,
        ...usage,
        outcome: signal.aborted ? 'aborted' : outcome,
        status,
        ms: Date.now() - started,
      });
    }
  };
  return { primary, secondary: null };
}
