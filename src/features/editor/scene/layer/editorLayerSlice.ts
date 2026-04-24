import type { ID, SceneImageLayer, ConditionalTextEntry, TextDock, Node, Project, AssetDef } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import { generateId } from "@/utils/id";
import type { HotspotEditorState } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { PlacedItemEditorState } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import type { PlacedNpcEditorState } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import type { PlacedPlayerEditorState } from "@/features/editor/scene/placedPlayers/placedPlayerEditorTypes";
import { initialHotspotEditorState, initialPlacedItemEditorState, initialPlacedNpcEditorState,
  initialPlacedPlayerEditorState } from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";
import { removeAsset, removeAssetFile, safeTrim } from "@/features/editor/core/editorGenericSlice";
import { createNodeLayer, patchNodeLayer, reorderNodeLayersList, sameLayer } from "@/features/editor/scene/node/editorNodeHelpersSlice";
import type { LayerToggleFieldId } from "@/features/editor/scene/SceneCommon";
import { buildAssetPath } from "@/store/assets/assetPath";

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
  selectedInteractionKind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | null;
  selectedInteractionId: ID | null;
  clearInteractionSelection: () => void;
  nodeIssues?: { path: string; message: string }[];
  pendingInteractiveOpen: { kind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer"; id: ID } | null;
};

type LayerEditSession =
  | { mode: "idle" }
  | { mode: "editing"; layerId: ID; isNew: boolean; snapshot: SceneImageLayer };

export interface EditorLayerSlice {
  activeLayerId: ID | null;
  activeTextEntryId: ID | null;
  layerEditSession: LayerEditSession;

  setLayerAssetId: (assetId: ID) => void;
  setActiveLayerId: (layerId: ID | null) => void;
  getActiveLayer: () => SceneImageLayer | null;
  patchActiveLayer: (patcher: (layer: SceneImageLayer) => SceneImageLayer) => void;
  setActiveTextEntryId: (entryId: ID | null) => void;

  activeLayerField: LayerToggleFieldId | null;
  setActiveLayerField: (field: LayerToggleFieldId | null) => void;

  setLayerEditSession: (session: LayerEditSession) => void;
  clearLayerEditSession: () => void;

  setLayerLabel: (label: string) => void;
  setLayerWhen: (when: Condition | null | undefined) => void;
  setLayerDock: (dock: TextDock) => void;

  addNodeLayer: (args?: { id?: ID; label?: string; assetId?: ID; when?: Condition; dock?: SceneImageLayer["dock"] }) => ID | null;
  updateNodeLayer: (layerId: ID, patch: Partial<SceneImageLayer>) => void;
  removeNodeLayer: (layerId: ID) => void;
  reorderNodeLayers: (fromIndex: number, toIndex: number) => void;

  upsertBackgroundAsset: (assetId: ID, file: File) => void;
  removeBackgroundAsset: (assetId: ID) => void;

  addLayerTextEntry: (args?: { id?: ID; label?: string; when?: Condition; content?: string }) => ID | null;
  updateLayerTextEntry: (entryId: ID, patch: Partial<ConditionalTextEntry>) => void;
  removeLayerTextEntry: (entryId: ID) => void;
  reorderLayerTextEntries: (fromIndex: number, toIndex: number) => void;

  setLayerMusicTrackId: (musicTrackId: ID | null | undefined) => void;

