import type { ID, Project } from "@/domain/types";
import type { Option } from "@/components/Select";

/* Construye las opciones de selección de item disponibles en la partida: escenas + jugadores + PNJs */
export function buildGameItemOptions(project: Project | null | undefined, excludeItemInstanceId?: ID): Option<ID>[] {
  const options: Option<ID>[] = [
    ...(project?.nodes ?? []).flatMap((node) =>
      (node.layers ?? []).flatMap((layer) =>
        (layer.placedItems ?? []).map((placedItem) => ({ id: placedItem.itemInstanceId, label: placedItem.label.trim() || placedItem.itemInstanceId })),
      ),
    ),

    ...(project?.players ?? []).flatMap((player) =>
      (player.initialInventory ?? []).map((item) => ({ id: item.itemInstanceId, label: item.label.trim() || item.itemInstanceId })),
    ),

    ...(project?.npcs ?? []).flatMap((npc) =>
      (npc.initialInventory ?? []).map((item) => ({ id: item.itemInstanceId, label: item.label.trim() || item.itemInstanceId })),
    ),
  ].filter((option) => option.id !== excludeItemInstanceId);

  return Array.from(new Map(options.map((option) => [option.id, option])).values());
}