import { z } from "zod";
import type { VarDef } from "@/domain/types";

export const NameSchema = z.string().trim().min(1).max(60);

/* Helper para IDs */
export const IdSchema = z.string().trim().min(1, "ID inválido");

/* Helper genérico para validar archivos */
export function createFileSchema(opts: { allowed: RegExp; message?: string }) {
  const msg = opts.message ?? "Formato no válido.";
  return z.instanceof(File).refine((file) => opts.allowed.test(file.name), { message: msg });
}

/* Geometría / estados */
const regionRectSchema = z.object({type: z.literal("rect"), x: z.number(), y: z.number(), w: z.number(), h: z.number()})
.refine((r) => r.w > 0 && r.h > 0, { message: "La región debe tener un tamaño mayor que 0." });

export const regionShapeSchema = z.discriminatedUnion("type", [regionRectSchema]);

export const placeableStateSchema = z.object({ visible: z.boolean(), reachable: z.boolean(), notReachableText: z.string().trim().max(400).optional()}).refine((state) => {
  const text = state.notReachableText?.trim();

  if (!state.visible) return state.reachable === false && !text;

  if (state.reachable) return !text;

  return typeof text === "string" && text.length > 0;
}, {
  message: "Si el elemento no es visible, no puede ser alcanzable ni tener texto. Si es visible y alcanzable, no debe tener texto. Si es visible pero no alcanzable, debe indicar un texto.",
  path: ["notReachableText"],
});

/* Vars */
export const VarDefSchema = z.discriminatedUnion("type", [
  z.object({ id: IdSchema, name: NameSchema, type: z.literal("number"), min: z.number(), max: z.number(), initial: z.number() }).superRefine((v, ctx) => {
      if (v.min > v.max) ctx.addIssue({ code: "custom", path: ["min"], message: "El mínimo no puede ser mayor que el máximo." });
      if (v.initial < v.min || v.initial > v.max) ctx.addIssue({ code: "custom", path: ["initial"], message: "El valor inicial debe estar entre el mínimo y el máximo." });
    }),
  z.object({ id: IdSchema, name: NameSchema, type: z.literal("boolean"), initial: z.boolean()}),
]) satisfies z.ZodType<VarDef>;