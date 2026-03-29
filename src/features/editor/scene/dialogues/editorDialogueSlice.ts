import type { ID, Node, Dialogue, DialogueNode, DialogueLineNode, DialogueRootNode } from "@/domain/types";
import type { DialogueEditorContext, DialogueEditorSelection, DialogueEditorState } from "@/features/editor/scene/dialogues/dialogueEditorTypes";
import { createDialogue, createDialogueLineNode, createEmptyDialogueEditorState } from "@/features/editor/scene/dialogues/dialogueHelpers";
import { validateDialogue } from "@/features/editor/scene/dialogues/dialogueValidator";
import { generateId } from "@/utils/id";
import { deepClonePojo, safeTrim } from "@/features/editor/core/editorGenericSlice";

export const initialDialogueEditorState: DialogueEditorState =
  createEmptyDialogueEditorState();

type Store = {
  nodeDraft: Node | null;
  dialogueEditor: DialogueEditorState;
};

export interface EditorDialoguesSlice {
  dialogueEditor: DialogueEditorState;

  getActiveDialogues: () => Dialogue[];
  setNodeDialogues: (dialogues: Dialogue[]) => void;

  setDialogueSelection: (input: Partial<DialogueEditorSelection>) => void;
  clearDialogueEditor: () => void;

  startCreatingDialogue: (input: { playerId: ID; npcId: ID; title?: string; description?: string }) => ID | null;

  editDialogue: (dialogueId: ID) => void;
  cancelDialogueDraft: () => void;
  commitLineDraft: () => ID | null;
  commitDialogueDraft: () => { ok: boolean; id?: ID; error?: string };

  setDialogueTitle: (dialogueId: ID, title: string) => void;
  setDialogueDescription: (dialogueId: ID, description: string) => void;
  setDialoguePlayerId: (dialogueId: ID, playerId: ID) => void;
  setDialogueNpcId: (dialogueId: ID, npcId: ID) => void;
  setDialogueWhen: (dialogueId: ID, when: Dialogue["when"]) => void;
  setDialogueRootId: (dialogueId: ID, rootId: ID) => void;

  removeDialogue: (dialogueId: ID) => void;
  reorderDialogues: (fromIndex: number, toIndex: number) => void;

  addDialogueLine: (dialogueId: ID, args?: { speaker?: DialogueLineNode["speaker"]; text?: string; parentId?: ID }) => ID | null;
  updateDialogueLine: (dialogueId: ID, lineId: ID, patch: Partial<DialogueLineNode>) => void;
  removeDialogueLine: (dialogueId: ID, lineId: ID) => void;
  reorderDialogueLines: (dialogueId: ID, fromIndex: number, toIndex: number) => void;

  validateDialogueDraft: (dialogueId?: ID | null) => { ok: boolean; error?: string };
}

function buildContext(nodeId: ID | null | undefined): DialogueEditorContext | null {
  if (!nodeId) return null;
  return { nodeId };
}

function reorder<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  if (arr.length <= 1) return arr;
  if (fromIndex === toIndex) return arr;
  if (fromIndex < 0 || fromIndex >= arr.length) return arr;
  if (toIndex < 0 || toIndex >= arr.length) return arr;

  const next = arr.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function readDialogues(nodeDraft: Node | null): Dialogue[] {
  return nodeDraft?.dialogues ?? [];
}

function cloneDialogue(dialogue: Dialogue): Dialogue {
  return deepClonePojo(dialogue);
}

function cloneLine(line: DialogueLineNode): DialogueLineNode {
  return deepClonePojo(line);
}

function isLineNode(node: DialogueNode): node is DialogueLineNode {
  return node.type === "line";
}

function isRootNode(node: DialogueNode): node is DialogueRootNode {
  return node.type === "root";
}

function findNode(dialogue: Dialogue | null, nodeId: ID | null | undefined): DialogueNode | null {
  if (!dialogue || !nodeId) return null;
  return dialogue.nodes.find((node) => node.id === nodeId) ?? null;
}

