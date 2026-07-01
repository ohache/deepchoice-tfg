import { useEffect, useMemo, useRef } from "react";
import type { Hotspot, ID, ItemInstance, PlacedNpc, PlacedPlayer, Project, SceneImageLayer, Node } from "@/domain/types";
import type { HotspotDraft } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { PlacedItemDraft } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import type { PlacedNpcDraft } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import type { ClickableRegion } from "@/features/editor/scene/clickableCollisions";


export function normKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

type BuildClickableRegionsArgs = {
  project: Project | null;
  hotspots: Hotspot[];
  placedItems: ItemInstance[];
  placedNpcs: PlacedNpc[];
  placedPlayers: PlacedPlayer[];
};

function displayName(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? "").trim();
  return normalized || fallback;
}

/* Construye la lista de regiones interactivas visibles de la escena para detección de clics y colisiones */
export function buildClickableRegions({ project, hotspots, placedItems, placedNpcs, placedPlayers}: BuildClickableRegionsArgs): ClickableRegion[] {
  const itemsById = new Map((project?.items ?? []).map((item) => [item.id, item]));
  const npcsById = new Map((project?.npcs ?? []).map((npc) => [npc.id, npc]));
  const playersById = new Map((project?.players ?? []).map((player) => [player.id, player]));

  const regions: ClickableRegion[] = [];

  for (const hotspot of hotspots) {
    regions.push({ kind: "hotspot", id: hotspot.id, label: displayName(hotspot.label, "(sin label)"), shape: hotspot.shape });
  }

  for (const placedItem of placedItems) {
    const shape = placedItem.placement?.shape;
    if (!shape) continue;

    const baseName = displayName(itemsById.get(placedItem.itemId)?.name, "Objeto");
    const instanceLabel = (placedItem.label ?? "").trim();

    regions.push({ kind: "item", id: placedItem.itemInstanceId, label: instanceLabel ? `${baseName} (${instanceLabel})` : baseName, shape });
  }

  for (const placedNpc of placedNpcs) {
    const name = displayName(npcsById.get(placedNpc.npcId)?.name, "PNJ");

    regions.push({ kind: "npc", id: placedNpc.npcId, label: name, shape: placedNpc.shape });
  }

  for (const placedPlayer of placedPlayers) {
    const name = displayName(playersById.get(placedPlayer.playerId)?.name, "Jugador");

    regions.push({ kind: "player", id: placedPlayer.playerId, label: name, shape: placedPlayer.shape });
  }

  return regions;
}

type UseActiveSceneLayerArgs = {
  active: boolean;
  layerId: ID;
  activeLayerId: ID | null;
  setActiveLayerId: (layerId: ID) => void;
  layers: SceneImageLayer[];
};

/* Cuando el field está activo, fuerza su capa como capa activa del editor */
export function useActiveSceneLayer({ active, layerId, activeLayerId, setActiveLayerId, layers }: UseActiveSceneLayerArgs) {
  useEffect(() => {
    if (!active) return;
    if (String(activeLayerId ?? "") === String(layerId)) return;

    setActiveLayerId(layerId);
  }, [active, activeLayerId, layerId, setActiveLayerId]);

  const layer = useMemo(() => layers.find((currentLayer) => String(currentLayer.id) === String(layerId)) ?? null,  [layers, layerId]);

  return { layer };
}

/* Hace focus automático a un input/textarea cuando `enabled` pasa de false a true */
export function useFocusWhenEnabled<T extends HTMLInputElement | HTMLTextAreaElement>(enabled: boolean) {
  const inputRef = useRef<T | null>(null);
  const prevEnabledRef = useRef(false);

  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;
    prevEnabledRef.current = enabled;

    if (wasEnabled || !enabled) return;

    requestAnimationFrame(() => {
      const element = inputRef.current;
      if (!element) return;

      element.focus();

      const textLength = element.value.length;
      try { element.setSelectionRange(textLength, textLength) }
      catch { }
    });
  }, [enabled]);

  return inputRef;
}

/* Devuelve una versión del proyecto que incluye el nodeDraft actualizado */
export function buildProjectWithNodeDraft(project: Project | null, nodeDraft: Node | null | undefined): Project | null {
  if (!project) return null;
  if (!nodeDraft) return project;

  const nextNodes = [...project.nodes];
  const nodeIndex = nextNodes.findIndex((node) => node.id === nodeDraft.id);

  if (nodeIndex >= 0) nextNodes[nodeIndex] = nodeDraft;
  else nextNodes.push(nodeDraft);

  return { ...project, nodes: nextNodes };
}

