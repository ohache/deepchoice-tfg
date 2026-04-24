import type { ID, Node, Project, Dialogue, DialogueNode, DialogueLineNode, DialogueRootNode } from "@/domain/types";
import type { DialogueEditorContext, DialogueEditorSelection, DialogueEditorState } from "@/features/editor/scene/dialogues/dialogueEditorTypes";
import { validateDialogue } from "@/features/editor/scene/dialogues/dialogueValidator";
import { deepClonePojo } from "@/features/editor/core/editorGenericSlice";

/* Construye el contexto mínimo del editor a partir del id de escena */
export function buildDialogueEditorContext(nodeId: ID | null | undefined): DialogueEditorContext | null {
  return nodeId ? { nodeId } : null;
}

/* Reordena elementos de forma segura */
export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (items.length <= 1) return items;
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  if (toIndex < 0 || toIndex >= items.length) return items;

  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/* Lee los diálogos activos de una escena */
export function readNodeDialogues(nodeDraft: Node | null): Dialogue[] {
  return nodeDraft?.dialogues ?? [];
}

/* Clonado seguro de diálogo */
export function cloneDialogue(dialogue: Dialogue): Dialogue {
  return deepClonePojo(dialogue);
}

/* Clonado seguro de línea */
export function cloneDialogueLine(line: DialogueLineNode): DialogueLineNode {
  return deepClonePojo(line);
}

export function isDialogueLineNode(node: DialogueNode): node is DialogueLineNode {
  return node.type === "line";
}

export function isDialogueRootNode(node: DialogueNode): node is DialogueRootNode {
  return node.type === "root";
}

/* Índice rápido de nodos por id para evitar búsquedas lineales repetidas */
export function buildDialogueIndex(dialogue: Dialogue): Map<ID, DialogueNode> {
  return new Map(dialogue.nodes.map((node) => [node.id, node] as const));
}

/* Búsqueda */
export function findDialogueNode(dialogue: Dialogue | null, nodeId: ID | null | undefined): DialogueNode | null {
  if (!dialogue || !nodeId) return null;
  return dialogue.nodes.find((node) => node.id === nodeId) ?? null;
}

/* Variante optimizada usando índice preconstruido */
export function findDialogueNodeInIndex(index: ReadonlyMap<ID, DialogueNode>, nodeId: ID | null | undefined): DialogueNode | null {
  if (!nodeId) return null;
  return index.get(nodeId) ?? null;
}

export function findDialogueLineNode(dialogue: Dialogue | null, nodeId: ID | null | undefined): DialogueLineNode | null {
  const node = findDialogueNode(dialogue, nodeId);
  return node && isDialogueLineNode(node) ? node : null;
}

/* Variante optimizada usando índice preconstruido */
export function findDialogueLineNodeInIndex(index: ReadonlyMap<ID, DialogueNode>, nodeId: ID | null | undefined): DialogueLineNode | null {
  const node = findDialogueNodeInIndex(index, nodeId);
  return node && isDialogueLineNode(node) ? node : null;
}

export function findDialogueRootNode(dialogue: Dialogue | null): DialogueRootNode | null {
  if (!dialogue) return null;
  const node = findDialogueNode(dialogue, dialogue.rootId);
  return node && isDialogueRootNode(node) ? node : null;
}

/* Sustituye un nodo existente dentro del diálogo */
export function replaceNodeInDialogue(dialogue: Dialogue, nextNode: DialogueNode): Dialogue {
  const nodes0 = dialogue.nodes ?? [];
  const index = nodes0.findIndex((node) => node.id === nextNode.id);
  if (index < 0) return dialogue;

  const nodes1 = nodes0.slice();
  nodes1[index] = nextNode;

  return { ...dialogue, nodes: nodes1 };
}

