import type { ID, Dialogue, DialogueLineNode } from "@/domain/types";

/* Contexto del editor: escena activa */
export type DialogueEditorContext = {
  nodeId: ID;
};

/* Modo del editor */
export type DialogueEditorMode =
  | { type: "idle" }
  | { type: "creating" }
  | { type: "editing"; dialogueId: ID };

/* Selección actual dentro del diálogo */
export type DialogueEditorSelection = {
  selectedDialogueId: ID | null;
  selectedNodeId: ID | null;
};

/* Draft completo del diálogo que se está editando */
export type DialogueDraft = Dialogue;

/* Draft temporal de la línea activa */
export type DialogueLineDraft = DialogueLineNode;

/* Estado completo del editor */
export type DialogueEditorState = {
  context: DialogueEditorContext | null;
  mode: DialogueEditorMode;
  selection: DialogueEditorSelection;
  dialogueDraft: DialogueDraft | null;
  lineDraft: DialogueLineDraft | null;
};