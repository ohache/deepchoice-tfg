import React, { useMemo } from "react";
import type { Hotspot, HotspotShape, ID, PlacedItem, PlacedNpc } from "@/domain/types";

export type ContainedRect = {
  contentViewport: { x: number; y: number; w: number; h: number };
  containerViewport: { x: number; y: number; w: number; h: number };
};

function isRectShape(shape: unknown): shape is Extract<HotspotShape, { type: "rect" }> {
  if (!shape || typeof shape !== "object") return false;
  const s = shape as any;
  return (
    s.type === "rect" &&
    typeof s.x === "number" &&
    typeof s.y === "number" &&
    typeof s.w === "number" &&
    typeof s.h === "number"
  );
}

type ActivePlacement =
  | { kind: "item"; resourceId: ID; instanceId: ID }
  | { kind: "npc"; resourceId: ID; instanceId: ID }
  | null;

export interface SceneHotspotOverlaysProps {
  hotspots: Hotspot[];
  placedItems?: unknown; // ojo: puede venir mal
  placedNpcs?: unknown;

  activeHotspotDrawingId: ID | null;
  activePlacement?: ActivePlacement;

  rect: ContainedRect | null;
  tempRectStyle?: React.CSSProperties | null;
  focusedHotspotId?: ID | null;
}

export function SceneHotspotOverlays({
  hotspots,
  placedItems,
  placedNpcs,
  activeHotspotDrawingId,
  activePlacement = null,
  rect,
  tempRectStyle,
  focusedHotspotId,
}: SceneHotspotOverlaysProps) {
  const safePlacedItems: PlacedItem[] = Array.isArray(placedItems) ? (placedItems as PlacedItem[]) : [];
  const safePlacedNpcs: PlacedNpc[] = Array.isArray(placedNpcs) ? (placedNpcs as PlacedNpc[]) : [];

  const overlays = useMemo(() => {
    if (!rect) return null;

    const { contentViewport, containerViewport } = rect;
    const ox = contentViewport.x - containerViewport.x;
    const oy = contentViewport.y - containerViewport.y;

    const drawRect = (key: string, shape: HotspotShape, classes: string) => {
      const left = ox + shape.x * contentViewport.w;
      const top = oy + shape.y * contentViewport.h;
      const width = shape.w * contentViewport.w;
      const height = shape.h * contentViewport.h;

      return (
        <div
          key={key}
          className={["absolute z-30 rounded-sm pointer-events-none", "transition-opacity", classes].join(" ")}
          style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` }}
          aria-hidden="true"
        />
      );
    };

    const hsRects = hotspots
      .map((hs) => {
        const shape = (hs as any).shape as HotspotShape | undefined;
        if (!isRectShape(shape)) return null;

        const isActive = activeHotspotDrawingId === hs.id || focusedHotspotId === hs.id;

        const classes = isActive
          ? "border-4 border-fuchsia-400 bg-fuchsia-500/15"
          : "border-4 border-sky-300/70 bg-sky-500/10";

        return drawRect(`hs-${hs.id}`, shape, classes);
      })
      .filter(Boolean);

    const itemRects = safePlacedItems
      .map((pi) => {
        if (!isRectShape(pi.shape)) return null;
        const isActive = activePlacement?.kind === "item" && activePlacement.instanceId === pi.id;

        const classes = isActive
          ? "border-4 border-fuchsia-400 bg-fuchsia-500/15"
          : "border-4 border-amber-300/70 bg-amber-500/10";

        return drawRect(`pi-${pi.id}`, pi.shape, classes);
      })
      .filter(Boolean);

    const npcRects = safePlacedNpcs
      .map((pn) => {
        if (!isRectShape(pn.shape)) return null;
        const isActive = activePlacement?.kind === "npc" && activePlacement.instanceId === pn.id;

        const classes = isActive
          ? "border-4 border-fuchsia-400 bg-fuchsia-500/15"
          : "border-4 border-emerald-300/70 bg-emerald-500/10";

        return drawRect(`pn-${pn.id}`, pn.shape, classes);
      })
      .filter(Boolean);

    return (
      <>
        {hsRects}
        {itemRects}
        {npcRects}
      </>
    );
  }, [
    hotspots,
    safePlacedItems,
    safePlacedNpcs,
    activeHotspotDrawingId,
    focusedHotspotId,
    activePlacement,
    rect,
  ]);

  return (
    <>
      {overlays}

      {rect && tempRectStyle ? (
        <div
          className="absolute z-40 border-4 border-fuchsia-300 bg-fuchsia-500/10 rounded-sm pointer-events-none"
          style={tempRectStyle}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
