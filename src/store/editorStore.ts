import { create } from "zustand";
import type { Project } from "@/domain/types";
import { generateProjectId } from "@/utils/id";
import { type EditorPrimaryMode, type EditorSecondaryMode, getDefaultSecondaryMode } from "@/features/editor/core/editorModes";
import { type EditorSceneSlice, createEditorSceneSlice } from "@/features/editor/core/editorSceneSlice";
import { type EditorMusicSlice, createEditorMusicSlice } from "@/features/editor/core/editorMusicSlice";
import { type EditorItemsSlice, createEditorItemsSlice } from "@/features/editor/core/editorItemsSlice";

type ValidationStatus = "idle" | "ok" | "warning" | "error";

interface EditorStoreState extends EditorSceneSlice, EditorMusicSlice, EditorItemsSlice {
  project: Project | null;
  primaryMode: EditorPrimaryMode;
  secondaryMode: EditorSecondaryMode;
  isDirty: boolean;
  validationStatus: ValidationStatus;
  errorCount: number;
  assetFiles: Record<string, File>;

  initNewProject: (title: string) => void;
  loadProjectFromDirectory: (project: Project, files: File[]) => void;
  updateProjectTitle: (title: string) => void;
  setPrimaryMode: (mode: EditorPrimaryMode) => void;
  setSecondaryMode: (mode: EditorSecondaryMode) => void;
  markSaved: () => void;
  setValidationResult: (status: ValidationStatus, errorCount: number) => void;
  resetEditor: () => void;
  registerAssetFile: (path: string, file: File) => void;
  clearStartFlagFromAllNodes: () => void;

  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
}

const initialUIState = {
  primaryMode: "historia" as EditorPrimaryMode,
  secondaryMode: getDefaultSecondaryMode("historia") as EditorSecondaryMode,
  isDirty: false,
  validationStatus: "idle" as ValidationStatus,
  errorCount: 0,
  zoom: 100,
};

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const STEP_ZOOM = 25;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type EditorStore = EditorStoreState;

function normalizeAssetPath(rawPath: string): string {
  const unix = rawPath.replace(/\\/g, "/");
  const parts = unix.split("/");

  if (parts.length > 1) return parts.slice(1).join("/");

  return unix;
}

export const useEditorStore = create<EditorStore>()((set, get) => ({
  project: null,
  assetFiles: {},
  ...initialUIState,

  ...createEditorSceneSlice(set, get),
  ...createEditorMusicSlice(set, get),
  ...createEditorItemsSlice(set, get),

  initNewProject: (title: string) => {
    const id = generateProjectId(title);

    const newProject: Project = {
      id,
      title: title.trim(),
      nodes: [],
      items: [],
      npcs: [],
      musicTracks: [],
      maps: [],
      meta: {},
    };

    set({
      project: newProject,
      assetFiles: {},
      ...initialUIState,

      selectedNodeId: null,
      sceneMode: "creating",
      selectedMusicTrackId: null,
      selectedItemId: null,

      isDirty: true,
    });
  },

  loadProjectFromDirectory: (project: Project, files: File[]) => {
    const assetFiles: Record<string, File> = {};

    for (const raw of files) {
      const anyFile = raw as any;

      const relPath: string =
        typeof anyFile.webkitRelativePath === "string" &&
          anyFile.webkitRelativePath.length > 0
          ? anyFile.webkitRelativePath
          : raw.name;

      const normalized = normalizeAssetPath(relPath);

      if (normalized.toLowerCase().endsWith(".json")) continue;

      assetFiles[normalized] = raw;
    }

    set({
      project,
      assetFiles,
      ...initialUIState,

      selectedNodeId: null,
      sceneMode: "creating",
      selectedMusicTrackId: null,
      selectedItemId: null,
    });
  },

  updateProjectTitle: (title: string) => {
    set((state) => {
      if (!state.project) return state;

      return {
        ...state,
        project: {
          ...state.project,
          title: title.trim() || state.project.title,
        },
        isDirty: true,
      };
    });
  },

  setPrimaryMode: (mode: EditorPrimaryMode) => {
    set((state) => ({
      ...state,
      primaryMode: mode,
      secondaryMode: getDefaultSecondaryMode(mode),
    }));
  },

  setSecondaryMode: (mode: EditorSecondaryMode) => {
    set((state) => ({
      ...state,
      secondaryMode: mode,
    }));
  },

  markSaved: () => {
    set((state) => ({
      ...state,
      isDirty: false,
    }));
  },

  setValidationResult: (status: ValidationStatus, errorCount: number) => {
    set((state) => ({
      ...state,
      validationStatus: status,
      errorCount,
    }));
  },

  resetEditor: () => {
    set({
      project: null,
      ...initialUIState,

      selectedNodeId: null,
      sceneMode: "creating",
      selectedMusicTrackId: null,
      selectedItemId: null,
    });
  },

  registerAssetFile: (path: string, file: File) => {
    set((state) => ({
      ...state,
      assetFiles: {
        ...state.assetFiles,
        [path]: file,
      },
      isDirty: true,
    }));
  },

  clearStartFlagFromAllNodes: () => {
    set((state) => {
      if (!state.project) return state;

      return {
        ...state,
        project: {
          ...state.project,
          nodes: state.project.nodes.map((node) =>
            node.isStart ? { ...node, isStart: false } : node
          ),
        },
        isDirty: true,
      };
    });
  },

  zoom: initialUIState.zoom,

  setZoom: (zoom) =>
    set((state) => ({
      ...state,
      zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM),
    })),

  zoomIn: () =>
    set((state) => ({
      ...state,
      zoom: clamp(state.zoom + STEP_ZOOM, MIN_ZOOM, MAX_ZOOM),
    })),

  zoomOut: () =>
    set((state) => ({
      ...state,
      zoom: clamp(state.zoom - STEP_ZOOM, MIN_ZOOM, MAX_ZOOM),
    })),

  zoomReset: () => set((state) => ({ ...state, zoom: 100 })),
}));