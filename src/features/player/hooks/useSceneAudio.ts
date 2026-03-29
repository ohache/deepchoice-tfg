import { useEffect, useRef } from "react";
import type { ID } from "@/domain/types";

type UseSceneAudioOptions = {
  targetTrackId?: ID;
  currentTrackId?: ID;
  musicSrc?: string;
  savedPosition?: number;
  loop?: boolean;
  onRememberPosition?: (trackId: ID, seconds: number) => void;
  onPlaybackStarted?: (trackId: ID) => void;
  onPlaybackStopped?: (trackId?: ID) => void;
};

export function useSceneAudio(opts: UseSceneAudioOptions) {
  const {
    targetTrackId,
    currentTrackId,
    musicSrc,
    savedPosition = 0,
    loop = true,
    onRememberPosition,
    onPlaybackStarted,
    onPlaybackStopped,
  } = opts;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const appliedTrackIdRef = useRef<ID | null>(null);
  const suppressRememberRef = useRef(false);

  const lastRememberedRef = useRef<{ trackId?: ID; seconds: number }>({
    trackId: undefined,
    seconds: -1,
  });

  const rememberRef = useRef(onRememberPosition);
  const startedRef = useRef(onPlaybackStarted);
  const stoppedRef = useRef(onPlaybackStopped);

  useEffect(() => {
    rememberRef.current = onRememberPosition;
    startedRef.current = onPlaybackStarted;
    stoppedRef.current = onPlaybackStopped;
  }, [onRememberPosition, onPlaybackStarted, onPlaybackStopped]);

  function normalizeSeconds(seconds: number) {
    return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  }

  function safeRemember(trackId: ID | undefined, seconds: number) {
    if (!trackId) return;
    if (suppressRememberRef.current) return;

    const normalized = normalizeSeconds(seconds);
    const last = lastRememberedRef.current;

    if (last.trackId === trackId && Math.abs(last.seconds - normalized) < 0.05) return;

    lastRememberedRef.current = { trackId, seconds: normalized };
    rememberRef.current?.(trackId, normalized);
  }

  function pauseSilently(audio: HTMLAudioElement) {
    suppressRememberRef.current = true;
    audio.pause();
    queueMicrotask(() => {
      suppressRememberRef.current = false;
    });
  }

  function resetAudioElement(audio: HTMLAudioElement) {
    suppressRememberRef.current = true;
    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute("src");
    audio.load();
    queueMicrotask(() => {
      suppressRememberRef.current = false;
    });
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePause = () => {
      if (suppressRememberRef.current) return;

      const trackId = appliedTrackIdRef.current ?? currentTrackId ?? targetTrackId;
      safeRemember(trackId, audio.currentTime);
    };

    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("pause", handlePause);

      const trackId = appliedTrackIdRef.current ?? currentTrackId ?? targetTrackId;
      safeRemember(trackId, audio.currentTime);

      resetAudioElement(audio);
      appliedTrackIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const activeTrackId = appliedTrackIdRef.current ?? currentTrackId ?? undefined;

    if (!targetTrackId || !musicSrc) {
      if (activeTrackId) {
        safeRemember(activeTrackId, audio.currentTime);
      }

      if (appliedTrackIdRef.current !== null || audio.getAttribute("src")) {
        resetAudioElement(audio);
      }

      appliedTrackIdRef.current = null;
      stoppedRef.current?.(activeTrackId);
      return;
    }

    const sameTrackAlreadyApplied =
      appliedTrackIdRef.current === targetTrackId &&
      currentTrackId === targetTrackId;

    if (sameTrackAlreadyApplied) {
      audio.loop = loop;

      if (audio.paused) {
        const resume = async () => {
          try {
            await audio.play();
          } catch {
            stoppedRef.current?.(targetTrackId);
          }
        };
        void resume();
      }

      return;
    }

    if (activeTrackId && activeTrackId !== targetTrackId) {
      safeRemember(activeTrackId, audio.currentTime);
    }

    if (!audio.paused) {
      pauseSilently(audio);
    }

    audio.src = musicSrc;
    audio.loop = loop;
    audio.currentTime = normalizeSeconds(savedPosition);

    const play = async () => {
      try {
        await audio.play();
        appliedTrackIdRef.current = targetTrackId;
        startedRef.current?.(targetTrackId);
      } catch {
        appliedTrackIdRef.current = null;
        stoppedRef.current?.(targetTrackId);
      }
    };

    void play();
  }, [targetTrackId, currentTrackId, musicSrc, savedPosition, loop]);

  return { audioRef };
}