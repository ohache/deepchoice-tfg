import React, { useRef, useState } from "react";
import type { ID } from "@/domain/types";

type VariantListItem = {
  id: ID;
  label?: string | null;
};

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

type VariantDragHandlersArgs = {
  variantId: ID;
  index: number;
  draggable: boolean;
  dragFromIndexRef: React.MutableRefObject<number | null>;
  setDraggingId: React.Dispatch<React.SetStateAction<ID | null>>;
  setOverId: React.Dispatch<React.SetStateAction<ID | null>>;
  resetDragState: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

const EMPTY_LABEL_TEXT = "(Sin label)";

function getVariantCardTitle(draggable: boolean): string {
  return draggable
    ? "Click: previsualizar · Doble click: editar · Arrastra para reordenar"
    : "Click: previsualizar · Doble click: editar";
}

function getVariantLabel(label?: string | null): string {
  return label?.trim() || EMPTY_LABEL_TEXT;
}

/* Construye la clase visual de una card */
function getVariantCardClassName(args: { draggable: boolean; isDragging: boolean; isOver: boolean; cardWidthClassName: string }): string {
  const { draggable, isDragging, isOver, cardWidthClassName } = args;

  return ("flex items-center gap-2 rounded-md border-2 px-2 py-2 select-none border-slate-700 bg-slate-900 hover:bg-slate-800 variant-draggable " +
    (draggable ? "cursor-pointer " : "cursor-default opacity-95 ") +
    (isDragging ? "variant-dragging " : "") +
    (isOver ? "variant-drop-target " : "") +
    cardWidthClassName);
}

function createVariantDragStartHandler(args: VariantDragHandlersArgs) {
  const { variantId, index, draggable, dragFromIndexRef, setDraggingId } = args;

  return (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggable) return;

    dragFromIndexRef.current = index;
    setDraggingId(variantId);
    event.dataTransfer.effectAllowed = "move";
  };
}

function createVariantDragOverHandler(args: VariantDragHandlersArgs) {
  const { variantId, draggable, setOverId } = args;

  return (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggable) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setOverId(variantId);
  };
}

function createVariantDragLeaveHandler(args: VariantDragHandlersArgs) {
  const { variantId, setOverId } = args;

  return () => {setOverId((current) => (current === variantId ? null : current)) };
}

function createVariantDropHandler(args: VariantDragHandlersArgs) {
  const { index, draggable, dragFromIndexRef, resetDragState, onReorder } = args;

  return () => {
    if (!draggable) return;

    const fromIndex = dragFromIndexRef.current;
    resetDragState();

    if (fromIndex == null || fromIndex === index) return;
    onReorder(fromIndex, index);
  };
}

/* Lista visual de variantes */
export function SceneVariantList({ title, variants, hidden, onReorder, isItemDraggable, onSelectVariant, onEditVariant, cardWidthClassName = "w-full" }: VariantListProps) {
  const dragFromIndexRef = useRef<number | null>(null);

  const [draggingId, setDraggingId] = useState<ID | null>(null);
  const [overId, setOverId] = useState<ID | null>(null);

  if (hidden || variants.length === 0) return null;

  const canDrag = (id: ID): boolean => (isItemDraggable ? isItemDraggable(id) : true);

  const resetDragState = () => {
    dragFromIndexRef.current = null;
    setDraggingId(null);
    setOverId(null);
  };

  return (
    <>
      {/* Cabecera */}
      <div className="pt-1">
        <div className="h-px bg-slate-700" />
        <div className="pt-2 text-center text-[12px] font-semibold text-slate-200">{title}</div>
        <div className="text-[11px] text-slate-400">(arrastra para ordenar la prioridad)</div>
      </div>

      {/* Lista */}
      <div className="pt-1 flex flex-col items-center gap-2">
        {variants.map((variant, index) => {
          const draggable = canDrag(variant.id);
          const isDragging = draggingId === variant.id;
          const isOver = overId === variant.id && !isDragging;

          const dragHandlersArgs: VariantDragHandlersArgs = { variantId: variant.id, index, draggable, dragFromIndexRef, setDraggingId, setOverId, resetDragState, onReorder };

          const handleDragStart = createVariantDragStartHandler(dragHandlersArgs);
          const handleDragOver = createVariantDragOverHandler(dragHandlersArgs);
          const handleDragLeave = createVariantDragLeaveHandler(dragHandlersArgs);
          const handleDrop = createVariantDropHandler(dragHandlersArgs);

          return (
            <div
              key={variant.id}
              draggable={draggable}
              onDragStart={handleDragStart}
              onDragEnd={resetDragState}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => onSelectVariant?.(variant.id)}
              onDoubleClick={() => onEditVariant(variant.id)}
              className={getVariantCardClassName({ draggable, isDragging, isOver, cardWidthClassName })}
              title={getVariantCardTitle(draggable)}
            >
              {/* Índice visible */}
              <div className="w-7 text-center text-[11px] font-semibold text-slate-100">
                {index + 1}.
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-white truncate">{getVariantLabel(variant.label)}</div>
              </div>

              {/* Indicador de drag */}
              <div
                className="px-2 text-slate-200"
                aria-hidden="true"
                title={draggable ? "Arrastra para reordenar" : "Orden fijo"}
              >
                {draggable ? "⋮⋮" : "•"}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}