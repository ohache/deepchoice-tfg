import type { PlacedPlayer, PlacedPlayerState } from "@/domain/types";
import { rectPx } from "@/features/player/components/interactive/interactiveLayerShared";

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