// AI-use disclosure: Claude (Claude Code) wrote this file under my direction for M0 (T11a) and added the footprint-count check in T8; it is the walking skeleton of the morning protocol in docs/architecture.md Section 4.3.
import { DurableObject } from 'cloudflare:workers';
import { FARMER_STAMINA, FARMER_START_MONEY, buildFarmerContext } from '@gnome-heist/core';
import type { FarmerState, NightResult, Plan, Trace } from '@gnome-heist/core';
import { DEFAULT_TIMING, decideMorning } from './failover.ts';
import type { ActedBy, AttemptLog, Policies, Timing } from './failover.ts';
import { MAP_VERSION } from './farm.ts';

/** The farmer's side of one play session (Technical plan Section 4.3, "Ownership"). */
export interface StoredSession {
  readonly revision: number;
  readonly farmer: FarmerState;
}

export interface MorningResponse {
  readonly morningId: string;
  readonly revision: number;
  readonly mapVersion: string;
  readonly plan: Plan;
  readonly actedBy: ActedBy;
}

interface MorningRequest {
  readonly morningId: string;
  readonly expectedRevision: number;
  readonly mapVersion: string;
  readonly nightResult: NightResult;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const initialSession = (): StoredSession => ({
  revision: 0,
  // M0: the farmer's layout and memory stay empty; commitPlan and the morning refill are T10.
  farmer: { stamina: FARMER_STAMINA, money: FARMER_START_MONEY, layout: [], memory: [] },
});

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** Generous bound for M0; the real trace list (GDD 5.6) is fixed in T8. */
const MAX_TRACES = 200;
const TRACE_KINDS: readonly Trace['kind'][] = ['footprints', 'gate', 'openLock', 'brokenFence', 'emptyPedestal', 'sighting'];

function parseRequest(body: unknown): MorningRequest | string {
  if (typeof body !== 'object' || body === null) return 'body must be a JSON object';
  const b = body as Record<string, unknown>;
  if (typeof b['morningId'] !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(b['morningId'])) return 'morningId must be 1 to 64 of [A-Za-z0-9_-]';
  if (!Number.isInteger(b['expectedRevision'])) return 'expectedRevision must be an integer';
  if (typeof b['mapVersion'] !== 'string') return 'mapVersion must be a string';
  const n = b['nightResult'];
  if (typeof n !== 'object' || n === null || !Array.isArray((n as Record<string, unknown>)['traces'])) {
    return 'nightResult.traces must be an array';
  }
  const traces = (n as Record<string, unknown>)['traces'] as unknown[];
  if (traces.length > MAX_TRACES) return `nightResult.traces has more than ${MAX_TRACES} entries`;
  for (const t of traces) {
    const r = t as Record<string, unknown> | null;
    if (typeof r !== 'object' || r === null) return 'each trace must be an object';
    if (!TRACE_KINDS.includes(r['kind'] as Trace['kind'])) return 'trace kind is not a known kind';
    if (typeof r['id'] !== 'string' || !ID_RE.test(r['id']) || typeof r['target'] !== 'string' || !ID_RE.test(r['target'])) {
      return 'trace id and target must be 1 to 64 of [A-Za-z0-9_-]';
    }
    if (r['count'] !== undefined && (r['kind'] !== 'footprints' || !Number.isInteger(r['count']) || (r['count'] as number) < 1)) {
      return 'count is a positive integer, on footprints only';
    }
  }
  return b as unknown as MorningRequest;
}

/**
 * One Durable Object per play session. M0 implements: map-version and
 * revision checks, a committed morningId returned unchanged, the failover
 * with the placeholder rule farmer, and one commit per morning. The pending
 * record, the deadline alarm, the finish notice and the 24 h clean-up are T11c.
 */
export class FarmerSession extends DurableObject<Env> {
  /** No real model in M0: with no primary configured, every morning goes straight to the rule. */
  private policies: Policies = { primary: null, secondary: null };
  private timing: Timing = DEFAULT_TIMING;

  /** Test hook (Workers-runtime tests reach it with runInDurableObject); never called by production code. */
  setTestOverrides(overrides: { policies?: Policies; timing?: Timing }): void {
    if (overrides.policies) this.policies = overrides.policies;
    if (overrides.timing) this.timing = overrides.timing;
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname.endsWith('/morning')) return this.morning(request);
    return json(404, { error: 'not_found' });
  }

  private async morning(request: Request): Promise<Response> {
    const started = Date.now();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: 'bad_request', detail: 'body is not JSON' });
    }
    const req = parseRequest(body);
    if (typeof req === 'string') return json(400, { error: 'bad_request', detail: req });

    const storage = this.ctx.storage;
    const committed = await storage.get<MorningResponse>(`morning:${req.morningId}`);
    if (committed !== undefined) return json(200, committed);

    if (req.mapVersion !== MAP_VERSION) {
      console.log(JSON.stringify({ event: 'map_version_mismatch', got: req.mapVersion, expected: MAP_VERSION }));
      return json(409, { error: 'map_version_mismatch', expected: MAP_VERSION });
    }
    const session = (await storage.get<StoredSession>('session')) ?? initialSession();
    if (req.expectedRevision !== session.revision) {
      return json(409, { error: 'stale_revision', revision: session.revision });
    }

    const context = buildFarmerContext({ farmer: session.farmer, tracesToday: req.nightResult.traces });
    const decision = await decideMorning(context, this.policies, this.timing, Date.now, (e) => console.log(JSON.stringify(e)), started);

    // The Durable Object may have served another request while the model call was awaited.
    const now = (await storage.get<StoredSession>('session')) ?? initialSession();
    if (now.revision !== req.expectedRevision) return json(409, { error: 'stale_revision', revision: now.revision });

    const result: MorningResponse = {
      morningId: req.morningId,
      revision: session.revision + 1,
      mapVersion: MAP_VERSION,
      plan: decision.plan,
      actedBy: decision.actedBy,
    };
    // One commit: the new revision and the stored result together.
    await storage.put({
      session: { ...session, revision: result.revision } satisfies StoredSession,
      [`morning:${req.morningId}`]: result,
    });
    logMorning(req, result, decision.attempts, Date.now() - started);
    return json(200, result);
  }
}

function logMorning(req: MorningRequest, result: MorningResponse, attempts: readonly AttemptLog[], ms: number): void {
  console.log(
    JSON.stringify({
      event: 'morning_committed',
      morningId: req.morningId,
      revision: result.revision,
      mapVersion: result.mapVersion,
      actedBy: result.actedBy,
      attempts,
      ms,
      traces: req.nightResult.traces.length,
    }),
  );
}
