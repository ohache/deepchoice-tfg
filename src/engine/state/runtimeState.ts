import type { Project, ID, PlaceableState, PlacedPlayerState, EndGameContent } from "@/domain/types";
import { createInitialMusicRuntime, type MusicRuntimeState } from "@/engine/state/slices/musicSlice";

export type DialoguePhase = "speaking" | "choosing";

/* Estado runtime del mapa durante la partida */
export interface WorldMapRuntime {
  isOpen: boolean;
  activeMapId?: ID;
  selectedRegionId?: ID;
  visibleRegionIdsByMap: Record<ID, ID[]>;
  unlockedRegionIdsByMap: Record<ID, ID[]>;
  currentRegionIdByMap: Record<ID, ID | undefined>;
}

/* Entrada concreta del inventario */
export interface InventoryEntry {
  itemInstanceId: ID;
  itemId: ID;
  label?: string;
}

/* Diálogo actualmente activo en el player */
export interface ActiveDialogueState {
  nodeId: ID;
  dialogueId: ID;
  currentNodeId: ID;
  phase: DialoguePhase;
}

/* Estado runtime persistente de una escena concreta */
export interface NodeRuntimeState {
  hotspots: Record<ID, PlaceableState>;
  placedItems: Record<ID, PlaceableState>;
  placedNpcs: Record<ID, PlaceableState>;
  placedPlayers: Record<ID, PlacedPlayerState>;
  placedPlayerImageId?: Record<ID, ID | undefined>;
}

/* Estado global de una partida en ejecución */
export interface GameState {
  project: Project;
  nodes: Record<ID, NodeRuntimeState>;
  currentNodeId: ID;
  visitedNodes: Record<ID, boolean>;
  activeDialogue?: ActiveDialogueState;
  inventory: InventoryEntry[];
  hotspotVars: Record<ID, Record<ID, boolean | number>>;
  playerVars: Record<ID, Record<ID, boolean | number>>;
  npcInventory: Record<ID, InventoryEntry[]>;
  npcVars: Record<ID, Record<ID, boolean | number>>;
  map: WorldMapRuntime;
  music: MusicRuntimeState;
  gameEnded: boolean;
  ending?: EndGameContent;
  endingLineIndex?: number;
}

type RuntimeVarDef = {
  id: ID;
  type: "number" | "boolean";
  initial: number | boolean;
};

type RuntimeVars = Record<ID, boolean | number>;

function createInitialMapRuntime(): WorldMapRuntime {
  return {
    isOpen: false,
    activeMapId: undefined,
    selectedRegionId: undefined,
    visibleRegionIdsByMap: {},
    unlockedRegionIdsByMap: {},
    currentRegionIdByMap: {},
  };
}

function initInventoryFromDefs(items?: { itemInstanceId: ID; itemId: ID; label?: string }[]): InventoryEntry[] {
  return (items ?? []).map((item) => ({
    itemInstanceId: item.itemInstanceId,
    itemId: item.itemId,
    label: item.label,
  }));
}

function initVarsFromDefs(defs?: RuntimeVarDef[]): RuntimeVars {
  const vars: RuntimeVars = {};

  for (const def of defs ?? []) {
    vars[def.id] = def.initial;
  }

  return vars;
}

/* Selecciona la escena inicial de la partida */
function pickStartNodeId(project: Project): ID {
  if (project.nodes.length === 0) throw new Error("El proyecto no contiene escenas. No se puede iniciar una partida.");

  const startNodes = project.nodes.filter((node) => node.isStart === true);

  if (startNodes.length > 1) throw new Error("El proyecto tiene más de un nodo marcado como inicio.");

  return (startNodes[0] ?? project.nodes[0]).id;
}

