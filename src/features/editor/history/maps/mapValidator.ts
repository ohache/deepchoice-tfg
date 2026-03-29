import type { z } from "zod";
import type { Project, ID } from "@/domain/types";
import { WorldMapSchema, MapDraftSchema } from "@/features/editor/history/maps/mapSchemas";
import { hasDuplicateName } from "@/validation/genericValidator";
import { validateWithSchema, createFieldErrors } from "@/features/editor/scene/interactiveComponents/interactiveValidator";

type MapDraftInput = z.input<typeof MapDraftSchema>;
type WorldMapInput = z.input<typeof WorldMapSchema>;

const mapErrorKeys = ["id", "name", "visual", "regions", "file"] as const;

export type MapFieldErrors = Record<typeof mapErrorKeys[number], string | undefined>;

const duplicateNameError = "Ya existe otro mapa con ese nombre.";
const requireFileOnNewError = "Selecciona una imagen antes de guardar.";
const requireFileOnEditMissingVisualError = "Este mapa no tiene imagen asociada. Selecciona una imagen antes de guardar.";
const requireBackgroundOnComposedMissingVisualError = "Este mapa compuesto no tiene imagen de fondo asociada. Selecciona una imagen antes de guardar.";

function createMapFieldErrors(): MapFieldErrors {
  return createFieldErrors(mapErrorKeys);
}

function hasExistingMapVisual(project: Project, mapId?: ID): boolean {
  if (!mapId) return false;

  const map = (project.maps ?? []).find((m) => m.id === mapId);
  if (!map) return false;

  if (map.visual?.type === "singleImage") return typeof map.visual.imageAssetId === "string" && map.visual.imageAssetId.trim().length > 0;

  if (map.visual?.type === "composed") return typeof map.visual.backgroundAssetId === "string" && map.visual.backgroundAssetId.trim().length > 0;

  return false;
}

/* Valida el draft del formulario de Maps */
export function validateMapDraft(input: MapDraftInput, opts: { mode: "new" | "edit"; project: Project; currentMapId?: ID }) {
  const schemaResult = MapDraftSchema.safeParse(input);
  const errors = createMapFieldErrors();

  if (!schemaResult.success) {
    const issue = schemaResult.error.issues[0];
    const path = String(issue?.path?.[0] ?? "name") as keyof MapFieldErrors;
    errors[path] = issue?.message ?? "El mapa no es válido.";
    return { ok: false, errors, zodError: schemaResult.error };
  }

  const data = schemaResult.data;
  const mapList = opts.project.maps ?? [];

  if (hasDuplicateName({ list: mapList, incomingName: data.name, ignoreId: opts.currentMapId })) errors.name = duplicateNameError;

  const hasFile = data.file instanceof File;

  if (opts.mode === "new" && !hasFile) errors.file = requireFileOnNewError;

  if (opts.mode === "edit" && !hasFile) {
  const currentMap = (opts.project.maps ?? []).find((m) => m.id === opts.currentMapId);

  if (!hasExistingMapVisual(opts.project, opts.currentMapId)) {
    errors.file = currentMap?.visual?.type === "composed"
        ? requireBackgroundOnComposedMissingVisualError
        : requireFileOnEditMissingVisualError;
  }
}

  return {
    ok: Object.values(errors).every((value) => value == null),
    errors,
    zodError: undefined,
  };
}

/* Valida la entidad WorldMap ya construida */
export function validateWorldMap(input: WorldMapInput) {
  return validateWithSchema(WorldMapSchema, input, createMapFieldErrors);
}