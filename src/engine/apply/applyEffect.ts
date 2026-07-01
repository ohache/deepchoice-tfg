import type { ID, Project, Hotspot, VarDef, ItemInstance } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import type { GameState, InventoryEntry } from "@/engine/state/runtimeState";
import { ensureNodeRuntime, resolveRequiredInventoryPlayerId } from "@/engine/state/runtimeState";
import { musicPlay, musicStop } from "@/engine/state/slices/musicSlice";
import type { AudioAdapter } from "@/engine/adapters/SfxAdapter";
import { publicPath } from "@/shared/helpers";

export type ApplyEffectCtx = {
  audio?: AudioAdapter;
  emitMessage?: (text: string, speaker: { kind: "narrator" | "player" | "npc"; speakerId?: ID }) => void;
  itemUsePair?: { sourceItemInstanceId: ID; targetItemInstanceId: ID };
  inventoryPlayerId?: ID | null;
};

type RuntimeVarValue = boolean | number;
type RuntimeVarMap = Record<ID, RuntimeVarValue>;

/* Inventario */
function addInventoryEntry(inventory: InventoryEntry[], entry: InventoryEntry): InventoryEntry[] {
  const alreadyExists = inventory.some((item) => item.itemInstanceId === entry.itemInstanceId);

  if (alreadyExists) return inventory;

  return [...inventory, entry];
}

function removeFromInventory(inventory: InventoryEntry[], instanceId: ID): InventoryEntry[] {
  const index = inventory.findIndex((entry) => entry.itemInstanceId === instanceId);

  if (index < 0) return inventory;

  return [...inventory.slice(0, index), ...inventory.slice(index + 1)];
}

function getPlayerInventory(state: GameState, playerId: ID): InventoryEntry[] {
  return state.playerInventory[playerId] ?? [];
}

function setPlayerInventory(state: GameState, playerId: ID, inventory: InventoryEntry[]): GameState {
  return { ...state, playerInventory: { ...state.playerInventory, [playerId]: inventory } };
}

function addPlayerInventoryEntry(state: GameState, playerId: ID, entry: InventoryEntry): GameState {
  const inventory = getPlayerInventory(state, playerId);

  return setPlayerInventory(state, playerId, addInventoryEntry(inventory, entry));
}

function removePlayerInventoryEntry(state: GameState, playerId: ID, itemInstanceId: ID): GameState {
  const inventory = getPlayerInventory(state, playerId);

  return setPlayerInventory(state, playerId, removeFromInventory(inventory, itemInstanceId));
}

function findInventoryEntryInAnyPlayer(state: GameState, itemInstanceId: ID): { playerId: ID; entry: InventoryEntry } | null {
  for (const [playerId, inventory] of Object.entries(state.playerInventory)) {
    const entry = inventory.find((item) => item.itemInstanceId === itemInstanceId);

    if (entry) return { playerId, entry };
  }

  return null;
}

export function addInventoryInstance(state: GameState, playerId: ID, itemInstanceId: ID, itemId: ID, label?: string): GameState {
  return addPlayerInventoryEntry(state, playerId, { itemInstanceId, itemId, label });
}

function isMatchingItemUsePair(effect: Extract<Effect, { type: "combineItems" }>, pair?: ApplyEffectCtx["itemUsePair"]): boolean {
  if (!pair) return false;

  const a = effect.itemAInstanceId;
  const b = effect.itemBInstanceId;

  return ((pair.sourceItemInstanceId === a && pair.targetItemInstanceId === b) || (pair.sourceItemInstanceId === b && pair.targetItemInstanceId === a));
}

/* Búsquedas en proyecto */
function findDialogueInCurrentNode(state: GameState, dialogueId: ID) {
  const node = state.project.nodes.find((projectNode) => projectNode.id === state.currentNodeId);
  if (!node) return null;

  return (node.dialogues ?? []).find((dialogue) => dialogue.id === dialogueId) ?? null;
}

function itemInstanceToInventoryEntry(item: ItemInstance): InventoryEntry {
  return {
    itemInstanceId: item.itemInstanceId,
    itemId: item.itemId,
    label: item.label,
    ...(item.rules ? { rules: item.rules } : {}),
  };
}

