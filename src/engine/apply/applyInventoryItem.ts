import type { ID, InteractionRules, RulePhrase } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { applyEffect, applyEffects, type ApplyEffectCtx } from "@/engine/apply/applyEffect";
import { pickUseItemRule } from "@/engine/rules";

const DEFAULT_CANNOT_USE_MESSAGE = "No puedes usar eso ahí.";

function showMessage(state: GameState, text: string, ctx: ApplyEffectCtx): GameState {
  return applyEffect(state, { type: "showMessage", text, speakerKind: "narrator" }, ctx);
}

function showBlockedPhrase(state: GameState, phrase: RulePhrase, ctx: ApplyEffectCtx): GameState {
  return applyEffect(
    state,
    {
      type: "showMessage",
      text: phrase.text,
      speakerKind: phrase.speaker?.kind ?? "narrator",
      speakerId: phrase.speaker?.kind === "player" ? phrase.speaker.playerId : phrase.speaker?.kind === "npc" ? phrase.speaker.npcId : undefined,
    },
    ctx,
  );
}

function findInventorySourceRules(
  state: GameState,
  itemInstanceId: ID,
): InteractionRules | null {
  for (const node of state.project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      const placedItem = (layer.placedItems ?? []).find(
        (candidate) => candidate.id === itemInstanceId,
      );

      if (placedItem) return placedItem.rules ?? {};
    }
  }

  for (const player of state.project.players ?? []) {
    const inventoryItem = (player.initialInventory ?? []).find(
      (candidate) => candidate.itemInstanceId === itemInstanceId,
    );

    if (inventoryItem) return inventoryItem.rules ?? {};
  }

  for (const npc of state.project.npcs ?? []) {
    const inventoryItem = (npc.initialInventory ?? []).find(
      (candidate) => candidate.itemInstanceId === itemInstanceId,
    );

    if (inventoryItem) return inventoryItem.rules ?? {};
  }

  return null;
}

export function applyInventoryItemUseItem(
  state: GameState,
  sourceInstanceId: ID,
  targetInstanceId: ID,
  ctx: ApplyEffectCtx = {},
): GameState {
  if (state.activeDialogue) return state;

  if (sourceInstanceId === targetInstanceId) {
    return showMessage(state, DEFAULT_CANNOT_USE_MESSAGE, ctx);
  }

  const sourceInInventory = state.inventory.some(
    (entry) => entry.itemInstanceId === sourceInstanceId,
  );

  const targetInInventory = state.inventory.some(
    (entry) => entry.itemInstanceId === targetInstanceId,
  );

  if (!sourceInInventory || !targetInInventory) {
    return showMessage(state, DEFAULT_CANNOT_USE_MESSAGE, ctx);
  }

  const sourceRules = findInventorySourceRules(state, sourceInstanceId);

  if (sourceRules) {
    const sourceResult = pickUseItemRule(
      state,
      sourceRules,
      targetInstanceId,
    );

    if (sourceResult.kind === "matched") {
      return applyEffects(state, sourceResult.rule.effects ?? [], {
        ...ctx,
        itemUsePair: {
          sourceItemInstanceId: sourceInstanceId,
          targetItemInstanceId: targetInstanceId,
        },
      });
    }

    if (sourceResult.kind === "blocked") {
      return showBlockedPhrase(state, sourceResult.phrase, ctx);
    }
  }

  const targetRules = findInventorySourceRules(state, targetInstanceId);

  if (targetRules) {
    const targetResult = pickUseItemRule(
      state,
      targetRules,
      sourceInstanceId,
    );

    if (targetResult.kind === "matched") {
      return applyEffects(state, targetResult.rule.effects ?? [], {
        ...ctx,
        itemUsePair: {
          sourceItemInstanceId: sourceInstanceId,
          targetItemInstanceId: targetInstanceId,
        },
      });
    }

    if (targetResult.kind === "blocked") {
      return showBlockedPhrase(state, targetResult.phrase, ctx);
    }
  }

  return showMessage(state, DEFAULT_CANNOT_USE_MESSAGE, ctx);
}