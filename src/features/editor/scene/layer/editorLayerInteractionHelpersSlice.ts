import type { ID, Node, SceneImageLayer, Hotspot, PlacedItem, PlacedNpc, PlacedPlayer } from "@/domain/types";

/* Estado mínimo que necesitan los helpers para localizar la layer activa */
export type LayerInteractionStoreLike = {
  nodeDraft: Node | null;
  activeLayerId: ID | null;
};

/* Garantiza que los índices inválidos no rompan el ordenado */
export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (items.length <= 1) return items;
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  if (toIndex < 0 || toIndex >= items.length) return items;

  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/* Devuelve la layer activa del editor */
export function readActiveLayer(state: LayerInteractionStoreLike): SceneImageLayer | null {
  if (!state.nodeDraft || !state.activeLayerId) return null;
  return state.nodeDraft.layers?.find((layer) => layer.id === state.activeLayerId) ?? null;
}

/* Asegura que existan siempre las colecciones de interacciones */
export function ensureInteractionsArrays(layer: SceneImageLayer): SceneImageLayer {
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

/* Añade un elemento al final de una colección */
export function appendToCollection<T>(items: T[] | undefined, item: T): T[] {
  return [...(items ?? []), item];
}

/* Actualiza un elemento encontrado por predicado */
export function updateCollectionItem<T>(items: T[] | undefined, predicate: (item: T) => boolean, patch: Partial<T>): T[] | null {
  const base = items ?? [];
  const index = base.findIndex(predicate);
  if (index < 0) return null;

  const prev = base[index]!;
  const next = { ...prev, ...patch } as T;

  const out = base.slice();
  out[index] = next;
  return out;
}

/* Elimina elementos por predicado */
export function removeCollectionItem<T>(items: T[] | undefined,  predicate: (item: T) => boolean): T[] | null {
  const base = items ?? [];
  const next = base.filter((item) => !predicate(item));

  return next.length === base.length ? null : next;
}

/* Reordena una colección */
export function reorderCollection<T>(items: T[] | undefined, fromIndex: number, toIndex: number): T[] | null {
  const base = items ?? [];
  const next = reorderItems(base, fromIndex, toIndex);

  return next === base ? null : next;
}

/* Upsert genérico por predicado */
export function upsertCollectionItem<T>(items: T[] | undefined, incoming: T, predicate: (item: T) => boolean): T[] {
  const base = items ?? [];
  const index = base.findIndex(predicate);

  if (index < 0) return [...base, incoming];

  const prev = base[index]!;
  const next = { ...prev, ...incoming };

  const out = base.slice();
  out[index] = next;
  return out;
}

/* Helpers tipados por colección para dejar el slice más legible */
export function appendHotspot(hotspots: Hotspot[] | undefined, hotspot: Hotspot): Hotspot[] {
  return appendToCollection(hotspots, hotspot);
}

export function updateHotspotInCollection(hotspots: Hotspot[] | undefined, hotspotId: ID, patch: Partial<Hotspot>): Hotspot[] | null {
  return updateCollectionItem(hotspots, (hotspot) => hotspot.id === hotspotId, patch);
}

export function removeHotspotFromCollection(hotspots: Hotspot[] | undefined, hotspotId: ID): Hotspot[] | null {
  return removeCollectionItem(hotspots, (hotspot) => hotspot.id === hotspotId);
}

export function reorderHotspotCollection(hotspots: Hotspot[] | undefined, fromIndex: number, toIndex: number): Hotspot[] | null {
  return reorderCollection(hotspots, fromIndex, toIndex);
}

export function appendPlacedItem(placedItems: PlacedItem[] | undefined, placedItem: PlacedItem): PlacedItem[] {
  return appendToCollection(placedItems, placedItem);
}

export function updatePlacedItemInCollection(placedItems: PlacedItem[] | undefined, placedItemId: ID, patch: Partial<PlacedItem>): PlacedItem[] | null {
  return updateCollectionItem(placedItems, (item) => item.id === placedItemId, patch);
}

export function removePlacedItemFromCollection(placedItems: PlacedItem[] | undefined, placedItemId: ID): PlacedItem[] | null {
  return removeCollectionItem(placedItems, (item) => item.id === placedItemId);
}

export function reorderPlacedItemCollection(placedItems: PlacedItem[] | undefined, fromIndex: number, toIndex: number): PlacedItem[] | null {
  return reorderCollection(placedItems, fromIndex, toIndex);
}

export function upsertPlacedNpcInCollection(placedNpcs: PlacedNpc[] | undefined, placedNpc: PlacedNpc): PlacedNpc[] {
  return upsertCollectionItem(placedNpcs, placedNpc, (npc) => npc.npcId === placedNpc.npcId);
}

export function removePlacedNpcFromCollection(placedNpcs: PlacedNpc[] | undefined, npcId: ID): PlacedNpc[] | null {
  return removeCollectionItem(placedNpcs, (npc) => npc.npcId === npcId);
}

export function upsertPlacedPlayerInCollection(placedPlayers: PlacedPlayer[] | undefined, placedPlayer: PlacedPlayer): PlacedPlayer[] {
  return upsertCollectionItem(placedPlayers, placedPlayer, (player) => player.playerId === placedPlayer.playerId);
}

export function removePlacedPlayerFromCollection(placedPlayers: PlacedPlayer[] | undefined, playerId: ID): PlacedPlayer[] | null {
  return removeCollectionItem(placedPlayers, (player) => player.playerId === playerId);
}