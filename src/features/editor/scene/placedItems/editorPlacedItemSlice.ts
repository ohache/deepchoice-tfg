import type { ID, InteractionRules, PlaceableState, PlacedItem, RegionShape } from "@/domain/types";
import type { PlacedItemEditorState, PlacedItemRuleChannel } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import {
  addRuleToRules, buildContext, buildDraftFromPlacedItem, buildEmptyPlacedItemDraft, defaultPlacedItemChannel, initialPlacedItemEditorState,
  rectFromGesture, removeRuleFromRules, validatePlacedItemDraftCandidate
} from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";
import { generateId } from "@/utils/id";

type Store = {
  activeLayerId: ID | null;
  placedItemEditor: PlacedItemEditorState;

  getActivePlacedItems: () => PlacedItem[];
  addPlacedItem: (placedItem: PlacedItem) => void;
  updatePlacedItem: (placedItemId: ID, patch: Partial<PlacedItem>) => void;

  selectedInteractionKind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | null;
  selectedInteractionId: ID | null;
};

export interface EditorPlacedItemsSlice {
  placedItemEditor: PlacedItemEditorState;

  setPlacedItemDraftItemId: (itemId: ID) => void;
  setPlacedItemSelection: (input: { placedItemId: ID | null; selectedChannel?: PlacedItemRuleChannel | null; selectedRuleId?: ID | null }) => void;

  clearPlacedItemEditor: () => void;
  startPlacingPlacedItem: (input: { itemId: ID; label?: string }) => void;

  setPlacedItemDraftShape: (shape: RegionShape | null) => void;
  clearPlacedItemDraftShape: () => void;
  updateDrawingPlacedItem: (pt: { x: number; y: number }) => void;
  finishDrawingPlacedItem: () => void;
  startRedrawPlacedItemShape: () => void;

  editPlacedItem: (placedItemId: ID) => void;
  cancelPlacedItemDraft: () => void;

  setPlacedItemDraftLabel: (label: string) => void;
  setPlacedItemDraftInitialState: (patch: Partial<PlaceableState>) => void;
  setPlacedItemDraftRules: (rules: InteractionRules) => void;

  addRuleToSelectedChannel: (args?: { phrase?: string }) => ID | null;
  deleteRuleFromSelectedChannel: (ruleId: ID) => void;

  validatePlacedItemDraft: () => { ok: boolean; error?: string };
  commitPlacedItemDraft: () => { ok: boolean; error?: string; placedItemId?: ID };
}

