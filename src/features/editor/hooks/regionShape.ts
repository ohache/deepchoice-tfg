import type { CSSProperties } from "react";
import type { RegionShape } from "@/domain/types";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";

export function rectStyleFromShape(shape: RegionShape | null | undefined, contentRectInContainer: Rect | null): CSSProperties | null {
  if (!contentRectInContainer) return null;
  if (!shape || shape.type !== "rect") return null;

  const left = contentRectInContainer.x + shape.x * contentRectInContainer.w;
  const top = contentRectInContainer.y + shape.y * contentRectInContainer.h;
  const width = shape.w * contentRectInContainer.w;
  const height = shape.h * contentRectInContainer.h;

  return { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` };
}

export function isValidRect01(shape: RegionShape | null | undefined, opts?: { min?: number }) {
  if (!shape || shape.type !== "rect") return false;

  const { x, y, w, h } = shape;
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return false;

  if (x < 0 || y < 0 || w <= 0 || h <= 0) return false;
  if (x + w > 1 || y + h > 1) return false;

  const MIN = opts?.min ?? 0.02;
  if (w < MIN || h < MIN) return false;

  return true;
}

export function rect01Intersects(a: RegionShape, b: RegionShape): boolean {
  if (a.type !== "rect" || b.type !== "rect") return false;

  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;

  return a.x < bx2 && ax2 > b.x && a.y < by2 && ay2 > b.y;
}
