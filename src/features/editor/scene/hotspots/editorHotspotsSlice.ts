import type { Hotspot, ID, InteractionRules, Node, PlaceableState, RegionShape } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import type { CommitHotspotDraftResult, HotspotEditorState } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import { buildContext, buildDraftFromHotspot, buildEmptyHotspotDraft, defaultHotspotChannel, initialHotspotEditorState,
 validateHotspotDraftCandidate } from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";

type EditorStoreLike = {
  nodeDraft: Node | null;
  activeLayerId: ID | null;
  hotspotEditor: HotspotEditorState;

  getActiveHotspots: () => Hotspot[];
  addHotspot: (hotspot: Hotspot) => void;
  updateHotspot: (hotspotId: ID, patch: Partial<Hotspot>) => void;
  requestDelete: (target: DeleteTarget) => void;
};

export interface EditorHotspotsSlice {
  hotspotEditor: HotspotEditorState;
  startDrawingHotspot: () => void;
  setHotspotDraftShape: (shape: RegionShape | null) => void;
  removeHotspotVar: (varId: ID, options?: { withConfirmation?: boolean }) => void;
  finishDrawingHotspot: () => void;
  startRedrawHotspotShape: () => void;
  editHotspot: (hotspotId: ID) => void;
  cancelHotspotDraft: () => void;
  setHotspotDraftLabel: (label: string) => void;
  setHotspotDraftInitialState: (patch: Partial<PlaceableState>) => void;
  setHotspotDraftVars: (vars: Hotspot["vars"]) => void;
  setHotspotDraftRules: (rules: InteractionRules) => void;
  commitHotspotDraft: () => CommitHotspotDraftResult;
}


export function createEditorHotspotsSlice(set: (partial: Partial<EditorStoreLike> | ((s: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorHotspotsSlice {
  return {
    hotspotEditor: initialHotspotEditorState,

    startDrawingHotspot: () =>
      set((state) => {
        if (!state.activeLayerId) return state;

        const draft = buildEmptyHotspotDraft();

        return {
          ...state,
          hotspotEditor: {
            context: buildContext(state.activeLayerId),
            mode: { type: "drawing" },
            selection: { hotspotId: draft.id, selectedChannel: defaultHotspotChannel(), selectedRuleId: null },
            draft,
            drawing: null,
          },
        };
      }),

    setHotspotDraftShape: (shape) =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          hotspotEditor: { ...state.hotspotEditor, draft: { ...draft, shape } },
        };
      }),

    finishDrawingHotspot: () =>
      set((state) => {
        const editor = state.hotspotEditor;
        if (editor.mode.type !== "drawing" || !editor.draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...editor,
            mode: { type: "editing", hotspotId: editor.draft.id },
            drawing: null,
          },
        };
      }),

    startRedrawHotspotShape: () =>
      set((state) => {
        const editor = state.hotspotEditor;
        if (!editor.draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...editor,
            mode: { type: "drawing" },
            drawing: null,
            draft: { ...editor.draft, shape: null },
            selection: {
              ...editor.selection,
              hotspotId: editor.draft.id,
              selectedRuleId: null,
            },
          },
        };
      }),

    editHotspot: (hotspotId) =>
      set((state) => {
        if (!state.activeLayerId) return state;

        const hotspot = (state.getActiveHotspots() ?? []).find((item) => item.id === hotspotId);
        if (!hotspot) return state;

        return {
          ...state,
          hotspotEditor: {
            context: buildContext(state.activeLayerId),
            mode: { type: "editing", hotspotId },
            selection: { hotspotId, selectedChannel: defaultHotspotChannel(), selectedRuleId: null },
            draft: buildDraftFromHotspot(hotspot),
            drawing: null,
          },
        };
      }),

    cancelHotspotDraft: () =>
      set((state) => ({
        ...state,
        hotspotEditor: initialHotspotEditorState,
      })),

    setHotspotDraftLabel: (label) =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...state.hotspotEditor,
            draft: { ...draft, label },
          },
        };
      }),

    setHotspotDraftInitialState: (patch) =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...state.hotspotEditor,
            draft: {
              ...draft,
              initialState: { ...draft.initialState, ...patch },
            },
          },
        };
      }),

    setHotspotDraftVars: (vars) =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...state.hotspotEditor,
            draft: {
              ...draft, vars,
            },
          },
        };
      }),

    removeHotspotVar: (varId, options) => {
      const state = get();

      const draft = state.hotspotEditor.draft;
      if (!draft) return;

      const savedHotspot = state.getActiveHotspots().find((hotspot) => hotspot.id === draft.id);

      const existsInSavedHotspot = Boolean(savedHotspot?.vars.some((variable) => variable.id === varId));

      if (existsInSavedHotspot && options?.withConfirmation) {
        const nodeId = state.nodeDraft?.id;
        const layerId = state.hotspotEditor.context?.layerId ?? state.activeLayerId;
        const hotspotId = draft.id;

        if (!nodeId || !layerId || !hotspotId) return;

        state.requestDelete({ kind: "hotspotVar", nodeId, layerId, hotspotId, varId });

        return;
      }

      set((currentState) => {
        const currentDraft = currentState.hotspotEditor.draft;
        if (!currentDraft) return currentState;

        const nextVars = currentDraft.vars.filter((variable) => variable.id !== varId);

        if (nextVars.length === currentDraft.vars.length) return currentState;

        return {
          ...currentState,
          hotspotEditor: {
            ...currentState.hotspotEditor,
            draft: {
              ...currentDraft,
              vars: nextVars,
            },
          },
        };
      });
    },

    setHotspotDraftRules: (rules) =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...state.hotspotEditor,
            draft: { ...draft, rules },
          },
        };
      }),

    commitHotspotDraft: () => {
      const state = get();
      const draft = state.hotspotEditor.draft;

      if (!draft) return { ok: false, code: "missing_draft", error: "No hay borrador de hotspot." };

      const result = validateHotspotDraftCandidate(draft);

      if (!result.ok) return { ok: false, code: "invalid_draft", error: result.error };
      

      const candidate = result.candidate;
      const exists = state.getActiveHotspots().some((hotspot) => hotspot.id === candidate.id);

      if (exists) state.updateHotspot(candidate.id, candidate);
      else state.addHotspot(candidate);

      set((storeState) => ({
        ...storeState,
        hotspotEditor: initialHotspotEditorState,
      }));

      return { ok: true, hotspotId: candidate.id };
    },
  };
}