function findLineNode(dialogue: Dialogue | null, nodeId: ID | null | undefined): DialogueLineNode | null {
  const node = findNode(dialogue, nodeId);
  return node && isLineNode(node) ? node : null;
}

function findRootNode(dialogue: Dialogue | null): DialogueRootNode | null {
  if (!dialogue) return null;
  const node = findNode(dialogue, dialogue.rootId);
  return node && isRootNode(node) ? node : null;
}

function replaceNodeInDialogue(dialogue: Dialogue, nextNode: DialogueNode): Dialogue {
  const nodes0 = dialogue.nodes ?? [];
  const idx = nodes0.findIndex((node) => node.id === nextNode.id);

  if (idx < 0) return dialogue;

  const nodes1 = nodes0.slice();
  nodes1[idx] = nextNode;

  return { ...dialogue, nodes: nodes1 };
}

function upsertLineInDialogue(dialogue: Dialogue, line: DialogueLineNode): Dialogue {
  const nodes0 = dialogue.nodes ?? [];
  const idx = nodes0.findIndex((node) => node.id === line.id);

  if (idx < 0) return { ...dialogue, nodes: [...nodes0, cloneLine(line)] };

  const nodes1 = nodes0.slice();
  nodes1[idx] = cloneLine(line);

  return { ...dialogue, nodes: nodes1 };
}

function materializeDialogueDraft(editor: DialogueEditorState): Dialogue | null {
  const dialogueDraft = editor.dialogueDraft;
  if (!dialogueDraft) return null;

  if (!editor.lineDraft) return cloneDialogue(dialogueDraft);
  return upsertLineInDialogue(cloneDialogue(dialogueDraft), editor.lineDraft);
}

function ensureSelectionForNode(selection: DialogueEditorSelection, nodeId: ID | null): DialogueEditorSelection {
  return {
    ...selection,
    selectedNodeId: nodeId,
  };
}

