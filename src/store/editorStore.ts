import { create } from "zustand";
import type { Project } from "@/domain/types";
import { generateProjectId } from "@/utils/id";
import { type EditorPrimaryMode, type EditorSecondaryMode, getDefaultSecondaryMode } from "@/features/editor/core/editorModes";
import { type EditorSceneSlice, createEditorSceneSlice } from "@/features/editor/core/editorSceneSlice";

type ValidationStatus = "idle" | "ok" | "warning" | "error";

interface EditorStoreState extends EditorSceneSlice {
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
}

const initialUIState = {
    primaryMode: "historia" as EditorPrimaryMode,
    secondaryMode: getDefaultSecondaryMode("historia") as EditorSecondaryMode,
    isDirty: false,
    validationStatus: "idle" as ValidationStatus,
    errorCount: 0,
};

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

    /* Crear un proyecto vacío */
    initNewProject: (title: string) => {
        const id = generateProjectId(title);

        const newProject: Project = {
            id,
            title: title.trim(),
            description: "",
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
            isDirty: true,
            selectedNodeId: null,
            sceneMode: "creating",
        });
    },

    /* Cargar directorio completo */
    loadProjectFromDirectory: (project: Project, files: File[]) => {
        const assetFiles: Record<string, File> = {};

        for (const raw of files) {
            const anyFile = raw as any;

            const relPath: string = typeof anyFile.webkitRelativePath === "string" &&
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
        });
    },
    /* Cambiar título del proyecto */
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

    /* Seleccionar modo principal */
    setPrimaryMode: (mode: EditorPrimaryMode) => {
        set((state) => ({
            ...state,
            primaryMode: mode,
            secondaryMode: getDefaultSecondaryMode(mode),
        }));
    },

    /* Seleccionar modo secundario */
    setSecondaryMode: (mode: EditorSecondaryMode) => {
        set((state) => ({
            ...state,
            secondaryMode: mode,
        }));
    },

    /* Marcar como guardado */
    markSaved: () => {
        set((state) => ({
            ...state,
            isDirty: false,
        }));
    },

    /* Estado de validación */
    setValidationResult: (status: ValidationStatus, errorCount: number) => {
        set((state) => ({
            ...state,
            validationStatus: status,
            errorCount,
        }));
    },

    /* Reset completo */
    resetEditor: () => {
        set({
            project: null,
            ...initialUIState,
            selectedNodeId: null,
            sceneMode: "creating",
        });
    },

    /* Guardar un fichero */
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

    /* Quitar la bandera de nodo inicial de todos los nodos */
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
}));