import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent as ReactDragEvent, PointerEvent, MouseEvent } from "react";
import type { RegionShape } from "@/domain/types";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";
import { DEFAULT_MIN_RECT_01, isValidRect01 } from "@/features/editor/hooks/regionShape";

type DragState =
  | {
    kind: "dragging";
    start: { x: number; y: number };
    current: { x: number; y: number };
    pointerId: number;
  }
  | { kind: "idle" };

type CapturedPointer = {
  element: HTMLElement;
  pointerId: number;
};

const PRIMARY_POINTER_BUTTON = 0;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rectFromTwoPoints(a: { x: number; y: number }, b: { x: number; y: number }) {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x, b.x);
  const bottom = Math.max(a.y, b.y);

  return { left, top, width: right - left, height: bottom - top };
}

function stopDrawingEvent(event: PointerEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function isMatchingDragPointer(drag: DragState, pointerId: number): drag is Extract<DragState, { kind: "dragging" }> {
  return drag.kind === "dragging" && drag.pointerId === pointerId;
}

export type UseRegionShapeRectDrawingOptions = {
  contentRect: Rect | null;
  enabled: boolean;
  minPx?: number;
  minRect01?: number;
  toContainerPx: (p: { x: number; y: number }) => { x: number; y: number } | null;
  onCommit: (shape: RegionShape) => void;
  onRejectInvalidShape?: () => void;
  resetKey?: unknown;
};

/* Hook para dibujar una región rectangular sobre el área visible real del contenido */
export function useRegionShapeRectDrawing({ contentRect, enabled, minPx = 6, minRect01 = DEFAULT_MIN_RECT_01, toContainerPx,
  onCommit, onRejectInvalidShape, resetKey }: UseRegionShapeRectDrawingOptions) {
  const [drag, setDrag] = useState<DragState>({ kind: "idle" });

  const dragRef = useRef<DragState>({ kind: "idle" });
  const capturedPointerRef = useRef<CapturedPointer | null>(null);

  useEffect(() => { dragRef.current = drag }, [drag]);

  const releasePointerCaptureSafely = useCallback(() => {
    const captured = capturedPointerRef.current;
    if (!captured) return;

    try {
      if (captured.element.hasPointerCapture(captured.pointerId)) captured.element.releasePointerCapture(captured.pointerId);
    } catch { }

    capturedPointerRef.current = null;
  }, []);

  const resetDrag = useCallback(() => {
    releasePointerCaptureSafely();
    dragRef.current = { kind: "idle" };
    setDrag({ kind: "idle" });
  }, [releasePointerCaptureSafely]);

  useEffect(() => resetDrag(), [resetKey, resetDrag]);

  useEffect(() => {
    if (enabled) return;
    resetDrag();
  }, [enabled, resetDrag]);

  /* Comprueba si un punto en coords del contenedor cae dentro del contentRect */
  const isInsideContent = useCallback((point: { x: number; y: number }) => {
    if (!contentRect) return false;

    return (point.x >= contentRect.x && point.x <= contentRect.x + contentRect.w && point.y >= contentRect.y && point.y <= contentRect.y + contentRect.h);
  }, [contentRect]);

  /* Limita un punto al área visible real del contenido */
  const clampToContent = useCallback((point: { x: number; y: number }) => {
    if (!contentRect) return point;

    return { x: clamp(point.x, contentRect.x, contentRect.x + contentRect.w), y: clamp(point.y, contentRect.y, contentRect.y + contentRect.h) };
  }, [contentRect]);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!enabled || !contentRect) return;
    if (event.button !== PRIMARY_POINTER_BUTTON) return;

    const point = toContainerPx({ x: event.clientX, y: event.clientY });
    if (!point || !isInsideContent(point)) return;

    stopDrawingEvent(event);

    const element = event.currentTarget as HTMLElement;

    try {
      element.setPointerCapture(event.pointerId);
      capturedPointerRef.current = { element, pointerId: event.pointerId };
    } catch {
      capturedPointerRef.current = null;
    }

    const start = clampToContent(point);

    const nextDrag: DragState = { kind: "dragging", start, current: start, pointerId: event.pointerId };

    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }, [enabled, contentRect, toContainerPx, isInsideContent, clampToContent],
  );

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!enabled || !contentRect) return;

    const currentDrag = dragRef.current;
    if (!isMatchingDragPointer(currentDrag, event.pointerId)) return;

    const point = toContainerPx({ x: event.clientX, y: event.clientY });
    if (!point) return;

    stopDrawingEvent(event);

    const next: DragState = { ...currentDrag, current: clampToContent(point) };

    dragRef.current = next;
    setDrag(next);
  }, [enabled, contentRect, toContainerPx, clampToContent]);

  const finish = useCallback((pointerId: number) => {
    if (!enabled || !contentRect) {
      resetDrag();
      return;
    }

    const currentDrag = dragRef.current;
    if (!isMatchingDragPointer(currentDrag, pointerId)) return;

    const rect = rectFromTwoPoints(currentDrag.start, currentDrag.current);

    resetDrag();

    if (rect.width < minPx || rect.height < minPx) {
      onRejectInvalidShape?.();
      return;
    }

    const shape: RegionShape = {
      type: "rect",
      x: (rect.left - contentRect.x) / contentRect.w,
      y: (rect.top - contentRect.y) / contentRect.h,
      w: rect.width / contentRect.w,
      h: rect.height / contentRect.h,
    };

    if (!isValidRect01(shape, { min: minRect01 })) {
      onRejectInvalidShape?.();
      return;
    }

    onCommit(shape);
  }, [enabled, contentRect, minPx, minRect01, onCommit, onRejectInvalidShape, resetDrag]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!enabled) return;
    if (!isMatchingDragPointer(dragRef.current, event.pointerId)) return;

    stopDrawingEvent(event);
    finish(event.pointerId);
  }, [enabled, finish]);

  const onPointerCancel = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      if (!isMatchingDragPointer(dragRef.current, event.pointerId)) return;

      stopDrawingEvent(event);
      resetDrag();
    }, [enabled, resetDrag]);

  const onLostPointerCapture = useCallback(() => capturedPointerRef.current = null, []);

  const onDragStart = useCallback((event: ReactDragEvent<HTMLElement>) => {
    if (!enabled) return;

    event.preventDefault();
    event.stopPropagation();
  }, [enabled]);

  const onContextMenu = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!enabled) return;

    event.preventDefault();
    event.stopPropagation();
  }, [enabled]);

  /* Estilo temporal del rectángulo mientras se arrastra */
  const tempRectStyle = useMemo<CSSProperties | null>(() => {
    if (drag.kind !== "dragging" || !contentRect) return null;

    const rect = rectFromTwoPoints(drag.start, drag.current);

    return { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` };
  }, [drag, contentRect]);

  return {
    drag, isDragging: drag.kind === "dragging", tempRectStyle,
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onDragStart, onContextMenu, draggable: false }
  };
}