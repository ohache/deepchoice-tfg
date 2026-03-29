import type { ID, VarDef } from "@/domain/types";
import { type Condition, BOOL_OPS, NUMBER_OPS } from "@/domain/conditions";
import type { Option } from "@/components/Select";
import type { ProjectIndex } from "@/features/editor/scene/rules/conditions/conditionProjectIndex";

type LeafByType<T extends Condition["type"]> = Extract<Condition, { type: T }>;

export type EnabledLeafCondition =
  | LeafByType<"nodeVisited">
  | LeafByType<"hasItem">
  | LeafByType<"playerVar">
  | LeafByType<"npcVar">
  | LeafByType<"hotspotVar">
  | LeafByType<"hotspotVisible">
  | LeafByType<"hotspotReachable">
  | LeafByType<"placedItemVisible">
  | LeafByType<"placedItemReachable">
  | LeafByType<"placedNpcVisible">
  | LeafByType<"placedNpcReachable">
  | LeafByType<"placedPlayerVisible">
  | LeafByType<"mapRegionVisited">;

export type EnabledLeafType = EnabledLeafCondition["type"];

export type ConditionFamilyId =
  | "progress"
  | "item"
  | "hotspot"
  | "npc"
  | "player";

export type LeafCtx = { idx: ProjectIndex; currentNodeId?: ID };

type LeafFieldControl =
  | "id-select"
  | "text"
  | "bool"
  | "number"
  | "op-select"
  | "var-op-select"
  | "var-value";

export type LeafFieldSpec = {
  key: string;
  label: string;
  path: keyof EnabledLeafCondition | string;
  control: LeafFieldControl;
  className?: string;
  optionsSource?: "items" | "nodes" | "maps" | "players" | "npcs" | "hotspots" | "placedPlayers";
  optionsResolver?: (ctx: LeafCtx, cond: EnabledLeafCondition) => Option<ID>[];
  disabledWhen?: (cond: EnabledLeafCondition) => boolean;
  visibleWhen?: (ctx: LeafCtx, cond: EnabledLeafCondition) => boolean;
};

export type LeafUiSpec = {
  layoutClassName?: string;
  fields: LeafFieldSpec[];
};

export type LeafVarKind = "boolean" | "number" | "unknown";

export type ConditionFamilySpec = {
  id: ConditionFamilyId;
  label: string;
  leafTypes: EnabledLeafType[];
};

const CONDITION_FAMILIES: ConditionFamilySpec[] = [
  { id: "progress", label: "Progreso", leafTypes: ["nodeVisited", "mapRegionVisited"] },
  { id: "item", label: "Item", leafTypes: ["hasItem", "placedItemVisible", "placedItemReachable"] },
  { id: "hotspot", label: "Hotspot", leafTypes: ["hotspotVisible", "hotspotReachable", "hotspotVar"] },
  { id: "npc", label: "NPC", leafTypes: ["placedNpcVisible", "placedNpcReachable", "npcVar"] },
  { id: "player", label: "Player", leafTypes: ["placedPlayerVisible", "playerVar"] },
];

function getVarKindFromDef(def: VarDef | null): LeafVarKind {
  if (!def) return "unknown";
  return def.type === "boolean" ? "boolean" : "number";
}

function opOptionsForVarKind(kind: LeafVarKind): Option<string>[] {
  const ops = kind === "boolean" ? BOOL_OPS : NUMBER_OPS;
  return ops.map((op) => ({ id: op, label: op }));
}

function normalizeOpForVarKind(op: unknown, kind: LeafVarKind): string {
  const allowed = kind === "boolean" ? BOOL_OPS : NUMBER_OPS;
  const s = String(op ?? "");
  return (allowed as readonly string[]).includes(s) ? s : allowed[0];
}

function normalizeBoolean(value: unknown): boolean {
  return Boolean(value);
}

function normalizeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function idOptionsFromProject(
  ctx: LeafCtx,
  source: "items" | "nodes" | "maps" | "players" | "npcs" | "hotspots" | "placedPlayers"
): Option<ID>[] {
  switch (source) {
    case "items":
      return ctx.idx.getPlacedItemOptions();
    case "nodes":
      return ctx.idx.getNodeOptions({ excludeNodeId: ctx.currentNodeId });
    case "maps":
      return ctx.idx.getMapOptions();
    case "players":
      return ctx.idx.getPlayerOptions();
    case "npcs":
      return ctx.idx.getNpcOptions();
    case "hotspots":
      return ctx.idx.getHotspotOptions();
    case "placedPlayers":
      return ctx.idx.getPlacedPlayerOptions();
  }
}

function getSingleMapId(ctx: LeafCtx): ID {
  return ctx.idx.getMapOptions()[0]?.id ?? "";
}

function hasVarsForCondition(ctx: LeafCtx, cond: EnabledLeafCondition): boolean {
  if (cond.type === "playerVar" || cond.type === "placedPlayerVisible") {
    return ctx.idx.getVarOptions("player", cond.playerId).length > 0;
  }

  if (cond.type === "npcVar" || cond.type === "placedNpcVisible" || cond.type === "placedNpcReachable") {
    return ctx.idx.getVarOptions("npc", cond.npcId).length > 0;
  }

  if (cond.type === "hotspotVar" || cond.type === "hotspotVisible" || cond.type === "hotspotReachable") {
    return ctx.idx.getVarOptions("hotspot", cond.hotspotId).length > 0;
  }

  return false;
}

type LeafSpec<T extends EnabledLeafType> = {
  label: string;
  makeDefault: () => Extract<EnabledLeafCondition, { type: T }>;
  summarize: (ctx: LeafCtx, c: Extract<EnabledLeafCondition, { type: T }>) => string;
  ui: LeafUiSpec;
};

