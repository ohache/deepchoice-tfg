import type { ID } from "@/domain/types";

type MusicStartAt = "resume" | "restart";
type MusicPlaybackStatus = "playing" | "stopped";

export type MusicRuntimeState = {
  status: MusicPlaybackStatus;
  currentTrackId?: ID;
  targetTrackId?: ID;
  savedPositionByTrackId: Record<ID, number>;
}

export function createInitialMusicRuntime(): MusicRuntimeState {
  return { status: "stopped", currentTrackId: undefined, targetTrackId: undefined, savedPositionByTrackId: {} };
}

export function musicSetTargetTrack(state: MusicRuntimeState, trackId: ID | undefined): MusicRuntimeState {
  if (state.targetTrackId === trackId) return state;

  return { ...state, targetTrackId: trackId };
}

export function musicRememberPosition(state: MusicRuntimeState, trackId: ID, seconds: number): MusicRuntimeState {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const previousSeconds = state.savedPositionByTrackId[trackId] ?? 0;

  if (previousSeconds === safeSeconds) return state;

  return {
    ...state,
    savedPositionByTrackId: {
      ...state.savedPositionByTrackId,
      [trackId]: safeSeconds,
    },
  };
}

export function musicPlay(state: MusicRuntimeState, trackId: ID, opts?: { startAt?: MusicStartAt }): MusicRuntimeState {
  const startAt = opts?.startAt ?? "resume";

  if (state.status === "playing" && state.currentTrackId === trackId) return state;

  const savedPositionByTrackId = startAt === "restart" ? { ...state.savedPositionByTrackId, [trackId]: 0 } : state.savedPositionByTrackId;

  return {
    ...state,
    status: "playing",
    currentTrackId: trackId,
    targetTrackId: trackId,
    savedPositionByTrackId,
  };
}

export function musicStop(state: MusicRuntimeState, opts?: { keepLastTrackId?: boolean }): MusicRuntimeState {
  const keepLastTrackId = opts?.keepLastTrackId === true;

  if (state.status === "stopped" && (!state.currentTrackId || keepLastTrackId)) return state;

  return {
    ...state,
    status: "stopped",
    currentTrackId: keepLastTrackId ? state.currentTrackId : undefined,
    targetTrackId: undefined,
  };
}

export function selectSavedTrackPosition(state: MusicRuntimeState, trackId: ID): number {
  return state.savedPositionByTrackId[trackId] ?? 0;
}