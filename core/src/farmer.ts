// AI-use disclosure: Claude Code and Codex implemented the farmer context, plan validator and rule farmer under Hao's direction.

import { MAX_LINE_LENGTH } from './rules.ts';
import type {
  Defense, DefenseKind, FarmDef, FarmerContext, FarmerState, FarmObject, GateState, Plan, PlanAction,
  Trace, ValidationResult, WorldState,
} from './types.ts';
import { hasOpenRoute, inSafeZone } from './world.ts';

/** Private validation inputs. The model receives only FarmerContext and the static farm description. */
export interface MorningBoard {
  readonly farm: FarmDef;
  readonly world: WorldState;
}

function copyAction(a: PlanAction): PlanAction {
  switch (a.type) {
    case 'buy':
      return { type: 'buy', target: a.target, to: a.to };
    case 'move':
      return { type: 'move', target: a.target, to: a.to };
    case 'repair':
      return { type: 'repair', target: a.target, to: 'none' };
  }
}

function copyTrace(t: Trace): Trace {
  return t.kind === 'footprints' && typeof t.count === 'number'
    ? { id: t.id, kind: t.kind, target: t.target, count: t.count }
    : { id: t.id, kind: t.kind, target: t.target };
}

/** Field-by-field allowlist, including nested entries. Do not spread game state into the prompt. */
export function copyFarmerContext(context: FarmerContext): FarmerContext {
  return {
    tracesToday: context.tracesToday.map(copyTrace),
    layout: context.layout.map((d) => ({ id: d.id, kind: d.kind, slot: d.slot })),
    stamina: context.stamina,
    money: context.money,
    memory: context.memory.slice(-3).map((m) => ({
      traces: m.traces.map(copyTrace),
      actions: m.actions.map(copyAction),
      line: m.line,
    })),
    ...(context.eveningGates === undefined ? {} : {
      eveningGates: context.eveningGates.map((g) => ({ id: g.id, open: g.open, padlock: g.padlock })),
    }),
  };
}

export function buildFarmerContext(input: {
  farmer: FarmerState;
  tracesToday: readonly Trace[];
  eveningGates?: readonly GateState[];
}): FarmerContext {
  return copyFarmerContext({
    tracesToday: input.tracesToday,
    layout: input.farmer.layout,
    stamina: input.farmer.stamina,
    money: input.farmer.money,
    memory: input.farmer.memory,
    ...(input.eveningGates === undefined ? {} : { eveningGates: input.eveningGates }),
  });
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDefenseKind = (v: string): v is DefenseKind => v === 'lamp' || v === 'doghouse' || v === 'padlock';
const blockedDialogue = /\b(?:assholes?|bitch(?:es)?|cunts?|fuck(?:ed|ers?|ing|s)?|shits?|shitty)\b/iu;

function parseAction(value: unknown): PlanAction | null {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== 'type' && key !== 'target' && key !== 'to')) return null;
  const { type, target, to } = value;
  if (typeof target !== 'string' || target.length === 0 || typeof to !== 'string' || to.length === 0) return null;
  if (type === 'buy' && isDefenseKind(target)) return { type, target, to };
  if (type === 'move') return { type, target, to };
  if (type === 'repair' && to === 'none') return { type, target, to };
  return null;
}

