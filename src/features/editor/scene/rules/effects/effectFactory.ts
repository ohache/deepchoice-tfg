import type { Hotspot, ID, Project, VarDef } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import type { Option } from "@/components/Select";
import type { FactoryCtx } from "@/features/editor/scene/rules/effects/effectShared";
import type { OwnerVarKind, ProjectIndex } from "@/features/editor/scene/rules/effects/effectProjectIndex";
import type { EffectFamilyId } from "@/features/editor/scene/rules/effects/effectFamilies";

export type { FactoryCtx, EffectCtx, EffectOwner } from "@/features/editor/scene/rules/effects/effectShared";
export type { OwnerVarKind, ProjectIndex } from "@/features/editor/scene/rules/effects/effectProjectIndex";

/* Helpers  */
function getVarKindFromDef(def: VarDef | null): OwnerVarKind {
  if (!def) return "unknown";
  return def.type === "boolean" ? "boolean" : "number";
}

function normalizeBoolean(value: unknown): boolean {
  return Boolean(value);
}

function normalizeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function textOrFallback(value: string | undefined, fallback: string): string {
  const text = value?.trim();
  return text || fallback;
}

function optionOf(id: string, label?: string): Option<string> {
  return { id, label: label || id };
}

/* Project index */
export function createProjectIndex(project: Project | null): ProjectIndex {
  const nodes = project?.nodes ?? [];
  const items = project?.items ?? [];
  const npcs = project?.npcs ?? [];
  const players = project?.players ?? [];
  const maps = project?.maps ?? [];
  const sfx = project?.soundEffects ?? [];
  const musicTracks = project?.musicTracks ?? [];

  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const itemDefById = new Map(items.map((i) => [i.id, i] as const));
  const npcById = new Map(npcs.map((n) => [n.id, n] as const));
  const playerById = new Map(players.map((p) => [p.id, p] as const));
  const mapById = new Map(maps.map((m) => [m.id, m] as const));
  const sfxById = new Map(sfx.map((x) => [x.id, x] as const));
  const musicById = new Map(musicTracks.map((x) => [x.id, x] as const));

  const placedItems = nodes.flatMap((node) => (node.layers ?? []).flatMap((layer) => layer.placedItems ?? []));
  const placedNpcs = nodes.flatMap((node) => (node.layers ?? []).flatMap((layer) => layer.placedNpcs ?? []));
  const placedPlayers = nodes.flatMap((node) => (node.layers ?? []).flatMap((layer) => layer.placedPlayers ?? []));

  const placedItemById = new Map(placedItems.map((p) => [p.id, p] as const));

  const getNode = (id: ID) => nodeById.get(id) ?? null;

  const getNodeHotspots = (nodeId: ID): Hotspot[] => {
    const node = getNode(nodeId);
    if (!node) return [];
    return (node.layers ?? []).flatMap((layer) => layer.hotspots ?? []);
  };

  const getHotspot = (nodeId: ID, hotspotId: ID): Hotspot | null => {
    if (!hotspotId) return null;
    return getNodeHotspots(nodeId).find((h) => h.id === hotspotId) ?? null;
  };

  const getHotspotVarDef = (nodeId: ID, hotspotId: ID, varId: ID): VarDef | null => {
    return getHotspot(nodeId, hotspotId)?.vars?.find((v) => v.id === varId) ?? null;
  };

  const getNodeDialogues = (nodeId: ID) => getNode(nodeId)?.dialogues ?? [];

  return {
    project,

    getNode,
    getNodeLabel: (id) => nodeById.get(id)?.title || id || "—",
    getNodeOptions: (opts) => nodes.filter((n) => n.id !== opts?.excludeNodeId).map((n) => optionOf(n.id, n.title || n.id) as Option<ID>),

    getNodeHotspots,
    getHotspot,
    getHotspotLabel: (nodeId, hotspotId) => {
      const hs = getHotspot(nodeId, hotspotId);
      return hs ? textOrFallback(hs.label, hs.id) : hotspotId || "—";
    },
    getHotspotOptions: (nodeId) => getNodeHotspots(nodeId).map((h) => optionOf(h.id, textOrFallback(h.label, h.id)) as Option<ID>),
    getHotspotVarDef,
    getHotspotVarLabel: (nodeId, hotspotId, varId) => {
      const def = getHotspotVarDef(nodeId, hotspotId, varId);
      return def?.name || def?.id || varId || "—";
    },
    getHotspotVarOptions: (nodeId, hotspotId) => (getHotspot(nodeId, hotspotId)?.vars ?? []).map((v) => optionOf(v.id, v.name || v.id) as Option<ID>),
    getHotspotVarKind: (nodeId, hotspotId, varId) =>
      getVarKindFromDef(getHotspotVarDef(nodeId, hotspotId, varId)),

    getPlacedItems: () => placedItems,
    getPlacedItemLabel: (placedItemId) => {
      const placed = placedItemById.get(placedItemId);
      if (!placed) return placedItemId || "—";
      return textOrFallback(placed.label, itemDefById.get(placed.itemId)?.name || placed.id);
    },
    getPlacedItemOptions: () => placedItems.map((p) => optionOf(p.id, textOrFallback(p.label, itemDefById.get(p.itemId)?.name || p.id)) as Option<ID>),

    getPlacedNpcs: () => placedNpcs,
    getPlacedNpcLabel: (npcId) => npcById.get(npcId)?.name || npcId || "—",
    getPlacedNpcOptions: () => placedNpcs.map((p) => optionOf(p.npcId, npcById.get(p.npcId)?.name || p.npcId) as Option<ID>),

    getPlacedPlayers: () => placedPlayers,
    getPlacedPlayerLabel: (playerId) => playerById.get(playerId)?.name || playerId || "—",
    getPlacedPlayerOptions: () => placedPlayers.map((p) => optionOf(p.playerId, playerById.get(p.playerId)?.name || p.playerId) as Option<ID>),
    getPlayerImageOptions: (playerId) => (playerById.get(playerId)?.images ?? []).map((img) => optionOf(img.id, img.name || img.id) as Option<ID>),
    getPlayerImageLabel: (playerId, imageId) => {
      const image = playerById.get(playerId)?.images?.find((img) => img.id === imageId);
      return image?.name || image?.id || imageId || "—";
    },

    getPlayerLabel: (playerId) => playerById.get(playerId)?.name || playerId || "—",
    getPlayerOptions: () => players.map((p) => optionOf(p.id, p.name || p.id) as Option<ID>),
    getPlayerVarDef: (playerId, varId) => playerById.get(playerId)?.vars?.find((v) => v.id === varId) ?? null,
    getPlayerVarLabel: (playerId, varId) => {
      const def = playerById.get(playerId)?.vars?.find((v) => v.id === varId) ?? null;
      return def?.name || def?.id || varId || "—";
    },
    getPlayerVarOptions: (playerId) => (playerById.get(playerId)?.vars ?? []).map((v) => optionOf(v.id, v.name || v.id) as Option<ID>),
    getPlayerVarKind: (playerId, varId) => getVarKindFromDef(playerById.get(playerId)?.vars?.find((v) => v.id === varId) ?? null),

    getNpcLabel: (npcId) => npcById.get(npcId)?.name || npcId || "—",
    getNpcOptions: () => npcs.map((n) => optionOf(n.id, n.name || n.id) as Option<ID>),
    getNpcVarDef: (npcId, varId) => npcById.get(npcId)?.vars?.find((v) => v.id === varId) ?? null,
    getNpcVarLabel: (npcId, varId) => {
      const def = npcById.get(npcId)?.vars?.find((v) => v.id === varId) ?? null;
      return def?.name || def?.id || varId || "—";
    },
    getNpcVarOptions: (npcId) => (npcById.get(npcId)?.vars ?? []).map((v) => optionOf(v.id, v.name || v.id) as Option<ID>),
    getNpcVarKind: (npcId, varId) => getVarKindFromDef(npcById.get(npcId)?.vars?.find((v) => v.id === varId) ?? null),

    getDialogueOptions: (nodeId) => getNodeDialogues(nodeId).map((d) => optionOf(d.id, textOrFallback(d.title, d.id)) as Option<ID>),
    getDialogueLabel: (nodeId, dialogueId) => {
      const dialogue = getNodeDialogues(nodeId).find((d) => d.id === dialogueId);
      return dialogue ? textOrFallback(dialogue.title, dialogue.id) : dialogueId || "—";
    },

    getSfxOptions: () => sfx.map((x) => optionOf(x.id, x.name || x.id) as Option<ID>),
    getSfxLabel: (sfxId) => sfxById.get(sfxId)?.name || sfxId || "—",

    getMusicOptions: () => musicTracks.map((x) => optionOf(x.id, x.name || x.id) as Option<ID>),
    getMusicLabel: (trackId) => musicById.get(trackId)?.name || trackId || "—",

    getMapOptions: () => maps.map((m) => optionOf(m.id, m.name || m.id) as Option<ID>),
    getMapLabel: (mapId) => mapById.get(mapId)?.name || mapId || "—",
    getMapRegionOptions: (mapId) => (mapById.get(mapId)?.regions ?? []).map((r) => optionOf(r.id, r.label || r.id) as Option<ID>),
    getMapRegionLabel: (mapId, regionId) => {
      const region = mapById.get(mapId)?.regions.find((r) => r.id === regionId);
      return region?.label || region?.id || regionId || "—";
    },
  };
}

