import type { Effect } from "@/domain/effects";
import type { ID, ItemInstance, PlaceableState } from "@/domain/types";
import { addInventoryInstance, applyEffects, type ApplyEffectCtx } from "@/engine/apply/applyEffect";
import { applyBlockedPhrase, applyMessageEffect, canInteractWithPlaceable, findInventorySourceRules } from "@/engine/apply/applyHelpers";
import { pickClickRule, pickUseItemRule } from "@/engine/rules";
import type { GameState } from "@/engine/state/runtimeState";
import { ensureNodeRuntime } from "@/engine/state/runtimeState";
import { publicPath } from "@/shared/helpers";

const DEFAULT_NOT_REACHABLE_MESSAGE = "No puedes alcanzarlo.";
const DEFAULT_CANNOT_USE_MESSAGE = "No puedes hacer eso.";

function isOwnAddItemEffect(placedItem: ItemInstance, effect: Effect): effect is Extract<Effect, { type: "addItem" }> {
  return effect.type === "addItem" && effect.itemInstanceId === placedItem.itemInstanceId;
}

function getPreparedPlacedItemState(state: GameState, nodeId: ID, placedItemId: ID): { state: GameState; runtimeState: PlaceableState | null } {
  const preparedState = ensureNodeRuntime(state, nodeId);
  const runtimeState = preparedState.nodes[nodeId]?.placedItems[placedItemId] ?? null;

  return { state: preparedState, runtimeState };
}

function pickUpPlacedItem(state: GameState, nodeId: ID, placedItem: ItemInstance, playerId: ID, ctx: ApplyEffectCtx = {}): GameState {
  const nextState = addInventoryInstance(state, playerId, placedItem.itemInstanceId, placedItem.itemId, placedItem.label);

  ctx.audio?.playSfxUrl(publicPath("sounds/add_item.wav"));

  const nodeRuntime = nextState.nodes[nodeId];
  const previous = nodeRuntime?.placedItems[placedItem.itemInstanceId];

  if (!nodeRuntime || !previous) return nextState;

  return {
    ...nextState,
    nodes: {
      ...nextState.nodes,
      [nodeId]: {
        ...nodeRuntime,
        placedItems: {
          ...nodeRuntime.placedItems,
          [placedItem.itemInstanceId]: {
            ...previous,
            visible: false,
            reachable: false,
          },
        },
      },
    },
  };
}

export function applyPlacedItemInteraction(state: GameState, placedItem: ItemInstance, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const nodeId = state.currentNodeId;
  const prepared = getPreparedPlacedItemState(state, nodeId, placedItem.itemInstanceId);
  const interaction = canInteractWithPlaceable(prepared.state, prepared.runtimeState, ctx, DEFAULT_NOT_REACHABLE_MESSAGE);

  if (!interaction.allowed) return interaction.state;

  const result = pickClickRule(interaction.state, placedItem.rules ?? {});

  if (result.kind === "none") return interaction.state;

  if (result.kind === "blocked") return applyBlockedPhrase(interaction.state, result.phrase, ctx);

  return (result.rule.effects ?? []).reduce((currentState, effect) => {
    if (isOwnAddItemEffect(placedItem, effect)) return pickUpPlacedItem(currentState, nodeId, placedItem, effect.playerId, ctx);

    return applyEffects(currentState, [effect], ctx);
  }, interaction.state);
}

export function applyPlacedItemUseItem(state: GameState, placedItem: ItemInstance, inventoryInstanceId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const nodeId = state.currentNodeId;
  const prepared = getPreparedPlacedItemState(state, nodeId, placedItem.itemInstanceId);
  const interaction = canInteractWithPlaceable(prepared.state, prepared.runtimeState, ctx, DEFAULT_NOT_REACHABLE_MESSAGE);

  if (!interaction.allowed) return interaction.state;

  const targetResult = pickUseItemRule(interaction.state, placedItem.rules ?? {}, inventoryInstanceId);

  if (targetResult.kind === "matched") {
    return applyEffects(interaction.state, targetResult.rule.effects ?? [], {
      ...ctx,
      itemUsePair: { sourceItemInstanceId: inventoryInstanceId, targetItemInstanceId: placedItem.itemInstanceId },
    });
  }

  if (targetResult.kind === "blocked") return applyBlockedPhrase(interaction.state, targetResult.phrase, ctx);

  const sourceRules = findInventorySourceRules(interaction.state, inventoryInstanceId);

  if (sourceRules) {
    const sourceResult = pickUseItemRule(interaction.state, sourceRules, placedItem.itemInstanceId);

    if (sourceResult.kind === "matched") {
      return applyEffects(interaction.state, sourceResult.rule.effects ?? [], {
        ...ctx,
        itemUsePair: {
          sourceItemInstanceId: inventoryInstanceId,
          targetItemInstanceId: placedItem.itemInstanceId,
        },
      });
    }

    if (sourceResult.kind === "blocked") return applyBlockedPhrase(interaction.state, sourceResult.phrase, ctx);
  }

  return applyMessageEffect(interaction.state, DEFAULT_CANNOT_USE_MESSAGE, ctx);
}