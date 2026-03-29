import { useEffect, useMemo, useRef, useState } from "react";
import type { ID, Project, ResolvedMusic } from "@/domain/types";

type UseScenePreviewAudioArgs = {
  project: Project | null;
  nodeMusicTrackId?: ID;
  layerMusicTrackId?: ID;
  mapId?: ID;
  regionId?: ID;
  musicSrc?: string;
};

function resolveScenePreviewMusic(args: {
  project: Project | null;
  nodeMusicTrackId?: ID;
  layerMusicTrackId?: ID;
  mapId?: ID;
  regionId?: ID;
}): ResolvedMusic | undefined {
  const { project, nodeMusicTrackId, layerMusicTrackId, mapId, regionId } = args;

  if (layerMusicTrackId) {
    return {
      trackId: layerMusicTrackId,
      sourceType: "layer",
      sourceId: layerMusicTrackId,
    };
  }

  if (nodeMusicTrackId) {
    return {
      trackId: nodeMusicTrackId,
      sourceType: "scene",
      sourceId: nodeMusicTrackId,
    };
  }

  if (project && mapId && regionId) {
    const map = (project.maps ?? []).find((m) => m.id === mapId) ?? null;
    const region = map?.regions.find((r) => r.id === regionId) ?? null;

    if (region?.musicTrackId) {
      return {
        trackId: region.musicTrackId,
        sourceType: "region",
        sourceId: region.id,
      };
    }
  }

  return undefined;
}

export function useScenePreviewAudio({ project, nodeMusicTrackId, layerMusicTrackId, mapId, regionId, musicSrc }: UseScenePreviewAudioArgs) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const resolvedMusic = useMemo(() =>
    resolveScenePreviewMusic({
      project,
      nodeMusicTrackId,
      layerMusicTrackId,
      mapId,
      regionId,
    }),
    [project, nodeMusicTrackId, layerMusicTrackId, mapId, regionId]
  );

  const resolvedTrackId = resolvedMusic?.trackId ?? null;
  const lastResolvedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const nextKey = resolvedMusic && musicSrc
      ? `${resolvedMusic.sourceType}:${resolvedMusic.sourceId}:${resolvedMusic.trackId}:${musicSrc}`
      : null;

    if (lastResolvedKeyRef.current === nextKey) return;

    lastResolvedKeyRef.current = nextKey;

    const audio = audioRef.current;
    if (!audio) {
      setIsPlaying(false);
      return;
    }

    audio.pause();
    audio.currentTime = 0;

    if (!musicSrc || !resolvedTrackId) {
      audio.removeAttribute("src");
      audio.load();
      setIsPlaying(false);
      return;
    }

    audio.src = musicSrc;
    audio.loop = true;
    audio.load();
    setIsPlaying(false);
  }, [resolvedMusic, resolvedTrackId, musicSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, []);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    };
  }, []);

  const canPlay = Boolean(resolvedTrackId && musicSrc);

  const play = async () => {
    const audio = audioRef.current;
    if (!audio || !canPlay) return false;

    audio.loop = true;

    try {
      await audio.play();
      setIsPlaying(true);
      return true;
    } catch {
      setIsPlaying(false);
      return false;
    }
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  };

  const toggle = async () => {
    if (isPlaying) {
      stop();
      return false;
    }

    return play();
  };

  return { audioRef, isPlaying, canPlay, toggle, stop, resolvedMusic, resolvedTrackId };
}