export const LEAF_REGISTRY: { [K in EnabledLeafType]: LeafSpec<K> } = {
  nodeVisited: {
    label: "Escena visitada",
    makeDefault: () => ({ type: "nodeVisited", nodeId: "", op: "==", value: true }),
    summarize: ({ idx }, c) => `Escena: ${idx.getNodeLabel(c.nodeId)} = ${String(c.value)}`,
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2",
      fields: [
        {
          key: "nodeId",
          label: "Escena",
          path: "nodeId",
          control: "id-select",
          optionsSource: "nodes",
          optionsResolver: (ctx) => ctx.idx.getNodeOptions({ excludeNodeId: ctx.currentNodeId }),
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"nodeVisited">).nodeId,
        },
      ],
    },
  },

  hasItem: {
    label: "En inventario",
    makeDefault: () => ({ type: "hasItem", placedItemId: "", op: "==", value: true }),
    summarize: ({ idx }, c) => `Item en inventario: ${idx.getPlacedItemLabel(c.placedItemId)} = ${String(c.value)}`,
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2",
      fields: [
        {
          key: "placedItemId",
          label: "Item",
          path: "placedItemId",
          control: "id-select",
          optionsSource: "items",
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"hasItem">).placedItemId,
        },
      ],
    },
  },

  playerVar: {
    label: "Variable",
    makeDefault: () => ({ type: "playerVar", playerId: "", varId: "", op: "==", value: 0 }),
    summarize: ({ idx }, c) => {
      const p = idx.getPlayerLabel(c.playerId);
      const v = idx.getVarLabel("player", c.playerId, c.varId);
      return `Player: ${p} · ${v} ${String(c.op)} ${String(c.value)}`;
    },
    ui: {
      layoutClassName: "space-y-2",
      fields: [
        {
          key: "playerId",
          label: "Player",
          path: "playerId",
          control: "id-select",
          optionsSource: "placedPlayers",
        },
        {
          key: "varId",
          label: "Variable",
          path: "varId",
          control: "id-select",
          optionsResolver: (ctx, cond) => {
            const c = cond as LeafByType<"playerVar">;
            return ctx.idx.getVarOptions("player", c.playerId).map((x) => ({ id: x.id, label: x.label }));
          },
          disabledWhen: (cond) => !(cond as LeafByType<"playerVar">).playerId,
        },
        {
          key: "op",
          label: "Operador",
          path: "op",
          control: "var-op-select",
          disabledWhen: (cond) => !(cond as LeafByType<"playerVar">).varId,
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "var-value",
          disabledWhen: (cond) => !(cond as LeafByType<"playerVar">).varId,
        },
      ],
    },
  },

  npcVar: {
    label: "Variable",
    makeDefault: () => ({ type: "npcVar", npcId: "", varId: "", op: "==", value: 0 }),
    summarize: ({ idx }, c) => {
      const n = idx.getNpcLabel(c.npcId);
      const v = idx.getVarLabel("npc", c.npcId, c.varId);
      return `NPC: ${n} · ${v} ${String(c.op)} ${String(c.value)}`;
    },
    ui: {
      layoutClassName: "space-y-2",
      fields: [
        {
          key: "npcId",
          label: "NPC",
          path: "npcId",
          control: "id-select",
          optionsSource: "npcs",
        },
        {
          key: "varId",
          label: "Variable",
          path: "varId",
          control: "id-select",
          optionsResolver: (ctx, cond) => {
            const c = cond as LeafByType<"npcVar">;
            return ctx.idx.getVarOptions("npc", c.npcId).map((x) => ({ id: x.id, label: x.label }));
          },
          disabledWhen: (cond) => !(cond as LeafByType<"npcVar">).npcId,
        },
        {
          key: "op",
          label: "Operador",
          path: "op",
          control: "var-op-select",
          disabledWhen: (cond) => !(cond as LeafByType<"npcVar">).varId,
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "var-value",
          disabledWhen: (cond) => !(cond as LeafByType<"npcVar">).varId,
        },
      ],
    },
  },

  hotspotVar: {
    label: "Variable",
    makeDefault: () => ({ type: "hotspotVar", hotspotId: "", varId: "", op: "==", value: 0 }),
    summarize: ({ idx }, c) => {
      const h = idx.getHotspotLabel(c.hotspotId);
      const v = idx.getVarLabel("hotspot", c.hotspotId, c.varId);
      return `Hotspot: ${h} · ${v} ${String(c.op)} ${String(c.value)}`;
    },
    ui: {
      layoutClassName: "space-y-2",
      fields: [
        {
          key: "hotspotId",
          label: "Hotspot",
          path: "hotspotId",
          control: "id-select",
          optionsSource: "hotspots",
        },
        {
          key: "varId",
          label: "Variable",
          path: "varId",
          control: "id-select",
          optionsResolver: (ctx, cond) => {
            const c = cond as LeafByType<"hotspotVar">;
            return ctx.idx.getVarOptions("hotspot", c.hotspotId).map((x) => ({ id: x.id, label: x.label }));
          },
          disabledWhen: (cond) => !(cond as LeafByType<"hotspotVar">).hotspotId,
        },
        {
          key: "op",
          label: "Operador",
          path: "op",
          control: "var-op-select",
          disabledWhen: (cond) => !(cond as LeafByType<"hotspotVar">).varId,
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "var-value",
          disabledWhen: (cond) => !(cond as LeafByType<"hotspotVar">).varId,
        },
      ],
    },
  },

  hotspotVisible: {
    label: "Visible",
    makeDefault: () => ({ type: "hotspotVisible", hotspotId: "", op: "==", value: true }),
    summarize: ({ idx }, c) => `Hotspot visible: ${idx.getHotspotLabel(c.hotspotId)} = ${String(c.value)}`,
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2",
      fields: [
        {
          key: "hotspotId",
          label: "Hotspot",
          path: "hotspotId",
          control: "id-select",
          optionsSource: "hotspots",
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"hotspotVisible">).hotspotId,
        },
      ],
    },
  },

  hotspotReachable: {
    label: "Alcanzable",
    makeDefault: () => ({ type: "hotspotReachable", hotspotId: "", op: "==", value: true }),
    summarize: ({ idx }, c) => `Hotspot alcanzable: ${idx.getHotspotLabel(c.hotspotId)} = ${String(c.value)}`,
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2",
      fields: [
        {
          key: "hotspotId",
          label: "Hotspot",
          path: "hotspotId",
          control: "id-select",
          optionsSource: "hotspots",
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"hotspotReachable">).hotspotId,
        },
      ],
    },
  },

  placedItemVisible: {
    label: "Visible",
    makeDefault: () => ({ type: "placedItemVisible", placedItemId: "", op: "==", value: true }),
    summarize: ({ idx }, c) => `Item visible: ${idx.getPlacedItemLabel(c.placedItemId)} = ${String(c.value)}`,
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2",
      fields: [
        {
          key: "placedItemId",
          label: "Item",
          path: "placedItemId",
          control: "id-select",
          optionsSource: "items",
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"placedItemVisible">).placedItemId,
        },
      ],
    },
  },

  placedItemReachable: {
    label: "Alcanzable",
    makeDefault: () => ({ type: "placedItemReachable", placedItemId: "", op: "==", value: true }),
    summarize: ({ idx }, c) => `Item alcanzable: ${idx.getPlacedItemLabel(c.placedItemId)} = ${String(c.value)}`,
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2",
      fields: [
        {
          key: "placedItemId",
          label: "Item",
          path: "placedItemId",
          control: "id-select",
          optionsSource: "items",
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"placedItemReachable">).placedItemId,
        },
      ],
    },
  },

  placedNpcVisible: {
    label: "Visible",
    makeDefault: () => ({ type: "placedNpcVisible", npcId: "", op: "==", value: true }),
    summarize: ({ idx }, c) => `NPC visible: ${idx.getPlacedNpcLabel(c.npcId)} = ${String(c.value)}`,
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2",
      fields: [
        {
          key: "npcId",
          label: "NPC",
          path: "npcId",
          control: "id-select",
          optionsSource: "npcs",
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"placedNpcVisible">).npcId,
        },
      ],
    },
  },

  placedNpcReachable: {
    label: "Alcanzable",
    makeDefault: () => ({ type: "placedNpcReachable", npcId: "", op: "==", value: true }),
    summarize: ({ idx }, c) => `NPC alcanzable: ${idx.getPlacedNpcLabel(c.npcId)} = ${String(c.value)}`,
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2",
      fields: [
        {
          key: "npcId",
          label: "NPC",
          path: "npcId",
          control: "id-select",
          optionsSource: "npcs",
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"placedNpcReachable">).npcId,
        },
      ],
    },
  },

  placedPlayerVisible: {
    label: "Visible",
    makeDefault: () => ({ type: "placedPlayerVisible", playerId: "", op: "==", value: true }),
    summarize: ({ idx }, c) => `Player visible: ${idx.getPlacedPlayerLabel(c.playerId)} = ${String(c.value)}`,
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2",
      fields: [
        {
          key: "playerId",
          label: "Player",
          path: "playerId",
          control: "id-select",
          optionsSource: "placedPlayers",
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"placedPlayerVisible">).playerId,
        },
      ],
    },
  },

  mapRegionVisited: {
    label: "Región visitada",
    makeDefault: () => ({ type: "mapRegionVisited", mapId: "", regionId: "", op: "==", value: true }),
    summarize: ({ idx }, c) =>
      `Región visitada: ${idx.getMapLabel(c.mapId)} · ${idx.getMapRegionLabel(c.mapId, c.regionId)} = ${String(c.value)}`,
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px] gap-2",
      fields: [
        {
          key: "mapId",
          label: "Mapa",
          path: "mapId",
          control: "id-select",
          optionsSource: "maps",
          visibleWhen: (ctx) => ctx.idx.getMapOptions().length > 1,
        },
        {
          key: "regionId",
          label: "Región",
          path: "regionId",
          control: "id-select",
          optionsResolver: (ctx, cond) => {
            const c = cond as LeafByType<"mapRegionVisited">;
            const mapId = c.mapId || getSingleMapId(ctx);
            return ctx.idx.getMapRegionOptions(mapId);
          },
          disabledWhen: (cond) => !(cond as LeafByType<"mapRegionVisited">).mapId,
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"mapRegionVisited">).regionId,
        },
      ],
    },
  },
} as const;

