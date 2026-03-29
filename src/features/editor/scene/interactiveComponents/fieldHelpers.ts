import { useEffect, useMemo, useRef } from "react";
import type { Hotspot, ID, PlacedItem, PlacedNpc, PlacedPlayer, Project, SceneImageLayer } from "@/domain/types";
import type { ClickableRegion } from "@/features/editor/scene/clickableCollisions";

/* Normaliza una clave de texto para comparaciones: trim + lowercase */
export function normKey(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

type BuildClickableRegionsArgs = {
  project: Project | null;
  hotspots: Hotspot[];
  placedItems: PlacedItem[];
  placedNpcs: PlacedNpc[];
  placedPlayers: PlacedPlayer[];
};

/* Construye la lista de regiones interactivas visibles en la escena para detección de clics y colisiones */
export function buildClickableRegions({ project, hotspots, placedItems, placedNpcs, placedPlayers }: BuildClickableRegionsArgs): ClickableRegion[] {
  const itemsById = new Map((project?.items ?? []).map((it) => [it.id, it]));
  const npcsById = new Map((project?.npcs ?? []).map((n) => [n.id, n]));
  const playersById = new Map((project?.players ?? []).map((p) => [p.id, p]));

  const out: ClickableRegion[] = [];

  for (const hs of hotspots) {
    out.push({
      kind: "hotspot",
      id: hs.id,
      label: hs.label.trim() || "(sin label)",
      shape: hs.shape,
    });
  }

  for (const pi of placedItems) {
    const baseName = itemsById.get(pi.itemId)?.name ?? "Item";
    const inst = String(pi.label ?? "").trim();

    out.push({
      kind: "item",
      id: pi.id,
      label: inst ? `${baseName} (${inst})` : baseName,
      shape: pi.shape,
    });
  }

  for (const pn of placedNpcs) {
    const name = npcsById.get(pn.npcId)?.name ?? "PNJ";

    out.push({
      kind: "npc",
      id: pn.npcId,
      label: name,
      shape: pn.shape,
    });
  }

  for (const pp of placedPlayers) {
    const name = playersById.get(pp.playerId)?.name ?? "Player";

    out.push({
      kind: "player",
      id: pp.playerId,
      label: name,
      shape: pp.shape,
    });
  }

  return out;
}

type UseActiveSceneLayerArgs = {
  active: boolean;
  layerId: ID;
  activeLayerId: ID | null;
  setActiveLayerId: (layerId: ID) => void;
  layers: SceneImageLayer[];
};

/* Al activar el field, su capa se convierta en la capa activa del editor */
export function useActiveSceneLayer({ active, layerId, activeLayerId, setActiveLayerId, layers }: UseActiveSceneLayerArgs) {
  useEffect(() => {
    if (!active) return;
    if (activeLayerId === layerId) return;
    setActiveLayerId(layerId);
  }, [active, activeLayerId, layerId, setActiveLayerId]);

  const layer = useMemo(() => layers.find((l) => String(l.id) === String(layerId)) ?? null, [layers, layerId]);

  return { layer };
}

/* Foco automático a un input/textarea cuando la condición "enabled" pasa de false a true */
export function useFocusWhenEnabled<T extends HTMLInputElement | HTMLTextAreaElement>(enabled: boolean ) {
  const inputRef = useRef<T | null>(null);
  const prevEnabledRef = useRef(false);

  useEffect(() => {
    const prev = prevEnabledRef.current;
    prevEnabledRef.current = enabled;

    if (!prev && enabled) {
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;

        el.focus();

        const len = el.value.length;
        try { el.setSelectionRange(len, len);}        
        catch {}
      });
    }
  }, [enabled]);

  return inputRef;
}