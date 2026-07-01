import type { z, ZodError } from "zod";
import { issuesToAllowedFieldErrors } from "@/shared/zodIssues";
import type { ID, NodeMapLocation, Project } from "@/domain/types";
import { NodeDraftSchema } from "@/features/editor/scene/node/nodeSchemas";
import { isEmptyCondition } from "@/shared/helpers";

type NodeDraftOutput = z.output<typeof NodeDraftSchema>;

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

type ValidateNodeDraftOptions = {
  project?: Project | null;
  projectNodes?: Array<{ id: ID; title: string }>;
  currentNodeId?: ID | null;
};

const NODE_ERROR_FIELDS = ["title", "layers", "dialogues", "musicTrackId", "mapLocation", "isStart", "isFinal", "meta"] as const satisfies readonly (keyof NodeFieldErrors)[];

function normalizeNodeTitle(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function hasNodeFieldErrors(errors: NodeFieldErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/* Comprueba que la localización de mapa exista realmente en el proyecto */
function isValidNodeMapLocation(project: Project | null | undefined, loc?: NodeMapLocation): boolean {
  if (!loc) return true;
  if (!project) return false;

  const map = (project.maps ?? []).find((entry) => entry.id === loc.mapId);
  if (!map) return false;

  return (map.regions ?? []).some((region) => region.id === loc.regionId);
}

function getProjectNodes(opts?: ValidateNodeDraftOptions): Array<{ id: ID; title: string }> {
  if (opts?.projectNodes) return opts.projectNodes;
  return opts?.project?.nodes ?? [];
}

function getLayerLabel(layer: NodeDraftOutput["layers"][number], index: number): string {
  return (layer.label ?? "").trim() || `Capa ${index + 1}`;
}

function hasRealLayerCondition(layer: NodeDraftOutput["layers"][number]): boolean {
  return Boolean(layer.when && !isEmptyCondition(layer.when));
}

/* Reglas propias de la escena como contenedor */
function validateNodeBusinessRules(input: NodeDraftOutput, opts?: ValidateNodeDraftOptions): NodeFieldErrors {
  const errors: NodeFieldErrors = {};

  const title = normalizeNodeTitle(input.title);

  if (title) {
    const duplicatedTitle = getProjectNodes(opts).some((node) => {
      if (opts?.currentNodeId && node.id === opts.currentNodeId) return false;
      return normalizeNodeTitle(node.title) === title;
    });

    if (duplicatedTitle) errors.title = "Ya existe una escena con ese título.";
  }

  if (Boolean(input.isStart) && Boolean(input.isFinal)) errors.isFinal = "Una escena no puede ser inicial y final a la vez.";

  if (!isValidNodeMapLocation(opts?.project, input.mapLocation)) errors.mapLocation = "La localización del mapa no es válida.";

  const layers = input.layers ?? [];

  if (layers.length > 0) {
    const baseLayer = layers[0];

    if (baseLayer?.when && !isEmptyCondition(baseLayer.when)) {
      errors.layers = "La primera capa debe ser la capa base, sin condición.";
    } else {
      const invalidConditionalLayerIndex = layers.findIndex((layer, index) => index > 0 && !hasRealLayerCondition(layer));

      if (invalidConditionalLayerIndex >= 0) {
        const layer = layers[invalidConditionalLayerIndex];

        errors.layers = `La capa “${getLayerLabel(layer, invalidConditionalLayerIndex)}” necesita una condición.`;
      }
    }
  }

  return errors;
}

export function validateNodeDraft(input: unknown, opts?: ValidateNodeDraftOptions): { ok: boolean; errors: NodeFieldErrors; zodError?: ZodError } {
  const result = NodeDraftSchema.safeParse(input);
  const zodError = result.success ? undefined : result.error;

  const zodErrors = issuesToAllowedFieldErrors<NodeFieldErrors>(zodError, NODE_ERROR_FIELDS);

  const businessErrors = result.success ? validateNodeBusinessRules(result.data, opts) : {};

  const errors: NodeFieldErrors = { ...zodErrors, ...businessErrors };

  return { ok: !hasNodeFieldErrors(errors), errors, zodError };
}