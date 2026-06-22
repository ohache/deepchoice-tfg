import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ID, RegionShape, TextDock } from "@/domain/types";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { useImageContentRect } from "@/features/player/hooks/useImageContentRect";
import { useEditorStore } from "@/store/editorStore";
import { countBrokenTokens, ResolvedTextRenderer, resolveTextTokensToParts } from "@/shared/textTokens/ResolveTextTokens";
import type { SceneTestHotspotEntry, SceneTestInspectableRef, SceneTestPlacedItemEntry, SceneTestPlacedNpcEntry,
  SceneTestPlacedPlayerEntry } from "@/features/editor/scene/test/sceneTestTypes";
import { canRenderPreviewLabel } from "@/features/editor/scene/preview/previewRenderHelpers";
import { useSceneTestTransition } from "@/features/editor/scene/test/useSceneTestTransition";

const TOOLTIP_DELAY_MS = 350;

type SceneTestVisualSnapshot = {
  imageAssetId?: ID | null;
  text?: string;
  textLabel?: string;
  textDock: TextDock;
  layerLabel?: string;
  hotspots: SceneTestHotspotEntry[];
  placedItems: SceneTestPlacedItemEntry[];
  placedNpcs: SceneTestPlacedNpcEntry[];
  placedPlayers: SceneTestPlacedPlayerEntry[];
};

type SceneTestProps = {
  title?: string;
  imageAssetId?: ID | null;
  text?: string;
  textLabel?: string;
  textDock?: TextDock;
  showTextNav?: boolean;
  canGoPrevText?: boolean;
  canGoNextText?: boolean;
  onPrevText?: () => void;
  onNextText?: () => void;
  canGoPrevLayer?: boolean;
  canGoNextLayer?: boolean;
  onPrevLayer?: () => void;
  onNextLayer?: () => void;
  layerLabel?: string;
  showLayerNav?: boolean;
  hotspots?: SceneTestHotspotEntry[];
  placedItems?: SceneTestPlacedItemEntry[];
  placedNpcs?: SceneTestPlacedNpcEntry[];
  placedPlayers?: SceneTestPlacedPlayerEntry[];
  hoveredRef?: SceneTestInspectableRef | null;
  pinnedRef?: SceneTestInspectableRef | null;
  onHoverTarget?: (ref: SceneTestInspectableRef) => void;
  onLeaveTarget?: () => void;
  onSelectTarget?: (ref: SceneTestInspectableRef) => void;
}

function rectPx(shape: RegionShape | null | undefined, content: { w: number; h: number }) {
  if (!shape || shape.type !== "rect") return null;

  return { left: shape.x * content.w, top: shape.y * content.h, width: shape.w * content.w, height: shape.h * content.h };
}

function isSameRef(a: SceneTestInspectableRef | null | undefined, b: SceneTestInspectableRef | null | undefined) {
  return !!a && !!b && a.type === b.type && a.id === b.id;
}

function isTextFirst(hasText: boolean, dock: TextDock) {
  if (!hasText) return false;
  return dock === "top" || dock === "left";
}

function baseOverlayStyle(isHovered: boolean, isPinned: boolean): CSSProperties | undefined {
  if (isPinned) {
    return {
      boxShadow: "0 0 0 2px rgba(250,204,21,0.95), 0 0 26px rgba(250,204,21,0.42), inset 0 0 0 2px rgba(250,204,21,0.22)",
      background: "rgba(250,204,21,0.08)",
      borderRadius: 12,
    };
  }

  if (isHovered) {
    return {
      boxShadow: "0 0 0 2px rgba(217,119,6,0.85), 0 0 20px rgba(217,119,6,0.28), inset 0 0 0 2px rgba(217,119,6,0.18)",
      background: "rgba(245,158,11,0.06)",
      borderRadius: 12,
    };
  }

  return undefined;
}

