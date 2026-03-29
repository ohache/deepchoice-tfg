import type { ID } from "@/domain/types";

export const DEFAULT_ZOOM = 100;
export const MIN_ZOOM = 50;
export const MAX_ZOOM = 200;
export const STEP_ZOOM = 25;

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function buildBaseEditorState() {
  return {
    primaryMode: "historia" as const,
    secondaryMode: "vista" as const,
    zoom: DEFAULT_ZOOM,
    selectedNodeId: null as ID | null,
    sceneMode: "creating" as const,
    selectedPlayerId: null as ID | null,
    //PNJ
    selectedItemId: null as ID | null,
    selectedMusicTrackId: null as ID | null,
    selectedMapId: null as ID | null,
    selectedZoneId: null as ID | null,
  };
}
