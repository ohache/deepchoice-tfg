import { useMemo } from "react";
import type { HotspotShape, PlacedItem, Project } from "@/domain/types";
import type { ContainedRect } from "./SceneHotspotOverlays";
import { useEditorStore } from "@/store/editorStore";

function isRectShape(shape: any): shape is Extract<HotspotShape, { type: "rect" }> {
  return shape?.type === "rect"
    && typeof shape.x === "number"
    && typeof shape.y === "number"
    && typeof shape.w === "number"
    && typeof shape.h === "number";
}

const urlCache = new Map<string, string>();

function resolveFromAssetFiles(assetFiles: Record<string, File>, logicalPath: string) {
  if (!logicalPath) return undefined;
  if (/^(https?:|data:|blob:)/.test(logicalPath)) return logicalPath;

  const f = assetFiles[logicalPath];
  if (!f) return undefined;

  const cached = urlCache.get(logicalPath);
  if (cached) return cached;

  const u = URL.createObjectURL(f);
  urlCache.set(logicalPath, u);
  return u;
}

type Props = {
  placedItems: PlacedItem[];
  project: Project | null;
  rect: ContainedRect | null;
};

export function ScenePlacedItemSprites({ placedItems, project, rect }: Props) {
  const assetFiles = useEditorStore((s) => s.assetFiles);

  const sprites = useMemo(() => {
    if (!project || !rect) return null;

    const { contentViewport, containerViewport } = rect;
    const ox = contentViewport.x - containerViewport.x;
    const oy = contentViewport.y - containerViewport.y;

    return placedItems.map((pi) => {
      if (!isRectShape(pi.shape)) return null;

      const def = project.items.find((d) => d.id === pi.itemId);
      const logical = def?.image;
      if (!logical) return null;

      const url = resolveFromAssetFiles(assetFiles, logical);
      if (!url) return null;

      const left = ox + pi.shape.x * contentViewport.w;
      const top = oy + pi.shape.y * contentViewport.h;
      const width = pi.shape.w * contentViewport.w;
      const height = pi.shape.h * contentViewport.h;

      return (
        <img
          key={pi.id}
          src={url}
          alt=""
          aria-hidden="true"
          className="absolute z-30 object-contain pointer-events-none select-none"
          style={{
            left: `${left}px`,
            top: `${top}px`,
            width: `${width}px`,
            height: `${height}px`,
          }}
          draggable={false}
        />
      );
    });
  }, [placedItems, project, rect, assetFiles]);

  return <>{sprites}</>;
}
