import { create } from "zustand";
import type { Project, ID } from "@/domain/types";
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

    initNewProject: (title: string) => void;
    loadProject: (project: Project) => void;
    updateProjectTitle: (title: string) => void;
    setPrimaryMode: (mode: EditorPrimaryMode) => void;
    setSecondaryMode: (mode: EditorSecondaryMode) => void;
    markSaved: () => void;
    setValidationResult: (status: ValidationStatus, errorCount: number) => void;
    resetEditor: () => void;
}

function generateProjectId(title: string): ID {
    const slug = title.trim().toLowerCase().replace(/\s+/g, "-");
    const suffix = Date.now().toString(36);
    return `${slug || "aventura"}-${suffix}`;
}

const initialUIState = {
    primaryMode: "historia" as EditorPrimaryMode,
    secondaryMode: getDefaultSecondaryMode("historia") as EditorSecondaryMode,
    isDirty: false,
    validationStatus: "idle" as ValidationStatus,
    errorCount: 0,
};


export const useEditorStore = create<EditorStoreState>()((set, get) => ({
    project: null,
    ...initialUIState,

    ...createEditorSceneSlice(set, get),

    initNewProject: (title: string) => {
        const id = generateProjectId(title);
        const newProject: Project = {id, title: title.trim(), nodes: []};

        set({
            project: newProject,
            ...initialUIState,
            isDirty: true,
            selectedNodeId: null,
        });
    },

    loadProject: (project: Project) => {
        set({
            project,
            ...initialUIState,
            selectedNodeId: null,
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
        });
    },
}));