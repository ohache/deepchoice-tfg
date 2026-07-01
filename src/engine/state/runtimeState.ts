import type { ID, Project, PlaceableState, PlacedPlayerState, EndGameContent, InteractionRules } from "@/domain/types";
import { createInitialMusicRuntime, type MusicRuntimeState } from "@/engine/state/slices/musicSlice";

export type DialoguePhase = "speaking" | "choosing";

type RuntimeVarDef = {
  id: ID;
  type: "number" | "boolean";
  initial: number | boolean;
};

type RuntimeVars = Record<ID, boolean | number>;

/* Estado runtime del mapa durante la partida */
export type WorldMapRuntime = {
  isOpen: boolean;
  activeMapId?: ID;
  selectedRegionId?: ID;
  visibleRegionIdsByMap: Record<ID, ID[]>;
  unlockedRegionIdsByMap: Record<ID, ID[]>;
  currentRegionIdByMap: Record<ID, ID | undefined>;
};

/* Entrada concreta del inventario */
export type InventoryEntry = {
  itemInstanceId: ID;
  itemId: ID;
  label?: string;
  rules?: InteractionRules;
};

/* Diálogo actualmente activo en el player */
export type ActiveDialogueState = {
  nodeId: ID;
  dialogueId: ID;
  currentNodeId: ID;
  phase: DialoguePhase;
};

/* Estado runtime persistente de una escena concreta */
export type NodeRuntimeState = {
  hotspots: Record<ID, PlaceableState>;
  placedItems: Record<ID, PlaceableState>;
  placedNpcs: Record<ID, PlaceableState>;
  placedPlayers: Record<ID, PlacedPlayerState>;
  placedPlayerImageId: Record<ID, ID>;
};

/* Estado global de una partida en ejecución */
export type GameState = {
  project: Project;
  nodes: Record<ID, NodeRuntimeState>;
  currentNodeId: ID;
  visitedNodes: Record<ID, boolean>;
  activeDialogue?: ActiveDialogueState;
  playerInventory: Record<ID, InventoryEntry[]>;
  hotspotVars: Record<ID, Record<ID, boolean | number>>;
  playerVars: Record<ID, Record<ID, boolean | number>>;
  npcInventory: Record<ID, InventoryEntry[]>;
  npcVars: Record<ID, Record<ID, boolean | number>>;
  map: WorldMapRuntime;
  music: MusicRuntimeState;
  gameEnded: boolean;
  ending?: EndGameContent;
  endingLineIndex?: number;
};

function hasProjectPlayer(project: Project, playerId: ID | null | undefined): playerId is ID {
  if (!playerId) return false;

  return (project.players ?? []).some((player) => player.id === playerId);
}

/* Decide qué Player es propietario del inventario en runtime */
export function resolveInventoryPlayerId(state: GameState | null, preferredPlayerId?: ID | null): ID | null {
  if (!state) return null;

  if (hasProjectPlayer(state.project, preferredPlayerId)) return preferredPlayerId;

  const projectPlayers = state.project.players ?? [];

  if (projectPlayers.length === 1) return projectPlayers[0].id;

  const currentNodeRuntime = state.nodes[state.currentNodeId];

  if (currentNodeRuntime) {
    const visiblePlacedPlayerIds = Object.entries(currentNodeRuntime.placedPlayers)
      .filter(([, placedPlayer]) => placedPlayer.visible !== false)
      .map(([playerId]) => playerId)
      .filter((playerId) => hasProjectPlayer(state.project, playerId));

    if (visiblePlacedPlayerIds.length === 1) return visiblePlacedPlayerIds[0];

    const placedPlayerIds = Object.keys(currentNodeRuntime.placedPlayers)
      .filter((playerId) => hasProjectPlayer(state.project, playerId));

    if (placedPlayerIds.length === 1) return placedPlayerIds[0];
  }

  const inventoryPlayerIds = Object.keys(state.playerInventory)
    .filter((playerId) => hasProjectPlayer(state.project, playerId));

  if (inventoryPlayerIds.length === 1) return inventoryPlayerIds[0];

  return projectPlayers[0]?.id ?? null;
}

export function resolveRequiredInventoryPlayerId(state: GameState, preferredPlayerId?: ID | null): ID {
  const playerId = resolveInventoryPlayerId(state, preferredPlayerId);

  if (!playerId) throw new Error("No se puede modificar el inventario porque el proyecto no tiene players.");

  return playerId;
}

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

function initInventoryFromDefs(items?: { itemInstanceId: ID; itemId: ID; label?: string, rules?: InteractionRules }[]): InventoryEntry[] {
  return (items ?? []).map((item) => ({
    itemInstanceId: item.itemInstanceId,
    itemId: item.itemId,
    label: item.label,
    ...(item.rules ? { rules: item.rules } : {})
  }));
}

function initVarsFromDefs(defs?: RuntimeVarDef[]): RuntimeVars {
  const vars: RuntimeVars = {};

  for (const def of defs ?? []) vars[def.id] = def.initial;

  return vars;
}

function initPlayerInventory(project: Project): GameState["playerInventory"] {
  const inventory: GameState["playerInventory"] = {};

  for (const player of project.players ?? []) inventory[player.id] = initInventoryFromDefs(player.initialInventory);

  return inventory;
}

function initNpcInventory(project: Project): GameState["npcInventory"] {
  const inventory: GameState["npcInventory"] = {};

  for (const npc of project.npcs ?? []) inventory[npc.id] = initInventoryFromDefs(npc.initialInventory);

  return inventory;
}

/* Selecciona la escena inicial de la partida */
function pickStartNodeId(project: Project): ID {
  if (project.nodes.length === 0) throw new Error("El proyecto no contiene escenas. No se puede iniciar una partida.");

  const startNodes = project.nodes.filter((node) => node.isStart === true);

  if (startNodes.length > 1) throw new Error("El proyecto tiene más de un nodo marcado como inicio.");

  return startNodes[0]?.id ?? project.nodes[0]!.id;
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
  for (const player of project.players ?? []) playerVars[player.id] = initVarsFromDefs(player.vars);
  const playerInventory = initPlayerInventory(project);

  const npcVars: GameState["npcVars"] = {};
  for (const npc of project.npcs ?? []) npcVars[npc.id] = initVarsFromDefs(npc.vars);
  const npcInventory = initNpcInventory(project);

  return {
    project,
    currentNodeId,
    activeDialogue: undefined,
    playerInventory,
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
  const placedPlayerImageId: Record<ID, ID> = {};
  const hotspotVarsForNode: GameState["hotspotVars"] = {};

  for (const layer of node.layers ?? []) {
    for (const hotspot of layer.hotspots ?? []) {
      hotspots[hotspot.id] = { ...hotspot.initialState };
      hotspotVarsForNode[hotspot.id] = initVarsFromDefs(hotspot.vars);
    }

    for (const placedItem of layer.placedItems ?? []) {
      if (!placedItem.placement) continue;

      placedItems[placedItem.itemInstanceId] = { ...placedItem.placement.initialState };
    }

    for (const placedNpc of layer.placedNpcs ?? []) {
      placedNpcs[placedNpc.npcId] = { ...placedNpc.initialState };
    }
    
    for (const placedPlayer of layer.placedPlayers ?? []) {
      placedPlayers[placedPlayer.playerId] = { ...placedPlayer.initialState };
    }
  }

  const nodeRuntime: NodeRuntimeState = { hotspots, placedItems, placedNpcs, placedPlayers, placedPlayerImageId };

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