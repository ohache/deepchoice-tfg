import type { DialogueLineNode, ID } from "@/domain/types";
import type { InteractionKind } from "@/features/player/components/interactionCursors";
import { MessageCircle } from "lucide-react";

type DialogueChoicesPanelProps = {
  open: boolean;
  options: DialogueLineNode[];
  onSelectOption: (nodeId: ID) => void;
  onCursorMove?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorEnter?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorLeave?: () => void;
};

export function DialogueChoicesPanel({ open, options, onSelectOption, onCursorMove, onCursorEnter, onCursorLeave }: DialogueChoicesPanelProps) {
  if (!open) return null;

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-40 px-4 pb-4"
      style={{ cursor: "none" }}
      onMouseMove={(e) => onCursorMove?.(e, "dialogue")}
      onMouseEnter={(e) => onCursorEnter?.(e, "dialogue")}
      onMouseLeave={() => onCursorLeave?.()}
    >
      <div className="mx-auto w-full rounded-xl border-2 border-slate-800 max-w-5xl bg-slate-950/70 shadow-2xl backdrop-blur-sm">
        <div className="max-h-[22vh] overflow-y-auto px-2 py-3 editor-scroll">
          <div className="flex cursor-none flex-col items-center gap-1">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="group w-full cursor-none bg-transparent px-1 py-1 text-left focus:outline-none"
                style={{ cursor: "none" }}
                onMouseMove={(e) => onCursorMove?.(e, "dialogue")}
                onMouseEnter={(e) => onCursorEnter?.(e, "dialogue")}
                onClick={() => onSelectOption(option.id)}
              >

                <span className="flex items-start gap-1">
                  <MessageCircle className="mt-1.5 mr-1.5 h-3.5 w-3.5 text-slate-400 group-hover:text-fuchsia-400" />
                  <span className="font-medium leading-relaxed text-slate-100 transition-colors group-hover:text-fuchsia-400 group-focus-visible:text-fuchsia-400">
                    {option.text?.trim() || "(sin texto)"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}