export function validatePlan(context: FarmerContext, raw: unknown, board?: MorningBoard): ValidationResult {
  if (!isRecord(raw) || Object.keys(raw).some((key) => key !== 'actions' && key !== 'line' && key !== 'inspected')) {
    return { ok: false, kind: 'schema', violations: ['plan must be an object containing only actions, line and inspected'] };
  }
  const { actions, line, inspected } = raw;
  if (!Array.isArray(actions)) return { ok: false, kind: 'schema', violations: ['actions must be an array'] };
  if (typeof line !== 'string' || !line.trim() || /[\r\n\u2028\u2029]/.test(line) || line.length > MAX_LINE_LENGTH) {
    return { ok: false, kind: 'schema', violations: [`line must be one nonblank line of at most ${MAX_LINE_LENGTH} characters`] };
  }
  if (!Array.isArray(inspected) || !inspected.every((id: unknown): id is string => typeof id === 'string' && id.length > 0)) {
    return { ok: false, kind: 'schema', violations: ['inspected must be an array of ids'] };
  }
  const parsed: PlanAction[] = [];
  for (const [index, action] of actions.entries()) {
    const item = parseAction(action);
    if (item === null) return { ok: false, kind: 'schema', violations: [`actions[${index}] is not a buy, move or repair action`] };
    parsed.push(item);
  }

  const plan = { actions: parsed, line, inspected: [...inspected] };
  const traceIds = new Set(context.tracesToday.map((trace) => trace.id));
  const violations = inspected.filter((id) => !traceIds.has(id)).map((id) => `inspected "${id}" is not a trace this morning`);
  if (blockedDialogue.test(line.normalize('NFKC'))) violations.push('line contains blocked language');
  if (violations.length > 0) return { ok: false, kind: 'rules', violations };
  if (parsed.length > 0 && board === undefined) {
    return { ok: false, kind: 'rules', violations: ['action validation requires the farm and world state'] };
  }
  if (board !== undefined) {
    const result = simulatePlan(context, board, plan);
    if (!result.ok) return { ...result, kind: 'rules' };
  }
  return { ok: true, plan };
}

interface AppliedPlan {
  readonly world: WorldState;
  readonly layout: readonly Defense[];
  readonly stamina: number;
  readonly money: number;
}

type Simulation = { readonly ok: true; readonly state: AppliedPlan } | { readonly ok: false; readonly violations: readonly string[] };

function slotsFor(farm: FarmDef, kind: DefenseKind): readonly FarmObject[] {
  switch (kind) {
    case 'lamp': return farm.lampPosts;
    case 'doghouse': return farm.doghouseSpots;
    case 'padlock': return farm.gates;
  }
}

function purchaseId(layout: readonly Defense[], kind: DefenseKind, slot: string): string {
  const base = `${kind}_${slot}`;
  const existing = new Set(layout.map((defense) => defense.id));
  let id = base;
  for (let suffix = 2; existing.has(id); suffix++) id = `${base}_${suffix}`;
  return id;
}

function repair(world: WorldState, target: string): WorldState | null {
  if (world.fenceGaps.some((gap) => gap.fence === target)) {
    return { ...world, fenceGaps: world.fenceGaps.filter((gap) => gap.fence !== target) };
  }
  if (world.gates.some((gate) => gate.id === target && gate.padlock === 'open')) {
    return { ...world, gates: world.gates.map((gate) => gate.id === target ? { ...gate, open: false, padlock: 'locked' } : gate) };
  }
  return null;
}

/** Validate and apply with the same transition for local and Worker mornings. Check reachability after the whole plan. */
export function simulatePlan(context: Pick<FarmerState, 'layout' | 'stamina' | 'money'>, board: MorningBoard, plan: Plan): Simulation {
  const deny = (violation: string): Simulation => ({ ok: false, violations: [violation] });
  const { farm } = board;
  const purchases = plan.actions.filter((action) => action.type === 'buy').length;
  if (plan.actions.length > context.stamina) return deny('plan exceeds farmer stamina');
  if (purchases > context.money) return deny('plan exceeds farmer money');
  let world = board.world;
  let layout = [...context.layout];
  let addsBarrier = false;

  for (const action of plan.actions) {
    if (action.type === 'repair') {
      const fixed = repair(world, action.target);
      if (fixed === null) return deny(`"${action.target}" is not a broken fence or an open padlock`);
      world = fixed;
      addsBarrier = true;
      continue;
    }

    const owned = action.type === 'move' ? layout.find((defense) => defense.id === action.target) : undefined;
    const kind = action.type === 'buy' ? action.target : owned?.kind;
    if (kind === undefined) return deny(`"${action.target}" is not an owned defense`);
    const slot = slotsFor(farm, kind).find((candidate) => candidate.id === action.to);
    if (!slot) return deny(`"${action.to}" is not a ${kind} slot`);
    if (inSafeZone(farm, slot)) return deny(`"${slot.id}" is in an entry safe zone`);
    if (layout.some((defense) => defense.slot === slot.id)) return deny(`"${slot.id}" is already occupied`);

    if (owned) {
      layout = layout.map((defense) => defense.id === owned.id ? { ...defense, slot: slot.id } : defense);
    } else {
      layout.push({ id: purchaseId(layout, kind, slot.id), kind, slot: slot.id });
    }
    if (kind === 'padlock') {
      world = { ...world, gates: world.gates.map((gate) => {
        if (gate.id === slot.id) return { ...gate, open: false, padlock: 'locked' };
        if (gate.id === owned?.slot) return { ...gate, padlock: 'none' };
        return gate;
      }) };
      addsBarrier = true;
    }
  }

  if (addsBarrier && world.gnomes.length > 0 && !hasOpenRoute(farm, world)) {
    return deny('plan leaves no route from an entry to a remaining gnome for at most one stamina');
  }
  return {
    ok: true,
    state: { world, layout, stamina: context.stamina - plan.actions.length, money: context.money - purchases },
  };
}

