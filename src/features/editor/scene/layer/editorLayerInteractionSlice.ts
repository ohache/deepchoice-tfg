import type { ID, Node, SceneImageLayer, Hotspot, PlacedItem, PlacedNpc, PlacedPlayer } from "@/domain/types";
import {
  appendHotspot, appendPlacedItem, ensureInteractionsArrays, readActiveLayer, removeHotspotFromCollection, removePlacedItemFromCollection,
  removePlacedNpcFromCollection, removePlacedPlayerFromCollection, reorderHotspotCollection, reorderPlacedItemCollection, updateHotspotInCollection,
  updatePlacedItemInCollection, upsertPlacedNpcInCollection, upsertPlacedPlayerInCollection
} from "@/features/editor/scene/layer/editorLayerInteractionHelpersSlice";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import type { DeleteApplyFn } from "@/features/editor/delete/editorDeleteSlice";

export type InteractionKind = "hotspot" | "placedItem" | "placedNpc" | "placedPlayer";

/* Contrato mínimo del store que necesita este slice */
type EditorStoreLike = {
  nodeDraft: Node | null;
  activeLayerId: ID | null;
  requestDelete: (input: {
    target: DeleteTarget;
    apply: DeleteApplyFn;
  }) => void;
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
  reorderHotspots: (fromIndex: number, toIndex: number) => void;
  getActiveHotspots: () => Hotspot[];
  setActiveHotspots: (hotspots: Hotspot[]) => void;

  addPlacedItem: (placedItem: PlacedItem) => void;
  updatePlacedItem: (placedItemId: ID, patch: Partial<PlacedItem>) => void;
  removePlacedItem: (placedItemId: ID, options?: { withConfirmation?: boolean }) => void;
  reorderPlacedItems: (fromIndex: number, toIndex: number) => void;
  getActivePlacedItems: () => PlacedItem[];
  setActivePlacedItems: (placedItems: PlacedItem[]) => void;

  upsertPlacedNpc: (placedNpc: PlacedNpc) => void;
  removePlacedNpc: (npcId: ID, options?: { withConfirmation?: boolean }) => void;
  getActivePlacedNpcs: () => PlacedNpc[];
  setActivePlacedNpcs: (placedNpcs: PlacedNpc[]) => void;

  upsertPlacedPlayer: (placedPlayer: PlacedPlayer) => void;
  removePlacedPlayer: (playerId: ID, options?: { withConfirmation?: boolean }) => void;
  getActivePlacedPlayers: () => PlacedPlayer[];
  setActivePlacedPlayers: (placedPlayers: PlacedPlayer[]) => void;
}

type Store = EditorStoreLike & EditorLayerInteractionsSlice;

