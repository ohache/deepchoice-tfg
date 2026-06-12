import type { CSSProperties } from "react";
import type { Hotspot, PlaceableState, RegionShape } from "@/domain/types";
import { getTravelInteractionKindFromHotspotCenter, type InteractionKind } from "@/features/player/components/interactionCursors";

type RectPx = { left: number; top: number; width: number; height: number };

function rectPx(shape: RegionShape, content: { w: number; h: number }): RectPx | null {
  if (shape.type !== "rect") return null;

  return {
    left: shape.x * content.w,
    top: shape.y * content.h,
    width: shape.w * content.w,
    height: shape.h * content.h,
  };
}

function buildRevealRingStyle(reveal: boolean, reachable: boolean): CSSProperties | undefined {
  if (!reveal) return undefined;

  return reachable
    ? {
        animation: "hotspotPulse 0.8s ease-in-out infinite",
        boxShadow:
          "0 0 0 2px rgba(251,191,36,0.65), 0 0 28px rgba(251,191,36,0.45), inset 0 0 0 2px rgba(251,191,36,0.28)",
        background: "rgba(251,191,36,0.12)",
        borderRadius: 12,
        backdropFilter: "blur(1px)",
      }
    : {
        animation: "hotspotPulse 0.8s ease-in-out infinite",
        boxShadow:
          "0 0 0 2px rgba(148,163,184,0.45), 0 0 22px rgba(148,163,184,0.28), inset 0 0 0 2px rgba(148,163,184,0.16)",
        background: "rgba(148,163,184,0.08)",
        borderRadius: 12,
        backdropFilter: "blur(1px)",
      };
}

function buildUseItemHoverStyle(
  isUsingItem: boolean | undefined,
  isHovered: boolean,
  reachable: boolean
): CSSProperties | undefined {
  if (!isUsingItem || !isHovered) return undefined;

  return reachable
    ? {
        boxShadow:
          "0 0 0 2px rgba(250,204,21,0.45), 0 0 16px rgba(250,204,21,0.22), inset 0 0 18px rgba(250,204,21,0.10)",
        background: "rgba(250,204,21,0.06)",
        borderRadius: 12,
      }
    : {
        boxShadow:
          "0 0 0 2px rgba(148,163,184,0.35), 0 0 12px rgba(148,163,184,0.16), inset 0 0 16px rgba(148,163,184,0.08)",
        background: "rgba(148,163,184,0.05)",
        borderRadius: 12,
      };
}

export function HotspotLayer(props: {
  cursorBlocked?: boolean;
  contentSize: { w: number; h: number };
  hotspots: Array<{ hotspot: Hotspot; runtime?: PlaceableState }>;
  revealHotspots: boolean;
  hoveredHotspotId: string | null;
  isUsingItem?: boolean;
  onHoverHotspot: (id: string | null) => void;
  clearHoveredExcept: (kind: "hotspot" | "item" | "npc") => void;
  onCursorMove?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorEnter?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onHotspotClick?: (hotspot: Hotspot) => void;
  onHotspotUseItem?: (hotspot: Hotspot) => void;
  onNotReachable?: (hotspot: Hotspot, text: string) => void;
}) {
  const { cursorBlocked, contentSize, hotspots, revealHotspots,  hoveredHotspotId, isUsingItem, onHoverHotspot, clearHoveredExcept, onCursorMove,
    onCursorEnter, onHotspotClick, onHotspotUseItem, onNotReachable } = props;

  return (
    <>
      {hotspots.map(({ hotspot, runtime }) => {
        const rect = rectPx(hotspot.shape, contentSize);
        if (!rect) return null;

        const reachable = runtime?.reachable ?? true;
        const interactionKind = getTravelInteractionKindFromHotspotCenter(hotspot);
        const notReachableText = runtime?.notReachableText?.trim() || hotspot.initialState?.notReachableText?.trim() || "No puedes interactuar con eso ahora.";

        return (
          <button
            key={hotspot.id}
            type="button"
            aria-label={hotspot.label}
            onMouseEnter={(e) => {
              if (cursorBlocked) return;
              e.stopPropagation();
              onHoverHotspot(hotspot.id);
              clearHoveredExcept("hotspot");
              onCursorEnter?.(e, reachable ? interactionKind : "idle");
            }}
            onMouseMove={(e) => {
              if (cursorBlocked) return;
              e.stopPropagation();
              onHoverHotspot(hotspot.id);
              clearHoveredExcept("hotspot");
              onCursorMove?.(e, reachable ? interactionKind : "idle");
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              onHoverHotspot(null);
              onCursorMove?.(e, "idle");
            }}
            onClick={() => {
              if (cursorBlocked) return;

              if (!reachable) {
                onNotReachable?.(hotspot, notReachableText);
                return;
              }

              if (isUsingItem) {
                onHotspotUseItem?.(hotspot);
                return;
              }

              onHotspotClick?.(hotspot);
            }}
            className="absolute bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-0"
            style={{
              ...rect,
              ...buildRevealRingStyle(revealHotspots, reachable),
              ...buildUseItemHoverStyle(isUsingItem, hoveredHotspotId === hotspot.id, reachable),
              cursor: cursorBlocked ? "auto" : "none",
            }}
            tabIndex={-1}
          />
        );
      })}
    </>
  );
}