import type { ID } from "@/domain/types";

export type TagKind = "music" | "map" | "item" | "npc";

export type SceneTagViewModel =
  | { kind: "music" | "map"; resourceId: ID; label: string }
  | { kind: "item" | "npc"; instanceId: ID; resourceId: ID; label: string };