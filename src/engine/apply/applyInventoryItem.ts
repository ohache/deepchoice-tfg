import type { ID } from "@/domain/types";
import type { GameState, InventoryEntry } from "@/engine/state/runtimeState";
import { applyEffects, type ApplyEffectCtx } from "@/engine/apply/applyEffect";
import { applyBlockedPhrase, applyMessageEffect, findInventorySourceRules } from "@/engine/apply/applyHelpers";
import { pickUseItemRule } from "@/engine/rules";

const DEFAULT_CANNOT_USE_MESSAGE = "No puedes usar eso ahí.";

type PlayerInventoryMatch = {
  playerId: ID;
  entry: InventoryEntry;
};

function findPlayerInventoryEntry(state: GameState, itemInstanceId: ID): PlayerInventoryMatch | null {
  for (const [playerId, inventory] of Object.entries(state.playerInventory)) {
    const entry = inventory.find((item) => item.itemInstanceId === itemInstanceId);

    if (entry) return { playerId, entry };
  }

  return null;
}

export function applyInventoryItemUseItem(state: GameState, sourceInstanceId: ID, targetInstanceId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  if (sourceInstanceId === targetInstanceId) return applyMessageEffect(state, DEFAULT_CANNOT_USE_MESSAGE, ctx);

  const source = findPlayerInventoryEntry(state, sourceInstanceId);
  const target = findPlayerInventoryEntry(state, targetInstanceId);

  if (!source || !target) return applyMessageEffect(state, DEFAULT_CANNOT_USE_MESSAGE, ctx);

  if (source.playerId !== target.playerId) return applyMessageEffect(state, DEFAULT_CANNOT_USE_MESSAGE, ctx);

  const sourceRules = findInventorySourceRules(state, sourceInstanceId);

  if (sourceRules) {
    const sourceResult = pickUseItemRule(state, sourceRules, targetInstanceId);

    if (sourceResult.kind === "matched") {
      return applyEffects(state, sourceResult.rule.effects ?? [], {
        ...ctx,
        itemUsePair: {
          sourceItemInstanceId: sourceInstanceId,
          targetItemInstanceId: targetInstanceId,
        },
      });
    }

    if (sourceResult.kind === "blocked") return applyBlockedPhrase(state, sourceResult.phrase, ctx);
  }

  const targetRules = findInventorySourceRules(state, targetInstanceId);

  if (targetRules) {
    const targetResult = pickUseItemRule(state, targetRules, sourceInstanceId);

    if (targetResult.kind === "matched") {
      return applyEffects(state, targetResult.rule.effects ?? [], {
        ...ctx,
        itemUsePair: {
          sourceItemInstanceId: sourceInstanceId,
          targetItemInstanceId: targetInstanceId,
        },
      });
    }

    if (targetResult.kind === "blocked") return applyBlockedPhrase(state, targetResult.phrase, ctx);
  }

  return applyMessageEffect(state, DEFAULT_CANNOT_USE_MESSAGE, ctx);
}