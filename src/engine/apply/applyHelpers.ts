import type { ID, InteractionRules, PlaceableState, RulePhrase, Speaker } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { applyEffect, type ApplyEffectCtx } from "@/engine/apply/applyEffect";

export type PlaceableInteractionResult = { allowed: true; state: GameState } | { allowed: false; state: GameState };

export function applyMessageEffect(state: GameState, text: string, ctx: ApplyEffectCtx, speaker: Speaker = { kind: "narrator" }): GameState {
  return applyEffect(state, { type: "showMessage", text, speaker }, ctx);
}

export function applyBlockedPhrase(state: GameState, phrase: RulePhrase, ctx: ApplyEffectCtx): GameState {
  return applyMessageEffect(state, phrase.text, ctx, phrase.speaker ?? { kind: "narrator" });
}

export function canInteractWithPlaceable(state: GameState, runtimeState: PlaceableState | null, ctx: ApplyEffectCtx, defaultNotReachableMessage: string): PlaceableInteractionResult {
  if (!runtimeState) return { allowed: false, state };

  const visible = runtimeState.visible !== false;
  const reachable = runtimeState.reachable !== false;

  if (!visible) return { allowed: false, state };

  if (!reachable) {
    const message = runtimeState.notReachableText?.trim() || defaultNotReachableMessage;

    return { allowed: false, state: applyMessageEffect(state, message, ctx) };
  }

  return { allowed: true, state };
}

export function findInventorySourceRules(state: GameState, itemInstanceId: ID): InteractionRules | null {
  for (const node of state.project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      const placedItem = (layer.placedItems ?? []).find((candidate) => candidate.itemInstanceId === itemInstanceId);

      if (placedItem) return placedItem.rules ?? {};
    }
  }

  for (const player of state.project.players ?? []) {
    const inventoryItem = (player.initialInventory ?? []).find((candidate) => candidate.itemInstanceId === itemInstanceId);

    if (inventoryItem) return inventoryItem.rules ?? {};
  }

  for (const npc of state.project.npcs ?? []) {
    const inventoryItem = (npc.initialInventory ?? []).find((candidate) => candidate.itemInstanceId === itemInstanceId);

    if (inventoryItem) return inventoryItem.rules ?? {};
  }

  return null;
}