/* Efectos habilitados */
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

export function enabledEffectTypes(factory: FactoryCtx): EnabledEffectType[] {
  const out: EnabledEffectType[] = ["showMessage", "goToNode", "endGame"];

  const hasItems = factory.idx.getPlacedItems().length > 0;
  const hasHotspots = factory.idx.getNodeHotspots(factory.ctx.nodeId).length > 0;
  const hasHotspotVars = factory.idx
    .getNodeHotspots(factory.ctx.nodeId)
    .some((hotspot) => factory.idx.getHotspotVarOptions(factory.ctx.nodeId, hotspot.id).length > 0);

  const hasDialogues = factory.idx.getDialogueOptions(factory.ctx.nodeId).length > 0;

  const hasPlacedNpcs = factory.idx.getPlacedNpcs().length > 0;
  const hasNpcVars = factory.idx
    .getNpcOptions()
    .some((npc) => factory.idx.getNpcVarOptions(npc.id).length > 0);

  const hasPlacedPlayers = factory.idx.getPlacedPlayers().length > 0;
  const hasPlacedPlayersWithMultipleImages = factory.idx
    .getPlacedPlayers()
    .some((player) => factory.idx.getPlayerImageOptions(player.playerId).length > 1);

  const hasPlayers = factory.idx.getPlayerOptions().length > 0;
  const hasPlayerVars = factory.idx
    .getPlayerOptions()
    .some((player) => factory.idx.getPlayerVarOptions(player.id).length > 0);

  const hasNpcs = factory.idx.getNpcOptions().length > 0;
  const hasMaps = factory.idx.getMapOptions().length > 0;
  const hasSfx = factory.idx.getSfxOptions().length > 0;
  const hasMusic = factory.idx.getMusicOptions().length > 0;

  if (hasItems) {
    out.push("addItem", "removeItem", "setPlacedItemVisible", "setPlacedItemReachable");
  }

  if (hasHotspots) {
    out.push("setHotspotVisible", "setHotspotReachable");
  }

  if (hasHotspotVars) {
    out.push("setHotspotVar", "toggleHotspotVar", "incHotspotVar", "decHotspotVar");
  }

  if (hasDialogues && factory.ctx.owner.kind !== "dialogueLine") out.push("startDialogue");
  if (factory.ctx.owner.kind === "dialogueLine") out.push("endDialogue");

  if (hasPlacedNpcs) {
    out.push("setPlacedNpcVisible", "setPlacedNpcReachable", "giveItemToNpc", "receiveItemFromNpc");
  }

  if (hasPlacedPlayers) {
    out.push("setPlacedPlayerVisible");
  }

  if (hasPlacedPlayersWithMultipleImages) {
    out.push("setPlacedPlayerImage");
  }

  if (hasPlayers && hasPlayerVars) {
    out.push("setPlayerVar", "togglePlayerVar", "incPlayerVar", "decPlayerVar");
  }

  if (hasNpcs && hasNpcVars) {
    out.push("setNpcVar", "toggleNpcVar", "incNpcVar", "decNpcVar");
  }

  if (hasSfx) {
    out.push("playSfx");
  }

  if (hasMusic) {
    out.push("playMusic", "pauseMusic", "stopMusic");
  }

  if (hasMaps) out.push("setMapRegionAvailable");

  return out;
}

