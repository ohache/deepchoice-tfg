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

function normalizeSeconds(seconds: number): number {
  return Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
}

/* Sincroniza el estado musical del motor con un <audio> real del DOM */
export function useSceneAudio(opts: UseSceneAudioOptions) {
  const { targetTrackId, currentTrackId, musicSrc, savedPosition = 0, loop = true, onRememberPosition, onPlaybackStarted, onPlaybackStopped } = opts;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const appliedTrackIdRef = useRef<ID | null>(null);

  const currentTrackIdRef = useRef<ID | undefined>(currentTrackId);
  const targetTrackIdRef = useRef<ID | undefined>(targetTrackId);

  const suppressRememberRef = useRef(false);
  const suppressReleaseTimerRef = useRef<number | null>(null);

  const lastRememberedRef = useRef<{ trackId?: ID; seconds: number }>({ trackId: undefined, seconds: -1 });

  const rememberRef = useRef(onRememberPosition);
  const startedRef = useRef(onPlaybackStarted);
  const stoppedRef = useRef(onPlaybackStopped);

  useEffect(() => {
    currentTrackIdRef.current = currentTrackId;
    targetTrackIdRef.current = targetTrackId;
  }, [currentTrackId, targetTrackId]);

  useEffect(() => {
    rememberRef.current = onRememberPosition;
    startedRef.current = onPlaybackStarted;
    stoppedRef.current = onPlaybackStopped;
  }, [onRememberPosition, onPlaybackStarted, onPlaybackStopped]);

  function clearSuppressReleaseTimer() {
    if (suppressReleaseTimerRef.current === null) return;

    window.clearTimeout(suppressReleaseTimerRef.current);
    suppressReleaseTimerRef.current = null;
  }

  /* Mantiene suppressRemember activo hasta el siguiente ciclo de eventos */
  function releaseRememberSuppressionSoon() {
    clearSuppressReleaseTimer();

    suppressReleaseTimerRef.current = window.setTimeout(() => {
      suppressRememberRef.current = false;
      suppressReleaseTimerRef.current = null;
    }, 0);
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

    releaseRememberSuppressionSoon();
  }

  function resetAudioElement(audio: HTMLAudioElement) {
    suppressRememberRef.current = true;

    audio.pause();
    audio.currentTime = 0;
    audio.removeAttribute("src");
    audio.load();

    releaseRememberSuppressionSoon();
  }

  /* Listener estable de pausa */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePause = () => {
      if (suppressRememberRef.current) return;

      const trackId = appliedTrackIdRef.current ?? currentTrackIdRef.current ?? targetTrackIdRef.current;

      safeRemember(trackId, audio.currentTime);
    };

    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("pause", handlePause);

      const trackId = appliedTrackIdRef.current ?? currentTrackIdRef.current ?? targetTrackIdRef.current;

      safeRemember(trackId, audio.currentTime);

      resetAudioElement(audio);
      appliedTrackIdRef.current = null;

      clearSuppressReleaseTimer();
    };
  }, []);

  /* Efecto principal: aplica la pista objetivo al elemento <audio> */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const activeTrackId = appliedTrackIdRef.current ?? currentTrackId;

    if (!targetTrackId || !musicSrc) {
      if (activeTrackId) safeRemember(activeTrackId, audio.currentTime);

      if (appliedTrackIdRef.current !== null || audio.getAttribute("src")) resetAudioElement(audio);

      appliedTrackIdRef.current = null;
      stoppedRef.current?.(activeTrackId);
      return;
    }

    const sameTrackAlreadyApplied = appliedTrackIdRef.current === targetTrackId && audio.getAttribute("src") === musicSrc;

    if (sameTrackAlreadyApplied) {
      audio.loop = loop;

      if (audio.paused) {
        void audio.play().then(() => {
            startedRef.current?.(targetTrackId);
          })
          .catch(() => {
            stoppedRef.current?.(targetTrackId);
          });
      }

      return;
    }

    if (activeTrackId && activeTrackId !== targetTrackId) safeRemember(activeTrackId, audio.currentTime);

    if (!audio.paused) pauseSilently(audio);

    audio.src = musicSrc;
    audio.loop = loop;
    audio.currentTime = normalizeSeconds(savedPosition);

    void audio.play().then(() => {
        appliedTrackIdRef.current = targetTrackId;
        startedRef.current?.(targetTrackId);
      })
      .catch(() => {
        appliedTrackIdRef.current = null;
        stoppedRef.current?.(targetTrackId);
      });
  }, [targetTrackId, currentTrackId, musicSrc, savedPosition, loop]);

  return { audioRef };
}