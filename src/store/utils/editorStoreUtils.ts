import type { ID, Project } from "@/domain/types";
import type { EditorPrimaryMode, EditorSecondaryMode } from "@/features/editor/core/editorNavigation";
import type { MapRegionEditorState } from "@/features/editor/history/maps/mapRegionEditorTypes";
import type { DialogueEditorState } from "@/features/editor/scene/dialogues/dialogueEditorTypes";
import type { HotspotEditorState } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { PlacedItemEditorState } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import type { PlacedNpcEditorState } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import type { PlacedPlayerEditorState } from "@/features/editor/scene/placedPlayers/placedPlayerEditorTypes";
import { generateId } from "@/utils/id";

export const DEFAULT_ZOOM = 100;
export const MIN_ZOOM = 50;
export const MAX_ZOOM = 200;
export const STEP_ZOOM = 25;

/* Clamp numérico simple */
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

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
function createEmptyHotspotEditor(): HotspotEditorState {
  return {
    context: null,
    mode: { type: "idle" },
    selection: {
      hotspotId: null,
      selectedChannel: null,
      selectedRuleId: null,
    },
    draft: null,
    drawing: null,
  };
}

function createEmptyPlacedItemEditor(): PlacedItemEditorState {
  return {
    context: null,
    mode: { type: "idle" },
    selection: {
      placedItemId: null,
      selectedChannel: null,
      selectedRuleId: null,
    },
    draft: null,
    drawing: null,
  };
}

function createEmptyPlacedNpcEditor(): PlacedNpcEditorState {
  return {
    context: null,
    mode: { type: "idle" },
    selection: {
      npcId: null,
      selectedChannel: null,
      selectedRuleId: null,
    },
    draft: null,
    drawing: null,
  };
}

function createEmptyPlacedPlayerEditor(): PlacedPlayerEditorState {
  return {
    context: null,
    mode: { type: "idle" },
    selection: {
      playerId: null,
    },
    draft: null,
    drawing: null,
  };
}

function createEmptyDialogueEditor(): DialogueEditorState {
  return {
    context: null,
    mode: { type: "idle" },
    selection: {
      selectedDialogueId: null,
      selectedNodeId: null,
    },
    dialogueDraft: null,
    lineDraft: null,
  };
}

function createEmptyMapRegionEditor(): MapRegionEditorState {
  return {
    mapId: null,
    mode: { type: "idle" },
    selectedRegionId: null,
    draft: null,
    drawing: null,
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

    /* Borrado */
    pendingDeleteImpact: null,
    pendingDeleteTarget: null,
  };
}

/* Zoom */
export function canUseHistoryViewZoom(primaryMode: EditorPrimaryMode, secondaryMode: EditorSecondaryMode): boolean {
  return primaryMode === "historia" && secondaryMode === "vista";
}