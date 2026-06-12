import { useCallback } from "react";
import type { Hotspot, ID, PlacedItem, PlacedNpc } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import type { AudioAdapter } from "@/engine/adapters/audioAdapter";
import type { InventoryItemView } from "@/features/player/components/InventoryOverlay";
import { applyHotspotUseItem } from "@/engine/apply/applyHotspot";
import { applyInventoryItemUseItem } from "@/engine/apply/applyInventoryItem";
import { applyPlacedItemUseItem } from "@/engine/apply/applyPlacedItem";
import { applyPlacedNpcUseItem } from "@/engine/apply/applyPlacedNpc";
import { useUiMessageStore } from "@/engine/messages/uiMessageStore";
import { useGameStore } from "@/store/gameStore";

type PrepareGameState = (state: GameState) => GameState;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function usePlayerItemInteractions(gameState: GameState | null, selectedItemId: ID | null, audioAdapter: AudioAdapter,
  prepareGameState: PrepareGameState, clearInteractionMode: () => void) {
  const pushUiMessage = useUiMessageStore((state) => state.push);

  const applyPreparedState = useCallback(
    (nextState: GameState) => {
      useGameStore.setState({ gameState: prepareGameState(nextState) });

      clearInteractionMode();
    }, [prepareGameState, clearInteractionMode]
  );

  const emitBubbleMessage = useCallback(
  (
    text: string,
    speaker?: {
      kind: "narrator" | "player" | "npc";
      speakerId?: ID;
    },
  ) => {
    pushUiMessage({
      text,
      preferredChannel: "bubble",
      speaker:
        speaker?.kind === "player" && speaker.speakerId
          ? { kind: "player", playerId: speaker.speakerId }
          : speaker?.kind === "npc" && speaker.speakerId
            ? { kind: "npc", npcId: speaker.speakerId }
            : speaker?.kind === "narrator"
              ? { kind: "narrator" }
              : undefined,
    });
  },
  [pushUiMessage],
);

  const useOnHotspot = useCallback(
    (hotspot: Hotspot) => {
      if (!gameState || !selectedItemId) return;

      try {
        const nextState = applyHotspotUseItem(gameState, hotspot, selectedItemId, { audio: audioAdapter, emitMessage: emitBubbleMessage });

        applyPreparedState(nextState);
      } catch (error) {
        emitBubbleMessage(getErrorMessage(error, "No se ha podido usar el objeto."));
      }
    }, [gameState, selectedItemId, audioAdapter, emitBubbleMessage, applyPreparedState]
  );

  const useOnPlacedItem = useCallback(
    (placedItem: PlacedItem) => {
      if (!gameState || !selectedItemId) return;

      try {
        const nextState = applyPlacedItemUseItem(gameState, placedItem, selectedItemId, { audio: audioAdapter, emitMessage: emitBubbleMessage });

        applyPreparedState(nextState);
      } catch (error) {
        emitBubbleMessage(getErrorMessage(error, "No se ha podido usar el objeto."));
      }
    }, [gameState, selectedItemId, audioAdapter, emitBubbleMessage, applyPreparedState]
  );

  const useOnPlacedNpc = useCallback(
    (placedNpc: PlacedNpc) => {
      if (!gameState || !selectedItemId) return;

      try {
        const nextState = applyPlacedNpcUseItem(gameState, placedNpc, selectedItemId, { audio: audioAdapter, emitMessage: emitBubbleMessage });

        applyPreparedState(nextState);
      } catch (error) {
        emitBubbleMessage(getErrorMessage(error, "No se ha podido usar el objeto."));
      }
    }, [gameState, selectedItemId, audioAdapter, emitBubbleMessage, applyPreparedState]
  );

  const useOnInventoryItem = useCallback(
    (sourceItem: InventoryItemView, targetItem: InventoryItemView) => {
      if (!gameState) return;

      try {
        const nextState = applyInventoryItemUseItem(gameState, sourceItem.itemInstanceId, targetItem.itemInstanceId,
          { audio: audioAdapter, emitMessage: emitBubbleMessage }
        );

        applyPreparedState(nextState);
      } catch (error) {
        emitBubbleMessage(getErrorMessage(error, "No se ha podido usar el objeto."));
      }
    }, [gameState, audioAdapter, emitBubbleMessage, applyPreparedState]
  );

  return { useOnHotspot, useOnPlacedItem, useOnPlacedNpc, useOnInventoryItem };
}