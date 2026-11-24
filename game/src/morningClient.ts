// AI-use disclosure: Codex wrote the client morning protocol under Hao's direction.
import { commitPlan, prepareMorning, validatePlan } from '@gnome-heist/core';
import type { FarmDef, NightResult, Plan, SessionState } from '@gnome-heist/core';

type ActedBy = 'primary' | 'secondary' | 'rule';

export interface RemoteMorning {
  readonly session: SessionState;
  readonly plan: Plan | null;
  readonly actedBy: ActedBy;
}

const MORNING_TIMEOUT_MS = 6000;
const PENDING_POLL_MS = 250;

/** A fresh id per run keeps the Worker revision and farmer memory independent. */
export class MorningClient {
  private readonly sessionId = crypto.randomUUID();
  private readonly active = new AbortController();
  private revision = 0;
  private started = false;

  async advance(farm: FarmDef, session: SessionState, nightResult: NightResult): Promise<RemoteMorning> {
    const prepared = prepareMorning(farm, session, nightResult);
    if (prepared.context === null) {
      this.finish();
      return { session: prepared.session, plan: null, actedBy: 'rule' };
    }

    const morningId = `night-${nightResult.night}`;
    const expectedRevision = this.revision;
    const body = JSON.stringify({ morningId, expectedRevision, mapVersion: farm.mapVersion, nightResult });
    const signal = AbortSignal.any([this.active.signal, AbortSignal.timeout(MORNING_TIMEOUT_MS)]);
    signal.throwIfAborted();
    this.started = true;
    for (;;) {
      const response = await fetch(`/session/${this.sessionId}/morning`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal,
      });
      if (response.status === 202) {
        await response.body?.cancel();
        await new Promise<void>((resolve) => setTimeout(resolve, PENDING_POLL_MS));
        signal.throwIfAborted();
        continue;
      }
      if (!response.ok) throw new Error(`Morning request returned HTTP ${response.status}`);

      const reply: unknown = await response.json();
      if (typeof reply !== 'object' || reply === null ||
        !('morningId' in reply) || reply.morningId !== morningId ||
        !('revision' in reply) || reply.revision !== expectedRevision + 1 ||
        !('mapVersion' in reply) || reply.mapVersion !== farm.mapVersion ||
        !('plan' in reply) || !('actedBy' in reply) ||
        (reply.actedBy !== 'primary' && reply.actedBy !== 'secondary' && reply.actedBy !== 'rule')) {
        throw new Error('Unexpected morning response');
      }
      signal.throwIfAborted();
      const checked = validatePlan(prepared.context, reply.plan, prepared.board);
      if (!checked.ok) throw new Error('Worker returned an invalid morning plan');
      const next = commitPlan(farm, prepared.session, prepared.context, checked.plan);
      this.revision = reply.revision;
      return { session: next, plan: checked.plan, actedBy: reply.actedBy };
    }
  }

  finish(): void {
    if (this.active.signal.aborted) return;
    this.active.abort();
    if (this.started) {
      void fetch(`/session/${this.sessionId}/finish`, { method: 'POST', keepalive: true }).catch(() => {});
    }
  }
}
