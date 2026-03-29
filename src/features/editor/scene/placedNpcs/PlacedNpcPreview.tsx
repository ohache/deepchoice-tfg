import type { CSSProperties } from "react";
import { useMemo } from "react";
import type { ID, PlacedNpc, Project } from "@/domain/types";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { rectStyleFromShape } from "@/features/editor/hooks/regionShape";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";

type PlacedNpcPreviewProps = {
  placedNpcs: PlacedNpc[];
  project: Project | null;
  contentRectInContainer: Rect | null;
  draftNpc?: PlacedNpc | null;
};

function PlacedNpcPreviewCard({ npc, assetId, contentRectInContainer }: {
  npc: PlacedNpc;
  assetId: ID | null;
  contentRectInContainer: Rect | null;
}) {
  const imageUrl = useResolvedAssetUrl(assetId);
  const st = rectStyleFromShape(npc.shape ?? null, contentRectInContainer);

  const sizeInfo = useMemo(() => {
    if (!st) return { w: 0, h: 0 };
    const width = Number(String((st as CSSProperties).width ?? "0").replace("px", "")) || 0;
    const height = Number(String((st as CSSProperties).height ?? "0").replace("px", "")) || 0;
    return { w: width, h: height };
  }, [st]);

  if (!st) return null;

  const canShowFallbackLabel = sizeInfo.w >= 50 && sizeInfo.h >= 20;

  return (
    <div
      style={st}
      className="absolute rounded-sm overflow-hidden border-2 border-violet-400/60 bg-violet-500/10"
      title="NPC"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="NPC"
          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
          draggable={false}
        />
      ) : null}

      <div className="absolute inset-0 bg-violet-500/10 pointer-events-none" />

      {!imageUrl && canShowFallbackLabel ? (
        <div className="absolute inset-x-1 bottom-1 flex justify-center pointer-events-none">
          <div className="px-2 py-0.5 rounded-md border border-violet-600 bg-slate-950/60 text-slate-100 text-[11px] leading-none truncate max-w-[90%] text-center">
            NPC
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PlacedNpcPreview({ placedNpcs, project, contentRectInContainer, draftNpc = null }: PlacedNpcPreviewProps) {
  const assetIdByNpcId = useMemo(() => {
    const assets = project?.assets ?? [];
    const map = new Map<ID, ID>();

    for (const asset of assets) {
      if (asset.kind !== "npcs") continue;
      map.set(asset.id, asset.id);
    }

    return map;
  }, [project]);

  const baseNpcs = draftNpc
    ? placedNpcs.filter((npc) => npc.npcId !== draftNpc.npcId)
    : placedNpcs;

  const npcsToRender = draftNpc ? [...baseNpcs, draftNpc] : baseNpcs;

  if (!npcsToRender.length) return null;

  return (
    <>
      {npcsToRender.map((npc) => (
        <PlacedNpcPreviewCard
          key={npc.npcId}
          npc={npc}
          assetId={assetIdByNpcId.get(npc.npcId) ?? null}
          contentRectInContainer={contentRectInContainer}
        />
      ))}
    </>
  );
}