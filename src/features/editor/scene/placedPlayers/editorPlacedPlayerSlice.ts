import type { ID, PlacedPlayer, PlacedPlayerState, RegionShape } from "@/domain/types";
import type { PlacedPlayerEditorState } from "@/features/editor/scene/placedPlayers/placedPlayerEditorTypes";
import {
  buildContext, buildDraftFromPlacedPlayer, buildEmptyPlacedPlayerDraft, buildPlacedPlayerCandidateFromDraft,
  initialPlacedPlayerEditorState, rectFromGesture, validatePlacedPlayerDraftCandidate
} from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";

type Store = {
  activeLayerId: ID | null;
  placedPlayerEditor: PlacedPlayerEditorState;

  getActivePlacedPlayers: () => PlacedPlayer[];
  upsertPlacedPlayer: (placedPlayer: PlacedPlayer) => void;
  selectedInteractionKind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | null;
  selectedInteractionId: ID | null;
};

export interface EditorPlacedPlayersSlice {
  placedPlayerEditor: PlacedPlayerEditorState;

  setPlacedPlayerSelection: (input: { playerId: ID | null }) => void;

  clearPlacedPlayerEditor: () => void;
  startPlacingPlacedPlayer: (input: { playerId: ID; initialImageId: ID }) => void;

  setPlacedPlayerDraftPlayerId: (playerId: ID) => void;
  setPlacedPlayerDraftInitialImageId: (initialImageId: ID) => void;
  setPlacedPlayerDraftShape: (shape: RegionShape | null) => void;
  clearPlacedPlayerDraftShape: () => void;
  updateDrawingPlacedPlayer: (pt: { x: number; y: number }) => void;
  finishDrawingPlacedPlayer: () => void;
  startRedrawPlacedPlayerShape: () => void;

  editPlacedPlayer: (playerId: ID) => void;
  cancelPlacedPlayerDraft: () => void;

  setPlacedPlayerDraftInitialState: (patch: Partial<PlacedPlayerState>) => void;

  validatePlacedPlayerDraft: () => { ok: boolean; error?: string };
  commitPlacedPlayerDraft: () => { ok: boolean; error?: string; playerId?: ID };
}

