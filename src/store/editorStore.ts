import { create } from "zustand";
import type { Project, ID } from "@/domain/types";
import { downloadProjectJsonFile, exportProjectAsZip } from "@/store/utils/editorPersistence";
import { resolveDirectoryImport } from "@/shared/directoryImport";
import { createEmptyProject, buildBaseEditorState, canUseHistoryViewZoom, clamp, DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, STEP_ZOOM } from "@/store/utils/editorStoreUtils";
import { type EditorPrimaryMode, type EditorSecondaryMode, getDefaultSecondaryMode } from "@/features/editor/core/editorModes";
import { type EditorHistoryViewSlice, createEditorHistoryViewSlice } from "@/features/editor/history/view/editorHistoryViewSlice";
import { type EditorMusicSlice, createEditorMusicSlice } from "@/features/editor/history/music/editorMusicSlice";
import { type EditorSfxSlice, createEditorSfxSlice } from "@/features/editor/history/sfx/editorSfxSlice";
import { type EditorItemsSlice, createEditorItemsSlice } from "@/features/editor/history/items/editorItemsSlice";
import { type EditorNpcSlice, createEditorNpcSlice } from "@/features/editor/history/npcs/editorNpcSlice";
import { type EditorPlayerSlice, createEditorPlayerSlice } from "@/features/editor/history/players/editorPlayersSlice";
import { type EditorMapsSlice, createEditorMapsSlice } from "@/features/editor/history/maps/editorMapsSlice";
import { type EditorMapRegionsSlice, createEditorMapRegionsSlice } from "@/features/editor/history/maps/editorMapRegionSlice";
import { type EditorNodesSlice, createEditorNodesSlice } from "@/features/editor/scene/node/editorNodeSlice";
import { type EditorLayerSlice, createEditorLayerSlice } from "@/features/editor/scene/layer/editorLayerSlice";
import { type EditorLayerInteractionsSlice, createEditorLayerInteractionsSlice } from "@/features/editor/scene/layer/editorLayerInteractionSlice";
import { type EditorHotspotsSlice, createEditorHotspotsSlice } from "@/features/editor/scene/hotspots/editorHotspotsSlice";
import { type EditorPlacedItemsSlice, createEditorPlacedItemsSlice } from "@/features/editor/scene/placedItems/editorPlacedItemSlice";
import { type EditorPlacedPlayersSlice, createEditorPlacedPlayersSlice } from "@/features/editor/scene/placedPlayers/editorPlacedPlayerSlice";
import { type EditorPlacedNpcsSlice, createEditorPlacedNpcsSlice } from "@/features/editor/scene/placedNpcs/editorPlacedNpcSlice";
import { type EditorDialoguesSlice, createEditorDialoguesSlice } from "@/features/editor/scene/dialogues/editorDialogueSlice";

export interface EditorStore extends EditorMusicSlice, EditorSfxSlice, EditorItemsSlice, EditorPlayerSlice, EditorNpcSlice, EditorHistoryViewSlice, EditorNodesSlice,
  EditorLayerSlice, EditorLayerInteractionsSlice, EditorHotspotsSlice, EditorPlacedItemsSlice, EditorPlacedPlayersSlice, EditorPlacedNpcsSlice, EditorDialoguesSlice,
  EditorMapsSlice, EditorMapRegionsSlice {
  project: Project | null;
  primaryMode: EditorPrimaryMode;
  secondaryMode: EditorSecondaryMode;
  assetFiles: Record<ID, File>;
  zoom: number;

  initNewProject: (title: string) => void;
  loadProjectFromDirectory: (project: Project, files: File[]) => void;
  updateProjectTitle: (title: string) => void;

  setPrimaryMode: (mode: EditorPrimaryMode) => void;
  setSecondaryMode: (mode: EditorSecondaryMode) => void;
  resetEditor: () => void;

  registerAssetFile: (assetId: ID, file: File) => void;

  downloadProjectJson: () => void;
  exportProject: () => Promise<void>;

  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
}

