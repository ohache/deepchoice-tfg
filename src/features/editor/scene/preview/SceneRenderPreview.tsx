import { useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { Hotspot, ID, PlacedItem, PlacedNpc, PlacedPlayer, SceneImageLayer } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { countBrokenTokens, ResolvedTextRenderer, resolveTextTokensToParts } from "@/features/editor/scene/textTokens/ResolveTextTokens";
import { useObjectContainRect } from "@/features/editor/hooks/useObjectContainRect";
import { rectStyleFromShape } from "@/features/editor/hooks/regionShape";
import { PlacedItemPreview } from "@/features/editor/scene/placedItems/PlacedItemPreview";
import { PlacedPlayerPreview } from "../placedPlayers/PlacedPlayerPreview";
import { PlacedNpcPreview } from "../placedNpcs/PlacedNpcPreview";
import { useScenePreviewAudio } from "@/features/editor/scene/music/useScenePreviewAudio";
import { useSceneRenderPreviewInteractions, type PreviewInteractiveFieldId } from "@/features/editor/scene/preview/useSceneRenderPreviewInteractions";
import { PlayIcon, StopIcon } from "@heroicons/react/24/solid";

const TEMP_TEXT_ENTRY_ID = "__preview_text__";

type SceneRenderPreviewProps = {
  textPreview?: string | null;
  onOpenInteractiveField: (field: PreviewInteractiveFieldId) => void;
};

type ClickableOverlayBoxProps = {
  style: CSSProperties | null;
  title: string;
  onClick: () => void;
};

type HotspotPreviewBoxProps = {
  hotspot: Hotspot;
  contentRectInContainer: ReturnType<typeof useObjectContainRect>["contentRectInContainer"];
  onClick: (hotspotId: ID) => void;
};

type PreviewClickableEntry = {
  id: ID;
  title: string;
  style: CSSProperties | null;
};

function findActiveLayer(layers: SceneImageLayer[] | undefined, activeLayerId: ID | null): SceneImageLayer | null {
  if (!layers?.length || !activeLayerId) return null;
  return layers.find((layer) => String(layer.id) === String(activeLayerId)) ?? null;
}

function getResolvedPreviewTextEntry(layer: SceneImageLayer | null): { id?: string; when?: unknown; content?: string } | null {
  const entries = (layer?.text ?? []) as Array<{ id?: string; when?: unknown; content?: string }>;
  if (!entries.length) return null;

  const tempEntry = entries.find((entry) => String(entry.id) === String(TEMP_TEXT_ENTRY_ID)) ?? null;
  if (tempEntry) return tempEntry;

  return entries.find((entry) => !entry.when) ?? null;
}

function getRectSize(style: CSSProperties | null) {
  if (!style) return { width: 0, height: 0 };

  const width = Number(String(style.width ?? "0").replace("px", "")) || 0;
  const height = Number(String(style.height ?? "0").replace("px", "")) || 0;

  return { width, height };
}

function buildClickableEntries<T>(items: T[], getId: (item: T) => ID, getTitle: (item: T) => string, getStyle: (item: T) => CSSProperties | null): PreviewClickableEntry[] {
  return items.map((item) => ({ id: getId(item), title: getTitle(item), style: getStyle(item) }));
}

function ClickableOverlayBox({ style, title, onClick }: ClickableOverlayBoxProps) {
  if (!style) return null;

  return (
    <button
      type="button"
      style={style}
      className="pointer-events-auto absolute cursor-pointer bg-transparent"
      title={title}
      aria-label={title}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    />
  );
}

function HotspotPreviewBox({ hotspot, contentRectInContainer, onClick }: HotspotPreviewBoxProps) {
  const style = rectStyleFromShape(hotspot.shape ?? null, contentRectInContainer);
  if (!style) return null;

  const { width, height } = getRectSize(style);
  const label = (hotspot.label ?? "").trim();
  const canShowLabel = Boolean(label) && width >= 20 && height >= 10;

  return (
    <button
      type="button"
      style={style}
      className="pointer-events-auto absolute flex cursor-pointer items-center justify-center rounded-sm border-2 border-fuchsia-400/60 bg-fuchsia-500/10"
      title={label || "Editar hotspot"}
      aria-label={label || "Editar hotspot"}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onClick(hotspot.id);
      }}
    >
      {canShowLabel ? (
        <div className="pointer-events-none max-w-[90%] truncate rounded-md border border-fuchsia-600 px-2 py-0.5 text-center text-[11px] leading-none text-slate-100">
          {label}
        </div>
      ) : null}
    </button>
  );
}

function DraftOverlayBox({ style, className }: { style: CSSProperties | null; className: string }) {
  if (!style) return null;
  return <div style={style} className={className} />;
}

