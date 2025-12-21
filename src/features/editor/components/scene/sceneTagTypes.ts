import type { ID } from "@/domain/types";

export type TagKind = "music" | "map";

export type SceneTagViewModel = { kind: "music" | "map"; resourceId: ID; label: string }