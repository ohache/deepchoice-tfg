import { PlacedPlayerDraftSchema, PlacedPlayerSchema } from "@/features/editor/scene/placedPlayers/placedPlayerSchemas";
import { createEntityValidators, createFieldErrors } from "@/features/editor/scene/interactiveComponents/interactiveValidator";

const placedPlayerErrorKeys = ["playerId", "initialImageId", "shape", "initialState"] as const;

export type PlacedPlayerFieldErrors = Record<typeof placedPlayerErrorKeys[number], string | undefined>;

function createPlacedPlayerFieldErrors(): PlacedPlayerFieldErrors {
  return createFieldErrors(placedPlayerErrorKeys);
}

const validators = createEntityValidators(
  PlacedPlayerSchema,
  PlacedPlayerDraftSchema,
  createPlacedPlayerFieldErrors
);

export const validatePlacedPlayer = validators.validate;
export const validatePlacedPlayerDraft = validators.validateDraft;