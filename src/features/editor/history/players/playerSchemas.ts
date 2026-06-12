import { z } from "zod";
import { createFileSchema, IdSchema } from "@/validation/genericSchemas";
import { VarDraftSchema, type VarDraftInput, type VarDraftOutput } from "@/validation/varSchemas";

export const IMAGE_ALLOWED_PLAYER = /\.(png|jpg|jpeg|webp)$/i;

export const PlayerImageFileSchema = createFileSchema({
  allowed: IMAGE_ALLOWED_PLAYER,
  message: "Formato no válido. Usa .png, .jpg, .jpeg o .webp.",
});

export const PlayerImageDraftSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1, "La imagen necesita un nombre").max(60, "El nombre no puede superar 60 caracteres"),
  file: PlayerImageFileSchema.optional(),
});

export type PlayerImageDraftInput = z.input<typeof PlayerImageDraftSchema>;
export type PlayerImageDraftOutput = z.output<typeof PlayerImageDraftSchema>;

export const PlayerInventoryItemDraftSchema = z.object({
  itemInstanceId: IdSchema,
  itemId: IdSchema,
  label: z.string().trim().min(1, "El item necesita una etiqueta").max(60, "La etiqueta no puede superar 60 caracteres"),
});

export type PlayerInventoryItemDraftInput = z.input<typeof PlayerInventoryItemDraftSchema>;
export type PlayerInventoryItemDraftOutput = z.output<typeof PlayerInventoryItemDraftSchema>;

/* Draft completo del player en el editor */
export const PlayerDraftSchema = z.object({
  name: z.string().trim().min(1, "El personaje necesita un nombre").max(60, "El nombre no puede superar 60 caracteres"),
  description: z.string().trim().max(200, "La descripción no puede superar 200 caracteres").optional(),
  images: z.array(PlayerImageDraftSchema).min(1, "Sube al menos una imagen"),
  defaultImageId: IdSchema,
  vars: z.array(VarDraftSchema).default([]),
  initialInventory: z.array(PlayerInventoryItemDraftSchema).default([]),
})
  .superRefine((val, ctx) => {
    const ids = val.images.map((i) => i.id);
    const set = new Set(ids);

    if (set.size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["images"],
        message: "Hay imágenes con id repetido",
      });
    }

    if (!set.has(val.defaultImageId)) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultImageId"],
        message: "La imagen predeterminada debe existir dentro de las imágenes",
      });
    }

    const normalizedNames = val.images.map((i) => i.name.trim().toLowerCase());
    const nameSet = new Set(normalizedNames);

    if (nameSet.size !== normalizedNames.length) {
      ctx.addIssue({
        code: "custom",
        path: ["images"],
        message: "Hay imágenes con nombre repetido.",
      });
    }

    const inventoryItemInstanceIds = val.initialInventory.map((i) => i.itemInstanceId);
    const inventoryItemInstanceIdSet = new Set(inventoryItemInstanceIds);

    if (inventoryItemInstanceIdSet.size !== inventoryItemInstanceIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["initialInventory"],
        message: "Hay items de inventario con id repetido.",
      });
    }

    const normalizedInventoryLabels = val.initialInventory.map((i) => i.label.trim().toLowerCase());
    const inventoryLabelSet = new Set(normalizedInventoryLabels);

    if (inventoryLabelSet.size !== normalizedInventoryLabels.length) {
      ctx.addIssue({
        code: "custom",
        path: ["initialInventory"],
        message: "Hay items de inventario con etiqueta repetida.",
      });
    }
  });

export type PlayerDraftInput = z.input<typeof PlayerDraftSchema>;
export type PlayerDraftOutput = z.output<typeof PlayerDraftSchema>;

/* Draft reducido del player */
export const PlayerBaseDraftSchema = z.object({
  name: z.string().trim().min(1, "El personaje necesita un nombre").max(60, "El nombre no puede superar 60 caracteres"),
  description: z.string().trim().max(200, "La descripción no puede superar 200 caracteres").optional(),
  file: PlayerImageFileSchema.optional(),
});

export type PlayerBaseDraftInput = z.input<typeof PlayerBaseDraftSchema>;
export type PlayerBaseDraftOutput = z.output<typeof PlayerBaseDraftSchema>;

/* Re-export semántico */
export type PlayerVarDraftInput = VarDraftInput;
export type PlayerVarDraftOutput = VarDraftOutput;