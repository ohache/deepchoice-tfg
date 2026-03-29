import { useMemo } from "react";
import type { CSSProperties } from "react";
import type { ID, PlacedItem, Project } from "@/domain/types";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { rectStyleFromShape } from "@/features/editor/hooks/regionShape";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";

type PlacedItemPreviewProps = {
  placedItems: PlacedItem[];
  project: Project | null;
  contentRectInContainer: Rect | null;
  draftItem?: PlacedItem | null;
};

function PlacedItemPreviewCard({ item, assetId, contentRectInContainer }: { item: PlacedItem; assetId: ID | null; contentRectInContainer: Rect | null }) {
  const imageUrl = useResolvedAssetUrl(assetId);
  const st = rectStyleFromShape(item.shape ?? null, contentRectInContainer);

  const sizeInfo = useMemo(() => {
    if (!st) return { w: 0, h: 0 };
    const width = Number(String((st as CSSProperties).width ?? "0").replace("px", "")) || 0;
    const height = Number(String((st as CSSProperties).height ?? "0").replace("px", "")) || 0;
    return { w: width, h: height };
  }, [st]);

  if (!st) return null;

  const label = (item.label ?? "").trim();
  const canShowLabel = !!label && sizeInfo.w >= 50 && sizeInfo.h >= 20;

  return (
    <div
      style={st}
      className="absolute rounded-sm overflow-hidden border-2 border-amber-400/60 bg-amber-500/10"
      title={label}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={label || "Item"}
          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
          draggable={false}
        />
      ) : null}

      <div className="absolute inset-0 bg-amber-500/10 pointer-events-none" />

      {canShowLabel ? (
        <div className="absolute inset-x-1 bottom-1 flex justify-center pointer-events-none">
          <div className="px-2 py-0.5 rounded-md border border-amber-600 bg-slate-950/60 text-slate-100 text-[11px] leading-none truncate max-w-[90%] text-center">
            {label}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PlacedItemPreview({ placedItems, project, contentRectInContainer, draftItem = null }: PlacedItemPreviewProps) {
  const assetIdByItemId = useMemo(() => {
    const assets = project?.assets ?? [];
    const map = new Map<ID, ID>();

    for (const asset of assets) {
      if (asset.kind !== "items") continue;
      map.set(asset.id, asset.id);
    }

    return map;
  }, [project]);

  const baseItems = draftItem ? placedItems.filter((item) => item.id !== draftItem.id) : placedItems;
  const itemsToRender = draftItem ? [...baseItems, draftItem] : baseItems;

  if (!itemsToRender.length) return null;

  return (
    <>
      {itemsToRender.map((item) => (
        <PlacedItemPreviewCard
          key={item.id}
          item={item}
          assetId={assetIdByItemId.get(item.itemId) ?? null}
          contentRectInContainer={contentRectInContainer}
        />
      ))}
    </>
  );
}