/* UI spec */
type EffectFieldControl = "id-select" | "text" | "bool" | "number" | "var-value";

export type EffectFieldSpec = {
  key: string;
  label: string;
  path: string;
  control: EffectFieldControl;
  className?: string;
  optionsResolver?: (factory: FactoryCtx, eff: EnabledEffect) => Option<string>[];
  disabledWhen?: (factory: FactoryCtx, eff: EnabledEffect) => boolean;
  visibleWhen?: (factory: FactoryCtx, eff: EnabledEffect) => boolean;
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
  summarize: (factory: FactoryCtx, eff: T) => string;
  normalize: (factory: FactoryCtx, eff: T) => T;
};

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
  return {
    key: path,
    label,
    path,
    control: "id-select",
    optionsResolver: (factory) => factory.idx.getPlacedItemOptions(),
  };
}

function npcField(path = "npcId", label = "NPC"): EffectFieldSpec {
  return {
    key: path,
    label,
    path,
    control: "id-select",
    optionsResolver: (factory) => factory.idx.getNpcOptions(),
  };
}

function playerField(path = "playerId", label = "Player"): EffectFieldSpec {
  return {
    key: path,
    label,
    path,
    control: "id-select",
    optionsResolver: (factory) => factory.idx.getPlayerOptions(),
  };
}

function hotspotField(): EffectFieldSpec {
  return {
    key: "hotspotId",
    label: "Hotspot",
    path: "hotspotId",
    control: "id-select",
    optionsResolver: (factory) => factory.idx.getHotspotOptions(factory.ctx.nodeId),
  };
}

function hotspotVarField<T extends | LeafByType<"setHotspotVar"> | LeafByType<"toggleHotspotVar"> | LeafByType<"incHotspotVar"> | LeafByType<"decHotspotVar">>(): EffectFieldSpec {
  return {
    key: "varId",
    label: "Variable",
    path: "varId",
    control: "id-select",
    optionsResolver: (factory, eff) => {
      const hotspotId = (eff as T).hotspotId;
      return factory.idx.getHotspotVarOptions(factory.ctx.nodeId, hotspotId);
    },
    disabledWhen: (_factory, eff) => !(eff as T).hotspotId,
  };
}

function placedPlayerField(path = "playerId", label = "Player colocado"): EffectFieldSpec {
  return {
    key: path,
    label,
    path,
    control: "id-select",
    optionsResolver: (factory) => factory.idx.getPlacedPlayerOptions(),
  };
}

function placedNpcField(path = "npcId", label = "NPC"): EffectFieldSpec {
  return {
    key: path,
    label,
    path,
    control: "id-select",
    optionsResolver: (factory) => factory.idx.getPlacedNpcOptions(),
  };
}

function placedPlayerImageField(): EffectFieldSpec {
  return {
    key: "imageId",
    label: "Imagen",
    path: "imageId",
    control: "id-select",
    optionsResolver: (factory, eff) => {
      const playerId = (eff as LeafByType<"setPlacedPlayerImage">).playerId;
      return playerId ? factory.idx.getPlayerImageOptions(playerId) : [];
    },
    disabledWhen: (_factory, eff) => !(eff as LeafByType<"setPlacedPlayerImage">).playerId,
  };
}

function playerVarField<T extends | LeafByType<"setPlayerVar"> | LeafByType<"togglePlayerVar"> | LeafByType<"incPlayerVar"> | LeafByType<"decPlayerVar">>(): EffectFieldSpec {
  return {
    key: "varId",
    label: "Variable",
    path: "varId",
    control: "id-select",
    optionsResolver: (factory, eff) => {
      const playerId = (eff as T).playerId;
      return factory.idx.getPlayerVarOptions(playerId);
    },
    disabledWhen: (_factory, eff) => !(eff as T).playerId,
  };
}

function npcVarField<T extends | LeafByType<"setNpcVar"> | LeafByType<"toggleNpcVar"> | LeafByType<"incNpcVar"> | LeafByType<"decNpcVar">>(): EffectFieldSpec {
  return {
    key: "varId",
    label: "Variable",
    path: "varId",
    control: "id-select",
    optionsResolver: (factory, eff) => {
      const npcId = (eff as T).npcId;
      return factory.idx.getNpcVarOptions(npcId);
    },
    disabledWhen: (_factory, eff) => !(eff as T).npcId,
  };
}