export function createEditorLayerInteractionsSlice(set: (partial: | Partial<Store> | ((state: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorLayerInteractionsSlice {

  function removeHotspotFromState(state: Store, hotspotId: ID): Store {
    if (!state.nodeDraft || !state.activeLayerId) return state;

    const layers0 = state.nodeDraft.layers ?? [];
    const layerIndex = layers0.findIndex((layer) => layer.id === state.activeLayerId);
    if (layerIndex < 0) return state;

    const layer0 = ensureInteractionsArrays(layers0[layerIndex]!);
    const nextHotspots = removeHotspotFromCollection(layer0.hotspots, hotspotId);
    if (!nextHotspots) return state;

    const nextLayers = layers0.slice();
    nextLayers[layerIndex] = {
      ...layer0,
      hotspots: nextHotspots,
    };

    const removedSelected =
      state.selectedInteractionKind === "hotspot" &&
      state.selectedInteractionId === hotspotId;

    return {
      ...state,
      nodeDraft: {
        ...state.nodeDraft,
        layers: nextLayers,
      },
      selectedInteractionKind: removedSelected ? null : state.selectedInteractionKind,
      selectedInteractionId: removedSelected ? null : state.selectedInteractionId,
    };
  }

  function removePlacedItemFromState(state: Store, placedItemId: ID): Store {
    if (!state.nodeDraft || !state.activeLayerId) return state;

    const layers0 = state.nodeDraft.layers ?? [];
    const layerIndex = layers0.findIndex((layer) => layer.id === state.activeLayerId);
    if (layerIndex < 0) return state;

    const layer0 = ensureInteractionsArrays(layers0[layerIndex]!);
    const nextPlacedItems = removePlacedItemFromCollection(layer0.placedItems, placedItemId);
    if (!nextPlacedItems) return state;

    const nextLayers = layers0.slice();
    nextLayers[layerIndex] = {
      ...layer0,
      placedItems: nextPlacedItems,
    };

    const removedSelected =
      state.selectedInteractionKind === "placedItem" &&
      state.selectedInteractionId === placedItemId;

    return {
      ...state,
      nodeDraft: {
        ...state.nodeDraft,
        layers: nextLayers,
      },
      selectedInteractionKind: removedSelected ? null : state.selectedInteractionKind,
      selectedInteractionId: removedSelected ? null : state.selectedInteractionId,
    };
  }

  function removePlacedNpcFromState(state: Store, npcId: ID): Store {
    if (!state.nodeDraft || !state.activeLayerId) return state;

    const layers0 = state.nodeDraft.layers ?? [];
    const layerIndex = layers0.findIndex((layer) => layer.id === state.activeLayerId);
    if (layerIndex < 0) return state;

    const layer0 = ensureInteractionsArrays(layers0[layerIndex]!);
    const nextPlacedNpcs = removePlacedNpcFromCollection(layer0.placedNpcs, npcId);
    if (!nextPlacedNpcs) return state;

    const nextLayers = layers0.slice();
    nextLayers[layerIndex] = {
      ...layer0,
      placedNpcs: nextPlacedNpcs,
    };

    const removedSelected =
      state.selectedInteractionKind === "placedNpc" &&
      state.selectedInteractionId === npcId;

    return {
      ...state,
      nodeDraft: {
        ...state.nodeDraft,
        layers: nextLayers,
      },
      selectedInteractionKind: removedSelected ? null : state.selectedInteractionKind,
      selectedInteractionId: removedSelected ? null : state.selectedInteractionId,
    };
  }

  function removePlacedPlayerFromState(state: Store, playerId: ID): Store {
    if (!state.nodeDraft || !state.activeLayerId) return state;

    const layers0 = state.nodeDraft.layers ?? [];
    const layerIndex = layers0.findIndex((layer) => layer.id === state.activeLayerId);
    if (layerIndex < 0) return state;

    const layer0 = ensureInteractionsArrays(layers0[layerIndex]!);
    const nextPlacedPlayers = removePlacedPlayerFromCollection(layer0.placedPlayers, playerId);
    if (!nextPlacedPlayers) return state;

    const nextLayers = layers0.slice();
    nextLayers[layerIndex] = {
      ...layer0,
      placedPlayers: nextPlacedPlayers,
    };

    const removedSelected =
      state.selectedInteractionKind === "placedPlayer" &&
      state.selectedInteractionId === playerId;

    return {
      ...state,
      nodeDraft: {
        ...state.nodeDraft,
        layers: nextLayers,
      },
      selectedInteractionKind: removedSelected ? null : state.selectedInteractionKind,
      selectedInteractionId: removedSelected ? null : state.selectedInteractionId,
    };
  }

  function withActiveLayer(updater: (layer: SceneImageLayer) => SceneImageLayer): void {
    set((state) => {
      if (!state.nodeDraft || !state.activeLayerId) return state;

      const layers0 = state.nodeDraft.layers ?? [];
      const index = layers0.findIndex((layer) => layer.id === state.activeLayerId);
      if (index < 0) return state;

      const prev0 = layers0[index]!;
      const prev = ensureInteractionsArrays(prev0);
      const next = updater(prev);

      if (next === prev0 || next === prev) return state;

      const layers1 = layers0.slice();
      layers1[index] = next;

      return { ...state, nodeDraft: { ...state.nodeDraft, layers: layers1 } };
    });
  }

  return {
    selectedInteractionKind: null,
    selectedInteractionId: null,

    setSelectedInteractionKind: (kind) =>
      set((state) => ({
        ...state,
        selectedInteractionKind: kind,
        selectedInteractionId: null,
      })),

    setSelectedInteractionId: (id) => set({ selectedInteractionId: id }),

    clearInteractionSelection: () =>
      set({
        selectedInteractionKind: null,
        selectedInteractionId: null,
      }),

    /* Hotspots */
    addHotspot: (hotspot) => {
      withActiveLayer((layer) => ({
        ...layer,
        hotspots: appendHotspot(layer.hotspots, hotspot),
      }));
    },

    updateHotspot: (hotspotId, patch) => {
      withActiveLayer((layer) => {
        const nextHotspots = updateHotspotInCollection(layer.hotspots, hotspotId, patch);
        if (!nextHotspots) return layer;

        return {
          ...layer,
          hotspots: nextHotspots,
        };
      });
    },

    removeHotspot: (hotspotId, options) => {
      const withConfirmation = options?.withConfirmation ?? false;

      const state = get();
      const nodeId = state.nodeDraft?.id;
      const layerId = state.activeLayerId;

      if (!nodeId || !layerId) return;

      if (withConfirmation) {
        state.requestDelete({
          target: {
            kind: "hotspot",
            nodeId,
            layerId,
            hotspotId,
          },
          apply: (currentState) =>
            removeHotspotFromState(currentState as unknown as Store, hotspotId),
        });

        return;
      }

      set((currentState) => removeHotspotFromState(currentState, hotspotId));
    },

    reorderHotspots: (fromIndex, toIndex) => {
      withActiveLayer((layer) => {
        const nextHotspots = reorderHotspotCollection(layer.hotspots, fromIndex, toIndex);
        if (!nextHotspots) return layer;

        return {
          ...layer,
          hotspots: nextHotspots,
        };
      });
    },

    getActiveHotspots: () => {
      const layer = readActiveLayer(get());
      return (layer?.hotspots ?? []) as Hotspot[];
    },

    setActiveHotspots: (hotspots) => {
      withActiveLayer((layer) => ({
        ...layer,
        hotspots: Array.isArray(hotspots) ? hotspots : [],
      }));
    },

    /* Placed items */
    addPlacedItem: (placedItem) => {
      withActiveLayer((layer) => ({
        ...layer,
        placedItems: appendPlacedItem(layer.placedItems, placedItem),
      }));
    },

    updatePlacedItem: (placedItemId, patch) => {
      withActiveLayer((layer) => {
        const nextPlacedItems = updatePlacedItemInCollection(layer.placedItems, placedItemId, patch);
        if (!nextPlacedItems) return layer;

        return {
          ...layer,
          placedItems: nextPlacedItems,
        };
      });
    },

    removePlacedItem: (placedItemId, options) => {
      const withConfirmation = options?.withConfirmation ?? false;

      const state = get();
      const nodeId = state.nodeDraft?.id;
      const layerId = state.activeLayerId;

      if (!nodeId || !layerId) return;

      if (withConfirmation) {
        state.requestDelete({
          target: {
            kind: "placedItem",
            nodeId,
            layerId,
            placedItemId,
          },
          apply: (currentState) =>
            removePlacedItemFromState(currentState as unknown as Store, placedItemId),
        });

        return;
      }

      set((currentState) => removePlacedItemFromState(currentState, placedItemId));
    },

    reorderPlacedItems: (fromIndex, toIndex) => {
      withActiveLayer((layer) => {
        const nextPlacedItems = reorderPlacedItemCollection(layer.placedItems, fromIndex, toIndex);
        if (!nextPlacedItems) return layer;

        return {
          ...layer,
          placedItems: nextPlacedItems,
        };
      });
    },

    getActivePlacedItems: () => {
      const layer = readActiveLayer(get());
      return (layer?.placedItems ?? []) as PlacedItem[];
    },

    setActivePlacedItems: (placedItems) => {
      withActiveLayer((layer) => ({
        ...layer,
        placedItems: Array.isArray(placedItems) ? placedItems : [],
      }));
    },

    /* Placed NPCs */
    upsertPlacedNpc: (placedNpc) => {
      withActiveLayer((layer) => ({
        ...layer,
        placedNpcs: upsertPlacedNpcInCollection(layer.placedNpcs, placedNpc),
      }));
    },

    removePlacedNpc: (npcId, options) => {
      const withConfirmation = options?.withConfirmation ?? false;

      const state = get();
      const nodeId = state.nodeDraft?.id;
      const layerId = state.activeLayerId;

      if (!nodeId || !layerId) return;

      if (withConfirmation) {
        state.requestDelete({
          target: {
            kind: "placedNpc",
            nodeId,
            layerId,
            npcId,
          },
          apply: (currentState) =>
            removePlacedNpcFromState(currentState as unknown as Store, npcId),
        });

        return;
      }

      set((currentState) => removePlacedNpcFromState(currentState, npcId));
    },

    getActivePlacedNpcs: () => {
      const layer = readActiveLayer(get());
      return layer?.placedNpcs ?? [];
    },

    setActivePlacedNpcs: (placedNpcs) => {
      withActiveLayer((layer) => ({
        ...layer,
        placedNpcs: Array.isArray(placedNpcs) ? placedNpcs : [],
      }));
    },

    /* Placed Players */
    upsertPlacedPlayer: (placedPlayer) => {
      withActiveLayer((layer) => ({
        ...layer,
        placedPlayers: upsertPlacedPlayerInCollection(layer.placedPlayers, placedPlayer),
      }));
    },

    removePlacedPlayer: (playerId, options) => {
      const withConfirmation = options?.withConfirmation ?? false;

      const state = get();
      const nodeId = state.nodeDraft?.id;
      const layerId = state.activeLayerId;

      if (!nodeId || !layerId) return;

      if (withConfirmation) {
        state.requestDelete({
          target: {
            kind: "placedPlayer",
            nodeId,
            layerId,
            playerId,
          },
          apply: (currentState) =>
            removePlacedPlayerFromState(currentState as unknown as Store, playerId),
        });

        return;
      }

      set((currentState) => removePlacedPlayerFromState(currentState, playerId));
    },

    getActivePlacedPlayers: () => {
      const layer = readActiveLayer(get());
      return layer?.placedPlayers ?? [];
    },

    setActivePlacedPlayers: (placedPlayers) => {
      withActiveLayer((layer) => ({
        ...layer,
        placedPlayers: Array.isArray(placedPlayers) ? placedPlayers : [],
      }));
    },
  };
}