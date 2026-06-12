import { useEffect, useMemo, useState } from "react";
import type { ID } from "@/domain/types";
import { iconForInteractionKind } from "@/features/player/components/interactionCursors";

export type InventoryItemView = {
  itemInstanceId: ID;
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
const INVENTORY_VISIBLE_ROWS = 3;
const CLOSE_ANIMATION_MS = 200;

const PANEL_MAX_WIDTH_RATIO = 0.68;
const PANEL_MAX_HEIGHT_RATIO = 0.68;

const PANEL_PADDING_X = 24;
const PANEL_PADDING_Y = 26;
const CELL_GAP = 14;

const MIN_CELL_SIZE = 56;
const MAX_CELL_SIZE = 112;

type CursorPosition = {
  visible: boolean;
  x: number;
  y: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

function buildInventorySlots(items: InventoryItemView[]) {
  const totalRows = Math.max(INVENTORY_VISIBLE_ROWS, Math.ceil(items.length / INVENTORY_COLS));
  const totalSlots = totalRows * INVENTORY_COLS;

  return {
    totalRows,
    slots: Array.from({ length: totalSlots }, (_, index) => items[index] ?? null),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildInventoryLayout(viewport: ViewportSize, visibleRows: number) {
  const maxPanelWidth = viewport.width * PANEL_MAX_WIDTH_RATIO;
  const maxPanelHeight = viewport.height * PANEL_MAX_HEIGHT_RATIO;

  const cellFromWidth =
    (maxPanelWidth - PANEL_PADDING_X * 2 - CELL_GAP * (INVENTORY_COLS - 1)) /
    INVENTORY_COLS;

  const cellFromHeight =
    (maxPanelHeight - PANEL_PADDING_Y * 2 - CELL_GAP * (visibleRows - 1)) /
    visibleRows;

  const cellSize = Math.floor(
    clamp(Math.min(cellFromWidth, cellFromHeight), MIN_CELL_SIZE, MAX_CELL_SIZE)
  );

  const panelWidth =
    INVENTORY_COLS * cellSize +
    CELL_GAP * (INVENTORY_COLS - 1) +
    PANEL_PADDING_X * 2;

  const panelHeight =
    visibleRows * cellSize +
    CELL_GAP * (visibleRows - 1) +
    PANEL_PADDING_Y * 2;

  return {
    cellSize,
    panelWidth,
    panelHeight,
    gap: CELL_GAP,
    paddingX: PANEL_PADDING_X,
    paddingY: PANEL_PADDING_Y,
  };
}

function InventoryCursor(props: {
  visible: boolean;
  src: string;
  dragging: boolean;
  position: CursorPosition;
  size: { width: number; height: number };
}) {
  const { visible, src, dragging, position, size } = props;

  if (!visible) return null;

  const cursorSize = dragging ? size : { width: 64, height: 64 };

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="pointer-events-none fixed z-60 object-contain select-none"
      style={{
        left: position.x,
        top: position.y,
        width: cursorSize.width,
        height: cursorSize.height,
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}

function findInventoryItemIdFromPoint(x: number, y: number): ID | null {
  const element = document.elementFromPoint(x, y);
  const target = element?.closest<HTMLElement>("[data-inventory-item-id]");

  return target?.dataset.inventoryItemId ?? null;
}

export function InventoryOverlay({ open, items, onClose, onSelectItem, onUseItemOnInventoryItem }: InventoryOverlayProps) {
  const [visible, setVisible] = useState(open);
  const [cursorPos, setCursorPos] = useState<CursorPosition>({ visible: false, x: 0, y: 0 });
  const [pressedItem, setPressedItem] = useState<InventoryItemView | null>(null);
  const [hoveredTargetItemId, setHoveredTargetItemId] = useState<ID | null>(null);

  const viewport = useViewportSize();
  const { totalRows, slots } = useMemo(() => buildInventorySlots(items), [items]);

  const visibleRows = Math.min(totalRows, 4);
  const needsScroll = totalRows > visibleRows;

  const inventoryLayout = useMemo(
    () => buildInventoryLayout(viewport, visibleRows),
    [viewport, visibleRows]
  );

  const takeCursorIcon = iconForInteractionKind("take");
  const overlayCursorSrc = pressedItem?.imageSrc ?? takeCursorIcon;
  const isDraggingItem = pressedItem !== null;
  const draggedCursorSize = pressedItem?.cursorSize ?? { width: 64, height: 64 };

  useEffect(() => {
    if (open) {
      setVisible(true);
      return;
    }

    const timer = window.setTimeout(() => setVisible(false), CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !pressedItem) return;

    const handlePointerUp = (event: PointerEvent) => {
      const droppedTargetId = findInventoryItemIdFromPoint(event.clientX, event.clientY);

      const targetItem =
        droppedTargetId && droppedTargetId !== pressedItem.itemInstanceId
          ? items.find((item) => item.itemInstanceId === droppedTargetId) ?? null
          : null;

      if (targetItem) onUseItemOnInventoryItem(pressedItem, targetItem);
      else onSelectItem(pressedItem);

      onClose();
      setPressedItem(null);
      setHoveredTargetItemId(null);
    };

    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [open, pressedItem, hoveredTargetItemId, items, onSelectItem, onUseItemOnInventoryItem, onClose]);

  useEffect(() => {
    if (open) return;

    setPressedItem(null);
    setHoveredTargetItemId(null);
  }, [open]);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
      onClick={() => {
        if (!pressedItem) onClose();
      }}
      onPointerMove={(event) =>
        setCursorPos({ visible: true, x: event.clientX, y: event.clientY })
      }
      onPointerEnter={(event) =>
        setCursorPos({ visible: true, x: event.clientX, y: event.clientY })
      }
      onPointerLeave={() => {
        setCursorPos((prev) => ({ ...prev, visible: false }));
        setHoveredTargetItemId(null);
      }}
      style={{ cursor: "none", touchAction: "none" }}
    >
      <style>{`
        @keyframes inventoryDrop {
          0% { opacity: 0; transform: translateY(-28px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes inventoryRise {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-28px) scale(0.98); }
        }
      `}</style>

      <div
        onClick={(event) => event.stopPropagation()}
        className={`relative overflow-hidden rounded-xl border-2 border-slate-600 bg-cyan-950/80 shadow-2xl
          ${open ? "animate-[inventoryDrop_220ms_ease-out]" : "animate-[inventoryRise_200ms_ease-in]"}`}
        role="dialog"
        aria-modal="true"
        aria-label="Inventario"
        style={{
          cursor: "none",
          width: inventoryLayout.panelWidth,
          height: inventoryLayout.panelHeight + 2,
        }}
      >
        <div
          className={`h-full overflow-x-hidden ${needsScroll ? "editor-scroll overflow-y-auto" : "overflow-y-hidden"}`}
          style={{
            paddingLeft: inventoryLayout.paddingX,
            paddingRight: inventoryLayout.paddingX,
            paddingTop: inventoryLayout.paddingY,
            paddingBottom: inventoryLayout.paddingY,
          }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${INVENTORY_COLS}, ${inventoryLayout.cellSize}px)`,
              gridTemplateRows: `repeat(${totalRows}, ${inventoryLayout.cellSize}px)`,
              gap: inventoryLayout.gap,
              justifyContent: "center",
            }}
          >
            {slots.map((item, index) => (
              <div
                key={item ? item.itemInstanceId : `empty-${index}`}
                data-inventory-item-id={item?.itemInstanceId}
                className="flex items-center justify-center overflow-hidden rounded-lg border-2 border-slate-700 bg-slate-950 shadow-inner"
                style={{
                  width: inventoryLayout.cellSize,
                  height: inventoryLayout.cellSize,
                }}
                onPointerEnter={() => {
                  if (item && pressedItem && pressedItem.itemInstanceId !== item.itemInstanceId) {
                    setHoveredTargetItemId(item.itemInstanceId);
                  }
                }}
                onPointerMove={() => {
                  if (item && pressedItem && pressedItem.itemInstanceId !== item.itemInstanceId) {
                    setHoveredTargetItemId(item.itemInstanceId);
                  }
                }}
                onPointerLeave={() => {
                  if (item && hoveredTargetItemId === item.itemInstanceId) {
                    setHoveredTargetItemId(null);
                  }
                }}
              >
                {item ? (
                  <button
                    type="button"
                    draggable={false}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                      setPressedItem(item);
                      setHoveredTargetItemId(null);
                      setCursorPos({
                        visible: true,
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                    className={`flex h-full w-full items-center justify-center rounded-md ${pressedItem?.itemInstanceId === item.itemInstanceId
                        ? "bg-white/10 ring-2 ring-amber-400/70"
                        : hoveredTargetItemId === item.itemInstanceId
                          ? "bg-amber-300/10 ring-2 ring-amber-300/80"
                          : "hover:bg-slate-800"
                      }`}
                    style={{ cursor: "none" }}
                  >
                    <img
                      src={item.imageSrc}
                      alt={item.name}
                      className="h-full w-full select-none object-contain"
                      draggable={false}
                    />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <InventoryCursor
        visible={cursorPos.visible}
        src={overlayCursorSrc}
        dragging={isDraggingItem}
        position={cursorPos}
        size={draggedCursorSize}
      />
    </div>
  );
}