function mapField(): EffectFieldSpec {
  return {
    key: "mapId",
    label: "Mapa",
    path: "mapId",
    control: "id-select",
    optionsResolver: (factory) => factory.idx.getMapOptions(),
  };
}

function mapRegionField(): EffectFieldSpec {
  return {
    key: "regionId",
    label: "Región",
    path: "regionId",
    control: "id-select",
    optionsResolver: (factory, eff) => {
      const mapId = (eff as LeafByType<"setMapRegionAvailable">).mapId;
      return factory.idx.getMapRegionOptions(mapId);
    },
    disabledWhen: (_factory, eff) => !(eff as LeafByType<"setMapRegionAvailable">).mapId,
  };
}

function summarizeHotspotBool(factory: FactoryCtx, hotspotId: ID, label: string, value: boolean): string {
  const hs = factory.idx.getHotspotLabel(factory.ctx.nodeId, hotspotId);
  return `${hs}: ${label} = ${String(value)}`;
}

function summarizeHotspotVar(factory: FactoryCtx, hotspotId: ID, varId: ID, prefix: string, suffix?: string): string {
  const hs = factory.idx.getHotspotLabel(factory.ctx.nodeId, hotspotId);
  const varLabel = factory.idx.getHotspotVarLabel(factory.ctx.nodeId, hotspotId, varId);
  return `${hs}: ${prefix} ${varLabel}${suffix ? ` ${suffix}` : ""}`;
}

function normalizeHotspotId(factory: FactoryCtx, hotspotId: ID | undefined): ID {
  return hotspotId || factory.idx.getHotspotOptions(factory.ctx.nodeId)[0]?.id || "";
}

function normalizePlayerVarValue(factory: FactoryCtx, eff: LeafByType<"setPlayerVar">): boolean | number {
  const kind = factory.idx.getPlayerVarKind(eff.playerId, eff.varId);
  if (kind === "number") return normalizeNumber(eff.value);
  return normalizeBoolean(eff.value);
}

function normalizeNpcVarValue(factory: FactoryCtx, eff: LeafByType<"setNpcVar">): boolean | number {
  const kind = factory.idx.getNpcVarKind(eff.npcId, eff.varId);
  if (kind === "number") return normalizeNumber(eff.value);
  return normalizeBoolean(eff.value);
}

function normalizeHotspotVarValue(factory: FactoryCtx, eff: LeafByType<"setHotspotVar">): boolean | number {
  const hotspotId = normalizeHotspotId(factory, eff.hotspotId);
  const kind = factory.idx.getHotspotVarKind(factory.ctx.nodeId, hotspotId, eff.varId);
  if (kind === "number") return normalizeNumber(eff.value);
  return normalizeBoolean(eff.value);
}

