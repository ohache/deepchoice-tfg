import { useEffect, useMemo, useState } from "react";
import type { ID } from "@/domain/types";
import { iconForInteractionKind } from "@/features/player/components/interactionCursors";

export type InventoryItemView = {
  instanceId: ID;
  itemId: ID;
  name: string;
  imageSrc: string;
  cursorSize: { width: number; height: number };
};
type InventoryOverlayProps = {
  open: boolean;
  items: InventoryItemView[];
  onClose: () => void;
  onSelectItem: (item: InventoryItemView) => void;
  onUseItemOnInventoryItem: (sourceItem: InventoryItemView, targetItem: InventoryItemView) => void;
};

const INVENTORY_COLS = 6;
const INVENTORY_VISIBLE_ROWS = 4;

export function InventoryOverlay({ open, items, onClose, onSelectItem, onUseItemOnInventoryItem }: InventoryOverlayProps) {
  const [visible, setVisible] = useState(open);

  const [cursorPos, setCursorPos] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });

  const [pressedItem, setPressedItem] = useState<InventoryItemView | null>(null);
  const [hoveredTargetItemId, setHoveredTargetItemId] = useState<ID | null>(null);

  const takeCursorIcon = iconForInteractionKind("take");
  const overlayCursorSrc = pressedItem?.imageSrc ?? takeCursorIcon;

  const isDraggingItem = pressedItem !== null;
  const draggedCursorSize = pressedItem?.cursorSize ?? { width: 64, height: 64 };

  useEffect(() => {
    if (open) {
      setVisible(true);
    } else {
      const t = window.setTimeout(() => setVisible(false), 200);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !pressedItem) return;

    const handlePointerUp = () => {
      const targetItem =
        hoveredTargetItemId && hoveredTargetItemId !== pressedItem.instanceId
          ? items.find((item) => item.instanceId === hoveredTargetItemId) ?? null
          : null;

      if (targetItem) {
        onUseItemOnInventoryItem(pressedItem, targetItem);
      } else {
        onSelectItem(pressedItem);
      }

      onClose();
      setPressedItem(null);
      setHoveredTargetItemId(null);
    };

    window.addEventListener("pointerup", handlePointerUp);

    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [open, pressedItem, hoveredTargetItemId, items, onSelectItem, onUseItemOnInventoryItem, onClose]);

  useEffect(() => {
    if (!open) {
      setPressedItem(null);
      setHoveredTargetItemId(null);
    }
  }, [open]);

  const totalRows = useMemo(
  () => Math.max(INVENTORY_VISIBLE_ROWS, Math.ceil(items.length / INVENTORY_COLS)),
  [items.length]
);

const totalSlots = useMemo(
  () => totalRows * INVENTORY_COLS,
  [totalRows]
);

const slots = useMemo(() => {
  return Array.from({ length: totalSlots }, (_, index) => items[index] ?? null);
}, [items, totalSlots]);

  if (!visible) return null;

  return (
  <div
    className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
    onClick={() => { if (!pressedItem) onClose() }}
    onPointerMove={(e) => setCursorPos({ visible: true, x: e.clientX, y: e.clientY })}
    onPointerEnter={(e) => setCursorPos({ visible: true, x: e.clientX, y: e.clientY })}
    onPointerLeave={() => {
      setCursorPos((prev) => ({ ...prev, visible: false }));
      setHoveredTargetItemId(null);
    }}
    style={{ cursor: "none", touchAction: "none" }}
  >
    <style>{`
      @keyframes inventoryDrop {
        0% {
          opacity: 0;
          transform: translateY(-28px) scale(0.98);
        }
        100% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes inventoryRise {
        0% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        100% {
          opacity: 0;
          transform: translateY(-28px) scale(0.98);
        }
      }
    `}</style>

    <div
      onClick={(e) => e.stopPropagation()}
      className={`relative overflow-hidden rounded-2xl border border-slate-950/60 bg-cyan-950/70 shadow-2xl ${
        open
          ? "animate-[inventoryDrop_220ms_ease-out]"
          : "animate-[inventoryRise_200ms_ease-in]"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label="Inventario"
      style={{
        cursor: "none",
        width: "60vw",
        height: "55vh",
      }}
    >
      <div className="h-full overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5 editor-scroll">
        <div
          className="grid grid-cols-6 gap-2 sm:gap-3 lg:gap-4"
          style={{ gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))` }}
        >
          {slots.map((item, index) => (
            <div
              key={item ? item.instanceId : `empty-${index}`}
              className="aspect-square flex items-center justify-center rounded-lg border border-slate-700 bg-slate-950/55 p-1.5 sm:p-2 lg:p-3 shadow-inner"
            >
              {item ? (
                <button
                  type="button"
                  draggable={false}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setPressedItem(item);
                    setHoveredTargetItemId(null);
                    setCursorPos({ visible: true, x: e.clientX, y: e.clientY });
                  }}
                  onPointerEnter={() => {
                    if (pressedItem && pressedItem.instanceId !== item.instanceId) {
                      setHoveredTargetItemId(item.instanceId);
                    }
                  }}
                  onPointerMove={() => {
                    if (pressedItem && pressedItem.instanceId !== item.instanceId) {
                      setHoveredTargetItemId(item.instanceId);
                    }
                  }}
                  onPointerLeave={() => {
                    if (hoveredTargetItemId === item.instanceId) {
                      setHoveredTargetItemId(null);
                    }
                  }}
                  className={`flex h-full w-full items-center justify-center rounded-md ${
                    pressedItem?.instanceId === item.instanceId
                      ? "bg-white/10 ring-2 ring-amber-400/70"
                      : hoveredTargetItemId === item.instanceId
                        ? "bg-amber-300/10 ring-2 ring-amber-300/80"
                        : "hover:bg-white/5"
                  }`}
                  style={{ cursor: "none" }}
                >
                  <img
                    src={item.imageSrc}
                    alt={item.name}
                    className="h-full w-full object-contain select-none"
                    draggable={false}
                  />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>

    {cursorPos.visible && (
      <img
        src={overlayCursorSrc}
        alt=""
        aria-hidden="true"
        draggable={false}
        className={`pointer-events-none fixed z-60 object-contain select-none ${
          isDraggingItem ? "" : "h-16 w-16"
        }`}
        style={
          isDraggingItem
            ? {
                left: cursorPos.x,
                top: cursorPos.y,
                width: draggedCursorSize.width,
                height: draggedCursorSize.height,
                transform: "translate(-50%, -50%)",
              }
            : {
                left: cursorPos.x - 64,
                top: cursorPos.y - 64,
              }
        }
      />
    )}
  </div>
);
}