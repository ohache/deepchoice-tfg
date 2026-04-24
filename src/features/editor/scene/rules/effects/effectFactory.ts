import type { ID } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import type { Option } from "@/components/Select";
import type { FactoryCtx } from "@/features/editor/scene/rules/effects/effectShared";
import type { OwnerVarKind } from "@/features/editor/scene/rules/effects/effectProjectIndex";
import type { EffectFamilyId } from "@/features/editor/scene/rules/effects/effectFamilies";

export type { FactoryCtx, EffectCtx, EffectOwner } from "@/features/editor/scene/rules/effects/effectShared";
export type { OwnerVarKind, ProjectIndex } from "@/features/editor/scene/rules/effects/effectProjectIndex";
export { createProjectIndex } from "@/features/editor/scene/rules/effects/effectProjectIndex";

/* Helpers */
function normalizeBoolean(value: unknown): boolean {
  return Boolean(value);
}

function normalizeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function optionOf(id: string, label?: string): Option<string> {
  return { id, label: label || id };
}

/* Efectos disponibles */
type LeafByType<T extends Effect["type"]> = Extract<Effect, { type: T }>;

export type EnabledEffect =
  | LeafByType<"showMessage">
  | LeafByType<"goToNode">
  | LeafByType<"addItem">
  | LeafByType<"removeItem">
  | LeafByType<"startDialogue">
  | LeafByType<"endDialogue">
  | LeafByType<"giveItemToNpc">
  | LeafByType<"receiveItemFromNpc">
  | LeafByType<"setPlacedItemVisible">
  | LeafByType<"setPlacedItemReachable">
  | LeafByType<"setHotspotVisible">
  | LeafByType<"setHotspotReachable">
  | LeafByType<"setHotspotVar">
  | LeafByType<"toggleHotspotVar">
  | LeafByType<"incHotspotVar">
  | LeafByType<"decHotspotVar">
  | LeafByType<"setPlacedPlayerVisible">
  | LeafByType<"setPlacedPlayerImage">
  | LeafByType<"setPlacedNpcVisible">
  | LeafByType<"setPlacedNpcReachable">
  | LeafByType<"setPlayerVar">
  | LeafByType<"togglePlayerVar">
  | LeafByType<"incPlayerVar">
  | LeafByType<"decPlayerVar">
  | LeafByType<"setNpcVar">
  | LeafByType<"toggleNpcVar">
  | LeafByType<"incNpcVar">
  | LeafByType<"decNpcVar">
  | LeafByType<"playSfx">
  | LeafByType<"playMusic">
  | LeafByType<"pauseMusic">
  | LeafByType<"stopMusic">
  | LeafByType<"setMapRegionAvailable">
  | LeafByType<"endGame">;

export type EnabledEffectType = EnabledEffect["type"];

/* Tipos base potencialmente disponibles. Se filtran según el contexto y el owner actual */
const BASE_ENABLED_EFFECT_TYPES: EnabledEffectType[] = ["showMessage", "goToNode", "removeItem", "startDialogue", "setPlacedItemVisible", "setPlacedItemReachable",
  "setHotspotVisible", "setHotspotReachable", "setPlacedPlayerVisible", "setPlacedNpcVisible", "setPlacedNpcReachable", "setPlayerVar", "togglePlayerVar", "incPlayerVar",
  "decPlayerVar", "setNpcVar", "toggleNpcVar", "incNpcVar", "decNpcVar", "playSfx", "playMusic", "pauseMusic", "stopMusic", "setMapRegionAvailable", "endGame"];

function dedupeEffectTypes(types: EnabledEffectType[]): EnabledEffectType[] {
  return Array.from(new Set(types));
}

export function enabledEffectTypes(factory: FactoryCtx): EnabledEffectType[] {
  const ownerKind = factory.ctx.owner.kind;

  const hasPlacedItems = factory.idx.getPlacedItems().length > 0;

  const nodeHotspots = factory.idx.getNodeHotspots(factory.ctx.nodeId);
  const hasHotspots = nodeHotspots.length > 0;
  const hasHotspotVars = nodeHotspots.some((hotspot) => factory.idx.getHotspotVarOptions(factory.ctx.nodeId, hotspot.id).length > 0);

  const hasDialogues = factory.idx.getDialogueOptions(factory.ctx.nodeId).length > 0;

  const hasPlacedNpcs = factory.idx.getPlacedNpcs().length > 0;
  const hasNpcs = factory.idx.getNpcOptions().length > 0;
  const hasNpcVars = factory.idx.getNpcOptions().some((npc) => factory.idx.getNpcVarOptions(npc.id).length > 0);

  const hasPlacedPlayers = factory.idx.getPlacedPlayers().length > 0;
  const hasPlayers = factory.idx.getPlayerOptions().length > 0;
  const hasPlacedPlayersWithMultipleImages = factory.idx.getPlacedPlayers().some((player) => factory.idx.getPlayerImageOptions(player.playerId).length > 1);
  const hasPlayerVars = factory.idx.getPlacedPlayerOptions().some((player) => factory.idx.getPlayerVarOptions(player.id).length > 0);

  const hasMaps = factory.idx.getMapOptions().length > 0;
  const hasSfx = factory.idx.getSfxOptions().length > 0;
  const hasMusic = factory.idx.getMusicOptions().length > 0;

  const canUseAudio = hasSfx || hasMusic;
  const canUseProgress = hasMaps || factory.idx.getNodeOptions({ excludeNodeId: factory.ctx.nodeId }).length > 0;

  const filtered = BASE_ENABLED_EFFECT_TYPES.filter((type) => {
    if (!canUseProgress && (type === "goToNode" || type === "setMapRegionAvailable")) return false;
    if (!hasPlacedItems && (type === "removeItem" || type === "setPlacedItemVisible" || type === "setPlacedItemReachable")) return false;
    if (!hasHotspots && (type === "setHotspotVisible" || type === "setHotspotReachable")) return false;
    if (!hasHotspotVars && (type === "setHotspotVar" || type === "toggleHotspotVar" || type === "incHotspotVar" || type === "decHotspotVar")) return false;
    if (!hasDialogues && type === "startDialogue") return false;
    if (!hasPlacedNpcs && (type === "setPlacedNpcVisible" || type === "setPlacedNpcReachable")) return false;
    if (!hasPlacedPlayers && type === "setPlacedPlayerVisible") return false;
    if (!hasPlacedPlayersWithMultipleImages && type === "setPlacedPlayerImage") return false;
    if (!(hasPlayers && hasPlayerVars) && (type === "setPlayerVar" || type === "togglePlayerVar" || type === "incPlayerVar" || type === "decPlayerVar")) return false;
    if (!(hasNpcs && hasNpcVars) && (type === "setNpcVar" || type === "toggleNpcVar" || type === "incNpcVar" || type === "decNpcVar")) return false;
    if (!hasMaps && type === "setMapRegionAvailable") return false;
    if (!hasSfx && type === "playSfx") return false;
    if (!hasMusic && (type === "playMusic" || type === "pauseMusic" || type === "stopMusic")) return false;
    if (!canUseAudio && (type === "playSfx" || type === "playMusic" || type === "pauseMusic" || type === "stopMusic")) return false;

    return true;
  });

  switch (ownerKind) {
    case "hotspot":
      return dedupeEffectTypes(hasHotspotVars ? [...filtered, "setHotspotVar", "toggleHotspotVar", "incHotspotVar", "decHotspotVar"] : filtered);

    case "placedItem":
      return dedupeEffectTypes(hasPlacedItems ? [...filtered, "addItem"] : filtered);

    case "placedNpc":
      return dedupeEffectTypes(hasPlacedNpcs ? [...filtered, "giveItemToNpc"] : filtered);

    case "dialogueLine": {
      const dialogueOnly: EnabledEffectType[] = [
        ...filtered.filter((type) => type !== "showMessage"),
        "endDialogue",
      ];

      if (hasPlacedNpcs) dialogueOnly.push("giveItemToNpc", "receiveItemFromNpc");

      return dedupeEffectTypes(dialogueOnly);
    }

    default:
      return dedupeEffectTypes(filtered);
  }
}

