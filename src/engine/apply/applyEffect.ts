import type { Hotspot, ID, VarDef } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import type { GameState, InventoryEntry } from "@/engine/state/runtimeState";
import { ensureNodeRuntime } from "@/engine/state/runtimeState";
import { musicPause, musicPlay, musicStop } from "@/engine/state/slices/musicSlice";
import type { AudioAdapter } from "@/engine/adapters/audioAdapter";

export type ApplyEffectCtx = {
  audio?: AudioAdapter;
  emitMessage?: (text: string) => void;
};

/* Helpers */
function addInventoryEntry(inventory: InventoryEntry[], entry: InventoryEntry): InventoryEntry[] {
  const alreadyExists = inventory.some((item) => item.instanceId === entry.instanceId);
  if (alreadyExists) return inventory;
  return [...inventory, entry];
}

function removeFromInventory(inventory: InventoryEntry[], instanceId: ID): InventoryEntry[] {
  const idx = inventory.findIndex((entry) => entry.instanceId === instanceId);
  if (idx < 0) return inventory;

  return [...inventory.slice(0, idx), ...inventory.slice(idx + 1)];
}

export function addInventoryInstance(state: GameState, instanceId: ID, itemId: ID): GameState {
  return { ...state, inventory: addInventoryEntry(state.inventory, { instanceId, itemId }) };
}

function findDialogueInCurrentNode(state: GameState, dialogueId: ID) {
  const node = state.project.nodes.find((n) => n.id === state.currentNodeId);
  if (!node) return null;

  return (node.dialogues ?? []).find((d) => d.id === dialogueId) ?? null;
}

function findPlacedItemInProject(project: GameState["project"], placedItemId: ID) {
  for (const node of project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      const found = (layer.placedItems ?? []).find((p) => p.id === placedItemId);
      if (found) return found;
    }
  }
  return null;
}

function findNpcInProject(project: GameState["project"], npcId: ID) {
  return project.npcs.find((n) => n.id === npcId) ?? null;
}

function findPlayerVarDef(project: GameState["project"], playerId: ID, varId: ID): VarDef | null {
  const p = project.players.find((x) => x.id === playerId);
  return p?.vars?.find((d) => d.id === varId) ?? null;
}

function findNpcVarDef(project: GameState["project"], npcId: ID, varId: ID): VarDef | null {
  const n = project.npcs.find((x) => x.id === npcId);
  return n?.vars?.find((d) => d.id === varId) ?? null;
}

function clampNumber(def: VarDef | null, value: number): number {
  if (!def || def.type !== "number") return value;
  return Math.min(def.max, Math.max(def.min, value));
}

function coerceToNumber(prev: boolean | number | undefined): number {
  if (typeof prev === "number") return prev;
  if (typeof prev === "boolean") return prev ? 1 : 0;
  return 0;
}

function coerceToBoolean(prev: boolean | number | undefined): boolean {
  if (typeof prev === "boolean") return prev;
  if (typeof prev === "number") return prev !== 0;
  return false;
}

function setRegionMembership(list: ID[] | undefined, regionId: ID, value: boolean): ID[] {
  const current = list ?? [];
  const hasRegion = current.includes(regionId);

  if (value) return hasRegion ? current : [...current, regionId];
  return hasRegion ? current.filter((id) => id !== regionId) : current;
}

/* Hotspot vars: asegurar inicialización (runtime) */
export function ensureHotspotVars(state: GameState, hotspot: Hotspot): GameState {
  if (state.hotspotVars[hotspot.id]) return state;

  const initial: Record<ID, boolean | number> = {};
  for (const v of hotspot.vars ?? []) initial[v.id] = v.initial;

  return {
    ...state,
    hotspotVars: {
      ...state.hotspotVars,
      [hotspot.id]: initial,
    },
  };
}

