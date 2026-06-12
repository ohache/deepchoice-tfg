import type { ID, PlacedNpc, PlaceableState, RulePhrase } from "@/domain/types";
import { applyEffect, applyEffects, type ApplyEffectCtx } from "@/engine/apply/applyEffect";
import { pickClickRule, pickUseItemRule } from "@/engine/rules";
import type { GameState } from "@/engine/state/runtimeState";
import { ensureNodeRuntime } from "@/engine/state/runtimeState";

const DEFAULT_NPC_NOT_REACHABLE_MESSAGE = "No puedes alcanzar al NPC.";
const DEFAULT_CANNOT_USE_MESSSAGE = "No puedes hacer eso.";

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

function getPreparedPlacedNpcState(state: GameState, nodeId: ID, npcId: ID): { state: GameState; runtimeState: PlaceableState | null } {
  const preparedState = ensureNodeRuntime(state, nodeId);
  const runtimeState = preparedState.nodes[nodeId]?.placedNpcs[npcId] ?? null;

  return { state: preparedState, runtimeState };
}

function canInteractWithNpc(state: GameState, runtimeState: PlaceableState | null, ctx: ApplyEffectCtx):
  { allowed: true; state: GameState } | { allowed: false; state: GameState } {
  if (!runtimeState) return { allowed: false, state };

  const visible = runtimeState.visible !== false;
  const reachable = runtimeState.reachable !== false;

  if (!visible) return { allowed: false, state };

  if (!reachable) {
    const message = runtimeState.notReachableText?.trim() || DEFAULT_NPC_NOT_REACHABLE_MESSAGE;
    return { allowed: false, state: showMessage(state, message, ctx) };
  }

  return { allowed: true, state };
}

export function applyPlacedNpcInteraction(state: GameState, placedNpc: PlacedNpc, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const nodeId = state.currentNodeId;
  const prepared = getPreparedPlacedNpcState(state, nodeId, placedNpc.npcId);
  const interaction = canInteractWithNpc(prepared.state, prepared.runtimeState, ctx);

  if (!interaction.allowed) return interaction.state;

  const result = pickClickRule(interaction.state, placedNpc.rules ?? {});

  if (result.kind === "none") return interaction.state;

  if (result.kind === "blocked") return showBlockedPhrase(interaction.state, result.phrase, ctx);

  return applyEffects(interaction.state, result.rule.effects ?? [], ctx);
}

export function applyPlacedNpcUseItem(state: GameState, placedNpc: PlacedNpc, itemInstanceId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const nodeId = state.currentNodeId;
  const prepared = getPreparedPlacedNpcState(state, nodeId, placedNpc.npcId);
  const interaction = canInteractWithNpc(prepared.state, prepared.runtimeState, ctx);

  if (!interaction.allowed) return interaction.state;

  const result = pickUseItemRule(interaction.state, placedNpc.rules ?? {}, itemInstanceId);

  if (result.kind === "none") return showMessage(interaction.state, DEFAULT_CANNOT_USE_MESSSAGE, ctx);

  if (result.kind === "blocked") return showBlockedPhrase(interaction.state, result.phrase, ctx);

  return applyEffects(interaction.state, result.rule.effects ?? [], ctx);
}