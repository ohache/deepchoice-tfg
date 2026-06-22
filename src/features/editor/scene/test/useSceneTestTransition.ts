import { useEffect, useRef, useState } from "react";

const DEFAULT_FADE_OUT_MS = 120;
const DEFAULT_BLACK_HOLD_MS = 70;

type UseSceneTestTransitionArgs<T> = {
  transitionKey: string;
  snapshot: T;
  enabled?: boolean;
  fadeOutMs?: number;
  blackHoldMs?: number;
};

type TransitionTimers = {
  fadeTimer: number | null;
  holdTimer: number | null;
};

/*
 * Mantiene una "foto visual" estable durante una transición.
 *
 * Flujo:
 * 1. Se muestra la escena/capa anterior.
 * 2. Al cambiar transitionKey, se activa una capa negra.
 * 3. Cuando el negro ya cubre la vista, se cambia a la nueva foto visual.
 * 4. Se mantiene negro unos milisegundos.
 * 5. Se retira el negro.
 *
 * Así evitamos que la imagen/texto/elementos cambien bruscamente debajo del usuario.
 */
export function useSceneTestTransition<T>({
  transitionKey,
  snapshot,
  enabled = true,
  fadeOutMs = DEFAULT_FADE_OUT_MS,
  blackHoldMs = DEFAULT_BLACK_HOLD_MS,
}: UseSceneTestTransitionArgs<T>) {
  const latestSnapshotRef = useRef(snapshot);
  const displayedKeyRef = useRef(transitionKey);
  const isTransitioningRef = useRef(false);
  const timersRef = useRef<TransitionTimers>({ fadeTimer: null, holdTimer: null });

  const [displayedSnapshot, setDisplayedSnapshot] = useState(snapshot);
  const [isBlackTransition, setIsBlackTransition] = useState(false);

  function clearTimers() {
    const { fadeTimer, holdTimer } = timersRef.current;

    if (fadeTimer) window.clearTimeout(fadeTimer);
    if (holdTimer) window.clearTimeout(holdTimer);

    timersRef.current = { fadeTimer: null, holdTimer: null };
  }

  /*
   * Conserva siempre la última foto recibida.
   *
   * Si no hay transición activa y seguimos en la misma key, actualiza la foto
   * mostrada directamente. Esto permite cambios internos sin transición.
   */
  useEffect(() => {
    latestSnapshotRef.current = snapshot;

    if (!isTransitioningRef.current && displayedKeyRef.current === transitionKey) {
      setDisplayedSnapshot(snapshot);
    }
  }, [snapshot, transitionKey]);

  /*
   * Lanza la transición cuando cambia la clave visual.
   */
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      isTransitioningRef.current = false;
      displayedKeyRef.current = transitionKey;
      setDisplayedSnapshot(latestSnapshotRef.current);
      setIsBlackTransition(false);
      return;
    }

    if (displayedKeyRef.current === transitionKey) return;

    clearTimers();

    isTransitioningRef.current = true;
    setIsBlackTransition(true);

    timersRef.current.fadeTimer = window.setTimeout(() => {
      displayedKeyRef.current = transitionKey;
      setDisplayedSnapshot(latestSnapshotRef.current);

      timersRef.current.holdTimer = window.setTimeout(() => {
        setIsBlackTransition(false);
        isTransitioningRef.current = false;
        timersRef.current = { fadeTimer: null, holdTimer: null };
      }, blackHoldMs);
    }, fadeOutMs);

    return clearTimers;
  }, [transitionKey, enabled, fadeOutMs, blackHoldMs]);

  /*
   * Limpieza al desmontar.
   */
  useEffect(() => {
    return clearTimers;
  }, []);

  return {
    displayedSnapshot,
    isBlackTransition,
  };
}