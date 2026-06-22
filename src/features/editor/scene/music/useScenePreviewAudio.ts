import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ID, Project, ResolvedMusic, WorldMap } from "@/domain/types";

type UseScenePreviewAudioArgs = {
  project?: Project | null;
  resolvedMusic?: ResolvedMusic;
  nodeMusicTrackId?: ID;
  layerMusicTrackId?: ID;
  mapId?: ID;
  regionId?: ID;
  musicSrc?: string;
};

type ResolveScenePreviewMusicArgs = {
  maps?: WorldMap[];
  nodeMusicTrackId?: ID;
  layerMusicTrackId?: ID;
  mapId?: ID;
  regionId?: ID;
};

export function resolveScenePreviewMusic({ maps, nodeMusicTrackId, layerMusicTrackId, mapId, regionId }: ResolveScenePreviewMusicArgs): ResolvedMusic | undefined {
  if (layerMusicTrackId) return { trackId: layerMusicTrackId, sourceType: "layer", sourceId: layerMusicTrackId };

  if (nodeMusicTrackId)  return { trackId: nodeMusicTrackId, sourceType: "scene", sourceId: nodeMusicTrackId };
  
  if (!maps || !mapId || !regionId) return undefined;

  const map = maps.find((entry) => entry.id === mapId) ?? null;
  const region = map?.regions.find((entry) => entry.id === regionId) ?? null;

  if (!region?.musicTrackId) return undefined;

  return { trackId: region.musicTrackId, sourceType: "region", sourceId: region.id };
}

/* Genera una clave estable del audio actualmente resuelto */
function getResolvedAudioKey(resolvedMusic: ResolvedMusic | undefined, musicSrc?: string): string | null {
  if (!resolvedMusic || !musicSrc) return null;

  return [resolvedMusic.sourceType, resolvedMusic.sourceId, resolvedMusic.trackId, musicSrc].join(":");
}

function resetAudioElement(audio: HTMLAudioElement) {
  audio.pause();
  audio.currentTime = 0;
  audio.removeAttribute("src");
  audio.load();
}

function loadAudioSource(audio: HTMLAudioElement, musicSrc: string) {
  audio.pause();
  audio.currentTime = 0;
  audio.src = musicSrc;
  audio.loop = true;
  audio.load();
}

/* Hook encargado de preparar y controlar el audio de la preview de escena */
export function useScenePreviewAudio({ project, resolvedMusic: resolvedMusicInput, nodeMusicTrackId, layerMusicTrackId, mapId, regionId, musicSrc }: UseScenePreviewAudioArgs) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const lastResolvedKeyRef = useRef<string | null>(null);

  const maps = project?.maps;

  const resolvedMusic = useMemo(() => resolvedMusicInput ?? resolveScenePreviewMusic({ maps, nodeMusicTrackId, layerMusicTrackId, mapId, regionId }),
    [resolvedMusicInput, maps, nodeMusicTrackId, layerMusicTrackId, mapId, regionId]
  );

  const resolvedTrackId = resolvedMusic?.trackId ?? null;
  const canPlay = Boolean(resolvedTrackId && musicSrc);

  /* Cuando cambia la música efectiva, reinicia y recarga el audio */
  useEffect(() => {
    const nextResolvedKey = getResolvedAudioKey(resolvedMusic, musicSrc);

    if (lastResolvedKeyRef.current === nextResolvedKey) return;
    lastResolvedKeyRef.current = nextResolvedKey;

    const audio = audioRef.current;
    if (!audio) {
      setIsPlaying(false);
      return;
    }

    if (!musicSrc || !resolvedTrackId) {
      resetAudioElement(audio);
      setIsPlaying(false);
      return;
    }

    loadAudioSource(audio, musicSrc);
    setIsPlaying(false);
  }, [resolvedMusic, resolvedTrackId, musicSrc]);

  /* Sincroniza el estado React con los eventos nativos del elemento audio */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, []);

  /* Limpieza final al desmontar el hook */
  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      resetAudioElement(audio);
    };
  }, []);

  const play = useCallback(async () => {
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
  }, [canPlay]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(async () => {
    if (isPlaying) {
      pause();
      return false;
    }

    return play();
  }, [isPlaying, pause, play]);

  return { audioRef, isPlaying, canPlay, toggle, pause, stop, resolvedMusic, resolvedTrackId };
}