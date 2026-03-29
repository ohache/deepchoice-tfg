import type { ID } from "@/domain/types";

export type MusicStartAt = "resume" | "restart";

export type MusicPlaybackStatus = "playing" | "paused" | "stopped";

export interface MusicRuntimeState {
    status: MusicPlaybackStatus;
    currentTrackId?: ID;
    targetTrackId?: ID;
    savedPositionByTrackId: Record<ID, number>;
}

export function createInitialMusicRuntime(): MusicRuntimeState {
  return {
    status: "stopped",
    currentTrackId: undefined,
    targetTrackId: undefined,
    savedPositionByTrackId: {}
  };
}

export function musicSetTargetTrack(state: MusicRuntimeState, trackId: ID | undefined): MusicRuntimeState {
  if (state.targetTrackId === trackId) return state;

  return {
    ...state,
    targetTrackId: trackId,
  };
}

/* Guarda posición (segundos) para un track concreto */
export function musicRememberPosition(state: MusicRuntimeState, trackId: ID, seconds: number): MusicRuntimeState {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;

  const prev = state.savedPositionByTrackId[trackId] ?? 0;
  if (prev === s) return state;

  return {
    ...state,
    savedPositionByTrackId: {
      ...state.savedPositionByTrackId,
      [trackId]: s,
    },
  };
}

/* Reproduce un track */
export function musicPlay(state: MusicRuntimeState, trackId: ID, opts?: { startAt?: MusicStartAt }): MusicRuntimeState {
  const startAt: MusicStartAt = opts?.startAt ?? "resume";

  if (state.status === "playing" && state.currentTrackId === trackId) return state;

  const nextPositions = startAt === "restart"
      ? { ...state.savedPositionByTrackId, [trackId]: 0 }
      : state.savedPositionByTrackId;

  return {
    ...state,
    status: "playing",
    currentTrackId: trackId,
    savedPositionByTrackId: nextPositions,
  };
}

/* Pausa la música actual */
export function musicPause(state: MusicRuntimeState): MusicRuntimeState {
  if (state.status !== "playing") return state;
  if (!state.currentTrackId) return { ...state, status: "paused" };
  return { ...state, status: "paused" };
}

/* Stop */
export function musicStop(state: MusicRuntimeState, opts?: { keepLastTrackId?: boolean }): MusicRuntimeState {
  const keep = opts?.keepLastTrackId === true;

  if (state.status === "stopped" && (!state.currentTrackId || keep)) return state;

  return {
    ...state,
    status: "stopped",
    currentTrackId: keep ? state.currentTrackId : undefined,
  };
}

/* Selector: posición guardada (segundos) de un track. */
export function selectSavedTrackPosition(state: MusicRuntimeState, trackId: ID): number {
  return state.savedPositionByTrackId[trackId] ?? 0;
}
