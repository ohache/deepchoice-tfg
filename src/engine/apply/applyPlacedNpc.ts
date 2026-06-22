import type { ID, PlacedNpc, PlaceableState } from "@/domain/types";
import { applyEffects, type ApplyEffectCtx } from "@/engine/apply/applyEffect";
import { applyBlockedPhrase, applyMessageEffect, canInteractWithPlaceable } from "@/engine/apply/applyHelpers";
import { pickClickRule, pickUseItemRule } from "@/engine/rules";
import type { GameState } from "@/engine/state/runtimeState";
import { ensureNodeRuntime } from "@/engine/state/runtimeState";

const DEFAULT_NPC_NOT_REACHABLE_MESSAGE = "No puedes alcanzar al NPC.";
const DEFAULT_CANNOT_USE_MESSAGE = "No puedes hacer eso.";

function getPreparedPlacedNpcState(state: GameState, nodeId: ID, npcId: ID): { state: GameState; runtimeState: PlaceableState | null } {
  const preparedState = ensureNodeRuntime(state, nodeId);
  const runtimeState = preparedState.nodes[nodeId]?.placedNpcs[npcId] ?? null;

  return { state: preparedState, runtimeState };
}

export function applyPlacedNpcInteraction(state: GameState, placedNpc: PlacedNpc, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const nodeId = state.currentNodeId;
  const prepared = getPreparedPlacedNpcState(state, nodeId, placedNpc.npcId);
  const interaction = canInteractWithPlaceable(prepared.state, prepared.runtimeState, ctx, DEFAULT_NPC_NOT_REACHABLE_MESSAGE);

  if (!interaction.allowed) return interaction.state;

  const result = pickClickRule(interaction.state, placedNpc.rules ?? {});

  if (result.kind === "none") return interaction.state;

  if (result.kind === "blocked") return applyBlockedPhrase(interaction.state, result.phrase, ctx);

  return applyEffects(interaction.state, result.rule.effects ?? [], ctx);
}

export function applyPlacedNpcUseItem(state: GameState, placedNpc: PlacedNpc, itemInstanceId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const nodeId = state.currentNodeId;
  const prepared = getPreparedPlacedNpcState(state, nodeId, placedNpc.npcId);
  const interaction = canInteractWithPlaceable(prepared.state, prepared.runtimeState, ctx, DEFAULT_NPC_NOT_REACHABLE_MESSAGE);

  if (!interaction.allowed) return interaction.state;

  const result = pickUseItemRule(interaction.state, placedNpc.rules ?? {}, itemInstanceId);

  if (result.kind === "none") return applyMessageEffect(interaction.state, DEFAULT_CANNOT_USE_MESSAGE, ctx);

  if (result.kind === "blocked") return applyBlockedPhrase(interaction.state, result.phrase, ctx);

  return applyEffects(interaction.state, result.rule.effects ?? [], ctx);
}