/* Registro */
export const EFFECT_REGISTRY: { [K in EnabledEffectType]: EffectSpec<Extract<EnabledEffect, { type: K }>> } = {
  showMessage: {
    familyId: "message",
    label: "Mostrar mensaje",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [textField("text", "Texto")] },
    makeDefault: () => ({ type: "showMessage", text: "" }),
    summarize: (_factory, eff) => {
      const text = String(eff.text ?? "").trim();
      return text ? `Mensaje: “${text.length > 40 ? `${text.slice(0, 40)}…` : text}”` : "Mensaje: (vacío)";
    },
    normalize: (_factory, eff) => ({ ...eff, text: String(eff.text ?? "") }),
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
          optionsResolver: (factory) => factory.idx.getNodeOptions({ excludeNodeId: factory.ctx.nodeId }),
        },
      ],
    },
    makeDefault: () => ({ type: "goToNode", targetNodeId: "" }),
    summarize: ({ idx }, eff) => `Ir a: ${idx.getNodeLabel(eff.targetNodeId)}`,
    normalize: (_factory, eff) => ({ ...eff, targetNodeId: String(eff.targetNodeId ?? "").trim() }),
  },

  addItem: {
    familyId: "item",
    label: "Añadir al inventario",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [itemField()] },
    makeDefault: () => ({ type: "addItem", placedItemId: "" }),
    summarize: ({ idx }, eff) => `Añadir item: ${idx.getPlacedItemLabel(eff.placedItemId)}`,
    normalize: (_factory, eff) => ({ ...eff, placedItemId: String(eff.placedItemId ?? "").trim() }),
  },

  removeItem: {
    familyId: "item",
    label: "Eliminar del inventario",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [itemField()] },
    makeDefault: () => ({ type: "removeItem", placedItemId: "" }),
    summarize: ({ idx }, eff) => `Eliminar item: ${idx.getPlacedItemLabel(eff.placedItemId)}`,
    normalize: (_factory, eff) => ({ ...eff, placedItemId: String(eff.placedItemId ?? "").trim() }),
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
          optionsResolver: (factory) => factory.idx.getDialogueOptions(factory.ctx.nodeId),
        },
      ],
    },
    makeDefault: (factory) => ({
      type: "startDialogue",
      nodeDialogueId: factory.idx.getDialogueOptions(factory.ctx.nodeId)[0]?.id ?? "",
    }),
    summarize: (factory, eff) =>
      `Iniciar diálogo: ${factory.idx.getDialogueLabel(factory.ctx.nodeId, eff.nodeDialogueId)}`,
    normalize: (_factory, eff) => ({ ...eff, nodeDialogueId: String(eff.nodeDialogueId ?? "").trim() }),
  },

  endDialogue: {
    familyId: "dialogue",
    label: "Terminar diálogo",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [] },
    makeDefault: () => ({ type: "endDialogue" }),
    summarize: () => "Terminar diálogo",
    normalize: (_factory, eff) => ({ ...eff }),
  },

  giveItemToNpc: {
    familyId: "npc",
    label: "Dar item",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [npcField(), itemField()],
    },
    makeDefault: () => ({ type: "giveItemToNpc", npcId: "", placedItemId: "" }),
    summarize: ({ idx }, eff) => `Dar ${idx.getPlacedItemLabel(eff.placedItemId)} a ${idx.getNpcLabel(eff.npcId)}`,
    normalize: (_factory, eff) => ({
      ...eff,
      npcId: String(eff.npcId ?? "").trim(),
      placedItemId: String(eff.placedItemId ?? "").trim(),
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
    summarize: ({ idx }, eff) => `Recibir ${idx.getPlacedItemLabel(eff.placedItemId)} de ${idx.getNpcLabel(eff.npcId)}`,
    normalize: (_factory, eff) => ({
      ...eff,
      npcId: String(eff.npcId ?? "").trim(),
      placedItemId: String(eff.placedItemId ?? "").trim(),
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
    summarize: ({ idx }, eff) => `Item visible: ${idx.getPlacedItemLabel(eff.placedItemId)} = ${String(eff.value)}`,
    normalize: (factory, eff) => ({
      ...eff,
      nodeId: factory.ctx.nodeId,
      placedItemId: String(eff.placedItemId ?? "").trim(),
      value: Boolean(eff.value),
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
    summarize: ({ idx }, eff) => `Item alcanzable: ${idx.getPlacedItemLabel(eff.placedItemId)} = ${String(eff.value)}`,
    normalize: (factory, eff) => ({
      ...eff,
      nodeId: factory.ctx.nodeId,
      placedItemId: String(eff.placedItemId ?? "").trim(),
      value: Boolean(eff.value),
    }),
  },

  setHotspotVisible: {
    familyId: "hotspot",
    label: "Visible",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [hotspotField(), { ...boolField("value", "Valor"), disabledWhen: (_factory, eff) => !(eff as LeafByType<"setHotspotVisible">).hotspotId }],
    },
    makeDefault: () => ({
      type: "setHotspotVisible",
      hotspotId: "",
      value: true,
    }),
    summarize: (factory, eff) => summarizeHotspotBool(factory, eff.hotspotId, "visible", eff.value),
    normalize: (factory, eff) => ({
      ...eff,
      hotspotId: normalizeHotspotId(factory, eff.hotspotId),
      value: Boolean(eff.value),
    }),
  },

  setHotspotReachable: {
    familyId: "hotspot",
    label: "Alcanzable",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [hotspotField(), { ...boolField("value", "Valor"), disabledWhen: (_factory, eff) => !(eff as LeafByType<"setHotspotReachable">).hotspotId }],
    },
    makeDefault: () => ({
      type: "setHotspotReachable",
      hotspotId: "",
      value: true,
    }),
    summarize: (factory, eff) => summarizeHotspotBool(factory, eff.hotspotId, "alcanzable", eff.value),
    normalize: (factory, eff) => ({
      ...eff,
      hotspotId: normalizeHotspotId(factory, eff.hotspotId),
      value: Boolean(eff.value),
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
    summarize: (factory, eff) =>
      summarizeHotspotVar(factory, eff.hotspotId, eff.varId, "Set", `= ${String(eff.value)}`),
    normalize: (factory, eff) => ({
      ...eff,
      hotspotId: normalizeHotspotId(factory, eff.hotspotId),
      value: normalizeHotspotVarValue(factory, eff),
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
    summarize: (factory, eff) => summarizeHotspotVar(factory, eff.hotspotId, eff.varId, "Toggle"),
    normalize: (factory, eff) => ({
      ...eff,
      hotspotId: normalizeHotspotId(factory, eff.hotspotId),
    }),
  },

  incHotspotVar: {
    familyId: "hotspot",
    label: "Incrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [hotspotField(), hotspotVarField<LeafByType<"incHotspotVar">>(), numberField("amount", "Cantidad")],
    },
    makeDefault: () => ({
      type: "incHotspotVar",
      hotspotId: "",
      varId: "",
      amount: 1,
    }),
    summarize: (factory, eff) =>
      summarizeHotspotVar(factory, eff.hotspotId, eff.varId, "Inc", `(+${String(eff.amount ?? 1)})`),
    normalize: (factory, eff) => ({
      ...eff,
      hotspotId: normalizeHotspotId(factory, eff.hotspotId),
      amount: eff.amount == null ? 1 : normalizeNumber(eff.amount),
    }),
  },

  decHotspotVar: {
    familyId: "hotspot",
    label: "Decrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [hotspotField(), hotspotVarField<LeafByType<"decHotspotVar">>(), numberField("amount", "Cantidad")],
    },
    makeDefault: () => ({
      type: "decHotspotVar",
      hotspotId: "",
      varId: "",
      amount: 1,
    }),
    summarize: (factory, eff) =>
      summarizeHotspotVar(factory, eff.hotspotId, eff.varId, "Dec", `(-${String(eff.amount ?? 1)})`),
    normalize: (factory, eff) => ({
      ...eff,
      hotspotId: normalizeHotspotId(factory, eff.hotspotId),
      amount: eff.amount == null ? 1 : normalizeNumber(eff.amount),
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
          disabledWhen: (_factory, eff) => !(eff as LeafByType<"setPlacedPlayerVisible">).playerId,
        },
      ],
    },
    makeDefault: (factory) => ({
      type: "setPlacedPlayerVisible",
      nodeId: factory.ctx.nodeId,
      playerId: "",
      value: true,
    }),
    summarize: ({ idx }, eff) => `Player visible: ${idx.getPlacedPlayerLabel(eff.playerId)} = ${String(eff.value)}`,
    normalize: (factory, eff) => ({
      ...eff,
      nodeId: factory.ctx.nodeId,
      playerId: String(eff.playerId ?? "").trim(),
      value: Boolean(eff.value),
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
    summarize: ({ idx }, eff) =>
      `Imagen de ${idx.getPlacedPlayerLabel(eff.playerId)}: ${idx.getPlayerImageLabel(eff.playerId, eff.imageId)}`,
    normalize: (factory, eff) => ({
      ...eff,
      nodeId: factory.ctx.nodeId,
      playerId: String(eff.playerId ?? "").trim(),
      imageId: String(eff.imageId ?? "").trim(),
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
          disabledWhen: (_factory, eff) => !(eff as LeafByType<"setPlacedNpcVisible">).npcId,
        },
      ],
    },
    makeDefault: (factory) => ({
      type: "setPlacedNpcVisible",
      nodeId: factory.ctx.nodeId,
      npcId: "",
      value: true,
    }),
    summarize: ({ idx }, eff) => `NPC visible: ${idx.getPlacedNpcLabel(eff.npcId)} = ${String(eff.value)}`,
    normalize: (factory, eff) => ({
      ...eff,
      nodeId: factory.ctx.nodeId,
      npcId: String(eff.npcId ?? "").trim(),
      value: Boolean(eff.value),
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
          disabledWhen: (_factory, eff) => !(eff as LeafByType<"setPlacedNpcReachable">).npcId,
        },
      ],
    },
    makeDefault: (factory) => ({
      type: "setPlacedNpcReachable",
      nodeId: factory.ctx.nodeId,
      npcId: "",
      value: true,
    }),
    summarize: ({ idx }, eff) => `NPC alcanzable: ${idx.getPlacedNpcLabel(eff.npcId)} = ${String(eff.value)}`,
    normalize: (factory, eff) => ({
      ...eff,
      nodeId: factory.ctx.nodeId,
      npcId: String(eff.npcId ?? "").trim(),
      value: Boolean(eff.value),
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
    makeDefault: () => ({ type: "setPlayerVar", playerId: "", varId: "", value: true }),
    summarize: ({ idx }, eff) =>
      `Player ${idx.getPlayerLabel(eff.playerId)} · ${idx.getPlayerVarLabel(eff.playerId, eff.varId)} = ${String(eff.value)}`,
    normalize: (factory, eff) => ({
      ...eff,
      playerId: String(eff.playerId ?? "").trim(),
      varId: String(eff.varId ?? "").trim(),
      value: normalizePlayerVarValue(factory, eff),
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
    summarize: ({ idx }, eff) =>
      `Toggle ${idx.getPlayerLabel(eff.playerId)} · ${idx.getPlayerVarLabel(eff.playerId, eff.varId)}`,
    normalize: (_factory, eff) => ({
      ...eff,
      playerId: String(eff.playerId ?? "").trim(),
      varId: String(eff.varId ?? "").trim(),
    }),
  },

  incPlayerVar: {
    familyId: "player",
    label: "Incrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [playerField(), playerVarField<LeafByType<"incPlayerVar">>(), numberField("amount", "Cantidad")],
    },
    makeDefault: () => ({ type: "incPlayerVar", playerId: "", varId: "", amount: 1 }),
    summarize: ({ idx }, eff) =>
      `Inc ${idx.getPlayerLabel(eff.playerId)} · ${idx.getPlayerVarLabel(eff.playerId, eff.varId)} (+${String(eff.amount ?? 1)})`,
    normalize: (_factory, eff) => ({
      ...eff,
      playerId: String(eff.playerId ?? "").trim(),
      varId: String(eff.varId ?? "").trim(),
      amount: eff.amount == null ? 1 : normalizeNumber(eff.amount),
    }),
  },

  decPlayerVar: {
    familyId: "player",
    label: "Decrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [playerField(), playerVarField<LeafByType<"decPlayerVar">>(), numberField("amount", "Cantidad")],
    },
    makeDefault: () => ({ type: "decPlayerVar", playerId: "", varId: "", amount: 1 }),
    summarize: ({ idx }, eff) =>
      `Dec ${idx.getPlayerLabel(eff.playerId)} · ${idx.getPlayerVarLabel(eff.playerId, eff.varId)} (-${String(eff.amount ?? 1)})`,
    normalize: (_factory, eff) => ({
      ...eff,
      playerId: String(eff.playerId ?? "").trim(),
      varId: String(eff.varId ?? "").trim(),
      amount: eff.amount == null ? 1 : normalizeNumber(eff.amount),
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
    summarize: ({ idx }, eff) =>
      `NPC ${idx.getNpcLabel(eff.npcId)} · ${idx.getNpcVarLabel(eff.npcId, eff.varId)} = ${String(eff.value)}`,
    normalize: (factory, eff) => ({
      ...eff,
      npcId: String(eff.npcId ?? "").trim(),
      varId: String(eff.varId ?? "").trim(),
      value: normalizeNpcVarValue(factory, eff),
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
    summarize: ({ idx }, eff) =>
      `Toggle ${idx.getNpcLabel(eff.npcId)} · ${idx.getNpcVarLabel(eff.npcId, eff.varId)}`,
    normalize: (_factory, eff) => ({
      ...eff,
      npcId: String(eff.npcId ?? "").trim(),
      varId: String(eff.varId ?? "").trim(),
    }),
  },

  incNpcVar: {
    familyId: "npc",
    label: "Incrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [npcField(), npcVarField<LeafByType<"incNpcVar">>(), numberField("amount", "Cantidad")],
    },
    makeDefault: () => ({ type: "incNpcVar", npcId: "", varId: "", amount: 1 }),
    summarize: ({ idx }, eff) =>
      `Inc ${idx.getNpcLabel(eff.npcId)} · ${idx.getNpcVarLabel(eff.npcId, eff.varId)} (+${String(eff.amount ?? 1)})`,
    normalize: (_factory, eff) => ({
      ...eff,
      npcId: String(eff.npcId ?? "").trim(),
      varId: String(eff.varId ?? "").trim(),
      amount: eff.amount == null ? 1 : normalizeNumber(eff.amount),
    }),
  },

  decNpcVar: {
    familyId: "npc",
    label: "Decrementar",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [npcField(), npcVarField<LeafByType<"decNpcVar">>(), numberField("amount", "Cantidad")],
    },
    makeDefault: () => ({ type: "decNpcVar", npcId: "", varId: "", amount: 1 }),
    summarize: ({ idx }, eff) =>
      `Dec ${idx.getNpcLabel(eff.npcId)} · ${idx.getNpcVarLabel(eff.npcId, eff.varId)} (-${String(eff.amount ?? 1)})`,
    normalize: (_factory, eff) => ({
      ...eff,
      npcId: String(eff.npcId ?? "").trim(),
      varId: String(eff.varId ?? "").trim(),
      amount: eff.amount == null ? 1 : normalizeNumber(eff.amount),
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
    summarize: ({ idx }, eff) => `SFX: ${idx.getSfxLabel(eff.sfxId)}`,
    normalize: (_factory, eff) => ({ ...eff, sfxId: String(eff.sfxId ?? "").trim() }),
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
    summarize: ({ idx }, eff) => `Música: ${idx.getMusicLabel(eff.trackId)}`,
    normalize: (_factory, eff) => ({
      ...eff,
      trackId: String(eff.trackId ?? "").trim(),
      startAt: eff.startAt === "restart" ? "restart" : "resume",
    }),
  },

  pauseMusic: {
    familyId: "audio",
    label: "Pausar música",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [] },
    makeDefault: () => ({ type: "pauseMusic" }),
    summarize: () => "Pausar música",
    normalize: (_factory, eff) => ({ ...eff }),
  },

  stopMusic: {
    familyId: "audio",
    label: "Detener música",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [] },
    makeDefault: () => ({ type: "stopMusic" }),
    summarize: () => "Detener música",
    normalize: (_factory, eff) => ({ ...eff }),
  },

  setMapRegionAvailable: {
    familyId: "progress",
    label: "Región de mapa disponible",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2",
      fields: [mapField(), mapRegionField(), boolField("value", "Valor")],
    },
    makeDefault: (factory) => ({ type: "setMapRegionAvailable", mapId: factory.idx.getMapOptions()[0]?.id ?? "", regionId: "", value: true }),
    summarize: ({ idx }, eff) =>
      `Mapa ${idx.getMapLabel(eff.mapId)} · ${idx.getMapRegionLabel(eff.mapId, eff.regionId)} = ${String(eff.value)}`,
    normalize: (_factory, eff) => ({
      ...eff,
      mapId: String(eff.mapId ?? "").trim(),
      regionId: String(eff.regionId ?? "").trim(),
      value: Boolean(eff.value),
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
    summarize: (_factory, eff) => {
      const text = String(eff.message ?? "").trim();
      return text ? `Finalizar juego: “${text.length > 40 ? `${text.slice(0, 40)}…` : text}”` : "Finalizar juego";
    },
    normalize: (_factory, eff) => ({ ...eff, message: String(eff.message ?? "") }),
  },
};

/* API pública */
export function effectLabel(type: EnabledEffectType): string {
  return EFFECT_REGISTRY[type].label;
}

export function createDefaultEffect<T extends EnabledEffectType>(factory: FactoryCtx, type: T): Extract<EnabledEffect, { type: T }> {
  return EFFECT_REGISTRY[type].makeDefault(factory);
}

export function summarizeEffect(factory: FactoryCtx, eff: EnabledEffect): string {
  return EFFECT_REGISTRY[eff.type].summarize(factory, eff as never);
}

export function isEnabledEffect(e: Effect): e is EnabledEffect {
  return (
    typeof e === "object" &&
    e !== null &&
    "type" in e &&
    typeof e.type === "string" &&
    e.type in EFFECT_REGISTRY
  );
}

export function getEffectUi(type: EnabledEffectType): EffectUiSpec {
  return EFFECT_REGISTRY[type].ui;
}

export function getEffectOptions(factory: FactoryCtx, eff: EnabledEffect, field: EffectFieldSpec): Option<string>[] {
  if (field.optionsResolver) return field.optionsResolver(factory, eff);
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

export function getEnabledEffectTypesByFamily(
  factory: FactoryCtx,
  familyId: EffectFamilyId
): EnabledEffectType[] {
  const enabled = new Set(enabledEffectTypes(factory));
  return getEffectTypesByFamily(familyId).filter((type) => enabled.has(type));
}

function getEffectVarKindFromEffect(factory: FactoryCtx, eff: EnabledEffect): OwnerVarKind {
  switch (eff.type) {
    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar":
      return factory.idx.getHotspotVarKind(factory.ctx.nodeId, eff.hotspotId, eff.varId);

    case "setPlayerVar":
    case "togglePlayerVar":
    case "incPlayerVar":
    case "decPlayerVar":
      return factory.idx.getPlayerVarKind(eff.playerId, eff.varId);

    case "setNpcVar":
    case "toggleNpcVar":
    case "incNpcVar":
    case "decNpcVar":
      return factory.idx.getNpcVarKind(eff.npcId, eff.varId);

    default:
      return "unknown";
  }
}

export function hasSelectedPrimaryEffectEntity(eff: EnabledEffect): boolean {
  switch (eff.type) {
    case "goToNode":
      return Boolean(eff.targetNodeId);

    case "setMapRegionAvailable":
      return Boolean(eff.mapId);

    case "addItem":
    case "removeItem":
    case "setPlacedItemVisible":
    case "setPlacedItemReachable":
      return Boolean(eff.placedItemId);

    case "setHotspotVisible":
    case "setHotspotReachable":
    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar":
      return Boolean(eff.hotspotId);

    case "setPlacedNpcVisible":
    case "setPlacedNpcReachable":
    case "giveItemToNpc":
    case "receiveItemFromNpc":
    case "setNpcVar":
    case "toggleNpcVar":
    case "incNpcVar":
    case "decNpcVar":
      return Boolean(eff.npcId);

    case "setPlacedPlayerVisible":
    case "setPlacedPlayerImage":
    case "setPlayerVar":
    case "togglePlayerVar":
    case "incPlayerVar":
    case "decPlayerVar":
      return Boolean(eff.playerId);

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

export function getAvailableEffectTypesForCurrentSelection(
  factory: FactoryCtx,
  familyId: EffectFamilyId,
  eff: EnabledEffect
): EnabledEffectType[] {
  const enabled = getEnabledEffectTypesByFamily(factory, familyId);

  if (familyId === "hotspot") {
    const hotspotId =
      eff.type === "setHotspotVisible" ||
        eff.type === "setHotspotReachable" ||
        eff.type === "setHotspotVar" ||
        eff.type === "toggleHotspotVar" ||
        eff.type === "incHotspotVar" ||
        eff.type === "decHotspotVar"
        ? eff.hotspotId
        : "";

    const structural = ["setHotspotVisible", "setHotspotReachable"] as EnabledEffectType[];

    if (!hotspotId) {
      return enabled.filter((t) => structural.includes(t));
    }

    const hasVars =
      factory.idx.getHotspotVarOptions(factory.ctx.nodeId, hotspotId).length > 0;

    if (!hasVars) {
      return enabled.filter((t) => structural.includes(t));
    }

    const kind = getEffectVarKindFromEffect(factory, eff);
    const boolVar = ["setHotspotVar", "toggleHotspotVar"] as EnabledEffectType[];
    const numVar = ["setHotspotVar", "incHotspotVar", "decHotspotVar"] as EnabledEffectType[];

    if (kind === "boolean") return enabled.filter((t) => [...structural, ...boolVar].includes(t));
    if (kind === "number") return enabled.filter((t) => [...structural, ...numVar].includes(t));

    return enabled.filter((t) => structural.includes(t) || t === "setHotspotVar");
  }

  if (familyId === "npc") {
    const npcId =
      eff.type === "setPlacedNpcVisible" ||
        eff.type === "setPlacedNpcReachable" ||
        eff.type === "giveItemToNpc" ||
        eff.type === "receiveItemFromNpc" ||
        eff.type === "setNpcVar" ||
        eff.type === "toggleNpcVar" ||
        eff.type === "incNpcVar" ||
        eff.type === "decNpcVar"
        ? eff.npcId
        : "";

    const structural = [
      "setPlacedNpcVisible",
      "setPlacedNpcReachable",
      "giveItemToNpc",
      "receiveItemFromNpc",
    ] as EnabledEffectType[];

    if (!npcId) {
      return enabled.filter((t) => structural.includes(t));
    }

    const hasVars = factory.idx.getNpcVarOptions(npcId).length > 0;

    if (!hasVars) {
      return enabled.filter((t) => structural.includes(t));
    }

    const kind = getEffectVarKindFromEffect(factory, eff);
    const boolVar = ["setNpcVar", "toggleNpcVar"] as EnabledEffectType[];
    const numVar = ["setNpcVar", "incNpcVar", "decNpcVar"] as EnabledEffectType[];

    if (kind === "boolean") return enabled.filter((t) => [...structural, ...boolVar].includes(t));
    if (kind === "number") return enabled.filter((t) => [...structural, ...numVar].includes(t));

    return enabled.filter((t) => structural.includes(t) || t === "setNpcVar");
  }

  if (familyId === "player") {
    const playerId =
      eff.type === "setPlacedPlayerVisible" ||
        eff.type === "setPlacedPlayerImage" ||
        eff.type === "setPlayerVar" ||
        eff.type === "togglePlayerVar" ||
        eff.type === "incPlayerVar" ||
        eff.type === "decPlayerVar"
        ? eff.playerId
        : "";

    const canChangeImage = playerId
      ? factory.idx.getPlayerImageOptions(playerId).length > 1
      : false;

    const structural = [
      "setPlacedPlayerVisible",
      ...(canChangeImage ? (["setPlacedPlayerImage"] as EnabledEffectType[]) : []),
    ] as EnabledEffectType[];

    if (!playerId) {
      return enabled.filter((t) => t === "setPlacedPlayerVisible" || t === "setPlacedPlayerImage");
    }

    const hasVars = factory.idx.getPlayerVarOptions(playerId).length > 0;

    if (!hasVars) {
      return enabled.filter((t) => structural.includes(t));
    }

    const kind = getEffectVarKindFromEffect(factory, eff);
    const boolVar = ["setPlayerVar", "togglePlayerVar"] as EnabledEffectType[];
    const numVar = ["setPlayerVar", "incPlayerVar", "decPlayerVar"] as EnabledEffectType[];

    if (kind === "boolean") return enabled.filter((t) => [...structural, ...boolVar].includes(t));
    if (kind === "number") return enabled.filter((t) => [...structural, ...numVar].includes(t));

    return enabled.filter((t) => structural.includes(t) || t === "setPlayerVar");
  }

  return enabled;
}