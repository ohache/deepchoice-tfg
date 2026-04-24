import { useMemo, type CSSProperties } from "react";
import type { ID, PlacedPlayer, Project } from "@/domain/types";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { rectStyleFromShape } from "@/features/editor/hooks/regionShape";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";

type PlacedPlayerPreviewProps = {
  placedPlayers: PlacedPlayer[];
  project: Project | null;
  contentRectInContainer: Rect | null;
  draftPlayer?: PlacedPlayer | null;
};

type PlacedPlayerPreviewCardProps = {
  player: PlacedPlayer;
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

function PlacedPlayerPreviewCard({ player, assetId, contentRectInContainer }: PlacedPlayerPreviewCardProps) {
  const imageUrl = useResolvedAssetUrl(assetId);
  const style = rectStyleFromShape(player.shape ?? null, contentRectInContainer);

  const sizeInfo = useMemo(() => {
    if (!style) return { width: 0, height: 0 };

    return { width: pxToNumber(style.width), height: pxToNumber(style.height) };
  }, [style]);

  if (!style) return null;

  const showFallbackLabel = !imageUrl && canRenderFallbackLabel(sizeInfo.width, sizeInfo.height);

  return (
    <div
      style={style}
      className="absolute overflow-hidden rounded-sm border-2 border-emerald-400/60 bg-emerald-500/10"
      title="Player"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Player"
          className="absolute inset-0 h-full w-full select-none object-fill pointer-events-none"
          draggable={false}
        />
      ) : null}

      <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />

      {showFallbackLabel ? (
        <div className="absolute inset-x-1 bottom-1 flex justify-center pointer-events-none">
          <div className="max-w-[90%] truncate rounded-md border border-emerald-600 bg-slate-950/60 px-2 py-0.5 text-center text-[11px] leading-none text-slate-100">
            Player
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PlacedPlayerPreview({ placedPlayers, project, contentRectInContainer, draftPlayer = null }: PlacedPlayerPreviewProps) {
  const assetIdByPlayerImageId = useMemo(() => {
    const assets = project?.assets ?? [];
    const map = new Map<ID, ID>();

    for (const asset of assets) {
      if (asset.kind !== "players") continue;
      map.set(asset.id, asset.id);
    }

    return map;
  }, [project?.assets]);

  const playersToRender = useMemo(() => {
    const basePlayers = draftPlayer ? placedPlayers.filter((player) => player.playerId !== draftPlayer.playerId) : placedPlayers;

    return draftPlayer ? [...basePlayers, draftPlayer] : basePlayers;
  }, [placedPlayers, draftPlayer]);

  if (!playersToRender.length) return null;

  return (
    <>
      {playersToRender.map((player) => (
        <PlacedPlayerPreviewCard
          key={player.playerId}
          player={player}
          assetId={assetIdByPlayerImageId.get(player.initialImageId) ?? null}
          contentRectInContainer={contentRectInContainer}
        />
      ))}
    </>
  );
}