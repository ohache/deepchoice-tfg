import type { ID, PlacedNpc, RegionShape, PlaceableState, InteractionRules } from "@/domain/types";
import type { PlacedNpcDraft, PlacedNpcEditorContext, PlacedNpcEditorState, PlacedNpcRuleChannel } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import { generateId } from "@/utils/id";
import { validatePlacedNpc } from "@/features/editor/scene/placedNpcs/placedNpcValidator";

export const initialPlacedNpcEditorState: PlacedNpcEditorState = {
  context: null,
  mode: { type: "idle" },
  selection: { npcId: null, selectedChannel: null, selectedRuleId: null },
  draft: null,
  drawing: null,
};

function defaultInitialState(): PlaceableState {
  return { visible: true, reachable: true };
}

function rectFromGesture(g: { startX: number; startY: number; currentX: number; currentY: number }): RegionShape {
  const x = Math.min(g.startX, g.currentX);
  const y = Math.min(g.startY, g.currentY);
  const w = Math.abs(g.currentX - g.startX);
  const h = Math.abs(g.currentY - g.startY);
  return { type: "rect", x, y, w, h };
}

function defaultChannel(): PlacedNpcRuleChannel {
  return { type: "onClick" };
}

function buildContext(activeLayerId: ID | null): PlacedNpcEditorContext | null {
  if (!activeLayerId) return null;
  return { layerId: activeLayerId };
}