type EffectFieldControl = "id-select" | "text" | "bool" | "number" | "var-value";

export type EffectFieldSpec = {
  key: string;
  label: string;
  path: string;
  control: EffectFieldControl;
  className?: string;
  optionsResolver?: (factory: FactoryCtx, effect: EnabledEffect) => Option<string>[];
  disabledWhen?: (factory: FactoryCtx, effect: EnabledEffect) => boolean;
  visibleWhen?: (factory: FactoryCtx, effect: EnabledEffect) => boolean;
};

export type EffectUiSpec = {
  layoutClassName?: string;
  fields: EffectFieldSpec[];
};

type EffectSpec<T extends EnabledEffect> = {
  familyId: EffectFamilyId;
  label: string;
  ui: EffectUiSpec;
  makeDefault: (factory: FactoryCtx) => T;
  summarize: (factory: FactoryCtx, effect: T) => string;
  normalize: (factory: FactoryCtx, effect: T) => T;
};

/* Field helpers */
function boolField(path: string, label: string): EffectFieldSpec {
  return { key: path, label, path, control: "bool" };
}

function numberField(path: string, label: string): EffectFieldSpec {
  return { key: path, label, path, control: "number" };
}

function textField(path: string, label: string): EffectFieldSpec {
  return { key: path, label, path, control: "text" };
}

function itemField(path = "placedItemId", label = "Item"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getPlacedItemOptions() };
}

function npcField(path = "npcId", label = "NPC"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getNpcOptions() };
}

function playerField(path = "playerId", label = "Player"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getPlayerOptions() };
}

function hotspotField(): EffectFieldSpec {
  return { key: "hotspotId", label: "Hotspot", path: "hotspotId", control: "id-select", optionsResolver: (factory) => factory.idx.getHotspotOptions(factory.ctx.nodeId) };
}

function hotspotVarField<T extends | LeafByType<"setHotspotVar"> | LeafByType<"toggleHotspotVar"> | LeafByType<"incHotspotVar"> | LeafByType<"decHotspotVar">>(): EffectFieldSpec {
  return { key: "varId", label: "Variable", path: "varId", control: "id-select",
    optionsResolver: (factory, effect) => {
      const hotspotId = (effect as T).hotspotId;
      return factory.idx.getHotspotVarOptions(factory.ctx.nodeId, hotspotId);
    },
    disabledWhen: (_factory, effect) => !(effect as T).hotspotId,
  };
}

function placedPlayerField(path = "playerId", label = "Player colocado"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getPlacedPlayerOptions() };
}

function placedNpcField(path = "npcId", label = "NPC"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getPlacedNpcOptions() };
}

function placedPlayerImageField(): EffectFieldSpec {
  return { key: "imageId", label: "Imagen", path: "imageId", control: "id-select",
    optionsResolver: (factory, effect) => {
      const playerId = (effect as LeafByType<"setPlacedPlayerImage">).playerId;
      return playerId ? factory.idx.getPlayerImageOptions(playerId) : [];
    },
    disabledWhen: (_factory, effect) => !(effect as LeafByType<"setPlacedPlayerImage">).playerId,
  };
}

function playerVarField<T extends | LeafByType<"setPlayerVar"> | LeafByType<"togglePlayerVar"> | LeafByType<"incPlayerVar"> | LeafByType<"decPlayerVar">>(): EffectFieldSpec {
  return { key: "varId", label: "Variable", path: "varId", control: "id-select",
    optionsResolver: (factory, effect) => {
      const playerId = (effect as T).playerId;
      return factory.idx.getPlayerVarOptions(playerId);
    },
    disabledWhen: (_factory, effect) => !(effect as T).playerId,
  };
}

