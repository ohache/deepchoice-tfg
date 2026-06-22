import type { ID, Speaker } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import type { Option } from "@/components/Select";
import type { FactoryCtx } from "@/features/editor/scene/rules/effects/effectShared";
import type { OwnerVarKind } from "@/features/editor/scene/rules/effects/effectProjectIndex";
import { generateId } from "@/utils/id";

export type EffectFamilyId = "message" | "progress" | "item" | "hotspot" | "npc" | "player" | "audio" | "dialogue" | "ending";

type EffectByType<T extends Effect["type"]> = Extract<Effect, { type: T }>;

export type EnabledEffect = EffectByType<"showMessage"> | EffectByType<"goToNode"> | EffectByType<"addItem"> | EffectByType<"removeItem"> | EffectByType<"combineItems">
  | EffectByType<"transformItem"> | EffectByType<"startDialogue"> | EffectByType<"endDialogue"> | EffectByType<"giveItemToNpc"> | EffectByType<"receiveItemFromNpc">
  | EffectByType<"setPlacedItemVisible"> | EffectByType<"setPlacedItemReachable"> | EffectByType<"setHotspotVisible"> | EffectByType<"setHotspotReachable">
  | EffectByType<"setHotspotVar"> | EffectByType<"toggleHotspotVar"> | EffectByType<"incHotspotVar"> | EffectByType<"decHotspotVar"> | EffectByType<"setPlacedPlayerVisible">
  | EffectByType<"setPlacedPlayerImage"> | EffectByType<"setPlacedNpcVisible"> | EffectByType<"setPlacedNpcReachable"> | EffectByType<"setPlayerVar">
  | EffectByType<"togglePlayerVar"> | EffectByType<"incPlayerVar"> | EffectByType<"decPlayerVar"> | EffectByType<"setNpcVar"> | EffectByType<"toggleNpcVar">
  | EffectByType<"incNpcVar"> | EffectByType<"decNpcVar"> | EffectByType<"playSfx"> | EffectByType<"playMusic"> | EffectByType<"stopMusic">
  | EffectByType<"setMapRegionAvailable"> | EffectByType<"endGame">;

export type EnabledEffectType = EnabledEffect["type"];

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

type EffectSpec<T extends EnabledEffectType> = {
  familyId: EffectFamilyId;
  label: string;
  ui: EffectUiSpec;
  makeDefault: (factory: FactoryCtx) => EffectByType<T>;
  summarize: (factory: FactoryCtx, effect: EffectByType<T>) => string;
  normalize: (factory: FactoryCtx, effect: EffectByType<T>) => EffectByType<T>;
};

type VariableEffect = Extract<EnabledEffect, { type: "setHotspotVar" | "toggleHotspotVar" | "incHotspotVar" | "decHotspotVar" | "setPlayerVar"
      | "togglePlayerVar" | "incPlayerVar" | "decPlayerVar" | "setNpcVar" | "toggleNpcVar" | "incNpcVar" | "decNpcVar" }>;

const ENABLED_EFFECT_TYPES: EnabledEffectType[] = ["showMessage", "goToNode", "addItem", "removeItem", "transformItem", "combineItems", "startDialogue",
  "endDialogue", "giveItemToNpc", "receiveItemFromNpc", "setPlacedItemVisible", "setPlacedItemReachable", "setHotspotVisible", "setHotspotReachable",
  "setHotspotVar", "toggleHotspotVar", "incHotspotVar", "decHotspotVar", "setPlacedPlayerVisible", "setPlacedPlayerImage", "setPlacedNpcVisible",
  "setPlacedNpcReachable", "setPlayerVar", "togglePlayerVar", "incPlayerVar", "decPlayerVar", "setNpcVar", "toggleNpcVar", "incNpcVar", "decNpcVar",
  "playSfx", "playMusic", "stopMusic", "setMapRegionAvailable", "endGame"];

function normalizeBoolean(value: unknown): boolean {
  return Boolean(value);
}

function normalizeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeId(value: unknown): ID {
  return String(value ?? "").trim();
}

function optionOf(id: string, label?: string): Option<string> {
  return { id, label: label || id };
}

function truncate(value: string, max = 40): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function getOwnerItemInstanceId(factory: FactoryCtx): ID {
  switch (factory.ctx.owner.kind) {
    case "placedItem":
      return ("itemInstanceId" in factory.ctx.owner ? factory.ctx.owner.itemInstanceId : (factory.ctx.owner as { placedItemId?: ID }).placedItemId) ?? "";

    case "playerInventoryItem":
    case "npcInventoryItem":
      return factory.ctx.owner.itemInstance.itemInstanceId;

    default:
      return "";
  }
}

function getOwnerPlayerId(factory: FactoryCtx): ID {
  const owner = factory.ctx.owner;

  if (owner.kind === "playerInventoryItem") return owner.playerId;

  return factory.idx.getPlayerOptions()[0]?.id ?? "";
}

function getSceneOwnerLayerId(factory: FactoryCtx): ID | null {
  const owner = factory.ctx.owner;
  return owner.kind === "hotspot" || owner.kind === "placedItem" || owner.kind === "placedNpc" ? owner.layerId : null;
}

function getSpeakerFromMessage(effect: EffectByType<"showMessage">): Speaker {
  return effect.speaker ?? { kind: "narrator" };
}

function speakerFromOption(factory: FactoryCtx, value: unknown): Speaker | undefined {
  if (typeof value !== "string") return undefined;

  const parsed = factory.idx.parseMessageSpeakerOption(value as never);

  if (parsed.speakerKind === "player") return { kind: "player", playerId: parsed.speakerId ?? "" };
  if (parsed.speakerKind === "npc") return { kind: "npc", npcId: parsed.speakerId ?? "" };

  return { kind: "narrator" };
}

function speakerToOption(factory: FactoryCtx, speaker?: Speaker): string {
  if (!speaker || speaker.kind === "narrator") return factory.idx.formatMessageSpeakerOption({ speakerKind: "narrator" });

  if (speaker.kind === "player") return factory.idx.formatMessageSpeakerOption({ speakerKind: "player", speakerId: speaker.playerId });

  return factory.idx.formatMessageSpeakerOption({ speakerKind: "npc", speakerId: speaker.npcId });
}

function speakerLabel(factory: FactoryCtx, speaker?: Speaker): string {
  if (!speaker || speaker.kind === "narrator") return factory.idx.getMessageSpeakerLabel({ speakerKind: "narrator" });

  if (speaker.kind === "player") return factory.idx.getMessageSpeakerLabel({ speakerKind: "player", speakerId: speaker.playerId });

  return factory.idx.getMessageSpeakerLabel({ speakerKind: "npc", speakerId: speaker.npcId });
}

function boolField(path: string, label: string): EffectFieldSpec {
  return { key: path, label, path, control: "bool" };
}

