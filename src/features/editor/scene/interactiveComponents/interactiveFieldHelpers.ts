import { useEffect, useMemo, useRef } from "react";
import type { Hotspot, ID, ItemInstance, PlacedNpc, PlacedPlayer, Project, SceneImageLayer, Node } from "@/domain/types";
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