import { useEffect, useMemo, useRef, useState } from "react";
import type { RegionShape } from "@/domain/types";
import { isValidRect01 } from "@/features/editor/hooks/regionShape";
import { formatCollisionSummary, validateNoCollisions01Rect, type ClickableRegion } from "@/features/editor/scene/clickableCollisions";

type CollisionIgnoreTarget =
  | { kind: "hotspot"; id: string }
  | { kind: "item"; id: string }
  | { kind: "npc"; id: string }
  | { kind: "player"; id: string };

type UseEntityCollisionGuardArgs = {
  shape: RegionShape | null | undefined;
  clickableRegions: ClickableRegion[];
  ignore?: CollisionIgnoreTarget;
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

function shapeKey(shape: unknown): string {
  try { return JSON.stringify(shape ?? null);}
  catch { return String(shape ?? ""); }
}

export function useEntityCollisionGuard({ shape, clickableRegions, ignore, enabled = true, isDrawing = false, minRect = 0.02, resetKey, onRejectShape, onCollision }: UseEntityCollisionGuardArgs) {
  const hasShape = isValidRect01(shape, { min: minRect });

  const collisionCheck = useMemo(() => {
    if (!enabled || !shape || !hasShape) return { ok: true as const };

    return validateNoCollisions01Rect(shape, clickableRegions, { ignore, minRect });
  }, [enabled, shape, hasShape, clickableRegions, ignore, minRect]);

  const hasCollisions = !collisionCheck.ok;
  const collisionSummary = hasCollisions ? formatCollisionSummary(collisionCheck.collisions, 2) : "";

  const [collisionLock, setCollisionLock] = useState<CollisionLockState>({ active: false, summary: "" });

  const lastRejectedShapeKeyRef = useRef<string>("");

  useEffect(() => {
  setCollisionLock({ active: false, summary: "" });
  lastRejectedShapeKeyRef.current = "";
}, [resetKey]);

  useEffect(() => {
    if (!enabled) return;
    if (!shape || !hasShape || !hasCollisions || isDrawing) return;

    const key = shapeKey(shape);
    if (lastRejectedShapeKeyRef.current === key) return;
    lastRejectedShapeKeyRef.current = key;

    setCollisionLock({ active: true, summary: collisionSummary });

    onRejectShape?.();
    onCollision?.(collisionSummary);
  }, [ enabled, shape, hasShape, hasCollisions, isDrawing, collisionSummary, onRejectShape, onCollision ]);

  useEffect(() => {
    if (!collisionLock.active) return;
    if (!hasShape) return;
    if (hasCollisions) return;

    setCollisionLock({ active: false, summary: "" });
  }, [collisionLock.active, hasShape, hasCollisions]);

  const resetCollisionGuard = () => {
    setCollisionLock({ active: false, summary: "" });
    lastRejectedShapeKeyRef.current = "";
  };

  return { hasShape, collisionCheck, hasCollisions, collisionSummary, collisionLock, resetCollisionGuard };
}