function npcVarField<T extends | LeafByType<"setNpcVar"> | LeafByType<"toggleNpcVar"> | LeafByType<"incNpcVar"> | LeafByType<"decNpcVar">>(): EffectFieldSpec {
  return { key: "varId", label: "Variable", path: "varId", control: "id-select",
    optionsResolver: (factory, effect) => {
      const npcId = (effect as T).npcId;
      return factory.idx.getNpcVarOptions(npcId);
    },
    disabledWhen: (_factory, effect) => !(effect as T).npcId,
  };
}

function mapField(): EffectFieldSpec {
  return { key: "mapId", label: "Mapa", path: "mapId", control: "id-select", optionsResolver: (factory) => factory.idx.getMapOptions() };
}

function mapRegionField(): EffectFieldSpec {
  return { key: "regionId", label: "Región", path: "regionId", control: "id-select",
    optionsResolver: (factory, effect) => {
      const mapId = (effect as LeafByType<"setMapRegionAvailable">).mapId;
      return factory.idx.getMapRegionOptions(mapId);
    },
    disabledWhen: (_factory, effect) => !(effect as LeafByType<"setMapRegionAvailable">).mapId,
  };
}

function summarizeHotspotBool(factory: FactoryCtx, hotspotId: ID, label: string, value: boolean): string {
  const hotspot = factory.idx.getHotspotLabel(factory.ctx.nodeId, hotspotId);
  return `${hotspot}: ${label} = ${String(value)}`;
}

function summarizeHotspotVar(factory: FactoryCtx, hotspotId: ID, varId: ID, prefix: string, suffix?: string): string {
  const hotspot = factory.idx.getHotspotLabel(factory.ctx.nodeId, hotspotId);
  const varLabel = factory.idx.getHotspotVarLabel(factory.ctx.nodeId, hotspotId, varId);
  return `${hotspot}: ${prefix} ${varLabel}${suffix ? ` ${suffix}` : ""}`;
}

function normalizeHotspotId(factory: FactoryCtx, hotspotId: ID | undefined): ID {
  return hotspotId || factory.idx.getHotspotOptions(factory.ctx.nodeId)[0]?.id || "";
}

function normalizePlayerVarValue(factory: FactoryCtx, effect: LeafByType<"setPlayerVar">): boolean | number {
  const kind = factory.idx.getPlayerVarKind(effect.playerId, effect.varId);
  return kind === "number"
    ? normalizeNumber(effect.value)
    : normalizeBoolean(effect.value);
}

function normalizeNpcVarValue(factory: FactoryCtx, effect: LeafByType<"setNpcVar">): boolean | number {
  const kind = factory.idx.getNpcVarKind(effect.npcId, effect.varId);
  return kind === "number"
    ? normalizeNumber(effect.value)
    : normalizeBoolean(effect.value);
}

function normalizeHotspotVarValue(factory: FactoryCtx, effect: LeafByType<"setHotspotVar">): boolean | number {
  const hotspotId = normalizeHotspotId(factory, effect.hotspotId);
  const kind = factory.idx.getHotspotVarKind(factory.ctx.nodeId, hotspotId, effect.varId);

  return kind === "number"
    ? normalizeNumber(effect.value)
    : normalizeBoolean(effect.value);
}

