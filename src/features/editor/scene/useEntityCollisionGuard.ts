import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RegionShape } from "@/domain/types";
import { DEFAULT_MIN_RECT_01, isValidRect01 } from "@/features/editor/hooks/regionShape";
import { formatCollisionSummary, validateNoCollisions01Rect, type ClickableRegion, type IgnoreSelf } from "@/features/editor/scene/clickableCollisions";

type UseEntityCollisionGuardArgs = {
  shape: RegionShape | null | undefined;
  clickableRegions: readonly ClickableRegion[];
  ignore?: IgnoreSelf;
  enabled?: boolean;
  isDrawing?: boolean;
  minRect?: number;
  resetKey?: string | number | null;
  onRejectShape?: () => void;
  onCollision?: (summary: string) => void;
};

type CollisionLockState = {
  active: boolean;
  summary: string;
};

function shapeKey(shape: RegionShape | null | undefined): string {
  if (!shape) return "none";

  if (shape.type === "rect") return `rect:${shape.x}:${shape.y}:${shape.w}:${shape.h}`;

  return shape.type;

}

/* Hook para vigilar colisiones de una shape editable contra regiones clicables */
export function useEntityCollisionGuard({ shape, clickableRegions, ignore, enabled = true, isDrawing = false, minRect = DEFAULT_MIN_RECT_01,
  resetKey, onRejectShape, onCollision }: UseEntityCollisionGuardArgs) {
  const hasShape = isValidRect01(shape, { min: minRect });

  const collisionCheck = useMemo(() => {
    if (!enabled || !shape || !hasShape) return { ok: true as const };

    return validateNoCollisions01Rect(shape, clickableRegions, { ignore, minRect });
  }, [enabled, shape, hasShape, clickableRegions, ignore, minRect]);

  const hasCollisions = !collisionCheck.ok;
  const collisionSummary = hasCollisions ? formatCollisionSummary(collisionCheck.collisions, 2) : "";

  const [collisionLock, setCollisionLock] = useState<CollisionLockState>({ active: false, summary: "" });

  const lastRejectedShapeKeyRef = useRef("");

  const resetCollisionGuard = useCallback(() => {
    setCollisionLock({ active: false, summary: "" });
    lastRejectedShapeKeyRef.current = "";
  }, []);

  useEffect(() => { resetCollisionGuard(); }, [resetKey, resetCollisionGuard]);

  useEffect(() => {
    if (!enabled) return;
    if (!shape || !hasShape) return;
    if (!hasCollisions) return;
    if (isDrawing) return;

    const key = shapeKey(shape);
    if (lastRejectedShapeKeyRef.current === key) return;

    lastRejectedShapeKeyRef.current = key;
    setCollisionLock({ active: true, summary: collisionSummary });

    onRejectShape?.();
    onCollision?.(collisionSummary);
  }, [enabled, shape, hasShape, hasCollisions, isDrawing, collisionSummary, onRejectShape, onCollision]);

  useEffect(() => {
    if (!collisionLock.active) return;

    if (!enabled) {
      setCollisionLock({ active: false, summary: "" });
      return;
    }

    if (hasShape && !hasCollisions) setCollisionLock({ active: false, summary: "" });
  }, [collisionLock.active, enabled, hasShape, hasCollisions]);

  return { hasShape, collisionCheck, hasCollisions, collisionSummary, collisionLock, resetCollisionGuard };
}