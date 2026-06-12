import type { Effect } from "@/domain/effects";
import type { ID, PlacedItem, PlaceableState, RulePhrase } from "@/domain/types";
import { addInventoryInstance, applyEffect, applyEffects, type ApplyEffectCtx } from "@/engine/apply/applyEffect";
import { pickClickRule, pickUseItemRule } from "@/engine/rules";
import type { GameState } from "@/engine/state/runtimeState";
import { ensureNodeRuntime } from "@/engine/state/runtimeState";

const DEFAULT_NOT_REACHABLE_MESSAGE = "No puedes alcanzarlo.";
const DEFAULT_CANNOT_USE_MESSAGE = "No puedes hacer eso.";

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

function isOwnAddItemEffect(placedItem: PlacedItem, effect: Effect): boolean {
  return effect.type === "addItem" && effect.itemInstanceId === placedItem.id;
}

function getPreparedPlacedItemState(state: GameState, nodeId: ID, placedItemId: ID): { state: GameState; runtimeState: PlaceableState | null } {
  const preparedState = ensureNodeRuntime(state, nodeId);
  const runtimeState = preparedState.nodes[nodeId]?.placedItems[placedItemId] ?? null;

  return { state: preparedState, runtimeState };
}

function canInteractWithPlacedItem(state: GameState, runtimeState: PlaceableState | null, ctx: ApplyEffectCtx): { allowed: true; state: GameState } | { allowed: false; state: GameState } {
  if (!runtimeState) return { allowed: false, state };

  const visible = runtimeState.visible !== false;
  const reachable = runtimeState.reachable !== false;

  if (!visible) return { allowed: false, state };

  if (!reachable) {
    const message = runtimeState.notReachableText?.trim() || DEFAULT_NOT_REACHABLE_MESSAGE;
    return { allowed: false, state: showMessage(state, message, ctx) };
  }

  return { allowed: true, state };
}

function pickUpPlacedItem(state: GameState, nodeId: ID, placedItem: PlacedItem, ctx: ApplyEffectCtx = {}): GameState {
  const nextState = addInventoryInstance(state, placedItem.id, placedItem.itemId);

  ctx.audio?.playSfxUrl("/sounds/add_item.wav");

  const nodeRuntime = nextState.nodes[nodeId];
  const previous = nodeRuntime?.placedItems[placedItem.id];

  if (!nodeRuntime || !previous) return nextState;

  return {
    ...nextState,
    nodes: {
      ...nextState.nodes,
      [nodeId]: {
        ...nodeRuntime,
        placedItems: {
          ...nodeRuntime.placedItems,
          [placedItem.id]: {
            ...previous,
            visible: false,
            reachable: false,
          },
        },
      },
    },
  };
}

function findInventorySourceRules(state: GameState, itemInstanceId: ID) {
  for (const node of state.project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      const placedItem = (layer.placedItems ?? []).find((candidate) => candidate.id === itemInstanceId);
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

export function applyPlacedItemInteraction(state: GameState, placedItem: PlacedItem, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const nodeId = state.currentNodeId;
  const prepared = getPreparedPlacedItemState(state, nodeId, placedItem.id);
  const interaction = canInteractWithPlacedItem(prepared.state, prepared.runtimeState, ctx);

  if (!interaction.allowed) return interaction.state;

  const result = pickClickRule(interaction.state, placedItem.rules ?? {});

  if (result.kind === "none") return interaction.state;

  if (result.kind === "blocked") return showBlockedPhrase(interaction.state, result.phrase, ctx);

  return (result.rule.effects ?? []).reduce((currentState, effect) => {
    if (isOwnAddItemEffect(placedItem, effect)) return pickUpPlacedItem(currentState, nodeId, placedItem, ctx);

    return applyEffects(currentState, [effect], ctx);
  }, interaction.state);
}

export function applyPlacedItemUseItem(state: GameState, placedItem: PlacedItem, inventoryInstanceId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const nodeId = state.currentNodeId;
  const prepared = getPreparedPlacedItemState(state, nodeId, placedItem.id);
  const interaction = canInteractWithPlacedItem(prepared.state, prepared.runtimeState, ctx);

  if (!interaction.allowed) return interaction.state;

  const targetResult = pickUseItemRule(interaction.state, placedItem.rules ?? {}, inventoryInstanceId);

  if (targetResult.kind === "matched") {
    return applyEffects(interaction.state, targetResult.rule.effects ?? [], {
      ...ctx,
      itemUsePair: {
        sourceItemInstanceId: inventoryInstanceId,
        targetItemInstanceId: placedItem.id,
      },
    });
  }

  if (targetResult.kind === "blocked") {
    return showBlockedPhrase(interaction.state, targetResult.phrase, ctx);
  }

  const sourceRules = findInventorySourceRules(interaction.state, inventoryInstanceId);

  if (sourceRules) {
    const sourceResult = pickUseItemRule(interaction.state, sourceRules, placedItem.id);

    if (sourceResult.kind === "matched") {
      return applyEffects(interaction.state, sourceResult.rule.effects ?? [], {
        ...ctx,
        itemUsePair: {
          sourceItemInstanceId: inventoryInstanceId,
          targetItemInstanceId: placedItem.id,
        },
      });
    }

    if (sourceResult.kind === "blocked") {
      return showBlockedPhrase(interaction.state, sourceResult.phrase, ctx);
    }
  }

  return showMessage(interaction.state, DEFAULT_CANNOT_USE_MESSAGE, ctx);
}