export function enabledLeafTypes(ctx?: LeafCtx): EnabledLeafType[] {
  if (!ctx) return Object.keys(LEAF_REGISTRY) as EnabledLeafType[];
  return enabledLeafTypesForContext(ctx);
}

export function leafLabel(type: EnabledLeafType): string {
  return LEAF_REGISTRY[type].label;
}

export function leafFamily(type: EnabledLeafType): ConditionFamilyId {
  if (type === "nodeVisited" || type === "mapRegionVisited") return "progress";
  if (type === "hasItem" || type === "placedItemVisible" || type === "placedItemReachable") return "item";
  if (type === "hotspotVisible" || type === "hotspotReachable" || type === "hotspotVar") return "hotspot";
  if (type === "placedNpcVisible" || type === "placedNpcReachable" || type === "npcVar") return "npc";
  return "player";
}

export function getConditionFamilies(ctx: LeafCtx): ConditionFamilySpec[] {
  const enabled = new Set(enabledLeafTypesForContext(ctx));

  return CONDITION_FAMILIES
    .map((family) => ({
      ...family,
      leafTypes: family.leafTypes.filter((type) => enabled.has(type)),
    }))
    .filter((family) => family.leafTypes.length > 0);
}

export function getFamilyById(ctx: LeafCtx, familyId: ConditionFamilyId): ConditionFamilySpec | null {
  return getConditionFamilies(ctx).find((f) => f.id === familyId) ?? null;
}

