import type { ID, Node, SceneImageLayer, Hotspot, ItemInstance, PlacedNpc, PlacedPlayer } from "@/domain/types";
import type { InteractionKind } from "./editorLayerSlice";

/* Estado mínimo que necesitan los helpers para localizar la layer activa */
export type LayerInteractionStoreLike = {
  nodeDraft: Node | null;
  activeLayerId: ID | null;
};

/* Garantiza que los índices inválidos no rompan el ordenado */
function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (items.length <= 1) return items;
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  if (toIndex < 0 || toIndex >= items.length) return items;

  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
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
function appendToCollection<T>(items: T[] | undefined, item: T): T[] {
  return [...(items ?? []), item];
}

/* Actualiza un elemento encontrado por predicado */
function updateCollectionItem<T>(items: T[] | undefined, predicate: (item: T) => boolean, patch: Partial<T>): T[] | null {
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
function removeCollectionItem<T>(items: T[] | undefined,  predicate: (item: T) => boolean): T[] | null {
  const base = items ?? [];
  const next = base.filter((item) => !predicate(item));

  return next.length === base.length ? null : next;
}

/* Reordena una colección */
function reorderCollection<T>(items: T[] | undefined, fromIndex: number, toIndex: number): T[] | null {
  const base = items ?? [];
  const next = reorderItems(base, fromIndex, toIndex);

  return next === base ? null : next;
}

/* Upsert genérico por predicado */
function upsertCollectionItem<T>(items: T[] | undefined, incoming: T, predicate: (item: T) => boolean): T[] {
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

function removeHotspotFromCollection(hotspots: Hotspot[] | undefined, hotspotId: ID): Hotspot[] | null {
  return removeCollectionItem(hotspots, (hotspot) => hotspot.id === hotspotId);
}

export function reorderHotspotCollection(hotspots: Hotspot[] | undefined, fromIndex: number, toIndex: number): Hotspot[] | null {
  return reorderCollection(hotspots, fromIndex, toIndex);
}

export function appendPlacedItem(ItemInstances: ItemInstance[] | undefined, ItemInstance: ItemInstance): ItemInstance[] {
  return appendToCollection(ItemInstances, ItemInstance);
}

export function updatePlacedItemInCollection(ItemInstances: ItemInstance[] | undefined, ItemInstanceId: ID, patch: Partial<ItemInstance>): ItemInstance[] | null {
  return updateCollectionItem(ItemInstances, (item) => item.itemInstanceId === ItemInstanceId, patch);
}

function removePlacedItemFromCollection(ItemInstances: ItemInstance[] | undefined, ItemInstanceId: ID): ItemInstance[] | null {
  return removeCollectionItem(ItemInstances, (item) => item.itemInstanceId === ItemInstanceId);
}

export function reorderPlacedItemCollection(ItemInstances: ItemInstance[] | undefined, fromIndex: number, toIndex: number): ItemInstance[] | null {
  return reorderCollection(ItemInstances, fromIndex, toIndex);
}

export function upsertPlacedNpcInCollection(placedNpcs: PlacedNpc[] | undefined, placedNpc: PlacedNpc): PlacedNpc[] {
  return upsertCollectionItem(placedNpcs, placedNpc, (npc) => npc.npcId === placedNpc.npcId);
}

function removePlacedNpcFromCollection(placedNpcs: PlacedNpc[] | undefined, npcId: ID): PlacedNpc[] | null {
  return removeCollectionItem(placedNpcs, (npc) => npc.npcId === npcId);
}

export function upsertPlacedPlayerInCollection(placedPlayers: PlacedPlayer[] | undefined, placedPlayer: PlacedPlayer): PlacedPlayer[] {
  return upsertCollectionItem(placedPlayers, placedPlayer, (player) => player.playerId === placedPlayer.playerId);
}

export function removePlacedPlayerFromCollection(placedPlayers: PlacedPlayer[] | undefined, playerId: ID): PlacedPlayer[] | null {
  return removeCollectionItem(placedPlayers, (player) => player.playerId === playerId);
}

function getActiveLayerIndex(nodeDraft: Node | null, activeLayerId: ID | null): number {
  if (!nodeDraft || !activeLayerId) return -1;

  return (nodeDraft.layers ?? []).findIndex((layer) => layer.id === activeLayerId);
}

export function clearRemovedInteractionSelection(selectedInteractionKind: InteractionKind | null, selectedInteractionId: ID | null,
  removedKind: InteractionKind, removedId: ID,): { selectedInteractionKind: InteractionKind | null; selectedInteractionId: ID | null;} {
  const removedSelected = selectedInteractionKind === removedKind && selectedInteractionId === removedId;

  return {
    selectedInteractionKind: removedSelected ? null : selectedInteractionKind,
    selectedInteractionId: removedSelected ? null : selectedInteractionId,
  };
}

function replaceActiveLayer(nodeDraft: Node | null, activeLayerId: ID | null, nextLayer: SceneImageLayer): Node | null {
  if (!nodeDraft) return nodeDraft;

  const layerIndex = getActiveLayerIndex(nodeDraft, activeLayerId);
  if (layerIndex < 0) return nodeDraft;

  const nextLayers = nodeDraft.layers.slice();
  nextLayers[layerIndex] = nextLayer;

  return { ...nodeDraft, layers: nextLayers };
}

export function removeInteractionFromActiveLayer(nodeDraft: Node | null, activeLayerId: ID | null, kind: InteractionKind, id: ID): Node | null {
  const layerIndex = getActiveLayerIndex(nodeDraft, activeLayerId);
  if (!nodeDraft || layerIndex < 0) return nodeDraft;

  const layer = ensureInteractionsArrays(nodeDraft.layers[layerIndex]!);

  let nextLayer: SceneImageLayer | null = null;

  if (kind === "hotspot") {
    const nextHotspots = removeHotspotFromCollection(layer.hotspots, id);
    if (!nextHotspots) return nodeDraft;

    nextLayer = { ...layer, hotspots: nextHotspots };
  }

  if (kind === "placedItem") {
    const nextPlacedItems = removePlacedItemFromCollection(layer.placedItems, id);
    if (!nextPlacedItems) return nodeDraft;

    nextLayer = { ...layer, placedItems: nextPlacedItems };
  }

  if (kind === "placedNpc") {
    const nextPlacedNpcs = removePlacedNpcFromCollection(layer.placedNpcs, id);
    if (!nextPlacedNpcs) return nodeDraft;

    nextLayer = { ...layer, placedNpcs: nextPlacedNpcs };
  }

  if (kind === "placedPlayer") {
    const nextPlacedPlayers = removePlacedPlayerFromCollection(layer.placedPlayers, id);
    if (!nextPlacedPlayers) return nodeDraft;

    nextLayer = { ...layer, placedPlayers: nextPlacedPlayers };
  }

  if (!nextLayer) return nodeDraft;

  return replaceActiveLayer(nodeDraft, activeLayerId, nextLayer);
}

