import { useEffect, useRef } from "react";
import { MapIcon, UserIcon, CubeIcon } from "@heroicons/react/24/solid";
import { useEditorStore } from "@/store/editorStore";
import type { Hotspot, HotspotShape, ID, PlacedItem, PlacedNpc } from "@/domain/types";

import { useActiveSceneHotspots } from "@/features/editor/hooks/useActiveSceneHotspots";
import { useObjectContainRect } from "@/features/editor/hooks/useObjectContainRect";
import { useRectDragOnContainedImage, type Rect01 } from "@/features/editor/hooks/useHotspotRectDrawing";

import { SceneHotspotOverlays } from "@/features/editor/components/scene/preview/SceneHotspotOverlays";
import { PreviewMusicButton } from "@/features/editor/components/scene/preview/PreviewMusicButton";
import { ScenePlacedItemSprites } from "./preview/ScenePlacedItemSprites";

interface ScenePreviewCardProps {
  title: string;
  text: string;
  imageLogicalPath?: string;

  mapLabel?: string;
  npcLabel?: string;
  itemLabel?: string;
  musicLabel?: string;
  musicUrl?: string;
}

export function ScenePreviewCard({
  title,
  text,
  imageLogicalPath,
  mapLabel,
  npcLabel,
  itemLabel,
  musicLabel,
  musicUrl,
}: ScenePreviewCardProps) {
  const project = useEditorStore((s) => s.project);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // --- Hotspots ---
  const activeHotspotDrawingId = useEditorStore((s) => s.activeHotspotDrawingId);
  const setActiveHotspotDrawingId = useEditorStore((s) => s.setActiveHotspotDrawingId);
  const setHotspotShapeForActiveScene = useEditorStore((s) => s.setHotspotShapeForActiveScene);

  // --- Placement (items / npcs) ---
  const activePlacement = useEditorStore((s) => s.activePlacement);
  const setPlacedItemShapeForActiveScene = useEditorStore((s) => s.setPlacedItemShapeForActiveScene);
  const setPlacedNpcShapeForActiveScene = useEditorStore((s) => s.setPlacedNpcShapeForActiveScene);
  const cancelPlacement = useEditorStore((s) => s.cancelPlacement);

  // Hotspots/imagen de la escena activa (draft o project)
  const activeScene = useActiveSceneHotspots();
  const focusedHotspotId = useEditorStore((s) => s.focusedHotspotId);

  const effectiveImagePath = imageLogicalPath ?? activeScene.imageLogicalPath;
  const hotspots: Hotspot[] = activeScene.hotspots ?? [];
  const placedItems: PlacedItem[] = activeScene.placedItems ?? [];
  const placedNpcs: PlacedNpc[] = activeScene.placedNpcs ?? [];

  const canDrawHotspot = !!effectiveImagePath && !!activeHotspotDrawingId;
  const canDrawPlacement = !!effectiveImagePath && !!activePlacement;
  const canDraw = canDrawHotspot || canDrawPlacement;

  const { rect, recompute } = useObjectContainRect({ containerRef, imgRef });

  const drag = useRectDragOnContainedImage({
    containerRef,
    contentRect: rect?.contentViewport ?? null,
    enabled: canDraw,
    minPx: 6,

    resetKey: canDrawHotspot
      ? activeHotspotDrawingId
      : canDrawPlacement
        ? activePlacement?.instanceId
        : null,

    onCommit: (shape01: Rect01) => {
      const shape: HotspotShape = shape01;

      if (activePlacement?.kind === "item") {
        setPlacedItemShapeForActiveScene(activePlacement.instanceId as ID, shape);
        cancelPlacement();
        return;
      }

      if (activePlacement?.kind === "npc") {
        setPlacedNpcShapeForActiveScene(activePlacement.instanceId as ID, shape);
        cancelPlacement();
        return;
      }

      if (!activeHotspotDrawingId) return;
      setHotspotShapeForActiveScene(activeHotspotDrawingId as ID, shape);
      setActiveHotspotDrawingId(null);
    },
  });

  const lastImagePath = useRef(effectiveImagePath);
  const lastCanDraw = useRef(canDraw);

  useEffect(() => {
    if (lastImagePath.current !== effectiveImagePath || lastCanDraw.current !== canDraw) {
      recompute();
      lastImagePath.current = effectiveImagePath;
      lastCanDraw.current = canDraw;
    }
  }, [effectiveImagePath, canDraw, recompute]);

  useEffect(() => {
    const onResize = () => recompute();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [recompute]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (activeHotspotDrawingId) setActiveHotspotDrawingId(null);
      if (activePlacement) cancelPlacement();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeHotspotDrawingId, activePlacement, cancelPlacement, setActiveHotspotDrawingId]);

  const cursorClass = canDraw ? "cursor-crosshair" : "cursor-default";

  const hintText =
    activePlacement?.kind === "item"
      ? "Arrastra sobre la imagen para colocar el ítem"
      : activePlacement?.kind === "npc"
        ? "Arrastra sobre la imagen para colocar el PNJ"
        : canDrawHotspot
          ? "Arrastra sobre la imagen para dibujar el hotspot"
          : "";

  return (
    <div className="scene-preview-card">
      <div className="scene-preview-image-wrapper">
        {effectiveImagePath ? (
          <>
            <img
              src={effectiveImagePath}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-60 z-0"
            />

            <div className="relative z-10 w-full h-full flex items-center justify-center">
              <div
                ref={containerRef}
                className={["relative w-full h-full", cursorClass].join(" ")}
                {...drag.bind}
              >
                <img
                  ref={imgRef}
                  src={effectiveImagePath}
                  alt={title || "Escena"}
                  className="w-full h-full object-contain drop-shadow select-none"
                  draggable={false}
                  onLoad={() => recompute()}
                />

                <ScenePlacedItemSprites placedItems={placedItems} project={project} rect={rect} />

                <SceneHotspotOverlays
                  hotspots={hotspots}
                  placedItems={placedItems}
                  placedNpcs={placedNpcs}
                  activeHotspotDrawingId={activeHotspotDrawingId as ID | null}
                  activePlacement={activePlacement}
                  rect={rect}
                  tempRectStyle={drag.tempRectStyle}
                  focusedHotspotId={focusedHotspotId}
                />

                {canDraw && (
                  <div className="absolute top-2 left-2 z-30 bg-slate-900/80 text-slate-100 text-[11px] px-2 py-1 rounded-md border border-slate-700 pointer-events-none">
                    {hintText}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center px-4">
            <span className="text-xs text-slate-500 text-center">
              Aquí se mostrará la imagen de la escena cuando la selecciones.
            </span>
          </div>
        )}

        {title && (
          <div className="absolute top-3 inset-x-4 overflow-hidden text-center z-20 pointer-events-none">
            <div
              className={[
                "inline-block whitespace-nowrap text-xl font-semibold text-white/80 drop-shadow",
                title.length > 80 ? "animate-[scene-title-marquee_16s_linear_infinite]" : "",
              ].join(" ")}
            >
              {title}
            </div>
          </div>
        )}

        {mapLabel && (
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1 bg-slate-900/85 rounded-full px-2 py-1 text-[10px] text-sky-200 shadow">
            <MapIcon className="w-4 h-4" />
          </div>
        )}

        {itemLabel && (
          <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1 bg-slate-900/85 rounded-full px-2 py-1 text-[10px] text-amber-200 shadow">
            <CubeIcon className="w-4 h-4" />
          </div>
        )}

        {npcLabel && (
          <div className="absolute bottom-2 left-2 translate-y-[-140%] z-20 flex items-center gap-1 bg-slate-900/85 rounded-full px-2 py-1 text-[10px] text-emerald-200 shadow">
            <UserIcon className="w-4 h-4" />
          </div>
        )}

        {musicLabel && musicUrl && <PreviewMusicButton label={musicLabel} musicUrl={musicUrl} />}
      </div>

      <div className="scene-preview-text-box">
        {text ? (
          <p className="text-slate-100 text-sm whitespace-pre-line text-left">{text}</p>
        ) : (
          <p className="text-slate-500 text-xs text-center">El texto de la escena se mostrará aquí.</p>
        )}
      </div>
    </div>
  );
}
