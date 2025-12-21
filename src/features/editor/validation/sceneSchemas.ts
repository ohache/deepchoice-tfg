import { z } from "zod";

/* ========= Shapes ========= */
export const HotspotShapeSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rect"),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }),
]);

export type HotspotShapeInput = z.input<typeof HotspotShapeSchema>;
export type HotspotShapeOutput = z.output<typeof HotspotShapeSchema>;

/* ========= Conditions ========= */
export const ConditionSchema = z.union([
  z.object({ type: z.literal("hasItem"), itemId: z.string().min(1) }),
  z.object({ type: z.literal("flagIsTrue"), flag: z.string().min(1) }),
  z.object({ type: z.literal("flagIsFalse"), flag: z.string().min(1) }),
]);

export type ConditionInput = z.input<typeof ConditionSchema>;
export type ConditionOutput = z.output<typeof ConditionSchema>;

/* ========= Effects ========= */
export const EffectSchema = z.union([
  // Navegación
  z.object({ type: z.literal("goToNode"), targetNodeId: z.string().min(1, "Marca la escena de destino") }),

  // Inventario / flags
  z.object({ type: z.literal("addItem"), itemId: z.string().min(1, "Marca el ítem") }),
  z.object({ type: z.literal("removeItem"), itemId: z.string().min(1, "Marca el ítem") }),
  z.object({ type: z.literal("setFlag"), flag: z.string().min(1, "Marca el flag"), value: z.boolean() }),

  // Diálogo / PNJ
  z.object({ type: z.literal("startDialogue"), npcId: z.string().min(1, "Marca el PNJ") }),
  z.object({ type: z.literal("giveItemToNpc"), npcId: z.string().min(1), itemId: z.string().min(1) }),

  // Feedback
  z.object({ type: z.literal("showText"), text: z.string().min(1, "El texto no puede estar vacío") }),
  z.object({ type: z.literal("showMessage"), text: z.string().min(1, "El texto no puede estar vacío") }),

  // Estado de placed items
  z.object({ type: z.literal("setPlacedItemVisible"), placedItemId: z.string().min(1), value: z.boolean() }),
  z.object({ type: z.literal("setPlacedItemReachable"), placedItemId: z.string().min(1), value: z.boolean() }),
]);

export type EffectInput = z.input<typeof EffectSchema>;
export type EffectOutput = z.output<typeof EffectSchema>;

/* ========= FreeHotspotEffect ========= */
export const FreeHotspotEffectSchema = z.union([
  z.object({ type: z.literal("goToNode"), targetNodeId: z.string().min(1, "Marca la escena de destino") }),
  z.object({ type: z.literal("setFlag"), flag: z.string().min(1, "Marca el flag"), value: z.boolean() }),
  z.object({ type: z.literal("showText"), text: z.string().min(1, "El texto no puede estar vacío") }),
  z.object({ type: z.literal("showMessage"), text: z.string().min(1, "El texto no puede estar vacío") }),
]);

export type FreeHotspotEffectInput = z.input<typeof FreeHotspotEffectSchema>;
export type FreeHotspotEffectOutput = z.output<typeof FreeHotspotEffectSchema>;

/* ========= Interactions ========= */
export const HotspotVerbSchema = z.union([z.literal("go"), z.literal("look"), z.literal("use")]);

export const HotspotInteractionSchema = z.object({
  id: z.string().min(1, "La interacción necesita un id"),
  verb: HotspotVerbSchema,
  label: z.string().max(120).optional(),
  cursor: z.string().max(120).optional(),
  conditions: z.array(ConditionSchema).optional(),
  effects: z.array(FreeHotspotEffectSchema).min(1, "Una interacción necesita al menos un efecto"),
});

export type HotspotInteractionInput = z.input<typeof HotspotInteractionSchema>;
export type HotspotInteractionOutput = z.output<typeof HotspotInteractionSchema>;

export const ItemVerbSchema = z.union([z.literal("look"), z.literal("take"), z.literal("use")]);

