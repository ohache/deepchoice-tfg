import type { NodeLayout } from "@/domain/types";
import { GRID_TILE_SIZE, NODE_SIZE, NODE_SLOT_OFFSET, type TileCell } from "@/features/editor/history/view/historyViewTypes";

export type WorldRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

/* Configuración visual/UX del panel */
export const VIEW_CONFIG = {
  paddingPx: 80,
  gridInsetPx: 1,
  autoScroll: { marginPx: 25, speedPx: 10 },
  dragStartThresholdPx: 4,
  selectBoxMinPx: 6,
} as const;

/* Mundo base */
export const MIN_WORLD_X = NODE_SLOT_OFFSET;
export const MIN_WORLD_Y = NODE_SLOT_OFFSET;
export const ORIGIN: NodeLayout = { x: 0, y: 0 };

/* Grid / tiles */
export function getTileCell(p: NodeLayout): TileCell {
  return {
    cx: Math.floor((p.x - NODE_SLOT_OFFSET) / GRID_TILE_SIZE),
    cy: Math.floor((p.y - NODE_SLOT_OFFSET) / GRID_TILE_SIZE),
  };
}

export function shareSameTile(a: NodeLayout, b: NodeLayout) {
  const A = getTileCell(a);
  const B = getTileCell(b);
  return A.cx === B.cx && A.cy === B.cy;
}

/* Snap final al slot más cercano (para "soltar") */
export function snapToNodeSlotNearest(p: NodeLayout): NodeLayout {
  const tx = Math.round((p.x - NODE_SLOT_OFFSET) / GRID_TILE_SIZE) * GRID_TILE_SIZE + NODE_SLOT_OFFSET;
  const ty = Math.round((p.y - NODE_SLOT_OFFSET) / GRID_TILE_SIZE) * GRID_TILE_SIZE + NODE_SLOT_OFFSET;

  return {
    x: Math.max(MIN_WORLD_X, tx),
    y: Math.max(MIN_WORLD_Y, ty),
  };
}

/* Rects world */
export function nodeRectWorld(p: NodeLayout): WorldRect {
  return { x: p.x, y: p.y, w: NODE_SIZE, h: NODE_SIZE };
}

export function rectsIntersect(a: WorldRect, b: WorldRect) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}