export const QUIET_RULE_LINE = 'Quiet enough. I’ll keep my coin.';
/** @deprecated Use QUIET_RULE_LINE. */
export const PLACEHOLDER_RULE_LINE = QUIET_RULE_LINE;

const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

function distance(a: FarmObject, b: FarmObject): number {
  return Math.hypot(a.rect.x + a.rect.w / 2 - b.rect.x - b.rect.w / 2, a.rect.y + a.rect.h / 2 - b.rect.y - b.rect.h / 2);
}

const areaNames: Readonly<Record<string, string>> = {
  area_nw: 'the northwest beds', area_ne: 'the northeast beds', area_sw: 'the southwest beds',
  area_se: 'the southeast beds', area_court: 'the courtyard', area_lawn: 'the lawn',
};

/** Configuration A9. Choose only actions the shared validator accepts. */
export function ruleFarmer(context: FarmerContext, board?: MorningBoard): Plan {
  const actions: PlanAction[] = [];
  const inspected: string[] = [];
  let line = QUIET_RULE_LINE;
  if (!board) return { actions, inspected, line };

  const accept = (action: PlanAction): boolean => {
    if (!validatePlan(context, { actions: [...actions, action], inspected, line }, board).ok) return false;
    actions.push(action);
    return true;
  };
  const damage = context.tracesToday.filter((t) => t.kind === 'brokenFence' || t.kind === 'openLock')
    .sort((a, b) => compareId(a.target, b.target));
  const fixed = damage.find((trace) => accept({ type: 'repair', target: trace.target, to: 'none' }));
  if (fixed) {
    inspected.push(fixed.id);
    line = fixed.kind === 'brokenFence' ? 'Another boot through my fence!' : 'Someone’s been picking my locks!';
  }

  const footprints = context.tracesToday.filter((t) => t.kind === 'footprints')
    .sort((a, b) => (b.count ?? 1) - (a.count ?? 1) || compareId(a.target, b.target))[0];
  const area = board.farm.areas.find((candidate) => candidate.id === footprints?.target);
  if (area && footprints && actions.length < context.stamina) {
    const posts = board.farm.lampPosts.filter((post) => !context.layout.some((defense) => defense.slot === post.id))
      .sort((a, b) => distance(a, area) - distance(b, area) || compareId(a.id, b.id));
    const bought = context.money > 0 && posts.some((post) => accept({ type: 'buy', target: 'lamp', to: post.id }));
    if (!bought) {
      const lamps = board.farm.lampPosts.flatMap((post) => {
        const defense = context.layout.find((d) => d.kind === 'lamp' && d.slot === post.id);
        return defense ? [{ post, defense }] : [];
      });
      for (const post of posts) {
        const nearest = lamps.slice().sort((a, b) =>
          distance(a.post, post) - distance(b.post, post) || compareId(a.defense.id, b.defense.id))[0];
        if (!nearest || accept({ type: 'move', target: nearest.defense.id, to: post.id })) break;
      }
    }
    inspected.push(footprints.id);
    line = `Muddy boots in ${areaNames[area.id] ?? 'my garden'} again!`;
  }
  if (inspected.length === 0) {
    const trace = context.tracesToday[0];
    if (trace) {
      inspected.push(trace.id);
      line = trace.kind === 'emptyPedestal' ? 'One of my little fellows is missing!' : 'Something stirred last night. I’ll keep watch.';
    }
  }
  return { actions, inspected, line };
}
