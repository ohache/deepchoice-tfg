import type { ID, Node, Dialogue, DialogueLineNode } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import type { DialogueEditorSelection, DialogueEditorState } from "@/features/editor/scene/dialogues/dialogueEditorTypes";
import { addLineToDialogue, buildDialogueEditorContext, cloneDialogue, cloneDialogueLine, commitCurrentLineIntoDialogueEditorState, createDialogue,
  createDialogueLineNode, createEmptyDialogueEditorState, findDialogueLineNode, getDialogueValidationError, isDialogueLineNode, materializeDialogueDraft,
  patchDialogueLine, removeLineSubtreeFromDialogue, reorderDialogueChildren, upsertLineInDialogue } from "@/features/editor/scene/dialogues/dialogueHelpers";
import { safeTrim } from "@/features/editor/core/editorDataUtils";
import { generateId } from "@/utils/id";

type EditorStoreLike = {
  nodeDraft: Node | null;
  dialogueEditor: DialogueEditorState;
  requestDelete: (target: DeleteTarget) => void;
};

export interface EditorDialoguesSlice {
  dialogueEditor: DialogueEditorState;
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
  removeDialogue: (dialogueId: ID) => void;
  addDialogueLine: (dialogueId: ID, args?: { speaker?: DialogueLineNode["speaker"]; text?: string; parentId?: ID }) => ID | null;
  updateDialogueLine: (dialogueId: ID, lineId: ID, patch: Partial<DialogueLineNode>) => void;
  removeDialogueLine: (dialogueId: ID, lineId: ID) => void;
  reorderDialogueLines: (dialogueId: ID, parentId: ID, fromIndex: number, toIndex: number) => void;
}

