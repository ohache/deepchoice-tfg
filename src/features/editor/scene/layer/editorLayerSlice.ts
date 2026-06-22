import type { ID, SceneImageLayer, ConditionalTextEntry, TextDock, Node, Project, AssetDef } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import { generateId } from "@/utils/id";
import type { HotspotEditorState } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { PlacedItemEditorState } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import type { PlacedNpcEditorState } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import type { PlacedPlayerEditorState } from "@/features/editor/scene/placedPlayers/placedPlayerEditorTypes";
import {
  initialHotspotEditorState, initialPlacedItemEditorState, initialPlacedNpcEditorState,
  initialPlacedPlayerEditorState
} from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";
import { removeAsset, removeAssetFile, safeTrim } from "@/features/editor/core/editorDataUtils";
import type { LayerToggleFieldId } from "@/features/editor/scene/SceneCommon";
import { buildAssetPath } from "@/store/assets/assetPath";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import type { NodeFieldErrors } from "@/features/editor/scene/node/nodeValidator";
import { sameLayer, createNodeLayer, patchNodeLayer, reorderNodeLayersList, sameEntry, getFirstTextEntryIdFromLayers, findLayerById, getFirstTextEntryIdFromLayer, getActiveLayer } from "@/features/editor/scene/layer/layerHelpers";

export type InteractionKind = "hotspot" | "placedItem" | "placedNpc" | "placedPlayer";

type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  registerAssetFile: (assetId: ID, file: File) => void;
  nodeDraft: Node | null;
  activeLayerId: ID | null;
  activeTextEntryId: ID | null;
  activeLayerField: LayerToggleFieldId | null;
  layerEditSession: LayerEditSession;
  setLayerEditSession: (session: LayerEditSession) => void;
  clearLayerEditSession: () => void;
  hotspotEditor: HotspotEditorState;
  placedItemEditor: PlacedItemEditorState;
  placedNpcEditor: PlacedNpcEditorState;
  placedPlayerEditor: PlacedPlayerEditorState;
  selectedInteractionKind: InteractionKind | null;
  selectedInteractionId: ID | null;
  clearInteractionSelection: () => void;
  nodeErrors: NodeFieldErrors;
  pendingInteractiveOpen: { kind: InteractionKind; id: ID } | null;
  requestDelete: (target: DeleteTarget) => void;
};

type LayerEditSession = { mode: "idle" } | { mode: "editing"; layerId: ID; isNew: boolean; snapshot: SceneImageLayer };

export interface EditorLayerSlice {
  activeLayerId: ID | null;
  activeLayerField: LayerToggleFieldId | null;
  activeTextEntryId: ID | null;
  layerEditSession: LayerEditSession;
  setLayerAssetId: (assetId: ID) => void;
  setActiveLayerId: (layerId: ID | null) => void;
  setActiveTextEntryId: (entryId: ID | null) => void;
  setActiveLayerField: (field: LayerToggleFieldId | null) => void;
  setLayerEditSession: (session: LayerEditSession) => void;
  clearLayerEditSession: () => void;
  setLayerLabel: (label: string) => void;
  setLayerDock: (dock: TextDock) => void;
  addNodeLayer: (args?: { id?: ID; label?: string; assetId?: ID; when?: Condition; dock?: SceneImageLayer["dock"] }) => ID | null;
  updateNodeLayer: (layerId: ID, patch: Partial<SceneImageLayer>) => void;
  removeNodeLayer: (layerId: ID, options?: { withConfirmation?: boolean }) => void;
  reorderNodeLayers: (fromIndex: number, toIndex: number) => void;
  upsertBackgroundAsset: (assetId: ID, file: File) => void;
  removeBackgroundAsset: (assetId: ID) => void;
  addLayerTextEntry: (args?: { id?: ID; label?: string; when?: Condition; content?: string }) => ID | null;
  updateLayerTextEntry: (entryId: ID, patch: Partial<ConditionalTextEntry>) => void;
  removeLayerTextEntry: (entryId: ID) => void;
  reorderLayerTextEntries: (fromIndex: number, toIndex: number) => void;
  setLayerMusicTrackId: (musicTrackId: ID | null | undefined) => void;
  pendingInteractiveOpen: { kind: InteractionKind; id: ID } | null;
  setPendingInteractiveOpen: (value: { kind: InteractionKind; id: ID } | null) => void;
  clearPendingInteractiveOpen: () => void;
}

