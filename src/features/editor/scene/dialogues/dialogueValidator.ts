import { DialogueSchema, type Dialogue, type DialogueLineNode } from "@/features/editor/scene/dialogues/dialogueSchemas";
import { createFieldErrors, validateWithSchema } from "@/features/editor/scene/interactiveComponents/interactiveValidator";

const dialogueErrorKeys = ["playerId", "npcId", "rootId", "nodes"] as const;

export type DialogueFieldErrors = Record<(typeof dialogueErrorKeys)[number], string | undefined>;

const missingNodesError = "El diálogo necesita al menos un nodo raíz y una línea.";
const invalidRootError = "rootId debe existir en nodes y apuntar a un nodo root.";
const missingLineNodesError = "El diálogo necesita al menos una línea.";
const invalidChildrenError = "childrenIds debe apuntar solo a nodos válidos.";
const invalidTreeError = "El diálogo debe formar un árbol válido.";
const multipleRootsError = "El diálogo solo puede tener un nodo root.";
const missingEndDialogueError = "El diálogo debe tener al menos una línea con el efecto de salir del diálogo.";

function createDialogueFieldErrors(): DialogueFieldErrors {
  return createFieldErrors(dialogueErrorKeys);
}

function isLineNode(node: Dialogue["nodes"][number]): node is DialogueLineNode {
  return node.type === "line";
}

function hasAtLeastOneEndDialogue(dialogue: Dialogue): boolean {
  return (dialogue.nodes ?? []).some((node) => {
    if (node.type !== "line") return false;
    return (node.effects ?? []).some((eff) => eff.type === "endDialogue");
  });
}

function applyBusinessRules(dialogue: Dialogue, errors: DialogueFieldErrors): void {
  const nodes = dialogue.nodes ?? [];

  if (nodes.length === 0) {
    errors.nodes ??= missingNodesError;
    return;
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const rootNodes = nodes.filter((node) => node.type === "root");
  const lineNodes = nodes.filter(isLineNode);

  if (rootNodes.length !== 1) {
    errors.nodes ??= multipleRootsError;
    return;
  }

  const rootNode = rootNodes[0]!;

  if (dialogue.rootId !== rootNode.id) {
    errors.rootId ??= invalidRootError;
  }

  if (lineNodes.length === 0) {
    errors.nodes ??= missingLineNodesError;
    return;
  }

  for (const node of nodes) {
    const childrenIds = node.childrenIds ?? [];
    const hasInvalidTarget = childrenIds.some((id) => !nodeIds.has(id));

    if (hasInvalidTarget) {
      errors.nodes ??= invalidChildrenError;
      return;
    }
  }

  const parentCount = new Map<string, number>();

  for (const node of nodes) {
    for (const childId of node.childrenIds ?? []) {
      parentCount.set(childId, (parentCount.get(childId) ?? 0) + 1);
    }
  }

  for (const node of lineNodes) {
    const count = parentCount.get(node.id) ?? 0;
    if (count !== 1) {
      errors.nodes ??= invalidTreeError;
      return;
    }
  }

  if ((parentCount.get(rootNode.id) ?? 0) !== 0) {
    errors.nodes ??= invalidTreeError;
    return;
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const byId = new Map(nodes.map((node) => [node.id, node]));

  function dfs(nodeId: string): boolean {
    if (visiting.has(nodeId)) return false;
    if (visited.has(nodeId)) return true;

    visiting.add(nodeId);

    const node = byId.get(nodeId);
    if (!node) return false;

    for (const childId of node.childrenIds ?? []) {
      if (!dfs(childId)) return false;
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    return true;
  }

  if (!dfs(rootNode.id)) {
    errors.nodes ??= invalidTreeError;
    return;
  }

  if (visited.size !== nodes.length) {
    errors.nodes ??= invalidTreeError;
    return;
  }

  if (!hasAtLeastOneEndDialogue(dialogue)) {
    errors.nodes ??= missingEndDialogueError;
  }
}

export function validateDialogue(input: unknown) {
  return validateWithSchema(DialogueSchema, input, createDialogueFieldErrors, applyBusinessRules);
}