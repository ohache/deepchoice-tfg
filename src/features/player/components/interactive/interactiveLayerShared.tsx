import type { CSSProperties, MouseEvent } from "react";
import type { RegionShape } from "@/domain/types";
import type { InteractionKind } from "@/features/player/components/interactionCursors";

export type InteractiveLayerKind = "hotspot" | "item" | "npc";

export type RectPx = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function rectPx(shape: RegionShape, content: { w: number; h: number }): RectPx | null {
  if (shape.type !== "rect") return null;

  return { left: shape.x * content.w, top: shape.y * content.h, width: shape.w * content.w, height: shape.h * content.h };
}

export function buildRevealRingStyle(reveal: boolean, reachable: boolean): CSSProperties | undefined {
  if (!reveal) return undefined;

  return reachable ?
    {
      animation: "hotspotPulse 0.8s ease-in-out infinite",
      boxShadow: "0 0 0 2px rgba(251,191,36,0.65), 0 0 28px rgba(251,191,36,0.45), inset 0 0 0 2px rgba(251,191,36,0.28)",
      background: "rgba(251,191,36,0.12)",
      borderRadius: 12,
      backdropFilter: "blur(1px)",
    } : {
      animation: "hotspotPulse 0.8s ease-in-out infinite",
      boxShadow: "0 0 0 2px rgba(148,163,184,0.45), 0 0 22px rgba(148,163,184,0.28), inset 0 0 0 2px rgba(148,163,184,0.16)",
      background: "rgba(148,163,184,0.08)",
      borderRadius: 12,
      backdropFilter: "blur(1px)",
    };
}

export function buildUseItemHoverStyle(isUsingItem: boolean | undefined, isHovered: boolean, reachable: boolean): CSSProperties | undefined {
  if (!isUsingItem || !isHovered) return undefined;

  return reachable ?
    {
      boxShadow: "0 0 0 2px rgba(250,204,21,0.45), 0 0 16px rgba(250,204,21,0.22), inset 0 0 18px rgba(250,204,21,0.10)",
      background: "rgba(250,204,21,0.06)",
      borderRadius: 12,
    } : {
      boxShadow: "0 0 0 2px rgba(148,163,184,0.35), 0 0 12px rgba(148,163,184,0.16), inset 0 0 16px rgba(148,163,184,0.08)",
      background: "rgba(148,163,184,0.05)",
      borderRadius: 12,
    };
}

export function renderPlacedImage(key: string, imageSrc: string | undefined, rect: RectPx, alt = "") {
  if (!imageSrc) return null;

  return (
    <div key={`${key}-img`} className="absolute pointer-events-none" style={{ ...rect }}>
      <img src={imageSrc} alt={alt} className="h-full w-full select-none object-fill" draggable={false} />
    </div>
  );
}

type InteractiveRegionButtonProps<T> = {
  entity: T;
  entityId: string;
  ariaLabel: string;
  rect: RectPx;

  kind: InteractiveLayerKind;
  interactionKind: InteractionKind;

  cursorBlocked?: boolean;
  reachable: boolean;
  reveal: boolean;
  isHovered: boolean;
  isUsingItem?: boolean;
  notReachableText: string;

  onHover: (id: string | null) => void;
  clearHoveredExcept: (kind: InteractiveLayerKind) => void;

  onCursorMove?: (e: MouseEvent, kind?: InteractionKind) => void;
  onCursorEnter?: (e: MouseEvent, kind?: InteractionKind) => void;

  onPrimaryClick?: (entity: T) => void;
  onUseItem?: (entity: T) => void;
  onNotReachable?: (entity: T, text: string) => void;
};

export function InteractiveRegionButton<T>({ entity, entityId, ariaLabel, rect, kind, interactionKind, cursorBlocked, reachable, reveal, isHovered, isUsingItem,
  notReachableText, onHover, clearHoveredExcept, onCursorMove, onCursorEnter, onPrimaryClick, onUseItem, onNotReachable }: InteractiveRegionButtonProps<T>) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onMouseDown={(e) => {
        e.preventDefault();
        e.currentTarget.blur();
      }}
      onMouseEnter={(e) => {
        if (cursorBlocked) return;

        e.stopPropagation();
        onHover(entityId);
        clearHoveredExcept(kind);
        onCursorEnter?.(e, reachable ? interactionKind : "idle");
      }}
      onMouseMove={(e) => {
        if (cursorBlocked) return;

        e.stopPropagation();
        onHover(entityId);
        clearHoveredExcept(kind);
        onCursorMove?.(e, reachable ? interactionKind : "inspect");
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        e.currentTarget.blur();
        onHover(null);
        onCursorMove?.(e, "idle");
      }}
      onClick={(e) => {
        e.currentTarget.blur();

        if (cursorBlocked) return;

        if (!reachable) {
          onNotReachable?.(entity, notReachableText);
          return;
        }

        if (isUsingItem) {
          onUseItem?.(entity);
          return;
        }

        onPrimaryClick?.(entity);
      }}
      className="absolute bg-transparent outline-none focus:outline-none focus-visible:outline-none"
      style={{
        ...rect,
        ...buildRevealRingStyle(reveal, reachable),
        ...buildUseItemHoverStyle(isUsingItem, isHovered, reachable),
        cursor: cursorBlocked ? "auto" : "none",
        outline: "none",
      }}
      tabIndex={-1}
    />
  );
}