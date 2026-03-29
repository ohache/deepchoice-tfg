import { create } from "zustand";
import type { Project, ID, AssetDef } from "@/domain/types";
import { downloadProjectJsonFile, exportProjectAsZip } from "@/store/utils/editorPersistence";
import { resolveDirectoryImport } from "@/shared/directoryImport";
import { buildBaseEditorState, clamp, DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, STEP_ZOOM } from "@/store/utils/editorStoreUtils";
import { generateId } from "@/utils/id";
import { buildAssetPath } from "@/store/assets/assetPath";
import { removeAsset, removeAssetFile } from "@/features/editor/core/editorGenericSlice";
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
import { type EditorPlacedNpcsSlice, createEditorPlacedNpcsSlice } from "@/features/editor/scene/placedNpcs/editorPlacedNpcslice";
import { type EditorDialoguesSlice, createEditorDialoguesSlice } from "@/features/editor/scene/dialogues/editorDialogueSlice";

export interface EditorStore extends EditorMusicSlice, EditorSfxSlice, EditorItemsSlice, EditorPlayerSlice, EditorNpcSlice,EditorHistoryViewSlice, EditorNodesSlice,
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
  upsertBackgroundAsset: (assetId: ID, file: File) => void;
  removeBackgroundAsset: (assetId: ID) => void;
  downloadProjectJson: () => void;
  exportProject: () => Promise<void>;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
}

export const useEditorStore = create<EditorStore>()((set, get) => ({
  project: null,

  assetFiles: {},

  primaryMode: "historia",

  secondaryMode: "vista",

  zoom: 100,

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

  initNewProject: (title: string) => {
    const projectId = generateId.project();
    const normalizedTitle = title.trim() || "Nuevo proyecto";

    const newProject: Project = {
      id: projectId,
      title: normalizedTitle,
      assets: [],
      items: [],
      npcs: [],
      players: [],
      musicTracks: [],
      soundEffects: [],
      maps: [],
      nodes: [],
    };

    set({
      ...buildBaseEditorState(),
      project: newProject,
      assetFiles: {},
    });
  },

  loadProjectFromDirectory: (project: Project, files: File[]) => {
    const { normalizedAssets, assetFilesById } = resolveDirectoryImport(project, files);

    const nextProject: Project = { ...project, assets: normalizedAssets };

    set({
      ...buildBaseEditorState(),
      project: nextProject,
      assetFiles: assetFilesById,

    });
  },

  updateProjectTitle: (title: string) => {
    set((state) => {
      if (!state.project) return state;

      const nextTitle = title.trim();
      if (!nextTitle) return state;

      return {
        ...state,
        project: { ...state.project, title: nextTitle },
      };
    });
  },

  setPrimaryMode: (mode) => {
    set((state) => ({
      primaryMode: mode,
      secondaryMode: getDefaultSecondaryMode(mode),
      selectedNodeId: state.selectedNodeId,
    }));

    if (mode !== "escena") return;

    const s = get();

    if (s.nodeDraft) return;

    if (s.selectedNodeId == null) {
      s.enterCreateNodeMode?.();
      return;
    }

    s.enterEditNodeMode?.(s.selectedNodeId);
  },

  setSecondaryMode: (mode: EditorSecondaryMode) => {
    set(() => ({ secondaryMode: mode }));

  },

  resetEditor: () => {
    set({
      ...buildBaseEditorState(),
      project: null,
      assetFiles: {},
    });
  },

  registerAssetFile: (assetId: ID, file: File) => {
    set((state) => ({ assetFiles: { ...state.assetFiles, [assetId]: file } }));
  },

  upsertBackgroundAsset: (assetId, file) => {
    const s = get();
    const proj = s.project;
    if (!proj) return;

    s.registerAssetFile(assetId, file);

    const relativePath = buildAssetPath("backgrounds", file.name);

    const assets0 = proj.assets ?? [];
    const existing = assets0.find((a) => a.kind === "backgrounds" && a.id === assetId);

    const nextAsset: AssetDef = {
      id: assetId,
      kind: "backgrounds",
      name: (existing?.name ?? "").trim() !== "" ? existing!.name : (file.name ?? "Background"),
      file: relativePath,
    };

    const nextAssets = existing
      ? assets0.map((a) => (a.kind === "backgrounds" && a.id === assetId ? nextAsset : a))
      : [...assets0, nextAsset];

    set({
      project: {
        ...proj,
        assets: nextAssets,
      },
    });
  },

  removeBackgroundAsset: (id: ID) =>
  set((state) => {
    if (!state.project) return state;

    const project0 = state.project;

    const remA = removeAsset(project0.assets ?? [], { id, kind: "backgrounds" });
    const remF = removeAssetFile(state.assetFiles, id);

    if (!remA.touched && !remF.touched) return state;

    return {
      ...state,
      project: { ...project0, assets: remA.assets },
      assetFiles: remF.assetFiles,
    };
  }),

    downloadProjectJson: () => {
    const project = get().project;
    if (!project) return;

    downloadProjectJsonFile(project);
  },

  exportProject: async () => {
    const { project, assetFiles } = get();
    if (!project) return;

    await exportProjectAsZip(project, assetFiles);
  },

  setZoom: (zoom) =>
    set((s) => (s.primaryMode === "historia" && s.secondaryMode === "vista"
      ? { zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) }
      : s)),

  zoomIn: () =>
    set((s) => (s.primaryMode === "historia" && s.secondaryMode === "vista"
      ? { zoom: clamp(s.zoom + STEP_ZOOM, MIN_ZOOM, MAX_ZOOM) }
      : s)),

  zoomOut: () =>
    set((s) => (s.primaryMode === "historia" && s.secondaryMode === "vista"
      ? { zoom: clamp(s.zoom - STEP_ZOOM, MIN_ZOOM, MAX_ZOOM) }
      : s)),

  zoomReset: () =>
    set((s) => (s.primaryMode === "historia" && s.secondaryMode === "vista"
      ? { zoom: DEFAULT_ZOOM }
      : s)),
}));
