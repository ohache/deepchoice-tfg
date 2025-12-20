import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";

export type Rect01 = { type: "rect"; x: number; y: number; w: number; h: number };

type DragState =
  | {
      kind: "dragging";
      startViewportPx: { x: number; y: number };
      currentViewportPx: { x: number; y: number };
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

export type UseRectDragOnContainedImageOptions = {
  containerRef: React.RefObject<HTMLElement | null>;
  contentRect: Rect | null;
  enabled: boolean;
  minPx?: number;

  onCommit: (shape: Rect01) => void;
  resetKey?: unknown;
};

export function useRectDragOnContainedImage({ containerRef, contentRect, enabled, minPx = 6, onCommit, resetKey }: UseRectDragOnContainedImageOptions) {
  const [drag, setDrag] = useState<DragState>({ kind: "idle" });

  useEffect(() => {
    setDrag({ kind: "idle" });
  }, [resetKey]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      if (!contentRect) return;

      const px = e.clientX;
      const py = e.clientY;

      if (px < contentRect.x || px > contentRect.x + contentRect.w || py < contentRect.y || py > contentRect.y + contentRect.h ) return;

      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      setDrag((prev) => {
        if (prev.kind === "dragging" && prev.pointerId === e.pointerId) return prev;
        return {
          kind: "dragging",
          startViewportPx: { x: px, y: py },
          currentViewportPx: { x: px, y: py },
          pointerId: e.pointerId,
        };
      });
    },
    [enabled, contentRect]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      if (!contentRect) return;

      setDrag((prev) => {
        if (prev.kind !== "dragging") return prev;
        if (prev.pointerId !== e.pointerId) return prev;

        const px = clamp(e.clientX, contentRect.x, contentRect.x + contentRect.w);
        const py = clamp(e.clientY, contentRect.y, contentRect.y + contentRect.h);

        return { ...prev, currentViewportPx: { x: px, y: py } };
      });
    },
    [enabled, contentRect]
  );

  const finish = useCallback(() => {
    if (!enabled) return;
    if (!contentRect) return;

    setDrag((prev) => {
      if (prev.kind !== "dragging") return prev;

      const x1 = clamp(prev.startViewportPx.x, contentRect.x, contentRect.x + contentRect.w);
      const y1 = clamp(prev.startViewportPx.y, contentRect.y, contentRect.y + contentRect.h);
      const x2 = clamp(prev.currentViewportPx.x, contentRect.x, contentRect.x + contentRect.w);
      const y2 = clamp(prev.currentViewportPx.y, contentRect.y, contentRect.y + contentRect.h);

      const r = rectFromTwoPoints({ x: x1, y: y1 }, { x: x2, y: y2 });

      if (r.width < minPx || r.height < minPx) {
        return { kind: "idle" };
      }

      const shape: Rect01 = {
        type: "rect",
        x: (r.left - contentRect.x) / contentRect.w,
        y: (r.top - contentRect.y) / contentRect.h,
        w: r.width / contentRect.w,
        h: r.height / contentRect.h,
      };

      onCommit(shape);
      return { kind: "idle" };
    });
  }, [enabled, contentRect, minPx, onCommit]);

  const onPointerUp = useCallback(
    (_e: React.PointerEvent) => {
      if (drag.kind !== "dragging") return;
      finish();
    },
    [drag.kind, finish]
  );

  const onPointerCancel = useCallback(() => {
    setDrag({ kind: "idle" });
  }, []);

  const tempRectStyle = useMemo(() => {
    if (drag.kind !== "dragging") return null;
    if (!contentRect) return null;

    const container = containerRef.current;
    if (!container) return null;

    const box = container.getBoundingClientRect();
    const r = rectFromTwoPoints(drag.startViewportPx, drag.currentViewportPx);

    return {
      left: `${r.left - box.left}px`,
      top: `${r.top - box.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    } as React.CSSProperties;
  }, [drag, contentRect, containerRef]);

  const isDragging = drag.kind === "dragging";

  return { drag, isDragging, tempRectStyle,
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
