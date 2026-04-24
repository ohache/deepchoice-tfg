import type { KeyboardEvent } from "react";
import type { ID } from "@/domain/types";
import { Pencil, Trash2 } from "lucide-react";

export type InteractiveListEntry = {
  id: ID;
  label: string;
};

type InteractiveListPanelProps = {
  items: InteractiveListEntry[];
  selectedId: ID | null;
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

function getDisplayLabel(label: string): string {
  return label.trim();
}

function getItemClassName(selected: boolean): string {
  return ("cursor-pointer select-none rounded-md border-2 px-3 py-2 " +
    (selected
      ? "border-fuchsia-500/50 bg-fuchsia-950/30 "
      : "border-indigo-800 bg-slate-950/30 ") +
    "hover:border-indigo-700 hover:bg-indigo-950/70");
}

function handleItemKeyDown(event: KeyboardEvent<HTMLDivElement>, onEdit: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onEdit();
  }
}

type InteractiveListItemProps = {
  item: InteractiveListEntry;
  selected: boolean;
  itemTitle: string;
  editTitle: string;
  editAriaLabel: string;
  deleteAriaLabel: string;
  onEdit: (id: ID) => void;
  onDelete: (id: ID) => void;
};

function InteractiveListItem({ item, selected, itemTitle, editTitle, editAriaLabel, deleteAriaLabel,
  onEdit, onDelete }: InteractiveListItemProps) {
  const label = getDisplayLabel(item.label);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(item.id)}
      onKeyDown={(event) => handleItemKeyDown(event, () => onEdit(item.id))}
      className={getItemClassName(selected)}
      title={itemTitle}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm text-white">
            {label ? label : <span className="text-slate-500">(sin label)</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="btn border-2 border-slate-700 bg-slate-950/30 p-1 text-white hover:bg-slate-800"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(item.id);
            }}
            title={editTitle}
            aria-label={editAriaLabel}
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="btn border-2 border-rose-700/60 bg-rose-950/30 p-1 text-rose-100 hover:bg-rose-950"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(item.id);
            }}
            title="Eliminar"
            aria-label={deleteAriaLabel}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* Panel genérico para listar elementos interactivos editables */
export function InteractiveListPanel({ items, selectedId, editTitle, editAriaLabel, deleteAriaLabel, itemTitle,
  createLabel, onCreate, onEdit, onDelete, onDeleteAll }: InteractiveListPanelProps) {
  const hasItems = items.length > 0;
  const showCreateButton = Boolean(onCreate && createLabel);

  return (
    <div className={items.length ? "space-y-3" : "space-y-2"}>
      {showCreateButton ? (
        <div className={hasItems ? "space-y-3 pt-2" : "pt-2"}>
          <div className="flex justify-center">
            <button
              type="button"
              className="btn btn-create-condition text-[13px] text-white"
              onClick={onCreate}
            >
              {createLabel}
            </button>
          </div>

          {hasItems ? <div className="h-px bg-slate-700" /> : null}
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => (
            <InteractiveListItem
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              itemTitle={itemTitle}
              editTitle={editTitle}
              editAriaLabel={editAriaLabel}
              deleteAriaLabel={deleteAriaLabel}
              onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    ) : null}

      {hasItems ? (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            className="btn border-2 border-rose-700/60 bg-rose-950/30 text-xs text-white hover:bg-rose-950"
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