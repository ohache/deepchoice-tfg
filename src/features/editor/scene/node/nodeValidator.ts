import type { z, ZodError } from "zod";
import { nodeDraftSchema, nodeSchema } from "@/features/editor/scene/node/nodeSchemas";
import { issuesToFieldErrors } from "@/shared/zodIssues";
import { conditionSchema, effectSchema, interactionRulesSchema } from "@/validation/rulesSchemas";

export type NodeFieldErrors = {
  title?: string;
  layers?: string;
  dialogues?: string;
  musicTrackId?: string;
  mapLocation?: string;
  isStart?: string;
  isFinal?: string;
  meta?: string;
};

type NodeInput = z.input<typeof nodeSchema>;
type NodeDraftInput = z.input<typeof nodeDraftSchema>;

type NodeLikeForBusinessRules = Pick<z.output<typeof nodeSchema>, "layers" | "dialogues">;

type ValidateNodeDraftOptions = {
  projectNodes?: Array<{ id: string; title: string }>;
  currentNodeId?: string | null;
};

const layerBaseRequired = "La escena necesita una capa base (sin condición).";
const duplicateLayerIdError = "No puede haber dos capas con el mismo id.";
const duplicateLayerAssetError = "No puede haber dos capas con la misma imagen.";
const duplicateDialogueIdError = "No puede haber dos diálogos con el mismo id.";
const duplicateDialoguePairError = "No puede haber dos diálogos para la misma pareja player-npc.";

function createNodeFieldErrors(): NodeFieldErrors {
  return {
    title: undefined,
    layers: undefined,
    dialogues: undefined,
    musicTrackId: undefined,
    mapLocation: undefined,
    isStart: undefined,
    isFinal: undefined,
    meta: undefined,
  };
}

/* Reglas de negocio adicionales que no encajan bien en zod */
function applyBusinessRules(nodeLike: NodeLikeForBusinessRules, errors: NodeFieldErrors): void {
  const layers = nodeLike.layers;

  const hasBase = layers.some((layer) => layer.when == null);
  if (!hasBase) errors.layers ??= layerBaseRequired;

  const seenLayerIds = new Set<string>();
  for (const layer of layers) {
    if (seenLayerIds.has(layer.id)) {
      errors.layers ??= duplicateLayerIdError;
      break;
    }
    seenLayerIds.add(layer.id);
  }

  const seenLayerAssetIds = new Set<string>();
  for (const layer of layers) {
    if (seenLayerAssetIds.has(layer.assetId)) {
      errors.layers ??= duplicateLayerAssetError;
      break;
    }
    seenLayerAssetIds.add(layer.assetId);
  }

  const dialogues = nodeLike.dialogues ?? [];

  const seenDialogueIds = new Set<string>();
  for (const dialogue of dialogues) {
    if (seenDialogueIds.has(dialogue.id)) {
      errors.dialogues ??= duplicateDialogueIdError;
      break;
    }
    seenDialogueIds.add(dialogue.id);
  }

  const seenPairs = new Set<string>();
  for (const dialogue of dialogues) {
    const pairKey = `${dialogue.playerId}__${dialogue.npcId}`;
    if (seenPairs.has(pairKey)) {
      errors.dialogues ??= duplicateDialoguePairError;
      break;
    }
    seenPairs.add(pairKey);
  }
}

function normalizeTitle(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function applyDuplicateTitleRule(input: { title?: string | null }, errors: NodeFieldErrors, opts?: ValidateNodeDraftOptions): void {
  const title = normalizeTitle(input.title);
  if (!title) return;

  const nodes = opts?.projectNodes ?? [];
  const currentNodeId = opts?.currentNodeId ?? null;

  const duplicated = nodes.some((node) => {
    if (currentNodeId && node.id === currentNodeId) return false;
    return normalizeTitle(node.title) === title;
  });

  if (duplicated) errors.title ??= "Ya existe una escena con ese título.";
}

export function validateNode(input: NodeInput): { ok: boolean; errors: NodeFieldErrors; zodError?: ZodError } {
  const result = nodeSchema.safeParse(input);
  const zodError = result.success ? undefined : result.error;

  const errors = issuesToFieldErrors(zodError, createNodeFieldErrors());

  if (result.success) applyBusinessRules(result.data, errors);

  return { ok: Object.values(errors).every((value) => value == null), errors, zodError };
}

export function validateNodeDraft(input: NodeDraftInput, opts?: ValidateNodeDraftOptions): { ok: boolean; errors: NodeFieldErrors; zodError?: ZodError } {
  const result = nodeDraftSchema.safeParse(input);
  const zodError = result.success ? undefined : result.error;

  const errors = issuesToFieldErrors(zodError, createNodeFieldErrors());

  if (result.success) {
    applyBusinessRules(result.data, errors);
    applyDuplicateTitleRule(result.data, errors, opts);
  }

  return { ok: Object.values(errors).every((value) => value == null), errors, zodError };
}

/* Helpers opcionales para validar inputs parciales del editor sin crear validators “formales” separados */
export const RulesSchemas = { conditionSchema, effectSchema, interactionRulesSchema };