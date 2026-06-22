import { useMemo } from "react";
import type { ID, ItemInstance, Project } from "@/domain/types";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { rectStyleFromShape } from "@/features/editor/hooks/regionShape";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";
import { canRenderPreviewLabel, getCssRectSize, mergePreviewDraft } from "@/features/editor/scene/preview/previewRenderHelpers";

type PlacedItemPreviewProps = {
  placedItems: ItemInstance[];
  project: Project | null;
  contentRectInContainer: Rect | null;
  draftItem?: ItemInstance | null;
};

type PlacedItemPreviewCardProps = {
  item: ItemInstance;
  assetId: ID | null;
  contentRectInContainer: Rect | null;
};

function PlacedItemPreviewCard({ item, assetId, contentRectInContainer }: PlacedItemPreviewCardProps) {
  const imageUrl = useResolvedAssetUrl(assetId);
  const style = rectStyleFromShape(item.placement?.shape ?? null, contentRectInContainer);

  const sizeInfo = useMemo(() => getCssRectSize(style), [style]);

  if (!style) return null;

  const label = (item.label ?? "").trim();
  const showLabel = canRenderPreviewLabel({ label, width: sizeInfo.width, height: sizeInfo.height });

  return (
    <div
      style={style}
      className="absolute overflow-hidden rounded-sm border-2 border-red-400/60 bg-red-500/10"
      title={label}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={label || "Objeto"}
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
  const itemAssetIds = useMemo(() => {
    const assets = project?.assets ?? [];
    const ids  = new Set<ID>();

    for (const asset of assets) {
      if (asset.kind === "items") ids.add(asset.id);
    }

    return ids;
  }, [project?.assets]);

  const itemsToRender = useMemo(() => mergePreviewDraft(placedItems, draftItem, (item) => item.itemInstanceId), [placedItems, draftItem]);

  if (!itemsToRender.length) return null;

  return (
    <>
      {itemsToRender.map((item) => (
        <PlacedItemPreviewCard
          key={item.itemInstanceId}
          item={item}
          assetId={itemAssetIds.has(item.itemId) ? item.itemId : null}
          contentRectInContainer={contentRectInContainer}
        />
      ))}
    </>
  );
}