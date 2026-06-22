import { useCallback } from "react";
import type { Hotspot, ID, ItemInstance, PlacedNpc } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import type { AudioAdapter } from "@/engine/adapters/SfxAdapter";
import type { InventoryItemView } from "@/features/player/components/InventoryOverlay";
import type { ApplyEffectCtx } from "@/engine/apply/applyEffect";
import { applyHotspotUseItem } from "@/engine/apply/applyHotspot";
import { applyInventoryItemUseItem } from "@/engine/apply/applyInventoryItem";
import { applyPlacedItemUseItem } from "@/engine/apply/applyPlacedItem";
import { applyPlacedNpcUseItem } from "@/engine/apply/applyPlacedNpc";
import { pushBubbleMessage } from "@/engine/messages/uiMessageStore";
import { useGameStore } from "@/store/gameStore";

type ItemUseCtx = Pick<ApplyEffectCtx, "audio" | "emitMessage">;

type UseSelectedItemTarget<TTarget> = {
  target: TTarget;
  apply: (state: GameState, target: TTarget, selectedItemId: ID, ctx: ItemUseCtx) => GameState;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function emitBubbleMessage(text: string, speaker?: { kind: "narrator" | "player" | "npc"; speakerId?: ID }) {
  pushBubbleMessage(text, speaker);
}

/* Hook que centraliza el uso de un item seleccionado con hotspots, items colocados, NPCs colocados y otros items del inventario */
export function usePlayerItemInteractions(gameState: GameState | null, selectedItemId: ID | null, audioAdapter: AudioAdapter, clearInteractionMode: () => void) {
  const setPreparedGameState = useGameStore((state) => state.setPreparedGameState);

  const buildItemUseCtx = useCallback((): ItemUseCtx => ({ audio: audioAdapter, emitMessage: emitBubbleMessage }), [audioAdapter]);

  const applyPreparedState = useCallback((nextState: GameState) => {
    setPreparedGameState(nextState);
    clearInteractionMode();
  },
    [setPreparedGameState, clearInteractionMode],
  );

  /* Helper común para usar el item seleccionado sobre un objetivo de escena */
  const applySelectedItemOnTarget = useCallback(<TTarget,>({ target, apply }: UseSelectedItemTarget<TTarget>) => {
    if (!gameState || !selectedItemId) return;

    try {
      const nextState = apply(gameState, target, selectedItemId, buildItemUseCtx());
      applyPreparedState(nextState);
    } catch (error) {
      emitBubbleMessage(getErrorMessage(error, "No se ha podido usar el objeto."));
    }
  },
    [gameState, selectedItemId, buildItemUseCtx, applyPreparedState],
  );

  const useOnHotspot = useCallback((hotspot: Hotspot) => {
    applySelectedItemOnTarget({ target: hotspot, apply: applyHotspotUseItem });
  }, [applySelectedItemOnTarget]);

  const useOnPlacedItem = useCallback((placedItem: ItemInstance) => {
    applySelectedItemOnTarget({ target: placedItem, apply: applyPlacedItemUseItem });
  }, [applySelectedItemOnTarget]);

  const useOnPlacedNpc = useCallback((placedNpc: PlacedNpc) => {
    applySelectedItemOnTarget({ target: placedNpc, apply: applyPlacedNpcUseItem});
  }, [applySelectedItemOnTarget]);

  /* Uso item-item dentro del inventario */
  const useOnInventoryItem = useCallback((sourceItem: InventoryItemView, targetItem: InventoryItemView) => {
    if (!gameState) return;

    try {
      const nextState = applyInventoryItemUseItem(gameState, sourceItem.itemInstanceId, targetItem.itemInstanceId, buildItemUseCtx());

      applyPreparedState(nextState);
    } catch (error) {
      emitBubbleMessage(getErrorMessage(error, "No se ha podido usar el objeto."));
    }
  },
    [gameState, buildItemUseCtx, applyPreparedState],
  );

  return {
    useOnHotspot, useOnPlacedItem, useOnPlacedNpc, useOnInventoryItem,
  };
}