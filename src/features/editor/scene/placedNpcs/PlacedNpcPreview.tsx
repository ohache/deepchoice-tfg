import { useMemo, type CSSProperties } from "react";
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

type PlacedNpcPreviewCardProps = {
  npc: PlacedNpc;
  assetId: ID | null;
  contentRectInContainer: Rect | null;
};

function pxToNumber(value: CSSProperties["width"] | CSSProperties["height"]): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace("px", "")) || 0;
  return 0;
}

function canRenderFallbackLabel(width: number, height: number): boolean {
  return width >= 50 && height >= 20;
}

function PlacedNpcPreviewCard({ npc, assetId, contentRectInContainer }: PlacedNpcPreviewCardProps) {
  const imageUrl = useResolvedAssetUrl(assetId);
  const style = rectStyleFromShape(npc.shape ?? null, contentRectInContainer);

  const sizeInfo = useMemo(() => {
    if (!style) return { width: 0, height: 0 };

    return { width: pxToNumber(style.width), height: pxToNumber(style.height) };
  }, [style]);

  if (!style) return null;

  const showFallbackLabel = !imageUrl && canRenderFallbackLabel(sizeInfo.width, sizeInfo.height);

  return (
    <div
      style={style}
      className="absolute overflow-hidden rounded-sm border-2 border-lime-400/60 bg-lime-700/10"
      title="NPC"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="NPC"
          className="absolute inset-0 h-full w-full select-none object-fill pointer-events-none"
          draggable={false}
        />
      ) : null}

      <div className="absolute inset-0 bg-lime-500/10 pointer-events-none" />

      {showFallbackLabel ? (
        <div className="absolute inset-x-1 bottom-1 flex justify-center pointer-events-none">
          <div className="max-w-[90%] truncate rounded-md border border-lime-600 bg-slate-950/60 px-2 py-0.5 text-center text-[11px] leading-none text-slate-100">
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
  }, [project?.assets]);

  const npcsToRender = useMemo(() => {
    const baseNpcs = draftNpc ? placedNpcs.filter((npc) => npc.npcId !== draftNpc.npcId) : placedNpcs;

    return draftNpc ? [...baseNpcs, draftNpc] : baseNpcs;
  }, [placedNpcs, draftNpc]);

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