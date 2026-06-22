import type { ID, PlacedPlayer, PlacedPlayerState, RegionShape } from "@/domain/types";
import type { CommitPlacedPlayerDraftResult, PlacedPlayerEditorState } from "@/features/editor/scene/placedPlayers/placedPlayerEditorTypes";
import {
  buildContext, buildDraftFromPlacedPlayer, buildEmptyPlacedPlayerDraft, initialPlacedPlayerEditorState,
  validatePlacedPlayerDraftCandidate
} from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";

type EditorStoreLike = {
  activeLayerId: ID | null;
  placedPlayerEditor: PlacedPlayerEditorState;

  getActivePlacedPlayers: () => PlacedPlayer[];
  upsertPlacedPlayer: (placedPlayer: PlacedPlayer) => void;
};

export interface EditorPlacedPlayersSlice {
  placedPlayerEditor: PlacedPlayerEditorState;
  startPlacingPlacedPlayer: (input: { playerId: ID; initialImageId: ID }) => void;
  setPlacedPlayerDraftPlayerId: (playerId: ID) => void;
  setPlacedPlayerDraftInitialImageId: (initialImageId: ID) => void;
  setPlacedPlayerDraftShape: (shape: RegionShape | null) => void;
  finishDrawingPlacedPlayer: () => void;
  startRedrawPlacedPlayerShape: () => void;
  editPlacedPlayer: (playerId: ID) => void;
  cancelPlacedPlayerDraft: () => void;
  setPlacedPlayerDraftInitialState: (patch: Partial<PlacedPlayerState>) => void;
  commitPlacedPlayerDraft: () => CommitPlacedPlayerDraftResult;
}

export function createEditorPlacedPlayersSlice(set: (partial: Partial<EditorStoreLike> | ((s: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorPlacedPlayersSlice {
  return {
    placedPlayerEditor: initialPlacedPlayerEditorState,

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

    commitPlacedPlayerDraft: () => {
      const state = get();
      const draft = state.placedPlayerEditor.draft;

      if (!draft) return { ok: false, code: "missing_draft", error: "No hay borrador de placedPlayer." };

      const result = validatePlacedPlayerDraftCandidate(draft);

      if (!result.ok)  return { ok: false, code: "invalid_draft", error: result.error };
      

      const candidate = result.candidate;

      state.upsertPlacedPlayer(candidate);

      set((storeState) => ({
        ...storeState,
        placedPlayerEditor: initialPlacedPlayerEditorState,
      }));

      return { ok: true, playerId: candidate.playerId };
    },
  };
}