function findPlacedItemInProject(project: Project, itemInstanceId: ID) {
  for (const node of project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      const found = (layer.placedItems ?? []).find((placedItem) => placedItem.itemInstanceId === itemInstanceId);

      if (found) return found;
    }
  }

  return null;
}

function findInventoryItemInProject(project: Project, itemInstanceId: ID): InventoryEntry | null {
  for (const player of project.players ?? []) {
    const found = (player.initialInventory ?? []).find((item) => item.itemInstanceId === itemInstanceId);

    if (found) return itemInstanceToInventoryEntry(found);
  }

  for (const npc of project.npcs ?? []) {
    const found = (npc.initialInventory ?? []).find((item) => item.itemInstanceId === itemInstanceId);

    if (found) return itemInstanceToInventoryEntry(found);
  }

  return null;
}

function findGameItemEntryInProject(project: Project, itemInstanceId: ID): InventoryEntry | null {
  const placedItem = findPlacedItemInProject(project, itemInstanceId);

  if (placedItem) return itemInstanceToInventoryEntry(placedItem);

  return findInventoryItemInProject(project, itemInstanceId);
}

function findHotspotInProject(project: Project, hotspotId: ID): Hotspot | null {
  for (const node of project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      const found = (layer.hotspots ?? []).find((hotspot) => hotspot.id === hotspotId);
      if (found) return found;
    }
  }

  return null;
}

function findHotspotVarDef(project: Project, hotspotId: ID, varId: ID): VarDef | null {
  const hotspot = findHotspotInProject(project, hotspotId);
  return hotspot?.vars?.find((def) => def.id === varId) ?? null;
}

function findNpcInProject(project: Project, npcId: ID) {
  return project.npcs.find((npc) => npc.id === npcId) ?? null;
}

function findPlayerVarDef(project: Project, playerId: ID, varId: ID): VarDef | null {
  const player = project.players.find((candidate) => candidate.id === playerId);
  return player?.vars?.find((def) => def.id === varId) ?? null;
}

function findNpcVarDef(project: Project, npcId: ID, varId: ID): VarDef | null {
  const npc = project.npcs.find((candidate) => candidate.id === npcId);
  return npc?.vars?.find((def) => def.id === varId) ?? null;
}

/* Variables runtime */
function clampNumber(def: VarDef | null, value: number): number {
  if (!def || def.type !== "number") return value;

  return Math.min(def.max, Math.max(def.min, value));
}

function coerceToNumber(value: RuntimeVarValue | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;

  return 0;
}

function coerceToBoolean(value: RuntimeVarValue | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  return false;
}

function setRuntimeVar(varsByOwner: Record<ID, RuntimeVarMap>, ownerId: ID, varId: ID, value: RuntimeVarValue): Record<ID, RuntimeVarMap> {
  const previousVars = varsByOwner[ownerId] ?? {};

  return { ...varsByOwner, [ownerId]: { ...previousVars, [varId]: value } };
}

function updateRuntimeVar(varsByOwner: Record<ID, RuntimeVarMap>, ownerId: ID, varId: ID, updater: (previous: RuntimeVarValue | undefined) => RuntimeVarValue)
  : Record<ID, RuntimeVarMap> {
  const previousVars = varsByOwner[ownerId] ?? {};

  return { ...varsByOwner, [ownerId]: { ...previousVars, [varId]: updater(previousVars[varId]) } };
}

/* Asegura que las variables propias de un hotspot existen en runtime */
export function ensureHotspotVars(state: GameState, hotspot: Hotspot): GameState {
  if (state.hotspotVars[hotspot.id]) return state;

  const initialVars: RuntimeVarMap = {};

  for (const variable of hotspot.vars ?? []) initialVars[variable.id] = variable.initial;

  return { ...state, hotspotVars: { ...state.hotspotVars, [hotspot.id]: initialVars } };
}

/* Estado visual de entidades */
function findNodeIdContainingPlacedItem(state: GameState, placedItemId: ID): ID | null {
  for (const node of state.project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      const exists = (layer.placedItems ?? []).some((placedItem) => placedItem.itemInstanceId === placedItemId);

      if (exists) return node.id;
    }
  }

  return null;
}

