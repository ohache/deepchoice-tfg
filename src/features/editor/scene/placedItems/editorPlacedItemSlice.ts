import type { ID, PlacedItem, RegionShape, PlaceableState, InteractionRules } from "@/domain/types";
import type { PlacedItemDraft, PlacedItemEditorContext, PlacedItemEditorState, PlacedItemRuleChannel } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import { generateId } from "@/utils/id";
import { validatePlacedItem } from "@/features/editor/scene/placedItems/placedItemValidator";

export const initialPlacedItemEditorState: PlacedItemEditorState = {
  context: null,
  mode: { type: "idle" },
  selection: { placedItemId: null, selectedChannel: null, selectedRuleId: null },
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

function defaultChannel(): PlacedItemRuleChannel {
  return { type: "onClick" };
}

function buildContext(activeLayerId: ID | null): PlacedItemEditorContext | null {
  if (!activeLayerId) return null;
  return { layerId: activeLayerId };
}

function isLabelUnique(label: string, placedItems: PlacedItem[]): boolean {
  return !placedItems.some(item => item.label.trim().toLowerCase() === label.trim().toLowerCase());
}

function createDefaultPlacedItemRules(placedItemId: ID): InteractionRules {
  return {
    onClick: [{ id: generateId.rule(), effects: [{ type: "addItem", placedItemId }]}]};
}

type Store = {
  activeLayerId: ID | null;
  placedItemEditor: PlacedItemEditorState;

  getActivePlacedItems: () => PlacedItem[];
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
}

export function createEditorPlacedItemsSlice(set: (partial: Partial<Store> | ((s: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorPlacedItemsSlice {
  return {
    placedItemEditor: initialPlacedItemEditorState,

    setPlacedItemDraftItemId: (itemId) =>
      set((s) => {
        const draft = s.placedItemEditor.draft;
        if (!draft) return s;
        if (draft.itemId === itemId) return s;

        return {
          ...s,
          placedItemEditor: {
            ...s.placedItemEditor,
            draft: { ...draft, itemId },
          },
        };
      }),

    setPlacedItemSelection: (input) =>
      set((s) => ({
        ...s,
        placedItemEditor: {
          ...s.placedItemEditor,
          selection: {
            placedItemId: input.placedItemId,
            selectedChannel: input.selectedChannel ?? s.placedItemEditor.selection.selectedChannel,
            selectedRuleId: input.selectedRuleId ?? s.placedItemEditor.selection.selectedRuleId,
          },
        },
      })),

    clearPlacedItemEditor: () =>
      set((s) => ({
        ...s,
        placedItemEditor: initialPlacedItemEditorState,
      })),

    startPlacingPlacedItem: (input) =>
      set((s) => {
        if (!s.activeLayerId) return s;

        const placedItemId = generateId.itemPlaced();

        const draft: PlacedItemDraft = {
          id: placedItemId,
          itemId: input.itemId,
          label: input.label ?? "",
          shape: null,
          initialState: defaultInitialState(),
          rules: createDefaultPlacedItemRules(placedItemId),
        };

        return {
          ...s,
          placedItemEditor: {
            context: buildContext(s.activeLayerId),
            mode: { type: "drawing" },
            selection: {
              placedItemId: draft.id,
              selectedChannel: defaultChannel(),
              selectedRuleId: null,
            },
            draft,
            drawing: null,
          },
        };
      }),

    setPlacedItemDraftShape: (shape) =>
      set((s) => {
        const draft = s.placedItemEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedItemEditor: {
            ...s.placedItemEditor,
            draft: { ...draft, shape },
          },
        };
      }),

    clearPlacedItemDraftShape: () =>
      set((s) => {
        const draft = s.placedItemEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedItemEditor: {
            ...s.placedItemEditor,
            draft: { ...draft, shape: null },
          },
        };
      }),

    updateDrawingPlacedItem: (pt) =>
      set((s) => {
        const ed = s.placedItemEditor;
        if (ed.mode.type !== "drawing" || !ed.draft) return s;

        const drawing0 = ed.drawing;
        const nextDrawing = drawing0
          ? { ...drawing0, currentX: pt.x, currentY: pt.y }
          : { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y };

        const shape = rectFromGesture(nextDrawing);

        return {
          ...s,
          placedItemEditor: {
            ...ed,
            drawing: nextDrawing,
            draft: { ...ed.draft, shape },
          },
        };
      }),

    finishDrawingPlacedItem: () =>
      set((s) => {
        const ed = s.placedItemEditor;
        if (ed.mode.type !== "drawing" || !ed.draft) return s;

        return {
          ...s,
          placedItemEditor: {
            ...ed,
            mode: { type: "editing", placedItemId: ed.draft.id },
            drawing: null,
          },
        };
      }),

    startRedrawPlacedItemShape: () =>
      set((s) => {
        const ed = s.placedItemEditor;
        if (!ed.draft) return s;

        return {
          ...s,
          placedItemEditor: {
            ...ed,
            mode: { type: "drawing" },
            drawing: null,
            draft: { ...ed.draft, shape: null },
            selection: {
              ...ed.selection,
              placedItemId: ed.draft.id,
              selectedRuleId: null,
            },
          },
        };
      }),

    editPlacedItem: (placedItemId) =>
      set((s) => {
        if (!s.activeLayerId) return s;

        const placedItems = s.getActivePlacedItems() ?? [];
        const placedItem = placedItems.find((p) => p.id === placedItemId);
        if (!placedItem) return s;

        const draft: PlacedItemDraft = {
          id: placedItem.id,
          itemId: placedItem.itemId,
          label: placedItem.label,
          shape: placedItem.shape,
          initialState: placedItem.initialState,
          rules: placedItem.rules ?? {},
        };

        return {
          ...s,
          placedItemEditor: {
            context: buildContext(s.activeLayerId),
            mode: { type: "editing", placedItemId },
            selection: {
              placedItemId,
              selectedChannel: defaultChannel(),
              selectedRuleId: null,
            },
            draft,
            drawing: null,
          },
        };
      }),

    cancelPlacedItemDraft: () =>
      set((s) => ({
        ...s,
        placedItemEditor: initialPlacedItemEditorState,
      })),

    setPlacedItemDraftLabel: (label) =>
      set((s) => {
        const draft = s.placedItemEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedItemEditor: {
            ...s.placedItemEditor,
            draft: { ...draft, label },
          },
        };
      }),

    setPlacedItemDraftInitialState: (patch) =>
      set((s) => {
        const draft = s.placedItemEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedItemEditor: {
            ...s.placedItemEditor,
            draft: {
              ...draft,
              initialState: { ...draft.initialState, ...patch },
            },
          },
        };
      }),

    setPlacedItemDraftRules: (rules) =>
      set((s) => {
        const draft = s.placedItemEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          placedItemEditor: {
            ...s.placedItemEditor,
            draft: { ...draft, rules },
          },
        };
      }),

    addRuleToSelectedChannel: (args) => {
      const s = get();
      const draft = s.placedItemEditor.draft;
      if (!draft) return null;

      const channel = s.placedItemEditor.selection.selectedChannel ?? defaultChannel();
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
        placedItemEditor: {
          ...st.placedItemEditor,
          draft: st.placedItemEditor.draft
            ? { ...st.placedItemEditor.draft, rules: nextRules }
            : null,
          selection: {
            ...st.placedItemEditor.selection,
            selectedChannel: channel,
            selectedRuleId: ruleId,
          },
        },
      }));

      return ruleId;
    },

    deleteRuleFromSelectedChannel: (ruleId) =>
      set((s) => {
        const draft = s.placedItemEditor.draft;
        if (!draft) return s;

        const channel = s.placedItemEditor.selection.selectedChannel ?? defaultChannel();
        const rules0: InteractionRules = draft.rules ?? {};

        const nextRules: InteractionRules =
          channel.type === "onClick"
            ? { ...rules0, onClick: (rules0.onClick ?? []).filter((r) => r.id !== ruleId) }
            : { ...rules0, onUseItem: (rules0.onUseItem ?? []).filter((r) => r.id !== ruleId) };

        const shouldClearSelected = s.placedItemEditor.selection.selectedRuleId === ruleId;

        return {
          ...s,
          placedItemEditor: {
            ...s.placedItemEditor,
            draft: { ...draft, rules: nextRules },
            selection: {
              ...s.placedItemEditor.selection,
              selectedRuleId: shouldClearSelected ? null : s.placedItemEditor.selection.selectedRuleId,
            },
          },
        };
      }),

    validatePlacedItemDraft: () => {
      const s = get();
      const draft = s.placedItemEditor.draft;

      if (!draft) return { ok: false, error: "No hay borrador de placedItem." };
      if (!draft.shape) {
        return { ok: false, error: "Debes dibujar un área válida antes de guardar el item." };
      }

      const placedItems = s.getActivePlacedItems();
      if (!isLabelUnique(draft.label, placedItems)) {
        return { ok: false, error: "El label del placedItem debe ser único en todo el juego." };
      }

      const candidate: PlacedItem = {
        id: draft.id,
        itemId: draft.itemId,
        label: draft.label.trim(),
        shape: draft.shape,
        initialState: draft.initialState,
        rules: draft.rules ?? {},
      };

      const result = validatePlacedItem(candidate);
      if (!result.ok) {
        const msg =
          result.errors.rules ??
          result.errors.label ??
          result.errors.itemId ??
          result.errors.shape ??
          result.errors.initialState ??
          "El item colocado no es válido.";

        return { ok: false, error: msg };
      }

      return { ok: true };
    },
  };
}