/* Registro */
export const EFFECT_REGISTRY: { [K in EnabledEffectType]: EffectSpec<Extract<EnabledEffect, { type: K }>> } = {
  showMessage: {
    familyId: "message",
    label: "Mostrar mensaje",
    ui: {
      layoutClassName: "grid grid-cols-1 gap-2",
      fields: [textField("text", "Texto")],
    },
    makeDefault: () => ({ type: "showMessage", text: "" }),
    summarize: (_factory, effect) => {
      const text = String(effect.text ?? "").trim();
      return text
        ? `“${text.length > 40 ? `${text.slice(0, 40)}…` : text}”`
        : "";
    },
    normalize: (_factory, effect) => ({ ...effect, text: String(effect.text ?? "") }),
  },

  goToNode: {
    familyId: "progress",
    label: "Ir a escena",
    ui: {
      layoutClassName: "grid grid-cols-1 gap-2",
      fields: [
        {
          key: "targetNodeId",
          label: "Destino",
          path: "targetNodeId",
          control: "id-select",
          optionsResolver: (factory) =>
            factory.idx.getNodeOptions({ excludeNodeId: factory.ctx.nodeId }),
        },
      ],
    },
    makeDefault: () => ({ type: "goToNode", targetNodeId: "" }),
    summarize: ({ idx }, effect) => `${idx.getNodeLabel(effect.targetNodeId)}`,
    normalize: (_factory, effect) => ({
      ...effect,
      targetNodeId: String(effect.targetNodeId ?? "").trim(),
    }),
  },

  addItem: {
    familyId: "item",
    label: "Añadir al inventario",
    ui: {
      layoutClassName: "grid grid-cols-1 gap-2",
      fields: [itemField()],
    },
    makeDefault: () => ({ type: "addItem", placedItemId: "" }),
    summarize: ({ idx }, effect) => `${idx.getPlacedItemLabel(effect.placedItemId)}`,
    normalize: (_factory, effect) => ({
      ...effect,
      placedItemId: String(effect.placedItemId ?? "").trim(),
    }),
  },

  removeItem: {
    familyId: "item",
    label: "Eliminar del inventario",
    ui: {
      layoutClassName: "grid grid-cols-1 gap-2",
      fields: [itemField()],
    },
    makeDefault: () => ({ type: "removeItem", placedItemId: "" }),
    summarize: ({ idx }, effect) => `${idx.getPlacedItemLabel(effect.placedItemId)}`,
    normalize: (_factory, effect) => ({
      ...effect,
      placedItemId: String(effect.placedItemId ?? "").trim(),
    }),
  },

  startDialogue: {
    familyId: "dialogue",
    label: "Iniciar diálogo",
    ui: {
      layoutClassName: "grid grid-cols-1 gap-2",
      fields: [
        {
          key: "nodeDialogueId",
          label: "Diálogo",
          path: "nodeDialogueId",
          control: "id-select",
          optionsResolver: (factory) =>
            factory.idx.getDialogueOptions(factory.ctx.nodeId),
        },
      ],
    },
    makeDefault: (factory) => ({
      type: "startDialogue",
      nodeDialogueId: factory.idx.getDialogueOptions(factory.ctx.nodeId)[0]?.id ?? "",
    }),
    summarize: (factory, effect) =>
      `${factory.idx.getDialogueLabel(factory.ctx.nodeId, effect.nodeDialogueId)}`,
    normalize: (_factory, effect) => ({
      ...effect,
      nodeDialogueId: String(effect.nodeDialogueId ?? "").trim(),
    }),
  },

  endDialogue: {
    familyId: "dialogue",
    label: "Terminar diálogo",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [] },
    makeDefault: () => ({ type: "endDialogue" }),
    summarize: () => "",
    normalize: (_factory, effect) => ({ ...effect }),
  },

  giveItemToNpc: {
    familyId: "npc",
    label: "Dar item",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [npcField(), itemField()],
    },
    makeDefault: () => ({ type: "giveItemToNpc", npcId: "", placedItemId: "" }),
    summarize: ({ idx }, effect) =>
      `${idx.getPlacedItemLabel(effect.placedItemId)} a ${idx.getNpcLabel(effect.npcId)}`,
    normalize: (_factory, effect) => ({
      ...effect,
      npcId: String(effect.npcId ?? "").trim(),
      placedItemId: String(effect.placedItemId ?? "").trim(),
    }),
  },

  receiveItemFromNpc: {
    familyId: "npc",
    label: "Recibir item",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [npcField(), itemField()],
    },
    makeDefault: () => ({ type: "receiveItemFromNpc", npcId: "", placedItemId: "" }),
    summarize: ({ idx }, effect) =>
      `${idx.getPlacedItemLabel(effect.placedItemId)} de ${idx.getNpcLabel(effect.npcId)}`,
    normalize: (_factory, effect) => ({
      ...effect,
      npcId: String(effect.npcId ?? "").trim(),
      placedItemId: String(effect.placedItemId ?? "").trim(),
    }),
  },

  setPlacedItemVisible: {
    familyId: "item",
    label: "Visible",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [itemField(), boolField("value", "Valor")],
    },
    makeDefault: (factory) => ({
      type: "setPlacedItemVisible",
      nodeId: factory.ctx.nodeId,
      placedItemId: "",
      value: true,
    }),
    summarize: ({ idx }, effect) =>
      `${idx.getPlacedItemLabel(effect.placedItemId)} = ${String(effect.value)}`,
    normalize: (factory, effect) => ({
      ...effect,
      nodeId: factory.ctx.nodeId,
      placedItemId: String(effect.placedItemId ?? "").trim(),
      value: Boolean(effect.value),
    }),
  },

  setPlacedItemReachable: {
    familyId: "item",
    label: "Alcanzable",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [itemField(), boolField("value", "Valor")],
    },
    makeDefault: (factory) => ({
      type: "setPlacedItemReachable",
      nodeId: factory.ctx.nodeId,
      placedItemId: "",
      value: true,
    }),
    summarize: ({ idx }, effect) =>
      `${idx.getPlacedItemLabel(effect.placedItemId)} = ${String(effect.value)}`,
    normalize: (factory, effect) => ({
      ...effect,
      nodeId: factory.ctx.nodeId,
      placedItemId: String(effect.placedItemId ?? "").trim(),
      value: Boolean(effect.value),
    }),
  },

  setHotspotVisible: {
    familyId: "hotspot",
    label: "Visible",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [
        hotspotField(),
        {
          ...boolField("value", "Valor"),
          disabledWhen: (_factory, effect) =>
            !(effect as LeafByType<"setHotspotVisible">).hotspotId,
        },
      ],
    },
    makeDefault: () => ({
      type: "setHotspotVisible",
      hotspotId: "",
      value: true,
    }),
    summarize: (factory, effect) =>
      summarizeHotspotBool(factory, effect.hotspotId, "visible", effect.value),
    normalize: (factory, effect) => ({
      ...effect,
      hotspotId: normalizeHotspotId(factory, effect.hotspotId),
      value: Boolean(effect.value),
    }),
  },

  setHotspotReachable: {
    familyId: "hotspot",
    label: "Alcanzable",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [
        hotspotField(),
        {
          ...boolField("value", "Valor"),
          disabledWhen: (_factory, effect) =>
            !(effect as LeafByType<"setHotspotReachable">).hotspotId,
        },
      ],
    },
    makeDefault: () => ({
      type: "setHotspotReachable",
      hotspotId: "",
      value: true,
    }),
    summarize: (factory, effect) =>
      summarizeHotspotBool(factory, effect.hotspotId, "alcanzable", effect.value),
    normalize: (factory, effect) => ({
      ...effect,
      hotspotId: normalizeHotspotId(factory, effect.hotspotId),
      value: Boolean(effect.value),
    }),
  },

  setHotspotVar: {
    familyId: "hotspot",
    label: "Variable",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [
        hotspotField(),
        hotspotVarField<LeafByType<"setHotspotVar">>(),
        { key: "value", label: "Valor", path: "value", control: "var-value" },
      ],
    },
    makeDefault: () => ({
      type: "setHotspotVar",
      hotspotId: "",
      varId: "",
      value: true,
    }),
    summarize: (factory, effect) =>
      summarizeHotspotVar(factory, effect.hotspotId, effect.varId, "Set", `= ${String(effect.value)}`),
    normalize: (factory, effect) => ({
      ...effect,
      hotspotId: normalizeHotspotId(factory, effect.hotspotId),
      value: normalizeHotspotVarValue(factory, effect),
    }),
  },

  toggleHotspotVar: {
    familyId: "hotspot",
    label: "Toggle",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [hotspotField(), hotspotVarField<LeafByType<"toggleHotspotVar">>()],
    },
    makeDefault: () => ({
      type: "toggleHotspotVar",
      hotspotId: "",
      varId: "",
    }),
    summarize: (factory, effect) =>
      summarizeHotspotVar(factory, effect.hotspotId, effect.varId, "Toggle"),
    normalize: (factory, effect) => ({
      ...effect,
      hotspotId: normalizeHotspotId(factory, effect.hotspotId),
    }),
  },

  incHotspotVar: {
    familyId: "hotspot",
    label: "Incrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [
        hotspotField(),
        hotspotVarField<LeafByType<"incHotspotVar">>(),
        numberField("amount", "Cantidad"),
      ],
    },
    makeDefault: () => ({
      type: "incHotspotVar",
      hotspotId: "",
      varId: "",
      amount: 1,
    }),
    summarize: (factory, effect) =>
      summarizeHotspotVar(factory, effect.hotspotId, effect.varId, "Inc", `(+${String(effect.amount ?? 1)})`),
    normalize: (factory, effect) => ({
      ...effect,
      hotspotId: normalizeHotspotId(factory, effect.hotspotId),
      amount: effect.amount == null ? 1 : normalizeNumber(effect.amount),
    }),
  },

  decHotspotVar: {
    familyId: "hotspot",
    label: "Decrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [
        hotspotField(),
        hotspotVarField<LeafByType<"decHotspotVar">>(),
        numberField("amount", "Cantidad"),
      ],
    },
    makeDefault: () => ({
      type: "decHotspotVar",
      hotspotId: "",
      varId: "",
      amount: 1,
    }),
    summarize: (factory, effect) =>
      summarizeHotspotVar(factory, effect.hotspotId, effect.varId, "Dec", `(-${String(effect.amount ?? 1)})`),
    normalize: (factory, effect) => ({
      ...effect,
      hotspotId: normalizeHotspotId(factory, effect.hotspotId),
      amount: effect.amount == null ? 1 : normalizeNumber(effect.amount),
    }),
  },

  setPlacedPlayerVisible: {
    familyId: "player",
    label: "Visible",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [
        placedPlayerField("playerId", "Player"),
        {
          ...boolField("value", "Valor"),
          disabledWhen: (_factory, effect) =>
            !(effect as LeafByType<"setPlacedPlayerVisible">).playerId,
        },
      ],
    },
    makeDefault: (factory) => ({
      type: "setPlacedPlayerVisible",
      nodeId: factory.ctx.nodeId,
      playerId: "",
      value: true,
    }),
    summarize: ({ idx }, effect) =>
      `Player: ${idx.getPlacedPlayerLabel(effect.playerId)} = ${String(effect.value)}`,
    normalize: (factory, effect) => ({
      ...effect,
      nodeId: factory.ctx.nodeId,
      playerId: String(effect.playerId ?? "").trim(),
      value: Boolean(effect.value),
    }),
  },

  setPlacedPlayerImage: {
    familyId: "player",
    label: "Cambiar imagen",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [placedPlayerField("playerId", "Player"), placedPlayerImageField()],
    },
    makeDefault: (factory) => ({
      type: "setPlacedPlayerImage",
      nodeId: factory.ctx.nodeId,
      playerId: "",
      imageId: "",
    }),
    summarize: ({ idx }, effect) =>
      `${idx.getPlacedPlayerLabel(effect.playerId)}: ${idx.getPlayerImageLabel(effect.playerId, effect.imageId)}`,
    normalize: (factory, effect) => ({
      ...effect,
      nodeId: factory.ctx.nodeId,
      playerId: String(effect.playerId ?? "").trim(),
      imageId: String(effect.imageId ?? "").trim(),
    }),
  },

  setPlacedNpcVisible: {
    familyId: "npc",
    label: "Visible",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [
        placedNpcField(),
        {
          ...boolField("value", "Valor"),
          disabledWhen: (_factory, effect) =>
            !(effect as LeafByType<"setPlacedNpcVisible">).npcId,
        },
      ],
    },
    makeDefault: (factory) => ({
      type: "setPlacedNpcVisible",
      nodeId: factory.ctx.nodeId,
      npcId: "",
      value: true,
    }),
    summarize: ({ idx }, effect) =>
      `NPC: ${idx.getPlacedNpcLabel(effect.npcId)} = ${String(effect.value)}`,
    normalize: (factory, effect) => ({
      ...effect,
      nodeId: factory.ctx.nodeId,
      npcId: String(effect.npcId ?? "").trim(),
      value: Boolean(effect.value),
    }),
  },

  setPlacedNpcReachable: {
    familyId: "npc",
    label: "Alcanzable",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [
        placedNpcField(),
        {
          ...boolField("value", "Valor"),
          disabledWhen: (_factory, effect) =>
            !(effect as LeafByType<"setPlacedNpcReachable">).npcId,
        },
      ],
    },
    makeDefault: (factory) => ({
      type: "setPlacedNpcReachable",
      nodeId: factory.ctx.nodeId,
      npcId: "",
      value: true,
    }),
    summarize: ({ idx }, effect) =>
      `NPC: ${idx.getPlacedNpcLabel(effect.npcId)} = ${String(effect.value)}`,
    normalize: (factory, effect) => ({
      ...effect,
      nodeId: factory.ctx.nodeId,
      npcId: String(effect.npcId ?? "").trim(),
      value: Boolean(effect.value),
    }),
  },

  setPlayerVar: {
    familyId: "player",
    label: "Variable",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [
        playerField(),
        playerVarField<LeafByType<"setPlayerVar">>(),
        { key: "value", label: "Valor", path: "value", control: "var-value" },
      ],
    },
    makeDefault: () => ({
      type: "setPlayerVar",
      playerId: "",
      varId: "",
      value: true,
    }),
    summarize: ({ idx }, effect) =>
      `Player ${idx.getPlayerLabel(effect.playerId)} · ${idx.getPlayerVarLabel(effect.playerId, effect.varId)} = ${String(effect.value)}`,
    normalize: (factory, effect) => ({
      ...effect,
      playerId: String(effect.playerId ?? "").trim(),
      varId: String(effect.varId ?? "").trim(),
      value: normalizePlayerVarValue(factory, effect),
    }),
  },

  togglePlayerVar: {
    familyId: "player",
    label: "Toggle",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [playerField(), playerVarField<LeafByType<"togglePlayerVar">>()],
    },
    makeDefault: () => ({ type: "togglePlayerVar", playerId: "", varId: "" }),
    summarize: ({ idx }, effect) =>
      `Toggle ${idx.getPlayerLabel(effect.playerId)} · ${idx.getPlayerVarLabel(effect.playerId, effect.varId)}`,
    normalize: (_factory, effect) => ({
      ...effect,
      playerId: String(effect.playerId ?? "").trim(),
      varId: String(effect.varId ?? "").trim(),
    }),
  },

  incPlayerVar: {
    familyId: "player",
    label: "Incrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [
        playerField(),
        playerVarField<LeafByType<"incPlayerVar">>(),
        numberField("amount", "Cantidad"),
      ],
    },
    makeDefault: () => ({
      type: "incPlayerVar",
      playerId: "",
      varId: "",
      amount: 1,
    }),
    summarize: ({ idx }, effect) =>
      `Inc ${idx.getPlayerLabel(effect.playerId)} · ${idx.getPlayerVarLabel(effect.playerId, effect.varId)} (+${String(effect.amount ?? 1)})`,
    normalize: (_factory, effect) => ({
      ...effect,
      playerId: String(effect.playerId ?? "").trim(),
      varId: String(effect.varId ?? "").trim(),
      amount: effect.amount == null ? 1 : normalizeNumber(effect.amount),
    }),
  },

  decPlayerVar: {
    familyId: "player",
    label: "Decrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [
        playerField(),
        playerVarField<LeafByType<"decPlayerVar">>(),
        numberField("amount", "Cantidad"),
      ],
    },
    makeDefault: () => ({
      type: "decPlayerVar",
      playerId: "",
      varId: "",
      amount: 1,
    }),
    summarize: ({ idx }, effect) =>
      `Dec ${idx.getPlayerLabel(effect.playerId)} · ${idx.getPlayerVarLabel(effect.playerId, effect.varId)} (-${String(effect.amount ?? 1)})`,
    normalize: (_factory, effect) => ({
      ...effect,
      playerId: String(effect.playerId ?? "").trim(),
      varId: String(effect.varId ?? "").trim(),
      amount: effect.amount == null ? 1 : normalizeNumber(effect.amount),
    }),
  },

  setNpcVar: {
    familyId: "npc",
    label: "Variable",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [
        npcField(),
        npcVarField<LeafByType<"setNpcVar">>(),
        { key: "value", label: "Valor", path: "value", control: "var-value" },
      ],
    },
    makeDefault: () => ({ type: "setNpcVar", npcId: "", varId: "", value: true }),
    summarize: ({ idx }, effect) =>
      `NPC ${idx.getNpcLabel(effect.npcId)} · ${idx.getNpcVarLabel(effect.npcId, effect.varId)} = ${String(effect.value)}`,
    normalize: (factory, effect) => ({
      ...effect,
      npcId: String(effect.npcId ?? "").trim(),
      varId: String(effect.varId ?? "").trim(),
      value: normalizeNpcVarValue(factory, effect),
    }),
  },

  toggleNpcVar: {
    familyId: "npc",
    label: "Toggle",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [npcField(), npcVarField<LeafByType<"toggleNpcVar">>()],
    },
    makeDefault: () => ({ type: "toggleNpcVar", npcId: "", varId: "" }),
    summarize: ({ idx }, effect) =>
      `Toggle ${idx.getNpcLabel(effect.npcId)} · ${idx.getNpcVarLabel(effect.npcId, effect.varId)}`,
    normalize: (_factory, effect) => ({
      ...effect,
      npcId: String(effect.npcId ?? "").trim(),
      varId: String(effect.varId ?? "").trim(),
    }),
  },

  incNpcVar: {
    familyId: "npc",
    label: "Incrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [
        npcField(),
        npcVarField<LeafByType<"incNpcVar">>(),
        numberField("amount", "Cantidad"),
      ],
    },
    makeDefault: () => ({ type: "incNpcVar", npcId: "", varId: "", amount: 1 }),
    summarize: ({ idx }, effect) =>
      `Inc ${idx.getNpcLabel(effect.npcId)} · ${idx.getNpcVarLabel(effect.npcId, effect.varId)} (+${String(effect.amount ?? 1)})`,
    normalize: (_factory, effect) => ({
      ...effect,
      npcId: String(effect.npcId ?? "").trim(),
      varId: String(effect.varId ?? "").trim(),
      amount: effect.amount == null ? 1 : normalizeNumber(effect.amount),
    }),
  },

  decNpcVar: {
    familyId: "npc",
    label: "Decrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [
        npcField(),
        npcVarField<LeafByType<"decNpcVar">>(),
        numberField("amount", "Cantidad"),
      ],
    },
    makeDefault: () => ({ type: "decNpcVar", npcId: "", varId: "", amount: 1 }),
    summarize: ({ idx }, effect) =>
      `Dec ${idx.getNpcLabel(effect.npcId)} · ${idx.getNpcVarLabel(effect.npcId, effect.varId)} (-${String(effect.amount ?? 1)})`,
    normalize: (_factory, effect) => ({
      ...effect,
      npcId: String(effect.npcId ?? "").trim(),
      varId: String(effect.varId ?? "").trim(),
      amount: effect.amount == null ? 1 : normalizeNumber(effect.amount),
    }),
  },

  playSfx: {
    familyId: "audio",
    label: "Reproducir SFX",
    ui: {
      layoutClassName: "grid grid-cols-1 gap-2",
      fields: [
        {
          key: "sfxId",
          label: "Efecto de sonido",
          path: "sfxId",
          control: "id-select",
          optionsResolver: (factory) => factory.idx.getSfxOptions(),
        },
      ],
    },
    makeDefault: () => ({ type: "playSfx", sfxId: "" }),
    summarize: ({ idx }, effect) => `${idx.getSfxLabel(effect.sfxId)}`,
    normalize: (_factory, effect) => ({
      ...effect,
      sfxId: String(effect.sfxId ?? "").trim(),
    }),
  },

  playMusic: {
    familyId: "audio",
    label: "Reproducir música",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [
        {
          key: "trackId",
          label: "Pista",
          path: "trackId",
          control: "id-select",
          optionsResolver: (factory) => factory.idx.getMusicOptions(),
        },
        {
          key: "startAt",
          label: "Inicio",
          path: "startAt",
          control: "id-select",
          optionsResolver: () => [
            optionOf("resume", "Reanudar"),
            optionOf("restart", "Reiniciar"),
          ],
        },
      ],
    },
    makeDefault: () => ({ type: "playMusic", trackId: "", startAt: "resume" }),
    summarize: ({ idx }, effect) => `${idx.getMusicLabel(effect.trackId)}`,
    normalize: (_factory, effect) => ({
      ...effect,
      trackId: String(effect.trackId ?? "").trim(),
      startAt: effect.startAt === "restart" ? "restart" : "resume",
    }),
  },

  pauseMusic: {
    familyId: "audio",
    label: "Pausar música",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [] },
    makeDefault: () => ({ type: "pauseMusic" }),
    summarize: () => "Pausar música",
    normalize: (_factory, effect) => ({ ...effect }),
  },

  stopMusic: {
    familyId: "audio",
    label: "Detener música",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [] },
    makeDefault: () => ({ type: "stopMusic" }),
    summarize: () => "Detener música",
    normalize: (_factory, effect) => ({ ...effect }),
  },

  setMapRegionAvailable: {
    familyId: "progress",
    label: "Región de mapa disponible",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [mapField(), mapRegionField(), boolField("value", "Valor")],
    },
    makeDefault: (factory) => ({
      type: "setMapRegionAvailable",
      mapId: factory.idx.getMapOptions()[0]?.id ?? "",
      regionId: "",
      value: true,
    }),
    summarize: ({ idx }, effect) =>
      `${idx.getMapLabel(effect.mapId)} · ${idx.getMapRegionLabel(effect.mapId, effect.regionId)} = ${String(effect.value)}`,
    normalize: (_factory, effect) => ({
      ...effect,
      mapId: String(effect.mapId ?? "").trim(),
      regionId: String(effect.regionId ?? "").trim(),
      value: Boolean(effect.value),
    }),
  },

  endGame: {
    familyId: "ending",
    label: "Finalizar juego",
    ui: {
      layoutClassName: "grid grid-cols-1 gap-2",
      fields: [textField("message", "Mensaje final")],
    },
    makeDefault: () => ({ type: "endGame", message: "" }),
    summarize: (_factory, effect) => {
      const text = String(effect.message ?? "").trim();
      return text
        ? `“${text.length > 40 ? `${text.slice(0, 40)}…` : text}”`
        : "";
    },
    normalize: (_factory, effect) => ({
      ...effect,
      message: String(effect.message ?? ""),
    }),
  },
};

