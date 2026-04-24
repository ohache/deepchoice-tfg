import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { ID, Dialogue, DialogueLineNode } from "@/domain/types";
import { DialogueTreeNodeContent } from "@/features/editor/scene/dialogues/DialogueTreeNodeContent";
import { buildDialogueIndex, findDialogueLineNodeInIndex, findDialogueNodeInIndex } from "@/features/editor/scene/dialogues/dialogueHelpersSlice";

type DialogueTreeNodeCardProps = {
  dialogue: Dialogue;
  playerName: string;
  npcName: string;
  line: DialogueLineNode;
  parentId: ID;
  depth: number;
  selectedLineId: ID | null;
  editingLineDraft: DialogueLineNode | null;
  onSelectLine: (lineId: ID | null) => void;
  onAddChild: (parentId: ID, speaker: DialogueLineNode["speaker"]) => void;
  onDeleteLine: (lineId: ID) => void;
  onUpdateLine: (lineId: ID, patch: Partial<DialogueLineNode>) => void;
  onSaveLine: (lineId: ID) => void;
  onOpenLineRule: (lineId: ID) => void;
  onReorderSiblings: (parentId: ID, fromIndex: number, toIndex: number) => void;
};

/* Helpers de estilo */
function speakerTone(speaker: DialogueLineNode["speaker"], selected: boolean): string {
  if (speaker === "player") {
    return selected
      ? "border-emerald-500/60 bg-emerald-950/25"
      : "border-2 border-emerald-800 bg-emerald-950/30";
  }

  return selected
    ? "border-sky-500/60 bg-sky-950/25"
    : "border-2 border-sky-800 bg-sky-950/30";
}

function hasDialogueRule(line: DialogueLineNode): boolean {
  return Boolean(line.when) || (line.effects?.length ?? 0) > 0;
}

function parseSiblingReorderPayload(raw: string): { parentId: ID; fromIndex: number; lineId: ID } | null {
  try {
    const data = JSON.parse(raw) as { parentId: ID; fromIndex: number; lineId: ID };

    if (!data?.parentId || typeof data.fromIndex !== "number" || !data?.lineId) return null;

    return data;
  } catch {
    return null;
  }
}

export function DialogueTreeNodeCard({ dialogue, playerName, npcName, line, parentId, depth, selectedLineId, editingLineDraft, onSelectLine, onAddChild,
  onDeleteLine, onUpdateLine, onSaveLine, onOpenLineRule, onReorderSiblings }: DialogueTreeNodeCardProps) {
  const dialogueIndex = useMemo(() => buildDialogueIndex(dialogue), [dialogue]);

  const selected = selectedLineId === line.id;

  const renderedLine: DialogueLineNode = selected && editingLineDraft?.id === line.id ? editingLineDraft : line;

  const [collapsed, setCollapsed] = useState(false);
  const [isDraggingSelf, setIsDraggingSelf] = useState(false);
  const [isDragOverSelf, setIsDragOverSelf] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const children = useMemo<DialogueLineNode[]>(() => (line.childrenIds ?? [])
    .map((childId) => findDialogueLineNodeInIndex(dialogueIndex, childId))
    .filter((child): child is DialogueLineNode => Boolean(child)),
    [line.childrenIds, dialogueIndex]
  );

  const hasChildren = children.length > 0;

  const siblingLines = useMemo<DialogueLineNode[]>(() => {
    const parentNode = findDialogueNodeInIndex(dialogueIndex, parentId);
    const siblingIds = parentNode?.childrenIds ?? [];

    return siblingIds.map((childId) => findDialogueLineNodeInIndex(dialogueIndex, childId))
      .filter((child): child is DialogueLineNode => Boolean(child));
  }, [dialogueIndex, parentId]);

  const currentSiblingIndex = siblingLines.findIndex((sibling) => sibling.id === line.id);

  const nextSpeaker: DialogueLineNode["speaker"] = line.speaker === "player" ? "npc" : "player";

  const hasText = renderedLine.text.trim().length > 0;
  const hasRule = hasDialogueRule(renderedLine);
  const speakerLabel = renderedLine.speaker === "player" ? playerName : npcName;

  const isDraggable = currentSiblingIndex >= 0;

  const cardClassName =
    "rounded-lg border px-3 py-3 select-none transition-colors " +
    (selected ? "" : "cursor-pointer ") +
    speakerTone(renderedLine.speaker, selected) + " " +
    (isDraggingSelf ? "opacity-50 " : "") +
    (isDragOverSelf ? "ring-2 ring-fuchsia-500/70" : "");

  const handleSelect = () => { onSelectLine(selected ? null : line.id)};

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!isDraggable) return;

    const payload = JSON.stringify({
      parentId,
      fromIndex: currentSiblingIndex,
      lineId: line.id,
    });

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", payload);
    event.dataTransfer.setData("application/x-dialogue-sibling-reorder", payload);

    setIsDraggingSelf(true);
  };

  const handleDragEnd = (event: DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setIsDraggingSelf(false);
    setIsDragOverSelf(false);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isDraggable) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setIsDragOverSelf(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setIsDragOverSelf(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOverSelf(false);

    if (!isDraggable) return;

    const raw =
      event.dataTransfer.getData("application/x-dialogue-sibling-reorder") ||
      event.dataTransfer.getData("text/plain");

    if (!raw) return;

    const data = parseSiblingReorderPayload(raw);
    if (!data) return;

    if (data.parentId !== parentId) return;
    if (data.lineId === line.id) return;
    if (data.fromIndex < 0 || data.fromIndex === currentSiblingIndex) return;

    onReorderSiblings(parentId, data.fromIndex, currentSiblingIndex);
  };

  useEffect(() => {
    if (!selected) return;

    requestAnimationFrame(() => {
      const element = textareaRef.current;
      if (!element) return;

      element.focus();

      const textLength = element.value.length;
      try { element.setSelectionRange(textLength, textLength); }
      catch { }
    });
  }, [selected]);

  return (
    <div className="space-y-2">
      <div style={{ marginLeft: `${depth * 24}px` }}>
        <div
          onClick={handleSelect}
          className={cardClassName}
          title="Seleccionar línea"
          draggable={isDraggable}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <DialogueTreeNodeContent
            selected={selected}
            renderedLine={renderedLine}
            speakerLabel={speakerLabel}
            hasChildren={hasChildren}
            collapsed={collapsed}
            hasText={hasText}
            hasRule={hasRule}
            nextSpeaker={nextSpeaker}
            textareaRef={textareaRef}
            onToggleCollapsed={() => setCollapsed((prev) => !prev)}
            onUpdateLine={onUpdateLine}
            onSaveLine={onSaveLine}
            onOpenLineRule={onOpenLineRule}
            onAddChild={onAddChild}
            onDeleteLine={onDeleteLine}
          />
        </div>
      </div>

      {!collapsed &&
        children.map((child) => (
          <DialogueTreeNodeCard
            key={child.id}
            dialogue={dialogue}
            playerName={playerName}
            npcName={npcName}
            line={child}
            parentId={line.id}
            depth={depth + 1}
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
  );
}