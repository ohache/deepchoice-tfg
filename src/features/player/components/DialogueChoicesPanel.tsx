import type { CSSProperties } from "react";
import type { DialogueLineNode, ID } from "@/domain/types";
import type { InteractionKind } from "@/features/player/components/interactionCursors";
import { MessageCircle } from "lucide-react";

type AnchorRect = { x: number; y: number; w: number; h: number };

type DialogueChoicesPanelProps = {
  open: boolean;
  options: DialogueLineNode[];
  anchorRect: AnchorRect | null;
  onSelectOption: (nodeId: ID) => void;
  onCursorMove?: (event: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorEnter?: (event: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorLeave?: () => void;
};

function buildPanelAnchorStyle(anchorRect: AnchorRect | null): CSSProperties {
  if (!anchorRect) {
    return { left: 0, right: 0, bottom: 0, cursor: "none" };
  }

  return { left: anchorRect.x, width: anchorRect.w, bottom: `calc(100% - ${anchorRect.y + anchorRect.h}px)`, cursor: "none" };
}

export function DialogueChoicesPanel({ open, options, anchorRect, onSelectOption, onCursorMove, onCursorEnter, onCursorLeave }: DialogueChoicesPanelProps) {
  if (!open) return null;

  return (
    <div
      className="absolute z-40 px-4 sm:px-10 md:px-30 pb-0"
      style={buildPanelAnchorStyle(anchorRect)}
      onMouseMove={(event) => onCursorMove?.(event, "dialogue")}
      onMouseEnter={(event) => onCursorEnter?.(event, "dialogue")}
      onMouseLeave={() => onCursorLeave?.()}
    >
      <div className="mx-auto w-full rounded-t-xl border-2 border-b-0 border-slate-800 bg-slate-950/35 shadow-2xl backdrop-blur-sm">
        <div className="editor-scroll max-h-[22vh] overflow-y-auto px-2 py-3">
          <div className="flex cursor-none flex-col items-center gap-1">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="group w-full cursor-none bg-transparent px-1 py-1 text-left focus:outline-none"
                style={{ cursor: "none" }}
                onMouseMove={(event) => onCursorMove?.(event, "dialogue")}
                onMouseEnter={(event) => onCursorEnter?.(event, "dialogue")}
                onClick={() => onSelectOption(option.id)}
              >
                <span className="flex items-start gap-1">
                  <MessageCircle className="mr-1.5 mt-1.5 h-3.5 w-3.5 text-slate-400 group-hover:text-fuchsia-400" />

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