import { useCallback, useMemo } from "react";
import type { ID, ItemInstance, Node, PlacedNpc, PlacedPlayer, PlacedPlayerState, PlaceableState, Project } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { buildAssetIdByKind, buildAssetIdToFile, resolveAssetIdToSrc } from "@/features/player/utils/playerAssetResolution";

type RawPlacedItem = {
  placedItem: ItemInstance;
  runtime?: PlaceableState;
};

type RawPlacedPlayer = {
  placedPlayer: PlacedPlayer;
  runtime?: PlacedPlayerState;
};

type RawPlacedNpc = {
  placedNpc: PlacedNpc;
  runtime?: PlaceableState;
};

export function usePlayerResolvedAssets(project: Project | null, assetUrls: Record<string, string>) {
  const assetIdToFile = useMemo(() => {
    if (!project) return new Map<ID, string>();

    return buildAssetIdToFile(project);
  }, [project]);

  const itemAssetIdByItemId = useMemo(() => {
    if (!project) return new Map<ID, ID>();

    return buildAssetIdByKind(project, "items");
  }, [project]);

  const playerImageAssetIdByImageId = useMemo(() => {
    if (!project) return new Map<ID, ID>();

    return buildAssetIdByKind(project, "players");
  }, [project]);

  const npcAssetIdByNpcId = useMemo(() => {
    if (!project) return new Map<ID, ID>();

    return buildAssetIdByKind(project, "npcs");
  }, [project]);

  const resolveAssetSrc = useCallback((assetId: ID | undefined): string | undefined => {
      if (!assetId) return undefined;

      return resolveAssetIdToSrc(assetId, assetIdToFile, assetUrls) ?? undefined;
    }, [assetIdToFile, assetUrls],
  );

  const resolvePlacedItemsForStage = useCallback((rawPlacedItems: RawPlacedItem[]) => {
      return rawPlacedItems.map(({ placedItem, runtime }) => {
        const assetId = itemAssetIdByItemId.get(placedItem.itemId);
        const imageSrc = resolveAssetSrc(assetId);

        return { placedItem, runtime, imageSrc };
      });
    }, [itemAssetIdByItemId, resolveAssetSrc],
  );

  const resolvePlacedPlayersForStage = useCallback((rawPlacedPlayers: RawPlacedPlayer[], displayedGameState: GameState | null, currentNode: Node | null) => {
      const nodeRuntime = displayedGameState && currentNode ? displayedGameState.nodes?.[currentNode.id] : null;

      return rawPlacedPlayers.map(({ placedPlayer, runtime }) => {
        const runtimeImageId = nodeRuntime?.placedPlayerImageId?.[placedPlayer.playerId] ?? placedPlayer.initialImageId;
        const assetId = runtimeImageId ? playerImageAssetIdByImageId.get(runtimeImageId) : undefined;
        const imageSrc = resolveAssetSrc(assetId);

        return { placedPlayer, runtime, imageSrc };
      });
    }, [playerImageAssetIdByImageId, resolveAssetSrc],
  );

  const resolvePlacedNpcsForStage = useCallback((rawPlacedNpcs: RawPlacedNpc[]) => {
      return rawPlacedNpcs.map(({ placedNpc, runtime }) => {
        const assetId = npcAssetIdByNpcId.get(placedNpc.npcId);
        const imageSrc = resolveAssetSrc(assetId);

        return { placedNpc, runtime, imageSrc };
      });
    }, [npcAssetIdByNpcId, resolveAssetSrc],
  );

  return {
    assetIdToFile, resolveAssetSrc, resolvePlacedItemsForStage, resolvePlacedPlayersForStage, resolvePlacedNpcsForStage,
  };
}