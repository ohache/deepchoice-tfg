import type { Hotspot, ID, ItemInstance, PlacedNpc, Project } from "@/domain/types";
import type { HotspotDraft } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { ProjectIndex } from "@/features/editor/scene/rules/effects/effectProjectIndex";

type EffectOwnerKind = "hotspot" | "placedItem" | "placedNpc" | "dialogueLine" | "playerInventoryItem" | "npcInventoryItem";

type EffectOwnerBase<K extends EffectOwnerKind> = {
  kind: K;
};

type HotspotEffectOwner = EffectOwnerBase<"hotspot"> & {
  layerId: ID;
  hotspotId: ID;
  hotspot: Hotspot | HotspotDraft;
};

type PlacedItemEffectOwner = EffectOwnerBase<"placedItem"> & {
  layerId: ID;
  itemInstanceId: ID;
  item: ItemInstance;
};

type PlacedNpcEffectOwner = EffectOwnerBase<"placedNpc"> & {
  layerId: ID;
  npcId: ID;
  npc: PlacedNpc;
};

type DialogueLineEffectOwner = EffectOwnerBase<"dialogueLine"> & {
  dialogueId: ID;
  lineId: ID;
};

type PlayerInventoryItemEffectOwner = EffectOwnerBase<"playerInventoryItem"> & {
  playerId: ID;
  itemInstance: ItemInstance;
};

type NpcInventoryItemEffectOwner = EffectOwnerBase<"npcInventoryItem"> & {
  npcId: ID;
  itemInstance: ItemInstance;
};

export type EffectOwner = HotspotEffectOwner | PlacedItemEffectOwner | PlacedNpcEffectOwner | DialogueLineEffectOwner  | PlayerInventoryItemEffectOwner | NpcInventoryItemEffectOwner;

/* Contexto mínimo del editor para construir/editar efectos */
export type EffectCtx = {
  project: Project | null;
  nodeId: ID;
  owner: EffectOwner;
};

/* Contexto enriquecido con índice precalculado*/
export type FactoryCtx = {
  idx: ProjectIndex;
  ctx: EffectCtx;
};