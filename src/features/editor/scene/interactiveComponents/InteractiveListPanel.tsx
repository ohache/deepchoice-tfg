import type { ID } from "@/domain/types";
import { Pencil, Trash2 } from "lucide-react";

export type InteractiveListEntry = {
  id: ID;
  label: string;
};

type InteractiveListPanelProps = {
  items: InteractiveListEntry[];
  selectedId: ID | null;
  emptyText: string;
  editTitle: string;
  editAriaLabel: string;
  deleteAriaLabel: string;
  itemTitle: string;
  createLabel?: string;
  onCreate?: () => void;
  onEdit: (id: ID) => void;
  onDelete: (id: ID) => void;
  onDeleteAll: () => void;
};

export function InteractiveListPanel({ items, selectedId, emptyText, editTitle, editAriaLabel, deleteAriaLabel, itemTitle, createLabel, onCreate,
  onEdit, onDelete, onDeleteAll }: InteractiveListPanelProps) {
  return (
    <div className="space-y-3">
      {onCreate && createLabel ? (
        <div className="pt-2 justify-center">
          <button type="button" className="btn btn-create-condition" onClick={onCreate}>
            {createLabel}
          </button>
        </div>
      ) : null}

      <div className="space-y-2">
        {!items.length ? (
          <div className="text-xs text-slate-300">{emptyText}</div>
        ) : (
          items.map((item) => {
            const isSelected = selectedId === item.id;
            const label = item.label.trim();

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onEdit(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onEdit(item.id);
                  }
                }}
                className={`rounded-md border px-3 py-2 cursor-pointer select-none ${
                  isSelected
                    ? "border-fuchsia-500/50 bg-slate-950/60"
                    : "border-slate-700 bg-slate-950/30"
                } hover:bg-fuchsia-900/20`}
                title={itemTitle}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-slate-100 truncate">
                      {label ? label : <span className="text-slate-500">(sin label)</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      className="btn border-2 border-slate-700 bg-slate-800 hover:bg-slate-700 text-white p-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(item.id);
                      }}
                      title={editTitle}
                      aria-label={editAriaLabel}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      className="btn border-2 border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/50 text-rose-100 p-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                      title="Eliminar"
                      aria-label={deleteAriaLabel}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {items.length ? (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            className="btn border-2 border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/50 text-xs text-rose-100"
            onClick={onDeleteAll}
            title="Borrar todos"
          >
            Borrar todos
          </button>
        </div>
      ) : null}
    </div>
  );
}