import type { Hotspot, ID, InteractionRules, PlaceableState, RegionShape } from "@/domain/types";
import type { HotspotEditorState, HotspotRuleChannel } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import {
  buildContext, buildDraftFromHotspot, buildEmptyHotspotDraft, defaultChannel, initialHotspotEditorState,
  rectFromGesture, validateHotspotDraftCandidate
} from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";
import { generateId } from "@/utils/id";

type Store = {
  activeLayerId: ID | null;
  hotspotEditor: HotspotEditorState;

  getActiveHotspots: () => Hotspot[];
  addHotspot: (hotspot: Hotspot) => void;
  updateHotspot: (hotspotId: ID, patch: Partial<Hotspot>) => void;

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
  commitHotspotDraft: () => { ok: boolean; error?: string; hotspotId?: ID };
}

export function createEditorHotspotsSlice(set: (partial: Partial<Store> | ((s: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorHotspotsSlice {
  return {
    hotspotEditor: initialHotspotEditorState,

    setHotspotSelection: (input) =>
      set((state) => ({
        ...state,
        hotspotEditor: {
          ...state.hotspotEditor,
          selection: {
            hotspotId: input.hotspotId,
            selectedChannel: input.selectedChannel ?? state.hotspotEditor.selection.selectedChannel,
            selectedRuleId: input.selectedRuleId ?? state.hotspotEditor.selection.selectedRuleId,
          },
        },
      })),

    clearHotspotEditor: () =>
      set((state) => ({
        ...state,
        hotspotEditor: initialHotspotEditorState,
      })),

    startDrawingHotspot: () =>
      set((state) => {
        if (!state.activeLayerId) return state;

        const draft = buildEmptyHotspotDraft();

        return {
          ...state,
          hotspotEditor: {
            context: buildContext(state.activeLayerId),
            mode: { type: "drawing" },
            selection: { hotspotId: draft.id, selectedChannel: defaultChannel(), selectedRuleId: null },
            draft,
            drawing: null,
          },
        };
      }),

    setHotspotDraftShape: (shape) =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          hotspotEditor: { ...state.hotspotEditor, draft: { ...draft, shape } },
        };
      }),

    clearHotspotDraftShape: () =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          hotspotEditor: { ...state.hotspotEditor, draft: { ...draft, shape: null } },
        };
      }),

    updateDrawingHotspot: (pt) =>
      set((state) => {
        const editor = state.hotspotEditor;
        if (editor.mode.type !== "drawing" || !editor.draft) return state;

        const currentDrawing = editor.drawing;
        const nextDrawing = currentDrawing
          ? { ...currentDrawing, currentX: pt.x, currentY: pt.y }
          : { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y };

        const shape = rectFromGesture(nextDrawing);

        return {
          ...state,
          hotspotEditor: {
            ...editor,
            drawing: nextDrawing,
            draft: { ...editor.draft, shape }
          },
        };
      }),

    finishDrawingHotspot: () =>
      set((state) => {
        const editor = state.hotspotEditor;
        if (editor.mode.type !== "drawing" || !editor.draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...editor,
            mode: { type: "editing", hotspotId: editor.draft.id },
            drawing: null,
          },
        };
      }),

    startRedrawHotspotShape: () =>
      set((state) => {
        const editor = state.hotspotEditor;
        if (!editor.draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...editor,
            mode: { type: "drawing" },
            drawing: null,
            draft: { ...editor.draft, shape: null },
            selection: {
              ...editor.selection,
              hotspotId: editor.draft.id,
              selectedRuleId: null,
            },
          },
        };
      }),

    editHotspot: (hotspotId) =>
      set((state) => {
        if (!state.activeLayerId) return state;

        const hotspot = (state.getActiveHotspots() ?? []).find((item) => item.id === hotspotId);
        if (!hotspot) return state;

        return {
          ...state,
          hotspotEditor: {
            context: buildContext(state.activeLayerId),
            mode: { type: "editing", hotspotId },
            selection: { hotspotId, selectedChannel: defaultChannel(), selectedRuleId: null },
            draft: buildDraftFromHotspot(hotspot),
            drawing: null,
          },
        };
      }),

    cancelHotspotDraft: () =>
      set((state) => ({
        ...state,
        hotspotEditor: initialHotspotEditorState,
      })),

    setHotspotDraftLabel: (label) =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...state.hotspotEditor,
            draft: { ...draft, label },
          },
        };
      }),

    setHotspotDraftInitialState: (patch) =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...state.hotspotEditor,
            draft: {
              ...draft,
              initialState: { ...draft.initialState, ...patch },
            },
          },
        };
      }),

    setHotspotDraftVars: (vars) =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...state.hotspotEditor,
            draft: {
              ...draft, vars,
            },
          },
        };
      }),

    setHotspotDraftRules: (rules) =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        return {
          ...state,
          hotspotEditor: {
            ...state.hotspotEditor,
            draft: { ...draft, rules },
          },
        };
      }),

    addRuleToSelectedChannel: (args) => {
      const state = get();
      const draft = state.hotspotEditor.draft;
      if (!draft) return null;

      const channel = state.hotspotEditor.selection.selectedChannel ?? defaultChannel();
      const ruleId = generateId.rule();
      const phrase = (args?.phrase ?? "").trim();

      const baseRule = {
        id: ruleId,
        ...(phrase ? { phrase } : {}),
        effects: [],
      };

      const currentRules: InteractionRules = draft.rules ?? {};

      const nextRules: InteractionRules = channel.type === "onClick"
        ? {
          ...currentRules,
          onClick: [...(currentRules.onClick ?? []), baseRule]
        }
        : {
          ...currentRules,
          onUseItem: [
            ...(currentRules.onUseItem ?? []),
            { ...baseRule, placedItemId: channel.placedItemId }],
        };

      set((storeState) => ({
        ...storeState,
        hotspotEditor: {
          ...storeState.hotspotEditor,
          draft: storeState.hotspotEditor.draft
            ? {
              ...storeState.hotspotEditor.draft,
              rules: nextRules
            }
            : null,
          selection: {
            ...storeState.hotspotEditor.selection,
            selectedChannel: channel,
            selectedRuleId: ruleId,
          },
        },
      }));

      return ruleId;
    },

    deleteRuleFromSelectedChannel: (ruleId) =>
      set((state) => {
        const draft = state.hotspotEditor.draft;
        if (!draft) return state;

        const channel = state.hotspotEditor.selection.selectedChannel ?? defaultChannel();
        const currentRules: InteractionRules = draft.rules ?? {};

        const nextRules: InteractionRules = channel.type === "onClick"
          ? {
            ...currentRules,
            onClick: (currentRules.onClick ?? []).filter((rule) => rule.id !== ruleId)
          }
          : {
            ...currentRules,
            onUseItem: (currentRules.onUseItem ?? []).filter((rule) => rule.id !== ruleId)
          };

        const shouldClearSelectedRule = state.hotspotEditor.selection.selectedRuleId === ruleId;

        return {
          ...state,
          hotspotEditor: {
            ...state.hotspotEditor,
            draft: { ...draft, rules: nextRules },
            selection: {
              ...state.hotspotEditor.selection,
              selectedRuleId: shouldClearSelectedRule
                ? null
                : state.hotspotEditor.selection.selectedRuleId,
            },
          },
        };
      }),

    validateHotspotDraft: () => {
      const result = validateHotspotDraftCandidate(get().hotspotEditor.draft);

      if (!result.ok) return { ok: false, error: result.error };

      return { ok: true };
    },

    commitHotspotDraft: () => {
      const state = get();
      const draft = state.hotspotEditor.draft;

      if (!draft) return { ok: false, code: "missing_draft", error: "No hay borrador de hotspot." } as const;

      const result = validateHotspotDraftCandidate(draft);

      if (!result.ok) return { ok: false, code: "invalid_draft", error: result.error } as const;

      const candidate = result.candidate;
      const exists = (state.getActiveHotspots() ?? []).some((hotspot) => hotspot.id === candidate.id);

      if (exists) state.updateHotspot(candidate.id, candidate);
      else state.addHotspot(candidate);

      set((storeState) => ({ ...storeState, hotspotEditor: initialHotspotEditorState }));

      return { ok: true, hotspotId: candidate.id } as const;
    },
  };
}