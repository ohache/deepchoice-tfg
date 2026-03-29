import { z, type ZodError } from "zod";
import { issuesToFieldErrors } from "@/shared/zodIssues";
import type { Project } from "@/domain/types";

type RuleWithPlacedItemId = {
  placedItemId: string;
};

type RulesWithUseItem = {
  onUseItem?: RuleWithPlacedItemId[];
};

type HasRulesWithUseItem = {
  rules?: RulesWithUseItem;
};

export function hasDuplicateUseItemRules(entity: HasRulesWithUseItem): boolean {
  const rules = entity.rules?.onUseItem ?? [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (seen.has(rule.placedItemId)) return true;
    seen.add(rule.placedItemId);
  }

  return false;
}

export function createFieldErrors<const K extends readonly string[]>(keys: K): Record<K[number], string | undefined> {
  return Object.fromEntries(keys.map((key) => [key, undefined])) as Record<K[number], string | undefined>;
}

export function validateWithSchema<TSchema extends z.ZodType, Errors extends Record<string, string | undefined>>
  (schema: TSchema, input: unknown, createErrors: () => Errors, applyBusinessRules?: (data: z.infer<TSchema>, errors: Errors) => void): { ok: boolean; errors: Errors; zodError?: ZodError } {
  const result = schema.safeParse(input);
  const zodError = result.success ? undefined : result.error;

  const errors = issuesToFieldErrors(zodError, createErrors());

  if (result.success) applyBusinessRules?.(result.data, errors);

  return { ok: Object.values(errors).every((value) => value == null), errors, zodError };
}

export function createEntityValidators<Schema extends z.ZodType, DraftSchema extends z.ZodType,
  Errors extends Record<string, string | undefined>, Ctx extends object | undefined = { project?: Project | null }>(
  schema: Schema, draftSchema: DraftSchema, createErrors: () => Errors, applyBusinessRules?: ( data: z.infer<Schema> | z.infer<DraftSchema>, errors: Errors, ctx?: Ctx ) => void) {
  return {
    validate(input: z.input<Schema>, ctx?: Ctx) {
      return validateWithSchema(schema, input, createErrors, (data, errors) => applyBusinessRules?.(data, errors, ctx));
    },

    validateDraft(input: z.input<DraftSchema>, ctx?: Ctx) {
      return validateWithSchema(draftSchema, input, createErrors, (data, errors) => applyBusinessRules?.(data, errors, ctx));
    },
  };
}