export function getAvailableLeafTypesForFamily(
  ctx: LeafCtx,
  familyId: ConditionFamilyId,
  currentCond?: EnabledLeafCondition | null
): EnabledLeafType[] {
  const family = getFamilyById(ctx, familyId);
  if (!family) return [];

  if (!currentCond) return family.leafTypes;

  if (familyId === "hotspot") {
    return family.leafTypes.filter((type) => type !== "hotspotVar" || hasVarsForCondition(ctx, currentCond));
  }

  if (familyId === "npc") {
    return family.leafTypes.filter((type) => type !== "npcVar" || hasVarsForCondition(ctx, currentCond));
  }

  if (familyId === "player") {
    return family.leafTypes.filter((type) => type !== "playerVar" || hasVarsForCondition(ctx, currentCond));
  }

  return family.leafTypes;
}

export function createDefaultLeaf<T extends EnabledLeafType>(type: T): Extract<EnabledLeafCondition, { type: T }> {
  return LEAF_REGISTRY[type].makeDefault();
}

export function createSiblingLeafPreservingSelection(
  ctx: LeafCtx,
  prev: EnabledLeafCondition,
  nextType: EnabledLeafType
): EnabledLeafCondition {
  const base = createDefaultLeaf(nextType) as EnabledLeafCondition;

  if (prev.type === nextType) return prev;

  if (
    (prev.type === "hasItem" || prev.type === "placedItemVisible" || prev.type === "placedItemReachable") &&
    (nextType === "hasItem" || nextType === "placedItemVisible" || nextType === "placedItemReachable")
  ) {
    const placedItemId = prev.placedItemId;
    return applyLeafPatch(ctx, { ...base, placedItemId } as EnabledLeafCondition, {});
  }

  if (
    (prev.type === "hotspotVisible" || prev.type === "hotspotReachable" || prev.type === "hotspotVar") &&
    (nextType === "hotspotVisible" || nextType === "hotspotReachable" || nextType === "hotspotVar")
  ) {
    const hotspotId = prev.hotspotId;
    return applyLeafPatch(ctx, { ...base, hotspotId } as EnabledLeafCondition, {});
  }

  if (
    (prev.type === "placedNpcVisible" || prev.type === "placedNpcReachable" || prev.type === "npcVar") &&
    (nextType === "placedNpcVisible" || nextType === "placedNpcReachable" || nextType === "npcVar")
  ) {
    const npcId = prev.npcId;
    return applyLeafPatch(ctx, { ...base, npcId } as EnabledLeafCondition, {});
  }

  if (
    (prev.type === "placedPlayerVisible" || prev.type === "playerVar") &&
    (nextType === "placedPlayerVisible" || nextType === "playerVar")
  ) {
    const playerId = prev.playerId;
    return applyLeafPatch(ctx, { ...base, playerId } as EnabledLeafCondition, {});
  }

  if (nextType === "mapRegionVisited") {
    const next = { ...base } as LeafByType<"mapRegionVisited">;
    if (!next.mapId && ctx.idx.getMapOptions().length === 1) {
      next.mapId = getSingleMapId(ctx);
    }
    return applyLeafPatch(ctx, next, {});
  }

  return applyLeafPatch(ctx, base, {});
}