function resetLayerContextPatch(layerId: ID | null, nextActiveTextEntryId: ID | null): Partial<EditorStoreLike> {
  return {
    activeLayerId: layerId,
    activeTextEntryId: nextActiveTextEntryId,
    activeLayerField: null,
    layerEditSession: { mode: "idle" },

    hotspotEditor: initialHotspotEditorState,
    placedItemEditor: initialPlacedItemEditorState,
    placedNpcEditor: initialPlacedNpcEditorState,
    placedPlayerEditor: initialPlacedPlayerEditorState,

    selectedInteractionKind: null,
    selectedInteractionId: null,
    pendingInteractiveOpen: null,
  };
}

function buildLayerRemovalUiPatch(state: EditorStoreLike, layerId: ID, nextLayers: SceneImageLayer[]): Partial<EditorStoreLike> {
  const removedActiveLayer = state.activeLayerId === layerId;

  const removedHotspotLayer = state.hotspotEditor.context?.layerId === layerId;
  const removedPlacedItemLayer = state.placedItemEditor.context?.layerId === layerId;
  const removedPlacedNpcLayer = state.placedNpcEditor.context?.layerId === layerId;
  const removedPlacedPlayerLayer = state.placedPlayerEditor.context?.layerId === layerId;

  const removedLayerEditSession = state.layerEditSession.mode === "editing" && state.layerEditSession.layerId === layerId;

  const shouldResetHotspotEditor = removedActiveLayer || removedHotspotLayer;
  const shouldResetPlacedItemEditor = removedActiveLayer || removedPlacedItemLayer;
  const shouldResetPlacedNpcEditor = removedActiveLayer || removedPlacedNpcLayer;
  const shouldResetPlacedPlayerEditor = removedActiveLayer || removedPlacedPlayerLayer;

  const shouldClearSelection = shouldResetHotspotEditor || shouldResetPlacedItemEditor || shouldResetPlacedNpcEditor || shouldResetPlacedPlayerEditor;

  return {
    nodeErrors: {},

    activeLayerId: removedActiveLayer ? nextLayers[0]?.id ?? null : state.activeLayerId,

    activeTextEntryId: removedActiveLayer ? getFirstTextEntryIdFromLayers(nextLayers) : state.activeTextEntryId,

    activeLayerField: removedActiveLayer ? null : state.activeLayerField,

    layerEditSession: removedLayerEditSession ? { mode: "idle" } : state.layerEditSession,

    hotspotEditor: shouldResetHotspotEditor ? initialHotspotEditorState : state.hotspotEditor,

    placedItemEditor: shouldResetPlacedItemEditor ? initialPlacedItemEditorState : state.placedItemEditor,

    placedNpcEditor: shouldResetPlacedNpcEditor ? initialPlacedNpcEditorState : state.placedNpcEditor,

    placedPlayerEditor: shouldResetPlacedPlayerEditor ? initialPlacedPlayerEditorState : state.placedPlayerEditor,

    selectedInteractionKind: shouldClearSelection ? null : state.selectedInteractionKind,

    selectedInteractionId: shouldClearSelection ? null : state.selectedInteractionId,

    pendingInteractiveOpen: shouldClearSelection ? null : state.pendingInteractiveOpen,
  };
}

