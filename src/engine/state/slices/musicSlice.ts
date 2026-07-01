import type { ID } from "@/domain/types";

type MusicStartAt = "resume" | "restart";
type MusicPlaybackStatus = "playing" | "stopped";
type MusicControlMode = "auto" | "manual" | "stopped";

export type MusicRuntimeState = {
  mode: MusicControlMode;
  status: MusicPlaybackStatus;
  currentTrackId?: ID;
  targetTrackId?: ID;
  sourceNodeId?: ID;
  savedPositionByTrackId: Record<ID, number>;
}

export function createInitialMusicRuntime(): MusicRuntimeState {
  return {
    mode: "auto",
    status: "stopped",
    currentTrackId: undefined,
    targetTrackId: undefined,
    sourceNodeId: undefined,
    savedPositionByTrackId: {},
  };
}

export function musicSetAutomaticTargetTrack(state: MusicRuntimeState, trackId: ID | undefined, sourceNodeId: ID): MusicRuntimeState {
  const sceneChanged = state.sourceNodeId !== sourceNodeId;

  if (!sceneChanged && state.mode !== "auto") return state;

  if (
    !sceneChanged &&
    state.mode === "auto" &&
    state.targetTrackId === trackId
  ) {
    return state;
  }

  return {
    ...state,
    mode: "auto",
    sourceNodeId,
    targetTrackId: trackId,
    status: trackId ? state.status : "stopped",
    currentTrackId: trackId ? state.currentTrackId : undefined,
  };
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

  if (!trackId) return state;

  const savedPositionByTrackId = startAt === "restart"
    ? { ...state.savedPositionByTrackId, [trackId]: 0 }
    : state.savedPositionByTrackId;

  return {
    ...state,
    mode: "manual",
    status: "playing",
    currentTrackId: trackId,
    targetTrackId: trackId,
    savedPositionByTrackId,
  };
}

export function musicStop(state: MusicRuntimeState, opts?: { trackId?: ID; keepLastTrackId?: boolean }): MusicRuntimeState {
  const trackId = opts?.trackId;
  const keepLastTrackId = opts?.keepLastTrackId === true;

  const shouldStop = !trackId || state.currentTrackId === trackId || state.targetTrackId === trackId;

  if (!shouldStop) return state;

  return {
    ...state,
    mode: "stopped",
    status: "stopped",
    currentTrackId: keepLastTrackId ? state.currentTrackId : undefined,
    targetTrackId: undefined,
  };
}

export function musicMarkPlaybackStarted(state: MusicRuntimeState, trackId: ID): MusicRuntimeState {
  if (state.status === "playing" && state.currentTrackId === trackId) return state;

  return {
    ...state,
    status: "playing",
    currentTrackId: trackId,
    targetTrackId: state.targetTrackId ?? trackId,
  };
}

export function musicMarkPlaybackStopped(state: MusicRuntimeState, opts?: { keepLastTrackId?: boolean }): MusicRuntimeState {
  const keepLastTrackId = opts?.keepLastTrackId === true;

  if (state.status === "stopped") return state;

  return {
    ...state,
    status: "stopped",
    currentTrackId: keepLastTrackId ? state.currentTrackId : undefined,
  };
}

export function selectSavedTrackPosition(state: MusicRuntimeState, trackId: ID): number {
  return state.savedPositionByTrackId[trackId] ?? 0;
}