export function summarize<K extends EnabledLeafType>(ctx: LeafCtx, cond: Extract<EnabledLeafCondition, { type: K }>): string {
  return LEAF_REGISTRY[cond.type].summarize(ctx, cond);
}

export function getLeafUi(type: EnabledLeafType): LeafUiSpec {
  return LEAF_REGISTRY[type].ui;
}

export function isEnabledLeaf(c: Condition): c is EnabledLeafCondition {
  return Object.prototype.hasOwnProperty.call(LEAF_REGISTRY, c.type);
}

export function getLeafOptions(ctx: LeafCtx, cond: EnabledLeafCondition, f: LeafFieldSpec): Option<ID>[] {
  if (f.optionsResolver) return f.optionsResolver(ctx, cond);
  if (f.optionsSource) return idOptionsFromProject(ctx, f.optionsSource);
  return [];
}

function resolveLeafVarKind(ctx: LeafCtx, cond: EnabledLeafCondition): LeafVarKind {
  if (cond.type === "playerVar") return getVarKindFromDef(ctx.idx.getVarDef("player", cond.playerId, cond.varId));
  if (cond.type === "npcVar") return getVarKindFromDef(ctx.idx.getVarDef("npc", cond.npcId, cond.varId));
  if (cond.type === "hotspotVar") return getVarKindFromDef(ctx.idx.getVarDef("hotspot", cond.hotspotId, cond.varId));
  return "unknown";
}

export function getVarOpOptions(ctx: LeafCtx, cond: EnabledLeafCondition): Option<string>[] {
  const kind = resolveLeafVarKind(ctx, cond);
  return opOptionsForVarKind(kind);
}