function numberField(path: string, label: string): EffectFieldSpec {
  return { key: path, label, path, control: "number" };
}

function textField(path: string, label: string): EffectFieldSpec {
  return { key: path, label, path, control: "text" };
}

function nodeField(path = "targetNodeId", label = "Destino"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getNodeOptions({ excludeNodeId: factory.ctx.nodeId }) };
}

function gameItemField(path = "itemInstanceId", label = "Item"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getGameItemOptions() };
}

function playerInventoryItemField(path = "itemInstanceId", label = "Item"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory, effect) => {
      if (effect.type !== "removeItem") return [];

      return factory.idx.getPlayerInventoryItemOptionsForPlayer(effect.playerId);
    },
    disabledWhen: (_factory, effect) => effect.type !== "removeItem" || !effect.playerId,
  };
}

function placedItemField(path = "itemInstanceId", label = "Item colocado"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getPlacedItemOptions() };
}

function secondGameItemField(path = "itemBInstanceId", label = "Combinar con"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select",
    optionsResolver: (factory, effect) => {
      const firstId = effect.type === "combineItems" ? effect.itemAInstanceId : "";
      return factory.idx.getCombinableInventoryItemOptions(firstId).filter((option) => option.id !== firstId);
    },
    disabledWhen: (_factory, effect) => effect.type !== "combineItems" || !effect.itemAInstanceId,
  };
}

function itemDefField(path = "resultItemId", label = "Tipo resultante"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getItemOptions() };
}

function npcField(path = "npcId", label = "NPC"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getNpcOptions() };
}

function playerField(path = "playerId", label = "Player"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getPlayerOptions() };
}

function hotspotField(): EffectFieldSpec {
  return { key: "hotspotId", label: "Hotspot", path: "hotspotId", control: "id-select", optionsResolver: (factory) => factory.idx.getHotspotOptionsAll() };
}

function hotspotVarField(): EffectFieldSpec {
  return { key: "varId", label: "Variable", path: "varId", control: "id-select",
    optionsResolver: (factory, effect) => {
      if (!isHotspotVarEffect(effect)) return [];
      const hotspot = factory.idx.getHotspotById(effect.hotspotId);
      return (hotspot?.vars ?? []).map((entry) => optionOf(entry.id, entry.name || entry.id));
    },
    disabledWhen: (_factory, effect) => !isHotspotVarEffect(effect) || !effect.hotspotId,
  };
}

function playerVarField(): EffectFieldSpec {
  return { key: "varId", label: "Variable", path: "varId", control: "id-select",
    optionsResolver: (factory, effect) => isPlayerVarEffect(effect) ? factory.idx.getPlayerVarOptions(effect.playerId) : [],
    disabledWhen: (_factory, effect) => !isPlayerVarEffect(effect) || !effect.playerId,
  };
}

function npcVarField(): EffectFieldSpec {
  return { key: "varId", label: "Variable", path: "varId", control: "id-select",
    optionsResolver: (factory, effect) => isNpcVarEffect(effect) ? factory.idx.getNpcVarOptions(effect.npcId) : [],
    disabledWhen: (_factory, effect) => !isNpcVarEffect(effect) || !effect.npcId,
  };
}

function placedNpcField(path = "npcId", label = "NPC"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getPlacedNpcOptions() };
}

function placedNpcNodeField(): EffectFieldSpec {
  return { key: "nodeId", label: "Escena", path: "nodeId", control: "id-select",
    optionsResolver: (factory, effect) => isPlacedNpcEffect(effect) ? factory.idx.getPlacedNpcNodeOptions(effect.npcId) : [],
    disabledWhen: (_factory, effect) => !isPlacedNpcEffect(effect) || !effect.npcId,
  };
}

function placedNpcLayerField(): EffectFieldSpec {
  return { key: "layerId", label: "Capa", path: "layerId", control: "id-select",
    optionsResolver: (factory, effect) => isPlacedNpcEffect(effect) ? factory.idx.getPlacedNpcLayerOptions(effect.npcId, effect.nodeId) : [],
    disabledWhen: (_factory, effect) => !isPlacedNpcEffect(effect) || !effect.npcId || !effect.nodeId,
  };
}

function placedPlayerField(path = "playerId", label = "Player"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getPlacedPlayerOptions() };
}

function placedPlayerNodeField(): EffectFieldSpec {
  return { key: "nodeId", label: "Escena", path: "nodeId", control: "id-select",
    optionsResolver: (factory, effect) => isPlacedPlayerEffect(effect) ? factory.idx.getPlacedPlayerNodeOptions(effect.playerId) : [],
    disabledWhen: (_factory, effect) => !isPlacedPlayerEffect(effect) || !effect.playerId,
  };
}

function placedPlayerLayerField(): EffectFieldSpec {
  return { key: "layerId", label: "Capa", path: "layerId", control: "id-select",
    optionsResolver: (factory, effect) => isPlacedPlayerEffect(effect) ? factory.idx.getPlacedPlayerLayerOptions(effect.playerId, effect.nodeId) : [],
    disabledWhen: (_factory, effect) => !isPlacedPlayerEffect(effect) || !effect.playerId || !effect.nodeId,
  };
}

function placedPlayerImageField(): EffectFieldSpec {
  return { key: "imageId", label: "Imagen", path: "imageId", control: "id-select",
    optionsResolver: (factory, effect) => effect.type === "setPlacedPlayerImage" ? factory.idx.getPlayerImageOptions(effect.playerId) : [],
    disabledWhen: (_factory, effect) => effect.type !== "setPlacedPlayerImage" || !effect.playerId,
  };
}

function mapField(): EffectFieldSpec {
  return { key: "mapId", label: "Mapa", path: "mapId", control: "id-select", optionsResolver: (factory) => factory.idx.getMapOptions() };
}

function mapRegionField(): EffectFieldSpec {
  return { key: "regionId", label: "Región", path: "regionId", control: "id-select",
    optionsResolver: (factory, effect) => effect.type === "setMapRegionAvailable" ? factory.idx.getMapRegionOptions(effect.mapId) : [],
    disabledWhen: (_factory, effect) => effect.type !== "setMapRegionAvailable" || !effect.mapId,
  };
}

function sfxField(): EffectFieldSpec {
  return { key: "sfxId", label: "Efecto de sonido", path: "sfxId", control: "id-select", optionsResolver: (factory) => factory.idx.getSfxOptions() };
}

function musicField(path = "trackId", label = "Pista"): EffectFieldSpec {
  return { key: path, label, path, control: "id-select", optionsResolver: (factory) => factory.idx.getMusicOptions() };
}

