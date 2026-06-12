import type { ID, VarDef } from "@/domain/types";
import { type Condition, BOOL_OPS, NUMBER_OPS } from "@/domain/conditions";
import type { Option } from "@/components/Select";
import type { ProjectIndex } from "@/features/editor/scene/rules/conditions/conditionProjectIndex";

type LeafByType<T extends Condition["type"]> = Extract<Condition, { type: T }>;

type NpcPlacementCondition = LeafByType<"placedNpcVisible"> | LeafByType<"placedNpcReachable">;
type PlayerPlacementCondition = LeafByType<"placedPlayerVisible"> | LeafByType<"placedPlayerImage">;

function isNpcPlacementCondition(cond: EnabledLeafCondition): cond is NpcPlacementCondition {
  return cond.type === "placedNpcVisible" || cond.type === "placedNpcReachable";
}

function isPlayerPlacementCondition(cond: EnabledLeafCondition): cond is PlayerPlacementCondition {
  return cond.type === "placedPlayerVisible" || cond.type === "placedPlayerImage";
}

/* Subconjunto de condiciones soportadas en UI */
export type EnabledLeafCondition =
  | LeafByType<"nodeVisited">
  | LeafByType<"hasItem">
  | LeafByType<"npcHasItem">
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
  | LeafByType<"placedPlayerImage">
  | LeafByType<"mapRegionVisited">;

export type EnabledLeafType = EnabledLeafCondition["type"];

export type ConditionFamilyId = "progress" | "item" | "hotspot" | "npc" | "player";

export type LeafCtx = { idx: ProjectIndex; currentNodeId?: ID };

type LeafFieldControl = "id-select" | "text" | "bool" | "number" | "op-select" | "var-op-select" | "var-value";

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
  { id: "item", label: "Item", leafTypes: ["placedItemVisible", "placedItemReachable"] },
  { id: "hotspot", label: "Hotspot", leafTypes: ["hotspotVisible", "hotspotReachable", "hotspotVar"] },
  { id: "npc", label: "NPC", leafTypes: ["placedNpcVisible", "placedNpcReachable", "npcVar", "npcHasItem"] },
  { id: "player", label: "Player", leafTypes: ["placedPlayerVisible", "placedPlayerImage", "playerVar", "hasItem"] },
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

function normalizeNumber(value: unknown): number | "" {
  if (value === "") return "";

  const n = Number(value);
  return Number.isFinite(n) ? n : "";
}

function getVarDefForCondition(ctx: LeafCtx, cond: EnabledLeafCondition): VarDef | null {
  if (cond.type === "playerVar") return ctx.idx.getVarDef("player", cond.playerId, cond.varId);
  if (cond.type === "npcVar") return ctx.idx.getVarDef("npc", cond.npcId, cond.varId);
  if (cond.type === "hotspotVar") return ctx.idx.getVarDef("hotspot", cond.hotspotId, cond.varId);

  return null;
}

/* Normalización común para condiciones con variables */
function normalizeVarLeaf(ctx: LeafCtx, next: Extract<EnabledLeafCondition, { type: "playerVar" | "npcVar" | "hotspotVar" }>):
  Extract<EnabledLeafCondition, { type: "playerVar" | "npcVar" | "hotspotVar" }> {
  const n = { ...next };

  switch (next.type) {
    case "playerVar": {
      if (!next.playerId) n.varId = "";

      const def = ctx.idx.getVarDef("player", next.playerId, next.varId);
      const kind = getVarKindFromDef(def);

      n.op = normalizeOpForVarKind(n.op, kind) as typeof n.op;

      n.value = kind === "boolean"
        ? normalizeBoolean(n.value)
        : normalizeNumber(n.value) as typeof n.value;
      return n;
    }

    case "npcVar": {
      if (!next.npcId) n.varId = "";

      const def = ctx.idx.getVarDef("npc", next.npcId, next.varId);
      const kind = getVarKindFromDef(def);

      n.op = normalizeOpForVarKind(n.op, kind) as typeof n.op;
      n.value = kind === "boolean"
        ? normalizeBoolean(n.value)
        : normalizeNumber(n.value) as typeof n.value;

      return n;
    }

    case "hotspotVar": {
      if (!next.hotspotId) n.varId = "";

      const def = ctx.idx.getVarDef("hotspot", next.hotspotId, next.varId);
      const kind = getVarKindFromDef(def);

      n.op = normalizeOpForVarKind(n.op, kind) as typeof n.op;
      n.value = kind === "boolean"
        ? normalizeBoolean(n.value)
        : normalizeNumber(n.value) as typeof n.value;

      return n;
    }
  }
}

