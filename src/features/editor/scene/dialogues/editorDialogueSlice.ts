import type { ID, Node, Dialogue, DialogueLineNode } from "@/domain/types";
import type { DialogueEditorSelection, DialogueEditorState } from "@/features/editor/scene/dialogues/dialogueEditorTypes";
import { createDialogue, createDialogueLineNode, createEmptyDialogueEditorState } from "@/features/editor/scene/dialogues/dialogueHelpers";
import {
  buildDialogueEditorContext, cloneDialogue, cloneDialogueLine, collectDialogueSubtreeIds, commitCurrentLineIntoDialogueEditorState,
  ensureDialogueSelectionForNode, findDialogueLineNode, findDialogueNode, findDialogueRootNode, getDialogueValidationError,
  isDialogueLineNode, materializeDialogueDraft, readNodeDialogues, removeIdFromDialogueChildren, reorderItems,
  replaceNodeInDialogue, upsertLineInDialogue
} from "@/features/editor/scene/dialogues/dialogueHelpersSlice";
import { generateId } from "@/utils/id";
import { safeTrim } from "@/features/editor/core/editorGenericSlice";

export const initialDialogueEditorState: DialogueEditorState = createEmptyDialogueEditorState();

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
  reorderDialogueLines: (dialogueId: ID, parentId: ID, fromIndex: number, toIndex: number) => void;

  validateDialogueDraft: (dialogueId?: ID | null) => { ok: boolean; error?: string };
}

