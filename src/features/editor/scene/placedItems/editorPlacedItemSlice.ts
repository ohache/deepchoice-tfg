import type { ID, InteractionRules, PlaceableState, ItemInstance, RegionShape } from "@/domain/types";
import type { CommitPlacedItemDraftResult, PlacedItemEditorState } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import { buildContext, buildDraftFromPlacedItem, buildEmptyPlacedItemDraft, defaultPlacedItemChannel, initialPlacedItemEditorState,
  validatePlacedItemDraftCandidate } from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";

type EditorStoreLike = {
  activeLayerId: ID | null;
  placedItemEditor: PlacedItemEditorState;

  getActivePlacedItems: () => ItemInstance[];
  addPlacedItem: (placedItem: ItemInstance) => void;
  updatePlacedItem: (placedItemId: ID, patch: Partial<ItemInstance>) => void;
};

export interface EditorPlacedItemsSlice {
  placedItemEditor: PlacedItemEditorState;
  setPlacedItemDraftItemId: (itemId: ID) => void;
  startPlacingPlacedItem: (input: { itemId: ID; label?: string }) => void;
  setPlacedItemDraftShape: (shape: RegionShape | null) => void;
  finishDrawingPlacedItem: () => void;
  startRedrawPlacedItemShape: () => void;
  editPlacedItem: (placedItemId: ID) => void;
  cancelPlacedItemDraft: () => void;
  setPlacedItemDraftLabel: (label: string) => void;
  setPlacedItemDraftInitialState: (patch: Partial<PlaceableState>) => void;
  setPlacedItemDraftRules: (rules: InteractionRules) => void;
  commitPlacedItemDraft: () => CommitPlacedItemDraftResult;
}

export function createEditorPlacedItemsSlice(
  set: (partial: Partial<EditorStoreLike> | ((s: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorPlacedItemsSlice {
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
              placedItemId: draft.itemInstanceId,
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
            draft: {
              ...draft,
              placement: {
                ...draft.placement,
                shape,
              },
            },
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
            mode: { type: "editing", placedItemId: editor.draft.itemInstanceId },
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
            draft: {
              ...editor.draft,
              placement: {
                ...editor.draft.placement,
                shape: null,
              },
            },
            selection: {
              ...editor.selection,
              placedItemId: editor.draft.itemInstanceId,
              selectedRuleId: null,
            },
          },
        };
      }),

    editPlacedItem: (placedItemId) =>
      set((state) => {
        if (!state.activeLayerId) return state;

        const placedItem = (state.getActivePlacedItems() ?? []).find(
          (item) => item.itemInstanceId === placedItemId,
        );

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
              placement: {
                ...draft.placement,
                initialState: {
                  ...draft.placement.initialState,
                  ...patch,
                },
              },
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

    commitPlacedItemDraft: () => {
      const state = get();
      const draft = state.placedItemEditor.draft;

      if (!draft) return { ok: false, code: "missing_draft", error: "No hay borrador de placedItem." };

      const result = validatePlacedItemDraftCandidate(draft, state.getActivePlacedItems());

      if (!result.ok) return { ok: false, code: "invalid_draft", error: result.error };

      const candidate = result.candidate;

      const exists = state.getActivePlacedItems().some((item) => item.itemInstanceId === candidate.itemInstanceId);

      if (exists) state.updatePlacedItem(candidate.itemInstanceId, candidate);
      else state.addPlacedItem(candidate);

      set((storeState) => ({
        ...storeState,
        placedItemEditor: initialPlacedItemEditorState,
      }));

      return { ok: true, placedItemId: candidate.itemInstanceId };
    },
  };
}