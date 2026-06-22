import type { PlaceableState, PlacedNpc } from "@/domain/types";
import type { InteractionKind } from "@/features/player/components/interactionCursors";
import { InteractiveRegionButton, rectPx, renderPlacedImage, type InteractiveLayerKind } from "@/features/player/components/interactive/interactiveLayerShared";

const placedNpcInteractionKind: InteractionKind = "talk";

type PlacedNpcLayerProps = {
  cursorBlocked?: boolean;
  contentSize: { w: number; h: number };
  placedNpcs: Array<{ placedNpc: PlacedNpc; runtime?: PlaceableState; imageSrc?: string }>;
  revealHotspots: boolean;
  hoveredPlacedNpcId: string | null;
  isUsingItem?: boolean;
  onHoverPlacedNpc: (id: string | null) => void;
  clearHoveredExcept: (kind: InteractiveLayerKind) => void;
  onCursorMove?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorEnter?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onPlacedNpcClick?: (placedNpc: PlacedNpc) => void;
  onPlacedNpcUseItem?: (placedNpc: PlacedNpc) => void;
  onPlacedNpcNotReachable?: (placedNpc: PlacedNpc, text: string) => void;
};

export function PlacedNpcLayer({ cursorBlocked, contentSize, placedNpcs, revealHotspots, hoveredPlacedNpcId, isUsingItem, onHoverPlacedNpc,
  clearHoveredExcept, onCursorMove, onCursorEnter, onPlacedNpcClick, onPlacedNpcUseItem, onPlacedNpcNotReachable }: PlacedNpcLayerProps) {
  return (
    <>
      {placedNpcs.map(({ placedNpc, runtime, imageSrc }) => {
        const rect = rectPx(placedNpc.shape, contentSize);
        if (!rect) return null;

        const reachable = runtime?.reachable ?? true;
        const notReachableText = runtime?.notReachableText?.trim() || placedNpc.initialState.notReachableText?.trim() || "No puedes interactuar con eso ahora.";

        return (
          <div key={placedNpc.npcId}>
            {renderPlacedImage(placedNpc.npcId, imageSrc, rect)}

            <InteractiveRegionButton
              entity={placedNpc}
              entityId={placedNpc.npcId}
              ariaLabel={placedNpc.npcId}
              rect={rect}
              kind="npc"
              interactionKind={placedNpcInteractionKind}
              cursorBlocked={cursorBlocked}
              reachable={reachable}
              reveal={revealHotspots}
              isHovered={hoveredPlacedNpcId === placedNpc.npcId}
              isUsingItem={isUsingItem}
              notReachableText={notReachableText}
              onHover={onHoverPlacedNpc}
              clearHoveredExcept={clearHoveredExcept}
              onCursorMove={onCursorMove}
              onCursorEnter={onCursorEnter}
              onPrimaryClick={onPlacedNpcClick}
              onUseItem={onPlacedNpcUseItem}
              onNotReachable={onPlacedNpcNotReachable}
            />
          </div>
        );
      })}
    </>
  );
}