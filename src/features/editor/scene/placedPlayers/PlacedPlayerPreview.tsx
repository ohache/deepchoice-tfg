import type { CSSProperties } from "react";
import { useMemo } from "react";
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

function PlacedPlayerPreviewCard({ player, assetId, contentRectInContainer }: {
  player: PlacedPlayer;
  assetId: ID | null;
  contentRectInContainer: Rect | null;
}) {
  const imageUrl = useResolvedAssetUrl(assetId);
  const st = rectStyleFromShape(player.shape ?? null, contentRectInContainer);

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
      className="absolute rounded-sm overflow-hidden border-2 border-sky-400/60 bg-sky-500/10"
      title="Player"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Player"
          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
          draggable={false}
        />
      ) : null}

      <div className="absolute inset-0 bg-sky-500/10 pointer-events-none" />

      {!imageUrl && canShowFallbackLabel ? (
        <div className="absolute inset-x-1 bottom-1 flex justify-center pointer-events-none">
          <div className="px-2 py-0.5 rounded-md border border-sky-600 bg-slate-950/60 text-slate-100 text-[11px] leading-none truncate max-w-[90%] text-center">
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
  }, [project]);

  const basePlayers = draftPlayer
    ? placedPlayers.filter((player) => player.playerId !== draftPlayer.playerId)
    : placedPlayers;

  const playersToRender = draftPlayer ? [...basePlayers, draftPlayer] : basePlayers;

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