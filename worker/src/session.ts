// AI-use disclosure: Claude wrote the Worker skeleton. Codex implemented the morning protocol under Hao's direction.
import { DurableObject } from 'cloudflare:workers';
import { commitPlan, newSession, NIGHTS_PER_SESSION, prepareMorning } from '@gnome-heist/core';
import type { Defense, FarmerState, NightChange, NightResult, Plan, SessionState, Tile, Trace } from '@gnome-heist/core';
import { DEFAULT_TIMING, decideMorning } from './failover.ts';
import type { ActedBy, Decision, Policies, Timing } from './failover.ts';
import { FARM, MAP_VERSION } from './farm.ts';
import { createFarmerPolicies } from './provider.ts';

/** Durable state; the pre-T10 skeleton saved only the revision and placeholder farmer. */
export interface StoredSession {
  readonly revision: number;
  readonly farmer: FarmerState;
  readonly world?: SessionState['world'];
  readonly strikes?: number;
  readonly mapVersion?: string;
  readonly expiresAt?: number;
}

export interface MorningResponse {
  readonly morningId: string;
  readonly revision: number;
  readonly mapVersion: string;
  readonly plan: Plan;
  readonly actedBy: ActedBy;
  readonly layout: readonly Defense[];
}

export interface PendingMorningResponse {
  readonly status: 'pending';
  readonly morningId: string;
  readonly revision: number;
  readonly mapVersion: string;
}

interface MorningRequest {
  readonly morningId: string;
  readonly expectedRevision: number;
  readonly mapVersion: string;
  readonly nightResult: NightResult;
}