export const useEditorStore = create<EditorStore>()((set, get) => ({
  ...buildBaseEditorState(),

  project: null,
  
  assetFiles: {},

  ...createEditorSfxSlice(set, get),
  ...createEditorMusicSlice(set, get),
  ...createEditorItemsSlice(set, get),
  ...createEditorNpcSlice(set, get),
  ...createEditorPlayerSlice(set, get),

  ...createEditorMapsSlice(set, get),
  ...createEditorMapRegionsSlice(set, get),

  ...createEditorNodesSlice(set, get),
  ...createEditorLayerSlice(set, get),
  ...createEditorLayerInteractionsSlice(set, get),

  ...createEditorHotspotsSlice(set, get),
  ...createEditorPlacedItemsSlice(set, get),
  ...createEditorPlacedPlayersSlice(set, get),
  ...createEditorPlacedNpcsSlice(set, get),

  ...createEditorDialoguesSlice(set, get),

  ...createEditorHistoryViewSlice(set, get),

  /* Inicializa un proyecto nuevo y reseta el editor al estado base */
  initNewProject: (title: string) => {
    set({
      ...buildBaseEditorState(),
      project: createEmptyProject(title),
      assetFiles: {},
    });
  },

  /* Carga un proyecto existente desde un directorio importado */
  loadProjectFromDirectory: (project: Project, files: File[]) => {
    const { normalizedAssets, assetFilesById } = resolveDirectoryImport(project, files);

    set({
      ...buildBaseEditorState(),
      project: { ...project, assets: normalizedAssets },
      assetFiles: assetFilesById,
    });
  },

  /* Cambia el título del proyecto */
  updateProjectTitle: (title: string) => {
    set((state) => {
      if (!state.project) return state;

      const nextTitle = title.trim();
      if (!nextTitle || nextTitle === state.project.title) return state;

      return {
        ...state,
        project: { ...state.project, title: nextTitle },
      };
    });
  },

  /* Cambia el modo primario y ajusta automáticamente el secundario */
  setPrimaryMode: (mode) => {
    set((state) => ({
      primaryMode: mode,
      secondaryMode: getDefaultSecondaryMode(mode),
      selectedNodeId: state.selectedNodeId,
    }));

    if (mode !== "escena") return;

    const state = get();

    if (state.nodeDraft) return;

    if (state.selectedNodeId == null) {
      state.enterCreateNodeMode?.();
      return;
    }

    state.enterEditNodeMode?.(state.selectedNodeId);
  },

  /* Cambia el modo secundario */
  setSecondaryMode: (mode) => {
    set({ secondaryMode: mode });
  },

  /* Reseta el editor */
  resetEditor: () => {
    set({
      ...buildBaseEditorState(),
      project: null,
      assetFiles: {},
    });
  },

  /* Registar un File en memoria para un assetId */
  registerAssetFile: (assetId: ID, file: File) => {
    set((state) => ({
      assetFiles: { ...state.assetFiles, [assetId]: file }
    }
    ));
  },

  

  /* Descarga el JSON del proyecto */
  downloadProjectJson: () => {
    const project = get().project;
    if (!project) return;

    downloadProjectJsonFile(project);
  },

  /* Descarga el proyecto en formato zip */
  exportProject: async () => {
    const { project, assetFiles } = get();
    if (!project) return;

    await exportProjectAsZip(project, assetFiles);
  },

  /* Fija el zoom */
  setZoom: (zoom) =>
    set((state) =>
      canUseHistoryViewZoom(state.primaryMode, state.secondaryMode)
        ? { zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }
        : state,
    ),

  /* Aumenta el zoom */
  zoomIn: () =>
    set((state) =>
      canUseHistoryViewZoom(state.primaryMode, state.secondaryMode)
        ? { zoom: clamp(state.zoom + STEP_ZOOM, MIN_ZOOM, MAX_ZOOM) }
        : state,
    ),

  /* Disminuye el zoom */
  zoomOut: () =>
    set((state) =>
      canUseHistoryViewZoom(state.primaryMode, state.secondaryMode)
        ? { zoom: clamp(state.zoom - STEP_ZOOM, MIN_ZOOM, MAX_ZOOM) }
        : state,
    ),

  /* Reseta el zoom */
  zoomReset: () =>
    set((state) =>
      canUseHistoryViewZoom(state.primaryMode, state.secondaryMode)
        ? { zoom: DEFAULT_ZOOM }
        : state,
    ),
}));