export function createEditorLayerSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorLayerSlice {

  function withActiveLayer(updater: (layer: SceneImageLayer) => SceneImageLayer) {
    set((state) => {
      if (!state.nodeDraft || !state.activeLayerId) return state;

      const layers0 = state.nodeDraft.layers ?? [];
      const index = layers0.findIndex((layer) => layer.id === state.activeLayerId);
      if (index < 0) return state;

      const prev = layers0[index]!;
      const next = updater(prev);

      if (next === prev) return state;

      const layers1 = layers0.slice();
      layers1[index] = next;

      return {
        ...state,
        nodeDraft: { ...state.nodeDraft, layers: layers1 },
      };
    });
  }

  return {
    activeLayerId: null,

    activeTextEntryId: null,

    layerEditSession: { mode: "idle" },

    activeLayerField: null,

    setLayerAssetId: (assetId: ID) => {
      const next = safeTrim(String(assetId ?? ""));
      if (!next) return;

      withActiveLayer((layer) => layer.assetId === next ? layer : { ...layer, assetId: next });
    },

    setActiveLayerId: (layerId) =>
      set((state) => {
        if (state.activeLayerId === layerId) return state;

        const nextActiveLayer = findLayerById(state.nodeDraft, layerId);
        const nextActiveTextEntryId = getFirstTextEntryIdFromLayer(nextActiveLayer);

        return {
          ...state,
          ...resetLayerContextPatch(layerId, nextActiveTextEntryId),
        };
      }),

    setActiveTextEntryId: (entryId) =>
      set((state) => {
        if (state.activeTextEntryId === entryId) return state;

        const activeLayer = getActiveLayer(state.nodeDraft, state.activeLayerId);
        if (!activeLayer) return state;

        if (entryId != null && !(activeLayer.text ?? []).some((entry) => entry.id === entryId)) return state;

        return {
          ...state,
          activeTextEntryId: entryId,
        };
      }),

    setActiveLayerField: (field) =>
      set((state) => {
        if (state.activeLayerField === field) return state;

        return {
          ...state,
          activeLayerField: field,
        };
      }),

    setLayerEditSession: (session) =>
      set((state) => {
        if (state.layerEditSession.mode === session.mode && state.layerEditSession.mode === "idle") return state;

        if (state.layerEditSession.mode === "editing" && session.mode === "editing" && state.layerEditSession.layerId === session.layerId &&
          state.layerEditSession.isNew === session.isNew && sameLayer(state.layerEditSession.snapshot, session.snapshot)) {
          return state;
        }

        return {
          ...state,
          layerEditSession: session,
        };
      }),

    clearLayerEditSession: () =>
      set((state) => {
        if (state.layerEditSession.mode === "idle") return state;

        return {
          ...state,
          layerEditSession: { mode: "idle" },
        };
      }),

    setLayerLabel: (label) => {
      const next = safeTrim(label ?? "");
      withActiveLayer((layer) => layer.label === next ? layer : { ...layer, label: next });
    },

    setLayerDock: (dock) => {
      withActiveLayer((layer) => layer.dock === dock ? layer : { ...layer, dock })
    },

    addNodeLayer: (args) => {
      const state = get();
      const draft = state.nodeDraft;
      if (!draft) return null;

      const assetId = safeTrim(String(args?.assetId ?? ""));
      if (!assetId) return null;

      const layers0 = draft.layers ?? [];

      if (layers0.some((layer) => safeTrim(String(layer.assetId ?? "")) === assetId)) {
        set({ nodeErrors: { layers: "Esa imagen ya está usada en esta escena." } });
        return null;
      }

      const layer = createNodeLayer({ assetId, id: args?.id, label: args?.label, when: args?.when, dock: args?.dock });

      const nextLayers = [...layers0, layer];

      set({
        nodeDraft: { ...draft, layers: nextLayers },
        activeLayerId: layers0.length === 0 ? layer.id : state.activeLayerId,
        activeTextEntryId: layers0.length === 0 ? getFirstTextEntryIdFromLayers(nextLayers) : state.activeTextEntryId,
        nodeErrors: {},
      });

      return layer.id;
    },

    updateNodeLayer: (layerId, patch) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const layers0 = state.nodeDraft.layers ?? [];
        const index = layers0.findIndex((layer) => layer.id === layerId);
        if (index < 0) return state;

        const prev = layers0[index]!;
        const next = patchNodeLayer(prev, patch);

        if (sameLayer(prev, next)) return state;

        const layers1 = layers0.slice();
        layers1[index] = next;

        return {
          ...state,
          nodeDraft: { ...state.nodeDraft, layers: layers1 },
          nodeErrors: {},
        };
      }),

    removeNodeLayer: (layerId, options) => {
      const withConfirmation = options?.withConfirmation ?? false;

      if (withConfirmation) {
        const state = get();
        const nodeId = state.nodeDraft?.id;

        if (!nodeId || !state.project) return;

        state.requestDelete({ kind: "layer", nodeId, layerId });
        return;
      }

      set((state) => {
        if (!state.nodeDraft) return state;

        const layers0 = state.nodeDraft.layers ?? [];
        const nextLayers = layers0.filter((layer) => layer.id !== layerId);

        if (nextLayers.length === layers0.length) return state;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            layers: nextLayers,
          },
          ...buildLayerRemovalUiPatch(state, layerId, nextLayers),
        };
      });
    },

    reorderNodeLayers: (fromIndex, toIndex) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const layers0 = state.nodeDraft.layers ?? [];
        const nextLayers = reorderNodeLayersList(layers0, fromIndex, toIndex);
        if (nextLayers === layers0) return state;

        return {
          ...state,
          nodeDraft: { ...state.nodeDraft, layers: nextLayers },
          nodeErrors: {},
        };
      }),

    /* Inserta o actualiza un asset de fondo */
    upsertBackgroundAsset: (assetId, file) => {
      const state = get();
      const project = state.project;
      if (!project) return;

      state.registerAssetFile(assetId, file);

      const relativePath = buildAssetPath("backgrounds", file.name);
      const existing = project.assets.find((asset) => asset.kind === "backgrounds" && asset.id === assetId);

      const nextAsset: AssetDef = { id: assetId, kind: "backgrounds", name: existing && existing.name.trim() !== "" ? existing.name : file.name || "Background", file: relativePath };

      const nextAssets = existing
        ? project.assets.map((asset) => asset.kind === "backgrounds" && asset.id === assetId ? nextAsset : asset)
        : [...project.assets, nextAsset];

      set({ project: { ...project, assets: nextAssets } });
    },

    /* Elimina el asset de fondo del catálogo y su File asociado */
    removeBackgroundAsset: (id: ID) =>
      set((state) => {
        if (!state.project) return state;

        const assetResult = removeAsset(state.project.assets, { id, kind: "backgrounds" });

        const fileResult = removeAssetFile(state.assetFiles, id);

        if (!assetResult.touched && !fileResult.touched) return state;

        return {
          ...state,
          project: { ...state.project, assets: assetResult.assets },
          assetFiles: fileResult.assetFiles,
        };
      }),

    addLayerTextEntry: (args) => {
      const state = get();
      const layer = getActiveLayer(state.nodeDraft, state.activeLayerId);
      if (!layer) return null;

      const id = args?.id ?? generateId.text();
      const label = safeTrim(args?.label ?? "") || "Texto";
      const when = args?.when;
      const content = args?.content ?? "";

      const entry: ConditionalTextEntry = { id, label, when: when ?? undefined, content };

      withActiveLayer((currentLayer) => ({ ...currentLayer, text: [...(currentLayer.text ?? []), entry] }));

      set({ activeTextEntryId: id });

      return id;
    },

    updateLayerTextEntry: (entryId, patch) => {
      withActiveLayer((layer) => {
        const text0 = layer.text ?? [];
        const index = text0.findIndex((entry) => entry.id === entryId);
        if (index < 0) return layer;

        const prev = text0[index]!;
        const next = { ...prev, ...patch };

        if (sameEntry(prev, next)) return layer;

        const text1 = text0.slice();
        text1[index] = next;

        return { ...layer, text: text1 };
      });
    },

    removeLayerTextEntry: (entryId) => {
      const state = get();
      const activeLayer = getActiveLayer(state.nodeDraft, state.activeLayerId);
      if (!activeLayer) return;

      const text0 = activeLayer.text ?? [];
      const next = text0.filter((entry) => entry.id !== entryId);

      if (next.length === text0.length) return;

      withActiveLayer((layer) => ({ ...layer, text: next }));

      if (state.activeTextEntryId === entryId) {
        set({ activeTextEntryId: next[0]?.id ?? null });
      }
    },

    reorderLayerTextEntries: (fromIndex, toIndex) => {
      withActiveLayer((layer) => {
        const text0 = layer.text ?? [];

        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= text0.length || toIndex >= text0.length) return layer;

        const next = text0.slice();
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);

        return { ...layer, text: next };
      });
    },

    setLayerMusicTrackId: (musicTrackId) => {
      const next = typeof musicTrackId === "string" && musicTrackId.trim() ? musicTrackId : undefined;

      withActiveLayer((layer) => layer.musicTrackId === next ? layer : { ...layer, musicTrackId: next });
    },

    pendingInteractiveOpen: null,

    setPendingInteractiveOpen: (value) =>
      set((state) => ({
        ...state,
        pendingInteractiveOpen: value,
      })),

    clearPendingInteractiveOpen: () =>
      set((state) => ({
        ...state,
        pendingInteractiveOpen: null,
      })),
  };
}