interface PendingMorning {
  readonly request: MorningRequest;
  readonly fingerprint: string;
  readonly token: string;
  readonly started: number;
  readonly deadline: number;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TRACES = 200;
const MAX_CHANGES = FARM.gates.length + FARM.fences.length + FARM.pedestals.length;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const COMMIT_BUFFER_MS = 500;
const NO_MODELS: Policies = { primary: null, secondary: null };

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && ID_RE.test(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isSightingTile(target: string): boolean {
  const match = /^tile_(\d{1,4})_(\d{1,4})$/.exec(target);
  return match !== null && Number(match[1]) < FARM.width && Number(match[2]) < FARM.height;
}

function readTrace(value: unknown): Trace | null {
  const trace = object(value);
  if (!trace) return null;
  const { id, kind, target, count } = trace;
  if (typeof id !== 'string' || !/^t[1-9]\d{0,2}$/.test(id) || !isId(target)) return null;
  if (kind !== 'footprints' && count !== undefined) return null;
  switch (kind) {
    case 'footprints': {
      const area = FARM.areas.find((area) => area.id === target);
      if (!area) return null;
      if (count === undefined) return { id, kind, target };
      return isInteger(count) && count > 0 && count <= area.rect.w * area.rect.h ? { id, kind, target, count } : null;
    }
    case 'gate':
    case 'openLock':
      return FARM.gates.some((gate) => gate.id === target) ? { id, kind, target } : null;
    case 'brokenFence':
      return FARM.fences.some((fence) => fence.id === target) ? { id, kind, target } : null;
    case 'emptyPedestal':
      return FARM.pedestals.some((pedestal) => pedestal.id === target) ? { id, kind, target } : null;
    case 'sighting':
      return isSightingTile(target) ? { id, kind, target } : null;
    default:
      return null;
  }
}

function readChange(value: unknown): NightChange | null {
  const change = object(value);
  if (!change || !isId(change.id)) return null;
  const { id } = change;
  switch (change.kind) {
    case 'gate':
      return FARM.gates.some((gate) => gate.id === id) && typeof change.open === 'boolean'
        ? { kind: 'gate', id, open: change.open } : null;
    case 'padlock':
      return FARM.gates.some((gate) => gate.id === id) && typeof change.locked === 'boolean'
        ? { kind: 'padlock', id, locked: change.locked } : null;
    case 'pedestal':
      return FARM.pedestals.some((pedestal) => pedestal.id === id) && typeof change.hasGnome === 'boolean'
        ? { kind: 'pedestal', id, hasGnome: change.hasGnome } : null;
    case 'fence': {
      const fence = FARM.fences.find((fence) => fence.id === id);
      if (!fence || !Array.isArray(change.gaps) || change.gaps.length > fence.rect.w * fence.rect.h) return null;
      const { x, y, w, h } = fence.rect;
      const gaps: Tile[] = [];
      for (const value of change.gaps) {
        const tile = object(value);
        if (!tile || !isInteger(tile.x) || !isInteger(tile.y)
          || tile.x < x || tile.x >= x + w || tile.y < y || tile.y >= y + h
          || gaps.some((gap) => gap.x === tile.x && gap.y === tile.y)) return null;
        gaps.push({ x: tile.x, y: tile.y });
      }
      return { kind: 'fence', id, gaps };
    }
    default:
      return null;
  }
}

function parseRequest(body: unknown): MorningRequest | string {
  const request = object(body);
  if (!request) return 'body must be a JSON object';
  const { morningId, expectedRevision, mapVersion } = request;
  if (!isId(morningId)) return 'morningId must be 1 to 64 of [A-Za-z0-9_-]';
  if (!isInteger(expectedRevision) || expectedRevision < 0) return 'expectedRevision must be a nonnegative integer';
  if (typeof mapVersion !== 'string') return 'mapVersion must be a string';

  const result = object(request.nightResult);
  if (!result) return 'nightResult must be an object';
  const { night, gnomeTaken, spotted } = result;
  if (!isInteger(night) || night < 1 || night > NIGHTS_PER_SESSION) return 'nightResult.night is out of range';
  if (typeof spotted !== 'boolean') return 'nightResult.spotted must be a boolean';
  if (gnomeTaken !== null && (typeof gnomeTaken !== 'string' || !FARM.pedestals.some((pedestal) => pedestal.id === gnomeTaken))) {
    return 'nightResult.gnomeTaken must be null or a pedestal ID';
  }
  if (!Array.isArray(result.traces) || result.traces.length > MAX_TRACES) return 'nightResult.traces must be a bounded array';
  const traces: Trace[] = [];
  for (const value of result.traces) {
    const trace = readTrace(value);
    if (!trace || traces.some(({ id }) => id === trace.id)) return 'nightResult.traces contains an invalid or duplicate trace';
    traces.push(trace);
  }
  if (!Array.isArray(result.changes) || result.changes.length > MAX_CHANGES) return 'nightResult.changes must be a bounded array';
  const changes: NightChange[] = [];
  for (const value of result.changes) {
    const change = readChange(value);
    if (!change || changes.some(({ id }) => id === change.id)) return 'nightResult.changes contains an invalid or duplicate change';
    changes.push(change);
  }
  return { morningId, expectedRevision, mapVersion, nightResult: { night, gnomeTaken, spotted, traces, changes } };
}

const morningKey = (morningId: string) => `morning:${morningId}`;

function restoreSession(stored: StoredSession | undefined): SessionState {
  const initial = newSession(FARM, 1);
  if (!stored) return initial;
  if (!stored.world) return { ...initial, night: stored.revision + 1 };
  return { ...initial, night: stored.revision + 1, farmer: stored.farmer, world: stored.world, strikes: stored.strikes ?? 0 };
}

type Prepared = ReturnType<typeof prepareMorning>;
type ReadyMorning = { readonly pending: PendingMorning; readonly prepared: Prepared & { context: NonNullable<Prepared['context']> } };

/** One Durable Object owns the farmer's state and one in-flight morning per play session. */
export class FarmerSession extends DurableObject<Env> {
  private policies: Policies | undefined;
  private timing: Timing = DEFAULT_TIMING;

  /** Test hook for mock providers and short deadlines in the Workers runtime. */
  setTestOverrides(overrides: { policies?: Policies; timing?: Timing }): void {
    if (overrides.policies) this.policies = overrides.policies;
    if (overrides.timing) this.timing = overrides.timing;
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname.endsWith('/morning')) return this.morning(request);
    if (request.method === 'POST' && url.pathname.endsWith('/finish')) {
      await this.ctx.blockConcurrencyWhile(async () => {
        await this.ctx.storage.deleteAll();
        await this.ctx.storage.deleteAlarm();
      });
      return new Response(null, { status: 204 });
    }
    return json(404, { error: 'not_found' });
  }

  private async morning(request: Request): Promise<Response> {
    const started = Date.now();
    let raw: string;
    let body: unknown;
    try {
      raw = await request.text();
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: 'bad_request', detail: 'body is not JSON' });
    }
    const req = parseRequest(body);
    if (typeof req === 'string') return json(400, { error: 'bad_request', detail: req });

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const fingerprint = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const ready = await this.beginMorning(req, fingerprint, started);
    if (ready instanceof Response) return ready;

