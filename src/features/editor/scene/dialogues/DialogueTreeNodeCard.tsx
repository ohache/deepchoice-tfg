import { useState, useRef, useEffect } from "react";
import type { ID, Dialogue, DialogueLineNode, DialogueNode } from "@/domain/types";
import { Check, ChevronDown, ChevronRight, Plus, Ruler, Trash2 } from "lucide-react";

type DialogueTreeNodeCardProps = {
  dialogue: Dialogue;
  playerName: string;
  npcName: string;
  line: DialogueLineNode;
  depth: number;
  selectedLineId: ID | null;
  editingLineDraft: DialogueLineNode | null;
  onSelectLine: (lineId: ID) => void;
  onAddChild: (parentId: ID, speaker: DialogueLineNode["speaker"]) => void;
  onDeleteLine: (lineId: ID) => void;
  onUpdateLine: (lineId: ID, patch: Partial<DialogueLineNode>) => void;
  onSaveLine: (lineId: ID) => void;
  onOpenLineRule: (lineId: ID) => void;
};

function isLineNode(node: DialogueNode): node is DialogueLineNode {
  return node.type === "line";
}

function getNodeById(dialogue: Dialogue, nodeId: ID | null | undefined): DialogueNode | null {
  if (!nodeId) return null;
  return dialogue.nodes.find((node) => node.id === nodeId) ?? null;
}

function getLineById(dialogue: Dialogue, lineId: ID | null | undefined): DialogueLineNode | null {
  const node = getNodeById(dialogue, lineId);
  return node && isLineNode(node) ? node : null;
}

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

function speakerBadgeTone(speaker: DialogueLineNode["speaker"]): string {
  return speaker === "player"
    ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-100"
    : "border-sky-700/50 bg-sky-950/40 text-sky-100";
}

export function DialogueTreeNodeCard({ dialogue, playerName, npcName, line, depth, selectedLineId, editingLineDraft, onSelectLine,
  onAddChild, onDeleteLine, onUpdateLine, onSaveLine, onOpenLineRule }: DialogueTreeNodeCardProps) {
  const selected = selectedLineId === line.id;

  const renderedLine: DialogueLineNode = selected && editingLineDraft?.id === line.id ? editingLineDraft : line;

  const [collapsed, setCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const childIds = line.childrenIds ?? [];
  const children = childIds
    .map((childId) => getLineById(dialogue, childId))
    .filter((child): child is DialogueLineNode => Boolean(child));

  const hasChildren = children.length > 0;

  const nextSpeaker: DialogueLineNode["speaker"] = line.speaker === "player" ? "npc" : "player";
  const hasText = renderedLine.text.trim().length > 0;
  const speakerLabel = renderedLine.speaker === "player" ? playerName : npcName;

  useEffect(() => {
    if (!selected) return;

    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;

      el.focus();

      const len = el.value.length;
      try { el.setSelectionRange(len, len); }
      catch { }
    });
  }, [selected]);

  return (
    <div className="space-y-2">
      <div style={{ marginLeft: `${depth * 24}px` }}>
        <div
          onClick={() => { if (!selected) onSelectLine(line.id) }}
          className={`rounded-lg border px-3 py-3 ${selected ? "" : "cursor-pointer"} select-none transition-colors ${speakerTone(renderedLine.speaker, selected)}`}
          title="Seleccionar línea"
        >
          {selected ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${speakerBadgeTone(renderedLine.speaker)}`}
                  >
                    {speakerLabel}
                  </span>
                </div>

                <textarea
                  ref={textareaRef}
                  value={renderedLine.text}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onUpdateLine(line.id, { text: e.currentTarget.value })}
                  rows={3}
                  placeholder="Texto de la línea"
                  className="w-full rounded-md border border-indigo-400 px-2 py-1.5 text-sm text-white placeholder:text-slate-500 resize-none 
                    focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500 editor-scroll"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {hasChildren ? (
                  <button
                    type="button"
                    className="btn border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsed((prev) => !prev);
                    }}
                    title={collapsed ? "Expandir hijos" : "Colapsar hijos"}
                  >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="btn border-2 border-emerald-700/60 bg-emerald-950/30 hover:bg-emerald-900/40 text-xs text-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveLine(line.id);
                  }}
                  title={!hasText ? "No puedes guardar una línea vacía" : "Guardar línea"}
                  disabled={!hasText}
                >
                  <Check className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  className="btn border-2 border-amber-700/60 bg-amber-950/30 hover:bg-amber-900/40 text-xs text-amber-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenLineRule(line.id);
                  }}
                  title={renderedLine.when || (renderedLine.effects?.length ?? 0) > 0 ? "Editar regla" : "Añadir regla"}
                >
                  <Ruler className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  className="btn border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChild(line.id, nextSpeaker);
                  }}
                  title={!hasText ? "No puedes añadir un hijo a una línea vacía" : "Añadir hijo"}
                  disabled={!hasText}
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  className="btn border-2 border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/50 text-xs text-rose-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLine(line.id);
                  }}
                  title="Eliminar línea"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 text-sm text-white text-left truncate ml-1">
                {renderedLine.text.trim() || <span className="text-slate-500">(sin texto)</span>}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {hasChildren ? (
                  <button
                    type="button"
                    className="btn border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollapsed((prev) => !prev);
                    }}
                    title={collapsed ? "Expandir hijos" : "Colapsar hijos"}
                  >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="btn border-2 border-amber-700/60 bg-amber-950/30 hover:bg-amber-900/40 text-xs text-amber-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenLineRule(line.id);
                  }}
                  title={renderedLine.when || (renderedLine.effects?.length ?? 0) > 0 ? "Editar regla" : "Añadir regla"}
                >
                  <Ruler className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  className="btn border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddChild(line.id, nextSpeaker);
                  }}
                  title={!hasText ? "No puedes añadir un hijo a una línea vacía" : "Añadir hijo"}
                  disabled={!hasText}
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  className="btn border-2 border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/50 text-xs text-rose-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteLine(line.id);
                  }}
                  title="Eliminar línea"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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
            depth={depth + 1}
            selectedLineId={selectedLineId}
            editingLineDraft={editingLineDraft}
            onSelectLine={onSelectLine}
            onAddChild={onAddChild}
            onDeleteLine={onDeleteLine}
            onUpdateLine={onUpdateLine}
            onSaveLine={onSaveLine}
            onOpenLineRule={onOpenLineRule}
          />
        ))}
    </div>
  );
}