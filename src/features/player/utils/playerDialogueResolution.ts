import type { Dialogue } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { evaluateCondition } from "@/engine/conditions/evaluateConditions";

export function findActiveDialogue(gameState: GameState): Dialogue | null {
  const active = gameState.activeDialogue;
  if (!active) return null;

  const node = gameState.project.nodes.find((candidate) => candidate.id === active.nodeId);
  if (!node) return null;

  return (node.dialogues ?? []).find((dialogue) => dialogue.id === active.dialogueId) ?? null;
}

export function findCurrentDialogueNode(gameState: GameState) {
  const active = gameState.activeDialogue;
  const dialogue = findActiveDialogue(gameState);

  if (!active || !dialogue) return null;

  return dialogue.nodes.find((node) => node.id === active.currentNodeId) ?? null;
}

export function getDialogueOptions(gameState: GameState) {
  const activeDialogue = findActiveDialogue(gameState);
  const currentDialogueNode = findCurrentDialogueNode(gameState);

  if (!activeDialogue || !currentDialogueNode) return [];
  if (gameState.activeDialogue?.phase !== "choosing") return [];

  return currentDialogueNode.childrenIds
    .map((childId) => activeDialogue.nodes.find((node) => node.id === childId))
    .filter((node): node is NonNullable<typeof node> => Boolean(node))
    .filter((node) => node.type === "line")
    .filter((node) => node.speaker === "player")
    .filter((node) => !node.when || evaluateCondition(gameState, node.when));
}

export function getActiveDialogueLine(gameState: GameState) {
  const currentDialogueNode = findCurrentDialogueNode(gameState);

  if (currentDialogueNode && currentDialogueNode.type === "line" && gameState.activeDialogue?.phase === "speaking") return currentDialogueNode;

  return null;
}