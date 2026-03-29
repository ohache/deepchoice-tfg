import type { ID, PlacedPlayer, PlacedPlayerState, RegionShape } from "@/domain/types";
import type { PlacedPlayerDraft, PlacedPlayerEditorContext, PlacedPlayerEditorState } from "@/features/editor/scene/placedPlayers/placedPlayerEditorTypes";
import { validatePlacedPlayer } from "@/features/editor/scene/placedPlayers/placedPlayerValidator";

export const initialPlacedPlayerEditorState: PlacedPlayerEditorState = {
  context: null,
  mode: { type: "idle" },
  selection: { playerId: null },
  draft: null,
  drawing: null,
};

function defaultInitialState(): PlacedPlayerState {
  return { visible: true };
}

function rectFromGesture(g: { startX: number; startY: number; currentX: number; currentY: number }): RegionShape {
  const x = Math.min(g.startX, g.currentX);
  const y = Math.min(g.startY, g.currentY);
  const w = Math.abs(g.currentX - g.startX);
  const h = Math.abs(g.currentY - g.startY);
  return { type: "rect", x, y, w, h };
}

function buildContext(activeLayerId: ID | null): PlacedPlayerEditorContext | null {
  if (!activeLayerId) return null;
  return { layerId: activeLayerId };
}

type Store = {
  activeLayerId: ID | null;
  placedPlayerEditor: PlacedPlayerEditorState;

  getActivePlacedPlayers: () => PlacedPlayer[];
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
}

export function createEditorPlacedPlayersSlice(set: (partial: Partial<Store> | ((s: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorPlacedPlayersSlice {
  return {
    placedPlayerEditor: initialPlacedPlayerEditorState,

    setPlacedPlayerSelection: (input) =>
      set((s) => ({
        ...s,
        placedPlayerEditor: {
          ...s.placedPlayerEditor,
          selection: {
            playerId: input.playerId,
          },
        },
      })),

    clearPlacedPlayerEditor: () =>
      set((s) => ({
        ...s,
        placedPlayerEditor: initialPlacedPlayerEditorState,
      })),

    startPlacingPlacedPlayer: (input) =>
      set((s) => {
        if (!s.activeLayerId) return s;

        const draft: PlacedPlayerDraft = {
          playerId: input.playerId,
          initialImageId: input.initialImageId,
          shape: null,
          initialState: defaultInitialState(),
        };

        return {
          ...s,
          placedPlayerEditor: {
            context: buildContext(s.activeLayerId),
            mode: { type: "drawing" },
            selection: {
              playerId: draft.playerId,
            },
            draft,
            drawing: null,
          },
        };
      }),

    setPlacedPlayerDraftPlayerId: (playerId) =>
      set((s) => {
        const draft = s.placedPlayerEditor.draft;
        if (!draft) return s;
        if (draft.playerId === playerId) return s;

        return {
          ...s,
          placedPlayerEditor: {
            ...s.placedPlayerEditor,
            draft: { ...draft, playerId },
          },
        };
      }),

    setPlacedPlayerDraftInitialImageId: (initialImageId) =>
      set((s) => {
        const draft = s.placedPlayerEditor.draft;
        if (!draft) return s;
        if (draft.initialImageId === initialImageId) return s;

        return {
          ...s,
          placedPlayerEditor: {
            ...s.placedPlayerEditor,
            draft: { ...draft, initialImageId },
          },
        };
      }),

    setPlacedPlayerDraftShape: (shape) =>
      set((s) => {
        const draft = s.placedPlayerEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedPlayerEditor: {
            ...s.placedPlayerEditor,
            draft: { ...draft, shape },
          },
        };
      }),

    clearPlacedPlayerDraftShape: () =>
      set((s) => {
        const draft = s.placedPlayerEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedPlayerEditor: {
            ...s.placedPlayerEditor,
            draft: { ...draft, shape: null },
          },
        };
      }),

    updateDrawingPlacedPlayer: (pt) =>
      set((s) => {
        const ed = s.placedPlayerEditor;
        if (ed.mode.type !== "drawing" || !ed.draft) return s;

        const drawing0 = ed.drawing;
        const nextDrawing = drawing0
          ? { ...drawing0, currentX: pt.x, currentY: pt.y }
          : { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y };

        const shape = rectFromGesture(nextDrawing);

        return {
          ...s,
          placedPlayerEditor: {
            ...ed,
            drawing: nextDrawing,
            draft: { ...ed.draft, shape },
          },
        };
      }),

    finishDrawingPlacedPlayer: () =>
      set((s) => {
        const ed = s.placedPlayerEditor;
        if (ed.mode.type !== "drawing" || !ed.draft) return s;

        return {
          ...s,
          placedPlayerEditor: {
            ...ed,
            mode: { type: "editing", playerId: ed.draft.playerId },
            drawing: null,
          },
        };
      }),

    startRedrawPlacedPlayerShape: () =>
      set((s) => {
        const ed = s.placedPlayerEditor;
        if (!ed.draft) return s;

        return {
          ...s,
          placedPlayerEditor: {
            ...ed,
            mode: { type: "drawing" },
            drawing: null,
            draft: { ...ed.draft, shape: null },
            selection: {
              playerId: ed.draft.playerId,
            },
          },
        };
      }),

    editPlacedPlayer: (playerId) =>
      set((s) => {
        if (!s.activeLayerId) return s;

        const placedPlayers = s.getActivePlacedPlayers() ?? [];
        const placedPlayer = placedPlayers.find((p) => p.playerId === playerId);
        if (!placedPlayer) return s;

        const draft: PlacedPlayerDraft = {
          playerId: placedPlayer.playerId,
          initialImageId: placedPlayer.initialImageId,
          shape: placedPlayer.shape,
          initialState: placedPlayer.initialState,
        };

        return {
          ...s,
          placedPlayerEditor: {
            context: buildContext(s.activeLayerId),
            mode: { type: "editing", playerId },
            selection: {
              playerId,
            },
            draft,
            drawing: null,
          },
        };
      }),

    cancelPlacedPlayerDraft: () =>
      set((s) => ({
        ...s,
        placedPlayerEditor: initialPlacedPlayerEditorState,
      })),

    setPlacedPlayerDraftInitialState: (patch) =>
      set((s) => {
        const draft = s.placedPlayerEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedPlayerEditor: {
            ...s.placedPlayerEditor,
            draft: {
              ...draft,
              initialState: { ...draft.initialState, ...patch },
            },
          },
        };
      }),

    validatePlacedPlayerDraft: () => {
      const s = get();
      const draft = s.placedPlayerEditor.draft;

      if (!draft) return { ok: false, error: "No hay borrador de placedPlayer." };
      if (!draft.shape) {
        return { ok: false, error: "Debes dibujar un área válida antes de guardar el player." };
      }

      const candidate: PlacedPlayer = {
        playerId: draft.playerId,
        initialImageId: draft.initialImageId,
        shape: draft.shape,
        initialState: draft.initialState,
      };

      const result = validatePlacedPlayer(candidate);
      if (!result.ok) {
        const msg =
          result.errors.initialImageId ??
          result.errors.playerId ??
          result.errors.shape ??
          result.errors.initialState ??
          "El player colocado no es válido.";

        return { ok: false, error: msg };
      }

      return { ok: true };
    },
  };
}