function InlineNavButton({ children, disabled = false, onClick }: { children: string; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={"rounded-md border px-2.5 py-1 text-xs transition-colors " +
        (disabled
          ? "border-slate-700 bg-slate-900/50 text-slate-500 cursor-not-allowed"
          : "border-slate-600 bg-slate-950/90 text-slate-100 hover:border-fuchsia-700 hover:bg-slate-900")}
    >
      {children}
    </button>
  );
}

function ScenePlacedItemSprite({ entry, contentRect }: { entry: SceneTestPlacedItemEntry; contentRect: { w: number; h: number } }) {
  const imageSrc = useResolvedAssetUrl(entry.itemId);
  const rect = rectPx(entry.raw.placement?.shape, contentRect);

  if (!rect || !imageSrc) return null;

  return (
    <div className="absolute pointer-events-none" style={rect}>
      <img
        src={imageSrc}
        alt={entry.label}
        className="w-full h-full object-fill select-none"
        draggable={false}
      />
    </div>
  );
}

function ScenePlacedNpcSprite({ entry, contentRect }: { entry: SceneTestPlacedNpcEntry; contentRect: { w: number; h: number } }) {
  const imageSrc = useResolvedAssetUrl(entry.npcId);
  const rect = rectPx(entry.raw.shape, contentRect);

  if (!rect || !imageSrc) return null;

  return (
    <div className="absolute pointer-events-none" style={rect}>
      <img
        src={imageSrc}
        alt={entry.npcName}
        className="w-full h-full object-fill select-none"
        draggable={false}
      />
    </div>
  );
}

function ScenePlacedPlayerSprite({ entry, contentRect }: { entry: SceneTestPlacedPlayerEntry; contentRect: { w: number; h: number } }) {
  const imageSrc = useResolvedAssetUrl(entry.initialImageId);
  const rect = rectPx(entry.raw.shape, contentRect);

  if (!rect || !imageSrc) return null;

  return (
    <div className="absolute pointer-events-none" style={rect}>
      <img
        src={imageSrc}
        alt={entry.playerName}
        className="w-full h-full object-fill select-none"
        draggable={false}
      />
    </div>
  );
}

