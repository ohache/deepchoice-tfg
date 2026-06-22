import { useMemo } from "react";
import type { ID, Dialogue, DialogueLineNode } from "@/domain/types";
import { buildDialogueIndex, getDialogueChildLines } from "@/features/editor/scene/dialogues/dialogueHelpers";
import { DialogueTreeNodeCard } from "@/features/editor/scene/dialogues/DialogueTreeNodeCard";

type DialogueTreeViewProps = {
  dialogue: Dialogue;
  playerName: string;
  npcName: string;
  selectedLineId: ID | null;
  editingLineDraft: DialogueLineNode | null;
  onSelectLine: (lineId: ID | null) => void;
  onAddRootLine: () => void;
  onAddChild: (parentId: ID, speaker: DialogueLineNode["speaker"]) => void;
  onDeleteLine: (lineId: ID) => void;
  onUpdateLine: (lineId: ID, patch: Partial<DialogueLineNode>) => void;
  onSaveLine: (lineId: ID) => void;
  onOpenLineRule: (lineId: ID) => void;
  onReorderSiblings: (parentId: ID, fromIndex: number, toIndex: number) => void;
};

export function DialogueTreeView({ dialogue, playerName, npcName, selectedLineId, editingLineDraft, onSelectLine, onAddRootLine, onAddChild, onDeleteLine,
  onUpdateLine, onSaveLine, onOpenLineRule, onReorderSiblings }: DialogueTreeViewProps) {
  const dialogueIndex = useMemo(() => buildDialogueIndex(dialogue), [dialogue]);

  const rootChildren = useMemo(() => getDialogueChildLines(dialogueIndex, dialogue.rootId), [dialogueIndex, dialogue.rootId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          className="btn btn-add-variant text-[13px]"
          onClick={onAddRootLine}
        >
          + Añadir línea inicial
        </button>
      </div>

      {/* Estado vacío */}
      {!rootChildren.length ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/80 px-4 py-6 text-center text-[12px] text-slate-400">
          Aún no hay líneas iniciales. Añade una línea inicial para empezar el árbol de diálogo.
        </div>
      ) : (
        /* Render del árbol (nivel 0 → recursivo en NodeCard) */
        <div className="space-y-3">
          {rootChildren.map((line) => (
            <DialogueTreeNodeCard
              key={line.id}
              dialogue={dialogue}
              dialogueIndex={dialogueIndex}
              playerName={playerName}
              npcName={npcName}
              line={line}
              parentId={dialogue.rootId}
              depth={0}
              selectedLineId={selectedLineId}
              editingLineDraft={editingLineDraft}
              onSelectLine={onSelectLine}
              onAddChild={onAddChild}
              onDeleteLine={onDeleteLine}
              onUpdateLine={onUpdateLine}
              onSaveLine={onSaveLine}
              onOpenLineRule={onOpenLineRule}
              onReorderSiblings={onReorderSiblings}
            />
          ))}
        </div>
      )}
    </div>
  );
}