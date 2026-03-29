import type { Hotspot, ID, PlacedItem, PlacedNpc, Project } from "@/domain/types";
import type { HotspotDraft } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { ProjectIndex } from "@/features/editor/scene/rules/effects/effectProjectIndex";
export type EffectOwnerKind = "hotspot" | "placedItem" | "placedNpc" | "dialogueLine";

type EffectOwnerBase<K extends EffectOwnerKind> = {
  kind: K;
};

export type HotspotEffectOwner = EffectOwnerBase<"hotspot"> & {
  layerId: ID;
  hotspotId: ID;
  hotspot: Hotspot | HotspotDraft;
};

export type PlacedItemEffectOwner = EffectOwnerBase<"placedItem"> & {
  layerId: ID;
  placedItemId: ID;
  item: PlacedItem;
};

export type PlacedNpcEffectOwner = EffectOwnerBase<"placedNpc"> & {
  layerId: ID;
  npcId: ID;
  npc: PlacedNpc;
};

export type DialogueLineEffectOwner = EffectOwnerBase<"dialogueLine"> & {
  dialogueId: ID;
  lineId: ID;
};

export type EffectOwner =
  | HotspotEffectOwner
  | PlacedItemEffectOwner
  | PlacedNpcEffectOwner
  | DialogueLineEffectOwner;

export type EffectCtx = {
  project: Project | null;
  nodeId: ID;
  owner: EffectOwner;
};

export type FactoryCtx = {
  idx: ProjectIndex;
  ctx: EffectCtx;
};

export function getEffectOwnerLayerId(owner: EffectOwner): ID | null {
  if (owner.kind === "dialogueLine") return null;
  return owner.layerId;
}

export function getEffectOwnerEntityId(owner: EffectOwner): ID {
  switch (owner.kind) {
    case "hotspot":
      return owner.hotspotId;
    case "placedItem":
      return owner.placedItemId;
    case "placedNpc":
      return owner.npcId;
    case "dialogueLine":
      return owner.lineId;
  }
}

export function isSceneEffectOwner(owner: EffectOwner): owner is HotspotEffectOwner | PlacedItemEffectOwner | PlacedNpcEffectOwner {
  return owner.kind === "hotspot" || owner.kind === "placedItem" || owner.kind === "placedNpc";
}

export function isDialogueLineEffectOwner(owner: EffectOwner): owner is DialogueLineEffectOwner {
  return owner.kind === "dialogueLine";
}