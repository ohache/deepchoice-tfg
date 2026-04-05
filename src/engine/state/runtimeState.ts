import type { ID, PlaceableState, PlacedPlayerState, Project } from "@/domain/types";
import { createInitialMusicRuntime, type MusicRuntimeState } from "@/engine/state/slices/musicSlice";

export type DialoguePhase = "speaking" | "choosing";

export interface WorldMapRuntime {
  isOpen: boolean;
  activeMapId?: ID;
  selectedRegionId?: ID;
  visibleRegionIdsByMap: Record<ID, ID[]>;
  unlockedRegionIdsByMap: Record<ID, ID[]>;
  currentRegionIdByMap: Record<ID, ID | undefined>;
}

export interface InventoryEntry {
  instanceId: ID;
  itemId: ID;
}

export interface ActiveDialogueState {
  nodeId: ID;
  dialogueId: ID;
  currentNodeId: ID;
  phase: DialoguePhase;
}

/* Estado runtime por nodo (persistente por nodeId) */
export interface NodeRuntimeState {
  hotspots: Record<ID, PlaceableState>;
  placedItems: Record<ID, PlaceableState>;
  placedNpcs: Record<ID, PlaceableState>;
  placedPlayers: Record<ID, PlacedPlayerState>;
  placedPlayerImageId?: Record<ID, ID | undefined>;
}

/* GameState (runtime) */
export interface GameState {
  project: Project;
  currentNodeId: ID;
  activeDialogue?: ActiveDialogueState;
  inventory: InventoryEntry[];
  visitedNodes: Record<ID, boolean>;
  hotspotVars: Record<ID, Record<ID, boolean | number>>;
  playerVars: Record<ID, Record<ID, boolean | number>>;
  npcVars: Record<ID, Record<ID, boolean | number>>;
  map: WorldMapRuntime;
  music: MusicRuntimeState;
  nodes: Record<ID, NodeRuntimeState>;
  gameEnded: boolean;
  endGameMessage?: string;
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

/* Helpers: inicializar vars desde defs */
function initVarsFromDefs(defs?: { id: ID; type: "number" | "boolean"; initial: number | boolean }[]) {
  const out: Record<ID, boolean | number> = {};
  for (const d of defs ?? []) out[d.id] = d.initial;
  return out;
}

/* Selección de nodo inicial */
function pickStartNodeId(project: Project): ID {
  if (project.nodes.length === 0) throw new Error("El proyecto no contiene escenas. No se puede iniciar una partida.");

  const startNodes = project.nodes.filter((n) => n.isStart === true);

  if (startNodes.length > 1) throw new Error("El proyecto tiene más de un nodo marcado como inicio.");

  return (startNodes[0] ?? project.nodes[0]).id;
}

function createInitialMapRuntimeFromProject(project: Project, currentNodeId: ID): WorldMapRuntime {
  const startNode = project.nodes.find((n) => n.id === currentNodeId) ?? null;
  const loc = startNode?.mapLocation;

  if (!loc) {
    return createInitialMapRuntime();
  }

  return {
    isOpen: false,
    activeMapId: loc.mapId,
    selectedRegionId: loc.regionId,
    visibleRegionIdsByMap: {
      [loc.mapId]: [loc.regionId],
    },
    unlockedRegionIdsByMap: {
      [loc.mapId]: [loc.regionId],
    },
    currentRegionIdByMap: {
      [loc.mapId]: loc.regionId,
    },
  };
}

/* Inicializa runtime global (sin materializar nodos aún) */
export function createInitialGameState(project: Project): GameState {
  const currentNodeId = pickStartNodeId(project);

  const mapRuntime = createInitialMapRuntimeFromProject(project, currentNodeId);

  const playerVars: GameState["playerVars"] = {};
  for (const p of project.players ?? []) playerVars[p.id] = initVarsFromDefs(p.vars);

  const npcVars: GameState["npcVars"] = {};
  for (const n of project.npcs ?? []) npcVars[n.id] = initVarsFromDefs(n.vars);

  return {
    project,
    currentNodeId,
    activeDialogue: undefined,
    inventory: [],
    visitedNodes: { [currentNodeId]: true },
    hotspotVars: {},
    playerVars,
    npcVars,
    map: mapRuntime,
    music: createInitialMusicRuntime(),
    nodes: {},
    gameEnded: false,
    endGameMessage: undefined,
  };
}

export function getCurrentNode(state: GameState) {
  const node = state.project.nodes.find((n) => n.id === state.currentNodeId);

  if (!node) throw new Error(`No se encontró el nodo actual id=${state.currentNodeId}`);

  return node;
}

/* Materializa estado runtime por nodeId usando initialState */
export function ensureNodeRuntime(state: GameState, nodeId: ID): GameState {
  if (state.nodes[nodeId]) return state;

  const node = state.project.nodes.find((n) => n.id === nodeId);

  if (!node) {
    throw new Error(`ensureNodeRuntime: nodeId inexistente "${nodeId}"`);
  }

  const hotspots: Record<ID, PlaceableState> = {};
  const placedItems: Record<ID, PlaceableState> = {};
  const placedNpcs: Record<ID, PlaceableState> = {};
  const placedPlayers: Record<ID, PlacedPlayerState> = {};
  const placedPlayerImageId: Record<ID, ID | undefined> = {};
  const hotspotVarsForNode: Record<ID, Record<ID, boolean | number>> = {};

  for (const layer of node.layers ?? []) {
    for (const h of layer.hotspots ?? []) {
      hotspots[h.id] = { ...h.initialState };
      hotspotVarsForNode[h.id] = initVarsFromDefs(h.vars);
    }

    for (const pi of layer.placedItems ?? []) {
      placedItems[pi.id] = { ...pi.initialState };
    }

    for (const pn of layer.placedNpcs ?? []) {
      placedNpcs[pn.npcId] = { ...pn.initialState };
    }

    for (const pp of layer.placedPlayers ?? []) {
      placedPlayers[pp.playerId] = { ...pp.initialState };
      placedPlayerImageId[pp.playerId] = pp.initialImageId;
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