export function createEditorPlacedPlayersSlice(set: (partial: Partial<Store> | ((s: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorPlacedPlayersSlice {
  return {
    placedPlayerEditor: initialPlacedPlayerEditorState,

    setPlacedPlayerSelection: (input) =>
      set((state) => ({
        ...state,
        placedPlayerEditor: {
          ...state.placedPlayerEditor,
          selection: { playerId: input.playerId },
        },
      })),

    clearPlacedPlayerEditor: () =>
      set((state) => ({
        ...state,
        placedPlayerEditor: initialPlacedPlayerEditorState,
      })),

    startPlacingPlacedPlayer: (input) =>
      set((state) => {
        if (!state.activeLayerId) return state;

        const draft = buildEmptyPlacedPlayerDraft(input);

        return {
          ...state,
          placedPlayerEditor: {
            context: buildContext(state.activeLayerId),
            mode: { type: "drawing" },
            selection: { playerId: draft.playerId },
            draft,
            drawing: null,
          },
        };
      }),

    setPlacedPlayerDraftPlayerId: (playerId) =>
      set((state) => {
        const draft = state.placedPlayerEditor.draft;
        if (!draft) return state;
        if (draft.playerId === playerId) return state;

        return {
          ...state,
          placedPlayerEditor: {
            ...state.placedPlayerEditor,
            draft: { ...draft, playerId },
          },
        };
      }),

    setPlacedPlayerDraftInitialImageId: (initialImageId) =>
      set((state) => {
        const draft = state.placedPlayerEditor.draft;
        if (!draft) return state;
        if (draft.initialImageId === initialImageId) return state;

        return {
          ...state,
          placedPlayerEditor: {
            ...state.placedPlayerEditor,
            draft: { ...draft, initialImageId },
          },
        };
      }),

    setPlacedPlayerDraftShape: (shape) =>
      set((state) => {
        const draft = state.placedPlayerEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedPlayerEditor: {
            ...state.placedPlayerEditor,
            draft: { ...draft, shape },
          },
        };
      }),

    clearPlacedPlayerDraftShape: () =>
      set((state) => {
        const draft = state.placedPlayerEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedPlayerEditor: {
            ...state.placedPlayerEditor,
            draft: { ...draft, shape: null },
          },
        };
      }),

    updateDrawingPlacedPlayer: (pt) =>
      set((state) => {
        const editor = state.placedPlayerEditor;
        if (editor.mode.type !== "drawing" || !editor.draft) return state;

        const currentDrawing = editor.drawing;
        const nextDrawing = currentDrawing
          ? { ...currentDrawing, currentX: pt.x, currentY: pt.y }
          : { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y };

        const shape = rectFromGesture(nextDrawing);

        return {
          ...state,
          placedPlayerEditor: {
            ...editor,
            drawing: nextDrawing,
            draft: { ...editor.draft, shape },
          },
        };
      }),

    finishDrawingPlacedPlayer: () =>
      set((state) => {
        const editor = state.placedPlayerEditor;
        if (editor.mode.type !== "drawing" || !editor.draft) return state;

        return {
          ...state,
          placedPlayerEditor: {
            ...editor,
            mode: { type: "editing", playerId: editor.draft.playerId },
            drawing: null,
          },
        };
      }),

    startRedrawPlacedPlayerShape: () =>
      set((state) => {
        const editor = state.placedPlayerEditor;
        if (!editor.draft) return state;

        return {
          ...state,
          placedPlayerEditor: {
            ...editor,
            mode: { type: "drawing" },
            drawing: null,
            draft: { ...editor.draft, shape: null },
            selection: { playerId: editor.draft.playerId },
          },
        };
      }),

    editPlacedPlayer: (playerId) =>
      set((state) => {
        if (!state.activeLayerId) return state;

        const placedPlayer = (state.getActivePlacedPlayers() ?? []).find((player) => player.playerId === playerId,);
        if (!placedPlayer) return state;

        return {
          ...state,
          placedPlayerEditor: {
            context: buildContext(state.activeLayerId),
            mode: { type: "editing", playerId },
            selection: { playerId },
            draft: buildDraftFromPlacedPlayer(placedPlayer),
            drawing: null,
          },
        };
      }),

    cancelPlacedPlayerDraft: () =>
      set((state) => ({
        ...state,
        placedPlayerEditor: initialPlacedPlayerEditorState,
      })),

    setPlacedPlayerDraftInitialState: (patch) =>
      set((state) => {
        const draft = state.placedPlayerEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          placedPlayerEditor: {
            ...state.placedPlayerEditor,
            draft: {
              ...draft,
              initialState: { ...draft.initialState, ...patch },
            },
          },
        };
      }),

    validatePlacedPlayerDraft: () => {
      const state = get();
      const result = validatePlacedPlayerDraftCandidate(state.placedPlayerEditor.draft);

      if (!result.ok) return { ok: false, error: result.error };

      return { ok: true };
    },

    commitPlacedPlayerDraft: () => {
      const state = get();
      const draft = state.placedPlayerEditor.draft;

      if (!draft) return { ok: false, code: "missing_draft", error: "No hay borrador de PlacedPlayer." } as const;
  
      const result = validatePlacedPlayerDraftCandidate(draft);

      if (!result.ok) return { ok: false, code: "invalid_draft", error: result.error } as const;

      const candidate = buildPlacedPlayerCandidateFromDraft({ ...draft, shape: draft.shape! });

      state.upsertPlacedPlayer(candidate);

      set((storeState) => ({
        ...storeState,
        placedPlayerEditor: initialPlacedPlayerEditorState,
      }));

      return { ok: true, playerId: candidate.playerId } as const;
    },
  };
}