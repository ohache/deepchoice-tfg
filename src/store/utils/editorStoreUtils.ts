import type { ID, Project } from "@/domain/types";
import type { EditorPrimaryMode, EditorSecondaryMode } from "@/features/editor/core/editorModes";
import { generateId } from "@/utils/id";

export const DEFAULT_ZOOM = 100;
export const MIN_ZOOM = 50;
export const MAX_ZOOM = 200;
export const STEP_ZOOM = 25;

/* Clamp numérico simple */
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/* Proyecto vacío */
export function createEmptyProject(title: string): Project {
  return {
    id: generateId.project(),
    title: title.trim() || "Nuevo proyecto",
    assets: [],
    items: [],
    npcs: [],
    players: [],
    musicTracks: [],
    soundEffects: [],
    maps: [],
    nodes: [],
  };
}

/*  Helpers de estado base del editor */
function createEmptyDrawingState() {
  return null as null;
}

function createEmptyHotspotEditor() {
  return {
    context: null,
    mode: { type: "idle" } as const,
    selection: {
      hotspotId: null as ID | null,
      selectedChannel: null,
      selectedRuleId: null as ID | null,
    },
    draft: null,
    drawing: createEmptyDrawingState(),
  };
}

function createEmptyPlacedItemEditor() {
  return {
    context: null,
    mode: { type: "idle" } as const,
    selection: {
      placedItemId: null as ID | null,
      selectedChannel: null,
      selectedRuleId: null as ID | null,
    },
    draft: null,
    drawing: createEmptyDrawingState(),
  };
}

function createEmptyPlacedNpcEditor() {
  return {
    context: null,
    mode: { type: "idle" } as const,
    selection: {
      npcId: null as ID | null,
      selectedChannel: null,
      selectedRuleId: null as ID | null,
    },
    draft: null,
    drawing: createEmptyDrawingState(),
  };
}

function createEmptyPlacedPlayerEditor() {
  return {
    context: null,
    mode: { type: "idle" } as const,
    selection: {
      playerId: null as ID | null,
    },
    draft: null,
    drawing: createEmptyDrawingState(),
  };
}

function createEmptyDialogueEditor() {
  return {
    context: null,
    mode: { type: "idle" } as const,
    selection: {
      selectedDialogueId: null as ID | null,
      selectedNodeId: null as ID | null,
    },
    dialogueDraft: null,
    lineDraft: null,
  };
}

function createEmptyMapRegionEditor() {
  return {
    context: null,
    mode: { type: "idle" } as const,
    selection: {
      regionId: null as ID | null,
    },
    draft: null,
    drawing: createEmptyDrawingState(),
  };
}

/* Estado base del editor */
export function buildBaseEditorState() {
  return {
    /* Navegación global del editor */
    primaryMode: "historia" as const,
    secondaryMode: "vista" as const,
    zoom: DEFAULT_ZOOM,

    /* Selecciones de catálogo/globales */
    selectedNodeId: null as ID | null,
    selectedPlayerId: null as ID | null,
    selectedNpcId: null as ID | null,
    selectedItemId: null as ID | null,
    selectedMusicTrackId: null as ID | null,
    selectedSfxId: null as ID | null,
    selectedMapId: null as ID | null,

    /* Estado del editor de nodos */
    nodeMode: "creating" as const,
    editingNodeId: null as ID | null,
    nodeDraft: null,
    nodeIssues: [] as Array<{ path: string; message: string }>,

    /* Estado del editor de capas */
    activeLayerId: null as ID | null,

    /* Selección genérica de interactivos de capa */
    selectedInteractionKind: null,
    selectedInteractionId: null as ID | null,

    /* Editores específicos */
    hotspotEditor: createEmptyHotspotEditor(),
    placedItemEditor: createEmptyPlacedItemEditor(),
    placedNpcEditor: createEmptyPlacedNpcEditor(),
    placedPlayerEditor: createEmptyPlacedPlayerEditor(),
    dialogueEditor: createEmptyDialogueEditor(),

    /* Editor de regiones de mapa */
    mapRegionEditor: createEmptyMapRegionEditor(),
  };
}

/* Zoom */
export function canUseHistoryViewZoom(primaryMode: EditorPrimaryMode, secondaryMode: EditorSecondaryMode): boolean {
  return primaryMode === "historia" && secondaryMode === "vista";
}