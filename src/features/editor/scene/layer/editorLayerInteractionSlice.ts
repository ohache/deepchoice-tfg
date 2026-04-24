import type { ID, Node, SceneImageLayer, Hotspot, PlacedItem, PlacedNpc, PlacedPlayer } from "@/domain/types";
import { appendHotspot, appendPlacedItem, ensureInteractionsArrays, readActiveLayer, removeHotspotFromCollection, removePlacedItemFromCollection,
  removePlacedNpcFromCollection, removePlacedPlayerFromCollection, reorderHotspotCollection, reorderPlacedItemCollection, updateHotspotInCollection,
  updatePlacedItemInCollection, upsertPlacedNpcInCollection, upsertPlacedPlayerInCollection } from "@/features/editor/scene/layer/editorLayerInteractionHelpersSlice";

export type InteractionKind = "hotspot" | "placedItem" | "placedNpc" | "placedPlayer";

/* Contrato mínimo del store que necesita este slice */
type EditorStoreLike = {
  nodeDraft: Node | null;
  activeLayerId: ID | null;
};

export interface EditorLayerInteractionsSlice {
  selectedInteractionKind: InteractionKind | null;
  selectedInteractionId: ID | null;

  setSelectedInteractionKind: (kind: InteractionKind | null) => void;
  setSelectedInteractionId: (id: ID | null) => void;
  clearInteractionSelection: () => void;

  addHotspot: (hotspot: Hotspot) => void;
  updateHotspot: (hotspotId: ID, patch: Partial<Hotspot>) => void;
  removeHotspot: (hotspotId: ID) => void;
  reorderHotspots: (fromIndex: number, toIndex: number) => void;
  getActiveHotspots: () => Hotspot[];
  setActiveHotspots: (hotspots: Hotspot[]) => void;

  addPlacedItem: (placedItem: PlacedItem) => void;
  updatePlacedItem: (placedItemId: ID, patch: Partial<PlacedItem>) => void;
  removePlacedItem: (placedItemId: ID) => void;
  reorderPlacedItems: (fromIndex: number, toIndex: number) => void;
  getActivePlacedItems: () => PlacedItem[];
  setActivePlacedItems: (placedItems: PlacedItem[]) => void;

  upsertPlacedNpc: (placedNpc: PlacedNpc) => void;
  removePlacedNpc: (npcId: ID) => void;
  getActivePlacedNpcs: () => PlacedNpc[];
  setActivePlacedNpcs: (placedNpcs: PlacedNpc[]) => void;

  upsertPlacedPlayer: (placedPlayer: PlacedPlayer) => void;
  removePlacedPlayer: (playerId: ID) => void;
  getActivePlacedPlayers: () => PlacedPlayer[];
  setActivePlacedPlayers: (placedPlayers: PlacedPlayer[]) => void;
}

type Store = EditorStoreLike & EditorLayerInteractionsSlice;

export function createEditorLayerInteractionsSlice(set: (partial: | Partial<Store> | ((state: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorLayerInteractionsSlice {
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

      return { ...state, nodeDraft: { ...state.nodeDraft, layers: layers1 }};
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

    removeHotspot: (hotspotId) => {
      withActiveLayer((layer) => {
        const nextHotspots = removeHotspotFromCollection(layer.hotspots, hotspotId);
        if (!nextHotspots) return layer;

        return {
          ...layer,
          hotspots: nextHotspots,
        };
      });
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

    removePlacedItem: (placedItemId) => {
      withActiveLayer((layer) => {
        const nextPlacedItems = removePlacedItemFromCollection(layer.placedItems, placedItemId);
        if (!nextPlacedItems) return layer;

        return {
          ...layer,
          placedItems: nextPlacedItems,
        };
      });
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

    removePlacedNpc: (npcId) => {
      withActiveLayer((layer) => {
        const nextPlacedNpcs = removePlacedNpcFromCollection(layer.placedNpcs, npcId);
        if (!nextPlacedNpcs) return layer;

        return {
          ...layer,
          placedNpcs: nextPlacedNpcs,
        };
      });
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

    removePlacedPlayer: (playerId) => {
      withActiveLayer((layer) => {
        const nextPlacedPlayers = removePlacedPlayerFromCollection(layer.placedPlayers, playerId);
        if (!nextPlacedPlayers) return layer;

        return {
          ...layer,
          placedPlayers: nextPlacedPlayers,
        };
      });
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