function removeIdFromChildren(nodes: DialogueNode[], targetId: ID): DialogueNode[] {
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

function collectSubtreeIds(dialogue: Dialogue, startId: ID): Set<ID> {
  const byId = new Map(dialogue.nodes.map((node) => [node.id, node]));
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

export function createEditorDialoguesSlice(set: (partial: Partial<Store> | ((s: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorDialoguesSlice {
  function withDialogueDraft(updater: (dialogue: Dialogue) => Dialogue) {
    set((s) => {
      const dialogue0 = s.dialogueEditor.dialogueDraft;
      if (!dialogue0) return s;

      const dialogue1 = updater(dialogue0);
      if (dialogue1 === dialogue0) return s;

      return {
        ...s,
        dialogueEditor: {
          ...s.dialogueEditor,
          dialogueDraft: dialogue1,
        },
      };
    });
  }

  function commitCurrentLineIntoDraft(s: Store): DialogueEditorState {
    const ed = s.dialogueEditor;
    if (!ed.dialogueDraft || !ed.lineDraft) return ed;

    return {
      ...ed,
      dialogueDraft: upsertLineInDialogue(ed.dialogueDraft, ed.lineDraft),
    };
  }

  return {
    dialogueEditor: initialDialogueEditorState,

    getActiveDialogues: () => readDialogues(get().nodeDraft),

    setNodeDialogues: (dialogues) =>
      set((s) => {
        if (!s.nodeDraft) return s;

        return {
          ...s,
          nodeDraft: {
            ...s.nodeDraft,
            dialogues: Array.isArray(dialogues) ? dialogues : [],
          },
        };
      }),

    setDialogueSelection: (input) =>
      set((s) => {
        const ed0 = commitCurrentLineIntoDraft(s);
        const currentSelection = ed0.selection;

        const nextSelection: DialogueEditorSelection = {
          ...currentSelection,
          ...input,
        };

        const nodeSelectionChanged =
          input.selectedNodeId !== undefined &&
          input.selectedNodeId !== currentSelection.selectedNodeId;

        const normalizedSelection = nodeSelectionChanged
          ? ensureSelectionForNode(nextSelection, input.selectedNodeId ?? null)
          : nextSelection;

        const nextNodeId =
          input.selectedNodeId !== undefined
            ? input.selectedNodeId
            : ed0.selection.selectedNodeId;

        const found = findLineNode(ed0.dialogueDraft, nextNodeId);

        return {
          ...s,
          dialogueEditor: {
            ...ed0,
            selection: normalizedSelection,
            lineDraft: found ? cloneLine(found) : null,
          },
        };
      }),

    clearDialogueEditor: () =>
      set((s) => ({
        ...s,
        dialogueEditor: initialDialogueEditorState,
      })),

    startCreatingDialogue: (input) => {
      const s = get();
      if (!s.nodeDraft) return null;

      const dialogueId = generateId.dialogue();

      const baseDialogue = createDialogue(dialogueId, input.playerId, input.npcId);

      const dialogueDraft: Dialogue = {
        ...baseDialogue,
        title: safeTrim(input.title ?? ""),
        description: safeTrim(input.description ?? ""),
      };

      set((st) => ({
        ...st,
        dialogueEditor: {
          context: buildContext(st.nodeDraft?.id),
          mode: { type: "creating" },
          selection: {
            selectedDialogueId: dialogueId,
            selectedNodeId: null,
          },
          dialogueDraft,
          lineDraft: null,
        },
      }));

      return dialogueId;
    },

    editDialogue: (dialogueId) =>
      set((s) => {
        const nodeDraft = s.nodeDraft;
        if (!nodeDraft) return s;

        const source = (nodeDraft.dialogues ?? []).find((d) => d.id === dialogueId);
        if (!source) return s;

        const dialogueDraft = cloneDialogue(source);

        return {
          ...s,
          dialogueEditor: {
            context: buildContext(nodeDraft.id),
            mode: { type: "editing", dialogueId },
            selection: {
              selectedDialogueId: dialogueId,
              selectedNodeId: null,
            },
            dialogueDraft,
            lineDraft: null,
          },
        };
      }),

    cancelDialogueDraft: () =>
      set((s) => ({
        ...s,
        dialogueEditor: initialDialogueEditorState,
      })),

    commitLineDraft: () => {
      const s = get();
      const lineDraft = s.dialogueEditor.lineDraft;
      const dialogueDraft = s.dialogueEditor.dialogueDraft;
      if (!lineDraft || !dialogueDraft) return null;

      set((st) => ({
        ...st,
        dialogueEditor: {
          ...st.dialogueEditor,
          dialogueDraft: upsertLineInDialogue(
            st.dialogueEditor.dialogueDraft as Dialogue,
            st.dialogueEditor.lineDraft as DialogueLineNode
          ),
        },
      }));

      return lineDraft.id;
    },

    commitDialogueDraft: () => {
      const s = get();
      if (!s.nodeDraft) return { ok: false, error: "No hay escena en edición." };

      const materialized = materializeDialogueDraft(s.dialogueEditor);
      if (!materialized) return { ok: false, error: "No hay diálogo en edición." };

      const validation = validateDialogue(materialized);
      if (!validation.ok) {
        const error =
          validation.errors.nodes ??
          validation.errors.rootId ??
          validation.errors.playerId ??
          validation.errors.npcId ??
          "El diálogo no es válido.";

        return { ok: false, error };
      }

      const mode = s.dialogueEditor.mode;
      const dialogues0 = s.nodeDraft.dialogues ?? [];

      const dialogues1 =
        mode.type === "creating"
          ? [...dialogues0, materialized]
          : dialogues0.some((d) => d.id === materialized.id)
            ? dialogues0.map((d) => (d.id === materialized.id ? materialized : d))
            : [...dialogues0, materialized];

      const selectedLine =
        findLineNode(materialized, s.dialogueEditor.selection.selectedNodeId) ??
        materialized.nodes.find(isLineNode) ??
        null;

      set((st) => ({
        ...st,
        nodeDraft: {
          ...st.nodeDraft!,
          dialogues: dialogues1,
        },
        dialogueEditor: {
          context: buildContext(st.nodeDraft?.id),
          mode: { type: "editing", dialogueId: materialized.id },
          selection: {
            selectedDialogueId: materialized.id,
            selectedNodeId: selectedLine?.id ?? null,
          },
          dialogueDraft: cloneDialogue(materialized),
          lineDraft: selectedLine ? cloneLine(selectedLine) : null,
        },
      }));

      return { ok: true, id: materialized.id };
    },

    setDialogueTitle: (dialogueId, title) =>
      withDialogueDraft((dialogue) => {
        if (dialogue.id !== dialogueId) return dialogue;
        const next = safeTrim(title ?? "");
        if ((dialogue.title ?? "") === next) return dialogue;
        return { ...dialogue, title: next };
      }),

    setDialogueDescription: (dialogueId, description) =>
      withDialogueDraft((dialogue) => {
        if (dialogue.id !== dialogueId) return dialogue;
        const next = safeTrim(description ?? "");
        if ((dialogue.description ?? "") === next) return dialogue;
        return { ...dialogue, description: next };
      }),

    setDialoguePlayerId: (dialogueId, playerId) =>
      withDialogueDraft((dialogue) =>
        dialogue.id !== dialogueId || dialogue.playerId === playerId
          ? dialogue
          : { ...dialogue, playerId }
      ),

    setDialogueNpcId: (dialogueId, npcId) =>
      withDialogueDraft((dialogue) =>
        dialogue.id !== dialogueId || dialogue.npcId === npcId
          ? dialogue
          : { ...dialogue, npcId }
      ),

    setDialogueWhen: (dialogueId, when) =>
      withDialogueDraft((dialogue) =>
        dialogue.id !== dialogueId || dialogue.when === when
          ? dialogue
          : { ...dialogue, when: when ?? undefined }
      ),

    setDialogueRootId: (dialogueId, rootId) =>
      withDialogueDraft((dialogue) =>
        dialogue.id !== dialogueId || dialogue.rootId === rootId
          ? dialogue
          : { ...dialogue, rootId }
      ),

    removeDialogue: (dialogueId) =>
      set((s) => {
        if (!s.nodeDraft) return s;

        const dialogues0 = s.nodeDraft.dialogues ?? [];
        const dialogues1 = dialogues0.filter((d) => d.id !== dialogueId);
        if (dialogues1.length === dialogues0.length) return s;

        const isEditing = s.dialogueEditor.selection.selectedDialogueId === dialogueId;

        return {
          ...s,
          nodeDraft: {
            ...s.nodeDraft,
            dialogues: dialogues1,
          },
          dialogueEditor: isEditing ? initialDialogueEditorState : s.dialogueEditor,
        };
      }),

    reorderDialogues: (fromIndex, toIndex) =>
      set((s) => {
        if (!s.nodeDraft) return s;

        const dialogues0 = s.nodeDraft.dialogues ?? [];
        const dialogues1 = reorder(dialogues0, fromIndex, toIndex);
        if (dialogues1 === dialogues0) return s;

        return {
          ...s,
          nodeDraft: {
            ...s.nodeDraft,
            dialogues: dialogues1,
          },
        };
      }),

    addDialogueLine: (dialogueId, args) => {
      const s = get();
      const ed = s.dialogueEditor;
      const dialogue0 = materializeDialogueDraft(ed);
      if (!dialogue0 || dialogue0.id !== dialogueId) return null;

      const lineId = generateId.dialogueLine();
      const parentId = args?.parentId ?? dialogue0.rootId;
      const parent = findNode(dialogue0, parentId);
      if (!parent) return null;

      const line: DialogueLineNode = {
        ...createDialogueLineNode(lineId),
        speaker: args?.speaker ?? "npc",
        text: args?.text ?? "",
      };

      const updatedParent: DialogueNode = {
        ...parent,
        childrenIds: [...(parent.childrenIds ?? []), lineId],
      };

      const withParent = replaceNodeInDialogue(dialogue0, updatedParent);
      const dialogue1: Dialogue = {
        ...withParent,
        nodes: [...withParent.nodes, cloneLine(line)],
      };

      set((st) => ({
        ...st,
        dialogueEditor: {
          ...st.dialogueEditor,
          selection: {
            ...st.dialogueEditor.selection,
            selectedDialogueId: dialogueId,
            selectedNodeId: lineId,
          },
          dialogueDraft: dialogue1,
          lineDraft: cloneLine(line),
        },
      }));

      return lineId;
    },

    updateDialogueLine: (dialogueId, lineId, patch) =>
      set((s) => {
        const ed = s.dialogueEditor;
        const dialogueDraft = ed.dialogueDraft;
        if (!dialogueDraft || dialogueDraft.id !== dialogueId) return s;

        const { id: _ignoredId, type: _ignoredType, ...rest } = patch;

        if (ed.lineDraft?.id === lineId) {
          return {
            ...s,
            dialogueEditor: {
              ...ed,
              lineDraft: { ...ed.lineDraft, ...rest },
            },
          };
        }

        const nodes0 = dialogueDraft.nodes ?? [];
        const idx = nodes0.findIndex((node) => node.id === lineId && isLineNode(node));
        if (idx < 0) return s;

        const current = nodes0[idx];
        if (!current || !isLineNode(current)) return s;

        const nodes1 = nodes0.slice();
        nodes1[idx] = { ...current, ...rest };

        return {
          ...s,
          dialogueEditor: {
            ...ed,
            dialogueDraft: { ...dialogueDraft, nodes: nodes1 },
          },
        };
      }),

    removeDialogueLine: (dialogueId, lineId) =>
      set((s) => {
        const ed0 = { ...commitCurrentLineIntoDraft(s) };
        const dialogueDraft = ed0.dialogueDraft;
        if (!dialogueDraft || dialogueDraft.id !== dialogueId) return s;

        const target = findLineNode(dialogueDraft, lineId);
        if (!target) return s;

        const protectedRootChildren = findRootNode(dialogueDraft)?.childrenIds ?? [];
        const isLastRootChild =
          protectedRootChildren.includes(lineId) && protectedRootChildren.length <= 1;

        if (isLastRootChild) return s;

        const subtreeIds = collectSubtreeIds(dialogueDraft, lineId);

        let nodes1 = dialogueDraft.nodes.filter((node) => !subtreeIds.has(node.id));
        nodes1 = removeIdFromChildren(nodes1, lineId);

        const nextDialogueDraft: Dialogue = {
          ...dialogueDraft,
          nodes: nodes1,
        };

        const clearSelected = ed0.selection.selectedNodeId != null && subtreeIds.has(ed0.selection.selectedNodeId);
        const nextSelectedLine = clearSelected
          ? (nextDialogueDraft.nodes.find(isLineNode) ?? null)
          : findLineNode(nextDialogueDraft, ed0.selection.selectedNodeId);

        const nextSelection = clearSelected
          ? {
            ...ed0.selection,
            selectedNodeId: nextSelectedLine?.id ?? null,
          }
          : ed0.selection;

        return {
          ...s,
          dialogueEditor: {
            ...ed0,
            selection: nextSelection,
            dialogueDraft: nextDialogueDraft,
            lineDraft: nextSelectedLine
              ? cloneLine(nextSelectedLine)
              : clearSelected
                ? null
                : ed0.lineDraft,
          },
        };
      }),

    reorderDialogueLines: (_dialogueId, _fromIndex, _toIndex) => get().dialogueEditor && set((s) => s),

    validateDialogueDraft: (dialogueId) => {
      const s = get();
      const materialized = materializeDialogueDraft(s.dialogueEditor);
      if (!materialized) return { ok: false, error: "No hay diálogo en edición." };

      const targetId = dialogueId ?? s.dialogueEditor.selection.selectedDialogueId;
      if (!targetId || materialized.id !== targetId) {
        return { ok: false, error: "No hay diálogo seleccionado." };
      }

      const result = validateDialogue(materialized);
      if (!result.ok) {
        const msg =
          result.errors.nodes ??
          result.errors.rootId ??
          result.errors.playerId ??
          result.errors.npcId ??
          "El diálogo no es válido.";

        return { ok: false, error: msg };
      }

      return { ok: true };
    },
  };
}