/* Inicializa el runtime del mapa a partir de la localización de la escena inicial */
function createInitialMapRuntimeFromProject(project: Project, currentNodeId: ID): WorldMapRuntime {
  const startNode = project.nodes.find((node) => node.id === currentNodeId);
  const location = startNode?.mapLocation;

  if (!location) return createInitialMapRuntime();

  return {
    isOpen: false,
    activeMapId: location.mapId,
    selectedRegionId: location.regionId,
    visibleRegionIdsByMap: { [location.mapId]: [location.regionId] },
    unlockedRegionIdsByMap: { [location.mapId]: [location.regionId] },
    currentRegionIdByMap: { [location.mapId]: location.regionId },
  };
}

/* Crea el estado inicial de una partida */
export function createInitialGameState(project: Project): GameState {
  const currentNodeId = pickStartNodeId(project);

  const playerVars: GameState["playerVars"] = {};
  for (const player of project.players ?? []) {
    playerVars[player.id] = initVarsFromDefs(player.vars);
  }

  const initialPlayerInventory = (project.players ?? []).flatMap((player) => initInventoryFromDefs(player.initialInventory));

  const npcVars: GameState["npcVars"] = {};
  for (const npc of project.npcs ?? []) {
    npcVars[npc.id] = initVarsFromDefs(npc.vars);
  }

  const npcInventory: GameState["npcInventory"] = {};

  for (const npc of project.npcs ?? []) {
    npcInventory[npc.id] = initInventoryFromDefs(npc.initialInventory);
  }

  return {
    project,
    currentNodeId,
    activeDialogue: undefined,
    inventory: initialPlayerInventory,
    npcInventory,
    visitedNodes: { [currentNodeId]: true },
    hotspotVars: {},
    playerVars,
    npcVars,
    map: createInitialMapRuntimeFromProject(project, currentNodeId),
    music: createInitialMusicRuntime(),
    nodes: {},
    gameEnded: false,
    ending: undefined,
    endingLineIndex: undefined,
  };
}

/* Devuelve la escena actual */
export function getCurrentNode(state: GameState) {
  const node = state.project.nodes.find((projectNode) => projectNode.id === state.currentNodeId);

  if (!node) throw new Error(`No se encontró el nodo actual id=${state.currentNodeId}`);

  return node;
}

/* Materializa el runtime de una escena si todavía no existe */
export function ensureNodeRuntime(state: GameState, nodeId: ID): GameState {
  if (state.nodes[nodeId]) return state;

  const node = state.project.nodes.find((projectNode) => projectNode.id === nodeId);

  if (!node) throw new Error(`ensureNodeRuntime: nodeId inexistente "${nodeId}"`);

  const hotspots: Record<ID, PlaceableState> = {};
  const placedItems: Record<ID, PlaceableState> = {};
  const placedNpcs: Record<ID, PlaceableState> = {};
  const placedPlayers: Record<ID, PlacedPlayerState> = {};
  const placedPlayerImageId: Record<ID, ID | undefined> = {};
  const hotspotVarsForNode: GameState["hotspotVars"] = {};

  for (const layer of node.layers ?? []) {
    for (const hotspot of layer.hotspots ?? []) {
      hotspots[hotspot.id] = { ...hotspot.initialState };
      hotspotVarsForNode[hotspot.id] = initVarsFromDefs(hotspot.vars);
    }

    for (const placedItem of layer.placedItems ?? []) {
      placedItems[placedItem.id] = { ...placedItem.initialState };
    }

    for (const placedNpc of layer.placedNpcs ?? []) {
      placedNpcs[placedNpc.npcId] = { ...placedNpc.initialState };
    }

    for (const placedPlayer of layer.placedPlayers ?? []) {
      placedPlayers[placedPlayer.playerId] = { ...placedPlayer.initialState };
    }
  }

  const nodeRuntime: NodeRuntimeState = {
    hotspots,
    placedItems,
    placedNpcs,
    placedPlayers,
    placedPlayerImageId,
  };

  return {
    ...state,
    hotspotVars: {
      ...state.hotspotVars,
      ...hotspotVarsForNode,
    },
    nodes: {
      ...state.nodes,
      [nodeId]: nodeRuntime,
    },
  };
}