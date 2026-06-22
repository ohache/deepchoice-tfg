import type { ID, Node, SceneImageLayer, Hotspot, ItemInstance, PlacedNpc, PlacedPlayer } from "@/domain/types";
import {
  appendHotspot, appendPlacedItem, clearRemovedInteractionSelection, ensureInteractionsArrays, removeInteractionFromActiveLayer, reorderHotspotCollection, reorderPlacedItemCollection, updateHotspotInCollection,
  updatePlacedItemInCollection, upsertPlacedNpcInCollection, upsertPlacedPlayerInCollection
} from "@/features/editor/scene/layer/layerInteractionHelpers";
import { getActiveLayer } from "@/features/editor/scene/layer/layerHelpers";
import type { InteractionKind } from "@/features/editor/scene/layer/editorLayerSlice";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";

type EditorStoreLike = {
  nodeDraft: Node | null;
  activeLayerId: ID | null;
  selectedInteractionKind: InteractionKind | null;
  selectedInteractionId: ID | null;
  requestDelete: (target: DeleteTarget) => void;
};

export interface EditorLayerInteractionsSlice {
  selectedInteractionKind: InteractionKind | null;
  selectedInteractionId: ID | null;

  setSelectedInteractionKind: (kind: InteractionKind | null) => void;
  setSelectedInteractionId: (id: ID | null) => void;
  clearInteractionSelection: () => void;

  addHotspot: (hotspot: Hotspot) => void;
  updateHotspot: (hotspotId: ID, patch: Partial<Hotspot>) => void;
  removeHotspot: (hotspotId: ID, options?: { withConfirmation?: boolean }) => void;
  getActiveHotspots: () => Hotspot[];
  setActiveHotspots: (hotspots: Hotspot[]) => void;
  reorderHotspots: (fromIndex: number, toIndex: number) => void;

  addPlacedItem: (placedItem: ItemInstance) => void;
  updatePlacedItem: (placedItemId: ID, patch: Partial<ItemInstance>) => void;
  removePlacedItem: (placedItemId: ID, options?: { withConfirmation?: boolean }) => void;
  getActivePlacedItems: () => ItemInstance[];
  setActivePlacedItems: (placedItems: ItemInstance[]) => void;
  reorderPlacedItems: (fromIndex: number, toIndex: number) => void;

  upsertPlacedNpc: (placedNpc: PlacedNpc) => void;
  removePlacedNpc: (npcId: ID, options?: { withConfirmation?: boolean }) => void;
  getActivePlacedNpcs: () => PlacedNpc[];
  setActivePlacedNpcs: (placedNpcs: PlacedNpc[]) => void;

  upsertPlacedPlayer: (placedPlayer: PlacedPlayer) => void;
  removePlacedPlayer: (playerId: ID, options?: { withConfirmation?: boolean }) => void;
  getActivePlacedPlayers: () => PlacedPlayer[];
  setActivePlacedPlayers: (placedPlayers: PlacedPlayer[]) => void;
}

export function createEditorLayerInteractionsSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorLayerInteractionsSlice {
  function withActiveLayer(updater: (layer: SceneImageLayer) => SceneImageLayer): void {
    set((state) => {
      if (!state.nodeDraft || !state.activeLayerId) return state;

      const layers0 = state.nodeDraft.layers ?? [];
      const index = layers0.findIndex((layer) => layer.id === state.activeLayerId);
      if (index < 0) return state;

      const prev = ensureInteractionsArrays(layers0[index]!);
      const next = updater(prev);

      if (next === prev) return state;

      const layers1 = layers0.slice();
      layers1[index] = next;

      return {
        ...state,
        nodeDraft: {
          ...state.nodeDraft,
          layers: layers1,
        },
      };
    });
  }

  function requestInteractionDelete(kind: InteractionKind, id: ID) {
    const state = get();
    const requestDelete = state.requestDelete;

    const nodeId = state.nodeDraft?.id;
    const layerId = state.activeLayerId;

    if (!nodeId || !layerId) return;

    if (kind === "hotspot") {
      requestDelete({ kind: "hotspot", nodeId, layerId, hotspotId: id });
      return;
    }

    if (kind === "placedItem") {
      requestDelete({ kind: "placedItem", nodeId, layerId, placedItemId: id });
      return;
    }

    if (kind === "placedNpc") {
      requestDelete({ kind: "placedNpc", nodeId, layerId, npcId: id });
      return;
    }

    requestDelete({ kind: "placedPlayer", nodeId, layerId, playerId: id });
  }

  function removeInteraction(kind: InteractionKind, id: ID, options?: { withConfirmation?: boolean }) {
    if (options?.withConfirmation) {
      requestInteractionDelete(kind, id);
      return;
    }

    set((state) => {
      const nextNodeDraft = removeInteractionFromActiveLayer(state.nodeDraft, state.activeLayerId, kind, id);

      if (nextNodeDraft === state.nodeDraft) return state;

      return {
        ...state,
        nodeDraft: nextNodeDraft,
        ...clearRemovedInteractionSelection(
          state.selectedInteractionKind,
          state.selectedInteractionId,
          kind,
          id,
        ),
      };
    });
  }

  return {
    selectedInteractionKind: null,

    selectedInteractionId: null,

    setSelectedInteractionKind: (kind) => set({ selectedInteractionKind: kind, selectedInteractionId: null }),

    setSelectedInteractionId: (id) => set({ selectedInteractionId: id }),

    clearInteractionSelection: () => set({ selectedInteractionKind: null, selectedInteractionId: null }),

    addHotspot: (hotspot) => {
      withActiveLayer((layer) => ({ ...layer, hotspots: appendHotspot(layer.hotspots, hotspot) }))},

    updateHotspot: (hotspotId, patch) => {
      withActiveLayer((layer) => {
        const nextHotspots = updateHotspotInCollection(layer.hotspots, hotspotId, patch);
        if (!nextHotspots) return layer;

        return { ...layer, hotspots: nextHotspots };
      });
    },

    removeHotspot: (hotspotId, options) => removeInteraction("hotspot", hotspotId, options),

    reorderHotspots: (fromIndex, toIndex) => {
      withActiveLayer((layer) => {
        const nextHotspots = reorderHotspotCollection(layer.hotspots, fromIndex, toIndex);
        if (!nextHotspots) return layer;

        return { ...layer, hotspots: nextHotspots };
      });
    },

    getActiveHotspots: () => {
      const state = get();
      const layer = getActiveLayer(state.nodeDraft, state.activeLayerId);
      return layer?.hotspots ?? [];
    },

    setActiveHotspots: (hotspots) => {
      withActiveLayer((layer) => ({ ...layer, hotspots: Array.isArray(hotspots) ? hotspots : [] }));
    },

    addPlacedItem: (placedItem) => {
      withActiveLayer((layer) => ({ ...layer, placedItems: appendPlacedItem(layer.placedItems, placedItem) }));
    },

    updatePlacedItem: (placedItemId, patch) => {
      withActiveLayer((layer) => {
        const nextPlacedItems = updatePlacedItemInCollection(layer.placedItems, placedItemId, patch);
        if (!nextPlacedItems) return layer;

        return { ...layer, placedItems: nextPlacedItems };
      });
    },

    removePlacedItem: (placedItemId, options) => removeInteraction("placedItem", placedItemId, options),

    reorderPlacedItems: (fromIndex, toIndex) => {
      withActiveLayer((layer) => {
        const nextPlacedItems = reorderPlacedItemCollection(layer.placedItems, fromIndex, toIndex);
        if (!nextPlacedItems) return layer;

        return { ...layer, placedItems: nextPlacedItems };
      });
    },

    getActivePlacedItems: () => {
      const state = get();
      const layer = getActiveLayer(state.nodeDraft, state.activeLayerId);
      return layer?.placedItems ?? [];
    },

    setActivePlacedItems: (placedItems) => {
      withActiveLayer((layer) => ({ ...layer, placedItems: Array.isArray(placedItems) ? placedItems : [] }));
    },

    upsertPlacedNpc: (placedNpc) => {
      withActiveLayer((layer) => ({ ...layer, placedNpcs: upsertPlacedNpcInCollection(layer.placedNpcs, placedNpc) }));
    },

    removePlacedNpc: (npcId, options) => removeInteraction("placedNpc", npcId, options),

    getActivePlacedNpcs: () => {
      const state = get();
      const layer = getActiveLayer(state.nodeDraft, state.activeLayerId);
      return layer?.placedNpcs ?? [];
    },

    setActivePlacedNpcs: (placedNpcs) => {
      withActiveLayer((layer) => ({ ...layer, placedNpcs: Array.isArray(placedNpcs) ? placedNpcs : [] }));
    },

    upsertPlacedPlayer: (placedPlayer) => {
      withActiveLayer((layer) => ({ ...layer, placedPlayers: upsertPlacedPlayerInCollection(layer.placedPlayers, placedPlayer) }));
    },

    removePlacedPlayer: (playerId, options) => removeInteraction("placedPlayer", playerId, options),

    getActivePlacedPlayers: () => {
      const state = get();
      const layer = getActiveLayer(state.nodeDraft, state.activeLayerId);
      return layer?.placedPlayers ?? [];
    },

    setActivePlacedPlayers: (placedPlayers) => {
      withActiveLayer((layer) => ({ ...layer, placedPlayers: Array.isArray(placedPlayers) ? placedPlayers : [] }));
    },
  };
}