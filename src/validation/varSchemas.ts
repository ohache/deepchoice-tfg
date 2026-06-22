import { z } from "zod";

const VarNameSchema = z.string().trim().min(1, "La variable necesita un nombre").max(60, "El nombre no puede superar 60 caracteres");

const NumberVarSchema = z.object({
  name: VarNameSchema,
  type: z.literal("number"),
  min: z.coerce.number(),
  max: z.coerce.number(),
  initial: z.coerce.number(),
}).superRefine((value, ctx) => {
  if (value.min > value.max) {
    ctx.addIssue({ code: "custom", message: "Min no puede ser mayor que Max", path: ["max"] });
  }

  if (value.initial < value.min || value.initial > value.max) {
    ctx.addIssue({ code: "custom", message: "Inicial debe estar entre Min y Max", path: ["initial"] });
  }
});

const BooleanVarSchema = z.object({
  name: VarNameSchema,
  type: z.literal("boolean"),
  initial: z.boolean(),
});

export const VarDraftSchema = z.discriminatedUnion("type", [
  NumberVarSchema,
  BooleanVarSchema,
]);