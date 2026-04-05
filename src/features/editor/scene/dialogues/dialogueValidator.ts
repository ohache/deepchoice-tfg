import { DialogueSchema, type Dialogue, type DialogueLineNode, type DialogueNode } from "@/features/editor/scene/dialogues/dialogueSchemas";
import { createFieldErrors, validateWithSchema } from "@/features/editor/scene/interactiveComponents/interactiveValidator";

const dialogueErrorKeys = ["title", "playerId", "npcId", "rootId", "nodes"] as const;

export type DialogueFieldErrors = Record<(typeof dialogueErrorKeys)[number], string | undefined>;

const missingNodesError = "El diálogo necesita al menos un nodo raíz y una línea.";
const invalidRootError = "rootId debe existir en nodes y apuntar a un nodo root.";
const missingLineNodesError = "El diálogo necesita al menos una línea.";
const invalidChildrenError = "childrenIds debe apuntar solo a nodos válidos.";
const invalidTreeError = "El diálogo debe formar un árbol válido.";
const multipleRootsError = "El diálogo solo puede tener un nodo root.";
const missingEndDialogueError = "El diálogo debe tener al menos una línea con el efecto de salir del diálogo.";
const invalidNpcFallbackCountError = "Las respuestas alternativas de NPC a una línea del Player deben tener exactamente una opción sin condición.";
const playerLineWithoutNpcResponseError = "Una línea inicial del Player debe tener una respuesta de NPC, salvo que termine el diálogo.";

function createDialogueFieldErrors(): DialogueFieldErrors {
  return createFieldErrors(dialogueErrorKeys);
}

function isLineNode(node: Dialogue["nodes"][number]): node is DialogueLineNode {
  return node.type === "line";
}

function hasAtLeastOneEndDialogue(dialogue: Dialogue): boolean {
  return dialogue.nodes.some((node) => {
    if (node.type !== "line") return false;
    return (node.effects ?? []).some((eff) => eff.type === "endDialogue");
  });
}

function hasOnlyValidChildren(nodes: Dialogue["nodes"]): boolean {
  const nodeIds = new Set(nodes.map((node) => node.id));

  return nodes.every((node) => node.childrenIds.every((childId) => nodeIds.has(childId)));
}

function hasValidParentCounts(rootNode: Dialogue["nodes"][number], lineNodes: DialogueLineNode[], nodes: Dialogue["nodes"]): boolean {
  const parentCount = new Map<string, number>();

  for (const node of nodes) {
    for (const childId of node.childrenIds) {
      parentCount.set(childId, (parentCount.get(childId) ?? 0) + 1);
    }
  }

  if ((parentCount.get(rootNode.id) ?? 0) !== 0) return false;

  return lineNodes.every((node) => (parentCount.get(node.id) ?? 0) === 1);
}

function isConnectedAcyclicTree(rootNodeId: string, nodes: Dialogue["nodes"]): boolean {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const byId = new Map(nodes.map((node) => [node.id, node]));

  function dfs(nodeId: string): boolean {
    if (visiting.has(nodeId)) return false;
    if (visited.has(nodeId)) return true;

    const node = byId.get(nodeId);
    if (!node) return false;

    visiting.add(nodeId);

    for (const childId of node.childrenIds) {
      if (!dfs(childId)) return false;
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    return true;
  }

  if (!dfs(rootNodeId)) return false;
  return visited.size === nodes.length;
}

function hasEndDialogueEffect(node: DialogueLineNode): boolean {
  return (node.effects ?? []).some((eff) => eff.type === "endDialogue");
}

function getLineChildrenBySpeaker(
  parent: DialogueNode,
  byId: Map<string, DialogueNode>,
  speaker: DialogueLineNode["speaker"]
): DialogueLineNode[] {
  return parent.childrenIds
    .map((childId) => byId.get(childId))
    .filter((child): child is DialogueNode => child != null)
    .filter((child): child is DialogueLineNode => isLineNode(child) && child.speaker === speaker);
}

function hasInvalidNpcFallbackCountFromPlayer(nodes: Dialogue["nodes"]): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node] as const));

  for (const node of nodes) {
    if (!isLineNode(node) || node.speaker !== "player") continue;
    if (hasEndDialogueEffect(node)) continue;

    const npcChildren = getLineChildrenBySpeaker(node, byId, "npc");
    if (npcChildren.length === 0) continue;

    const npcFallbackCount = npcChildren.filter((child) => child.when == null).length;

    if (npcFallbackCount !== 1) return true;
  }

  return false;
}

function hasPlayerLineWithoutNpcResponse(dialogue: Dialogue): boolean {
  const byId = new Map(dialogue.nodes.map((node) => [node.id, node] as const));

  const parentByChildId = new Map<string, Dialogue["nodes"][number]>();
  for (const node of dialogue.nodes) {
    for (const childId of node.childrenIds ?? []) {
      parentByChildId.set(childId, node);
    }
  }

  for (const node of dialogue.nodes) {
    if (!isLineNode(node) || node.speaker !== "player") continue;
    if (hasEndDialogueEffect(node)) continue;

    const parent = parentByChildId.get(node.id);
    const isRootChild = parent?.id === dialogue.rootId;

    if (!isRootChild) continue;

    const npcChildren = getLineChildrenBySpeaker(node, byId, "npc");

    if (npcChildren.length === 0) return true;
  }

  return false;
}

function applyBusinessRules(dialogue: Dialogue, errors: DialogueFieldErrors): void {
  const nodes = dialogue.nodes;

  if (nodes.length === 0) {
    errors.nodes ??= missingNodesError;
    return;
  }

  const rootNodes = nodes.filter((node) => node.type === "root");
  const lineNodes = nodes.filter(isLineNode);

  if (rootNodes.length !== 1) {
    errors.nodes ??= multipleRootsError;
    return;
  }

  const rootNode = rootNodes[0]!;

  if (dialogue.rootId !== rootNode.id) errors.rootId ??= invalidRootError;

  if (lineNodes.length === 0) {
    errors.nodes ??= missingLineNodesError;
    return;
  }

  if (!hasOnlyValidChildren(nodes)) {
    errors.nodes ??= invalidChildrenError;
    return;
  }

  if (!hasValidParentCounts(rootNode, lineNodes, nodes)) {
    errors.nodes ??= invalidTreeError;
    return;
  }

  if (!isConnectedAcyclicTree(rootNode.id, nodes)) {
    errors.nodes ??= invalidTreeError;
    return;
  }

  if (!hasAtLeastOneEndDialogue(dialogue)) errors.nodes ??= missingEndDialogueError;

  if (hasInvalidNpcFallbackCountFromPlayer(nodes)) {
    errors.nodes ??= invalidNpcFallbackCountError;
    return;
  }

  if (hasPlayerLineWithoutNpcResponse(dialogue)) errors.nodes ??= playerLineWithoutNpcResponseError;
}

export function validateDialogue(input: unknown) {
  return validateWithSchema(DialogueSchema, input, createDialogueFieldErrors, applyBusinessRules);
}