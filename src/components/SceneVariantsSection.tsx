import React, { useRef, useState, type RefObject } from "react";
import type { ID } from "@/domain/types";

type VariantListItem = { id: ID; label?: string | null };

type VariantListProps = {
  title: string;
  variants: VariantListItem[];
  hidden?: boolean;
  onReorder: (fromIndex: number, toIndex: number) => void;
  isItemDraggable?: (id: ID) => boolean;
  onSelectVariant?: (id: ID) => void;
  onEditVariant: (id: ID) => void;
  cardWidthClassName?: string;
};

/*  Lista visual de variantes */
export function SceneVariantList({ title, variants, hidden, onReorder, isItemDraggable, onSelectVariant, onEditVariant, cardWidthClassName = "w-full"}: VariantListProps) {
  const dragFromIndexRef = useRef<number | null>(null);

  const [draggingId, setDraggingId] = useState<ID | null>(null);
  const [overId, setOverId] = useState<ID | null>(null);

  if (hidden) return null;
  if (!variants.length) return null;

  const canDrag = (id: ID) => (isItemDraggable ? !!isItemDraggable(id) : true);

  return (
    <>
      <div className="pt-1">
        <div className="h-px bg-slate-700" />
        <div className="pt-2 text-center text-[12px] font-semibold text-slate-200">{title}</div>
        <div className="text-[11px] text-slate-400">(arrastra para ordenar la prioridad)</div>
      </div>

      <div className="pt-1 flex flex-col items-center gap-2">
        {variants.map((v, idx) => {
          const draggable = canDrag(v.id);
          const isDragging = draggingId === v.id;
          const isOver = overId === v.id && !isDragging;

          return (
            <div
              key={v.id}
              draggable={draggable}
              onDragStart={(e) => {
                if (!draggable) return;
                dragFromIndexRef.current = idx;
                setDraggingId(v.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                dragFromIndexRef.current = null;
                setDraggingId(null);
                setOverId(null);
              }}
              onDragOver={(e) => {
                if (!draggable) return;
                e.preventDefault();
                setOverId(v.id);
                e.dataTransfer.dropEffect = "move";
              }}
              onDragLeave={() => {
                setOverId((curr) => (curr === v.id ? null : curr));
              }}
              onDrop={() => {
                if (!draggable) return;

                const from = dragFromIndexRef.current;
                dragFromIndexRef.current = null;

                setDraggingId(null);
                setOverId(null);

                if (from == null) return;
                if (from === idx) return;

                onReorder(from, idx);
              }}
              onClick={() => onSelectVariant?.(v.id)}
              onDoubleClick={() => onEditVariant(v.id)}
              className={ "flex items-center gap-2 rounded-md border px-2 py-2 select-none border-slate-700 bg-slate-900 hover:bg-slate-800 variant-draggable " +
                (draggable ? "cursor-pointer " : "cursor-default opacity-95 ") +
                (isDragging ? "variant-dragging " : "") +
                (isOver ? "variant-drop-target " : "") +
                cardWidthClassName}
              title={ draggable ? "Click: previsualizar · Doble click: editar · Arrastra para reordenar" : "Click: previsualizar · Doble click: editar"}
            >
              <div className="w-7 text-center text-[11px] font-semibold text-slate-100">{idx + 1}.</div>

              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-white truncate">{(v.label ?? "").trim() || "(Sin label)"}</div>
              </div>

              <div className="px-2 text-slate-300" aria-hidden="true" title={draggable ? "Arrastra para reordenar" : "Orden fijo"}>
                {draggable ? "⋮⋮" : "•"}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

type VariantEditorShellProps = {
  labelInputRef?: RefObject<HTMLInputElement | null>;
  draftLabel: string;
  onChangeDraftLabel: (next: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
  saveDisabled?: boolean;
};

export function SceneVariantEditorShell({ labelInputRef, draftLabel, onChangeDraftLabel, onCancel, onSave, onDelete, children, saveDisabled = false }: VariantEditorShellProps) {
  return (
    <div className="bg-slate-950/40 p-3 space-y-3">
      {/* Label */}
      <div className="-mx-3 space-y-1">
        <div className="text-[12px] text-white">Etiqueta</div>

        <input
          ref={labelInputRef}
          value={draftLabel}
          onChange={(e) => onChangeDraftLabel(e.currentTarget.value)}
          maxLength={150}
          className="pl-4 w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100
            focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
        />
      </div>

      {/* Contenido específico */}
      <div className="space-y-3">{children}</div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={saveDisabled}
              className="px-2 py-1 rounded-md border border-rose-700 bg-rose-950/20 text-rose-200 hover:bg-rose-900/30 text-[11px]"
            >
              Eliminar
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-1 rounded-md border border-slate-800 bg-transparent text-slate-300 hover:bg-slate-900 text-[11px]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onSave}
            className="px-2 py-1 rounded-md border border-emerald-700 bg-emerald-800/30 text-emerald-100 hover:bg-emerald-700/40 text-[11px]"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}