import type { ItemInstance, PlaceableState } from "@/domain/types";
import type { InteractionKind } from "@/features/player/components/interactionCursors";
import { InteractiveRegionButton, rectPx, renderPlacedImage, type InteractiveLayerKind } from "@/features/player/components/interactive/interactiveLayerShared";

const placedItemInteractionKind: InteractionKind = "take";

type PlacedItemLayerProps = {
  cursorBlocked?: boolean;
  contentSize: { w: number; h: number };
  placedItems: Array<{ placedItem: ItemInstance; runtime?: PlaceableState; imageSrc?: string }>;
  revealHotspots: boolean;
  hoveredPlacedItemId: string | null;
  isUsingItem?: boolean;
  onHoverPlacedItem: (id: string | null) => void;
  clearHoveredExcept: (kind: InteractiveLayerKind) => void;
  onCursorMove?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorEnter?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onPlacedItemClick?: (placedItem: ItemInstance) => void;
  onPlacedItemUseItem?: (placedItem: ItemInstance) => void;
  onPlacedItemNotReachable?: (placedItem: ItemInstance, text: string) => void;
};

export function PlacedItemLayer({ cursorBlocked, contentSize, placedItems, revealHotspots, hoveredPlacedItemId, isUsingItem, onHoverPlacedItem,
  clearHoveredExcept, onCursorMove, onCursorEnter, onPlacedItemClick, onPlacedItemUseItem, onPlacedItemNotReachable }: PlacedItemLayerProps) {
  return (
    <>
      {placedItems.map(({ placedItem, runtime, imageSrc }) => {
        const placement = placedItem.placement;
        if (!placement) return null;

        const rect = rectPx(placement.shape, contentSize);
        if (!rect) return null;

        const reachable = runtime?.reachable ?? true;
        const notReachableText = runtime?.notReachableText?.trim() || placement.initialState.notReachableText?.trim() || "No puedes interactuar con eso ahora.";

        return (
          <div key={placedItem.itemInstanceId}>
            {renderPlacedImage(placedItem.itemInstanceId, imageSrc, rect, placedItem.label)}

            <InteractiveRegionButton
              entity={placedItem}
              entityId={placedItem.itemInstanceId}
              ariaLabel={placedItem.label}
              rect={rect}
              kind="item"
              interactionKind={placedItemInteractionKind}
              cursorBlocked={cursorBlocked}
              reachable={reachable}
              reveal={revealHotspots}
              isHovered={hoveredPlacedItemId === placedItem.itemInstanceId}
              isUsingItem={isUsingItem}
              notReachableText={notReachableText}
              onHover={onHoverPlacedItem}
              clearHoveredExcept={clearHoveredExcept}
              onCursorMove={onCursorMove}
              onCursorEnter={onCursorEnter}
              onPrimaryClick={onPlacedItemClick}
              onUseItem={onPlacedItemUseItem}
              onNotReachable={onPlacedItemNotReachable}
            />
          </div>
        );
      })}
    </>
  );
}