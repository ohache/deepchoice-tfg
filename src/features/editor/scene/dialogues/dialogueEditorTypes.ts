import type { ID, Dialogue, DialogueLineNode } from "@/domain/types";

/* Contexto mínimo necesario para abrir el editor de diálogos */
export type DialogueEditorContext = {
  nodeId: ID;
};

/* Estado operacional del editor */
export type DialogueEditorMode =
  | { type: "idle" }
  | { type: "creating" }
  | { type: "editing"; dialogueId: ID };

/* Selección actual dentro del editor */
export type DialogueEditorSelection = {
  selectedDialogueId: ID | null;
  selectedNodeId: ID | null;
};

/* Estado completo del editor de diálogos */
export type DialogueEditorState = {
  context: DialogueEditorContext | null;
  mode: DialogueEditorMode;
  selection: DialogueEditorSelection;
  dialogueDraft: Dialogue | null;
  lineDraft: DialogueLineNode | null;
};