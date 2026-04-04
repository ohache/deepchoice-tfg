import type { z } from "zod";
import type { Project } from "@/domain/types";
import { MapRegionSchema, MapRegionDraftSchema } from "@/features/editor/history/maps/mapSchemas";
import { createEntityValidators, createFieldErrors } from "@/features/editor/scene/interactiveComponents/interactiveValidator";
import { rect01Intersects, isValidRect01 } from "@/features/editor/hooks/regionShape";

const mapRegionErrorKeys = ["id", "label", "shape", "visible", "musicTrackId", "imageAssetId", "subMapId", "sceneIds", "entrySceneId"] as const;

export type MapRegionFieldErrors = Record<typeof mapRegionErrorKeys[number], string | undefined>;

const duplicateLabelError = "Ya existe otra región con esa etiqueta dentro de este mapa.";
const duplicateSceneError = "No puede haber escenas repetidas en la misma región.";
const invalidEntrySceneError = "La escena de entrada debe pertenecer a las escenas asociadas a la región.";
const invalidSubMapError = "El submapa seleccionado no existe o coincide con el propio mapa.";
const collisionRegionError = "La región se solapa con otra región del mismo mapa.";
const invalidRegionImageError = "La imagen de región seleccionada no existe.";
const regionImageOnlyForComposedError = "Solo puedes asignar imagen de región en mapas de tipo compuesto.";

type MapRegionLike = z.infer<typeof MapRegionSchema> | z.infer<typeof MapRegionDraftSchema>;

function createMapRegionFieldErrors(): MapRegionFieldErrors {
  return createFieldErrors(mapRegionErrorKeys);
}

function hasDuplicateRegionLabel(region: MapRegionLike, project?: Project | null, mapId?: string): boolean {
  if (!project || !mapId) return false;

  const labelKey = region.label?.trim().toLowerCase();
  if (!labelKey) return false;

  const map = project.maps.find((m) => m.id === mapId);
  if (!map) return false;

  return map.regions.some((other) => other.id !== region.id && (other.label ?? "").trim().toLowerCase() === labelKey);
}

function hasDuplicateSceneIds(region: MapRegionLike): boolean {
  return new Set(region.sceneIds).size !== region.sceneIds.length;
}

function hasValidSubMap(region: MapRegionLike, project?: Project | null, mapId?: string): boolean {
  if (!region.subMapId) return true;
  if (!project) return true;
  if (mapId && region.subMapId === mapId) return false;

  return project.maps.some((m) => m.id === region.subMapId);
}

function hasValidRegionImage(region: MapRegionLike, project?: Project | null, mapId?: string): boolean {
  if (!region.imageAssetId) return true;
  if (!project || !mapId) return true;

  const map = project.maps.find((m) => m.id === mapId);
  if (!map) return true;

  if (map.visual?.type !== "composed") return false;

  return project.assets.some((asset) => asset.id === region.imageAssetId);
}

function hasRegionCollisions(region: MapRegionLike, project?: Project | null, mapId?: string): boolean {
  if (!project || !mapId) return false;
  if (!isValidRect01(region.shape, { min: 0.02 })) return false;

  const map = project.maps.find((m) => m.id === mapId);
  if (!map) return false;

  return map.regions.some((other) => {
    if (other.id === region.id) return false;
    if (!region.shape || !isValidRect01(region.shape, { min: 0.02 })) return false;
    if (!isValidRect01(other.shape, { min: 0.02 })) return false;
    return rect01Intersects(region.shape, other.shape);
  });
}

function applyBusinessRules(region: MapRegionLike, errors: MapRegionFieldErrors, ctx?: { project?: Project | null; mapId?: string }): void {
  if (hasDuplicateSceneIds(region)) errors.sceneIds ??= duplicateSceneError;

  if (region.entrySceneId && !region.sceneIds.includes(region.entrySceneId)) errors.entrySceneId ??= invalidEntrySceneError;

  if (hasDuplicateRegionLabel(region, ctx?.project, ctx?.mapId)) errors.label ??= duplicateLabelError;

  if (!hasValidSubMap(region, ctx?.project, ctx?.mapId)) errors.subMapId ??= invalidSubMapError;

  if (!hasValidRegionImage(region, ctx?.project, ctx?.mapId)) {
    const map = ctx?.project?.maps.find((m) => m.id === ctx?.mapId);

    errors.imageAssetId ??= map?.visual?.type === "composed" ? invalidRegionImageError : regionImageOnlyForComposedError;
  }

  if (hasRegionCollisions(region, ctx?.project, ctx?.mapId)) errors.shape ??= collisionRegionError;
}

const validators = createEntityValidators(MapRegionSchema, MapRegionDraftSchema, createMapRegionFieldErrors, applyBusinessRules);

export function validateMapRegion(input: Parameters<typeof validators.validate>[0], ctx?: { project?: Project | null; mapId?: string }) {
  return validators.validate(input, ctx);
}

export function validateMapRegionDraft(input: Parameters<typeof validators.validateDraft>[0], ctx?: { project?: Project | null; mapId?: string }) {
  return validators.validateDraft(input, ctx);
}