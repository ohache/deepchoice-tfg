import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { RegionShape } from "@/domain/types";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";

type DragState =
  | { kind: "dragging";
      start: { x: number; y: number };
      current: { x: number; y: number };
      pointerId: number; }
  | { kind: "idle" };

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

export type UseRegionShapeRectDrawingOptions = {
  contentRect: Rect | null;
  enabled: boolean;
  minPx?: number;
  toContainerPx: (p: { x: number; y: number }) => { x: number; y: number } | null;
  onCommit: (shape: RegionShape) => void;
  resetKey?: unknown;
};

/* Hook para dibujar una región rectangular sobre un área visible de contenidon */
export function useRegionShapeRectDrawing({ contentRect, enabled, minPx = 6, toContainerPx, onCommit, resetKey }: UseRegionShapeRectDrawingOptions) {
  const [drag, setDrag] = useState<DragState>({ kind: "idle" });

  const dragRef = useRef<DragState>({ kind: "idle" });

  const lastCaptureElRef = useRef<HTMLElement | null>(null);

  useEffect(() => { dragRef.current = drag; }, [drag]);


  useEffect(() => {
    dragRef.current = { kind: "idle" };
    setDrag({ kind: "idle" });
  }, [resetKey]);

  const resetDrag = useCallback(() => {
    dragRef.current = { kind: "idle" };
    setDrag({ kind: "idle" });
  }, []);

  const releasePointerCaptureSafely = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const element = event.currentTarget as HTMLElement;

      try {
        if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
      } catch { }

      if (lastCaptureElRef.current === element) lastCaptureElRef.current = null;
    }, [],
  );

  /*Comprueba si un punto (en coords del contenedor) cae dentro del contentRect */
  const isInsideContent = useCallback(
    (point: { x: number; y: number }) => {
      if (!contentRect) return false;

      return ( point.x >= contentRect.x && point.x <= contentRect.x + contentRect.w &&
        point.y >= contentRect.y && point.y <= contentRect.y + contentRect.h);
    }, [contentRect],
  );

  /**
   * Limita un punto al área visible real del contenido.
   */
  const clampToContent = useCallback(
    (point: { x: number; y: number }) => {
      if (!contentRect) return point;

      return {
        x: clamp(point.x, contentRect.x, contentRect.x + contentRect.w),
        y: clamp(point.y, contentRect.y, contentRect.y + contentRect.h),
      };
    },
    [contentRect],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || !contentRect) return;

      const point = toContainerPx({ x: event.clientX, y: event.clientY });
      if (!point || !isInsideContent(point)) return;

      const element = event.currentTarget as HTMLElement;

      try {
        element.setPointerCapture(event.pointerId);
        lastCaptureElRef.current = element;
      } catch { }

      const start = clampToContent(point);

      const nextDrag: DragState = {
        kind: "dragging",
        start,
        current: start,
        pointerId: event.pointerId,
      };

      dragRef.current = nextDrag;
      setDrag(nextDrag);
    },
    [enabled, contentRect, toContainerPx, isInsideContent, clampToContent],
  );

  /* Actualiza el drag actual si corresponde al mismo pointer */
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || !contentRect) return;

      const point = toContainerPx({ x: event.clientX, y: event.clientY });
      if (!point) return;

      setDrag((prev) => {
        if (prev.kind !== "dragging") return prev;
        if (prev.pointerId !== event.pointerId) return prev;

        const next: DragState = {
          ...prev,
          current: clampToContent(point),
        };

        dragRef.current = next;
        return next;
      });
    },
    [enabled, contentRect, toContainerPx, clampToContent],
  );

  /* Finaliza el drag */
  const finish = useCallback(() => {
    if (!enabled || !contentRect) return;

    const currentDrag = dragRef.current;
    if (currentDrag.kind !== "dragging") return;

    const rect = rectFromTwoPoints(currentDrag.start, currentDrag.current);

    resetDrag();

    if (rect.width < minPx || rect.height < minPx) return;

    const shape: RegionShape = {
      type: "rect",
      x: (rect.left - contentRect.x) / contentRect.w,
      y: (rect.top - contentRect.y) / contentRect.h,
      w: rect.width / contentRect.w,
      h: rect.height / contentRect.h,
    };

    onCommit(shape);
  }, [enabled, contentRect, minPx, onCommit, resetDrag]);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      finish();
      releasePointerCaptureSafely(event);
    }, [finish, releasePointerCaptureSafely],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      resetDrag();
      releasePointerCaptureSafely(event);
    }, [resetDrag, releasePointerCaptureSafely],
  );

  /* Estilo temporal del rectángulo mientras se arrastra */
  const tempRectStyle = useMemo<CSSProperties | null>(() => {
    if (drag.kind !== "dragging" || !contentRect) return null;

    const rect = rectFromTwoPoints(drag.start, drag.current);

    return { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` };
  }, [drag, contentRect]);

  return { drag, isDragging: drag.kind === "dragging", tempRectStyle, bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel }};
}