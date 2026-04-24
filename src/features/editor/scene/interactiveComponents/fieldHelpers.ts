import { useEffect, useMemo, useRef } from "react";
import type { Hotspot, ID, PlacedItem, PlacedNpc, PlacedPlayer, Project, SceneImageLayer } from "@/domain/types";
import type { ClickableRegion } from "@/features/editor/scene/clickableCollisions";


export function normKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

type BuildClickableRegionsArgs = {
  project: Project | null;
  hotspots: Hotspot[];
  placedItems: PlacedItem[];
  placedNpcs: PlacedNpc[];
  placedPlayers: PlacedPlayer[];
};

/* Construye la lista de regiones interactivas visibles de la escena para detección de clics y colisiones */
export function buildClickableRegions({ project, hotspots, placedItems, placedNpcs, placedPlayers }: BuildClickableRegionsArgs): ClickableRegion[] {
  const itemsById = new Map((project?.items ?? []).map((item) => [item.id, item]));
  const npcsById = new Map((project?.npcs ?? []).map((npc) => [npc.id, npc]));
  const playersById = new Map((project?.players ?? []).map((player) => [player.id, player]));

  const regions: ClickableRegion[] = [];

  for (const hotspot of hotspots) {
    regions.push({ kind: "hotspot", id: hotspot.id, label: hotspot.label.trim() || "(sin label)", shape: hotspot.shape });
  }

  for (const placedItem of placedItems) {
    const baseName = itemsById.get(placedItem.itemId)?.name ?? "Item";
    const instanceLabel = String(placedItem.label ?? "").trim();

    regions.push({
      kind: "item",
      id: placedItem.id,
      label: instanceLabel ? `${baseName} (${instanceLabel})` : baseName,
      shape: placedItem.shape,
    });
  }

  for (const placedNpc of placedNpcs) {
    const name = npcsById.get(placedNpc.npcId)?.name ?? "PNJ";

    regions.push({ kind: "npc", id: placedNpc.npcId, label: name, shape: placedNpc.shape });
  }

  for (const placedPlayer of placedPlayers) {
    const name = playersById.get(placedPlayer.playerId)?.name ?? "Player";

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

  const layer = useMemo(
    () => layers.find((currentLayer) => String(currentLayer.id) === String(layerId)) ?? null,
    [layers, layerId],
  );

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