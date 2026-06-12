import type { ID, Project } from "@/domain/types";
import type { Option } from "@/components/Select";

export function buildGameItemOptions(
  project: Project | null | undefined,
  excludeItemInstanceId?: ID,
): Option<ID>[] {
  const options = [
    ...(project?.nodes ?? []).flatMap((node) =>
      (node.layers ?? []).flatMap((layer) =>
        (layer.placedItems ?? []).map((placedItem) => ({
          id: placedItem.id,
          label: placedItem.label?.trim() || placedItem.id,
        })),
      ),
    ),

    ...(project?.players ?? []).flatMap((player) =>
      (player.initialInventory ?? []).map((item) => ({
        id: item.itemInstanceId,
        label: item.label?.trim() || item.itemInstanceId,
      })),
    ),

    ...(project?.npcs ?? []).flatMap((npc) =>
      (npc.initialInventory ?? []).map((item) => ({
        id: item.itemInstanceId,
        label: item.label?.trim() || item.itemInstanceId,
      })),
    ),
  ].filter((option) => option.id !== excludeItemInstanceId);

  return Array.from(
    new Map(options.map((option) => [option.id, option] as const)).values(),
  );
}