import { useMemo, useRef } from "react";
import type { Hotspot, PlacedItem, RegionShape, ID, PlacedPlayer, PlacedNpc } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { resolveTextTokensToParts, countBrokenTokens, ResolvedTextRenderer } from "@/features/editor/scene/textTokens/ResolveTextTokens";
import { useObjectContainRect } from "@/features/editor/hooks/useObjectContainRect";
import { useRegionShapeRectDrawing } from "@/features/editor/hooks/useRegionShapeRectDrawing";
import { rectStyleFromShape } from "@/features/editor/hooks/regionShape";
import { PlacedItemPreview } from "@/features/editor/scene/placedItems/PlacedItemPreview";
import { PlacedPlayerPreview } from "./placedPlayers/PlacedPlayerPreview";
import { PlacedNpcPreview } from "./placedNpcs/PlacedNpcPreview";
import { useScenePreviewAudio } from "@/features/editor/scene/music/useScenePreviewAudio";
import { PlayIcon, StopIcon } from "@heroicons/react/24/solid";

const TEMP_TEXT_ENTRY_ID = "__preview_text__";

type SceneRenderPreviewProps = {
  textPreview?: string | null;
};

export function SceneRenderPreview({ textPreview }: SceneRenderPreviewProps) {
  const project = useEditorStore((s) => s.project);

  const nodeDraft = useEditorStore((s) => s.nodeDraft);
  const nodeMode = useEditorStore((s) => s.nodeMode);
  const editingNodeId = useEditorStore((s) => s.editingNodeId);

  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const getActiveLayer = useEditorStore((s) => s.getActiveLayer);

  const hotspotEditor = useEditorStore((s) => s.hotspotEditor);
  const setHotspotDraftShape = useEditorStore((s) => s.setHotspotDraftShape);
  const finishDrawingHotspot = useEditorStore((s) => s.finishDrawingHotspot);

  const placedItemEditor = useEditorStore((s) => s.placedItemEditor);
  const setPlacedItemDraftShape = useEditorStore((s) => s.setPlacedItemDraftShape);
  const finishDrawingPlacedItem = useEditorStore((s) => s.finishDrawingPlacedItem);

  const placedPlayerEditor = useEditorStore((s) => s.placedPlayerEditor);
  const setPlacedPlayerDraftShape = useEditorStore((s) => s.setPlacedPlayerDraftShape);
  const finishDrawingPlacedPlayer = useEditorStore((s) => s.finishDrawingPlacedPlayer);

  const placedNpcEditor = useEditorStore((s) => s.placedNpcEditor);
  const setPlacedNpcDraftShape = useEditorStore((s) => s.setPlacedNpcDraftShape);
  const finishDrawingPlacedNpc = useEditorStore((s) => s.finishDrawingPlacedNpc);

  const title = nodeDraft?.title ?? "";

  const activeLayer = useMemo(() => getActiveLayer(), [getActiveLayer, nodeDraft, activeLayerId]);
  const effectiveAssetId: ID | null = (activeLayer?.assetId ?? null);
  const imageUrl = useResolvedAssetUrl(effectiveAssetId);

  const resolvedPreviewTrackId = useMemo(() => {
    if (activeLayer?.musicTrackId) return activeLayer.musicTrackId;
    if (nodeDraft?.musicTrackId) return nodeDraft.musicTrackId;

    const mapId = nodeDraft?.mapLocation?.mapId;
    const regionId = nodeDraft?.mapLocation?.regionId;
    if (!project || !mapId || !regionId) return undefined;

    const map = (project.maps ?? []).find((m) => m.id === mapId) ?? null;
    const region = map?.regions.find((r) => r.id === regionId) ?? null;

    return region?.musicTrackId;
  }, [activeLayer?.musicTrackId, nodeDraft?.musicTrackId, nodeDraft?.mapLocation?.mapId, nodeDraft?.mapLocation?.regionId, project]);

  const musicSrc = useResolvedAssetUrl(resolvedPreviewTrackId ?? null);

  const {
    audioRef,
    isPlaying: isPreviewMusicPlaying,
    canPlay: canPlayPreviewMusic,
    toggle: togglePreviewMusic,
  } = useScenePreviewAudio({
    project,
    nodeMusicTrackId: nodeDraft?.musicTrackId,
    layerMusicTrackId: activeLayer?.musicTrackId,
    mapId: nodeDraft?.mapLocation?.mapId,
    regionId: nodeDraft?.mapLocation?.regionId,
    musicSrc: musicSrc ?? undefined,
  });

  const hotspots = useMemo<Hotspot[]>(() => {
    if (!activeLayer) return [];
    if (!effectiveAssetId) return [];
    return (activeLayer.hotspots ?? []);
  }, [activeLayer, effectiveAssetId]);

  const placedItems = useMemo<PlacedItem[]>(() => {
    if (!activeLayer) return [];
    if (!effectiveAssetId) return [];
    return activeLayer.placedItems ?? [];
  }, [activeLayer, effectiveAssetId]);

  const placedPlayers = useMemo<PlacedPlayer[]>(() => {
    if (!activeLayer) return [];
    if (!effectiveAssetId) return [];
    return activeLayer.placedPlayers ?? [];
  }, [activeLayer, effectiveAssetId]);

  const placedNpcs = useMemo<PlacedNpc[]>(() => {
    if (!activeLayer) return [];
    if (!effectiveAssetId) return [];
    return activeLayer.placedNpcs ?? [];
  }, [activeLayer, effectiveAssetId]);

  const resolvedTextEntry = useMemo(() => {
    const entries = (activeLayer?.text ?? []) as Array<{ id?: string; when?: unknown; content?: string }>;
    if (!entries.length) return null;

    const temp = entries.find((t) => String(t.id) === TEMP_TEXT_ENTRY_ID) ?? null;
    if (temp) return temp;

    return entries.find((t) => !t.when) ?? null;
  }, [activeLayer]);

  const effectiveText = textPreview ?? (resolvedTextEntry?.content ?? "");

  const effectiveDock = (activeLayer?.dock ?? "bottom");
  const gridClass = `scene-preview-grid scene-preview--${effectiveDock}`;

  const parts = useMemo(() => resolveTextTokensToParts(effectiveText, project), [effectiveText, project]);
  const brokenCount = useMemo(() => countBrokenTokens(parts), [parts]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const resetKey = [
    activeLayerId ?? "",
    hotspotEditor?.mode?.type ?? "idle",
    hotspotEditor?.selection?.hotspotId ?? "",
    placedItemEditor?.mode?.type ?? "idle",
    placedItemEditor?.selection?.placedItemId ?? "",
    placedPlayerEditor?.mode?.type ?? "ide",
    placedPlayerEditor?.selection?.playerId ?? "",
    placedNpcEditor?.mode?.type ?? "idle",
    placedNpcEditor?.selection?.npcId ?? "",
    nodeMode,
    editingNodeId ?? "",
  ].join(":");

  const { contentRectInContainer, toContainerPx } = useObjectContainRect({ containerRef, imgRef });

  const isHotspotDraftOnActiveLayer = hotspotEditor?.context?.layerId != null &&
    activeLayerId != null && String(hotspotEditor.context.layerId) === String(activeLayerId);

  const isPlacedItemDraftOnActiveLayer = placedItemEditor?.context?.layerId != null &&
    activeLayerId != null && String(placedItemEditor.context.layerId) === String(activeLayerId);

  const isPlacedPlayerDraftOnActiveLayer = placedPlayerEditor?.context?.layerId != null &&
    activeLayerId != null && String(placedPlayerEditor.context.layerId) === String(activeLayerId);

  const isPlacedNpcDraftOnActiveLayer = placedNpcEditor?.context?.layerId != null &&
    activeLayerId != null && String(placedNpcEditor.context.layerId) === String(activeLayerId);

  const isDrawingHotspot = hotspotEditor?.mode?.type === "drawing" && isHotspotDraftOnActiveLayer;
  const isDrawingPlacedItem = placedItemEditor?.mode?.type === "drawing" && isPlacedItemDraftOnActiveLayer;
  const isDrawingPlacedPlayer = placedPlayerEditor?.mode?.type === "drawing" && isPlacedPlayerDraftOnActiveLayer;
  const isDrawingPlacedNpc = placedNpcEditor?.mode?.type === "drawing" && isPlacedNpcDraftOnActiveLayer;

  const isDrawing = isDrawingHotspot || isDrawingPlacedItem || isDrawingPlacedPlayer || isDrawingPlacedNpc;

  const hotspotDraftShapeStyle = rectStyleFromShape(isHotspotDraftOnActiveLayer ? (hotspotEditor?.draft?.shape ?? null) : null, contentRectInContainer);
  const placedItemDraftShapeStyle = rectStyleFromShape(isPlacedItemDraftOnActiveLayer ? (placedItemEditor?.draft?.shape ?? null) : null, contentRectInContainer);
  const placedPlayerDraftShapeStyle = rectStyleFromShape(isPlacedPlayerDraftOnActiveLayer ? (placedPlayerEditor?.draft?.shape ?? null) : null, contentRectInContainer);
  const placedNpcDraftShapeStyle = rectStyleFromShape(isPlacedNpcDraftOnActiveLayer ? (placedNpcEditor?.draft?.shape ?? null) : null, contentRectInContainer);

  const draw = useRegionShapeRectDrawing({
    contentRect: contentRectInContainer,
    enabled: Boolean(isDrawing && imageUrl),
    toContainerPx,
    onCommit: (shape: RegionShape) => {
      if (isDrawingHotspot) {
        setHotspotDraftShape(shape);
        finishDrawingHotspot();
        return;
      }

      if (isDrawingPlacedItem) {
        setPlacedItemDraftShape(shape);
        finishDrawingPlacedItem();
      }

      if (isDrawingPlacedPlayer) {
        setPlacedPlayerDraftShape(shape);
        finishDrawingPlacedPlayer();
      }

      if (isDrawingPlacedNpc) {
        setPlacedNpcDraftShape(shape);
        finishDrawingPlacedNpc();
      }

    },
    resetKey,
  });

  const placedItemDraftPreview = useMemo<PlacedItem | null>(() => {
    const draft = placedItemEditor?.draft;
    const isDraftOnActiveLayer =
      placedItemEditor?.context?.layerId != null &&
      activeLayerId != null &&
      String(placedItemEditor.context.layerId) === String(activeLayerId);

    if (!draft || !draft.shape || !isDraftOnActiveLayer) return null;

    return {
      id: draft.id,
      itemId: draft.itemId,
      label: draft.label,
      shape: draft.shape,
      initialState: draft.initialState,
      rules: draft.rules,
    };
  }, [placedItemEditor, activeLayerId]);

  const placedPlayerDraftPreview = useMemo<PlacedPlayer | null>(() => {
    const draft = placedPlayerEditor?.draft;
    const isDraftOnActiveLayer =
      placedPlayerEditor?.context?.layerId != null &&
      activeLayerId != null &&
      String(placedPlayerEditor.context.layerId) === String(activeLayerId);

    if (!draft || !draft.shape || !isDraftOnActiveLayer) return null;

    return {
      playerId: draft.playerId,
      initialState: draft.initialState,
      initialImageId: draft.initialImageId,
      shape: draft.shape,
    };
  }, [placedPlayerEditor, activeLayerId]);

  const placedNpcDraftPreview = useMemo<PlacedNpc | null>(() => {
    const draft = placedNpcEditor?.draft;
    const isDraftOnActiveLayer =
      placedNpcEditor?.context?.layerId != null &&
      activeLayerId != null &&
      String(placedNpcEditor.context.layerId) === String(activeLayerId);

    if (!draft || !draft.shape || !isDraftOnActiveLayer) return null;

    return {
      npcId: draft.npcId,
      initialState: draft. initialState,
      shape: draft.shape,
      rules: draft.rules,

    };
  }, [placedNpcEditor, activeLayerId]);

  const tempRectStyle = draw.tempRectStyle;
  const drawingCursorClass = isDrawing ? "cursor-crosshair" : "";

  return (
    <div className="scene-preview-card h-full min-h-0 overflow-hidden">
      <audio ref={audioRef} className="hidden" />
      <div className={gridClass}>
        {/* TEXT */}
        <div style={{ gridArea: "text" }} className="min-h-0 min-w-0 overflow-hidden relative">
          <div className="scene-preview-text-box h-full min-h-0 overflow-hidden">
            <div className="h-full min-h-0 overflow-hidden flex flex-col">
              {brokenCount > 0 ? (
                <div className="mb-2 rounded-md border border-rose-500/40 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-200">
                  Hay {brokenCount} referencia{brokenCount === 1 ? "" : "s"} rota{brokenCount === 1 ? "" : "s"} en el texto.
                </div>
              ) : null}

              <div className="editor-scroll flex-1 min-h-0 overflow-auto">
                <ResolvedTextRenderer
                  parts={parts}
                  emptyText="El texto de la escena se mostrará aquí."
                  wrapperClassName="text-slate-100 text-sm whitespace-pre-wrap wrap-break-word"
                  resolvedTokenClassName="px-1 py-0.5 rounded bg-slate-900/70 border border-slate-700 text-fuchsia-100 font-mono text-[12px]"
                  brokenTokenClassName="px-1 py-0.5 rounded bg-rose-950/30 text-rose-200 border border-rose-500/30 font-mono text-[12px]"
                  brokenTokenTitle="Referencia rota"
                />
              </div>
            </div>
          </div>
        </div>

        {/* IMAGE */}
        <div style={{ gridArea: "image" }} className="min-h-0 min-w-0 overflow-hidden">
          <div
            ref={containerRef}
            className={`scene-preview-image-wrapper h-full min-h-0 overflow-hidden relative ${drawingCursorClass}`}
            {...draw.bind}
          >
            {imageUrl ? (
              <>
                {/* fondo blur */}
                <img
                  src={imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-md scale-105 opacity-45 z-0"
                  draggable={false}
                />

                {/* imagen contain */}
                <div className="relative z-10 w-full h-full flex items-center justify-center overflow-hidden">
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt={title || "Escena"}
                    className="w-full h-full object-contain drop-shadow select-none"
                    draggable={false}
                  />
                </div>

                {canPlayPreviewMusic ? (
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      void togglePreviewMusic();
                    }}
                    className={
                      "absolute bottom-3 right-3 z-30 pointer-events-auto rounded-full border border-slate-700/80 " +
                      "bg-slate-950/80 p-2 text-white shadow-md transition-colors " +
                      (isPreviewMusicPlaying ? "hover:bg-red-900/80" : "hover:bg-emerald-900/80")
                    }
                    title={isPreviewMusicPlaying ? "Detener música" : "Reproducir música"}
                    aria-label={isPreviewMusicPlaying ? "Detener música" : "Reproducir música"}
                  >
                    {isPreviewMusicPlaying ? (
                      <StopIcon className="h-5 w-5" />
                    ) : (
                      <PlayIcon className="h-5 w-5" />
                    )}
                  </button>
                ) : null}

                {/* overlays hotspots + rect drawing */}
                <div className="absolute inset-0 z-20 pointer-events-none">
                  {(hotspots ?? []).map((hs: Hotspot) => {
                    const st = rectStyleFromShape(hs.shape ?? null, contentRectInContainer);
                    if (!st) return null;

                    const w = Number(String((st as any).width ?? "0").replace("px", "")) || 0;
                    const h = Number(String((st as any).height ?? "0").replace("px", "")) || 0;
                    const label = (hs.label ?? "").trim();
                    const canShowLabel = !!label && w >= 50 && h >= 20;

                    return (
                      <div
                        key={hs.id}
                        style={st}
                        className="absolute border-2 border-fuchsia-400/60 bg-fuchsia-500/10 rounded-sm flex items-center justify-center"
                        title={label}
                      >
                        {canShowLabel ? (
                          <div className="px-2 py-0.5 rounded-md border border-fuchsia-600 text-slate-100 text-[11px] leading-none truncate max-w-[90%] text-center pointer-events-none">
                            {label}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  <PlacedItemPreview
                    placedItems={placedItems}
                    project={project}
                    contentRectInContainer={contentRectInContainer}
                    draftItem={placedItemDraftPreview}
                  />

                  <PlacedPlayerPreview
                    placedPlayers={placedPlayers}
                    project={project}
                    contentRectInContainer={contentRectInContainer}
                    draftPlayer={placedPlayerDraftPreview}
                  />

                  <PlacedNpcPreview
                    placedNpcs={placedNpcs}
                    project={project}
                    contentRectInContainer={contentRectInContainer}
                    draftNpc={placedNpcDraftPreview}
                  />

                  {tempRectStyle ? (
                    <div style={tempRectStyle} className="absolute border-2 border-emerald-400/70 bg-emerald-500/10 rounded-sm" />
                  ) : null}

                  {hotspotDraftShapeStyle ? (
                    <div
                      style={hotspotDraftShapeStyle}
                      className="absolute border-2 border-emerald-400/70 bg-emerald-500/10 rounded-sm"
                    />
                  ) : null}

                  {placedItemDraftShapeStyle ? (
                    <div
                      style={placedItemDraftShapeStyle}
                      className="absolute border-2 border-emerald-400/70 bg-emerald-500/10 rounded-sm"
                    />
                  ) : null}

                  {placedPlayerDraftShapeStyle ? (
                    <div
                      style={placedPlayerDraftShapeStyle}
                      className="absolute border-2 border-emerald-400/70 bg-cyan-500/10 rounded-sm"
                    />
                  ) : null}

                  {placedNpcDraftShapeStyle ? (
                    <div
                      style={placedNpcDraftShapeStyle}
                      className="absolute border-2 border-emerald-400/70 bg-amber-500/10 rounded-sm"
                    />
                  ) : null}

                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center px-4">
                <span className="text-xs text-slate-500 text-center">La imagen de la escena se mostrará aquí.</span>
              </div>
            )}

            {!!title && (
              <div className="absolute top-3 inset-x-4 overflow-hidden text-center z-20 pointer-events-none opacity-50">
                <div
                  className={`inline-block whitespace-nowrap text-xl font-semibold text-white/80 drop-shadow ${title.length > 80 ? "animate-[scene-title-marquee_16s_linear_infinite]" : ""
                    }`}
                >
                  {title}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}