function speakerField(): EffectFieldSpec {
  return { key: "speaker", label: "Emisor", path: "speaker", control: "id-select",
    optionsResolver: (factory, effect) => {
      const current = effect.type === "showMessage" ? speakerToOption(factory, effect.speaker) : "narrator";
      const options = factory.idx.getMessageSpeakerOptions({ nodeId: factory.ctx.nodeId, layerId: getSceneOwnerLayerId(factory) });

      if (options.some((option) => option.id === current)) return options;

      return [ ...options, { id: current, label: effect.type === "showMessage" ? speakerLabel(factory, effect.speaker) : "Narrador" }];
    },
  };
}

function startAtField(): EffectFieldSpec {
  return { key: "startAt", label: "Inicio", path: "startAt", control: "id-select", optionsResolver: () => [optionOf("resume", "Reanudar"), optionOf("restart", "Reiniciar")] };
}

function isHotspotVarEffect(effect: EnabledEffect): effect is Extract<VariableEffect, { hotspotId: ID }> {
  return effect.type === "setHotspotVar" || effect.type === "toggleHotspotVar" || effect.type === "incHotspotVar" || effect.type === "decHotspotVar";
}

function isPlayerVarEffect(effect: EnabledEffect): effect is Extract<VariableEffect, { playerId: ID }> {
  return effect.type === "setPlayerVar" || effect.type === "togglePlayerVar" || effect.type === "incPlayerVar" || effect.type === "decPlayerVar";
}

function isNpcVarEffect(effect: EnabledEffect): effect is Extract<VariableEffect, { npcId: ID }> {
  return effect.type === "setNpcVar" || effect.type === "toggleNpcVar" || effect.type === "incNpcVar" || effect.type === "decNpcVar";
}

function isPlacedNpcEffect(effect: EnabledEffect): effect is EffectByType<"setPlacedNpcVisible"> | EffectByType<"setPlacedNpcReachable"> {
  return effect.type === "setPlacedNpcVisible" || effect.type === "setPlacedNpcReachable";
}

function isPlacedPlayerEffect(effect: EnabledEffect): effect is EffectByType<"setPlacedPlayerVisible"> | EffectByType<"setPlacedPlayerImage"> {
  return effect.type === "setPlacedPlayerVisible" || effect.type === "setPlacedPlayerImage";
}

function getEffectVarKind(factory: FactoryCtx, effect: EnabledEffect): OwnerVarKind {
  if (isHotspotVarEffect(effect)) {
    const hotspot = factory.idx.getHotspotById(effect.hotspotId);
    const def = hotspot?.vars?.find((entry) => entry.id === effect.varId) ?? null;
    return !def ? "unknown" : def.type === "boolean" ? "boolean" : "number";
  }

  if (isPlayerVarEffect(effect)) return factory.idx.getPlayerVarKind(effect.playerId, effect.varId);
  if (isNpcVarEffect(effect)) return factory.idx.getNpcVarKind(effect.npcId, effect.varId);

  return "unknown";
}

function normalizeRuntimeValue(factory: FactoryCtx, effect: Extract<VariableEffect, { value: unknown }>): boolean | number {
  const kind = getEffectVarKind(factory, effect);
  return kind === "number" ? normalizeNumber(effect.value) : normalizeBoolean(effect.value);
}

function normalizeAmount(value: unknown): number {
  return normalizeNumber(value, 1);
}

function normalizeSpeaker(factory: FactoryCtx, effect: EffectByType<"showMessage"> & Record<string, unknown>): Speaker | undefined {
  const fromLegacy = speakerFromOption(factory, effect.speakerKind === "player" || effect.speakerKind === "npc"
      ? `${effect.speakerKind}:${String(effect.speakerId ?? "")}` : effect.speakerKind === "narrator" ? "narrator" : undefined);

  const speaker = effect.speaker ?? fromLegacy ?? { kind: "narrator" };

  if (speaker.kind === "player") return { kind: "player", playerId: normalizeId(speaker.playerId) };
  if (speaker.kind === "npc") return { kind: "npc", npcId: normalizeId(speaker.npcId) };

  return { kind: "narrator" };
}

function summarizeVariable(factory: FactoryCtx, effect: VariableEffect, action: string, value?: string): string {
  if (isHotspotVarEffect(effect)) {
    const hotspot = factory.idx.getHotspotLabelById(effect.hotspotId);
    const variable = factory.idx.getHotspotById(effect.hotspotId)?.vars?.find((entry) => entry.id === effect.varId)?.name || effect.varId || "—";
    return `${action} ${hotspot} · ${variable}${value ? ` ${value}` : ""}`;
  }

  if (isPlayerVarEffect(effect)) {
    const player = factory.idx.getPlayerLabel(effect.playerId);
    const variable = factory.idx.getPlayerVarLabel(effect.playerId, effect.varId);
    return `${action} ${player} · ${variable}${value ? ` ${value}` : ""}`;
  }

  const npc = factory.idx.getNpcLabel(effect.npcId);
  const variable = factory.idx.getNpcVarLabel(effect.npcId, effect.varId);
  return `${action} ${npc} · ${variable}${value ? ` ${value}` : ""}`;
}

function canUseEffectType(factory: FactoryCtx, type: EnabledEffectType): boolean {
  const hasTargetNodes = factory.idx.getNodeOptions({ excludeNodeId: factory.ctx.nodeId }).length > 0;
  const hasGameItems = factory.idx.getGameItemOptions().length > 0;
  const hasPlayers = factory.idx.getPlayerOptions().length > 0;
  const hasPlayerInventoryItems = factory.idx.getPlayerOptions().some((player) => factory.idx.getPlayerInventoryItemOptionsForPlayer(player.id).length > 0);
  const hasPlacedItems = factory.idx.getPlacedItems().length > 0;
  const hasItemDefs = factory.idx.getItemOptions().length > 0;
  const hasHotspots = factory.idx.getHotspots().length > 0;
  const hasHotspotVars = factory.idx.getHotspots().some((hotspot) => (hotspot.vars?.length ?? 0) > 0);
  const hasPlacedNpcs = factory.idx.getPlacedNpcs().length > 0;
  const hasNpcs = factory.idx.getNpcOptions().length > 0;
  const hasNpcVars = factory.idx.getNpcOptions().some((npc) => factory.idx.getNpcVarOptions(npc.id).length > 0);
  const hasPlacedPlayers = factory.idx.getPlacedPlayers().length > 0;
  const hasPlayerVars = factory.idx.getPlayerOptions().some((player) => factory.idx.getPlayerVarOptions(player.id).length > 0);
  const hasPlacedPlayersWithSeveralImages = factory.idx.getPlacedPlayers().some((player) => factory.idx.getPlayerImageOptions(player.playerId).length > 1);
  const hasDialogues = factory.idx.getDialogueOptions(factory.ctx.nodeId).length > 0;
  const hasSfx = factory.idx.getSfxOptions().length > 0;
  const hasMusic = factory.idx.getMusicOptions().length > 0;
  const hasMaps = factory.idx.getMapOptions().length > 0;
  const currentNodeIsFinal = factory.idx.getNode(factory.ctx.nodeId)?.isFinal === true;

  switch (type) {
    case "showMessage":
      return factory.ctx.owner.kind !== "dialogueLine";

    case "goToNode":
      return hasTargetNodes;

    case "addItem":
      return hasPlayers && hasGameItems;

    case "removeItem":
      return hasPlayers && hasPlayerInventoryItems;

    case "transformItem":
      return hasGameItems && hasItemDefs;

    case "combineItems":
      return hasGameItems && hasItemDefs && factory.idx.getGameItemOptions().length > 1;

    case "setPlacedItemVisible":
    case "setPlacedItemReachable":
      return hasPlacedItems;

    case "setHotspotVisible":
    case "setHotspotReachable":
      return hasHotspots;

    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar":
      return hasHotspotVars;

    case "setPlacedNpcVisible":
    case "setPlacedNpcReachable":
      return hasPlacedNpcs;

    case "giveItemToNpc":
    case "receiveItemFromNpc":
      return hasNpcs && hasGameItems;

    case "setNpcVar":
    case "toggleNpcVar":
    case "incNpcVar":
    case "decNpcVar":
      return hasNpcs && hasNpcVars;

    case "setPlacedPlayerVisible":
      return hasPlacedPlayers;

    case "setPlacedPlayerImage":
      return hasPlacedPlayersWithSeveralImages;

    case "setPlayerVar":
    case "togglePlayerVar":
    case "incPlayerVar":
    case "decPlayerVar":
      return hasPlayers && hasPlayerVars;

    case "startDialogue":
      return hasDialogues;

    case "endDialogue":
      return factory.ctx.owner.kind === "dialogueLine";

    case "playSfx":
      return hasSfx;

    case "playMusic":
    case "stopMusic":
      return hasMusic;

    case "setMapRegionAvailable":
      return hasMaps;

    case "endGame":
      return currentNodeIsFinal;
  }
}

