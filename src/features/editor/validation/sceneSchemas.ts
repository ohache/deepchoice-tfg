import { z } from "zod";

/* Shapes */
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

/* Efectos */
export const EffectSchema = z.union([
  z.object({
    type: z.literal("goToNode"),
    targetNodeId: z.string().min(1, "Marca la escena de destino"),
  }),
  z.object({
    type: z.literal("addItem"),
    itemId: z.string().min(1, "Marca el item"),
  }),
  z.object({
    type: z.literal("removeItem"),
    itemId: z.string().min(1, "Marca el flag"),
    value: z.boolean(),
  }),
  z.object({
    type: z.literal("setFlag"),
    itemId: z.string().min(1, "Marca el item"),
  }),
  z.object({
    type: z.literal("startDialogue"),
    npcId: z.string().min(1, "Marca el PNJ"),
  }),
  z.object({
    type: z.literal("giveItemToNpc"),
    npcId: z.string().min(1),
    itemId: z.string().min(1),
  }),
  z.object({
    TYPE: z.literal("showText"),
    text: z.string().min(1, "El texto no puede estar vacío"),
  }),
]);

export type ActionInput = z.input<typeof EffectSchema>;
export type ActionOutput = z.output<typeof EffectSchema>;

/* Conditions */
export const ConditionSchema = z.union([
  z.object({
    type: z.literal("hasItem"),
    itemId: z.string().min(1),
  }),
  z.object({
    type: z.literal("flagIsTrue"),
    flag: z.string().min(1),
  }),
  z.object({
    type: z.literal("flagIsFalse"),
    flag: z.string().min(1),
  }),
]);

export type ConditionInput = z.input<typeof ConditionSchema>;
export type ConditionOutput = z.output<typeof ConditionSchema>;

/* Interaction */
export const InteractionVerbSchema = z.union([
  z.literal("go"),
  z.literal("look"),
  z.literal("take"),
  z.literal("talk"),
  z.literal("use"),
  z.literal("give"),
]);

export const InteractionSchema = z.object({
  id: z.string().min(1, "La interacción necesita un id"),
  verb: InteractionVerbSchema,
  label: z.string().max(120).optional(),
  cursor: z.string().max(120).optional(),
  conditions: z.array(ConditionSchema).optional(),
  effects: z.array(EffectSchema).min(1, "Una interacción necesita al menos un efecto"),
});

export type InteractionInput = z.input<typeof InteractionSchema>;
export type InteractionOutput = z.output<typeof InteractionSchema>;

/* Hotspot (free) */
export const HotspotSchema = z.object({
  id: z.string().min(1, "El hotspot necesita un id"),
  kind: z.literal("free"),
  shape: HotspotShapeSchema,
  label: z.string().max(120).optional(),
  interactions: z.array(InteractionSchema).default([]),
});

export type HotspotInput = z.input<typeof HotspotSchema>;
export type HotspotOutput = z.output<typeof HotspotSchema>;

/* Placed Item / Placed NPC */
export const PlacedItemSchema = z.object({
  id: z.string().min(1, "La instancia de ítem necesita un id"),
  itemId: z.string().min(1, "Falta el itemId"),
  shape: HotspotShapeSchema,
  label: z.string().max(120).optional(),
  interactions: z.array(InteractionSchema).default([]),
});

export type PlacedItemInput = z.input<typeof PlacedItemSchema>;
export type PlacedItemOutput = z.output<typeof PlacedItemSchema>;

/* Placed NPC */
export const PlacedNpcSchema = z.object({
  id: z.string().min(1, "La instancia de PNJ necesita un id"),
  npcId: z.string().min(1, "Falta el npcId"),
  shape: HotspotShapeSchema,
  label: z.string().max(120).optional(),
  interactions: z.array(InteractionSchema).default([]),
});

export type PlacedNpcInput = z.input<typeof PlacedNpcSchema>;
export type PlacedNpcOutput = z.output<typeof PlacedNpcSchema>;

/* Draft Scene */
export const DraftSceneSchema = z.object({
    title: z
      .string()
      .min(1, "La escena necesita un título")
      .max(120, "El título no puede superar 120 caracteres"),

    text: z.string().max(10_000, "El texto no puede superar 10.000 caracteres").optional().default(""),

    image: z
      .string()
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