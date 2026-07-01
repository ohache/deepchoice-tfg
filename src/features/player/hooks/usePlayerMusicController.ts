import { useEffect, useMemo } from "react";
import type { ID, Node } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import type { AudioAdapter } from "@/engine/adapters/SfxAdapter";
import { musicMarkPlaybackStarted, musicMarkPlaybackStopped, musicRememberPosition, selectSavedTrackPosition } from "@/engine/state/slices/musicSlice";
import { useGameStore } from "@/store/gameStore";
import { useSceneAudio } from "@/features/player/hooks/useSceneAudio";
import { resolveAssetIdToSrc } from "@/features/player/utils/playerAssetResolution";

export function usePlayerMusicController(args: {
  gameState: GameState | null;
  runtimeNode: Node | null;
  assetIdToFile: Map<ID, string>;
  assetUrls: Record<string, string>;
  audioAdapter: AudioAdapter;
  musicVolume: number;
  sfxVolume: number;
}) {
  const { gameState, assetIdToFile, assetUrls, audioAdapter, musicVolume, sfxVolume } = args;

  const activeMusicTrackId = useMemo(() => {
    if (!gameState) return undefined;

    if (gameState.gameEnded && gameState.ending?.musicTrackId) {
      return gameState.ending.musicTrackId;
    }

    return gameState.music.targetTrackId;
  }, [gameState]);

  const activeMusicSrc = useMemo(() => {
    return resolveAssetIdToSrc(activeMusicTrackId, assetIdToFile, assetUrls);
  }, [activeMusicTrackId, assetIdToFile, assetUrls]);

  const savedMusicPosition = useMemo(() => {
    if (!gameState?.music || !activeMusicTrackId) return 0;

    if (gameState.gameEnded && gameState.ending?.musicTrackId === activeMusicTrackId) return 0;

    return selectSavedTrackPosition(gameState.music, activeMusicTrackId);
  }, [gameState?.music, gameState?.gameEnded, gameState?.ending?.musicTrackId, activeMusicTrackId]);

  const { audioRef } = useSceneAudio({
    targetTrackId: gameState?.music.targetTrackId,
    currentTrackId: gameState?.music.currentTrackId,
    musicSrc: activeMusicSrc,
    savedPosition: savedMusicPosition,
    loop: true,
    onRememberPosition: (trackId, seconds) => {
      useGameStore.setState((prev) => {
        if (!prev.gameState) return prev;

        return {
          ...prev,
          gameState: {
            ...prev.gameState,
            music: musicRememberPosition(prev.gameState.music, trackId, seconds),
          },
        };
      });
    },
    onPlaybackStarted: (trackId) => {
      useGameStore.setState((prev) => {
        if (!prev.gameState) return prev;

        return {
          ...prev,
          gameState: {
            ...prev.gameState,
            music: musicMarkPlaybackStarted(prev.gameState.music, trackId),
          },
        };
      });
    },
    onPlaybackStopped: () => {
      useGameStore.setState((prev) => {
        if (!prev.gameState) return prev;

        return {
          ...prev,
          gameState: {
            ...prev.gameState,
            music: musicMarkPlaybackStopped(prev.gameState.music, { keepLastTrackId: true }),
          },
        };
      });
    },
  });

  useEffect(() => {
    if (!audioRef.current) return;

    audioRef.current.volume = musicVolume;
  }, [audioRef, musicVolume]);

  useEffect(() => {
    audioAdapter?.setSfxVolume(sfxVolume);
  }, [audioAdapter, sfxVolume]);

  return {
    audioRef, activeMusicTrackId, activeMusicSrc, savedMusicPosition,
  };
}