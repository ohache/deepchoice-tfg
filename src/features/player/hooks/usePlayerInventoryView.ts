import { useMemo } from "react";
import type { ID, ItemDef, Project } from "@/domain/types";
import { resolveInventoryPlayerId, type GameState, type InventoryEntry } from "@/engine/state/runtimeState";
import type { InventoryItemView } from "@/features/player/components/InventoryOverlay";
import { PLAYER_ITEM_CURSOR_FALLBACK_SIZE } from "@/features/player/hooks/usePlayerCursor";
import { resolveAssetIdToSrc } from "@/features/player/utils/playerAssetResolution";

function buildItemById(project: Project | null): Map<ID, ItemDef> {
  const map = new Map<ID, ItemDef>();

  for (const item of project?.items ?? []) map.set(item.id, item);

  return map;
}

function getPlayerInventoryEntries(gameState: GameState | null, playerId: ID | null): InventoryEntry[] {
  if (!gameState || !playerId) return [];

  return gameState.playerInventory[playerId] ?? [];
}

export function usePlayerInventoryView(project: Project | null, gameState: GameState | null, assetIdToFile: Map<ID, string>, assetUrls: Record<string, string>, playerId?: ID | null) {
  const itemById = useMemo(() => buildItemById(project), [project]);

  const inventoryPlayerId = useMemo(() => {
    return resolveInventoryPlayerId(gameState, playerId);
  }, [gameState, playerId]);

  const inventoryItems = useMemo<InventoryItemView[]>(() => {
    if (!gameState || !project) return [];

    const entries = getPlayerInventoryEntries(gameState, inventoryPlayerId);

    const mappedItems = entries.map((entry): InventoryItemView | null => {
      const item = itemById.get(entry.itemId);
      if (!item) return null;

      const imageSrc = resolveAssetIdToSrc(entry.itemId, assetIdToFile, assetUrls);

      return {
        itemInstanceId: entry.itemInstanceId,
        itemId: entry.itemId,
        name: entry.label?.trim() || item.name,
        imageSrc: imageSrc ?? "",
        cursorSize: PLAYER_ITEM_CURSOR_FALLBACK_SIZE,
      };
    });

    return mappedItems.filter((item): item is InventoryItemView => item !== null);
  }, [gameState, project, inventoryPlayerId, itemById, assetIdToFile, assetUrls]);

  return {
    inventoryPlayerId, inventoryItems,
  };
}