/* API */
export function effectLabel(type: EnabledEffectType): string {
  return EFFECT_REGISTRY[type].label;
}

export function createDefaultEffect<T extends EnabledEffectType>(factory: FactoryCtx, type: T): Extract<EnabledEffect, { type: T }> {
  return EFFECT_REGISTRY[type].makeDefault(factory);
}

export function summarizeEffect(factory: FactoryCtx, effect: EnabledEffect): string {
  return EFFECT_REGISTRY[effect.type].summarize(factory, effect as never);
}

export function isEnabledEffect(effect: Effect): effect is EnabledEffect {
  return (typeof effect === "object" && effect !== null && "type" in effect && typeof effect.type === "string" && effect.type in EFFECT_REGISTRY);
}

export function getEffectUi(type: EnabledEffectType): EffectUiSpec {
  return EFFECT_REGISTRY[type].ui;
}

export function getEffectOptions(factory: FactoryCtx, effect: EnabledEffect, field: EffectFieldSpec): Option<string>[] {
  if (field.optionsResolver) return field.optionsResolver(factory, effect);
  return [];
}

export function applyEffectPatch(factory: FactoryCtx, prev: EnabledEffect, patch: Partial<EnabledEffect>): EnabledEffect {
  const next = { ...prev, ...patch } as EnabledEffect;
  return EFFECT_REGISTRY[next.type].normalize(factory, next as never);
}

