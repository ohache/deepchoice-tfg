import type { CSSProperties } from "react";
import type { PlaceableState, PlacedItem, RegionShape } from "@/domain/types";
import type { InteractionKind } from "@/features/player/components/interactionCursors";

type RectPx = { left: number; top: number; width: number; height: number };

const placedItemInteractionKind: InteractionKind = "take";

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

function renderPlacedImage(key: string, imageSrc: string | undefined, rect: RectPx, alt: string) {
  if (!imageSrc) return null;

  return (
    <div key={`${key}-img`} className="absolute pointer-events-none" style={{ ...rect }}>
      <img src={imageSrc} alt={alt} className="w-full h-full object-fill select-none" draggable={false} />
    </div>
  );
}

export function PlacedItemLayer(props: {
  cursorBlocked?: boolean;
  contentSize: { w: number; h: number };
  placedItems: Array<{ placedItem: PlacedItem; runtime?: PlaceableState; imageSrc?: string }>;
  revealHotspots: boolean;
  hoveredPlacedItemId: string | null;
  isUsingItem?: boolean;
  onHoverPlacedItem: (id: string | null) => void;
  clearHoveredExcept: (kind: "hotspot" | "item" | "npc") => void;
  onCursorMove?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorEnter?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onPlacedItemClick?: (placedItem: PlacedItem) => void;
  onPlacedItemUseItem?: (placedItem: PlacedItem) => void;
  onPlacedItemNotReachable?: (placedItem: PlacedItem, text: string) => void;
}) {
  const { cursorBlocked, contentSize, placedItems, revealHotspots, hoveredPlacedItemId, isUsingItem, onHoverPlacedItem, clearHoveredExcept, onCursorMove,
    onCursorEnter, onPlacedItemClick, onPlacedItemUseItem, onPlacedItemNotReachable } = props;

  return (
    <>
      {placedItems.map(({ placedItem, runtime, imageSrc }) => {
        const rect = rectPx(placedItem.shape, contentSize);
        if (!rect) return null;

        const reachable = runtime?.reachable ?? true;
        const notReachableText = runtime?.notReachableText?.trim() || placedItem.initialState?.notReachableText?.trim() || "No puedes interactuar con eso ahora.";

        return (
          <div key={placedItem.id}>
            {renderPlacedImage(placedItem.id, imageSrc, rect, placedItem.label)}

            <button
              type="button"
              aria-label={placedItem.label}
              onMouseEnter={(e) => {
                if (cursorBlocked) return;
                e.stopPropagation();
                onHoverPlacedItem(placedItem.id);
                clearHoveredExcept("item");
                onCursorEnter?.(e, reachable ? placedItemInteractionKind : "idle");
              }}
              onMouseMove={(e) => {
                if (cursorBlocked) return;
                e.stopPropagation();
                onHoverPlacedItem(placedItem.id);
                clearHoveredExcept("item");
                onCursorMove?.(e, reachable ? placedItemInteractionKind : "idle");
              }}
              onMouseLeave={(e) => {
                e.stopPropagation();
                onHoverPlacedItem(null);
                onCursorMove?.(e, "idle");
              }}
              onClick={() => {
                if (cursorBlocked) return;

                if (!reachable) {
                  onPlacedItemNotReachable?.(placedItem, notReachableText);
                  return;
                }

                if (isUsingItem) {
                  onPlacedItemUseItem?.(placedItem);
                  return;
                }

                onPlacedItemClick?.(placedItem);
              }}
              className="absolute bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-0"
              style={{
                ...rect,
                ...buildRevealRingStyle(revealHotspots, reachable),
                ...buildUseItemHoverStyle(isUsingItem, hoveredPlacedItemId === placedItem.id, reachable),
                cursor: cursorBlocked ? "auto" : "none",
              }}
              tabIndex={-1}
            />
          </div>
        );
      })}
    </>
  );
}