function updatePlacedItemState(state: GameState, placedItemId: ID, patch: Partial<{ visible: boolean; reachable: boolean }>): GameState {
  const nodeId = findNodeIdContainingPlacedItem(state, placedItemId);

  if (!nodeId) return state;

  const preparedState = ensureNodeRuntime(state, nodeId);
  const nodeRuntime = preparedState.nodes[nodeId];
  const previous = nodeRuntime?.placedItems[placedItemId];

  if (!nodeRuntime || !previous) return preparedState;

  return {
    ...preparedState,
    nodes: {
      ...preparedState.nodes,
      [nodeId]: {
        ...nodeRuntime,
        placedItems: {
          ...nodeRuntime.placedItems,
          [placedItemId]: {
            ...previous,
            ...patch,
          },
        },
      },
    },
  };
}

function updateHotspotState(state: GameState, nodeId: ID, hotspotId: ID, patch: Partial<{ visible: boolean; reachable: boolean }>): GameState {
  const preparedState = ensureNodeRuntime(state, nodeId);
  const nodeRuntime = preparedState.nodes[nodeId];
  const previous = nodeRuntime?.hotspots[hotspotId];

  if (!nodeRuntime || !previous) return preparedState;

  return {
    ...preparedState,
    nodes: {
      ...preparedState.nodes,
      [nodeId]: {
        ...nodeRuntime,
        hotspots: {
          ...nodeRuntime.hotspots,
          [hotspotId]: {
            ...previous,
            ...patch,
          },
        },
      },
    },
  };
}

function updatePlacedNpcState(state: GameState, nodeId: ID, npcId: ID, patch: Partial<{ visible: boolean; reachable: boolean }>): GameState {
  const preparedState = ensureNodeRuntime(state, nodeId);
  const nodeRuntime = preparedState.nodes[nodeId];
  const previous = nodeRuntime?.placedNpcs[npcId];

  if (!nodeRuntime || !previous) return preparedState;

  return {
    ...preparedState,
    nodes: {
      ...preparedState.nodes,
      [nodeId]: {
        ...nodeRuntime,
        placedNpcs: {
          ...nodeRuntime.placedNpcs,
          [npcId]: {
            ...previous,
            ...patch,
          },
        },
      },
    },
  };
}

function updatePlacedPlayerState(state: GameState, nodeId: ID, playerId: ID, patch: Partial<{ visible: boolean }>): GameState {
  const preparedState = ensureNodeRuntime(state, nodeId);
  const nodeRuntime = preparedState.nodes[nodeId];
  const previous = nodeRuntime?.placedPlayers[playerId];

  if (!nodeRuntime || !previous) return preparedState;

  return {
    ...preparedState,
    nodes: {
      ...preparedState.nodes,
      [nodeId]: {
        ...nodeRuntime,
        placedPlayers: {
          ...nodeRuntime.placedPlayers,
          [playerId]: {
            ...previous,
            ...patch,
          },
        },
      },
    },
  };
}

function setPlacedPlayerImage(state: GameState, nodeId: ID, playerId: ID, imageId: ID): GameState {
  const preparedState = ensureNodeRuntime(state, nodeId);
  const nodeRuntime = preparedState.nodes[nodeId];

  if (!nodeRuntime?.placedPlayers[playerId]) return preparedState;

  const previousImages = nodeRuntime.placedPlayerImageId;

  return {
    ...preparedState,
    nodes: {
      ...preparedState.nodes,
      [nodeId]: {
        ...nodeRuntime,
        placedPlayerImageId: {
          ...previousImages,
          [playerId]: imageId,
        },
      },
    },
  };
}

/* Mapa */
function setRegionMembership(list: ID[] | undefined, regionId: ID, value: boolean): ID[] {
  const current = list ?? [];
  const hasRegion = current.includes(regionId);

  if (value) return hasRegion ? current : [...current, regionId];

  return hasRegion ? current.filter((id) => id !== regionId) : current;
}

function setMapRegionAvailable(state: GameState, mapId: ID, regionId: ID, value: boolean): GameState {
  const current = state.map.unlockedRegionIdsByMap[mapId] ?? [];
  const next = setRegionMembership(current, regionId, value);

  return {
    ...state,
    map: {
      ...state.map,
      unlockedRegionIdsByMap: {
        ...state.map.unlockedRegionIdsByMap,
        [mapId]: next,
      },
    },
  };
}

