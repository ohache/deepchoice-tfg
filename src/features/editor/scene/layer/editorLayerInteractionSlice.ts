import type { ID, Node, SceneImageLayer, Hotspot, PlacedItem, PlacedNpc, PlacedPlayer } from "@/domain/types";

export type InteractionKind = | "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" ;

/* Mínimo contrato del store que necesita este slice */
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

/* Helpers */
function reorder<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  if (arr.length <= 1) return arr;
  if (fromIndex === toIndex) return arr;
  if (fromIndex < 0 || fromIndex >= arr.length) return arr;
  if (toIndex < 0 || toIndex >= arr.length) return arr;

  const next = arr.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function readActiveLayer(s: EditorStoreLike): SceneImageLayer | null {
  if (!s.nodeDraft || !s.activeLayerId) return null;
  return s.nodeDraft.layers?.find((l) => l.id === s.activeLayerId) ?? null;
}

function ensureInteractionsArrays(layer: SceneImageLayer): SceneImageLayer {
  let changed = false;
  const next: SceneImageLayer = { ...layer };

  if (!next.hotspots) {
    next.hotspots = [];
    changed = true;
  }
  if (!next.placedItems) {
    next.placedItems = [];
    changed = true;
  }
  if (!next.placedNpcs) {
    next.placedNpcs = [];
    changed = true;
  }
  if (!next.placedPlayers) {
    next.placedPlayers = [];
    changed = true;
  }

  return changed ? next : layer;
}

export function createEditorLayerInteractionsSlice(set: ( partial: Partial<Store> | ((state: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorLayerInteractionsSlice {

  function withActiveLayer(updater: (layer: SceneImageLayer) => SceneImageLayer): void {
    set((s) => {
      if (!s.nodeDraft || !s.activeLayerId) return s;

      const layers0 = s.nodeDraft.layers ?? [];
      const idx = layers0.findIndex((l) => l.id === s.activeLayerId);
      if (idx < 0) return s;

      const prev0 = layers0[idx]!;
      const prev = ensureInteractionsArrays(prev0);
      const next = updater(prev);

      if (next === prev0 || next === prev) return s;

      const layers1 = layers0.slice();
      layers1[idx] = next;

      return { ...s, nodeDraft: { ...s.nodeDraft, layers: layers1 } };
    });
  }

  return {
    selectedInteractionKind: null,
    
    selectedInteractionId: null,

    setSelectedInteractionKind: (kind) =>
      set((s) => ({
        ...s,
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
      withActiveLayer((layer) => {
        const hotspots0 = layer.hotspots ?? [];
        return { ...layer, hotspots: [...hotspots0, hotspot] };
      });
    },

    updateHotspot: (hotspotId, patch) => {
      withActiveLayer((layer) => {
        const hotspots0 = layer.hotspots ?? [];
        const idx = hotspots0.findIndex((h) => h.id === hotspotId);
        if (idx < 0) return layer;

        const prev = hotspots0[idx]!;
        const next = { ...prev, ...patch };

        const hotspots1 = hotspots0.slice();
        hotspots1[idx] = next;

        return { ...layer, hotspots: hotspots1 };
      });
    },

    removeHotspot: (hotspotId) => {
      withActiveLayer((layer) => {
        const hotspots0 = layer.hotspots ?? [];
        const next = hotspots0.filter((h) => h.id !== hotspotId);
        if (next.length === hotspots0.length) return layer;
        return { ...layer, hotspots: next };
      });
    },

    reorderHotspots: (fromIndex, toIndex) => {
      withActiveLayer((layer) => {
        const hotspots0 = layer.hotspots ?? [];
        const next = reorder(hotspots0, fromIndex, toIndex);
        if (next === hotspots0) return layer;
        return { ...layer, hotspots: next };
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
      withActiveLayer((layer) => {
        const items0 = layer.placedItems ?? [];
        return { ...layer, placedItems: [...items0, placedItem] };
      });
    },

    updatePlacedItem: (placedItemId, patch) => {
      withActiveLayer((layer) => {
        const items0 = layer.placedItems ?? [];
        const idx = items0.findIndex((p) => p.id === placedItemId);
        if (idx < 0) return layer;

        const prev = items0[idx]!;
        const next = { ...prev, ...patch };

        const items1 = items0.slice();
        items1[idx] = next;

        return { ...layer, placedItems: items1 };
      });
    },

    removePlacedItem: (placedItemId) => {
      withActiveLayer((layer) => {
        const items0 = layer.placedItems ?? [];
        const next = items0.filter((p) => p.id !== placedItemId);
        if (next.length === items0.length) return layer;
        return { ...layer, placedItems: next };
      });
    },

    reorderPlacedItems: (fromIndex, toIndex) => {
      withActiveLayer((layer) => {
        const items0 = layer.placedItems ?? [];
        const next = reorder(items0, fromIndex, toIndex);
        if (next === items0) return layer;
        return { ...layer, placedItems: next };
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

    /* Placed NPC */
    upsertPlacedNpc: (placedNpc) => {
      withActiveLayer((layer) => {
        const npcs0 = layer.placedNpcs ?? [];
        const idx = npcs0.findIndex((p) => p.npcId === placedNpc.npcId);

        if (idx < 0) return { ...layer, placedNpcs: [...npcs0, placedNpc] };

        const prev = npcs0[idx]!;
        const next = { ...prev, ...placedNpc };

        const npcs1 = npcs0.slice();
        npcs1[idx] = next;

        return { ...layer, placedNpcs: npcs1 };
      });
    },

    removePlacedNpc: (npcId) => {
      withActiveLayer((layer) => {
        const npcs0 = layer.placedNpcs ?? [];
        const next = npcs0.filter((p) => p.npcId !== npcId);
        if (next.length === npcs0.length) return layer;
        return { ...layer, placedNpcs: next };
      });
    },

    getActivePlacedNpcs: () => {
      const layer = readActiveLayer(get());
      return (layer?.placedNpcs ?? []) as PlacedNpc[];
    },

    setActivePlacedNpcs: (placedNpcs) => {
      withActiveLayer((layer) => ({
        ...layer,
        placedNpcs: Array.isArray(placedNpcs) ? placedNpcs : [],
      }));
    },

    /* Placed Player */
    upsertPlacedPlayer: (placedPlayer) => {
      withActiveLayer((layer) => {
        const players0 = layer.placedPlayers ?? [];
        const idx = players0.findIndex((p) => p.playerId === placedPlayer.playerId);

        if (idx < 0) return { ...layer, placedPlayers: [...players0, placedPlayer] };

        const prev = players0[idx]!;
        const next = { ...prev, ...placedPlayer };

        const players1 = players0.slice();
        players1[idx] = next;

        return { ...layer, placedPlayers: players1 };
      });
    },

    removePlacedPlayer: (playerId) => {
      withActiveLayer((layer) => {
        const players0 = layer.placedPlayers ?? [];
        const next = players0.filter((p) => p.playerId !== playerId);
        if (next.length === players0.length) return layer;
        return { ...layer, placedPlayers: next };
      });
    },

    getActivePlacedPlayers: () => {
      const layer = readActiveLayer(get());
      return (layer?.placedPlayers ?? []) as PlacedPlayer[];
    },

    setActivePlacedPlayers: (placedPlayers) => {
      withActiveLayer((layer) => ({
        ...layer,
        placedPlayers: Array.isArray(placedPlayers) ? placedPlayers : [],
      }));
    },
  };
}