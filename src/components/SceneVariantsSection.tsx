import { useRef, useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";
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

type DragIndexRef = {
  current: number | null;
};

type SetOverId = (value: ID | null | ((current: ID | null) => ID | null)) => void;

const EMPTY_LABEL_TEXT = "(Sin label)";
const VARIANT_CARD_HELP_TEXT = "Click: previsualizar · Doble click: editar";
const VARIANT_CARD_DRAG_HELP_TEXT = `${VARIANT_CARD_HELP_TEXT} · Arrastra para ordenar prioridad`;

function getVariantHelpText(draggable: boolean): string {
  return draggable ? VARIANT_CARD_DRAG_HELP_TEXT : VARIANT_CARD_HELP_TEXT;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function getVariantLabel(label?: string | null): string {
  return label?.trim() || EMPTY_LABEL_TEXT;
}

/* Construye la clase visual de una card de variante según su estado de drag. */
function getVariantCardClassName(args: { draggable: boolean; isDragging: boolean; isOver: boolean; cardWidthClassName: string }): string {
  const { draggable, isDragging, isOver, cardWidthClassName } = args;

  return cx(
    "flex items-center gap-2 rounded-md border-2 px-2 py-2 select-none border-slate-700 bg-slate-900 hover:bg-slate-800",
    draggable ? "cursor-pointer variant-draggable" : "cursor-default opacity-95",
    isDragging && "variant-dragging",
    isOver && "variant-drop-target",
    cardWidthClassName,
  );
}

/* Inicia el arrastre de una variante si puede reordenarse. */
function handleVariantDragStart(args: {
  event: DragEvent<HTMLDivElement>; variantId: ID; index: number; draggable: boolean; dragFromIndexRef: DragIndexRef;
  setDraggingId: (id: ID | null) => void
}): void {
  const { event, variantId, index, draggable, dragFromIndexRef, setDraggingId } = args;

  if (!draggable) return;

  dragFromIndexRef.current = index;
  setDraggingId(variantId);

  event.dataTransfer.effectAllowed = "move";
}

/* Marca una variante como posible destino de drop. */
function handleVariantDragOver(args: { event: DragEvent<HTMLDivElement>; variantId: ID; draggable: boolean; setOverId: (id: ID | null) => void }): void {
  const { event, variantId, draggable, setOverId } = args;

  if (!draggable) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  setOverId(variantId);
}

/* Limpia el estado visual cuando el cursor sale del destino actual. */
function handleVariantDragLeave(args: { variantId: ID; setOverId: SetOverId }): void {
  const { variantId, setOverId } = args;

  setOverId((current) => (current === variantId ? null : current));
}

/* Ejecuta el reordenado cuando se suelta una variante sobre otra. */
function handleVariantDrop(args: {
  index: number; draggable: boolean; dragFromIndexRef: DragIndexRef; resetDragState: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void
}): void {
  const { index, draggable, dragFromIndexRef, resetDragState, onReorder } = args;

  if (!draggable) return;

  const fromIndex = dragFromIndexRef.current;
  resetDragState();

  if (fromIndex == null || fromIndex === index) return;

  onReorder(fromIndex, index);
}

/* Permite usar teclado: Enter previsualiza, doble Enter no; Ctrl+Enter edita. */
function handleVariantKeyDown(args: { event: KeyboardEvent<HTMLDivElement>; variantId: ID; onSelectVariant?: (id: ID) => void; onEditVariant: (id: ID) => void }): void {
  const { event, variantId, onSelectVariant, onEditVariant } = args;

  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();

  if (event.ctrlKey || event.metaKey) {
    onEditVariant(variantId);
    return;
  }

  onSelectVariant?.(variantId);
}

/* Lista visual de variantes con selección, edición por doble click y reordenación por drag & drop. */
export function SceneVariantList({ title, variants, hidden, onReorder, isItemDraggable, onSelectVariant, onEditVariant, cardWidthClassName = "w-full" }: VariantListProps) {
  const dragFromIndexRef = useRef<number | null>(null);

  const [draggingId, setDraggingId] = useState<ID | null>(null);
  const [overId, setOverId] = useState<ID | null>(null);

  if (hidden || variants.length === 0) return null;

  const canDrag = (id: ID): boolean => isItemDraggable ? isItemDraggable(id) : true;

  const hasDraggableItems = variants.some((variant) => canDrag(variant.id));

  const resetDragState = () => {
    dragFromIndexRef.current = null;
    setDraggingId(null);
    setOverId(null);
  };

  return (
    <>
      <div className="pt-1">
        <div className="h-px bg-slate-700" />

        <div className="pt-2 text-center text-[12px] font-semibold text-slate-200">
          {title}
        </div>

        <div className="text-[11px] text-slate-400">
          {getVariantHelpText(hasDraggableItems)}
        </div>
      </div>

      <div className="pt-1 flex flex-col items-center gap-2">
        {variants.map((variant, index) => {
          const draggable = canDrag(variant.id);
          const isDragging = draggingId === variant.id;
          const isOver = overId === variant.id && !isDragging;

          return (
            <div
              key={variant.id}
              role="button"
              tabIndex={0}
              draggable={draggable}
              onDragStart={(event) => handleVariantDragStart({ event, variantId: variant.id, index, draggable, dragFromIndexRef, setDraggingId })}
              onDragEnd={resetDragState}
              onDragOver={(event) => handleVariantDragOver({ event, variantId: variant.id, draggable, setOverId })}
              onDragLeave={() => handleVariantDragLeave({ variantId: variant.id, setOverId })}
              onDrop={() => handleVariantDrop({ index, draggable, dragFromIndexRef, resetDragState, onReorder })}
              onClick={() => onSelectVariant?.(variant.id)}
              onDoubleClick={() => onEditVariant(variant.id)}
              onKeyDown={(event) => handleVariantKeyDown({ event, variantId: variant.id, onSelectVariant, onEditVariant })}
              className={getVariantCardClassName({ draggable, isDragging, isOver, cardWidthClassName })}
              title={getVariantHelpText(draggable)}
            >
              <div className="w-7 text-center text-[11px] font-semibold text-slate-100">
                {index + 1}.
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-white truncate">
                  {getVariantLabel(variant.label)}
                </div>
              </div>

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