export function effectFamilyOf(type: EnabledEffectType): EffectFamilyId {
  return EFFECT_REGISTRY[type].familyId;
}

export function getEffectTypesByFamily(familyId: EffectFamilyId): EnabledEffectType[] {
  return (Object.keys(EFFECT_REGISTRY) as EnabledEffectType[]).filter(
    (type) => EFFECT_REGISTRY[type].familyId === familyId
  );
}

export function getEnabledEffectTypesByFamily(factory: FactoryCtx, familyId: EffectFamilyId): EnabledEffectType[] {
  const enabled = new Set(enabledEffectTypes(factory));
  return getEffectTypesByFamily(familyId).filter((type) => enabled.has(type));
}

function getEffectVarKindFromEffect(factory: FactoryCtx, effect: EnabledEffect): OwnerVarKind {
  switch (effect.type) {
    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar":
      return factory.idx.getHotspotVarKind(factory.ctx.nodeId, effect.hotspotId, effect.varId);

    case "setPlayerVar":
    case "togglePlayerVar":
    case "incPlayerVar":
    case "decPlayerVar":
      return factory.idx.getPlayerVarKind(effect.playerId, effect.varId);

    case "setNpcVar":
    case "toggleNpcVar":
    case "incNpcVar":
    case "decNpcVar":
      return factory.idx.getNpcVarKind(effect.npcId, effect.varId);

    default:
      return "unknown";
  }
}

