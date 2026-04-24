import type { ID, InteractionRules, PlaceableState, PlacedNpc, RegionShape } from "@/domain/types";
import type { PlacedNpcEditorState, PlacedNpcRuleChannel } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import {
  addRuleToRules, buildContext, buildDraftFromPlacedNpc, buildEmptyPlacedNpcDraft, defaultPlacedNpcChannel, initialPlacedNpcEditorState,
  rectFromGesture, removeRuleFromRules, validatePlacedNpcDraftCandidate
} from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";
import { generateId } from "@/utils/id";

type Store = {
  activeLayerId: ID | null;
  placedNpcEditor: PlacedNpcEditorState;

  getActivePlacedNpcs: () => PlacedNpc[];
  upsertPlacedNpc: (placedNpc: PlacedNpc) => void;
  selectedInteractionKind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | null;
  selectedInteractionId: ID | null;
};

export interface EditorPlacedNpcsSlice {
  placedNpcEditor: PlacedNpcEditorState;

  setPlacedNpcSelection: (input: { npcId: ID | null; selectedChannel?: PlacedNpcRuleChannel | null; selectedRuleId?: ID | null }) => void;

  clearPlacedNpcEditor: () => void;
  startPlacingPlacedNpc: (input: { npcId: ID }) => void;

  setPlacedNpcDraftNpcId: (npcId: ID) => void;
  setPlacedNpcDraftShape: (shape: RegionShape | null) => void;
  clearPlacedNpcDraftShape: () => void;
  updateDrawingPlacedNpc: (pt: { x: number; y: number }) => void;
  finishDrawingPlacedNpc: () => void;
  startRedrawPlacedNpcShape: () => void;

  editPlacedNpc: (npcId: ID) => void;
  cancelPlacedNpcDraft: () => void;

  setPlacedNpcDraftInitialState: (patch: Partial<PlaceableState>) => void;
  setPlacedNpcDraftRules: (rules: InteractionRules) => void;

  addRuleToSelectedChannel: (args?: { phrase?: string }) => ID | null;
  deleteRuleFromSelectedChannel: (ruleId: ID) => void;

  validatePlacedNpcDraft: () => { ok: boolean; error?: string };
  commitPlacedNpcDraft: () => { ok: boolean; error?: string; npcId?: ID };
}

export function createEditorPlacedNpcsSlice(set: (partial: Partial<Store> | ((s: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorPlacedNpcsSlice {
  return {
    placedNpcEditor: initialPlacedNpcEditorState,

    setPlacedNpcSelection: (input) =>
      set((state) => ({
        ...state,
        placedNpcEditor: {
          ...state.placedNpcEditor,
          selection: {
            npcId: input.npcId,
            selectedChannel: input.selectedChannel ?? state.placedNpcEditor.selection.selectedChannel,
            selectedRuleId: input.selectedRuleId ?? state.placedNpcEditor.selection.selectedRuleId,
          },
        },
      })),

    clearPlacedNpcEditor: () =>
      set((state) => ({
        ...state,
        placedNpcEditor: initialPlacedNpcEditorState,
      })),

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

    clearPlacedNpcDraftShape: () =>
      set((state) => {
        const draft = state.placedNpcEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedNpcEditor: {
            ...state.placedNpcEditor,
            draft: { ...draft, shape: null },
          },
        };
      }),

    updateDrawingPlacedNpc: (pt) =>
      set((state) => {
        const editor = state.placedNpcEditor;
        if (editor.mode.type !== "drawing" || !editor.draft) return state;

        const currentDrawing = editor.drawing;
        const nextDrawing = currentDrawing
          ? { ...currentDrawing, currentX: pt.x, currentY: pt.y }
          : { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y };

        const shape = rectFromGesture(nextDrawing);

        return {
          ...state,
          placedNpcEditor: {
            ...editor,
            drawing: nextDrawing,
            draft: { ...editor.draft, shape },
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

    addRuleToSelectedChannel: (args) => {
      const state = get();
      const draft = state.placedNpcEditor.draft;
      if (!draft) return null;

      const channel = state.placedNpcEditor.selection.selectedChannel ?? defaultPlacedNpcChannel();
      const ruleId = generateId.rule();
      const nextRules = addRuleToRules(draft.rules, channel, ruleId, args?.phrase);

      set((storeState) => ({
        ...storeState,
        placedNpcEditor: {
          ...storeState.placedNpcEditor,
          draft: storeState.placedNpcEditor.draft ? { ...storeState.placedNpcEditor.draft, rules: nextRules } : null,
          selection: {
            ...storeState.placedNpcEditor.selection,
            selectedChannel: channel,
            selectedRuleId: ruleId,
          },
        },
      }));

      return ruleId;
    },

    deleteRuleFromSelectedChannel: (ruleId) =>
      set((state) => {
        const draft = state.placedNpcEditor.draft;
        if (!draft) return state;

        const channel = state.placedNpcEditor.selection.selectedChannel ?? defaultPlacedNpcChannel();
        const nextRules = removeRuleFromRules(draft.rules, channel, ruleId);
        const shouldClearSelected = state.placedNpcEditor.selection.selectedRuleId === ruleId;

        return {
          ...state,
          placedNpcEditor: {
            ...state.placedNpcEditor,
            draft: { ...draft, rules: nextRules },
            selection: {
              ...state.placedNpcEditor.selection,
              selectedRuleId: shouldClearSelected ? null : state.placedNpcEditor.selection.selectedRuleId,
            },
          },
        };
      }),

    validatePlacedNpcDraft: () => {
      const state = get();
      const result = validatePlacedNpcDraftCandidate(state.placedNpcEditor.draft);

      if (!result.ok) return { ok: false, error: result.error };

      return { ok: true };
    },

    commitPlacedNpcDraft: () => {
      const state = get();
      const draft = state.placedNpcEditor.draft;

      if (!draft) return { ok: false, code: "missing_draft", error: "No hay borrador de PlacedNpc." } as const;

      const result = validatePlacedNpcDraftCandidate(draft);

      if (!result.ok) return { ok: false, code: "invalid_draft", error: result.error } as const;

      state.upsertPlacedNpc(result.candidate);

      set((storeState) => ({
        ...storeState,
        placedNpcEditor: initialPlacedNpcEditorState,
      }));

      return { ok: true, npcId: result.candidate.npcId } as const;
    },
  };
}