export function applyEffect(state: GameState, eff: Effect, ctx: ApplyEffectCtx = {}): GameState {
  switch (eff.type) {
    case "goToNode": {
      const legacyEff = eff as { type: "goToNode"; targetNodeId?: ID; nodeId?: ID; goToNodeId?: ID };
      const targetId = legacyEff.targetNodeId ?? legacyEff.nodeId ?? legacyEff.goToNodeId;

      if (!targetId) throw new Error("goToNode sin id de destino.");

      const exists = state.project.nodes.some((n) => n.id === targetId);
      if (!exists) throw new Error(`goToNode apunta a un nodo inexistente: "${targetId}".`);

      let s: GameState = {
        ...state,
        currentNodeId: targetId,
        visitedNodes: {
          ...state.visitedNodes,
          [targetId]: true,
        },
      };

      s = ensureNodeRuntime(s, targetId);
      return s;
    }

    case "addItem": {
      const placedItem = findPlacedItemInProject(state.project, eff.placedItemId);
      if (!placedItem) {
        throw new Error(`addItem apunta a un placedItem inexistente: "${eff.placedItemId}".`);
      }

      const s = addInventoryInstance(state, placedItem.id, placedItem.itemId);
      ctx.audio?.playSfxUrl("/sounds/add_item.wav");
      return s;
    }

    case "removeItem":
      return { ...state, inventory: removeFromInventory(state.inventory, eff.placedItemId) };

    case "startDialogue": {
      const dialogue = findDialogueInCurrentNode(state, eff.nodeDialogueId);
      if (!dialogue) {
        throw new Error(`startDialogue apunta a un diálogo inexistente en el nodo actual: "${eff.nodeDialogueId}".`);
      }

      return {
        ...state,
        activeDialogue: {
          nodeId: state.currentNodeId,
          dialogueId: eff.nodeDialogueId,
          currentNodeId: dialogue.rootId,
          phase: "speaking",
        },
      };
    }

    case "endDialogue":
      return state.activeDialogue
        ? { ...state, activeDialogue: undefined }
        : state;

    case "giveItemToNpc": {
      const npc = findNpcInProject(state.project, eff.npcId);
      if (!npc) {
        throw new Error(`giveItemToNpc apunta a un npc inexistente: "${eff.npcId}".`);
      }

      const hasItem = state.inventory.some((entry) => entry.instanceId === eff.placedItemId);
      if (!hasItem) return state;

      return {
        ...state,
        inventory: removeFromInventory(state.inventory, eff.placedItemId),
      };
    }

    case "receiveItemFromNpc": {
      const npc = findNpcInProject(state.project, eff.npcId);
      if (!npc) {
        throw new Error(`receiveItemFromNpc apunta a un npc inexistente: "${eff.npcId}".`);
      }

      const placedItem = findPlacedItemInProject(state.project, eff.placedItemId);
      if (!placedItem) {
        throw new Error(`receiveItemFromNpc apunta a un placedItem inexistente: "${eff.placedItemId}".`);
      }

      const s = addInventoryInstance(state, placedItem.id, placedItem.itemId);
      ctx.audio?.playSfxUrl("/sounds/add_item.wav");
      return s;
    }

    case "showMessage": {
      const text = (eff.text ?? "").trim();
      if (text) ctx.emitMessage?.(text);
      return state;
    }

    case "setPlacedItemVisible": {
      const s = ensureNodeRuntime(state, eff.nodeId);
      const nodeRt = s.nodes[eff.nodeId]!;
      const prev = nodeRt.placedItems[eff.placedItemId];
      if (!prev) return s;

      return {
        ...s,
        nodes: {
          ...s.nodes,
          [eff.nodeId]: {
            ...nodeRt,
            placedItems: {
              ...nodeRt.placedItems,
              [eff.placedItemId]: { ...prev, visible: eff.value },
            },
          },
        },
      };
    }

    case "setPlacedItemReachable": {
      const s = ensureNodeRuntime(state, eff.nodeId);
      const nodeRt = s.nodes[eff.nodeId]!;
      const prev = nodeRt.placedItems[eff.placedItemId];
      if (!prev) return s;

      return {
        ...s,
        nodes: {
          ...s.nodes,
          [eff.nodeId]: {
            ...nodeRt,
            placedItems: {
              ...nodeRt.placedItems,
              [eff.placedItemId]: { ...prev, reachable: eff.value },
            },
          },
        },
      };
    }

    case "setHotspotVisible": {
      const nodeId = state.currentNodeId;
      const s = ensureNodeRuntime(state, nodeId);
      const nodeRt = s.nodes[nodeId]!;
      const prev = nodeRt.hotspots[eff.hotspotId];
      if (!prev) return s;

      return {
        ...s,
        nodes: {
          ...s.nodes,
          [nodeId]: {
            ...nodeRt,
            hotspots: {
              ...nodeRt.hotspots,
              [eff.hotspotId]: { ...prev, visible: eff.value },
            },
          },
        },
      };
    }

    case "setHotspotReachable": {
      const nodeId = state.currentNodeId;
      const s = ensureNodeRuntime(state, nodeId);
      const nodeRt = s.nodes[nodeId]!;
      const prev = nodeRt.hotspots[eff.hotspotId];
      if (!prev) return s;

      return {
        ...s,
        nodes: {
          ...s.nodes,
          [nodeId]: {
            ...nodeRt,
            hotspots: {
              ...nodeRt.hotspots,
              [eff.hotspotId]: { ...prev, reachable: eff.value },
            },
          },
        },
      };
    }

    case "setHotspotVar": {
      const prev = state.hotspotVars[eff.hotspotId] ?? {};
      return {
        ...state,
        hotspotVars: {
          ...state.hotspotVars,
          [eff.hotspotId]: { ...prev, [eff.varId]: eff.value },
        },
      };
    }

    case "toggleHotspotVar": {
      const prev = state.hotspotVars[eff.hotspotId] ?? {};
      const next = !coerceToBoolean(prev[eff.varId]);

      return {
        ...state,
        hotspotVars: {
          ...state.hotspotVars,
          [eff.hotspotId]: { ...prev, [eff.varId]: next },
        },
      };
    }

    case "incHotspotVar": {
      const prev = state.hotspotVars[eff.hotspotId] ?? {};
      const base = coerceToNumber(prev[eff.varId]);
      const amount = eff.amount ?? 1;

      return {
        ...state,
        hotspotVars: {
          ...state.hotspotVars,
          [eff.hotspotId]: { ...prev, [eff.varId]: base + amount },
        },
      };
    }

    case "decHotspotVar": {
      const prev = state.hotspotVars[eff.hotspotId] ?? {};
      const base = coerceToNumber(prev[eff.varId]);
      const amount = eff.amount ?? 1;

      return {
        ...state,
        hotspotVars: {
          ...state.hotspotVars,
          [eff.hotspotId]: { ...prev, [eff.varId]: base - amount },
        },
      };
    }

    case "setPlacedPlayerVisible": {
      const s = ensureNodeRuntime(state, eff.nodeId);
      const nodeRt = s.nodes[eff.nodeId]!;
      const prev = nodeRt.placedPlayers[eff.playerId];
      if (!prev) return s;

      return {
        ...s,
        nodes: {
          ...s.nodes,
          [eff.nodeId]: {
            ...nodeRt,
            placedPlayers: {
              ...nodeRt.placedPlayers,
              [eff.playerId]: { ...prev, visible: eff.value },
            },
          },
        },
      };
    }

    case "setPlacedPlayerImage": {
      const s = ensureNodeRuntime(state, eff.nodeId);
      const nodeRt = s.nodes[eff.nodeId]!;
      if (!nodeRt.placedPlayers[eff.playerId]) return s;

      const prevImgs = nodeRt.placedPlayerImageId ?? {};
      return {
        ...s,
        nodes: {
          ...s.nodes,
          [eff.nodeId]: {
            ...nodeRt,
            placedPlayerImageId: { ...prevImgs, [eff.playerId]: eff.imageId },
          },
        },
      };
    }

    case "setPlacedNpcVisible": {
      const s = ensureNodeRuntime(state, eff.nodeId);
      const nodeRt = s.nodes[eff.nodeId]!;
      const prev = nodeRt.placedNpcs[eff.npcId];
      if (!prev) return s;

      return {
        ...s,
        nodes: {
          ...s.nodes,
          [eff.nodeId]: {
            ...nodeRt,
            placedNpcs: {
              ...nodeRt.placedNpcs,
              [eff.npcId]: { ...prev, visible: eff.value },
            },
          },
        },
      };
    }

    case "setPlacedNpcReachable": {
      const s = ensureNodeRuntime(state, eff.nodeId);
      const nodeRt = s.nodes[eff.nodeId]!;
      const prev = nodeRt.placedNpcs[eff.npcId];
      if (!prev) return s;

      return {
        ...s,
        nodes: {
          ...s.nodes,
          [eff.nodeId]: {
            ...nodeRt,
            placedNpcs: {
              ...nodeRt.placedNpcs,
              [eff.npcId]: { ...prev, reachable: eff.value },
            },
          },
        },
      };
    }

    case "setPlayerVar": {
      const prev = state.playerVars[eff.playerId] ?? {};
      const def = findPlayerVarDef(state.project, eff.playerId, eff.varId);

      let nextVal: boolean | number = eff.value;
      if (typeof eff.value === "number") nextVal = clampNumber(def, eff.value);

      return {
        ...state,
        playerVars: {
          ...state.playerVars,
          [eff.playerId]: { ...prev, [eff.varId]: nextVal },
        },
      };
    }

    case "togglePlayerVar": {
      const prev = state.playerVars[eff.playerId] ?? {};
      const next = !coerceToBoolean(prev[eff.varId]);

      return {
        ...state,
        playerVars: {
          ...state.playerVars,
          [eff.playerId]: { ...prev, [eff.varId]: next },
        },
      };
    }

    case "incPlayerVar": {
      const prev = state.playerVars[eff.playerId] ?? {};
      const def = findPlayerVarDef(state.project, eff.playerId, eff.varId);
      const base = coerceToNumber(prev[eff.varId]);
      const amount = eff.amount ?? 1;
      const next = clampNumber(def, base + amount);

      return {
        ...state,
        playerVars: {
          ...state.playerVars,
          [eff.playerId]: { ...prev, [eff.varId]: next },
        },
      };
    }

    case "decPlayerVar": {
      const prev = state.playerVars[eff.playerId] ?? {};
      const def = findPlayerVarDef(state.project, eff.playerId, eff.varId);
      const base = coerceToNumber(prev[eff.varId]);
      const amount = eff.amount ?? 1;
      const next = clampNumber(def, base - amount);

      return {
        ...state,
        playerVars: {
          ...state.playerVars,
          [eff.playerId]: { ...prev, [eff.varId]: next },
        },
      };
    }

    case "setNpcVar": {
      const prev = state.npcVars[eff.npcId] ?? {};
      const def = findNpcVarDef(state.project, eff.npcId, eff.varId);

      let nextVal: boolean | number = eff.value;
      if (typeof eff.value === "number") nextVal = clampNumber(def, eff.value);

      return {
        ...state,
        npcVars: {
          ...state.npcVars,
          [eff.npcId]: { ...prev, [eff.varId]: nextVal },
        },
      };
    }

    case "toggleNpcVar": {
      const prev = state.npcVars[eff.npcId] ?? {};
      const next = !coerceToBoolean(prev[eff.varId]);

      return {
        ...state,
        npcVars: {
          ...state.npcVars,
          [eff.npcId]: { ...prev, [eff.varId]: next },
        },
      };
    }

    case "incNpcVar": {
      const prev = state.npcVars[eff.npcId] ?? {};
      const def = findNpcVarDef(state.project, eff.npcId, eff.varId);
      const base = coerceToNumber(prev[eff.varId]);
      const amount = eff.amount ?? 1;
      const next = clampNumber(def, base + amount);

      return {
        ...state,
        npcVars: {
          ...state.npcVars,
          [eff.npcId]: { ...prev, [eff.varId]: next },
        },
      };
    }

    case "decNpcVar": {
      const prev = state.npcVars[eff.npcId] ?? {};
      const def = findNpcVarDef(state.project, eff.npcId, eff.varId);
      const base = coerceToNumber(prev[eff.varId]);
      const amount = eff.amount ?? 1;
      const next = clampNumber(def, base - amount);

      return {
        ...state,
        npcVars: {
          ...state.npcVars,
          [eff.npcId]: { ...prev, [eff.varId]: next },
        },
      };
    }

    case "playSfx":
      ctx.audio?.playSfx(state, eff.sfxId);
      return state;

    case "playMusic":
      return { ...state, music: musicPlay(state.music, eff.trackId, { startAt: eff.startAt }) };

    case "pauseMusic":
      return { ...state, music: musicPause(state.music) };

    case "stopMusic":
      return { ...state, music: musicStop(state.music) };

    case "setMapRegionAvailable": {
      const current = state.map.unlockedRegionIdsByMap[eff.mapId] ?? [];
      const next = setRegionMembership(current, eff.regionId, eff.value);

      return {
        ...state,
        map: {
          ...state.map,
          unlockedRegionIdsByMap: {
            ...state.map.unlockedRegionIdsByMap,
            [eff.mapId]: next,
          },
        },
      };
    }

    case "endGame": {
      const message = eff.message?.trim();

      return {
        ...state,
        gameEnded: true,
        endGameMessage: message || undefined,
      };
    }

    default:
      throw new Error(`Efecto no soportado en el motor: ${(eff as { type?: string }).type ?? "desconocido"}`);
  }
}

export function applyEffects(state: GameState, effects: Effect[] = [], ctx: ApplyEffectCtx = {}): GameState {
  let s = state;
  for (const eff of effects) s = applyEffect(s, eff, ctx);
  return s;
}