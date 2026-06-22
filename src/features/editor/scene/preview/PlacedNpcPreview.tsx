import { useMemo } from "react";
import type { ID, PlacedNpc, Project } from "@/domain/types";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { rectStyleFromShape } from "@/features/editor/hooks/regionShape";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";
import { canRenderPreviewLabel, getCssRectSize, getNpcName, mergePreviewDraft } from "@/features/editor/scene/preview/previewRenderHelpers";

type PlacedNpcPreviewProps = {
  placedNpcs: PlacedNpc[];
  project: Project | null;
  contentRectInContainer: Rect | null;
  draftNpc?: PlacedNpc | null;
};

type PlacedNpcPreviewCardProps = {
  npc: PlacedNpc;
  assetId: ID | null;
  npcName: string;
  contentRectInContainer: Rect | null;
};

function PlacedNpcPreviewCard({ npc, assetId, npcName, contentRectInContainer }: PlacedNpcPreviewCardProps) {
  const imageUrl = useResolvedAssetUrl(assetId);
  const style = rectStyleFromShape(npc.shape ?? null, contentRectInContainer);

  const sizeInfo = useMemo(() => getCssRectSize(style), [style]);

  if (!style) return null;

  const label = npcName.trim() || "PNJ";

  const showLabel = canRenderPreviewLabel({ label, width: sizeInfo.width, height: sizeInfo.height });

  return (
    <div
      style={style}
      className="absolute overflow-hidden rounded-sm border-2 border-lime-400/60 bg-lime-700/10"
      title={label}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={label}
          className="absolute inset-0 h-full w-full select-none object-fill pointer-events-none"
          draggable={false}
        />
      ) : null}

      <div className="absolute inset-0 bg-lime-500/10 pointer-events-none" />

      {showLabel ? (
        <div className="absolute inset-x-1 bottom-1 flex justify-center pointer-events-none">
          <div className="max-w-[90%] truncate rounded-md border border-lime-600 bg-slate-950/60 px-2 py-0.5 text-center text-[11px] leading-none text-slate-100">
            {label}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PlacedNpcPreview({ placedNpcs, project, contentRectInContainer, draftNpc = null }: PlacedNpcPreviewProps) {
  const npcAssetIds = useMemo(() => {
    const assets = project?.assets ?? [];
    const ids = new Set<ID>();

    for (const asset of assets) {
      if (asset.kind === "npcs") ids.add(asset.id);
    }

    return ids;
  }, [project?.assets]);

  const npcsToRender = useMemo(() => mergePreviewDraft(placedNpcs, draftNpc, (npc) => npc.npcId), [placedNpcs, draftNpc]);

  if (!npcsToRender.length) return null;

  return (
    <>
      {npcsToRender.map((npc) => (
        <PlacedNpcPreviewCard
          key={npc.npcId}
          npc={npc}
          npcName={getNpcName(project, npc.npcId)}
          assetId={npcAssetIds.has(npc.npcId) ? npc.npcId : null}
          contentRectInContainer={contentRectInContainer}
        />
      ))}
    </>
  );
}