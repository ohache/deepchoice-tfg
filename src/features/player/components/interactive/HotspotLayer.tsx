import type { Hotspot, PlaceableState } from "@/domain/types";
import { getTravelInteractionKindFromHotspotCenter, type InteractionKind } from "@/features/player/components/interactionCursors";
import { InteractiveRegionButton, rectPx, type InteractiveLayerKind } from "@/features/player/components/interactive/interactiveLayerShared";

type HotspotLayerProps = {
  cursorBlocked?: boolean;
  contentSize: { w: number; h: number };
  hotspots: Array<{ hotspot: Hotspot; runtime?: PlaceableState }>;
  revealHotspots: boolean;
  hoveredHotspotId: string | null;
  isUsingItem?: boolean;
  onHoverHotspot: (id: string | null) => void;
  clearHoveredExcept: (kind: InteractiveLayerKind) => void;
  onCursorMove?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorEnter?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onHotspotClick?: (hotspot: Hotspot) => void;
  onHotspotUseItem?: (hotspot: Hotspot) => void;
  onNotReachable?: (hotspot: Hotspot, text: string) => void;
};

export function HotspotLayer({ cursorBlocked, contentSize, hotspots, revealHotspots, hoveredHotspotId, isUsingItem, onHoverHotspot,
  clearHoveredExcept, onCursorMove, onCursorEnter, onHotspotClick, onHotspotUseItem, onNotReachable }: HotspotLayerProps) {
  return (
    <>
      {hotspots.map(({ hotspot, runtime }) => {
        const rect = rectPx(hotspot.shape, contentSize);
        if (!rect) return null;

        const reachable = runtime?.reachable ?? true;
        const interactionKind = getTravelInteractionKindFromHotspotCenter(hotspot);
        const notReachableText = runtime?.notReachableText?.trim() || hotspot.initialState.notReachableText?.trim() || "No puedes interactuar con eso ahora.";

        return (
          <InteractiveRegionButton
            key={hotspot.id}
            entity={hotspot}
            entityId={hotspot.id}
            ariaLabel={hotspot.label}
            rect={rect}
            kind="hotspot"
            interactionKind={interactionKind}
            cursorBlocked={cursorBlocked}
            reachable={reachable}
            reveal={revealHotspots}
            isHovered={hoveredHotspotId === hotspot.id}
            isUsingItem={isUsingItem}
            notReachableText={notReachableText}
            onHover={onHoverHotspot}
            clearHoveredExcept={clearHoveredExcept}
            onCursorMove={onCursorMove}
            onCursorEnter={onCursorEnter}
            onPrimaryClick={onHotspotClick}
            onUseItem={onHotspotUseItem}
            onNotReachable={onNotReachable}
          />
        );
      })}
    </>
  );
}