function buildCandidateFromDraft(
  draft: PlacedNpcDraft & { shape: RegionShape }
): PlacedNpc {
  return {
    npcId: draft.npcId,
    shape: draft.shape,
    initialState: draft.initialState,
    rules: draft.rules ?? {},
  };
}

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
      set((s) => ({
        ...s,
        placedNpcEditor: {
          ...s.placedNpcEditor,
          selection: {
            npcId: input.npcId,
            selectedChannel: input.selectedChannel ?? s.placedNpcEditor.selection.selectedChannel,
            selectedRuleId: input.selectedRuleId ?? s.placedNpcEditor.selection.selectedRuleId,
          },
        },
      })),

    clearPlacedNpcEditor: () =>
      set((s) => ({
        ...s,
        placedNpcEditor: initialPlacedNpcEditorState,
      })),

    startPlacingPlacedNpc: (input) =>
      set((s) => {
        if (!s.activeLayerId) return s;

        const draft: PlacedNpcDraft = {
          npcId: input.npcId,
          shape: null,
          initialState: defaultInitialState(),
          rules: {},
        };

        return {
          ...s,
          placedNpcEditor: {
            context: buildContext(s.activeLayerId),
            mode: { type: "drawing" },
            selection: {
              npcId: draft.npcId,
              selectedChannel: defaultChannel(),
              selectedRuleId: null,
            },
            draft,
            drawing: null,
          },
        };
      }),

    setPlacedNpcDraftNpcId: (npcId) =>
      set((s) => {
        const draft = s.placedNpcEditor.draft;
        if (!draft) return s;
        if (draft.npcId === npcId) return s;

        return {
          ...s,
          placedNpcEditor: {
            ...s.placedNpcEditor,
            draft: { ...draft, npcId },
          },
        };
      }),

    setPlacedNpcDraftShape: (shape) =>
      set((s) => {
        const draft = s.placedNpcEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedNpcEditor: {
            ...s.placedNpcEditor,
            draft: { ...draft, shape },
          },
        };
      }),

    clearPlacedNpcDraftShape: () =>
      set((s) => {
        const draft = s.placedNpcEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedNpcEditor: {
            ...s.placedNpcEditor,
            draft: { ...draft, shape: null },
          },
        };
      }),

    updateDrawingPlacedNpc: (pt) =>
      set((s) => {
        const ed = s.placedNpcEditor;
        if (ed.mode.type !== "drawing" || !ed.draft) return s;

        const drawing0 = ed.drawing;
        const nextDrawing = drawing0
          ? { ...drawing0, currentX: pt.x, currentY: pt.y }
          : { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y };

        const shape = rectFromGesture(nextDrawing);

        return {
          ...s,
          placedNpcEditor: {
            ...ed,
            drawing: nextDrawing,
            draft: { ...ed.draft, shape },
          },
        };
      }),

    finishDrawingPlacedNpc: () =>
      set((s) => {
        const ed = s.placedNpcEditor;
        if (ed.mode.type !== "drawing" || !ed.draft) return s;

        return {
          ...s,
          placedNpcEditor: {
            ...ed,
            mode: { type: "editing", npcId: ed.draft.npcId },
            drawing: null,
          },
        };
      }),

    startRedrawPlacedNpcShape: () =>
      set((s) => {
        const ed = s.placedNpcEditor;
        if (!ed.draft) return s;

        return {
          ...s,
          placedNpcEditor: {
            ...ed,
            mode: { type: "drawing" },
            drawing: null,
            draft: { ...ed.draft, shape: null },
            selection: {
              ...ed.selection,
              npcId: ed.draft.npcId,
              selectedRuleId: null,
            },
          },
        };
      }),

    editPlacedNpc: (npcId) =>
      set((s) => {
        if (!s.activeLayerId) return s;

        const placedNpcs = s.getActivePlacedNpcs() ?? [];
        const placedNpc = placedNpcs.find((p) => p.npcId === npcId);
        if (!placedNpc) return s;

        const draft: PlacedNpcDraft = {
          npcId: placedNpc.npcId,
          shape: placedNpc.shape,
          initialState: placedNpc.initialState,
          rules: placedNpc.rules ?? {},
        };

        return {
          ...s,
          placedNpcEditor: {
            context: buildContext(s.activeLayerId),
            mode: { type: "editing", npcId },
            selection: {
              npcId,
              selectedChannel: defaultChannel(),
              selectedRuleId: null,
            },
            draft,
            drawing: null,
          },
        };
      }),

    cancelPlacedNpcDraft: () =>
      set((s) => ({
        ...s,
        placedNpcEditor: initialPlacedNpcEditorState,
      })),

    setPlacedNpcDraftInitialState: (patch) =>
      set((s) => {
        const draft = s.placedNpcEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedNpcEditor: {
            ...s.placedNpcEditor,
            draft: {
              ...draft,
              initialState: { ...draft.initialState, ...patch },
            },
          },
        };
      }),

    setPlacedNpcDraftRules: (rules) =>
      set((s) => {
        const draft = s.placedNpcEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedNpcEditor: {
            ...s.placedNpcEditor,
            draft: { ...draft, rules },
          },
        };
      }),

    addRuleToSelectedChannel: (args) => {
      const s = get();
      const draft = s.placedNpcEditor.draft;
      if (!draft) return null;

      const channel = s.placedNpcEditor.selection.selectedChannel ?? defaultChannel();
      const ruleId = generateId.rule();
      const phrase = (args?.phrase ?? "").trim();

      const baseRule = {
        id: ruleId,
        ...(phrase ? { phrase } : {}),
        effects: [],
      };

      const rules0: InteractionRules = draft.rules ?? {};

      const nextRules: InteractionRules =
        channel.type === "onClick"
          ? { ...rules0, onClick: [...(rules0.onClick ?? []), baseRule] }
          : {
            ...rules0,
            onUseItem: [...(rules0.onUseItem ?? []), { ...baseRule, placedItemId: channel.placedItemId }],
          };

      set((st) => ({
        ...st,
        placedNpcEditor: {
          ...st.placedNpcEditor,
          draft: st.placedNpcEditor.draft
            ? { ...st.placedNpcEditor.draft, rules: nextRules }
            : null,
          selection: {
            ...st.placedNpcEditor.selection,
            selectedChannel: channel,
            selectedRuleId: ruleId,
          },
        },
      }));

      return ruleId;
    },

    deleteRuleFromSelectedChannel: (ruleId) =>
      set((s) => {
        const draft = s.placedNpcEditor.draft;
        if (!draft) return s;

        const channel = s.placedNpcEditor.selection.selectedChannel ?? defaultChannel();
        const rules0: InteractionRules = draft.rules ?? {};

        const nextRules: InteractionRules =
          channel.type === "onClick"
            ? { ...rules0, onClick: (rules0.onClick ?? []).filter((r) => r.id !== ruleId) }
            : { ...rules0, onUseItem: (rules0.onUseItem ?? []).filter((r) => r.id !== ruleId) };

        const shouldClearSelected = s.placedNpcEditor.selection.selectedRuleId === ruleId;

        return {
          ...s,
          placedNpcEditor: {
            ...s.placedNpcEditor,
            draft: { ...draft, rules: nextRules },
            selection: {
              ...s.placedNpcEditor.selection,
              selectedRuleId: shouldClearSelected ? null : s.placedNpcEditor.selection.selectedRuleId,
            },
          },
        };
      }),

    validatePlacedNpcDraft: () => {
      const s = get();
      const draft = s.placedNpcEditor.draft;

      if (!draft) return { ok: false, error: "No hay borrador de placedNpc." };
      if (!draft.shape) {
        return { ok: false, error: "Debes dibujar un área válida antes de guardar el NPC." };
      }

      const draftWithShape: PlacedNpcDraft & { shape: RegionShape } = {
        ...draft,
        shape: draft.shape,
      };

      const candidate = buildCandidateFromDraft(draftWithShape);

      const result = validatePlacedNpc(candidate);
      if (!result.ok) {
        const msg =
          result.errors.rules ??
          result.errors.npcId ??
          result.errors.shape ??
          result.errors.initialState ??
          "El NPC colocado no es válido.";

        return { ok: false, error: msg };
      }

      return { ok: true };
    },

    commitPlacedNpcDraft: () => {
      const s = get();
      const draft = s.placedNpcEditor.draft;

      if (!draft) return { ok: false, error: "No hay borrador de placedNpc." };
      if (!draft.shape) {
        return { ok: false, error: "Debes dibujar un área válida antes de guardar el NPC." };
      }

      const draftWithShape: PlacedNpcDraft & { shape: RegionShape } = {
        ...draft,
        shape: draft.shape,
      };

      const candidate = buildCandidateFromDraft(draftWithShape);

      const result = validatePlacedNpc(candidate);
      if (!result.ok) {
        const msg =
          result.errors.rules ??
          result.errors.npcId ??
          result.errors.shape ??
          result.errors.initialState ??
          "El NPC colocado no es válido.";

        return { ok: false, error: msg };
      }

      s.upsertPlacedNpc(candidate);

      set((st) => ({
        ...st,
        placedNpcEditor: initialPlacedNpcEditorState,
      }));

      return { ok: true, npcId: candidate.npcId };
    },
  };
}