export function createEditorPlacedItemsSlice(set: (partial: Partial<Store> | ((s: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorPlacedItemsSlice {
  return {
    placedItemEditor: initialPlacedItemEditorState,

    setPlacedItemDraftItemId: (itemId) =>
      set((state) => {
        const draft = state.placedItemEditor.draft;
        if (!draft) return state;
        if (draft.itemId === itemId) return state;

        return {
          ...state,
          placedItemEditor: {
            ...state.placedItemEditor,
            draft: { ...draft, itemId },
          },
        };
      }),

    setPlacedItemSelection: (input) =>
      set((state) => ({
        ...state,
        placedItemEditor: {
          ...state.placedItemEditor,
          selection: {
            placedItemId: input.placedItemId,
            selectedChannel: input.selectedChannel ?? state.placedItemEditor.selection.selectedChannel,
            selectedRuleId: input.selectedRuleId ?? state.placedItemEditor.selection.selectedRuleId,
          },
        },
      })),

    clearPlacedItemEditor: () =>
      set((state) => ({
        ...state,
        placedItemEditor: initialPlacedItemEditorState,
      })),

    startPlacingPlacedItem: (input) =>
      set((state) => {
        if (!state.activeLayerId) return state;

        const draft = buildEmptyPlacedItemDraft(input);

        return {
          ...state,
          placedItemEditor: {
            context: buildContext(state.activeLayerId),
            mode: { type: "drawing" },
            selection: {
              placedItemId: draft.id,
              selectedChannel: defaultPlacedItemChannel(),
              selectedRuleId: null,
            },
            draft,
            drawing: null,
          },
        };
      }),

    setPlacedItemDraftShape: (shape) =>
      set((state) => {
        const draft = state.placedItemEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedItemEditor: {
            ...state.placedItemEditor,
            draft: { ...draft, shape },
          },
        };
      }),

    clearPlacedItemDraftShape: () =>
      set((state) => {
        const draft = state.placedItemEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedItemEditor: {
            ...state.placedItemEditor,
            draft: { ...draft, shape: null },
          },
        };
      }),

    updateDrawingPlacedItem: (pt) =>
      set((state) => {
        const editor = state.placedItemEditor;
        if (editor.mode.type !== "drawing" || !editor.draft) return state;

        const currentDrawing = editor.drawing;
        const nextDrawing = currentDrawing
          ? { ...currentDrawing, currentX: pt.x, currentY: pt.y }
          : { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y };

        const shape = rectFromGesture(nextDrawing);

        return {
          ...state,
          placedItemEditor: {
            ...editor,
            drawing: nextDrawing,
            draft: { ...editor.draft, shape },
          },
        };
      }),

    finishDrawingPlacedItem: () =>
      set((state) => {
        const editor = state.placedItemEditor;
        if (editor.mode.type !== "drawing" || !editor.draft) return state;

        return {
          ...state,
          placedItemEditor: {
            ...editor,
            mode: { type: "editing", placedItemId: editor.draft.id },
            drawing: null,
          },
        };
      }),

    startRedrawPlacedItemShape: () =>
      set((state) => {
        const editor = state.placedItemEditor;
        if (!editor.draft) return state;

        return {
          ...state,
          placedItemEditor: {
            ...editor,
            mode: { type: "drawing" },
            drawing: null,
            draft: { ...editor.draft, shape: null },
            selection: {
              ...editor.selection,
              placedItemId: editor.draft.id,
              selectedRuleId: null,
            },
          },
        };
      }),

    editPlacedItem: (placedItemId) =>
      set((state) => {
        if (!state.activeLayerId) return state;

        const placedItem = (state.getActivePlacedItems() ?? []).find((item) => item.id === placedItemId);
        if (!placedItem) return state;

        return {
          ...state,
          placedItemEditor: {
            context: buildContext(state.activeLayerId),
            mode: { type: "editing", placedItemId },
            selection: {
              placedItemId,
              selectedChannel: defaultPlacedItemChannel(),
              selectedRuleId: null,
            },
            draft: buildDraftFromPlacedItem(placedItem),
            drawing: null,
          },
        };
      }),

    cancelPlacedItemDraft: () =>
      set((state) => ({
        ...state,
        placedItemEditor: initialPlacedItemEditorState,
      })),

    setPlacedItemDraftLabel: (label) =>
      set((state) => {
        const draft = state.placedItemEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedItemEditor: {
            ...state.placedItemEditor,
            draft: { ...draft, label },
          },
        };
      }),

    setPlacedItemDraftInitialState: (patch) =>
      set((state) => {
        const draft = state.placedItemEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedItemEditor: {
            ...state.placedItemEditor,
            draft: {
              ...draft,
              initialState: { ...draft.initialState, ...patch },
            },
          },
        };
      }),

    setPlacedItemDraftRules: (rules) =>
      set((state) => {
        const draft = state.placedItemEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedItemEditor: {
            ...state.placedItemEditor,
            draft: { ...draft, rules },
          },
        };
      }),

    addRuleToSelectedChannel: (args) => {
      const state = get();
      const draft = state.placedItemEditor.draft;
      if (!draft) return null;

      const channel = state.placedItemEditor.selection.selectedChannel ?? defaultPlacedItemChannel();
      const ruleId = generateId.rule();

      const nextRules = addRuleToRules(draft.rules, channel, ruleId, args?.phrase);

      set((storeState) => ({
        ...storeState,
        placedItemEditor: {
          ...storeState.placedItemEditor,
          draft: storeState.placedItemEditor.draft ? { ...storeState.placedItemEditor.draft, rules: nextRules } : null,
          selection: {
            ...storeState.placedItemEditor.selection,
            selectedChannel: channel,
            selectedRuleId: ruleId,
          },
        },
      }));

      return ruleId;
    },

    deleteRuleFromSelectedChannel: (ruleId) =>
      set((state) => {
        const draft = state.placedItemEditor.draft;
        if (!draft) return state;

        const channel = state.placedItemEditor.selection.selectedChannel ?? defaultPlacedItemChannel();
        const nextRules = removeRuleFromRules(draft.rules, channel, ruleId);
        const shouldClearSelected = state.placedItemEditor.selection.selectedRuleId === ruleId;

        return {
          ...state,
          placedItemEditor: {
            ...state.placedItemEditor,
            draft: { ...draft, rules: nextRules },
            selection: {
              ...state.placedItemEditor.selection,
              selectedRuleId: shouldClearSelected ? null : state.placedItemEditor.selection.selectedRuleId,
            },
          },
        };
      }),

    validatePlacedItemDraft: () => {
      const state = get();
      const result = validatePlacedItemDraftCandidate(
        state.placedItemEditor.draft,
        state.getActivePlacedItems(),
      );

      if (!result.ok) return { ok: false, error: result.error };

      return { ok: true };
    },

    commitPlacedItemDraft: () => {
      const state = get();
      const draft = state.placedItemEditor.draft;

      if (!draft) return { ok: false, code: "missing_draft", error: "No hay borrador de PlacedItem." } as const;

      const result = validatePlacedItemDraftCandidate(draft, state.getActivePlacedItems());

      if (!result.ok) return { ok: false, code: "invalid_draft", error: result.error } as const;

      const candidate = result.candidate;
      const exists = (state.getActivePlacedItems() ?? []).some((item) => item.id === candidate.id);

      if (exists) state.updatePlacedItem(candidate.id, candidate);
      else state.addPlacedItem(candidate);

      set((storeState) => ({
        ...storeState,
        placedItemEditor: initialPlacedItemEditorState,
      }));

      return { ok: true, placedItemId: candidate.id } as const;
    },
  };
}