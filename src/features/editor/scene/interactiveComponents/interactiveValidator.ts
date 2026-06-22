import { z, type ZodError } from "zod";
import { issuesToFieldErrors } from "@/shared/zodIssues";
import type { InteractionRules, Project } from "@/domain/types";

type ValidationContext = {
  project?: Project | null;
};

type FieldErrors<K extends string> = Record<K, string | undefined>;

type ValidationResult<Errors extends Record<string, string | undefined>> = {
  ok: boolean;
  errors: Errors;
  zodError?: ZodError;
};

type HasInteractionRules = {
  rules?: Pick<InteractionRules, "onUseItem"> | null;
};

export function hasDuplicateUseItemRules(entity: HasInteractionRules): boolean {
  const rules = entity.rules?.onUseItem ?? [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (seen.has(rule.itemInstanceId)) return true;
    seen.add(rule.itemInstanceId);
  }

  return false;
}

export function createFieldErrors<const K extends readonly string[]>(keys: K): FieldErrors<K[number]> {
  return Object.fromEntries(keys.map((key) => [key, undefined])) as FieldErrors<K[number]>;
}

export function validateWithSchema<TSchema extends z.ZodTypeAny, Errors extends Record<string, string | undefined>>
  (schema: TSchema, input: unknown, createErrors: () => Errors, applyBusinessRules?: (data: z.output<TSchema>, errors: Errors) => void): ValidationResult<Errors> {
  const result = schema.safeParse(input);
  const zodError = result.success ? undefined : result.error;

  const errors = issuesToFieldErrors(zodError, createErrors());

  if (result.success) applyBusinessRules?.(result.data, errors);

  return { ok: Object.values(errors).every((value) => value == null), errors, zodError };
}

export function createEntityValidators<Schema extends z.ZodTypeAny, DraftSchema extends z.ZodTypeAny, Errors extends Record<string, string | undefined>,
  Ctx extends object = ValidationContext>(schema: Schema, draftSchema: DraftSchema, createErrors: () => Errors,
  applyBusinessRules?: (data: z.output<Schema> | z.output<DraftSchema>, errors: Errors, ctx?: Ctx) => void) {
  return {
    validate(input: z.input<Schema>, ctx?: Ctx) {
      return validateWithSchema(schema, input, createErrors, (data, errors) => { applyBusinessRules?.(data, errors, ctx) });
    },

    validateDraft(input: z.input<DraftSchema>, ctx?: Ctx) {
      return validateWithSchema(draftSchema, input, createErrors, (data, errors) => { applyBusinessRules?.(data, errors, ctx) });
    },
  };
}