export function createEditorDialoguesSlice(set: (partial: Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorDialoguesSlice {

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
    dialogueEditor: createEmptyDialogueEditorState(),

    /* Selección y ciclo del editor */
    setDialogueSelection: (input) =>
      set((state) => {
        const editor0 = commitCurrentLineIntoDialogueEditorState(state.dialogueEditor);

        const selectedNodeId = input.selectedNodeId !== undefined ? input.selectedNodeId : editor0.selection.selectedNodeId;

        const selection: DialogueEditorSelection = { ...editor0.selection, ...input, selectedNodeId };

        const found = findDialogueLineNode(editor0.dialogueDraft, selectedNodeId);

        return {
          ...state,
          dialogueEditor: {
            ...editor0,
            selection,
            lineDraft: found ? cloneDialogueLine(found) : null,
          },
        };
      }),

    clearDialogueEditor: () =>
      set((state) => ({
        ...state,
        dialogueEditor: createEmptyDialogueEditorState(),
      })),

    startCreatingDialogue: (input) => {
      const state = get();
      if (!state.nodeDraft) return null;

      const dialogueId = generateId.dialogue();

      const title = safeTrim(input.title ?? "");
      if (!title) return null;

      const description = safeTrim(input.description ?? "");

      const dialogueDraft = createDialogue({ id: dialogueId, playerId: input.playerId, npcId: input.npcId, title, ...(description ? { description } : null) });

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
        dialogueEditor: createEmptyDialogueEditorState(),
      })),

    commitLineDraft: () => {
      const { dialogueDraft, lineDraft } = get().dialogueEditor;

      if (!lineDraft || !dialogueDraft) return null;

      set((state) => {
        const currentDialogue = state.dialogueEditor.dialogueDraft;
        const currentLine = state.dialogueEditor.lineDraft;

        if (!currentDialogue || !currentLine) return state;

        return {
          ...state,
          dialogueEditor: {
            ...state.dialogueEditor, dialogueDraft: upsertLineInDialogue(currentDialogue, currentLine),
          },
        };
      });

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

      const dialogues1 = mode.type === "creating" ? [...dialogues0, materialized] : dialogues0.some((dialogue) => dialogue.id === materialized.id)
        ? dialogues0.map((dialogue) => dialogue.id === materialized.id ? materialized : dialogue) : [...dialogues0, materialized];

      const selectedLine = findDialogueLineNode(materialized, state.dialogueEditor.selection.selectedNodeId) ?? materialized.nodes.find(isDialogueLineNode) ?? null;

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

        return { ...dialogue, description: next || undefined };
      }),

    setDialoguePlayerId: (dialogueId, playerId) =>
      withDialogueDraft((dialogue) => dialogue.id !== dialogueId || dialogue.playerId === playerId ? dialogue : { ...dialogue, playerId }),

    setDialogueNpcId: (dialogueId, npcId) =>
      withDialogueDraft((dialogue) => dialogue.id !== dialogueId || dialogue.npcId === npcId ? dialogue : { ...dialogue, npcId }),

    setDialogueWhen: (dialogueId, when) =>
      withDialogueDraft((dialogue) => dialogue.id !== dialogueId || dialogue.when === when ? dialogue : { ...dialogue, when: when ?? undefined }),

    /* Operaciones sobre diálogos */
    removeDialogue: (dialogueId) => {
      const { nodeDraft, requestDelete } = get();
      const nodeId = nodeDraft?.id;

      if (!nodeDraft || !nodeId) return;

      const exists = (nodeDraft.dialogues ?? []).some((dialogue) => dialogue.id === dialogueId);
      if (!exists) return;

      requestDelete({ kind: "dialogue", nodeId, dialogueId });
    },

    /* Operaciones sobre líneas */
    addDialogueLine: (dialogueId, args) => {
      const state = get();
      const dialogue0 = materializeDialogueDraft(state.dialogueEditor);

      if (!dialogue0 || dialogue0.id !== dialogueId) return null;

      const lineId = generateId.dialogueLine();
      const parentId = args?.parentId ?? dialogue0.rootId;

      const line = createDialogueLineNode(lineId, { speaker: args?.speaker ?? "npc", text: args?.text ?? "" });

      const dialogue1 = addLineToDialogue(dialogue0, parentId, line);
      if (!dialogue1) return null;

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

        const nextDialogueDraft = patchDialogueLine(dialogueDraft, lineId, rest);

        if (nextDialogueDraft === dialogueDraft) return state;

        return {
          ...state,
          dialogueEditor: {
            ...editor,
            dialogueDraft: nextDialogueDraft,
          },
        };
      }),

    removeDialogueLine: (dialogueId, lineId) =>
      set((state) => {
        const editor0 = commitCurrentLineIntoDialogueEditorState(state.dialogueEditor);
        const dialogueDraft = editor0.dialogueDraft;

        if (!dialogueDraft || dialogueDraft.id !== dialogueId) return state;

        const result = removeLineSubtreeFromDialogue(dialogueDraft, lineId);
        if (!result) return state;

        const nextDialogueDraft = result.dialogue;
        const removedIds = result.removedIds;

        const clearSelected = editor0.selection.selectedNodeId != null && removedIds.has(editor0.selection.selectedNodeId);

        const nextSelectedLine = clearSelected ? nextDialogueDraft.nodes.find(isDialogueLineNode) ?? null : findDialogueLineNode(nextDialogueDraft, editor0.selection.selectedNodeId);

        const nextSelection = clearSelected ? { ...editor0.selection, selectedNodeId: nextSelectedLine?.id ?? null } : editor0.selection;

        return {
          ...state,
          dialogueEditor: {
            ...editor0,
            selection: nextSelection,
            dialogueDraft: nextDialogueDraft,
            lineDraft: nextSelectedLine ? cloneDialogueLine(nextSelectedLine) : clearSelected ? null : editor0.lineDraft,
          },
        };
      }),

    reorderDialogueLines: (dialogueId, parentId, fromIndex, toIndex) =>
      set((state) => {
        const editor0 = commitCurrentLineIntoDialogueEditorState(state.dialogueEditor);
        const dialogueDraft = editor0.dialogueDraft;

        if (!dialogueDraft || dialogueDraft.id !== dialogueId) return state;

        const nextDialogueDraft = reorderDialogueChildren(dialogueDraft, parentId, fromIndex, toIndex);

        if (nextDialogueDraft === dialogueDraft) return state;

        return {
          ...state,
          dialogueEditor: {
            ...editor0,
            dialogueDraft: nextDialogueDraft,
          },
        };
      }),
  };
}