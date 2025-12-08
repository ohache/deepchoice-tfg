import { z } from "zod";

/* Define los tipos de acción permitidos dentro de un hotspot */
export const ActionSchema = z.union([
    z.object({
        type: z.literal("goToNode"),
        targetNodeId: z.string().min(1, "targetNodeId no puede estar vacío"),
    }),

    z.object({
        type: z.literal("addItem"),
        itemId: z.string().min(1),
    }),

    z.object({
        type: z.literal("startDialogue"),
        npcId: z.string().min(1),
    }),

    z.object({
        type: z.literal("giveItemToNpc"),
        npcId: z.string().min(1),
        itemId: z.string().min(1),
    }),
]);

export type ActionInput = z.input<typeof ActionSchema>;
export type ActionOutput = z.output<typeof ActionSchema>;

/* Define las condiciones opcionales que pueden tener los hotspots */
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

/* Validación básica de un hotspot dentro de una escena */
export const HotspotSchema = z.object({
    id: z.string().min(1, "El hotspot necesita un id"),
    label: z.string().max(120).optional(),
    actions: z.array(ActionSchema).min(1, "Un hotspot necesita al menos una acción"),
    conditions: z.array(ConditionSchema).optional(),
});

export type HotspotInput = z.input<typeof HotspotSchema>;
export type HotspotOutput = z.output<typeof HotspotSchema>;

/* Validación básica de una escena en borrador dentro del editor */
export const DraftSceneSchema = z
    .object({
        title: z
            .string()
            .min(1, "La escena necesita un título")
            .max(120, "El título no puede superar 120 caracteres"),

        text: z
            .string()
            .max(10_000, "El texto no puede superar 10.000 caracteres")
            .optional()
            .default(""),

        image: z
            .string()
            .regex(/\.(png|jpg|jpeg)$/i, { message: "La imagen debe ser .png, .jpg o .jpeg", })
            .optional(),

        hotspots: z.array(HotspotSchema).default([]),

        musicId: z.string().optional(),
        npcIds: z.array(z.string()).optional(),
        featuredItemId: z.string().optional(),
        mapId: z.string().optional(),

        isStart: z.boolean().optional(),
        isFinal: z.boolean().optional(),

        meta: z.record(z.string(), z.unknown()).optional(),

    }).refine((draft) => !draft.isFinal || draft.hotspots.length === 0,
        {message: "Un nodo final no puede tener hotspots.", path: ["hotspots"]}
    );

export type DraftSceneInput = z.input<typeof DraftSceneSchema>;
export type DraftSceneOutput = z.output<typeof DraftSceneSchema>;