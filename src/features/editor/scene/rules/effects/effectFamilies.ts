import type { FactoryCtx } from "@/features/editor/scene/rules/effects/effectShared";
import {
  getEnabledEffectTypesByFamily,
  getEffectTypesByFamily,
} from "@/features/editor/scene/rules/effects/effectFactory";
import type { EnabledEffectType } from "@/features/editor/scene/rules/effects/effectFactory";

export type EffectFamilyId =
  | "message"
  | "progress"
  | "item"
  | "hotspot"
  | "npc"
  | "player"
  | "audio"
  | "dialogue"
  | "ending";

export type EffectFamilySpec = {
  id: EffectFamilyId;
  label: string;
  isAvailable: (factory: FactoryCtx) => boolean;
  effectTypes: EnabledEffectType[];
};

export const EFFECT_FAMILIES: Omit<EffectFamilySpec, "effectTypes">[] = [
  {
    id: "message",
    label: "Mensaje",
    isAvailable: () => true,
  },
  {
    id: "progress",
    label: "Progreso",
    isAvailable: (factory) =>
      factory.idx.getNodeOptions({ excludeNodeId: factory.ctx.nodeId }).length > 0 ||
      factory.idx.getMapOptions().length > 0,
  },
  {
    id: "item",
    label: "Item",
    isAvailable: (factory) => factory.idx.getPlacedItems().length > 0,
  },
  {
    id: "hotspot",
    label: "Hotspot",
    isAvailable: (factory) =>
      factory.idx.getNodeHotspots(factory.ctx.nodeId).length > 0,
  },
  {
    id: "npc",
    label: "NPC",
    isAvailable: (factory) =>
      factory.idx.getPlacedNpcs().length > 0 ||
      factory.idx.getNpcOptions().length > 0,
  },
  {
    id: "player",
    label: "Player",
    isAvailable: (factory) =>
      factory.idx.getPlacedPlayers().length > 0 ||
      factory.idx.getPlayerOptions().length > 0,
  },
  {
    id: "audio",
    label: "Audio",
    isAvailable: (factory) =>
      factory.idx.getSfxOptions().length > 0 ||
      factory.idx.getMusicOptions().length > 0,
  },
  {
    id: "dialogue",
    label: "Diálogo",
    isAvailable: (factory) =>
      factory.ctx.owner.kind === "dialogueLine" ||
      factory.idx.getDialogueOptions(factory.ctx.nodeId).length > 0,
  },
  {
    id: "ending",
    label: "Final",
    isAvailable: (factory) =>
      factory.idx.getNode(factory.ctx.nodeId)?.isFinal === true,
  },
];

export function getAvailableEffectFamilies(factory: FactoryCtx): EffectFamilySpec[] {
  return EFFECT_FAMILIES
    .map((family) => ({
      ...family,
      effectTypes: getEnabledEffectTypesByFamily(factory, family.id),
    }))
    .filter((family) => family.isAvailable(factory) && family.effectTypes.length > 0);
}

export function getEffectFamilyById(id: EffectFamilyId): EffectFamilySpec | null {
  const family = EFFECT_FAMILIES.find((item) => item.id === id);
  if (!family) return null;

  return {
    ...family,
    effectTypes: getEffectTypesByFamily(id),
  };
}