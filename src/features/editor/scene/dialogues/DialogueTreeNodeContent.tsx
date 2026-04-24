import type { RefObject } from "react";
import type { DialogueLineNode, ID } from "@/domain/types";
import { Check, ChevronDown, ChevronRight, Plus, Ruler, Trash2 } from "lucide-react";

type Props = {
  selected: boolean;
  renderedLine: DialogueLineNode;
  speakerLabel: string;
  hasChildren: boolean;
  collapsed: boolean;
  hasText: boolean;
  hasRule: boolean;
  nextSpeaker: DialogueLineNode["speaker"];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onToggleCollapsed: () => void;
  onUpdateLine: (lineId: ID, patch: Partial<DialogueLineNode>) => void;
  onSaveLine: (lineId: ID) => void;
  onOpenLineRule: (lineId: ID) => void;
  onAddChild: (parentId: ID, speaker: DialogueLineNode["speaker"]) => void;
  onDeleteLine: (lineId: ID) => void;
};

function speakerBadgeTone(speaker: DialogueLineNode["speaker"]): string {
  return speaker === "player"
    ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-100"
    : "border-sky-700/50 bg-sky-950/40 text-sky-100";
}

export function DialogueTreeNodeContent({ selected, renderedLine, speakerLabel, hasChildren, collapsed, hasText, hasRule, nextSpeaker, textareaRef, onToggleCollapsed,
  onUpdateLine, onSaveLine, onOpenLineRule, onAddChild, onDeleteLine }: Props) {
  const lineId = renderedLine.id;

  const collapseButton = hasChildren ? (
    <button
      type="button"
      className="btn border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-white"
      onClick={(event) => {
        event.stopPropagation();
        onToggleCollapsed();
      }}
      title={collapsed ? "Expandir hijos" : "Colapsar hijos"}
    >
      {collapsed ? (
        <ChevronRight className="w-4 h-4" />
      ) : (
        <ChevronDown className="w-4 h-4" />
      )}
    </button>
  ) : null;

  const ruleButton = (
    <button
      type="button"
      className="btn border-2 border-fuchsia-700/60 bg-fuchsia-950/30 hover:bg-fuchsia-900/40 text-xs text-fuchsia-100"
      onClick={(event) => {
        event.stopPropagation();
        onOpenLineRule(lineId);
      }}
      title={hasRule ? "Editar regla" : "Añadir regla"}
    >
      <Ruler className="w-4 h-4" />
    </button>
  );

  const addChildButton = (
    <button
      type="button"
      className="btn border-2 border-amber-700 bg-amber-950/30 hover:bg-amber-900/40 text-xs text-white disabled:opacity-40 disabled:cursor-not-allowed"
      onClick={(event) => {
        event.stopPropagation();
        onAddChild(lineId, nextSpeaker);
      }}
      title={!hasText ? "No puedes añadir un hijo a una línea vacía" : "Añadir hijo"}
      disabled={!hasText}
    >
      <Plus className="w-4 h-4" />
    </button>
  );

  const deleteButton = (
    <button
      type="button"
      className="btn border-2 border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/70 text-xs text-rose-100"
      onClick={(event) => {
        event.stopPropagation();
        onDeleteLine(lineId);
      }}
      title="Eliminar línea"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );

  const saveButton = selected ? (
    <button
      type="button"
      className="btn border-2 border-emerald-700/60 bg-emerald-950/30 hover:bg-emerald-900/40 text-xs text-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
      onClick={(event) => {
        event.stopPropagation();
        onSaveLine(lineId);
      }}
      title={!hasText ? "No puedes guardar una línea vacía" : "Guardar línea"}
      disabled={!hasText}
    >
      <Check className="w-4 h-4" />
    </button>
  ) : null;

  const actionButtons = (
    <div className="flex items-center gap-2 shrink-0">
      {collapseButton}
      {saveButton}
      {ruleButton}
      {addChildButton}
      {deleteButton}
    </div>
  );

  if (selected) {
    return (
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
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onUpdateLine(lineId, { text: event.currentTarget.value })}
            rows={3}
            placeholder="Texto de la línea"
            className="w-full rounded-md border border-indigo-400 px-2 py-1.5 text-sm text-white placeholder:text-slate-500 resize-none
              focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-700 editor-scroll"
          />
        </div>

        {actionButtons}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1 text-sm text-white text-left truncate ml-1">
        {renderedLine.text.trim() || (
          <span className="text-slate-500">(sin texto)</span>
        )}
      </div>

      {actionButtons}
    </div>
  );
}