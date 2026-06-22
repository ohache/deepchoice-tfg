import type { Dialogue, DialogueLineNode, DialogueNode } from "@/domain/types";
import { DialogueSchema } from "@/features/editor/scene/dialogues/dialogueSchemas";
import { createFieldErrors, validateWithSchema } from "@/features/editor/scene/interactiveComponents/interactiveValidator";

const dialogueErrorKeys = ["title", "playerId", "npcId", "rootId", "nodes"] as const;

export type DialogueFieldErrors = Record<(typeof dialogueErrorKeys)[number], string | undefined>;

const missingNodesError = "El diálogo necesita al menos un nodo raíz y una línea.";
const missingLineNodesError = "El diálogo necesita al menos una línea.";
const invalidRootError = "rootId debe existir en nodes y apuntar a un nodo root.";
const invalidChildrenError = "childrenIds debe apuntar solo a nodos válidos.";
const invalidTreeError = "El diálogo debe formar un árbol válido.";
const multipleRootsError = "El diálogo solo puede tener un nodo root.";
const duplicatedNodeIdsError = "No puede haber nodos de diálogo con el mismo id.";

function createDialogueFieldErrors(): DialogueFieldErrors {
  return createFieldErrors(dialogueErrorKeys);
}

function isLineNode(node: DialogueNode): node is DialogueLineNode {
  return node.type === "line";
}

function hasDuplicateNodeIds(nodes: DialogueNode[]): boolean {
  const seen = new Set<string>();

  for (const node of nodes) {
    if (seen.has(node.id)) return true;
    seen.add(node.id);
  }

  return false;
}

function hasOnlyValidChildren(nodes: DialogueNode[]): boolean {
  const nodeIds = new Set(nodes.map((node) => node.id));

  return nodes.every((node) => node.childrenIds.every((childId) => nodeIds.has(childId)));
}

function hasValidParentCounts(rootNode: DialogueNode, lineNodes: DialogueLineNode[], nodes: DialogueNode[]): boolean {
  const parentCount = new Map<string, number>();

  for (const node of nodes) {
    for (const childId of node.childrenIds) {
      parentCount.set(childId, (parentCount.get(childId) ?? 0) + 1);
    }
  }

  if ((parentCount.get(rootNode.id) ?? 0) !== 0) return false;

  return lineNodes.every((node) => (parentCount.get(node.id) ?? 0) === 1);
}

function isConnectedAcyclicTree(rootNodeId: string, nodes: DialogueNode[]): boolean {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const byId = new Map(nodes.map((node) => [node.id, node] as const));

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

function applyBusinessRules(dialogue: Dialogue, errors: DialogueFieldErrors): void {
  const nodes = dialogue.nodes;

  if (nodes.length === 0) {
    errors.nodes ??= missingNodesError;
    return;
  }

  if (hasDuplicateNodeIds(nodes)) {
    errors.nodes ??= duplicatedNodeIdsError;
    return;
  }

  const rootNodes = nodes.filter((node) => node.type === "root");
  const lineNodes = nodes.filter(isLineNode);

  if (rootNodes.length !== 1) {
    errors.nodes ??= multipleRootsError;
    return;
  }

  const rootNode = rootNodes[0];

  if (dialogue.rootId !== rootNode.id) {
    errors.rootId ??= invalidRootError;
    return;
  }

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
  }
}

export function validateDialogue(input: unknown) {
  return validateWithSchema( DialogueSchema, input, createDialogueFieldErrors, applyBusinessRules);
}