export function SceneTest({ title, imageAssetId, text, textLabel, textDock = "bottom", showTextNav = false, canGoPrevText = false,
  canGoNextText = false, onPrevText, onNextText, canGoPrevLayer = false, canGoNextLayer = false, onPrevLayer, onNextLayer, layerLabel,
  showLayerNav = false, hotspots = [], placedItems = [], placedNpcs = [], placedPlayers = [], hoveredRef = null, pinnedRef = null,
  onHoverTarget, onLeaveTarget, onSelectTarget }: SceneTestProps) {
  const transitionKey = `${imageAssetId ?? ""}::${layerLabel ?? ""}::${textLabel ?? ""}`;

  const visualSnapshot = useMemo<SceneTestVisualSnapshot>(() => ({
    imageAssetId, text, textLabel, textDock, layerLabel, hotspots, placedItems, placedNpcs, placedPlayers
  }), [imageAssetId, text, textLabel, textDock, layerLabel, hotspots, placedItems, placedNpcs, placedPlayers],
  );

  const { displayedSnapshot, isBlackTransition } = useSceneTestTransition({ transitionKey, snapshot: visualSnapshot });

  const imageSrc = useResolvedAssetUrl(displayedSnapshot.imageAssetId ?? null);
  const project = useEditorStore((state) => state.project);

  const { containerRef, imgRef, contentRect, refreshImageContentRect } = useImageContentRect();
  const stageRef = useRef<HTMLDivElement | null>(null);

  const tooltipTimerRef = useRef<number | null>(null);
  const [tooltipRef, setTooltipRef] = useState<SceneTestInspectableRef | null>(null);

  const effectiveText = displayedSnapshot.text ?? "";
  const hasText = effectiveText.trim().length > 0;
  const effectiveTextLabel = (displayedSnapshot.textLabel ?? "").trim() || "Base";
  const showTextHeader = Boolean(effectiveTextLabel) || showTextNav;
  const effectiveTextDock: TextDock = displayedSnapshot.textDock === "top" || displayedSnapshot.textDock === "left" || displayedSnapshot.textDock === "right" ||
    displayedSnapshot.textDock === "bottom" ? displayedSnapshot.textDock: "bottom";
  const textFirst = isTextFirst(hasText, effectiveTextDock);

  const parts = useMemo(() => resolveTextTokensToParts(effectiveText, project), [effectiveText, project]);
  const brokenCount = useMemo(() => countBrokenTokens(parts), [parts]);

  useEffect(() => stageRef.current?.focus(), [imageSrc]);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) {
        window.clearTimeout(tooltipTimerRef.current);
        tooltipTimerRef.current = null;
      }
    };
  }, []);

  const hotspotEntries = useMemo(() => displayedSnapshot.hotspots.map((entry) => ({ entry, ref: { type: "hotspot" as const, id: entry.id } })), [displayedSnapshot.hotspots]);
  const placedItemEntries = useMemo(() => displayedSnapshot.placedItems.map((entry) => ({ entry, ref: { type: "placedItem" as const, id: entry.id } })), [displayedSnapshot.placedItems]);
  const placedNpcEntries = useMemo(() => displayedSnapshot.placedNpcs.map((entry) => ({ entry, ref: { type: "placedNpc" as const, id: entry.id } })), [displayedSnapshot.placedNpcs]);
  const placedPlayerEntries = useMemo(() => displayedSnapshot.placedPlayers.map((entry) => ({ entry, ref: { type: "placedPlayer" as const, id: entry.id } })), [displayedSnapshot.placedPlayers]);

  const handleHoverTarget = (ref: SceneTestInspectableRef) => {
    onHoverTarget?.(ref);

    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }

    tooltipTimerRef.current = window.setTimeout(() => {
      setTooltipRef(ref);
      tooltipTimerRef.current = null;
    }, TOOLTIP_DELAY_MS);
  };

  const handleLeave = () => {
    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }

    setTooltipRef(null);
    onLeaveTarget?.();
  };

  const handleSelectTarget = (ref: SceneTestInspectableRef) => {
    if (tooltipTimerRef.current) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }

    setTooltipRef(null);
    onSelectTarget?.(ref);
  };

  const renderInspectTooltip = (ref: SceneTestInspectableRef, isPinned: boolean) => {
    const isVisible = isSameRef(tooltipRef, ref) && !isPinned;

    if (!isVisible) return null;

    return (
      <div className="pointer-events-none absolute left-1/2 top-0 z-40 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-md border border-amber-400/70 bg-slate-950/95 px-2 py-1 text-[11px] text-amber-100 shadow-lg">
        Haz click para fijar el panel de información
      </div>
    );
  };

  const renderLayerNav = () => {
    if (!showLayerNav) return null;

    return (
      <div className="relative z-30 shrink-0 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/85 px-3 py-1.5">
        <InlineNavButton disabled={!canGoPrevLayer} onClick={onPrevLayer}>
          Capa anterior
        </InlineNavButton>

        <div className="min-w-0 text-xs text-slate-100 truncate text-center flex-1">
          {displayedSnapshot.layerLabel ?? "Sin capa"}
        </div>

        <InlineNavButton disabled={!canGoNextLayer} onClick={onNextLayer}>
          Siguiente capa
        </InlineNavButton>
      </div>
    );
  };

  const renderTextPanel = () => (
    <div
      className={"bg-black overflow-hidden shrink-0 min-h-0 flex items-center justify-center" +
        (effectiveTextDock === "left" ? " h-full w-[280px] border-r border-slate-800" : effectiveTextDock === "right"
          ? " h-full w-[280px] border-l border-slate-800" : effectiveTextDock === "top"
            ? " w-full h-40 border-b border-slate-800" : " w-full h-40 border-t border-slate-800")}
    >
      <div className="h-full min-h-0 w-full flex flex-col px-5 py-4">
        {showTextHeader && (
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 mb-3 shrink-0">
            <div className="justify-self-start">
              {showTextNav ? (
                <InlineNavButton disabled={!canGoPrevText} onClick={onPrevText}>
                  Anterior
                </InlineNavButton>
              ) : (
                <div />
              )}
            </div>

            <div className="min-w-0 text-center">
              <div className="text-sm font-semibold text-slate-100 truncate">
                {effectiveTextLabel}
              </div>
            </div>

            <div className="justify-self-end">
              {showTextNav ? (
                <InlineNavButton disabled={!canGoNextText} onClick={onNextText}>
                  Siguiente
                </InlineNavButton>
              ) : (
                <div />
              )}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto flex items-center justify-center">
          <div className="w-full max-w-3xl">
            {brokenCount > 0 ? (
              <div className="mb-2 rounded-md border border-rose-500/40 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-200">
                Hay {brokenCount} referencia{brokenCount === 1 ? "" : "s"} rota
                {brokenCount === 1 ? "" : "s"} en el texto.
              </div>
            ) : null}

            <ResolvedTextRenderer
              parts={parts}
              emptyText="Esta capa no tiene texto para la variante seleccionada."
              wrapperClassName="wrap-break-word whitespace-pre-wrap text-center text-sm leading-relaxed text-slate-100"
              resolvedTokenClassName="font-mono text-sm text-fuchsia-200"
              brokenTokenClassName="font-mono text-sm text-red-200"
              brokenTokenTitle="Referencia rota"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative rounded-xl border-2 border-slate-800 bg-black overflow-hidden h-[620px] shadow-2xl flex flex-col">
      {renderLayerNav()}

      <div
        className={
          effectiveTextDock === "left" || effectiveTextDock === "right"
            ? "w-full min-h-0 flex-1 flex flex-row"
            : "w-full min-h-0 flex-1 flex flex-col"
        }
      >
        {textFirst && renderTextPanel()}

        <div className="relative flex-1 min-h-0 bg-black flex flex-col">
          {imageSrc ? (
            <div className="relative flex-1 min-h-0 w-full overflow-hidden bg-black">
              <div
                ref={stageRef}
                tabIndex={0}
                role="application"
                aria-label="Escena de prueba"
                className="relative z-10 h-full w-full flex items-center justify-center outline-none"
              >
                <div
                  ref={containerRef}
                  className="relative w-full h-full flex items-center justify-center"
                >
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt={title || "Escena"}
                    className="max-w-full max-h-full object-contain select-none"
                    draggable={false}
                    onLoad={refreshImageContentRect}
                  />

                  {contentRect && (
                    <div
                      className="absolute z-20"
                      style={{ left: contentRect.x, top: contentRect.y, width: contentRect.w, height: contentRect.h }}
                    >
                      {placedItemEntries.map(({ entry }) => (
                        <ScenePlacedItemSprite
                          key={`${entry.id}-sprite`}
                          entry={entry}
                          contentRect={{ w: contentRect.w, h: contentRect.h }}
                        />
                      ))}

                      {placedPlayerEntries.map(({ entry }) => (
                        <ScenePlacedPlayerSprite
                          key={`${entry.id}-sprite`}
                          entry={entry}
                          contentRect={{ w: contentRect.w, h: contentRect.h }}
                        />
                      ))}

                      {placedNpcEntries.map(({ entry }) => (
                        <ScenePlacedNpcSprite
                          key={`${entry.id}-sprite`}
                          entry={entry}
                          contentRect={{ w: contentRect.w, h: contentRect.h }}
                        />
                      ))}

                      {hotspotEntries.map(({ entry, ref }) => {
                        const rect = rectPx(entry.raw.shape, { w: contentRect.w, h: contentRect.h });
                        if (!rect) return null;

                        const isHovered = isSameRef(hoveredRef, ref);
                        const isPinned = isSameRef(pinnedRef, ref);
                        const label = entry.label.trim();
                        const canShowLabel = canRenderPreviewLabel({ label, width: rect.width, height: rect.height, minWidth: 28, minHeight: 14 });

                        return (
                          <button
                            key={entry.id}
                            type="button"
                            aria-label={entry.label}
                            className="absolute bg-transparent focus:outline-none"
                            style={{ ...rect, ...(baseOverlayStyle(isHovered, isPinned) ?? {}) }}
                            onMouseEnter={() => handleHoverTarget(ref)}
                            onMouseLeave={handleLeave}
                            onClick={() => handleSelectTarget(ref)}
                          >
                            {renderInspectTooltip(ref, isPinned)}

                            {canShowLabel ? (
                              <div className="pointer-events-none h-full w-full flex items-center justify-center px-1">
                                <div className="max-w-[92%] truncate rounded-md border border-fuchsia-500/70 bg-slate-950/70 px-2 py-0.5 text-[11px] leading-none text-slate-100">
                                  {label}
                                </div>
                              </div>
                            ) : null}
                          </button>
                        );
                      })}

                      {placedItemEntries.map(({ entry, ref }) => {
                        const rect = rectPx(entry.raw.placement?.shape, { w: contentRect.w, h: contentRect.h });
                        if (!rect) return null;

                        const isHovered = isSameRef(hoveredRef, ref);
                        const isPinned = isSameRef(pinnedRef, ref);

                        return (
                          <button
                            key={entry.id}
                            type="button"
                            aria-label={entry.label}
                            className="absolute bg-transparent focus:outline-none"
                            style={{ ...rect, ...(baseOverlayStyle(isHovered, isPinned) ?? {}) }}
                            onMouseEnter={() => handleHoverTarget(ref)}
                            onMouseLeave={handleLeave}
                            onClick={() => handleSelectTarget(ref)}
                          >
                            {renderInspectTooltip(ref, isPinned)}
                          </button>
                        );
                      })}

                      {placedNpcEntries.map(({ entry, ref }) => {
                        const rect = rectPx(entry.raw.shape, { w: contentRect.w, h: contentRect.h });
                        if (!rect) return null;

                        const isHovered = isSameRef(hoveredRef, ref);
                        const isPinned = isSameRef(pinnedRef, ref);

                        return (
                          <button
                            key={entry.id}
                            type="button"
                            aria-label={entry.npcName}
                            className="absolute bg-transparent focus:outline-none"
                            style={{ ...rect, ...(baseOverlayStyle(isHovered, isPinned) ?? {}) }}
                            onMouseEnter={() => handleHoverTarget(ref)}
                            onMouseLeave={handleLeave}
                            onClick={() => handleSelectTarget(ref)}
                          >
                            {renderInspectTooltip(ref, isPinned)}
                          </button>
                        );
                      })}

                      {placedPlayerEntries.map(({ entry, ref }) => {
                        const rect = rectPx(entry.raw.shape, { w: contentRect.w, h: contentRect.h });
                        if (!rect) return null;

                        const isHovered = isSameRef(hoveredRef, ref);
                        const isPinned = isSameRef(pinnedRef, ref);

                        return (
                          <button
                            key={entry.id}
                            type="button"
                            aria-label={entry.playerName}
                            className="absolute bg-transparent focus:outline-none"
                            style={{ ...rect, ...(baseOverlayStyle(isHovered, isPinned) ?? {}) }}
                            onMouseEnter={() => handleHoverTarget(ref)}
                            onMouseLeave={handleLeave}
                            onClick={() => handleSelectTarget(ref)}
                          >
                            {renderInspectTooltip(ref, isPinned)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-black px-4">
              <span className="text-center text-sm text-slate-500">
                Esta escena no tiene imagen definida.
              </span>
            </div>
          )}
        </div>

        {!textFirst && renderTextPanel()}
      </div>

      <div
        className={
          "pointer-events-none absolute inset-0 z-80 bg-black transition-opacity duration-120 " +
          (isBlackTransition ? "opacity-100" : "opacity-0")
        }
      />
    </div>
  );
}