/* Aplicación de efectos */
export function applyEffect(state: GameState, effect: Effect, ctx: ApplyEffectCtx = {}): GameState {
  switch (effect.type) {
    case "goToNode": {
      const targetNodeId = effect.targetNodeId;

      const exists = state.project.nodes.some((node) => node.id === targetNodeId);
      if (!exists) throw new Error(`goToNode apunta a un nodo inexistente: "${targetNodeId}".`);

      return ensureNodeRuntime({
        ...state,
        currentNodeId: targetNodeId,
        activeDialogue: undefined,
        visitedNodes: { ...state.visitedNodes, [targetNodeId]: true },
      }, targetNodeId);
    }

    case "addItem": {
      const entry = findGameItemEntryInProject(state.project, effect.itemInstanceId);
      if (!entry) throw new Error(`addItem apunta a un itemInstanceId inexistente: "${effect.itemInstanceId}".`);

      const playerId = resolveRequiredInventoryPlayerId(state, ctx.inventoryPlayerId);

      ctx.audio?.playSfxUrl(publicPath("sounds/add_item.wav"));

      return addPlayerInventoryEntry(state, playerId, entry);
    }

    case "removeItem": {
      const found = findInventoryEntryInAnyPlayer(state, effect.itemInstanceId);

      if (!found) return state;

      return removePlayerInventoryEntry(state, found.playerId, effect.itemInstanceId);
    }

    case "transformItem": {
      const found = findInventoryEntryInAnyPlayer(state, effect.itemInstanceId);
      if (!found) return state;

      const resultEntry: InventoryEntry = {
        itemInstanceId: effect.resultItemInstanceId,
        itemId: effect.resultItemId,
        label: effect.resultItemLabel,
        ...(effect.resultItemRules ? { rules: effect.resultItemRules } : {}),
      };

      const withoutSource = removeFromInventory(getPlayerInventory(state, found.playerId), effect.itemInstanceId);

      const nextState = setPlayerInventory(state, found.playerId, addInventoryEntry(withoutSource, resultEntry));

      ctx.audio?.playSfxUrl(publicPath("sounds/add_item.wav"));

      return nextState;
    }

    case "combineItems": {
      if (effect.itemAInstanceId === effect.itemBInstanceId) return state;

      if (!isMatchingItemUsePair(effect, ctx.itemUsePair)) return state;

      const foundA = findInventoryEntryInAnyPlayer(state, effect.itemAInstanceId);
      const foundB = findInventoryEntryInAnyPlayer(state, effect.itemBInstanceId);

      if (!foundA || !foundB) return state;
      if (foundA.playerId !== foundB.playerId) return state;

      const playerId = foundA.playerId;
      const inventory = getPlayerInventory(state, playerId);

      const withoutA = removeFromInventory(inventory, effect.itemAInstanceId);
      const withoutBoth = removeFromInventory(withoutA, effect.itemBInstanceId);

      const resultEntry: InventoryEntry = {
        itemInstanceId: effect.resultItemInstanceId,
        itemId: effect.resultItemId,
        label: effect.resultItemLabel,
        ...(effect.resultItemRules ? { rules: effect.resultItemRules } : {}),
      };

      ctx.audio?.playSfxUrl(publicPath("sounds/add_item.wav"));

      return setPlayerInventory(state, playerId, addInventoryEntry(withoutBoth, resultEntry));
    }

    case "startDialogue": {
      const dialogue = findDialogueInCurrentNode(state, effect.nodeDialogueId);
      if (!dialogue) throw new Error(`startDialogue apunta a un diálogo inexistente en el nodo actual: "${effect.nodeDialogueId}".`);

      return {
        ...state,
        activeDialogue: {
          nodeId: state.currentNodeId,
          dialogueId: effect.nodeDialogueId,
          currentNodeId: dialogue.rootId,
          phase: "speaking",
        },
      };
    }

    case "endDialogue":
      return state.activeDialogue ? { ...state, activeDialogue: undefined } : state;

    case "giveItemToNpc": {
      const npc = findNpcInProject(state.project, effect.npcId);
      if (!npc) throw new Error(`giveItemToNpc apunta a un npc inexistente: "${effect.npcId}".`);

      const found = findInventoryEntryInAnyPlayer(state, effect.itemInstanceId);
      if (!found) return state;

      const currentNpcInventory = state.npcInventory[effect.npcId] ?? [];
      const alreadyHasItem = currentNpcInventory.some((entry) => entry.itemInstanceId === effect.itemInstanceId);

      return {
        ...removePlayerInventoryEntry(state, found.playerId, effect.itemInstanceId),
        npcInventory: {
          ...state.npcInventory,
          [effect.npcId]: alreadyHasItem ? currentNpcInventory : [...currentNpcInventory, found.entry],
        },
      };
    }

    case "receiveItemFromNpc": {
      const npc = findNpcInProject(state.project, effect.npcId);
      if (!npc) throw new Error(`receiveItemFromNpc apunta a un npc inexistente: "${effect.npcId}".`);

      const playerId = resolveRequiredInventoryPlayerId(state, ctx.inventoryPlayerId);

      const currentNpcInventory = state.npcInventory[effect.npcId] ?? [];

      const inventoryEntry = currentNpcInventory.find((entry) => entry.itemInstanceId === effect.itemInstanceId);
      if (!inventoryEntry) return state;

      const nextState = {
        ...addPlayerInventoryEntry(state, playerId, inventoryEntry),
        npcInventory: {
          ...state.npcInventory,
          [effect.npcId]: currentNpcInventory.filter((entry) => entry.itemInstanceId !== effect.itemInstanceId),
        },
      };

      ctx.audio?.playSfxUrl(publicPath("sounds/add_item.wav"));

      return nextState;
    }

    case "showMessage": {
      const text = effect.text?.trim();
      if (!text) return state;

      const speaker = effect.speaker ?? { kind: "narrator" };

      ctx.emitMessage?.(text, {
        kind: speaker.kind,
        speakerId: speaker.kind === "player" ? speaker.playerId : speaker.kind === "npc" ? speaker.npcId : undefined,
      });

      return state;
    }

    case "setPlacedItemVisible":
      return updatePlacedItemState(state, effect.itemInstanceId, { visible: effect.value });

    case "setPlacedItemReachable":
      return updatePlacedItemState(state, effect.itemInstanceId, { reachable: effect.value });

    case "setHotspotVisible":
      return updateHotspotState(state, state.currentNodeId, effect.hotspotId, { visible: effect.value });

    case "setHotspotReachable":
      return updateHotspotState(state, state.currentNodeId, effect.hotspotId, { reachable: effect.value });

    case "setHotspotVar": {
      const def = findHotspotVarDef(state.project, effect.hotspotId, effect.varId);
      const nextValue = typeof effect.value === "number" ? clampNumber(def, effect.value) : effect.value;

      return { ...state, hotspotVars: setRuntimeVar(state.hotspotVars, effect.hotspotId, effect.varId, nextValue) };
    }

    case "toggleHotspotVar":
      return {
        ...state,
        hotspotVars: updateRuntimeVar(state.hotspotVars, effect.hotspotId, effect.varId, (previous) => {
          return !coerceToBoolean(previous);
        }),
      };

    case "incHotspotVar": {
      const def = findHotspotVarDef(state.project, effect.hotspotId, effect.varId);

      return {
        ...state,
        hotspotVars: updateRuntimeVar(state.hotspotVars, effect.hotspotId, effect.varId, (previous) => {
          return clampNumber(def, coerceToNumber(previous) + (effect.amount ?? 1));
        }),
      };
    }

    case "decHotspotVar": {
      const def = findHotspotVarDef(state.project, effect.hotspotId, effect.varId);

      return {
        ...state,
        hotspotVars: updateRuntimeVar(state.hotspotVars, effect.hotspotId, effect.varId, (previous) => {
          return clampNumber(def, coerceToNumber(previous) - (effect.amount ?? 1));
        }),
      };
    }

    case "setPlacedPlayerVisible":
      return updatePlacedPlayerState(state, effect.nodeId, effect.playerId, { visible: effect.value });

    case "setPlacedPlayerImage":
      return setPlacedPlayerImage(state, effect.nodeId, effect.playerId, effect.imageId);

    case "setPlacedNpcVisible":
      return updatePlacedNpcState(state, effect.nodeId, effect.npcId, { visible: effect.value });

    case "setPlacedNpcReachable":
      return updatePlacedNpcState(state, effect.nodeId, effect.npcId, { reachable: effect.value });

    case "setPlayerVar": {
      const def = findPlayerVarDef(state.project, effect.playerId, effect.varId);
      const nextValue = typeof effect.value === "number" ? clampNumber(def, effect.value) : effect.value;

      return { ...state, playerVars: setRuntimeVar(state.playerVars, effect.playerId, effect.varId, nextValue) };
    }

    case "togglePlayerVar":
      return {
        ...state,
        playerVars: updateRuntimeVar(state.playerVars, effect.playerId, effect.varId, (previous) => {
          return !coerceToBoolean(previous);
        }),
      };

    case "incPlayerVar": {
      const def = findPlayerVarDef(state.project, effect.playerId, effect.varId);

      return {
        ...state,
        playerVars: updateRuntimeVar(state.playerVars, effect.playerId, effect.varId, (previous) => {
          return clampNumber(def, coerceToNumber(previous) + (effect.amount ?? 1));
        }),
      };
    }

    case "decPlayerVar": {
      const def = findPlayerVarDef(state.project, effect.playerId, effect.varId);

      return {
        ...state,
        playerVars: updateRuntimeVar(state.playerVars, effect.playerId, effect.varId, (previous) => {
          return clampNumber(def, coerceToNumber(previous) - (effect.amount ?? 1));
        }),
      };
    }

    case "setNpcVar": {
      const def = findNpcVarDef(state.project, effect.npcId, effect.varId);
      const nextValue = typeof effect.value === "number" ? clampNumber(def, effect.value) : effect.value;

      return { ...state, npcVars: setRuntimeVar(state.npcVars, effect.npcId, effect.varId, nextValue) };
    }

    case "toggleNpcVar":
      return {
        ...state,
        npcVars: updateRuntimeVar(state.npcVars, effect.npcId, effect.varId, (previous) => {
          return !coerceToBoolean(previous);
        }),
      };

    case "incNpcVar": {
      const def = findNpcVarDef(state.project, effect.npcId, effect.varId);

      return {
        ...state,
        npcVars: updateRuntimeVar(state.npcVars, effect.npcId, effect.varId, (previous) => {
          return clampNumber(def, coerceToNumber(previous) + (effect.amount ?? 1));
        }),
      };
    }

    case "decNpcVar": {
      const def = findNpcVarDef(state.project, effect.npcId, effect.varId);

      return {
        ...state,
        npcVars: updateRuntimeVar(state.npcVars, effect.npcId, effect.varId, (previous) => {
          return clampNumber(def, coerceToNumber(previous) - (effect.amount ?? 1));
        }),
      };
    }

    case "playSfx":
      ctx.audio?.playSfx(state, effect.sfxId);
      return state;

    case "playMusic":
      return { ...state, music: musicPlay(state.music, effect.trackId, { startAt: effect.startAt }) };

    case "stopMusic":
      return { ...state, music: musicStop(state.music, { trackId: effect.trackId }) };

    case "setMapRegionAvailable":
      return setMapRegionAvailable(state, effect.mapId, effect.regionId, effect.value);

    case "endGame": {
      const ending = effect.ending;
      const lines = ending?.lines ?? [];
      const endingMusicTrackId = ending?.musicTrackId?.trim();

      return {
        ...state,
        gameEnded: true,
        activeDialogue: undefined,
        ending,
        endingLineIndex: lines.length > 0 ? 0 : lines.length,
        music: endingMusicTrackId
          ? musicPlay(state.music, endingMusicTrackId, { startAt: "restart" })
          : musicStop(state.music),
      };
    }
  }
}

export function applyEffects(state: GameState, effects: Effect[] = [], ctx: ApplyEffectCtx = {}): GameState {
  return effects.reduce((currentState, effect) => { return applyEffect(currentState, effect, ctx) }, state);
}