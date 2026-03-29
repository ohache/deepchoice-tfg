import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { RegionShape } from "@/domain/types";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";

type DragState =
  | {
      kind: "dragging";
      start: { x: number; y: number };
      current: { x: number; y: number };
      pointerId: number;
    }
  | { kind: "idle" };

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
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

export function useRegionShapeRectDrawing({ contentRect, enabled, minPx = 6, toContainerPx, onCommit, resetKey }: UseRegionShapeRectDrawingOptions) {
  const [drag, setDrag] = useState<DragState>({ kind: "idle" });
  const lastCaptureElRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState>({ kind: "idle" });

  useEffect(() => {dragRef.current = drag;}, [drag]);

  useEffect(() => {
    setDrag({ kind: "idle" });
    dragRef.current = { kind: "idle" };
  }, [resetKey]);

  const isInsideContent = useCallback(
    (p: { x: number; y: number }) => {
      if (!contentRect) return false;
      return (
        p.x >= contentRect.x &&
        p.x <= contentRect.x + contentRect.w &&
        p.y >= contentRect.y &&
        p.y <= contentRect.y + contentRect.h
      );
    },
    [contentRect],
  );

  const clampToContent = useCallback(
    (p: { x: number; y: number }) => {
      if (!contentRect) return p;
      return {
        x: clamp(p.x, contentRect.x, contentRect.x + contentRect.w),
        y: clamp(p.y, contentRect.y, contentRect.y + contentRect.h),
      };
    }, [contentRect],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !contentRect) return;

      const p = toContainerPx({ x: e.clientX, y: e.clientY });
      if (!p || !isInsideContent(p)) return;

      const el = e.currentTarget as HTMLElement;
      try {
        el.setPointerCapture(e.pointerId);
        lastCaptureElRef.current = el;
      } catch {}

      const start = clampToContent(p);
      const nextDrag: DragState = { kind: "dragging", start, current: start, pointerId: e.pointerId };

      dragRef.current = nextDrag;
      setDrag(nextDrag);
    }, [enabled, contentRect, toContainerPx, isInsideContent, clampToContent],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !contentRect) return;

      const p = toContainerPx({ x: e.clientX, y: e.clientY });
      if (!p) return;

      setDrag((prev) => {
        if (prev.kind !== "dragging") return prev;
        if (prev.pointerId !== e.pointerId) return prev;

        const next = { ...prev, current: clampToContent(p) };
        dragRef.current = next;
        return next;
      });
    }, [enabled, contentRect, toContainerPx, clampToContent],
  );

  const finish = useCallback(() => {
    if (!enabled || !contentRect) return;

    const currentDrag = dragRef.current;
    if (currentDrag.kind !== "dragging") return;

    const r = rectFromTwoPoints(currentDrag.start, currentDrag.current);

    dragRef.current = { kind: "idle" };
    setDrag({ kind: "idle" });

    if (r.width < minPx || r.height < minPx) return;

    const shape: RegionShape = {
      type: "rect",
      x: (r.left - contentRect.x) / contentRect.w,
      y: (r.top - contentRect.y) / contentRect.h,
      w: r.width / contentRect.w,
      h: r.height / contentRect.h,
    };

    onCommit(shape);
  }, [enabled, contentRect, minPx, onCommit]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      finish();

      const el = e.currentTarget as HTMLElement;
      try {
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      } catch {}
      if (lastCaptureElRef.current === el) lastCaptureElRef.current = null;
    },
    [finish],
  );

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    dragRef.current = { kind: "idle" };
    setDrag({ kind: "idle" });

    const el = e.currentTarget as HTMLElement;
    try {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    } catch {}
    if (lastCaptureElRef.current === el) lastCaptureElRef.current = null;
  }, []);

  const tempRectStyle = useMemo(() => {
    if (drag.kind !== "dragging" || !contentRect) return null;

    const r = rectFromTwoPoints(drag.start, drag.current);
    return {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    } as React.CSSProperties;
  }, [drag, contentRect]);

  return { drag, isDragging: drag.kind === "dragging", tempRectStyle, bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } };
}