import { useMemo } from "react";
import type { GameState } from "@/engine/state/runtimeState";
import type { ID, Project } from "@/domain/types";
import { pickNodeById, pickActiveLayer, pickActiveText } from "@/features/player/utils/playerSceneResolution";
import { resolveAssetIdToSrc } from "@/features/player/utils/playerAssetResolution";

/* Construye el modelo de datos que necesita el Player para pintar la escena visible */
export function usePlayerSceneViewModel( project: Project | null, displayedNodeId: ID | null, displayedGameState: GameState | null,
  assetIdToFile: Map<ID, string>, assetUrls: Record<string, string>) {

  /* Nodo visual actualmente mostrado. Puede diferir temporalmente de gameState.currentNodeId durante una transición */
  const currentNode = useMemo(() => {
    if (!project || !displayedNodeId) return null;

    return pickNodeById(project, displayedNodeId);
  }, [project, displayedNodeId]);

  /* Capa activa del nodo mostrado. Si varias capas cumplen condición, la resolución se delega en pickActiveLayer */
  const activeLayer = useMemo(() => {
    if (!currentNode || !displayedGameState) return null;

    return pickActiveLayer(currentNode, displayedGameState);
  }, [currentNode, displayedGameState]);

  const activeText = useMemo(() => {
    if (!displayedGameState) return { text: "", dock: "bottom" as const };

    const baseText = pickActiveText(activeLayer, displayedGameState);

    const dockText = displayedGameState.gameEnded ? displayedGameState.ending?.dockText?.trim() : "";

    return dockText ? { ...baseText, text: dockText } : baseText;
  }, [activeLayer, displayedGameState]);

  const activeImageSrc = useMemo(() => {
    if (!activeLayer) return undefined;

    return resolveAssetIdToSrc(activeLayer.assetId, assetIdToFile, assetUrls);
  }, [activeLayer, assetIdToFile, assetUrls]);

  /* Runtime persistente del nodo mostrado */
  const nodeRt = useMemo(() => {
    if (!displayedGameState || !currentNode?.id) return null;

    return displayedGameState.nodes?.[currentNode.id] ?? null;
  }, [displayedGameState, currentNode]);

  const hotspotsForStage = useMemo(() => {
    return (activeLayer?.hotspots ?? []).map((hotspot) => ({
      hotspot,
      runtime: nodeRt?.hotspots?.[hotspot.id] ?? hotspot.initialState,
    }));
  }, [activeLayer, nodeRt]);

  const placedItemsForStage = useMemo(() => {
    return (activeLayer?.placedItems ?? []).map((placedItem) => ({
      placedItem,
      runtime: nodeRt?.placedItems?.[placedItem.itemInstanceId] ?? placedItem.placement?.initialState,
    }));
  }, [activeLayer, nodeRt]);

  const placedPlayersForStage = useMemo(() => {
    return (activeLayer?.placedPlayers ?? []).map((placedPlayer) => ({
      placedPlayer,
      runtime: nodeRt?.placedPlayers?.[placedPlayer.playerId] ?? placedPlayer.initialState,
    }));
  }, [activeLayer, nodeRt]);

  const placedNpcsForStage = useMemo(() => {
    return (activeLayer?.placedNpcs ?? []).map((placedNpc) => ({
      placedNpc,
      runtime: nodeRt?.placedNpcs?.[placedNpc.npcId] ?? placedNpc.initialState,
    }));
  }, [activeLayer, nodeRt]);

  return {
    currentNode, activeLayer, activeText, activeImageSrc, hotspotsForStage, placedItemsForStage, placedPlayersForStage, placedNpcsForStage,
  };
}