export function createEditorDialoguesSlice(set: (partial: Partial<Store> | ((state: Store) => Partial<Store> | Store)) => void,
  get: () => Store): EditorDialoguesSlice {
  /* Helper interno del slice para mutar solo el dialogueDraft actual */
  function withDialogueDraft(updater: (dialogue: Dialogue) => Dialogue) {
    set((state) => {
      const dialogue0 = state.dialogueEditor.dialogueDraft;
      if (!dialogue0) return state;

      const dialogue1 = updater(dialogue0);
      if (dialogue1 === dialogue0) return state;

      return { ...state, dialogueEditor: { ...state.dialogueEditor, dialogueDraft: dialogue1 } };
    });
  }

  return {
    dialogueEditor: initialDialogueEditorState,

    /* Lectura / Esctritura de diálogos en la escena */
    getActiveDialogues: () => readNodeDialogues(get().nodeDraft),

    setNodeDialogues: (dialogues) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            dialogues: Array.isArray(dialogues) ? dialogues : [],
          },
        };
      }),

    /* Selección y ciclo del editor */
    setDialogueSelection: (input) =>
      set((state) => {
        const editor0 = commitCurrentLineIntoDialogueEditorState(state.dialogueEditor);
        const currentSelection = editor0.selection;

        const nextSelection: DialogueEditorSelection = {
          ...currentSelection,
          ...input,
        };

        const nodeSelectionChanged = input.selectedNodeId !== undefined && input.selectedNodeId !== currentSelection.selectedNodeId;

        const normalizedSelection = nodeSelectionChanged
          ? ensureDialogueSelectionForNode(nextSelection, input.selectedNodeId ?? null)
          : nextSelection;

        const nextNodeId = input.selectedNodeId !== undefined
          ? input.selectedNodeId
          : editor0.selection.selectedNodeId;

        const found = findDialogueLineNode(editor0.dialogueDraft, nextNodeId);

        return {
          ...state,
          dialogueEditor: {
            ...editor0,
            selection: normalizedSelection,
            lineDraft: found ? cloneDialogueLine(found) : null,
          },
        };
      }),

    clearDialogueEditor: () =>
      set((state) => ({
        ...state,
        dialogueEditor: initialDialogueEditorState,
      })),

    startCreatingDialogue: (input) => {
      const state = get();
      if (!state.nodeDraft) return null;

      const dialogueId = generateId.dialogue();

      const baseDialogue = createDialogue(dialogueId, input.playerId, input.npcId);

      const dialogueDraft: Dialogue = {
        ...baseDialogue,
        title: safeTrim(input.title ?? ""),
        description: safeTrim(input.description ?? ""),
      };

      set((currentState) => ({
        ...currentState,
        dialogueEditor: {
          context: buildDialogueEditorContext(currentState.nodeDraft?.id),
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
      set((state) => {
        const nodeDraft = state.nodeDraft;
        if (!nodeDraft) return state;

        const source = (nodeDraft.dialogues ?? []).find((dialogue) => dialogue.id === dialogueId);
        if (!source) return state;

        const dialogueDraft = cloneDialogue(source);

        return {
          ...state,
          dialogueEditor: {
            context: buildDialogueEditorContext(nodeDraft.id),
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
      set((state) => ({
        ...state,
        dialogueEditor: initialDialogueEditorState,
      })),

    commitLineDraft: () => {
      const state = get();
      const lineDraft = state.dialogueEditor.lineDraft;
      const dialogueDraft = state.dialogueEditor.dialogueDraft;

      if (!lineDraft || !dialogueDraft) return null;

      set((currentState) => ({
        ...currentState,
        dialogueEditor: {
          ...currentState.dialogueEditor,
          dialogueDraft: upsertLineInDialogue(
            currentState.dialogueEditor.dialogueDraft as Dialogue,
            currentState.dialogueEditor.lineDraft as DialogueLineNode
          ),
        },
      }));

      return lineDraft.id;
    },

    commitDialogueDraft: () => {
      const state = get();

      if (!state.nodeDraft) return { ok: false, error: "No hay escena en edición." };

      const materialized = materializeDialogueDraft(state.dialogueEditor);
      if (!materialized) return { ok: false, error: "No hay diálogo en edición." };

      const validationError = getDialogueValidationError(materialized);
      if (validationError) return { ok: false, error: validationError };

      const mode = state.dialogueEditor.mode;
      const dialogues0 = state.nodeDraft.dialogues ?? [];

      const dialogues1 = mode.type === "creating"
        ? [...dialogues0, materialized]
        : dialogues0.some((dialogue) => dialogue.id === materialized.id)
          ? dialogues0.map((dialogue) => dialogue.id === materialized.id ? materialized : dialogue)
          : [...dialogues0, materialized];

      const selectedLine = findDialogueLineNode(materialized, state.dialogueEditor.selection.selectedNodeId) ??
        materialized.nodes.find(isDialogueLineNode) ?? null;

      set((currentState) => ({
        ...currentState,
        nodeDraft: {
          ...currentState.nodeDraft!,
          dialogues: dialogues1,
        },
        dialogueEditor: {
          context: buildDialogueEditorContext(currentState.nodeDraft?.id),
          mode: { type: "editing", dialogueId: materialized.id },
          selection: {
            selectedDialogueId: materialized.id,
            selectedNodeId: selectedLine?.id ?? null,
          },
          dialogueDraft: cloneDialogue(materialized),
          lineDraft: selectedLine ? cloneDialogueLine(selectedLine) : null,
        },
      }));

      return { ok: true, id: materialized.id };
    },

    /* Mutaciones de metadatos del diálogo */
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
      withDialogueDraft((dialogue) => dialogue.id !== dialogueId || dialogue.playerId === playerId
        ? dialogue : { ...dialogue, playerId }),

    setDialogueNpcId: (dialogueId, npcId) =>
      withDialogueDraft((dialogue) => dialogue.id !== dialogueId || dialogue.npcId === npcId
        ? dialogue : { ...dialogue, npcId }),

    setDialogueWhen: (dialogueId, when) =>
      withDialogueDraft((dialogue) => dialogue.id !== dialogueId || dialogue.when === when
        ? dialogue : { ...dialogue, when: when ?? undefined }),

    setDialogueRootId: (dialogueId, rootId) =>
      withDialogueDraft((dialogue) => dialogue.id !== dialogueId || dialogue.rootId === rootId
        ? dialogue : { ...dialogue, rootId }),

    /* Operaciones sobre diálogos */
    removeDialogue: (dialogueId) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const dialogues0 = state.nodeDraft.dialogues ?? [];
        const dialogues1 = dialogues0.filter((dialogue) => dialogue.id !== dialogueId);
        if (dialogues1.length === dialogues0.length) return state;

        const isEditing = state.dialogueEditor.selection.selectedDialogueId === dialogueId;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            dialogues: dialogues1,
          },
          dialogueEditor: isEditing ? initialDialogueEditorState : state.dialogueEditor
        };
      }),

    reorderDialogues: (fromIndex, toIndex) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const dialogues0 = state.nodeDraft.dialogues ?? [];
        const dialogues1 = reorderItems(dialogues0, fromIndex, toIndex);
        if (dialogues1 === dialogues0) return state;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            dialogues: dialogues1,
          },
        };
      }),

    /* Operaciones sobre líneas */
    addDialogueLine: (dialogueId, args) => {
      const state = get();
      const dialogue0 = materializeDialogueDraft(state.dialogueEditor);

      if (!dialogue0 || dialogue0.id !== dialogueId) return null;

      const lineId = generateId.dialogueLine();
      const parentId = args?.parentId ?? dialogue0.rootId;
      const parent = findDialogueNode(dialogue0, parentId);
      if (!parent) return null;

      const line: DialogueLineNode = {
        ...createDialogueLineNode(lineId),
        speaker: args?.speaker ?? "npc",
        text: args?.text ?? "",
      };

      const updatedParent = {
        ...parent,
        childrenIds: [...(parent.childrenIds ?? []), lineId],
      };

      const withParent = replaceNodeInDialogue(dialogue0, updatedParent);

      const dialogue1: Dialogue = {
        ...withParent,
        nodes: [...withParent.nodes, cloneDialogueLine(line)],
      };

      set((currentState) => ({
        ...currentState,
        dialogueEditor: {
          ...currentState.dialogueEditor,
          selection: {
            ...currentState.dialogueEditor.selection,
            selectedDialogueId: dialogueId,
            selectedNodeId: lineId,
          },
          dialogueDraft: dialogue1,
          lineDraft: cloneDialogueLine(line),
        },
      }));

      return lineId;
    },

    updateDialogueLine: (dialogueId, lineId, patch) =>
      set((state) => {
        const editor = state.dialogueEditor;
        const dialogueDraft = editor.dialogueDraft;
        if (!dialogueDraft || dialogueDraft.id !== dialogueId) return state;

        const { id: _ignoredId, type: _ignoredType, ...rest } = patch;

        if (editor.lineDraft?.id === lineId) {
          return {
            ...state,
            dialogueEditor: {
              ...editor,
              lineDraft: { ...editor.lineDraft, ...rest },
            },
          };
        }

        const nodes0 = dialogueDraft.nodes ?? [];
        const index = nodes0.findIndex((node) => node.id === lineId && isDialogueLineNode(node));
        if (index < 0) return state;

        const current = nodes0[index];
        if (!current || !isDialogueLineNode(current)) return state;

        const nodes1 = nodes0.slice();
        nodes1[index] = { ...current, ...rest };

        return {
          ...state,
          dialogueEditor: {
            ...editor,
            dialogueDraft: { ...dialogueDraft, nodes: nodes1 },
          },
        };
      }),

    removeDialogueLine: (dialogueId, lineId) =>
      set((state) => {
        const editor0 = commitCurrentLineIntoDialogueEditorState(state.dialogueEditor);
        const dialogueDraft = editor0.dialogueDraft;
        if (!dialogueDraft || dialogueDraft.id !== dialogueId) return state;

        const target = findDialogueLineNode(dialogueDraft, lineId);
        if (!target) return state;

        const protectedRootChildren = findDialogueRootNode(dialogueDraft)?.childrenIds ?? [];

        const isLastRootChild = protectedRootChildren.includes(lineId) && protectedRootChildren.length <= 1;

        if (isLastRootChild) return state;

        const subtreeIds = collectDialogueSubtreeIds(dialogueDraft, lineId);

        let nodes1 = dialogueDraft.nodes.filter((node) => !subtreeIds.has(node.id));
        nodes1 = removeIdFromDialogueChildren(nodes1, lineId);

        const nextDialogueDraft: Dialogue = {
          ...dialogueDraft,
          nodes: nodes1,
        };

        const clearSelected = editor0.selection.selectedNodeId != null &&
          subtreeIds.has(editor0.selection.selectedNodeId);

        const nextSelectedLine = clearSelected
          ? nextDialogueDraft.nodes.find(isDialogueLineNode) ?? null
          : findDialogueLineNode(nextDialogueDraft, editor0.selection.selectedNodeId);

        const nextSelection = clearSelected
          ? { ...editor0.selection, selectedNodeId: nextSelectedLine?.id ?? null }
          : editor0.selection;

        return {
          ...state,
          dialogueEditor: {
            ...editor0,
            selection: nextSelection,
            dialogueDraft: nextDialogueDraft,
            lineDraft: nextSelectedLine
              ? cloneDialogueLine(nextSelectedLine)
              : clearSelected
                ? null
                : editor0.lineDraft,
          },
        };
      }),

    reorderDialogueLines: (dialogueId, parentId, fromIndex, toIndex) =>
      set((state) => {
        const editor0 = commitCurrentLineIntoDialogueEditorState(state.dialogueEditor);
        const dialogueDraft = editor0.dialogueDraft;
        if (!dialogueDraft || dialogueDraft.id !== dialogueId) return state;

        const parent = findDialogueNode(dialogueDraft, parentId);
        if (!parent) return state;

        const childrenIds0 = parent.childrenIds ?? [];
        const childrenIds1 = reorderItems(childrenIds0, fromIndex, toIndex);

        if (childrenIds1 === childrenIds0) return state;

        const nextParent = {
          ...parent,
          childrenIds: childrenIds1,
        };

        const nextDialogueDraft = replaceNodeInDialogue(
          dialogueDraft,
          nextParent
        );

        return {
          ...state,
          dialogueEditor: {
            ...editor0,
            dialogueDraft: nextDialogueDraft,
          },
        };
      }),

    /* Validación */
    validateDialogueDraft: (dialogueId) => {
      const state = get();
      const materialized = materializeDialogueDraft(state.dialogueEditor);

      if (!materialized) return { ok: false, error: "No hay diálogo en edición." };

      const targetId = dialogueId ?? state.dialogueEditor.selection.selectedDialogueId;

      if (!targetId || materialized.id !== targetId) return { ok: false, error: "No hay diálogo seleccionado." };

      const error = getDialogueValidationError(materialized);
      if (error) return { ok: false, error };

      return { ok: true };
    },
  };
}