    const log = (entry: Record<string, unknown>) => this.log(req.morningId, entry);
    const policies = this.policies ?? createFarmerPolicies(this.env, log);
    const { prepared, pending } = ready;
    const decision = await decideMorning(
      prepared.context, policies, this.timing, Date.now, log, started, prepared.board,
    );
    const result = await this.commitMorning(ready, decision);
    if (result) return json(200, result);
    const committed = await this.ctx.storage.get<MorningResponse>(morningKey(pending.request.morningId));
    return committed ? json(200, committed) : json(409, { error: 'morning_interrupted' });
  }

  private async beginMorning(req: MorningRequest, fingerprint: string, started: number): Promise<ReadyMorning | Response> {
    const storage = this.ctx.storage;
    return storage.transaction(async (txn) => {
      const stored = await txn.get<StoredSession>('session');
      const existing = await txn.get<PendingMorning>('pending');
      const committed = await txn.get<MorningResponse>(morningKey(req.morningId));
      if (committed) {
        if (stored && !existing) {
          const expiresAt = Date.now() + SESSION_TTL_MS;
          await txn.put('session', { ...stored, expiresAt });
          await txn.setAlarm(expiresAt);
        }
        return json(200, committed);
      }

      if (req.mapVersion !== MAP_VERSION) {
        return json(409, { error: 'map_version_mismatch', expected: MAP_VERSION });
      }
      if (stored?.mapVersion !== undefined && stored.mapVersion !== MAP_VERSION) {
        return json(409, { error: 'session_map_version_mismatch', expected: MAP_VERSION });
      }
      const revision = stored?.revision ?? 0;
      if (req.expectedRevision !== revision) return json(409, { error: 'stale_revision', revision });
      if (existing) {
        if (existing.request.morningId !== req.morningId || existing.fingerprint !== fingerprint) {
          return json(409, { error: 'morning_conflict', revision });
        }
        return json(202, { status: 'pending', morningId: req.morningId, revision, mapVersion: MAP_VERSION } satisfies PendingMorningResponse);
      }

      const session = restoreSession(stored);
      if (req.nightResult.night !== session.night) {
        return json(409, { error: 'night_mismatch', expected: session.night });
      }
      const prepared = prepareMorning(FARM, session, req.nightResult);
      if (prepared.context === null) return json(409, { error: 'session_finished', revision });
      const deadline = started + this.timing.cutoffMs + COMMIT_BUFFER_MS;
      const pending: PendingMorning = { request: req, fingerprint, started, deadline, token: crypto.randomUUID() };
      await txn.put('pending', pending);
      await txn.setAlarm(deadline);
      return { pending, prepared: { ...prepared, context: prepared.context } };
    });
  }

  private async commitMorning(ready: ReadyMorning, decision: Decision): Promise<MorningResponse | null> {
    const { pending, prepared } = ready;
    const { request: req } = pending;
    const session = commitPlan(FARM, prepared.session, prepared.context, decision.plan);
    const result: MorningResponse = {
      morningId: req.morningId,
      revision: req.expectedRevision + 1,
      mapVersion: MAP_VERSION,
      plan: decision.plan,
      actedBy: decision.actedBy,
      layout: session.farmer.layout,
    };
    const committed = await this.ctx.storage.transaction(async (txn) => {
      const current = await txn.get<PendingMorning>('pending');
      const stored = await txn.get<StoredSession>('session');
      if (current?.token !== pending.token || (stored?.revision ?? 0) !== req.expectedRevision) return false;
      const expiresAt = Date.now() + SESSION_TTL_MS;
      await txn.put({
        session: {
          revision: result.revision, mapVersion: MAP_VERSION, farmer: session.farmer,
          strikes: session.strikes, world: session.world, expiresAt,
        } satisfies StoredSession,
        [morningKey(req.morningId)]: result,
      });
      await txn.delete('pending');
      await txn.setAlarm(expiresAt);
      return true;
    });
    if (!committed) return null;

    this.log(req.morningId, {
      event: 'morning_committed', revision: result.revision, mapVersion: result.mapVersion,
      actedBy: result.actedBy, attempts: decision.attempts, ms: Date.now() - pending.started,
      traces: req.nightResult.traces.length,
    });
    return result;
  }

  override async alarm(): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      const storage = this.ctx.storage;
      const pending = await storage.get<PendingMorning>('pending');
      const stored = await storage.get<StoredSession>('session');
      if (!pending) {
        if (stored?.expiresAt && stored.expiresAt > Date.now()) {
          await storage.setAlarm(stored.expiresAt);
        } else {
          await storage.deleteAll();
          await storage.deleteAlarm();
        }
        return;
      }
      if (pending.request.mapVersion !== MAP_VERSION || (stored?.mapVersion !== undefined && stored.mapVersion !== MAP_VERSION)) {
        await storage.deleteAll();
        await storage.deleteAlarm();
        return;
      }
      if (pending.deadline > Date.now()) {
        await storage.setAlarm(pending.deadline);
        return;
      }

      const prepared = prepareMorning(FARM, restoreSession(stored), pending.request.nightResult);
      if (prepared.context === null) {
        await storage.deleteAll();
        await storage.deleteAlarm();
        return;
      }
      const decision = await decideMorning(prepared.context, NO_MODELS, this.timing, Date.now, undefined, pending.started, prepared.board);
      this.log(pending.request.morningId, { event: 'morning_alarm_recovery' });
      await this.commitMorning({ pending, prepared: { ...prepared, context: prepared.context } }, decision);
    });
  }

  private log(morningId: string, entry: Record<string, unknown>): void {
    console.log(JSON.stringify({ ...entry, morningId, sessionId: this.ctx.id.toString() }));
  }
}
