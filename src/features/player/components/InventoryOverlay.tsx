import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ID } from "@/domain/types";
import { iconForInteractionKind } from "@/features/player/components/interactionCursors";
import { PLAYER_CURSOR_DEFAULT_SIZE, PLAYER_ITEM_CURSOR_FALLBACK_SIZE, type CursorSize } from "@/features/player/hooks/usePlayerCursor";

export type InventoryItemView = {
  itemInstanceId: ID;
  itemId: ID;
  name: string;
  imageSrc: string;
  cursorSize: CursorSize;
};

type InventoryOverlayProps = {
  open: boolean;
  items: InventoryItemView[];
  initialCursorPosition?: CursorPoint | null;
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

const INVENTORY_TARGET_HALO_CLASS = "bg-amber-300/15 ring-2 ring-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.35),0_0_26px_rgba(251,191,36,0.65)] scale-[1.04]";

type CursorPosition = { visible: boolean; x: number; y: number };
type CursorPoint = { x: number; y: number };
type ViewportSize = { width: number; height: number };

const INITIAL_CURSOR_POSITION: CursorPosition = { visible: false, x: 0, y: 0 };

function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => ({ width: window.innerWidth, height: window.innerHeight }));

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

/* Rellena el inventario con slots vacíos hasta completar una cuadrícula estable */
function buildInventorySlots(items: InventoryItemView[]) {
  const totalRows = Math.max(INVENTORY_VISIBLE_ROWS, Math.ceil(items.length / INVENTORY_COLS));
  const totalSlots = totalRows * INVENTORY_COLS;

  return { totalRows, slots: Array.from({ length: totalSlots }, (_, index) => items[index] ?? null) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/* Calcula el tamaño del panel y de cada celda en función del viewport */
function buildInventoryLayout(viewport: ViewportSize, visibleRows: number) {
  const maxPanelWidth = viewport.width * PANEL_MAX_WIDTH_RATIO;
  const maxPanelHeight = viewport.height * PANEL_MAX_HEIGHT_RATIO;

  const cellFromWidth = (maxPanelWidth - PANEL_PADDING_X * 2 - CELL_GAP * (INVENTORY_COLS - 1)) / INVENTORY_COLS;

  const cellFromHeight = (maxPanelHeight - PANEL_PADDING_Y * 2 - CELL_GAP * (visibleRows - 1)) / visibleRows;

  const cellSize = Math.floor(clamp(Math.min(cellFromWidth, cellFromHeight), MIN_CELL_SIZE, MAX_CELL_SIZE));

  const panelWidth = INVENTORY_COLS * cellSize + CELL_GAP * (INVENTORY_COLS - 1) + PANEL_PADDING_X * 2;

  const panelHeight = visibleRows * cellSize + CELL_GAP * (visibleRows - 1) + PANEL_PADDING_Y * 2;

  return {
    cellSize, panelWidth, panelHeight, gap: CELL_GAP, paddingX: PANEL_PADDING_X, paddingY: PANEL_PADDING_Y,
  };
}

function areCursorPositionsEqual(a: CursorPosition, b: CursorPosition): boolean {
  return a.visible === b.visible && a.x === b.x && a.y === b.y;
}

function InventoryCursor(props: { visible: boolean; src: string; dragging: boolean; position: CursorPosition; size: CursorSize }) {
  const { visible, src, dragging, position, size } = props;

  if (!visible) return null;

  const cursorSize = dragging ? size : PLAYER_CURSOR_DEFAULT_SIZE;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="pointer-events-none fixed z-60 object-contain select-none"
      style={{
        left: 0,
        top: 0,
        width: cursorSize.width,
        height: cursorSize.height,
        transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
        willChange: "transform",
      }}
    />
  );
}

/* Busca si el puntero se ha soltado encima de un item del inventario */
function findInventoryItemIdFromPoint(x: number, y: number): ID | null {
  const element = document.elementFromPoint(x, y);
  const target = element?.closest<HTMLElement>("[data-inventory-item-id]");

  return target?.dataset.inventoryItemId ?? null;
}

function findInventoryTargetItemFromPoint(x: number, y: number, pressedItem: InventoryItemView | null, items: InventoryItemView[]): InventoryItemView | null {
  if (!pressedItem) return null;

  const targetId = findInventoryItemIdFromPoint(x, y);

  if (!targetId || targetId === pressedItem.itemInstanceId) return null;

  return items.find((item) => item.itemInstanceId === targetId) ?? null;
}

function isInventoryUseTarget(item: InventoryItemView | null, pressedItem: InventoryItemView | null, hoveredTargetItemId: ID | null): boolean {
  return Boolean(item && pressedItem && item.itemInstanceId !== pressedItem.itemInstanceId && hoveredTargetItemId === item.itemInstanceId);
}

export function InventoryOverlay({ open, items, initialCursorPosition = null, onClose, onSelectItem, onUseItemOnInventoryItem }: InventoryOverlayProps) {
  const [visible, setVisible] = useState(open);
  const [cursorPos, setCursorPos] = useState<CursorPosition>(INITIAL_CURSOR_POSITION);
  const [pressedItem, setPressedItem] = useState<InventoryItemView | null>(null);
  const [hoveredTargetItemId, setHoveredTargetItemId] = useState<ID | null>(null);

  const cursorPosRef = useRef<CursorPosition>(INITIAL_CURSOR_POSITION);
  const pendingCursorPosRef = useRef<CursorPosition | null>(null);
  const cursorFrameRef = useRef<number | null>(null);

  const viewport = useViewportSize();
  const { totalRows, slots } = useMemo(() => buildInventorySlots(items), [items]);

  const visibleRows = Math.min(totalRows, 4);
  const needsScroll = totalRows > visibleRows;

  const inventoryLayout = useMemo(() => buildInventoryLayout(viewport, visibleRows), [viewport, visibleRows]);

  const takeCursorIcon = iconForInteractionKind("take");
  const overlayCursorSrc = pressedItem?.imageSrc ?? takeCursorIcon;
  const isDraggingItem = pressedItem !== null;
  const draggedCursorSize = pressedItem?.cursorSize ?? PLAYER_ITEM_CURSOR_FALLBACK_SIZE;

  const applyCursorPosition = useCallback((next: CursorPosition) => {
    if (areCursorPositionsEqual(cursorPosRef.current, next)) return;

    cursorPosRef.current = next;
    setCursorPos(next);
  }, []);

  const scheduleCursorPosition = useCallback(
    (next: CursorPosition) => {
      pendingCursorPosRef.current = next;

      if (cursorFrameRef.current !== null) return;

      cursorFrameRef.current = window.requestAnimationFrame(() => {
        cursorFrameRef.current = null;

        const pending = pendingCursorPosRef.current;
        pendingCursorPosRef.current = null;

        if (pending) applyCursorPosition(pending);
      });
    },
    [applyCursorPosition],
  );

  const hideCursor = useCallback(() => {
    pendingCursorPosRef.current = null;

    if (cursorFrameRef.current !== null) {
      window.cancelAnimationFrame(cursorFrameRef.current);
      cursorFrameRef.current = null;
    }

    applyCursorPosition({ ...cursorPosRef.current, visible: false });
  }, [applyCursorPosition]);

  const setHoveredTargetIfChanged = useCallback((nextId: ID | null) => {
    setHoveredTargetItemId((prev) => (prev === nextId ? prev : nextId));
  }, []);

  useEffect(() => {
    if (open) {
      setVisible(true);

      if (initialCursorPosition) {
        applyCursorPosition({
          visible: true,
          x: initialCursorPosition.x,
          y: initialCursorPosition.y,
        });
      }

      return;
    }

    const timer = window.setTimeout(() => setVisible(false), CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open, initialCursorPosition?.x, initialCursorPosition?.y, applyCursorPosition]);

  const updateHoveredTargetFromPointer = useCallback((x: number, y: number) => {
    const targetItem = findInventoryTargetItemFromPoint(x, y, pressedItem, items);

    setHoveredTargetIfChanged(targetItem?.itemInstanceId ?? null);
  },
  [pressedItem, items, setHoveredTargetIfChanged],
);

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

      const targetItem = droppedTargetId && droppedTargetId !== pressedItem.itemInstanceId ? items.find((item) => item.itemInstanceId === droppedTargetId) ?? null : null;

      if (targetItem) onUseItemOnInventoryItem(pressedItem, targetItem);
      else onSelectItem(pressedItem);

      onClose();
      setPressedItem(null);
      setHoveredTargetItemId(null);
    };

    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [open, pressedItem, items, onSelectItem, onUseItemOnInventoryItem, onClose]);

  useEffect(() => {
    if (open) return;

    setPressedItem(null);
    setHoveredTargetItemId(null);
    hideCursor();
  }, [open, hideCursor]);

  useEffect(() => {
    return () => {
      if (cursorFrameRef.current !== null) {
        window.cancelAnimationFrame(cursorFrameRef.current);
        cursorFrameRef.current = null;
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
      onClick={() => { if (!pressedItem) onClose() }}
      onPointerMove={(event) => {
        scheduleCursorPosition({ visible: true, x: event.clientX, y: event.clientY });

        if (pressedItem) updateHoveredTargetFromPointer(event.clientX, event.clientY);
      }}
      onPointerEnter={(event) => {
        applyCursorPosition({ visible: true, x: event.clientX, y: event.clientY });

        if (pressedItem) updateHoveredTargetFromPointer(event.clientX, event.clientY);
      }}
      onPointerLeave={() => {
        hideCursor();
        setHoveredTargetItemId(null);
      }}
      style={{ cursor: "none", touchAction: "none" }}
    >
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
            {slots.map((item, index) => {
              const isUseTarget = isInventoryUseTarget(item, pressedItem, hoveredTargetItemId);

              return (
                <div
                  key={item ? item.itemInstanceId : `empty-${index}`}
                  data-inventory-item-id={item?.itemInstanceId}
                  className="flex items-center justify-center overflow-hidden rounded-lg border-2 border-slate-700 bg-slate-950 shadow-inner"
                  style={{
                    width: inventoryLayout.cellSize,
                    height: inventoryLayout.cellSize,
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
                        applyCursorPosition({ visible: true, x: event.clientX, y: event.clientY });
                      }}
                      className={`flex h-full w-full items-center justify-center rounded-md transition-all duration-150 ${pressedItem?.itemInstanceId === item.itemInstanceId
                          ? "bg-white/10 ring-2 ring-amber-400/70 opacity-70" : isUseTarget ? INVENTORY_TARGET_HALO_CLASS : "hover:bg-slate-800"}`}
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
              );
            })}
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