type LiveInteractiveDraft =
  | { kind: "hotspot"; layerId: ID; draft: HotspotDraft | null | undefined }
  | { kind: "placedItem"; layerId: ID; draft: PlacedItemDraft | null | undefined }
  | { kind: "placedNpc"; layerId: ID; draft: PlacedNpcDraft | null | undefined };

type BuildLiveProjectWithInteractiveDraftArgs = {
  project: Project | null;
  nodeDraft: Node | null | undefined;
  interactiveDraft?: LiveInteractiveDraft | null;
};

function replaceOrAppend<T>(items: T[] | undefined, candidate: T, match: (item: T) => boolean): T[] {
  const list = items ?? [];
  const index = list.findIndex(match);

  if (index < 0) return [...list, candidate];

  const next = [...list];
  next[index] = candidate;

  return next;
}

function buildLiveHotspot(draft: HotspotDraft | null | undefined): Hotspot | null {
  if (!draft?.shape) return null;
  if (!draft.label.trim()) return null;

  return {
    id: draft.id,
    label: draft.label.trim(),
    shape: draft.shape,
    initialState: draft.initialState,
    vars: draft.vars ?? [],
    rules: draft.rules ?? {},
  };
}

function buildLivePlacedItem(draft: PlacedItemDraft | null | undefined): ItemInstance | null {
  if (!draft?.placement.shape) return null;
  if (!draft.itemId) return null;
  if (!draft.label.trim()) return null;

  return {
    itemInstanceId: draft.itemInstanceId,
    itemId: draft.itemId,
    label: draft.label.trim(),
    rules: draft.rules ?? {},
    placement: {
      shape: draft.placement.shape,
      initialState: draft.placement.initialState,
    },
  };
}

function buildLivePlacedNpc(draft: PlacedNpcDraft | null | undefined): PlacedNpc | null {
  if (!draft?.shape) return null;
  if (!draft.npcId) return null;

  return {
    npcId: draft.npcId,
    shape: draft.shape,
    initialState: draft.initialState,
    rules: draft.rules ?? {},
  };
}

function patchLayerWithInteractiveDraft(layer: SceneImageLayer, interactiveDraft: LiveInteractiveDraft): SceneImageLayer {
  switch (interactiveDraft.kind) {
    case "hotspot": {
      const hotspot = buildLiveHotspot(interactiveDraft.draft);
      if (!hotspot) return layer;

      return {
        ...layer,
        hotspots: replaceOrAppend(layer.hotspots, hotspot, (entry) => entry.id === hotspot.id),
      };
    }

    case "placedItem": {
      const placedItem = buildLivePlacedItem(interactiveDraft.draft);
      if (!placedItem) return layer;

      return {
        ...layer,
        placedItems: replaceOrAppend(layer.placedItems, placedItem, (entry) => entry.itemInstanceId === placedItem.itemInstanceId),
      };
    }

    case "placedNpc": {
      const placedNpc = buildLivePlacedNpc(interactiveDraft.draft);
      if (!placedNpc) return layer;

      return {
        ...layer,
        placedNpcs: replaceOrAppend(layer.placedNpcs, placedNpc, (entry) => entry.npcId === placedNpc.npcId),
      };
    }
  }
}

export function buildLiveProjectWithInteractiveDraft({ project, nodeDraft, interactiveDraft }: BuildLiveProjectWithInteractiveDraftArgs): Project | null {
  const baseProject = buildProjectWithNodeDraft(project, nodeDraft);

  if (!baseProject) return null;
  if (!nodeDraft) return baseProject;
  if (!interactiveDraft) return baseProject;

  const nextNodes = baseProject.nodes.map((node) => {
    if (node.id !== nodeDraft.id) return node;

    return {
      ...node,
      layers: (node.layers ?? []).map((layer) =>
        layer.id === interactiveDraft.layerId ? patchLayerWithInteractiveDraft(layer, interactiveDraft) : layer,
      ),
    };
  });

  return {
    ...baseProject,
    nodes: nextNodes,
  };
}