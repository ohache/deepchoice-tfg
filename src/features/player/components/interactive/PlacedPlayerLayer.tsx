import type { PlacedPlayer, PlacedPlayerState, RegionShape } from "@/domain/types";

type RectPx = { left: number; top: number; width: number; height: number };

function rectPx(shape: RegionShape, content: { w: number; h: number }): RectPx | null {
  if (shape.type !== "rect") return null;

  return {
    left: shape.x * content.w,
    top: shape.y * content.h,
    width: shape.w * content.w,
    height: shape.h * content.h,
  };
}

export function PlacedPlayerLayer(props: { contentSize: { w: number; h: number };
  placedPlayers: Array<{ placedPlayer: PlacedPlayer; runtime?: PlacedPlayerState; imageSrc?: string }> }) {
  const { contentSize, placedPlayers } = props;

  return (
    <>
      {placedPlayers.map(({ placedPlayer, imageSrc }) => {
        const rect = rectPx(placedPlayer.shape, contentSize);
        if (!rect || !imageSrc) return null;

        return (
          <div key={placedPlayer.playerId} className="absolute pointer-events-none" style={{ ...rect }}>
            <img src={imageSrc} alt="" className="w-full h-full object-fill select-none" draggable={false} />
          </div>
        );
      })}
    </>
  );
}