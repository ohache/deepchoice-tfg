import type { ID, Dialogue, DialogueLineNode, DialogueNode } from "@/domain/types";
import { DialogueTreeNodeCard } from "@/features/editor/scene/dialogues/DialogueTreeNodeCard";

type DialogueTreeViewProps = {
  dialogue: Dialogue;
  playerName: string;
  npcName: string;
  selectedLineId: ID | null;
  editingLineDraft: DialogueLineNode | null;
  onSelectLine: (lineId: ID) => void;
  onAddRootLine: () => void;
  onAddChild: (parentId: ID, speaker: DialogueLineNode["speaker"]) => void;
  onDeleteLine: (lineId: ID) => void;
  onUpdateLine: (lineId: ID, patch: Partial<DialogueLineNode>) => void;
  onSaveLine: (lineId: ID) => void;
  onOpenLineRule: (lineId: ID) => void;
  onReorderSiblings: (parentId: ID, fromIndex: number, toIndex: number) => void;
};

function getNodeById(dialogue: Dialogue, nodeId: ID | null | undefined): DialogueNode | null {
  if (!nodeId) return null;
  return dialogue.nodes.find((node) => node.id === nodeId) ?? null;
}

function getLineById(dialogue: Dialogue, lineId: ID | null | undefined): DialogueLineNode | null {
  const node = getNodeById(dialogue, lineId);
  return node && node.type === "line" ? node : null;
}

export function DialogueTreeView({ dialogue, playerName, npcName, selectedLineId, editingLineDraft, onSelectLine, onAddRootLine,
  onAddChild, onDeleteLine, onUpdateLine, onSaveLine, onOpenLineRule, onReorderSiblings }: DialogueTreeViewProps) {
  const root = getNodeById(dialogue, dialogue.rootId);
  const rootChildren = root?.childrenIds
    ?.map((childId) => getLineById(dialogue, childId))
    .filter((child): child is DialogueLineNode => Boolean(child)) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          className="btn btn-select text-[13px]"
          onClick={onAddRootLine}
        >
          + Añadir raíz
        </button>
      </div>

      {!rootChildren.length ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/80 px-4 py-6 text-center text-[12px] text-slate-400">
          Aún no hay líneas iniciales. Añade una raíz para empezar el árbol.
        </div>
      ) : (
        <div className="space-y-3">
          {rootChildren.map((line) => (
            <DialogueTreeNodeCard
              key={line.id}
              dialogue={dialogue}
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