import { z } from "zod";

const VarNameSchema = z.string().trim().min(1, "La varaible necesita un nombre").max(60, "El nombre no puede superar 60 caracteres");

export const VarDraftSchema = z.discriminatedUnion("type", [
  z.object({
    name: VarNameSchema,
    type: z.literal("number"),
    min: z.coerce.number({ message: "Min debe ser numérico" }),
    max: z.coerce.number({ message: "Max debe ser numérico" }),
    initial: z.coerce.number({ message: "Inicial debe ser numérico" }),
  }),
  z.object({
    name: VarNameSchema,
    type: z.literal("boolean"),
    initial: z.boolean({ message: "Inicial debe ser true/false" }),
  }),
]);

export type VarDraftInput = z.input<typeof VarDraftSchema>;
export type VarDraftOutput = z.output<typeof VarDraftSchema>;