export const ItemInteractionSchema = z.object({
  id: z.string().min(1, "La interacción necesita un id"),
  verb: ItemVerbSchema,
  label: z.string().max(120).optional(),
  cursor: z.string().max(120).optional(),
  conditions: z.array(ConditionSchema).optional(),
  effects: z.array(EffectSchema).min(1, "Una interacción necesita al menos un efecto"),
});

export const NpcVerbSchema = z.union([z.literal("look"), z.literal("talk"), z.literal("use"), z.literal("give")]);

export const NpcInteractionSchema = z.object({
  id: z.string().min(1, "La interacción necesita un id"),
  verb: NpcVerbSchema,
  label: z.string().max(120).optional(),
  cursor: z.string().max(120).optional(),
  conditions: z.array(ConditionSchema).optional(),
  effects: z.array(EffectSchema).min(1, "Una interacción necesita al menos un efecto"),
});

/* ========= Hotspot ========= */
export const HotspotSchema = z.object({
  id: z.string().min(1, "El hotspot necesita un id"),
  shape: HotspotShapeSchema,
  label: z.string().max(120).optional(),
  interactions: z.array(HotspotInteractionSchema).default([]),
});

export type HotspotInput = z.input<typeof HotspotSchema>;
export type HotspotOutput = z.output<typeof HotspotSchema>;

/* ========= Placed Item / NPC ========= */
export const PlacedItemStateSchema = z.object({
  visible: z.boolean(),
  reachable: z.boolean(),
  notReachableText: z.string().max(400).optional(),
});

export const PlacedItemSchema = z.object({
  id: z.string().min(1, "La instancia de ítem necesita un id"),
  itemId: z.string().min(1, "Falta el itemId"),
  shape: HotspotShapeSchema,
  state: PlacedItemStateSchema,
  interactions: z.array(ItemInteractionSchema).optional(),
});

export type PlacedItemInput = z.input<typeof PlacedItemSchema>;
export type PlacedItemOutput = z.output<typeof PlacedItemSchema>;

export const PlacedNpcSchema = z.object({
  id: z.string().min(1, "La instancia de PNJ necesita un id"),
  npcId: z.string().min(1, "Falta el npcId"),
  shape: HotspotShapeSchema,
  interactions: z.array(NpcInteractionSchema).optional(),
});

export type PlacedNpcInput = z.input<typeof PlacedNpcSchema>;
export type PlacedNpcOutput = z.output<typeof PlacedNpcSchema>;

/* ========= Draft Scene ========= */
export const DraftSceneSchema = z
  .object({
    title: z.string().trim().min(1, "La escena necesita un título").max(120, "El título no puede superar 120 caracteres"),
    text: z.string().max(10_000, "El texto no puede superar 10.000 caracteres").optional().default(""),

    image: z
      .string()
      .trim()
      .regex(/\.(png|jpg|jpeg|webp)$/i, { message: "La imagen debe ser .png, .jpg, .jpeg o .webp" })
      .optional(),

    hotspots: z.array(HotspotSchema).default([]),

    musicId: z.string().min(1).optional(),
    mapId: z.string().min(1).optional(),

    placedItems: z.array(PlacedItemSchema).optional(),
    placedNpcs: z.array(PlacedNpcSchema).optional(),

    isStart: z.boolean().optional(),
    isFinal: z.boolean().optional(),

    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((draft, ctx) => {
    const hasAnyHotspots = (draft.hotspots?.length ?? 0) > 0;
    const hasPlaced = (draft.placedItems?.length ?? 0) > 0 || (draft.placedNpcs?.length ?? 0) > 0;

    if ((hasAnyHotspots || hasPlaced) && !draft.image) {
      ctx.addIssue({
        code: "custom",
        message: "Para dibujar zonas interactivas debes cargar una imagen en la escena.",
        path: ["image"],
      });
    }
  });

export type DraftSceneInput = z.input<typeof DraftSceneSchema>;
export type DraftSceneOutput = z.output<typeof DraftSceneSchema>;