/* Centraliza acceso a opciones */
function idOptionsFromProject(ctx: LeafCtx, source: LeafFieldSpec["optionsSource"]): Option<ID>[] {
  switch (source) {
    case "items": return ctx.idx.getPlacedItemOptions();
    case "nodes": return ctx.idx.getNodeOptions({ excludeNodeId: ctx.currentNodeId });
    case "maps": return ctx.idx.getMapOptions();
    case "players": return ctx.idx.getPlayerOptions();
    case "npcs": return ctx.idx.getNpcOptions();
    case "hotspots": return ctx.idx.getHotspotOptions();
    case "placedPlayers": return ctx.idx.getPlacedPlayerOptions();
    default: return [];
  }
}

function getSingleMapId(ctx: LeafCtx): ID {
  return ctx.idx.getMapOptions()[0]?.id ?? "";
}

function hasVarsForCondition(ctx: LeafCtx, cond: EnabledLeafCondition): boolean {
  switch (cond.type) {
    case "playerVar":
    case "placedPlayerVisible":
    case "placedPlayerImage":
      return ctx.idx.getVarOptions("player", cond.playerId).length > 0;

    case "hasItem":
      return ctx.idx.getVarOptions("player", cond.playerId).length > 0;

    case "npcVar":
    case "placedNpcVisible":
    case "placedNpcReachable":
    case "npcHasItem":
      return ctx.idx.getVarOptions("npc", cond.npcId).length > 0;

    case "hotspotVar":
    case "hotspotVisible":
    case "hotspotReachable":
      return ctx.idx.getVarOptions("hotspot", cond.hotspotId).length > 0;

    default:
      return false;
  }
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
    label: "Tiene item",
    makeDefault: () => ({ type: "hasItem", playerId: "", itemInstanceId: "", op: "==", value: true }),
    summarize: ({ idx }, c) => `Player tiene item: ${idx.getPlayerLabel(c.playerId)} · ${idx.getGameItemLabel(c.itemInstanceId)} = ${String(c.value)}`,
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
          key: "itemInstanceId",
          label: "Item",
          path: "itemInstanceId",
          control: "id-select",
          optionsResolver: (ctx) => ctx.idx.getGameItemOptions(),
          disabledWhen: (cond) => !(cond as LeafByType<"hasItem">).playerId,
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"hasItem">).itemInstanceId,
        },
      ],
    },
  },

  npcHasItem: {
    label: "Tiene item",
    makeDefault: () => ({ type: "npcHasItem", npcId: "", itemInstanceId: "", op: "==", value: true }),
    summarize: ({ idx }, c) =>
      `NPC tiene item: ${idx.getNpcLabel(c.npcId)} · ${idx.getGameItemLabel(c.itemInstanceId)} = ${String(c.value)}`,
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
          key: "itemInstanceId",
          label: "Item",
          path: "itemInstanceId",
          control: "id-select",
          optionsResolver: (ctx) => ctx.idx.getGameItemOptions(),
          disabledWhen: (cond) => !(cond as LeafByType<"npcHasItem">).npcId,
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as LeafByType<"npcHasItem">).itemInstanceId,
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
    makeDefault: () => ({ type: "placedNpcVisible", nodeId: "", layerId: "", npcId: "", op: "==", value: true }),
    summarize: ({ idx }, c) =>
      `NPC visible: ${idx.getPlacedNpcContextLabel(c.nodeId, c.layerId, c.npcId)} = ${String(c.value)}`,
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
          key: "nodeId",
          label: "Escena",
          path: "nodeId",
          control: "id-select",
          optionsResolver: (ctx, cond) =>
            isNpcPlacementCondition(cond) ? ctx.idx.getPlacedNpcNodeOptions(cond.npcId) : [],
          disabledWhen: (cond) =>
            !isNpcPlacementCondition(cond) || !cond.npcId,
        },
        {
          key: "layerId",
          label: "Capa",
          path: "layerId",
          control: "id-select",
          optionsResolver: (ctx, cond) =>
            isNpcPlacementCondition(cond) ? ctx.idx.getPlacedNpcLayerOptions(cond.npcId, cond.nodeId) : [],
          disabledWhen: (cond) =>
            !isNpcPlacementCondition(cond) || !cond.nodeId,
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) => !(cond as any).layerId,
        },
      ],
    },
  },

  placedNpcReachable: {
    label: "Alcanzable",
    makeDefault: () => ({ type: "placedNpcReachable", nodeId: "", layerId: "", npcId: "", op: "==", value: true }),
    summarize: ({ idx }, c) =>
      `NPC alcanzable: ${idx.getPlacedNpcContextLabel(c.nodeId, c.layerId, c.npcId)} = ${String(c.value)}`,
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
          key: "nodeId",
          label: "Escena",
          path: "nodeId",
          control: "id-select",
          optionsResolver: (ctx, cond) =>
            isNpcPlacementCondition(cond) ? ctx.idx.getPlacedNpcNodeOptions(cond.npcId) : [],
          disabledWhen: (cond) =>
            !isNpcPlacementCondition(cond) || !cond.npcId,
        },
        {
          key: "layerId",
          label: "Capa",
          path: "layerId",
          control: "id-select",
          optionsResolver: (ctx, cond) =>
            isNpcPlacementCondition(cond) ? ctx.idx.getPlacedNpcLayerOptions(cond.npcId, cond.nodeId) : [],
          disabledWhen: (cond) =>
            !isNpcPlacementCondition(cond) || !cond.nodeId,
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) =>
            !isNpcPlacementCondition(cond) || !cond.layerId,
        },
      ],
    },
  },

  placedPlayerVisible: {
    label: "Visible",
    makeDefault: () => ({ type: "placedPlayerVisible", nodeId: "", layerId: "", playerId: "", op: "==", value: true }),
    summarize: ({ idx }, c) =>
      `Player visible: ${idx.getPlacedPlayerContextLabel(c.nodeId, c.layerId, c.playerId)} = ${String(c.value)}`,
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
          key: "nodeId",
          label: "Escena",
          path: "nodeId",
          control: "id-select",
          optionsResolver: (ctx, cond) =>
            isPlayerPlacementCondition(cond) ? ctx.idx.getPlacedPlayerNodeOptions(cond.playerId) : [],
          disabledWhen: (cond) =>
            !isPlayerPlacementCondition(cond) || !cond.playerId,
        },
        {
          key: "layerId",
          label: "Capa",
          path: "layerId",
          control: "id-select",
          optionsResolver: (ctx, cond) =>
            isPlayerPlacementCondition(cond) ? ctx.idx.getPlacedPlayerLayerOptions(cond.playerId, cond.nodeId) : [],
          disabledWhen: (cond) =>
            !isPlayerPlacementCondition(cond) || !cond.nodeId,
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) =>
            !isPlayerPlacementCondition(cond) || !cond.layerId,
        },
      ],
    },
  },

  placedPlayerImage: {
    label: "Imagen",
    makeDefault: () => ({
      type: "placedPlayerImage",
      nodeId: "",
      layerId: "",
      playerId: "",
      imageId: "",
      op: "==",
      value: true,
    }),
    summarize: ({ idx }, c) =>
      `Player imagen: ${idx.getPlacedPlayerContextLabel(c.nodeId, c.layerId, c.playerId)} · ${idx.getPlayerImageLabel(c.playerId, c.imageId)} = ${String(c.value)}`,
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
          key: "nodeId",
          label: "Escena",
          path: "nodeId",
          control: "id-select",
          optionsResolver: (ctx, cond) =>
            isPlayerPlacementCondition(cond) ? ctx.idx.getPlacedPlayerNodeOptions(cond.playerId) : [],
          disabledWhen: (cond) =>
            !isPlayerPlacementCondition(cond) || !cond.playerId,
        },
        {
          key: "layerId",
          label: "Capa",
          path: "layerId",
          control: "id-select",
          optionsResolver: (ctx, cond) =>
            isPlayerPlacementCondition(cond) ? ctx.idx.getPlacedPlayerLayerOptions(cond.playerId, cond.nodeId) : [],
          disabledWhen: (cond) =>
            !isPlayerPlacementCondition(cond) || !cond.nodeId,
        },
        {
          key: "imageId",
          label: "Imagen",
          path: "imageId",
          control: "id-select",
          optionsResolver: (ctx, cond) => {
            const c = cond as LeafByType<"placedPlayerImage">;
            return ctx.idx.getPlayerImageOptions(c.playerId);
          },
          disabledWhen: (cond) =>
            !isPlayerPlacementCondition(cond) || !cond.layerId,
        },
        {
          key: "value",
          label: "Valor",
          path: "value",
          control: "bool",
          disabledWhen: (cond) =>
            cond.type !== "placedPlayerImage" || !cond.imageId,
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

const FAMILY_BY_TYPE: Record<EnabledLeafType, ConditionFamilyId> = {
  nodeVisited: "progress",
  mapRegionVisited: "progress",

  placedItemVisible: "item",
  placedItemReachable: "item",

  hotspotVisible: "hotspot",
  hotspotReachable: "hotspot",
  hotspotVar: "hotspot",

  placedNpcVisible: "npc",
  placedNpcReachable: "npc",
  npcVar: "npc",
  npcHasItem: "npc",

  placedPlayerVisible: "player",
  placedPlayerImage: "player",
  playerVar: "player",
  hasItem: "player",
};

export function leafFamily(type: EnabledLeafType): ConditionFamilyId {
  return FAMILY_BY_TYPE[type];
}

export function getConditionFamilies(ctx: LeafCtx): ConditionFamilySpec[] {
  const enabled = new Set(enabledLeafTypesForContext(ctx));

  return CONDITION_FAMILIES.map((family) => ({
    ...family,
    leafTypes: family.leafTypes.filter((type) => enabled.has(type)),
  }))
    .filter((family) => family.leafTypes.length > 0);
}

export function getFamilyById(ctx: LeafCtx, familyId: ConditionFamilyId): ConditionFamilySpec | null {
  return getConditionFamilies(ctx).find((f) => f.id === familyId) ?? null;
}

export function getAvailableLeafTypesForFamily(ctx: LeafCtx, familyId: ConditionFamilyId, currentCond?: EnabledLeafCondition | null): EnabledLeafType[] {
  const family = getFamilyById(ctx, familyId);
  if (!family) return [];

  if (!currentCond) return family.leafTypes;

  if (familyId === "hotspot") return family.leafTypes.filter((type) => type !== "hotspotVar" || hasVarsForCondition(ctx, currentCond));

  if (familyId === "npc") return family.leafTypes.filter((type) => type !== "npcVar" || hasVarsForCondition(ctx, currentCond));

  if (familyId === "player") return family.leafTypes.filter((type) => type !== "playerVar" || hasVarsForCondition(ctx, currentCond));

  return family.leafTypes;
}

export function createDefaultLeaf<T extends EnabledLeafType>(type: T): Extract<EnabledLeafCondition, { type: T }> {
  return LEAF_REGISTRY[type].makeDefault();
}

export function createSiblingLeafPreservingSelection(
  ctx: LeafCtx,
  prev: EnabledLeafCondition,
  nextType: EnabledLeafType,
): EnabledLeafCondition {
  const base = createDefaultLeaf(nextType) as EnabledLeafCondition;

  if (prev.type === nextType) return prev;

  if (
    (prev.type === "hasItem" || prev.type === "placedItemVisible" || prev.type === "placedItemReachable") &&
    (nextType === "hasItem" || nextType === "placedItemVisible" || nextType === "placedItemReachable")
  ) {
    if (prev.type === "hasItem" && nextType === "hasItem") {
      return applyLeafPatch(ctx, { ...base, itemInstanceId: prev.itemInstanceId } as EnabledLeafCondition, {});
    }

    if (prev.type !== "hasItem" && nextType !== "hasItem") {
      return applyLeafPatch(ctx, { ...base, placedItemId: prev.placedItemId } as EnabledLeafCondition, {});
    }

    return applyLeafPatch(ctx, base, {});
  }

  if (
    (prev.type === "hotspotVisible" || prev.type === "hotspotReachable" || prev.type === "hotspotVar") &&
    (nextType === "hotspotVisible" || nextType === "hotspotReachable" || nextType === "hotspotVar")
  ) {
    return applyLeafPatch(ctx, { ...base, hotspotId: prev.hotspotId } as EnabledLeafCondition, {});
  }

  if (
    (prev.type === "placedNpcVisible" || prev.type === "placedNpcReachable" || prev.type === "npcVar" || prev.type === "npcHasItem") &&
    (nextType === "placedNpcVisible" || nextType === "placedNpcReachable" || nextType === "npcVar" || nextType === "npcHasItem")
  ) {
    if (nextType === "placedNpcVisible") {
      const next: LeafByType<"placedNpcVisible"> = {
        type: "placedNpcVisible",
        npcId: "npcId" in prev ? prev.npcId : "",
        nodeId: isNpcPlacementCondition(prev) ? prev.nodeId : "",
        layerId: isNpcPlacementCondition(prev) ? prev.layerId : "",
        op: "==",
        value: true,
      };

      return applyLeafPatch(ctx, next, {});
    }

    if (nextType === "placedNpcReachable") {
      const next: LeafByType<"placedNpcReachable"> = {
        type: "placedNpcReachable",
        npcId: "npcId" in prev ? prev.npcId : "",
        nodeId: isNpcPlacementCondition(prev) ? prev.nodeId : "",
        layerId: isNpcPlacementCondition(prev) ? prev.layerId : "",
        op: "==",
        value: true,
      };

      return applyLeafPatch(ctx, next, {});
    }

    if (nextType === "npcVar") {
      const next: LeafByType<"npcVar"> = {
        type: "npcVar",
        npcId: "npcId" in prev ? prev.npcId : "",
        varId: "",
        op: "==",
        value: 0,
      };

      return applyLeafPatch(ctx, next, {});
    }

    const next: LeafByType<"npcHasItem"> = {
      type: "npcHasItem",
      npcId: "npcId" in prev ? prev.npcId : "",
      itemInstanceId: "",
      op: "==",
      value: true,
    };

    return applyLeafPatch(ctx, next, {});
  }

  if (
    (prev.type === "placedPlayerVisible" || prev.type === "placedPlayerImage" || prev.type === "playerVar" || prev.type === "hasItem") &&
    (nextType === "placedPlayerVisible" || nextType === "placedPlayerImage" || nextType === "playerVar" || nextType === "hasItem")
  ) {
    if (nextType === "placedPlayerVisible") {
      const next: LeafByType<"placedPlayerVisible"> = {
        type: "placedPlayerVisible",
        playerId:
          prev.type === "placedPlayerVisible" || prev.type === "placedPlayerImage" || prev.type === "playerVar" || prev.type === "hasItem"
            ? prev.playerId
            : "",
        nodeId: isPlayerPlacementCondition(prev) ? prev.nodeId : "",
        layerId: isPlayerPlacementCondition(prev) ? prev.layerId : "",
        op: "==",
        value: true,
      };

      return applyLeafPatch(ctx, next, {});
    }

    if (nextType === "placedPlayerImage") {
      const next: LeafByType<"placedPlayerImage"> = {
        type: "placedPlayerImage",
        playerId:
          prev.type === "placedPlayerVisible" || prev.type === "placedPlayerImage" || prev.type === "playerVar" || prev.type === "hasItem"
            ? prev.playerId
            : "",
        nodeId: isPlayerPlacementCondition(prev) ? prev.nodeId : "",
        layerId: isPlayerPlacementCondition(prev) ? prev.layerId : "",
        imageId: prev.type === "placedPlayerImage" ? prev.imageId : "",
        op: "==",
        value: true,
      };

      return applyLeafPatch(ctx, next, {});
    }

    if (nextType === "playerVar") {
      const next: LeafByType<"playerVar"> = {
        type: "playerVar",
        playerId:
          prev.type === "placedPlayerVisible" || prev.type === "placedPlayerImage" || prev.type === "playerVar" || prev.type === "hasItem"
            ? prev.playerId
            : "",
        varId: "",
        op: "==",
        value: 0,
      };

      return applyLeafPatch(ctx, next, {});
    }

    const next: LeafByType<"hasItem"> = {
      type: "hasItem",
      playerId: prev.type === "placedPlayerVisible" || prev.type === "playerVar" || prev.type === "hasItem"
        ? prev.playerId
        : "",
      itemInstanceId: prev.type === "hasItem" ? prev.itemInstanceId : "",
      op: "==",
      value: true,
    };

    return applyLeafPatch(ctx, next, {});
  }

  if (nextType === "mapRegionVisited") {
    const next = { ...base } as LeafByType<"mapRegionVisited">;
    if (!next.mapId && ctx.idx.getMapOptions().length === 1) next.mapId = getSingleMapId(ctx);
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

export function getLeafValidationError(ctx: LeafCtx, cond: EnabledLeafCondition | null): string | null {
  if (!cond) return null;

  if (cond.type !== "playerVar" && cond.type !== "npcVar" && cond.type !== "hotspotVar") {
    return null;
  }

  const def = getVarDefForCondition(ctx, cond);
  if (!def || def.type !== "number") return null;

const value = cond.value;

if (typeof value !== "number" || !Number.isFinite(value)) {
  return "El valor debe ser numérico.";
}

  if (value < def.min || value > def.max) {
    return `El valor debe estar entre ${def.min} y ${def.max}.`;
  }

  if (cond.op === "<" && value < def.min + 1) {
    return `Con el operador <, el valor debe ser al menos ${def.min + 1}.`;
  }

  if (cond.op === ">" && value > def.max - 1) {
    return `Con el operador >, el valor debe ser como máximo ${def.max - 1}.`;
  }

  return null;
}

export function applyLeafPatch(ctx: LeafCtx, prev: EnabledLeafCondition, patch: Partial<EnabledLeafCondition>): EnabledLeafCondition {
  const next = { ...prev, ...patch } as EnabledLeafCondition;

  switch (next.type) {
    case "playerVar":
    case "npcVar":
    case "hotspotVar":
      return normalizeVarLeaf(ctx, next);

    default: {
      const normalized = {
        ...next,
        value: normalizeBoolean((next as { value?: unknown }).value),
      };

      if (normalized.type === "mapRegionVisited") {
        if (!normalized.mapId && ctx.idx.getMapOptions().length === 1) normalized.mapId = getSingleMapId(ctx);

        if (prev.type === "mapRegionVisited" && prev.mapId !== normalized.mapId) normalized.regionId = "";
      }

      if (normalized.type === "npcHasItem") {
        if (prev.type === "npcHasItem" && prev.npcId !== normalized.npcId) normalized.itemInstanceId = "";
      }

      return normalized;
    }
  }
}

export function enabledLeafTypesForContext(ctx: LeafCtx): EnabledLeafType[] {
  const p = ctx.idx.project;
  if (!p) return ["nodeVisited", "hasItem"];

  const hasPlacedItems = ctx.idx.getPlacedItems().length > 0;
  const hasHotspots = ctx.idx.getHotspots().length > 0;
  const hasPlacedNpcs = ctx.idx.getPlacedNpcs().length > 0;
  const hasPlacedPlayers = ctx.idx.getPlacedPlayers().length > 0;
  const hasPlacedPlayerImages = ctx.idx.getPlacedPlayers().some((placedPlayer) => {
    const player = p.players?.find((item) => item.id === placedPlayer.playerId);
    return (player?.images?.length ?? 0) > 0;
  });

  const hasHotspotVars = ctx.idx.getHotspots().some((h) => h.vars?.length);
  const hasNpcVars = p.npcs?.some((n) => n.vars?.length);
  const hasPlayerVars = ctx.idx.getPlacedPlayers().some((pl) => p.players.find((p) => p.id === pl.playerId)?.vars?.length);

  const hasGameItems = ctx.idx.getGameItemOptions().length > 0;

  const hasRegions = p.maps?.some((m) => m.regions?.length);

  const out: EnabledLeafType[] = ["nodeVisited"];

  if (hasGameItems) out.push("hasItem");
  if (hasPlacedItems) out.push("placedItemVisible", "placedItemReachable");
  if (hasHotspots) out.push("hotspotVisible", "hotspotReachable");
  if (hasHotspotVars) out.push("hotspotVar");
  if (hasPlacedNpcs) out.push("placedNpcVisible", "placedNpcReachable");
  if (hasNpcVars) out.push("npcVar");
  if (hasGameItems) out.push("npcHasItem");
  if (hasPlacedPlayers) {
    out.push("placedPlayerVisible");
    if (hasPlacedPlayerImages) out.push("placedPlayerImage");
    if (hasPlayerVars) out.push("playerVar");
  }
  if (hasRegions) out.push("mapRegionVisited");

  return out;
}