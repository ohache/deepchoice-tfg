import type { ID, Project, Dialogue, DialogueNode, DialogueLineNode, DialogueRootNode, PlayerDef, NpcDef, Node } from "@/domain/types";
import type { DialogueEditorContext, DialogueEditorState } from "@/features/editor/scene/dialogues/dialogueEditorTypes";
import { validateDialogue } from "@/features/editor/scene/dialogues/dialogueValidator";
import type { InteractiveListEntry } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";
import { deepClonePojo } from "@/features/editor/core/editorDataUtils";
import { generateId } from "@/utils/id";
import type { Option } from "@/components/Select";


/* Crea un diálogo nuevo con un nodo root inicial */
export const createDialogue = (args: { id: ID; playerId: ID; npcId: ID; title: string; description?: string }): Dialogue => {
  const rootId = generateId.dialogueRoot();

  const rootNode: DialogueRootNode = { id: rootId, type: "root", childrenIds: [] };

  return {
    id: args.id,
    playerId: args.playerId,
    npcId: args.npcId,
    title: args.title,
    ...(args.description ? { description: args.description } : null),
    rootId,
    nodes: [rootNode],
  };
};

/* Crea un nodo de tipo línea */
export function createDialogueLineNode( id: ID, input?: Partial<Pick<DialogueLineNode, "speaker" | "text" | "when" | "effects">>): DialogueLineNode {
  return {
    id,
    type: "line",
    speaker: input?.speaker ?? "player",
    text: input?.text ?? "",
    ...(input?.when ? { when: input.when } : null),
    ...(input?.effects ? { effects: input.effects } : null),
    childrenIds: [],
  };
}

/* Estado inicial limpio del editor de diálogos */
export const createEmptyDialogueEditorState = (): DialogueEditorState => ({
  context: null,
  mode: { type: "idle" },
  selection: { selectedDialogueId: null, selectedNodeId: null },
  dialogueDraft: null,
  lineDraft: null,
});

/* Construye el contexto mínimo del editor a partir del id de escena */
export function buildDialogueEditorContext(nodeId: ID | null | undefined): DialogueEditorContext | null {
  return nodeId ? { nodeId } : null;
}

/* Reordena elementos de forma segura */
function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (items.length <= 1) return items;
  if (fromIndex === toIndex) return items;
  if (fromIndex < 0 || fromIndex >= items.length) return items;
  if (toIndex < 0 || toIndex >= items.length) return items;

  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
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

function isDialogueRootNode(node: DialogueNode): node is DialogueRootNode {
  return node.type === "root";
}

export type DialogueIndex = ReadonlyMap<ID, DialogueNode>;

/* Índice rápido de nodos por id para evitar búsquedas lineales repetidas */
export function buildDialogueIndex(dialogue: Dialogue): DialogueIndex {
  return new Map(dialogue.nodes.map((node) => [node.id, node] as const));
}

/* Búsqueda */
function findDialogueNode(dialogue: Dialogue | null, nodeId: ID | null | undefined): DialogueNode | null {
  if (!dialogue || !nodeId) return null;
  return dialogue.nodes.find((node) => node.id === nodeId) ?? null;
}

/* Variante optimizada usando índice preconstruido */
export function findDialogueNodeInIndex(index: DialogueIndex, nodeId: ID | null | undefined): DialogueNode | null {
  if (!nodeId) return null;
  return index.get(nodeId) ?? null;
}

export function findDialogueLineNode(dialogue: Dialogue | null, nodeId: ID | null | undefined): DialogueLineNode | null {
  const node = findDialogueNode(dialogue, nodeId);
  return node && isDialogueLineNode(node) ? node : null;
}

/* Variante optimizada usando índice preconstruido */
export function findDialogueLineNodeInIndex(index: DialogueIndex, nodeId: ID | null | undefined): DialogueLineNode | null {
  const node = findDialogueNodeInIndex(index, nodeId);
  return node && isDialogueLineNode(node) ? node : null;
}

/* Devuelve las líneas hijas de un nodo usando el índice del diálogo */
export function getDialogueChildLines(index: DialogueIndex, parentId: ID | null | undefined): DialogueLineNode[] {
  const parent = findDialogueNodeInIndex(index, parentId);
  const childIds = parent?.childrenIds ?? [];

  return childIds.map((childId) => findDialogueLineNodeInIndex(index, childId)).filter((child): child is DialogueLineNode => Boolean(child));
}

function findDialogueRootNode(dialogue: Dialogue | null): DialogueRootNode | null {
  if (!dialogue) return null;
  const node = findDialogueNode(dialogue, dialogue.rootId);
  return node && isDialogueRootNode(node) ? node : null;
}

/* Sustituye un nodo existente dentro del diálogo */
function replaceNodeInDialogue(dialogue: Dialogue, nextNode: DialogueNode): Dialogue {
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
  if (!editor.dialogueDraft) return null;

  const dialogue = cloneDialogue(editor.dialogueDraft);

  return editor.lineDraft  ? upsertLineInDialogue(dialogue, editor.lineDraft) : dialogue;
}