export function SceneRenderPreview({ textPreview, onOpenInteractiveField }: SceneRenderPreviewProps) {
  const project = useEditorStore((state) => state.project);
  const nodeDraft = useEditorStore((state) => state.nodeDraft);
  const nodeMode = useEditorStore((state) => state.nodeMode);
  const editingNodeId = useEditorStore((state) => state.editingNodeId);
  const activeLayerId = useEditorStore((state) => state.activeLayerId);

  const title = nodeDraft?.title ?? "";

  const activeLayer = useMemo(() => findActiveLayer(nodeDraft?.layers, activeLayerId), [nodeDraft?.layers, activeLayerId]);

  const effectiveAssetId: ID | null = activeLayer?.assetId ?? null;
  const imageUrl = useResolvedAssetUrl(effectiveAssetId);

  const resolvedPreviewTrackId = useMemo(() => {
    if (activeLayer?.musicTrackId) return activeLayer.musicTrackId;
    if (nodeDraft?.musicTrackId) return nodeDraft.musicTrackId;

    const mapId = nodeDraft?.mapLocation?.mapId;
    const regionId = nodeDraft?.mapLocation?.regionId;
    if (!project || !mapId || !regionId) return undefined;

    const map = (project.maps ?? []).find((entry) => entry.id === mapId) ?? null;
    const region = map?.regions.find((entry) => entry.id === regionId) ?? null;

    return region?.musicTrackId;
  }, [activeLayer?.musicTrackId, nodeDraft?.musicTrackId, nodeDraft?.mapLocation?.mapId, nodeDraft?.mapLocation?.regionId, project]);

  const musicSrc = useResolvedAssetUrl(resolvedPreviewTrackId ?? null);

  const { audioRef, isPlaying: isPreviewMusicPlaying, canPlay: canPlayPreviewMusic, toggle: togglePreviewMusic } = useScenePreviewAudio({
    project,
    nodeMusicTrackId: nodeDraft?.musicTrackId,
    layerMusicTrackId: activeLayer?.musicTrackId,
    mapId: nodeDraft?.mapLocation?.mapId,
    regionId: nodeDraft?.mapLocation?.regionId,
    musicSrc: musicSrc ?? undefined,
  });

  const hotspots = useMemo<Hotspot[]>(() => (activeLayer && effectiveAssetId ? activeLayer.hotspots ?? [] : []), [activeLayer, effectiveAssetId]);
  const placedItems = useMemo<PlacedItem[]>(() => (activeLayer && effectiveAssetId ? activeLayer.placedItems ?? [] : []), [activeLayer, effectiveAssetId]);
  const placedPlayers = useMemo<PlacedPlayer[]>(() => (activeLayer && effectiveAssetId ? activeLayer.placedPlayers ?? [] : []), [activeLayer, effectiveAssetId]);
  const placedNpcs = useMemo<PlacedNpc[]>(() => (activeLayer && effectiveAssetId ? activeLayer.placedNpcs ?? [] : []), [activeLayer, effectiveAssetId]);

  const resolvedTextEntry = useMemo(() => getResolvedPreviewTextEntry(activeLayer), [activeLayer]);

  const effectiveText = textPreview ?? (resolvedTextEntry?.content ?? "");
  const effectiveDock = activeLayer?.dock ?? "bottom";
  const gridClass = `scene-preview-grid scene-preview--${effectiveDock}`;

  const parts = useMemo(() => resolveTextTokensToParts(effectiveText, project), [effectiveText, project]);

  const brokenCount = useMemo(() => countBrokenTokens(parts), [parts]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const { contentRectInContainer, toContainerPx } = useObjectContainRect({ containerRef, imgRef });

  const { draw, drawingCursorClass, overlayDrafts, placedItemDraftPreview, placedPlayerDraftPreview, placedNpcDraftPreview, handleOpenHotspot,
    handleOpenPlacedItem, handleOpenPlacedNpc, handleOpenPlacedPlayer } = useSceneRenderPreviewInteractions({
      activeLayerId, imageUrl, nodeMode, editingNodeId, contentRectInContainer, toContainerPx, onOpenInteractiveField
    });

  const placedItemClickBoxes = useMemo(() =>
    buildClickableEntries(
      placedItems,
      (item) => item.id,
      (item) => (item.label ?? "").trim() || "Editar item",
      (item) => rectStyleFromShape(item.shape ?? null, contentRectInContainer),
    ), [placedItems, contentRectInContainer],
  );

  const placedNpcClickBoxes = useMemo(() =>
    buildClickableEntries(
      placedNpcs,
      (npc) => npc.npcId,
      () => "Editar NPC",
      (npc) => rectStyleFromShape(npc.shape ?? null, contentRectInContainer),
    ), [placedNpcs, contentRectInContainer],
  );

  const placedPlayerClickBoxes = useMemo(() =>
    buildClickableEntries(
      placedPlayers,
      (player) => player.playerId,
      () => "Editar player",
      (player) => rectStyleFromShape(player.shape ?? null, contentRectInContainer),
    ), [placedPlayers, contentRectInContainer],
  );

  return (
    <div className="scene-preview-card h-full min-h-0 overflow-hidden">
      <audio ref={audioRef} className="hidden" />

      <div className={gridClass}>
        <div style={{ gridArea: "text" }} className="relative min-h-0 min-w-0 overflow-hidden">
          <div className="scene-preview-text-box h-full min-h-0 overflow-hidden">
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              {brokenCount > 0 ? (
                <div className="mb-2 rounded-md border border-rose-500/40 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-200">
                  Hay {brokenCount} referencia{brokenCount === 1 ? "" : "s"} rota
                  {brokenCount === 1 ? "" : "s"} en el texto.
                </div>
              ) : null}

              <div className="editor-scroll min-h-0 flex-1 overflow-auto">
                <ResolvedTextRenderer
                  parts={parts}
                  emptyText="El texto de la escena se mostrará aquí."
                  wrapperClassName="wrap-break-word whitespace-pre-wrap text-sm text-slate-100"
                  resolvedTokenClassName=" font-mono text-sm text-fuchsia-200"
                  brokenTokenClassName="font-mono text-sm text-red-200"
                  brokenTokenTitle="Referencia rota"
                />
              </div>
            </div>
          </div>
        </div>

        <div style={{ gridArea: "image" }} className="min-h-0 min-w-0 overflow-hidden">
          <div
            ref={containerRef}
            className={`scene-preview-image-wrapper relative h-full min-h-0 overflow-hidden ${drawingCursorClass}`}
            {...draw.bind}
          >
            {imageUrl ? (
              <>
                <img
                  src={imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 z-0 h-full w-full scale-105 object-cover blur-md opacity-45"
                  draggable={false}
                />

                <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden">
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt={title || "Escena"}
                    className="h-full w-full select-none object-contain drop-shadow"
                    draggable={false}
                  />
                </div>

                {canPlayPreviewMusic ? (
                  <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      void togglePreviewMusic();
                    }}
                    className={"pointer-events-auto absolute bottom-5 right-5 z-30 rounded-full border-2 border-slate-600 bg-slate-950/80 p-2 text-white shadow-md transition-colors " +
                      (isPreviewMusicPlaying
                        ? "hover:bg-red-900/80 hover:border-red-700"
                        : "hover:bg-emerald-900/80 hover:border-emerald-700")}
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

                <div className="absolute inset-0 z-20">
                  <div className="pointer-events-none absolute inset-0">
                    {hotspots.map((hotspot) => (
                      <HotspotPreviewBox
                        key={hotspot.id}
                        hotspot={hotspot}
                        contentRectInContainer={contentRectInContainer}
                        onClick={handleOpenHotspot}
                      />
                    ))}

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

                    {overlayDrafts.map((overlay, index) => (
                      <DraftOverlayBox
                        key={index}
                        style={overlay.style}
                        className={overlay.className}
                      />
                    ))}
                  </div>

                  {placedItemClickBoxes.map((item) => (
                    <ClickableOverlayBox
                      key={item.id}
                      style={item.style}
                      title={item.title}
                      onClick={() => handleOpenPlacedItem(item.id)}
                    />
                  ))}

                  {placedNpcClickBoxes.map((npc) => (
                    <ClickableOverlayBox
                      key={npc.id}
                      style={npc.style}
                      title={npc.title}
                      onClick={() => handleOpenPlacedNpc(npc.id)}
                    />
                  ))}

                  {placedPlayerClickBoxes.map((player) => (
                    <ClickableOverlayBox
                      key={player.id}
                      style={player.style}
                      title={player.title}
                      onClick={() => handleOpenPlacedPlayer(player.id)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center px-4">
                <span className="text-center text-xs text-slate-500">
                  La imagen de la escena se mostrará aquí.
                </span>
              </div>
            )}

            {!!title && (
              <div className="pointer-events-none absolute inset-x-4 top-3 z-20 overflow-hidden text-center opacity-50">
                <div
                  className={`inline-block whitespace-nowrap text-xl font-semibold text-white/80 drop-shadow
                    ${title.length > 80 ? "animate-[scene-title-marquee_16s_linear_infinite]" : ""}`}
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