import { useMemo, type CSSProperties } from "react";
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

type PlacedItemPreviewCardProps = {
  item: PlacedItem;
  assetId: ID | null;
  contentRectInContainer: Rect | null;
};

function pxToNumber(value: CSSProperties["width"] | CSSProperties["height"]): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace("px", "")) || 0;
  return 0;
}

function canRenderLabel(label: string, width: number, height: number): boolean {
  return Boolean(label) && width >= 50 && height >= 20;
}

function PlacedItemPreviewCard({ item, assetId, contentRectInContainer }: PlacedItemPreviewCardProps) {
  const imageUrl = useResolvedAssetUrl(assetId);
  const style = rectStyleFromShape(item.shape ?? null, contentRectInContainer);

  const sizeInfo = useMemo(() => {
    if (!style) return { width: 0, height: 0 };

    return { width: pxToNumber(style.width), height: pxToNumber(style.height) };
  }, [style]);

  if (!style) return null;

  const label = (item.label ?? "").trim();
  const showLabel = canRenderLabel(label, sizeInfo.width, sizeInfo.height);

  return (
    <div
      style={style}
      className="absolute overflow-hidden rounded-sm border-2 border-red-400/60 bg-red-500/10"
      title={label}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={label || "Item"}
          className="absolute inset-0 h-full w-full select-none object-fill pointer-events-none"
          draggable={false}
        />
      ) : null}

      <div className="absolute inset-0 bg-red-500/10 pointer-events-none" />

      {showLabel ? (
        <div className="absolute inset-x-1 bottom-1 flex justify-center pointer-events-none">
          <div className="max-w-[90%] truncate rounded-md border border-red-600 bg-slate-950/60 px-2 py-0.5 text-center text-[11px] leading-none text-slate-100">
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
  }, [project?.assets]);

  const itemsToRender = useMemo(() => {
    const baseItems = draftItem ? placedItems.filter((item) => item.id !== draftItem.id) : placedItems;

    return draftItem ? [...baseItems, draftItem] : baseItems;
  }, [placedItems, draftItem]);

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