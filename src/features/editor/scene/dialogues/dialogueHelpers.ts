import type { ID, Dialogue, DialogueLineNode, DialogueRootNode } from "@/domain/types";
import type { DialogueEditorState } from "@/features/editor/scene/dialogues/dialogueEditorTypes";
import { generateId } from "@/utils/id";

/* Factories dominio */
export const createDialogue = (id: ID, playerId: ID, npcId: ID): Dialogue => {
  const rootId = generateId.dialogueRoot();

  const rootNode: DialogueRootNode = {
    id: rootId,
    type: "root",
    childrenIds: [],
  };

  return {
    id,
    playerId,
    npcId,
    rootId,
    nodes: [rootNode],
    title: "",
    description: "",
};
};

export const createDialogueLineNode = (id: ID): DialogueLineNode => ({
  id,
  type: "line",
  speaker: "player",
  text: "",
  childrenIds: []
});

/* Editor state helpers */
export const createEmptyDialogueEditorState = (): DialogueEditorState => ({
  context: null,
  mode: { type: "idle" },
  selection: {
    selectedDialogueId: null,
    selectedNodeId: null,
  },
  dialogueDraft: null,
  lineDraft: null,
});