export function hasSelectedPrimaryEffectEntity(effect: EnabledEffect): boolean {
  switch (effect.type) {
    case "goToNode":
      return Boolean(effect.targetNodeId);

    case "setMapRegionAvailable":
      return Boolean(effect.mapId);

    case "addItem":
    case "removeItem":
    case "setPlacedItemVisible":
    case "setPlacedItemReachable":
      return Boolean(effect.placedItemId);

    case "setHotspotVisible":
    case "setHotspotReachable":
    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar":
      return Boolean(effect.hotspotId);

    case "setPlacedNpcVisible":
    case "setPlacedNpcReachable":
    case "giveItemToNpc":
    case "receiveItemFromNpc":
    case "setNpcVar":
    case "toggleNpcVar":
    case "incNpcVar":
    case "decNpcVar":
      return Boolean(effect.npcId);

    case "setPlacedPlayerVisible":
    case "setPlacedPlayerImage":
    case "setPlayerVar":
    case "togglePlayerVar":
    case "incPlayerVar":
    case "decPlayerVar":
      return Boolean(effect.playerId);

    case "showMessage":
    case "playSfx":
    case "playMusic":
    case "pauseMusic":
    case "stopMusic":
    case "startDialogue":
    case "endDialogue":
    case "endGame":
      return true;

    default:
      return false;
  }
}

