import type { FactoryCtx } from "@/features/editor/scene/rules/effects/effectShared";
import { getEnabledEffectTypesByFamily, getEffectTypesByFamily } from "@/features/editor/scene/rules/effects/effectFactory";
import type { EnabledEffectType } from "@/features/editor/scene/rules/effects/effectFactory";

export type EffectFamilyId = "message" | "progress" | "item" | "hotspot" | "npc" | "player" | "audio" | "dialogue" | "ending";

export type EffectFamilySpec = {
  id: EffectFamilyId;
  label: string;
  isAvailable: (factory: FactoryCtx) => boolean;
  effectTypes: EnabledEffectType[];
};

type EffectFamilyDefinition = Omit<EffectFamilySpec, "effectTypes">;

export const EFFECT_FAMILIES: EffectFamilyDefinition[] = [
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
    isAvailable: (factory) => factory.idx.getNodeHotspots(factory.ctx.nodeId).length > 0,
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

/* Construye una familia completa resolviendo sus effectTypes desde effectFactory */
function buildEffectFamily(factory: FactoryCtx, family: EffectFamilyDefinition): EffectFamilySpec {
  return {
    ...family,
    effectTypes: getEnabledEffectTypesByFamily(factory, family.id),
  };
}

/* Variante sin contexto de availability, útil para consultas simples por id cuando solo interesa el catálogo completo de tipos */
function buildStaticEffectFamily(family: EffectFamilyDefinition): EffectFamilySpec {
  return {
    ...family,
    effectTypes: getEffectTypesByFamily(family.id),
  };
}

/* API */
export function getAvailableEffectFamilies(factory: FactoryCtx): EffectFamilySpec[] {
  return EFFECT_FAMILIES
    .map((family) => buildEffectFamily(factory, family))
    .filter((family) => family.isAvailable(factory) && family.effectTypes.length > 0);
}

export function getEffectFamilyById(id: EffectFamilyId): EffectFamilySpec | null {
  const family = EFFECT_FAMILIES.find((item) => item.id === id);
  if (!family) return null;

  return buildStaticEffectFamily(family);
}