export function enabledEffectTypes(factory: FactoryCtx): EnabledEffectType[] {
  return ENABLED_EFFECT_TYPES.filter((type) => canUseEffectType(factory, type));
}

const EFFECT_REGISTRY: { [K in EnabledEffectType]: EffectSpec<K> } = {
  showMessage: {
    familyId: "message",
    label: "Mostrar mensaje",
    ui: {
      layoutClassName: "grid grid-cols-1 gap-2",
      fields: [speakerField(), textField("text", "Texto")],
    },
    makeDefault: () => ({ type: "showMessage", text: "", speaker: { kind: "narrator" } }),
    summarize: (factory, effect) => {
      const text = String(effect.text ?? "").trim();
      const speaker = speakerLabel(factory, getSpeakerFromMessage(effect));
      return text ? `${speaker}: “${truncate(text)}”` : speaker;
    },
    normalize: (factory, effect) => ({
      type: "showMessage",
      text: String(effect.text ?? ""),
      speaker: normalizeSpeaker(factory, effect as never),
    }),
  },

  goToNode: {
    familyId: "progress",
    label: "Ir a escena",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [nodeField()] },
    makeDefault: () => ({ type: "goToNode", targetNodeId: "" }),
    summarize: ({ idx }, effect) => idx.getNodeLabel(effect.targetNodeId),
    normalize: (_factory, effect) => ({ type: "goToNode", targetNodeId: normalizeId(effect.targetNodeId) }),
  },

  addItem: {
    familyId: "item",
    label: "Añadir al inventario",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [gameItemField(), playerField()] },
    makeDefault: (factory) => ({ type: "addItem", playerId: getOwnerPlayerId(factory), itemInstanceId: "" }),
    summarize: ({ idx }, effect) => {
      const item = idx.getGameItemLabel(effect.itemInstanceId);
      const player = idx.getPlayerLabel(effect.playerId);
      
      return `${item} → ${player}`;
    },
    normalize: (factory, effect) => ({ type: "addItem", playerId: normalizeId(effect.playerId || getOwnerPlayerId(factory)),
      itemInstanceId: normalizeId(effect.itemInstanceId) }),
  },

  removeItem: {
    familyId: "item",
    label: "Eliminar del inventario",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [playerInventoryItemField(), playerField()] },
    makeDefault: (factory) => ({ type: "removeItem", playerId: getOwnerPlayerId(factory), itemInstanceId: "" }),
    summarize: ({ idx }, effect) => {
      const item = idx.getPlayerInventoryItemLabelForPlayer(effect.playerId, effect.itemInstanceId);
      const player = idx.getPlayerLabel(effect.playerId);
      
      return `${item} de ${player}`;
    },
    normalize: (factory, effect) => ({ type: "removeItem", playerId: normalizeId(effect.playerId || getOwnerPlayerId(factory)),
      itemInstanceId: normalizeId(effect.itemInstanceId) }),
  },

  transformItem: {
    familyId: "item",
    label: "Transformar item",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [
        gameItemField("itemInstanceId", "Item original"),
        itemDefField("resultItemId", "Tipo resultante"),
        textField("resultItemLabel", "Nombre de la nueva instancia"),
      ],
    },
    makeDefault: (factory) => ({
      type: "transformItem",
      itemInstanceId: getOwnerItemInstanceId(factory),
      resultItemId: factory.idx.getItemOptions()[0]?.id ?? "",
      resultItemInstanceId: generateId.itemInstance(),
      resultItemLabel: "",
    }),
    summarize: ({ idx }, effect) => {
      const source = idx.getGameItemLabel(effect.itemInstanceId);
      const result = effect.resultItemLabel.trim() || idx.getItemLabel(effect.resultItemId);
      return `${source} → ${result}`;
    },
    normalize: (factory, effect) => ({
      type: "transformItem",
      itemInstanceId: normalizeId(effect.itemInstanceId || getOwnerItemInstanceId(factory)),
      resultItemId: normalizeId(effect.resultItemId),
      resultItemInstanceId: normalizeId(effect.resultItemInstanceId || generateId.itemInstance()),
      resultItemLabel: String(effect.resultItemLabel ?? ""),
    }),
  },

  combineItems: {
    familyId: "item",
    label: "Combinar items",
    ui: {
      layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2",
      fields: [
        gameItemField("itemAInstanceId", "Item A"),
        secondGameItemField("itemBInstanceId", "Item B"),
        itemDefField("resultItemId", "Tipo creado"),
        textField("resultItemLabel", "Nombre de la nueva instancia"),
      ],
    },
    makeDefault: (factory) => ({
      type: "combineItems",
      itemAInstanceId: getOwnerItemInstanceId(factory),
      itemBInstanceId: "",
      resultItemId: factory.idx.getItemOptions()[0]?.id ?? "",
      resultItemInstanceId: generateId.itemInstance(),
      resultItemLabel: "",
    }),
    summarize: ({ idx }, effect) => {
      const a = idx.getGameItemLabel(effect.itemAInstanceId);
      const b = idx.getGameItemLabel(effect.itemBInstanceId);
      const result = effect.resultItemLabel.trim() || idx.getItemLabel(effect.resultItemId);
      return `${a} + ${b} → ${result}`;
    },
    normalize: (factory, effect) => ({
      type: "combineItems",
      itemAInstanceId: normalizeId(effect.itemAInstanceId || getOwnerItemInstanceId(factory)),
      itemBInstanceId: normalizeId(effect.itemBInstanceId),
      resultItemId: normalizeId(effect.resultItemId),
      resultItemInstanceId: normalizeId(effect.resultItemInstanceId || generateId.itemInstance()),
      resultItemLabel: String(effect.resultItemLabel ?? ""),
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
          optionsResolver: (factory) => factory.idx.getDialogueOptions(factory.ctx.nodeId),
        },
      ],
    },
    makeDefault: (factory) => ({ type: "startDialogue", nodeDialogueId: factory.idx.getDialogueOptions(factory.ctx.nodeId)[0]?.id ?? "" }),
    summarize: (factory, effect) => factory.idx.getDialogueLabel(factory.ctx.nodeId, effect.nodeDialogueId),
    normalize: (_factory, effect) => ({ type: "startDialogue", nodeDialogueId: normalizeId(effect.nodeDialogueId) }),
  },

  endDialogue: {
    familyId: "dialogue",
    label: "Terminar diálogo",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [] },
    makeDefault: () => ({ type: "endDialogue" }),
    summarize: () => "Terminar diálogo",
    normalize: () => ({ type: "endDialogue" }),
  },

  giveItemToNpc: {
    familyId: "npc",
    label: "Dar item",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [npcField(), gameItemField()] },
    makeDefault: () => ({ type: "giveItemToNpc", npcId: "", itemInstanceId: "" }),
    summarize: ({ idx }, effect) => `${idx.getGameItemLabel(effect.itemInstanceId)} a ${idx.getNpcLabel(effect.npcId)}`,
    normalize: (_factory, effect) => ({ type: "giveItemToNpc", npcId: normalizeId(effect.npcId), itemInstanceId: normalizeId(effect.itemInstanceId) }),
  },

  receiveItemFromNpc: {
    familyId: "npc",
    label: "Recibir item",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [npcField(), gameItemField()] },
    makeDefault: () => ({ type: "receiveItemFromNpc", npcId: "", itemInstanceId: "" }),
    summarize: ({ idx }, effect) => `${idx.getGameItemLabel(effect.itemInstanceId)} de ${idx.getNpcLabel(effect.npcId)}`,
    normalize: (_factory, effect) => ({ type: "receiveItemFromNpc", npcId: normalizeId(effect.npcId), itemInstanceId: normalizeId(effect.itemInstanceId) }),
  },

  setPlacedItemVisible: {
    familyId: "item",
    label: "Visible",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [placedItemField(), boolField("value", "Valor")] },
    makeDefault: () => ({ type: "setPlacedItemVisible", itemInstanceId: "", value: true }),
    summarize: ({ idx }, effect) => `${idx.getPlacedItemLabel(effect.itemInstanceId)} visible = ${String(effect.value)}`,
    normalize: (_factory, effect) => ({ type: "setPlacedItemVisible", itemInstanceId: normalizeId(effect.itemInstanceId), value: normalizeBoolean(effect.value) }),
  },

  setPlacedItemReachable: {
    familyId: "item",
    label: "Alcanzable",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [placedItemField(), boolField("value", "Valor")] },
    makeDefault: () => ({ type: "setPlacedItemReachable", itemInstanceId: "", value: true }),
    summarize: ({ idx }, effect) => `${idx.getPlacedItemLabel(effect.itemInstanceId)} alcanzable = ${String(effect.value)}`,
    normalize: (_factory, effect) => ({ type: "setPlacedItemReachable", itemInstanceId: normalizeId(effect.itemInstanceId), value: normalizeBoolean(effect.value) }),
  },

  setHotspotVisible: {
    familyId: "hotspot",
    label: "Visible",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [hotspotField(), boolField("value", "Valor")] },
    makeDefault: () => ({ type: "setHotspotVisible", hotspotId: "", value: true }),
    summarize: ({ idx }, effect) => `${idx.getHotspotLabelById(effect.hotspotId)} visible = ${String(effect.value)}`,
    normalize: (_factory, effect) => ({ type: "setHotspotVisible", hotspotId: normalizeId(effect.hotspotId), value: normalizeBoolean(effect.value) }),
  },

  setHotspotReachable: {
    familyId: "hotspot",
    label: "Alcanzable",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [hotspotField(), boolField("value", "Valor")] },
    makeDefault: () => ({ type: "setHotspotReachable", hotspotId: "", value: true }),
    summarize: ({ idx }, effect) => `${idx.getHotspotLabelById(effect.hotspotId)} alcanzable = ${String(effect.value)}`,
    normalize: (_factory, effect) => ({ type: "setHotspotReachable", hotspotId: normalizeId(effect.hotspotId), value: normalizeBoolean(effect.value) }),
  },

  setHotspotVar: {
    familyId: "hotspot",
    label: "Variable",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2", fields: [hotspotField(), hotspotVarField(), { key: "value", label: "Valor", path: "value", control: "var-value" }] },
    makeDefault: () => ({ type: "setHotspotVar", hotspotId: "", varId: "", value: true }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Asignar", `= ${String(effect.value)}`),
    normalize: (factory, effect) => ({ type: "setHotspotVar", hotspotId: normalizeId(effect.hotspotId), varId: normalizeId(effect.varId), value: normalizeRuntimeValue(factory, effect) }),
  },

  toggleHotspotVar: {
    familyId: "hotspot",
    label: "Toggle",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [hotspotField(), hotspotVarField()] },
    makeDefault: () => ({ type: "toggleHotspotVar", hotspotId: "", varId: "" }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Toggle"),
    normalize: (_factory, effect) => ({ type: "toggleHotspotVar", hotspotId: normalizeId(effect.hotspotId), varId: normalizeId(effect.varId) }),
  },

  incHotspotVar: {
    familyId: "hotspot",
    label: "Incrementar",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2", fields: [hotspotField(), hotspotVarField(), numberField("amount", "Cantidad")] },
    makeDefault: () => ({ type: "incHotspotVar", hotspotId: "", varId: "", amount: 1 }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Incrementar", `+${String(effect.amount ?? 1)}`),
    normalize: (_factory, effect) => ({ type: "incHotspotVar", hotspotId: normalizeId(effect.hotspotId), varId: normalizeId(effect.varId), amount: normalizeAmount(effect.amount) }),
  },

  decHotspotVar: {
    familyId: "hotspot",
    label: "Decrementar",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2", fields: [hotspotField(), hotspotVarField(), numberField("amount", "Cantidad")] },
    makeDefault: () => ({ type: "decHotspotVar", hotspotId: "", varId: "", amount: 1 }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Decrementar", `-${String(effect.amount ?? 1)}`),
    normalize: (_factory, effect) => ({ type: "decHotspotVar", hotspotId: normalizeId(effect.hotspotId), varId: normalizeId(effect.varId), amount: normalizeAmount(effect.amount) }),
  },

  setPlacedPlayerVisible: {
    familyId: "player",
    label: "Visible",
    ui: { layoutClassName: "space-y-2", fields: [placedPlayerField(), placedPlayerNodeField(), placedPlayerLayerField(), boolField("value", "Valor")] },
    makeDefault: () => ({ type: "setPlacedPlayerVisible", nodeId: "", layerId: "", playerId: "", value: true }),
    summarize: ({ idx }, effect) => `${idx.getPlacedPlayerContextLabel(effect.nodeId, effect.layerId, effect.playerId)} visible = ${String(effect.value)}`,
    normalize: (_factory, effect) => ({ type: "setPlacedPlayerVisible", nodeId: normalizeId(effect.nodeId), layerId: normalizeId(effect.layerId), playerId: normalizeId(effect.playerId), value: normalizeBoolean(effect.value) }),
  },

  setPlacedPlayerImage: {
    familyId: "player",
    label: "Cambiar imagen",
    ui: { layoutClassName: "space-y-2", fields: [placedPlayerField(), placedPlayerNodeField(), placedPlayerLayerField(), placedPlayerImageField()] },
    makeDefault: () => ({ type: "setPlacedPlayerImage", nodeId: "", layerId: "", playerId: "", imageId: "" }),
    summarize: ({ idx }, effect) => `${idx.getPlacedPlayerContextLabel(effect.nodeId, effect.layerId, effect.playerId)}: ${idx.getPlayerImageLabel(effect.playerId, effect.imageId)}`,
    normalize: (_factory, effect) => ({ type: "setPlacedPlayerImage", nodeId: normalizeId(effect.nodeId), layerId: normalizeId(effect.layerId), playerId: normalizeId(effect.playerId), imageId: normalizeId(effect.imageId) }),
  },

  setPlacedNpcVisible: {
    familyId: "npc",
    label: "Visible",
    ui: { layoutClassName: "space-y-2", fields: [placedNpcField(), placedNpcNodeField(), placedNpcLayerField(), boolField("value", "Valor")] },
    makeDefault: () => ({ type: "setPlacedNpcVisible", nodeId: "", layerId: "", npcId: "", value: true }),
    summarize: ({ idx }, effect) => `${idx.getPlacedNpcContextLabel(effect.nodeId, effect.layerId, effect.npcId)} visible = ${String(effect.value)}`,
    normalize: (_factory, effect) => ({ type: "setPlacedNpcVisible", nodeId: normalizeId(effect.nodeId), layerId: normalizeId(effect.layerId), npcId: normalizeId(effect.npcId), value: normalizeBoolean(effect.value) }),
  },

  setPlacedNpcReachable: {
    familyId: "npc",
    label: "Alcanzable",
    ui: { layoutClassName: "space-y-2", fields: [placedNpcField(), placedNpcNodeField(), placedNpcLayerField(), boolField("value", "Valor")] },
    makeDefault: () => ({ type: "setPlacedNpcReachable", nodeId: "", layerId: "", npcId: "", value: true }),
    summarize: ({ idx }, effect) => `${idx.getPlacedNpcContextLabel(effect.nodeId, effect.layerId, effect.npcId)} alcanzable = ${String(effect.value)}`,
    normalize: (_factory, effect) => ({ type: "setPlacedNpcReachable", nodeId: normalizeId(effect.nodeId), layerId: normalizeId(effect.layerId), npcId: normalizeId(effect.npcId), value: normalizeBoolean(effect.value) }),
  },

  setPlayerVar: {
    familyId: "player",
    label: "Variable",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2", fields: [playerField(), playerVarField(), { key: "value", label: "Valor", path: "value", control: "var-value" }] },
    makeDefault: () => ({ type: "setPlayerVar", playerId: "", varId: "", value: true }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Asignar", `= ${String(effect.value)}`),
    normalize: (factory, effect) => ({ type: "setPlayerVar", playerId: normalizeId(effect.playerId), varId: normalizeId(effect.varId), value: normalizeRuntimeValue(factory, effect) }),
  },

  togglePlayerVar: {
    familyId: "player",
    label: "Toggle",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [playerField(), playerVarField()] },
    makeDefault: () => ({ type: "togglePlayerVar", playerId: "", varId: "" }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Toggle"),
    normalize: (_factory, effect) => ({ type: "togglePlayerVar", playerId: normalizeId(effect.playerId), varId: normalizeId(effect.varId) }),
  },

  incPlayerVar: {
    familyId: "player",
    label: "Incrementar",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2", fields: [playerField(), playerVarField(), numberField("amount", "Cantidad")] },
    makeDefault: () => ({ type: "incPlayerVar", playerId: "", varId: "", amount: 1 }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Incrementar", `+${String(effect.amount ?? 1)}`),
    normalize: (_factory, effect) => ({ type: "incPlayerVar", playerId: normalizeId(effect.playerId), varId: normalizeId(effect.varId), amount: normalizeAmount(effect.amount) }),
  },

  decPlayerVar: {
    familyId: "player",
    label: "Decrementar",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2", fields: [playerField(), playerVarField(), numberField("amount", "Cantidad")] },
    makeDefault: () => ({ type: "decPlayerVar", playerId: "", varId: "", amount: 1 }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Decrementar", `-${String(effect.amount ?? 1)}`),
    normalize: (_factory, effect) => ({ type: "decPlayerVar", playerId: normalizeId(effect.playerId), varId: normalizeId(effect.varId), amount: normalizeAmount(effect.amount) }),
  },

  setNpcVar: {
    familyId: "npc",
    label: "Variable",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2", fields: [npcField(), npcVarField(), { key: "value", label: "Valor", path: "value", control: "var-value" }] },
    makeDefault: () => ({ type: "setNpcVar", npcId: "", varId: "", value: true }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Asignar", `= ${String(effect.value)}`),
    normalize: (factory, effect) => ({ type: "setNpcVar", npcId: normalizeId(effect.npcId), varId: normalizeId(effect.varId), value: normalizeRuntimeValue(factory, effect) }),
  },

  toggleNpcVar: {
    familyId: "npc",
    label: "Toggle",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [npcField(), npcVarField()] },
    makeDefault: () => ({ type: "toggleNpcVar", npcId: "", varId: "" }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Toggle"),
    normalize: (_factory, effect) => ({ type: "toggleNpcVar", npcId: normalizeId(effect.npcId), varId: normalizeId(effect.varId) }),
  },

  incNpcVar: {
    familyId: "npc",
    label: "Incrementar",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2", fields: [npcField(), npcVarField(), numberField("amount", "Cantidad")] },
    makeDefault: () => ({ type: "incNpcVar", npcId: "", varId: "", amount: 1 }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Incrementar", `+${String(effect.amount ?? 1)}`),
    normalize: (_factory, effect) => ({ type: "incNpcVar", npcId: normalizeId(effect.npcId), varId: normalizeId(effect.varId), amount: normalizeAmount(effect.amount) }),
  },

  decNpcVar: {
    familyId: "npc",
    label: "Decrementar",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2", fields: [npcField(), npcVarField(), numberField("amount", "Cantidad")] },
    makeDefault: () => ({ type: "decNpcVar", npcId: "", varId: "", amount: 1 }),
    summarize: (factory, effect) => summarizeVariable(factory, effect, "Decrementar", `-${String(effect.amount ?? 1)}`),
    normalize: (_factory, effect) => ({ type: "decNpcVar", npcId: normalizeId(effect.npcId), varId: normalizeId(effect.varId), amount: normalizeAmount(effect.amount) }),
  },

  playSfx: {
    familyId: "audio",
    label: "Reproducir SFX",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [sfxField()] },
    makeDefault: () => ({ type: "playSfx", sfxId: "" }),
    summarize: ({ idx }, effect) => idx.getSfxLabel(effect.sfxId),
    normalize: (_factory, effect) => ({ type: "playSfx", sfxId: normalizeId(effect.sfxId) }),
  },

  playMusic: {
    familyId: "audio",
    label: "Reproducir música",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-2 gap-2", fields: [musicField(), startAtField()] },
    makeDefault: () => ({ type: "playMusic", trackId: "", startAt: "resume" }),
    summarize: ({ idx }, effect) => idx.getMusicLabel(effect.trackId),
    normalize: (_factory, effect) => ({ type: "playMusic", trackId: normalizeId(effect.trackId), startAt: effect.startAt === "restart" ? "restart" : "resume" }),
  },

  stopMusic: {
    familyId: "audio",
    label: "Detener música",
    ui: { layoutClassName: "grid grid-cols-1 gap-2", fields: [musicField()] },
    makeDefault: () => ({ type: "stopMusic", trackId: "" }),
    summarize: ({ idx }, effect) => `Detener ${idx.getMusicLabel(effect.trackId)}`,
    normalize: (_factory, effect) => ({ type: "stopMusic", trackId: normalizeId(effect.trackId) }),
  },

  setMapRegionAvailable: {
    familyId: "progress",
    label: "Región de mapa disponible",
    ui: { layoutClassName: "grid grid-cols-1 md:grid-cols-3 gap-2", fields: [mapField(), mapRegionField(), boolField("value", "Valor")] },
    makeDefault: (factory) => ({ type: "setMapRegionAvailable", mapId: factory.idx.getMapOptions()[0]?.id ?? "", regionId: "", value: true }),
    summarize: ({ idx }, effect) => `${idx.getMapLabel(effect.mapId)} · ${idx.getMapRegionLabel(effect.mapId, effect.regionId)} = ${String(effect.value)}`,
    normalize: (_factory, effect) => ({ type: "setMapRegionAvailable", mapId: normalizeId(effect.mapId), regionId: normalizeId(effect.regionId), value: normalizeBoolean(effect.value) }),
  },

  endGame: {
    familyId: "ending",
    label: "Finalizar juego",
    ui: {
      layoutClassName: "grid grid-cols-1 gap-2",
      fields: [
        textField("ending.message", "Mensaje final"),
        textField("ending.dockText", "Texto del dock"),
        musicField("ending.musicTrackId", "Música final"),
      ],
    },
    makeDefault: () => ({ type: "endGame", ending: { message: "", lines: [], dockText: "", musicTrackId: "" } }),
    summarize: ({ idx }, effect) => {
      const message = String(effect.ending?.message ?? "").trim();
      const dockText = String(effect.ending?.dockText ?? "").trim();
      const music = effect.ending?.musicTrackId ? idx.getMusicLabel(effect.ending.musicTrackId) : "";

      if (message) return `Mensaje: “${truncate(message)}”`;
      if (dockText) return `Dock: “${truncate(dockText)}”`;
      if (music) return `Música: ${music}`;
      return "Finalizar juego";
    },
    normalize: (_factory, effect) => ({
      type: "endGame",
      ending: {
        message: String(effect.ending?.message ?? ""),
        lines: effect.ending?.lines ?? [],
        dockText: String(effect.ending?.dockText ?? ""),
        musicTrackId: normalizeId(effect.ending?.musicTrackId),
      },
    }),
  },
};

function clearDependentFields(prev: EnabledEffect, next: EnabledEffect): EnabledEffect {
  if (prev.type !== next.type) return next;

  if (next.type === "removeItem" && prev.type === "removeItem") {
    if (prev.playerId !== next.playerId) return { ...next, itemInstanceId: "" };
  }

  if (next.type === "combineItems" && prev.type === "combineItems") {
    if (prev.itemAInstanceId !== next.itemAInstanceId && next.itemBInstanceId === next.itemAInstanceId) return { ...next, itemBInstanceId: "" };
  }

  if (isHotspotVarEffect(next) && isHotspotVarEffect(prev)) {
    if (prev.hotspotId !== next.hotspotId) return { ...next, varId: "" } as EnabledEffect;
  }

  if (isPlayerVarEffect(next) && isPlayerVarEffect(prev)) {
    if (prev.playerId !== next.playerId) return { ...next, varId: "" } as EnabledEffect;
  }

  if (isNpcVarEffect(next) && isNpcVarEffect(prev)) {
    if (prev.npcId !== next.npcId) return { ...next, varId: "" } as EnabledEffect;
  }

  if (isPlacedNpcEffect(next) && isPlacedNpcEffect(prev)) {
    if (prev.npcId !== next.npcId) return { ...next, nodeId: "", layerId: "" };
    if (prev.nodeId !== next.nodeId) return { ...next, layerId: "" };
  }

  if (isPlacedPlayerEffect(next) && isPlacedPlayerEffect(prev)) {
    if (prev.playerId !== next.playerId) {
      return next.type === "setPlacedPlayerImage" ? { ...next, nodeId: "", layerId: "", imageId: "" } : { ...next, nodeId: "", layerId: "" };
    }

    if (prev.nodeId !== next.nodeId) {
      return next.type === "setPlacedPlayerImage" ? { ...next, layerId: "", imageId: "" } : { ...next, layerId: "" };
    }

    if (next.type === "setPlacedPlayerImage" && prev.type === "setPlacedPlayerImage" && prev.layerId !== next.layerId) {
      return { ...next, imageId: "" };
    }
  }

  if (next.type === "setMapRegionAvailable" && prev.type === "setMapRegionAvailable" && prev.mapId !== next.mapId) {
    return { ...next, regionId: "" };
  }

  return next;
}

export function effectLabel(type: EnabledEffectType): string {
  return EFFECT_REGISTRY[type].label;
}

export function createDefaultEffect<T extends EnabledEffectType>(factory: FactoryCtx, type: T): EffectByType<T> {
  return EFFECT_REGISTRY[type].makeDefault(factory);
}

export function summarizeEffect(factory: FactoryCtx, effect: EnabledEffect): string {
  return EFFECT_REGISTRY[effect.type].summarize(factory, effect as never);
}

export function isEnabledEffect(effect: Effect): effect is EnabledEffect {
  return Boolean(effect && typeof effect === "object" && "type" in effect && effect.type in EFFECT_REGISTRY);
}

export function getEffectUi(type: EnabledEffectType): EffectUiSpec {
  return EFFECT_REGISTRY[type].ui;
}

export function getEffectOptions(factory: FactoryCtx, effect: EnabledEffect, field: EffectFieldSpec): Option<string>[] {
  return field.optionsResolver?.(factory, effect) ?? [];
}

export function applyEffectPatch(factory: FactoryCtx, prev: EnabledEffect, patch: Partial<EnabledEffect>): EnabledEffect {
  const patched = { ...prev, ...patch } as EnabledEffect;
  const cleared = clearDependentFields(prev, patched);
  return EFFECT_REGISTRY[cleared.type].normalize(factory, cleared as never);
}

export function effectFamilyOf(type: EnabledEffectType): EffectFamilyId {
  return EFFECT_REGISTRY[type].familyId;
}

function getEffectTypesByFamily(familyId: EffectFamilyId): EnabledEffectType[] {
  return ENABLED_EFFECT_TYPES.filter((type) => EFFECT_REGISTRY[type].familyId === familyId);
}

export function getEnabledEffectTypesByFamily(factory: FactoryCtx, familyId: EffectFamilyId): EnabledEffectType[] {
  const enabled = new Set(enabledEffectTypes(factory));
  return getEffectTypesByFamily(familyId).filter((type) => enabled.has(type));
}

export function hasSelectedPrimaryEffectEntity(effect: EnabledEffect): boolean {
  switch (effect.type) {
    case "showMessage":
    case "endDialogue":
    case "endGame":
      return true;

    case "goToNode":
      return Boolean(effect.targetNodeId);

    case "setMapRegionAvailable":
      return Boolean(effect.mapId);

    case "addItem":
    case "removeItem":
      return Boolean(effect.itemInstanceId);

    case "transformItem":
    case "setPlacedItemVisible":
    case "setPlacedItemReachable":
      return Boolean(effect.itemInstanceId);

    case "combineItems":
      return Boolean(effect.itemAInstanceId);

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

    case "playSfx":
      return Boolean(effect.sfxId);

    case "playMusic":
    case "stopMusic":
      return Boolean(effect.trackId);

    case "startDialogue":
      return Boolean(effect.nodeDialogueId);
  }
}

export function getAvailableEffectTypesForCurrentSelection(factory: FactoryCtx, familyId: EffectFamilyId, effect: EnabledEffect): EnabledEffectType[] {
  const enabled = getEnabledEffectTypesByFamily(factory, familyId);

  if (familyId === "item") {
    const primaryItemId = effect.type === "combineItems" ? effect.itemAInstanceId : "itemInstanceId" in effect ? effect.itemInstanceId : "";

    const inventoryTypes: EnabledEffectType[] = ["addItem", "removeItem", "transformItem", "combineItems"];
    const placedTypes: EnabledEffectType[] = ["setPlacedItemVisible", "setPlacedItemReachable"];

    if (!primaryItemId) return enabled;

    const isPlacedItem = factory.idx.isPlacedItemInstance(primaryItemId);
    return enabled.filter((type) => inventoryTypes.includes(type) || (isPlacedItem && placedTypes.includes(type)));
  }

  if (familyId === "hotspot") {
    const hotspotId = "hotspotId" in effect ? effect.hotspotId : "";
    const structural: EnabledEffectType[] = ["setHotspotVisible", "setHotspotReachable"];

    if (!hotspotId) return enabled.filter((type) => structural.includes(type) || type === "setHotspotVar");

    const hotspot = factory.idx.getHotspotById(hotspotId);
    if ((hotspot?.vars?.length ?? 0) === 0) return enabled.filter((type) => structural.includes(type));

    const kind = getEffectVarKind(factory, effect);
    const variableTypes: EnabledEffectType[] = kind === "boolean" ? ["setHotspotVar", "toggleHotspotVar"] : kind === "number"
          ? ["setHotspotVar", "incHotspotVar", "decHotspotVar"] : ["setHotspotVar"];

    return enabled.filter((type) => structural.includes(type) || variableTypes.includes(type));
  }

  if (familyId === "npc") {
    const npcId = "npcId" in effect ? effect.npcId : "";
    const structural: EnabledEffectType[] = ["setPlacedNpcVisible", "setPlacedNpcReachable", "giveItemToNpc", "receiveItemFromNpc"];

    if (!npcId) return enabled.filter((type) => structural.includes(type) || type === "setNpcVar");
    if (factory.idx.getNpcVarOptions(npcId).length === 0) return enabled.filter((type) => structural.includes(type));

    const kind = getEffectVarKind(factory, effect);
    const variableTypes: EnabledEffectType[] = kind === "boolean" ? ["setNpcVar", "toggleNpcVar"] : kind === "number"
          ? ["setNpcVar", "incNpcVar", "decNpcVar"] : ["setNpcVar"];

    return enabled.filter((type) => structural.includes(type) || variableTypes.includes(type));
  }

  if (familyId === "player") {
    const playerId = "playerId" in effect ? effect.playerId : "";
    const structural: EnabledEffectType[] = ["setPlacedPlayerVisible"];

    if (playerId && factory.idx.getPlayerImageOptions(playerId).length > 1) structural.push("setPlacedPlayerImage");
    else if (!playerId && enabled.includes("setPlacedPlayerImage")) structural.push("setPlacedPlayerImage");

    if (!playerId) return enabled.filter((type) => structural.includes(type) || type === "setPlayerVar");
    if (factory.idx.getPlayerVarOptions(playerId).length === 0) return enabled.filter((type) => structural.includes(type));

    const kind = getEffectVarKind(factory, effect);
    const variableTypes: EnabledEffectType[] = kind === "boolean" ? ["setPlayerVar", "togglePlayerVar"] : kind === "number"
          ? ["setPlayerVar", "incPlayerVar", "decPlayerVar"] : ["setPlayerVar"];

    return enabled.filter((type) => structural.includes(type) || variableTypes.includes(type));
  }

  return enabled;
}