/* Inserta o actualiza una línea dentro del diálogo */
export function upsertLineInDialogue(dialogue: Dialogue, line: DialogueLineNode): Dialogue {
  const nodes0 = dialogue.nodes ?? [];
  const index = nodes0.findIndex((node) => node.id === line.id);

  if (index < 0) return { ...dialogue, nodes: [...nodes0, cloneDialogueLine(line)] };

  const nodes1 = nodes0.slice();
  nodes1[index] = cloneDialogueLine(line);

  return { ...dialogue, nodes: nodes1 };
}

/* Materializa el diálogo draft incorporando la lineDraft si existe */
export function materializeDialogueDraft(editor: DialogueEditorState): Dialogue | null {
  const dialogueDraft = editor.dialogueDraft;
  if (!dialogueDraft) return null;

  if (!editor.lineDraft) return cloneDialogue(dialogueDraft);

  return upsertLineInDialogue(cloneDialogue(dialogueDraft), editor.lineDraft);
}

/* Asegura una selección consistente para selectedNodeId */
export function ensureDialogueSelectionForNode(selection: DialogueEditorSelection, nodeId: ID | null): DialogueEditorSelection {
  return {
    ...selection,
    selectedNodeId: nodeId,
  };
}

/* Elimina una referencia a un child id de todos los nodos */
export function removeIdFromDialogueChildren(nodes: DialogueNode[], targetId: ID): DialogueNode[] {
  let changed = false;

  const nextNodes = nodes.map((node) => {
    const current = node.childrenIds ?? [];
    const filtered = current.filter((id) => id !== targetId);

    if (filtered.length === current.length) return node;

    changed = true;
    return { ...node, childrenIds: filtered };
  });

  return changed ? nextNodes : nodes;
}

/* Recolecta todos los ids del subárbol que cuelga de startId */
export function collectDialogueSubtreeIds(dialogue: Dialogue, startId: ID): Set<ID> {
  const byId = new Map(dialogue.nodes.map((node) => [node.id, node] as const));
  const collected = new Set<ID>();

  function dfs(nodeId: ID) {
    if (collected.has(nodeId)) return;

    const node = byId.get(nodeId);
    if (!node) return;

    collected.add(nodeId);

    for (const childId of node.childrenIds ?? []) {
      dfs(childId);
    }
  }

  dfs(startId);
  return collected;
}

/* Integra lineDraft dentro de dialogueDraft, si procede */
export function commitCurrentLineIntoDialogueEditorState(editor: DialogueEditorState): DialogueEditorState {
  if (!editor.dialogueDraft || !editor.lineDraft) return editor;

  return {
    ...editor,
    dialogueDraft: upsertLineInDialogue(editor.dialogueDraft, editor.lineDraft),
  };
}

/* Devuelve el mensaje de error prioritario de validación */
export function getDialogueValidationError(dialogue: Dialogue): string | null {
  const result = validateDialogue(dialogue);
  if (result.ok) return null;

  return (
    result.errors.title ??
    result.errors.nodes ??
    result.errors.rootId ??
    result.errors.playerId ??
    result.errors.npcId ??
    "El diálogo no es válido."
  );
}

/* Inserta el diálogo draft en la escena activa para que modales/reglas trabajen con una   versión viva del proyecto */
export function buildLiveProjectWithDialogueDraft(args: { project: Project | null; nodeDraft: Project["nodes"][number] | null;
  nodeId: ID; dialogueDraft: Dialogue | null }): Project | null {
  const { project, nodeDraft, nodeId, dialogueDraft } = args;
  if (!project) return null;

  const baseNode = nodeDraft ?? (project.nodes ?? []).find((node) => node.id === nodeId) ?? null;

  if (!baseNode || !dialogueDraft) return project;

  const baseDialogues = baseNode.dialogues ?? [];
  const exists = baseDialogues.some((dialogue) => dialogue.id === dialogueDraft.id);

  const nextNode = {
    ...baseNode,
    dialogues: exists
      ? baseDialogues.map((dialogue) => dialogue.id === dialogueDraft.id ? dialogueDraft : dialogue)
      : [...baseDialogues, dialogueDraft],
  };

  return {
    ...project,
    nodes: (project.nodes ?? []).map((node) =>
      node.id === nodeId ? nextNode : node
    ),
  };
}