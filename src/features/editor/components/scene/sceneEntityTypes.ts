import type { ID } from "@/domain/types";

export type EntityKind = "item" | "npc";

export type SceneEntityViewModel = { kind: "item" | "npc"; instanceId: ID; resourceId: ID; label: string }

