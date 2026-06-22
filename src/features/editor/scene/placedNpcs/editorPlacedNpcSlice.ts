import type { ID, InteractionRules, PlaceableState, PlacedNpc, RegionShape } from "@/domain/types";
import type { CommitPlacedNpcDraftResult, PlacedNpcEditorState } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import { buildContext, buildDraftFromPlacedNpc, buildEmptyPlacedNpcDraft, defaultPlacedNpcChannel, initialPlacedNpcEditorState,
validatePlacedNpcDraftCandidate } from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";

type EditorStoreLike = {
  activeLayerId: ID | null;
  placedNpcEditor: PlacedNpcEditorState;

  getActivePlacedNpcs: () => PlacedNpc[];
  upsertPlacedNpc: (placedNpc: PlacedNpc) => void;
};

export interface EditorPlacedNpcsSlice {
  placedNpcEditor: PlacedNpcEditorState;
  startPlacingPlacedNpc: (input: { npcId: ID }) => void;
  setPlacedNpcDraftNpcId: (npcId: ID) => void;
  setPlacedNpcDraftShape: (shape: RegionShape | null) => void;
  finishDrawingPlacedNpc: () => void;
  startRedrawPlacedNpcShape: () => void;
  editPlacedNpc: (npcId: ID) => void;
  cancelPlacedNpcDraft: () => void;
  setPlacedNpcDraftInitialState: (patch: Partial<PlaceableState>) => void;
  setPlacedNpcDraftRules: (rules: InteractionRules) => void;
  commitPlacedNpcDraft: () => CommitPlacedNpcDraftResult;
}

export function createEditorPlacedNpcsSlice(set: (partial: Partial<EditorStoreLike> | ((s: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorPlacedNpcsSlice {
  return {
    placedNpcEditor: initialPlacedNpcEditorState,

    startPlacingPlacedNpc: (input) =>
      set((state) => {
        if (!state.activeLayerId) return state;

        const draft = buildEmptyPlacedNpcDraft(input);

        return {
          ...state,
          placedNpcEditor: {
            context: buildContext(state.activeLayerId),
            mode: { type: "drawing" },
            selection: {
              npcId: draft.npcId,
              selectedChannel: defaultPlacedNpcChannel(),
              selectedRuleId: null,
            },
            draft,
            drawing: null,
          },
        };
      }),

    setPlacedNpcDraftNpcId: (npcId) =>
      set((state) => {
        const draft = state.placedNpcEditor.draft;
        if (!draft) return state;
        if (draft.npcId === npcId) return state;

        return {
          ...state,
          placedNpcEditor: {
            ...state.placedNpcEditor,
            draft: { ...draft, npcId },
          },
        };
      }),

    setPlacedNpcDraftShape: (shape) =>
      set((state) => {
        const draft = state.placedNpcEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedNpcEditor: {
            ...state.placedNpcEditor,
            draft: { ...draft, shape },
          },
        };
      }),

    finishDrawingPlacedNpc: () =>
      set((state) => {
        const editor = state.placedNpcEditor;
        if (editor.mode.type !== "drawing" || !editor.draft) return state;

        return {
          ...state,
          placedNpcEditor: {
            ...editor,
            mode: { type: "editing", npcId: editor.draft.npcId },
            drawing: null,
          },
        };
      }),

    startRedrawPlacedNpcShape: () =>
      set((state) => {
        const editor = state.placedNpcEditor;
        if (!editor.draft) return state;

        return {
          ...state,
          placedNpcEditor: {
            ...editor,
            mode: { type: "drawing" },
            drawing: null,
            draft: { ...editor.draft, shape: null },
            selection: {
              ...editor.selection,
              npcId: editor.draft.npcId,
              selectedRuleId: null,
            },
          },
        };
      }),

    editPlacedNpc: (npcId) =>
      set((state) => {
        if (!state.activeLayerId) return state;

        const placedNpc = (state.getActivePlacedNpcs() ?? []).find((npc) => npc.npcId === npcId);
        if (!placedNpc) return state;

        return {
          ...state,
          placedNpcEditor: {
            context: buildContext(state.activeLayerId),
            mode: { type: "editing", npcId },
            selection: {
              npcId,
              selectedChannel: defaultPlacedNpcChannel(),
              selectedRuleId: null,
            },
            draft: buildDraftFromPlacedNpc(placedNpc),
            drawing: null,
          },
        };
      }),

    cancelPlacedNpcDraft: () =>
      set((state) => ({
        ...state,
        placedNpcEditor: initialPlacedNpcEditorState,
      })),

    setPlacedNpcDraftInitialState: (patch) =>
      set((state) => {
        const draft = state.placedNpcEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedNpcEditor: {
            ...state.placedNpcEditor,
            draft: {
              ...draft,
              initialState: { ...draft.initialState, ...patch },
            },
          },
        };
      }),

    setPlacedNpcDraftRules: (rules) =>
      set((state) => {
        const draft = state.placedNpcEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedNpcEditor: {
            ...state.placedNpcEditor,
            draft: { ...draft, rules },
          },
        };
      }),

    commitPlacedNpcDraft: () => {
      const state = get();
      const draft = state.placedNpcEditor.draft;

      if (!draft) return { ok: false, code: "missing_draft", error: "No hay borrador de placedNpc." };

      const result = validatePlacedNpcDraftCandidate(draft);

      if (!result.ok)  return { ok: false, code: "invalid_draft", error: result.error };

      const candidate = result.candidate;

      state.upsertPlacedNpc(candidate);

      set((storeState) => ({
        ...storeState,
        placedNpcEditor: initialPlacedNpcEditorState,
      }));

      return { ok: true, npcId: candidate.npcId };
    },
  };
}