/* Elimina una referencia a un child id de todos los nodos */
function removeIdFromDialogueChildren(nodes: DialogueNode[], targetId: ID): DialogueNode[] {
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
function collectDialogueSubtreeIds(dialogue: Dialogue, startId: ID): Set<ID> {
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

  return (result.errors.title ?? result.errors.nodes ?? result.errors.rootId ?? result.errors.playerId ?? result.errors.npcId ?? "El diálogo no es válido.");
}

/* Inserta el diálogo draft en la escena activa para que modales/reglas trabajen con una   versión viva del proyecto */
export function buildLiveProjectWithDialogueDraft(args: { project: Project | null; nodeDraft: Project["nodes"][number] | null;
  nodeId: ID; dialogueEditor: DialogueEditorState }): Project | null {
  const { project, nodeDraft, nodeId, dialogueEditor } = args;
  if (!project) return null;

  const dialogueDraft = materializeDialogueDraft(dialogueEditor);
  if (!dialogueDraft) return project;

  const baseNode = nodeDraft ?? project.nodes.find((node) => node.id === nodeId) ?? null;
  if (!baseNode) return project;

  const baseDialogues = baseNode.dialogues ?? [];
  const exists = baseDialogues.some((dialogue) => dialogue.id === dialogueDraft.id);

  const nextNode = {
    ...baseNode,
    dialogues: exists ? baseDialogues.map((dialogue) => dialogue.id === dialogueDraft.id ? dialogueDraft : dialogue) : [...baseDialogues, dialogueDraft],
  };

  return { ...project, nodes: project.nodes.map((node) => node.id === nodeId ? nextNode : node) };
}

export function addLineToDialogue(dialogue: Dialogue, parentId: ID, line: DialogueLineNode): Dialogue | null {
  const parent = findDialogueNode(dialogue, parentId);
  if (!parent) return null;

  const nextParent: DialogueNode = { ...parent, childrenIds: [...parent.childrenIds, line.id] };

  const withParent = replaceNodeInDialogue(dialogue, nextParent);

  return { ...withParent, nodes: [...withParent.nodes, cloneDialogueLine(line)] };
}

export function removeLineSubtreeFromDialogue(dialogue: Dialogue, lineId: ID): { dialogue: Dialogue; removedIds: Set<ID> } | null {
  const target = findDialogueLineNode(dialogue, lineId);
  if (!target) return null;

  const rootChildren = findDialogueRootNode(dialogue)?.childrenIds ?? [];
  const isLastRootChild = rootChildren.includes(lineId) && rootChildren.length <= 1;

  if (isLastRootChild) return null;

  const removedIds = collectDialogueSubtreeIds(dialogue, lineId);

  let nodes = dialogue.nodes.filter((node) => !removedIds.has(node.id));
  nodes = removeIdFromDialogueChildren(nodes, lineId);

  return {
    dialogue: { ...dialogue, nodes },
    removedIds,
  };
}

export function patchDialogueLine(dialogue: Dialogue, lineId: ID, patch: Partial<Omit<DialogueLineNode, "id" | "type">>): Dialogue {
  const nodes0 = dialogue.nodes;
  const index = nodes0.findIndex((node) => node.id === lineId && isDialogueLineNode(node));

  if (index < 0) return dialogue;

  const current = nodes0[index];
  if (!current || !isDialogueLineNode(current)) return dialogue;

  const nodes1 = nodes0.slice();
  nodes1[index] = { ...current, ...patch };

  return { ...dialogue, nodes: nodes1 };
}

export function reorderDialogueChildren(dialogue: Dialogue, parentId: ID, fromIndex: number, toIndex: number): Dialogue {
  const parent = findDialogueNode(dialogue, parentId);
  if (!parent) return dialogue;

  const childrenIds0 = parent.childrenIds;
  const childrenIds1 = reorderItems(childrenIds0, fromIndex, toIndex);

  if (childrenIds1 === childrenIds0) return dialogue;

  return replaceNodeInDialogue(dialogue, { ...parent, childrenIds: childrenIds1 });
}

export function buildCharacterOptions<T extends PlayerDef | NpcDef>(items: T[]): Option<string>[] {
  return items.map((item) => ({ id: item.id, label: item.name?.trim() || item.id }));
}

export function findCharacterName<T extends { id: ID; name?: string }>(items: T[] | undefined, id: ID | null | undefined, fallback: string): string {
  if (!id) return fallback;
  const item = (items ?? []).find((entry) => entry.id === id);
  return item?.name?.trim() || id;
}

/* Obtiene un nombre legible de player/NPC o cae al id */
export function getEntityName<T extends PlayerDef | NpcDef>(entities: T[], id: ID): string {
  return entities.find((entity) => entity.id === id)?.name?.trim() || id;
}

export function filterEntitiesByIds<T extends { id: ID }>(entities: T[], ids: ID[]): T[] {
  const idSet = new Set(ids);
  return entities.filter((entity) => idSet.has(entity.id));
}

export function buildDefaultDialogueTitle(dialogues: Dialogue[]): string {
  return `Diálogo ${dialogues.length + 1}`;
}

/* Convierte los diálogos de la escena a entradas del panel de lista */
export function buildDialogueListEntries(dialogues: Dialogue[], players: PlayerDef[], npcs: NpcDef[]): InteractiveListEntry[] {
  return dialogues.map((dialogue, index) => {
    const playerName = getEntityName(players, dialogue.playerId);
    const npcName = getEntityName(npcs, dialogue.npcId);
    const baseLabel = dialogue.title?.trim() || `Diálogo ${index + 1}`;

    return { id: dialogue.id, label: `${baseLabel} : ${playerName} - ${npcName}` };
  });
}

export function getPlacedPlayerIds(nodeDraft: Node | null): ID[] {
  const ids = new Set<ID>();

  for (const layer of nodeDraft?.layers ?? []) {
    for (const placedPlayer of layer.placedPlayers ?? []) ids.add(placedPlayer.playerId);
  }

  return [...ids];
}

export function getPlacedNpcIds(nodeDraft: Node | null): ID[] {
  const ids = new Set<ID>();

  for (const layer of nodeDraft?.layers ?? []) {
    for (const placedNpc of layer.placedNpcs ?? []) ids.add(placedNpc.npcId);
  }

  return [...ids];
}