  pendingInteractiveOpen: { kind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer"; id: ID } | null;
  setPendingInteractiveOpen: (value: { kind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer"; id: ID } | null) => void;
  clearPendingInteractiveOpen: () => void;
}

function sameEntry(a: ConditionalTextEntry, b: ConditionalTextEntry): boolean {
  if (a === b) return true;
  return a.id === b.id && a.label === b.label && a.when === b.when && a.content === b.content;
}

function readActiveLayer(state: EditorStoreLike): SceneImageLayer | null {
  if (!state.nodeDraft || !state.activeLayerId) return null;
  return state.nodeDraft.layers?.find((layer) => layer.id === state.activeLayerId) ?? null;
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

    setLayerAssetId: (assetId: ID) => {
      const next = safeTrim(String(assetId ?? ""));
      if (!next) return;

      withActiveLayer((layer) => layer.assetId === next ? layer : { ...layer, assetId: next });
    },

    setActiveLayerId: (layerId) =>
      set((state) => {
        if (state.activeLayerId === layerId) return state;

        const shouldResetHotspotEditor = state.hotspotEditor.mode.type !== "idle" || Boolean(state.hotspotEditor.draft);

        const shouldResetPlacedItemEditor = state.placedItemEditor.mode.type !== "idle" || Boolean(state.placedItemEditor.draft);

        const shouldResetPlacedNpcEditor = state.placedNpcEditor.mode.type !== "idle" || Boolean(state.placedNpcEditor.draft);

        const shouldResetPlacedPlayerEditor = state.placedPlayerEditor.mode.type !== "idle" || Boolean(state.placedPlayerEditor.draft);

        const nextActiveLayer = layerId && state.nodeDraft ? (state.nodeDraft.layers ?? []).find((layer) => layer.id === layerId) ?? null : null;

        const nextActiveTextEntryId = nextActiveLayer?.text?.[0]?.id ?? null;

        const next: Partial<EditorStoreLike> & {
          activeLayerId: ID | null;
          activeTextEntryId?: ID | null;
          activeLayerField?: null;
          layerEditSession?: LayerEditSession;
          hotspotEditor?: typeof initialHotspotEditorState;
          placedItemEditor?: typeof initialPlacedItemEditorState;
          placedNpcEditor?: typeof initialPlacedNpcEditorState;
          placedPlayerEditor?: typeof initialPlacedPlayerEditorState;
          selectedInteractionKind?: null;
          selectedInteractionId?: null;
          pendingInteractiveOpen?: null;
        } = {
          activeLayerId: layerId,
          activeTextEntryId: nextActiveTextEntryId,
          activeLayerField: null,
          layerEditSession: { mode: "idle" },
          pendingInteractiveOpen: null,
        };

        if (shouldResetHotspotEditor) next.hotspotEditor = initialHotspotEditorState;
        if (shouldResetPlacedItemEditor) next.placedItemEditor = initialPlacedItemEditorState;
        if (shouldResetPlacedNpcEditor) next.placedNpcEditor = initialPlacedNpcEditorState;
        if (shouldResetPlacedPlayerEditor) next.placedPlayerEditor = initialPlacedPlayerEditorState;

        if (state.selectedInteractionKind || state.selectedInteractionId) {
          next.selectedInteractionKind = null;
          next.selectedInteractionId = null;
        }

        return next;
      }),

    getActiveLayer: () => readActiveLayer(get()),

    patchActiveLayer: (patcher) => { withActiveLayer((layer) => patcher(layer)) },

        setActiveTextEntryId: (entryId) =>
      set((state) => {
        if (state.activeTextEntryId === entryId) return state;

        const activeLayer = readActiveLayer(state);
        if (!activeLayer) return state;

        if (entryId != null && !(activeLayer.text ?? []).some((entry) => entry.id === entryId)) {
          return state;
        }

        return {
          ...state,
          activeTextEntryId: entryId,
        };
      }),

    activeLayerField: null,

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

    setLayerWhen: (when) => {
      const next = when ?? undefined;
      withActiveLayer((layer) => layer.when === next ? layer : { ...layer, when: next });
    },

    setLayerDock: (dock) => { withActiveLayer((layer) => layer.dock === dock ? layer : { ...layer, dock }) },

    addNodeLayer: (args) => {
      const state = get();
      const draft = state.nodeDraft;
      if (!draft) return null;

      const assetId = safeTrim(String(args?.assetId ?? ""));
      if (!assetId) return null;

      const layers0 = draft.layers ?? [];

      if (layers0.some((layer) => safeTrim(String(layer.assetId ?? "")) === assetId)) {
        set({ nodeIssues: [{ path: "layers", message: "Esa imagen ya está usada en esta escena." }] });
        return null;
      }

      const layer = createNodeLayer({ assetId, id: args?.id, label: args?.label, when: args?.when, dock: args?.dock });

      const nextLayers = [...layers0, layer];

      set({
        nodeDraft: { ...draft, layers: nextLayers },
        activeLayerId: layers0.length === 0 ? layer.id : state.activeLayerId,
        activeTextEntryId: layers0.length === 0 ? (layer.text?.[0]?.id ?? null) : state.activeTextEntryId,
        nodeIssues: [],
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
          nodeIssues: [],
        };
      }),

    removeNodeLayer: (layerId) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const layers0 = state.nodeDraft.layers ?? [];
        const nextLayers = layers0.filter((layer) => layer.id !== layerId);
        if (nextLayers.length === layers0.length) return state;

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
          ...state,
          nodeDraft: { ...state.nodeDraft, layers: nextLayers },
          nodeIssues: [],
          activeLayerId: removedActiveLayer ? (nextLayers[0]?.id ?? null) : state.activeLayerId,
          activeTextEntryId: removedActiveLayer ? (nextLayers[0]?.text?.[0]?.id ?? null) : state.activeTextEntryId,
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
      }),

    reorderNodeLayers: (fromIndex, toIndex) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const layers0 = state.nodeDraft.layers ?? [];
        const nextLayers = reorderNodeLayersList(layers0, fromIndex, toIndex);
        if (nextLayers === layers0) return state;

        return {
          ...state,
          nodeDraft: { ...state.nodeDraft, layers: nextLayers },
          nodeIssues: [],
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

      const nextAsset: AssetDef = {
        id: assetId,
        kind: "backgrounds",
        name: existing && existing.name.trim() !== "" ? existing.name : file.name || "Background",
        file: relativePath,
      };

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
      const layer = readActiveLayer(state);
      if (!layer) return null;

      const id = args?.id ?? generateId.variant();
      const label = safeTrim(args?.label ?? "") || "Texto";
      const when = args?.when;
      const content = args?.content ?? "";

      const entry: ConditionalTextEntry = { id, label, when: when ?? undefined, content };

      withActiveLayer((currentLayer) => ({
        ...currentLayer,
        text: [...(currentLayer.text ?? []), entry],
      }));

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
      const activeLayer = readActiveLayer(state);
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

        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= text0.length || toIndex >= text0.length) {
          return layer;
        }

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