export function applyLeafPatch(ctx: LeafCtx, prev: EnabledLeafCondition, patch: Partial<EnabledLeafCondition>): EnabledLeafCondition {
  const next = { ...prev, ...patch } as EnabledLeafCondition;

  if (prev.type === "playerVar" && next.type === "playerVar") {
    const ownerChanged = prev.playerId !== next.playerId;
    const pNext = { ...next } as LeafByType<"playerVar">;

    if (ownerChanged) pNext.varId = "";

    const def = ctx.idx.getVarDef("player", pNext.playerId, pNext.varId);
    const kind = getVarKindFromDef(def);

    pNext.op = normalizeOpForVarKind(pNext.op, kind) as typeof pNext.op;
    pNext.value = kind === "boolean" ? normalizeBoolean(pNext.value) : normalizeNumber(pNext.value);
    return pNext;
  }

  if (prev.type === "npcVar" && next.type === "npcVar") {
    const ownerChanged = prev.npcId !== next.npcId;
    const nNext = { ...next } as LeafByType<"npcVar">;

    if (ownerChanged) nNext.varId = "";

    const def = ctx.idx.getVarDef("npc", nNext.npcId, nNext.varId);
    const kind = getVarKindFromDef(def);

    nNext.op = normalizeOpForVarKind(nNext.op, kind) as typeof nNext.op;
    nNext.value = kind === "boolean" ? normalizeBoolean(nNext.value) : normalizeNumber(nNext.value);
    return nNext;
  }

  if (prev.type === "hotspotVar" && next.type === "hotspotVar") {
    const ownerChanged = prev.hotspotId !== next.hotspotId;
    const hNext = { ...next } as LeafByType<"hotspotVar">;

    if (ownerChanged) hNext.varId = "";

    const def = ctx.idx.getVarDef("hotspot", hNext.hotspotId, hNext.varId);
    const kind = getVarKindFromDef(def);

    hNext.op = normalizeOpForVarKind(hNext.op, kind) as typeof hNext.op;
    hNext.value = kind === "boolean" ? normalizeBoolean(hNext.value) : normalizeNumber(hNext.value);
    return hNext;
  }

  if (
    next.type === "nodeVisited" ||
    next.type === "hasItem" ||
    next.type === "hotspotVisible" ||
    next.type === "hotspotReachable" ||
    next.type === "placedItemVisible" ||
    next.type === "placedItemReachable" ||
    next.type === "placedNpcVisible" ||
    next.type === "placedNpcReachable" ||
    next.type === "placedPlayerVisible" ||
    next.type === "mapRegionVisited"
  ) {
    const normalized = { ...next, value: normalizeBoolean((next as { value?: unknown }).value) } as EnabledLeafCondition;

    if (normalized.type === "mapRegionVisited") {
      if (!normalized.mapId && ctx.idx.getMapOptions().length === 1) {
        normalized.mapId = getSingleMapId(ctx);
      }

      const prevMapId = prev.type === "mapRegionVisited" ? prev.mapId : undefined;
      const mapChanged = prevMapId !== normalized.mapId;

      if (mapChanged) {
        normalized.regionId = "";
      }
    }

    return normalized;
  }

  return next;
}

export function enabledLeafTypesForContext(ctx: LeafCtx): EnabledLeafType[] {
  const p = ctx.idx.project;
  if (!p) return ["nodeVisited", "hasItem"];

  const playerHasVarsById = new Map(
    (p.players ?? []).map((player) => [player.id, (player.vars ?? []).length > 0] as const)
  );
  const hasPlacedPlayers = ctx.idx.getPlacedPlayers().length > 0;
  const hasPlacedPlayerVars = ctx.idx
    .getPlacedPlayers()
    .some((placedPlayer) => playerHasVarsById.get(placedPlayer.playerId));

  const hasNpcs = (p.npcs ?? []).length > 0;
  const hasNpcVars = (p.npcs ?? []).some((x) => (x.vars ?? []).length > 0);

  const hasPlacedItems = ctx.idx.getPlacedItems().length > 0;
  const hasHotspots = ctx.idx.getHotspots().length > 0;
  const hasHotspotVars = ctx.idx.getHotspots().some((h) => (h.vars ?? []).length > 0);

  const hasPlacedNpcs = ctx.idx.getPlacedNpcs().length > 0;

  const hasRegions = (p.maps ?? []).some((m) => (m.regions ?? []).length > 0);

  const out: EnabledLeafType[] = ["nodeVisited"];

  if (hasPlacedItems) out.push("hasItem", "placedItemVisible", "placedItemReachable");
  if (hasNpcs && hasNpcVars) out.push("npcVar");
  if (hasHotspots) out.push("hotspotVisible", "hotspotReachable");
  if (hasHotspotVars) out.push("hotspotVar");
  if (hasPlacedNpcs) out.push("placedNpcVisible", "placedNpcReachable");
  if (hasPlacedPlayers) {
    out.push("placedPlayerVisible");
    if (hasPlacedPlayerVars) out.push("playerVar");
  }
  if (hasRegions) out.push("mapRegionVisited");

  return out;
}