export function getAvailableEffectTypesForCurrentSelection(factory: FactoryCtx, familyId: EffectFamilyId, effect: EnabledEffect): EnabledEffectType[] {
  const enabled = getEnabledEffectTypesByFamily(factory, familyId);

  if (familyId === "hotspot") {
    const hotspotId = effect.type === "setHotspotVisible" || effect.type === "setHotspotReachable" || effect.type === "setHotspotVar" ||
      effect.type === "toggleHotspotVar" || effect.type === "incHotspotVar" || effect.type === "decHotspotVar" ? effect.hotspotId : "";

    const structural: EnabledEffectType[] = ["setHotspotVisible", "setHotspotReachable"];

    if (!hotspotId) return enabled.filter((type) => structural.includes(type));

    const hasVars = factory.idx.getHotspotVarOptions(factory.ctx.nodeId, hotspotId).length > 0;

    if (!hasVars) return enabled.filter((type) => structural.includes(type));

    const kind = getEffectVarKindFromEffect(factory, effect);
    const boolVar: EnabledEffectType[] = ["setHotspotVar", "toggleHotspotVar"];
    const numVar: EnabledEffectType[] = ["setHotspotVar", "incHotspotVar", "decHotspotVar"];

    if (kind === "boolean") return enabled.filter((type) => [...structural, ...boolVar].includes(type));

    if (kind === "number") return enabled.filter((type) => [...structural, ...numVar].includes(type));

    return enabled.filter((type) => structural.includes(type) || type === "setHotspotVar");
  }

  if (familyId === "npc") {
    const npcId = effect.type === "setPlacedNpcVisible" || effect.type === "setPlacedNpcReachable" || effect.type === "giveItemToNpc" ||
        effect.type === "receiveItemFromNpc" || effect.type === "setNpcVar" || effect.type === "toggleNpcVar" || effect.type === "incNpcVar" ||
        effect.type === "decNpcVar" ? effect.npcId : "";

    const structural: EnabledEffectType[] = ["setPlacedNpcVisible", "setPlacedNpcReachable", "giveItemToNpc", "receiveItemFromNpc"];

    if (!npcId) return enabled.filter((type) => structural.includes(type));

    const hasVars = factory.idx.getNpcVarOptions(npcId).length > 0;

    if (!hasVars) return enabled.filter((type) => structural.includes(type));

    const kind = getEffectVarKindFromEffect(factory, effect);
    const boolVar: EnabledEffectType[] = ["setNpcVar", "toggleNpcVar"];
    const numVar: EnabledEffectType[] = ["setNpcVar", "incNpcVar", "decNpcVar"];

    if (kind === "boolean") return enabled.filter((type) => [...structural, ...boolVar].includes(type));

    if (kind === "number") return enabled.filter((type) => [...structural, ...numVar].includes(type));

    return enabled.filter((type) => structural.includes(type) || type === "setNpcVar");
  }

  if (familyId === "player") {
    const playerId = effect.type === "setPlacedPlayerVisible" || effect.type === "setPlacedPlayerImage" || effect.type === "setPlayerVar" ||
        effect.type === "togglePlayerVar" || effect.type === "incPlayerVar" || effect.type === "decPlayerVar" ? effect.playerId : "";

    const canChangeImage = playerId
      ? factory.idx.getPlayerImageOptions(playerId).length > 1
      : false;

    const structural: EnabledEffectType[] = canChangeImage
      ? ["setPlacedPlayerVisible", "setPlacedPlayerImage"]
      : ["setPlacedPlayerVisible"];

    if (!playerId) return enabled.filter((type) => type === "setPlacedPlayerVisible" || type === "setPlacedPlayerImage");

    const hasVars = factory.idx.getPlayerVarOptions(playerId).length > 0;

    if (!hasVars) return enabled.filter((type) => structural.includes(type));

    const kind = getEffectVarKindFromEffect(factory, effect);
    const boolVar: EnabledEffectType[] = ["setPlayerVar", "togglePlayerVar"];
    const numVar: EnabledEffectType[] = ["setPlayerVar", "incPlayerVar", "decPlayerVar"];

    if (kind === "boolean") return enabled.filter((type) => [...structural, ...boolVar].includes(type));

    if (kind === "number") return enabled.filter((type) => [...structural, ...numVar].includes(type));

    return enabled.filter((type) => structural.includes(type) || type === "setPlayerVar");
  }

  if (familyId === "dialogue") return enabled.filter((type) => type !== "showMessage");

  return enabled;
}