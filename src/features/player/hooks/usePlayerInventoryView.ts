import { useMemo } from "react";
import type { ID, ItemDef, Project } from "@/domain/types";
import type { GameState, InventoryEntry } from "@/engine/state/runtimeState";
import type { InventoryItemView } from "@/features/player/components/InventoryOverlay";
import { resolveAssetIdToSrc } from "@/features/player/utils/playerAssetResolution";
import { findPlacedItemShapeByInstanceId } from "@/features/player/utils/playerSceneResolution";

export function usePlayerInventoryView(project: Project | null, gameState: GameState | null, assetIdToFile: Map<ID, string>,
  assetUrls: Record<string, string>, sceneContentRect: { w: number; h: number} | null) {
  const itemById = useMemo(() => {
    const map = new Map<ID, ItemDef>();
    for (const item of project?.items ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [project]);

  const inventoryItems = useMemo<InventoryItemView[]>(() => {
    if (!gameState || !project) return [];

    return gameState.inventory
      .map((entry: InventoryEntry) => {
        const item = itemById.get(entry.itemId);
        if (!item) return null;

        const imageSrc = resolveAssetIdToSrc(entry.itemId, assetIdToFile, assetUrls);

        const shape = findPlacedItemShapeByInstanceId(project, entry.itemInstanceId);

const cursorSize =
  shape?.type === "rect" && sceneContentRect
    ? {
        width: Math.max(64, Math.min(180, shape.w * sceneContentRect.w)),
        height: Math.max(64, Math.min(180, shape.h * sceneContentRect.h)),
      }
    : { width: 128, height: 128 };

        return {
          itemInstanceId: entry.itemInstanceId,
          itemId: entry.itemId,
          name: item.name,
          imageSrc: imageSrc ?? "",
          cursorSize,
        };
      })
      .filter((item): item is InventoryItemView => item !== null);
  }, [gameState, project, itemById, assetIdToFile, assetUrls, sceneContentRect]);

  return { inventoryItems };
}