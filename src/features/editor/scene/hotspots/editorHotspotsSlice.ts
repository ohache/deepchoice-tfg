import type { ID, Hotspot, RegionShape, PlaceableState, InteractionRules } from "@/domain/types";
import type { HotspotDraft, HotspotEditorContext, HotspotEditorState, HotspotRuleChannel } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import { generateId } from "@/utils/id";
import { validateHotspot } from "@/features/editor/scene/hotspots/hotspotValidator";

export const initialHotspotEditorState: HotspotEditorState = {
  context: null,
  mode: { type: "idle" },
  selection: { hotspotId: null, selectedChannel: null, selectedRuleId: null },
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

function defaultRules(): InteractionRules {
  return {};
}

function defaultChannel(): HotspotRuleChannel {
  return { type: "onClick" };
}

function buildContext(activeLayerId: ID | null): HotspotEditorContext | null {
  if (!activeLayerId) return null;
  return {
    layerId: activeLayerId,
  };
}

type Store = {
  activeLayerId: ID | null;
  hotspotEditor: HotspotEditorState;

  getActiveHotspots: () => Hotspot[];
  selectedInteractionKind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | null;
  selectedInteractionId: ID | null;
};

export interface EditorHotspotsSlice {
  hotspotEditor: HotspotEditorState;
  setHotspotSelection: (input: { hotspotId: ID | null; selectedChannel?: HotspotRuleChannel | null; selectedRuleId?: ID | null }) => void;
  clearHotspotEditor: () => void;
  startDrawingHotspot: () => void;
  setHotspotDraftShape: (shape: RegionShape | null) => void;
  clearHotspotDraftShape: () => void;
  updateDrawingHotspot: (pt: { x: number; y: number }) => void;
  finishDrawingHotspot: () => void;
  startRedrawHotspotShape: () => void;
  editHotspot: (hotspotId: ID) => void;
  cancelHotspotDraft: () => void;
  setHotspotDraftLabel: (label: string) => void;
  setHotspotDraftInitialState: (patch: Partial<PlaceableState>) => void;
  setHotspotDraftVars: (vars: Hotspot["vars"]) => void;
  setHotspotDraftRules: (rules: InteractionRules) => void;
  addRuleToSelectedChannel: (args?: { phrase?: string }) => ID | null;
  deleteRuleFromSelectedChannel: (ruleId: ID) => void;
  validateHotspotDraft: () => { ok: boolean; error?: string };
}

export function createEditorHotspotsSlice(set: (partial: Partial<Store> | ((s: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorHotspotsSlice {
  return {
    hotspotEditor: initialHotspotEditorState,

    setHotspotSelection: (input) =>
      set((s) => ({
        ...s,
        hotspotEditor: {
          ...s.hotspotEditor,
          selection: {
            hotspotId: input.hotspotId,
            selectedChannel: input.selectedChannel ?? s.hotspotEditor.selection.selectedChannel,
            selectedRuleId: input.selectedRuleId ?? s.hotspotEditor.selection.selectedRuleId,
          },
        },
      })),

    clearHotspotEditor: () => set((s) => ({ ...s, hotspotEditor: initialHotspotEditorState })),

    startDrawingHotspot: () =>
      set((s) => {
        if (!s.activeLayerId) return s;

        const draft: HotspotDraft = {
          id: generateId.hotspot(),
          label: "",
          shape: null,
          initialState: defaultInitialState(),
          vars: [],
          rules: defaultRules(),
        };

        return {
          ...s,
          hotspotEditor: {
            context: buildContext(s.activeLayerId),
            mode: { type: "drawing" },
            selection: { hotspotId: draft.id, selectedChannel: defaultChannel(), selectedRuleId: null },
            draft,
            drawing: null,
          },
        };
      }),

    setHotspotDraftShape: (shape) =>
      set((s) => {
        const draft = s.hotspotEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          hotspotEditor: {
            ...s.hotspotEditor,
            draft: { ...draft, shape },
          },
        };
      }),

    clearHotspotDraftShape: () =>
      set((s) => {
        const draft = s.hotspotEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          hotspotEditor: {
            ...s.hotspotEditor,
            draft: { ...draft, shape: null },
          },
        };
      }),

    updateDrawingHotspot: (pt) =>
      set((s) => {
        const ed = s.hotspotEditor;
        if (ed.mode.type !== "drawing" || !ed.draft) return s;

        const drawing0 = ed.drawing;
        const nextDrawing = drawing0
          ? { ...drawing0, currentX: pt.x, currentY: pt.y }
          : { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y };

        const shape = rectFromGesture(nextDrawing);

        return {
          ...s,
          hotspotEditor: {
            ...ed,
            drawing: nextDrawing,
            draft: { ...ed.draft, shape },
          },
        };
      }),

    finishDrawingHotspot: () =>
      set((s) => {
        const ed = s.hotspotEditor;
        if (ed.mode.type !== "drawing" || !ed.draft) return s;

        return {
          ...s,
          hotspotEditor: {
            ...ed,
            mode: { type: "editing", hotspotId: ed.draft.id },
            drawing: null,
          },
        };
      }),

    startRedrawHotspotShape: () =>
      set((s) => {
        const ed = s.hotspotEditor;
        if (!ed.draft) return s;

        return {
          ...s,
          hotspotEditor: {
            ...ed,
            mode: { type: "drawing" },
            drawing: null,
            draft: { ...ed.draft, shape: null },
            selection: {
              ...ed.selection,
              hotspotId: ed.draft.id,
              selectedRuleId: null,
            },
          },
        };
      }),

    editHotspot: (hotspotId) =>
      set((s) => {
        if (!s.activeLayerId) return s;

        const hotspots = s.getActiveHotspots() ?? [];
        const hs = hotspots.find((h) => h.id === hotspotId);
        if (!hs) return s;

        const draft: HotspotDraft = {
          id: hs.id,
          label: hs.label,
          shape: hs.shape,
          initialState: hs.initialState,
          vars: hs.vars ?? [],
          rules: hs.rules ?? {},
        };

        return {
          ...s,
          hotspotEditor: {
            context: buildContext(s.activeLayerId),
            mode: { type: "editing", hotspotId },
            selection: {
              hotspotId,
              selectedChannel: defaultChannel(),
              selectedRuleId: null,
            },
            draft,
            drawing: null,
          },
        };
      }),

    cancelHotspotDraft: () =>
      set((s) => ({
        ...s,
        hotspotEditor: initialHotspotEditorState,
      })),

    setHotspotDraftLabel: (label) =>
      set((s) => {
        const draft = s.hotspotEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          hotspotEditor: {
            ...s.hotspotEditor,
            draft: { ...draft, label },
          },
        };
      }),

    setHotspotDraftInitialState: (patch) =>
      set((s) => {
        const draft = s.hotspotEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          hotspotEditor: {
            ...s.hotspotEditor,
            draft: {
              ...draft,
              initialState: { ...draft.initialState, ...patch },
            },
          },
        };
      }),

    setHotspotDraftVars: (vars) =>
      set((s) => {
        const draft = s.hotspotEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          hotspotEditor: {
            ...s.hotspotEditor,
            draft: { ...draft, vars },
          },
        };
      }),

    setHotspotDraftRules: (rules) =>
      set((s) => {
        const draft = s.hotspotEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          hotspotEditor: {
            ...s.hotspotEditor,
            draft: { ...draft, rules },
          },
        };
      }),

    addRuleToSelectedChannel: (args) => {
      const s = get();
      const draft = s.hotspotEditor.draft;
      if (!draft) return null;

      const channel = s.hotspotEditor.selection.selectedChannel ?? defaultChannel();
      const ruleId = generateId.rule();
      const phrase = (args?.phrase ?? "").trim();

      const baseRule = {
        id: ruleId,
        ...(phrase ? { phrase } : {}),
        effects: [],
      };

      const rules0: InteractionRules = draft.rules ?? {};

      const nextRules: InteractionRules = channel.type === "onClick"
          ? { ...rules0, onClick: [...(rules0.onClick ?? []), baseRule] }
          : { ...rules0, onUseItem: [...(rules0.onUseItem ?? []), { ...baseRule, placedItemId: channel.placedItemId }] };

      set((st) => ({
        ...st,
        hotspotEditor: {
          ...st.hotspotEditor,
          draft: st.hotspotEditor.draft
            ? { ...st.hotspotEditor.draft, rules: nextRules }
            : null,
          selection: {
            ...st.hotspotEditor.selection,
            selectedChannel: channel,
            selectedRuleId: ruleId,
          },
        },
      }));

      return ruleId;
    },

    deleteRuleFromSelectedChannel: (ruleId) =>
      set((s) => {
        const draft = s.hotspotEditor.draft;
        if (!draft) return s;

        const channel = s.hotspotEditor.selection.selectedChannel ?? defaultChannel();
        const rules0: InteractionRules = draft.rules ?? {};

        const nextRules: InteractionRules = channel.type === "onClick"
            ? { ...rules0, onClick: (rules0.onClick ?? []).filter((r) => r.id !== ruleId) }
            : { ...rules0, onUseItem: (rules0.onUseItem ?? []).filter((r) => r.id !== ruleId) };

        const shouldClearSelected = s.hotspotEditor.selection.selectedRuleId === ruleId;

        return {
          ...s,
          hotspotEditor: {
            ...s.hotspotEditor,
            draft: { ...draft, rules: nextRules },
            selection: {
              ...s.hotspotEditor.selection,
              selectedRuleId: shouldClearSelected ? null : s.hotspotEditor.selection.selectedRuleId,
            },
          },
        };
      }),

    validateHotspotDraft: () => {
      const s = get();
      const draft = s.hotspotEditor.draft;

      if (!draft) return { ok: false, error: "No hay borrador de hotspot." };
      if (!draft.shape) {
        return { ok: false, error: "Debes dibujar un área válida antes de guardar el hotspot." };
      }

      const candidate: Hotspot = {
        id: draft.id,
        label: (draft.label ?? "").trim(),
        shape: draft.shape,
        initialState: draft.initialState,
        vars: draft.vars ?? [],
        rules: draft.rules ?? {},
      };

      const result = validateHotspot(candidate);
      if (!result.ok) {
        const msg =
          result.errors.rules ??
          result.errors.label ??
          result.errors.shape ??
          result.errors.initialState ??
          "El hotspot no es válido.";

        return { ok: false, error: msg };
      }

      return { ok: true };
    },
  };
}