import type { z } from "zod";
import type { Project, RegionShape } from "@/domain/types";
import { MapRegionSchema, MapRegionDraftSchema } from "@/features/editor/history/maps/mapSchemas";
import { createEntityValidators, createFieldErrors } from "@/features/editor/scene/interactiveComponents/interactiveValidator";
import { rect01Intersects, isValidRect01, DEFAULT_MIN_RECT_01 } from "@/features/editor/hooks/regionShape";

type MapRegionLike = z.infer<typeof MapRegionSchema> | z.infer<typeof MapRegionDraftSchema>;

const mapRegionErrorKeys = ["id", "label", "shape", "visible", "musicTrackId", "imageAssetId", "subMapId", "sceneIds", "entrySceneId" ] as const;

export type MapRegionFieldErrors = Record<(typeof mapRegionErrorKeys)[number], string | undefined>;

function createMapRegionFieldErrors(): MapRegionFieldErrors {
  return createFieldErrors(mapRegionErrorKeys);
}

function isValidShape(shape: RegionShape | null | undefined): shape is RegionShape {
  return shape != null && isValidRect01(shape, { min: DEFAULT_MIN_RECT_01 });
}

function normalizeLabel(label?: string): string {
  return (label ?? "").trim().toLowerCase();
}

function hasDuplicateRegionLabel(region: MapRegionLike, project?: Project | null, mapId?: string): boolean {
  if (!project || !mapId) return false;

  const key = normalizeLabel(region.label);
  if (!key) return false;

  const map = project.maps.find((m) => m.id === mapId);
  if (!map) return false;

  return map.regions.some((other) => other.id !== region.id && normalizeLabel(other.label) === key);
}

function hasDuplicateSceneIds(region: MapRegionLike): boolean {
  return new Set(region.sceneIds).size !== region.sceneIds.length;
}

function hasValidSubMap(region: MapRegionLike, project?: Project | null, mapId?: string): boolean {
  if (!region.subMapId) return true;
  if (!project || !mapId) return true;
  if (region.subMapId === mapId) return false;

  return project.maps.some((map) => map.id === region.subMapId);
}

function hasValidRegionImage(region: MapRegionLike, project?: Project | null, mapId?: string): boolean {
  if (!region.imageAssetId) return true;
  if (!project || !mapId) return true;

  const map = project.maps.find((m) => m.id === mapId);
  if (!map) return true;

  if (map.visual.type !== "composed") return false;

  return project.assets.some((asset) => asset.id === region.imageAssetId);
}

function hasRegionCollisions(region: MapRegionLike, project?: Project | null, mapId?: string): boolean {
  if (!project || !mapId) return false;
  if (!isValidShape(region.shape)) return false;

  const regionShape = region.shape;

  const map = project.maps.find((m) => m.id === mapId);
  if (!map) return false;

  return map.regions.some((other) => {
    if (other.id === region.id) return false;
    if (!isValidShape(other.shape)) return false;

    return rect01Intersects(regionShape, other.shape);
  });
}

function applyBusinessRules(region: MapRegionLike, errors: MapRegionFieldErrors, ctx?: { project?: Project | null; mapId?: string }): void {
  if (hasDuplicateSceneIds(region)) errors.sceneIds ??= "No puede haber escenas repetidas en la misma región.";

  if (region.entrySceneId && !region.sceneIds.includes(region.entrySceneId)) errors.entrySceneId ??= "La escena de entrada debe pertenecer a las escenas asociadas a la región.";

  if (hasDuplicateRegionLabel(region, ctx?.project, ctx?.mapId)) errors.label ??= "Ya existe otra región con ese nombre dentro de este mapa.";

  if (!hasValidSubMap(region, ctx?.project, ctx?.mapId)) errors.subMapId ??= "El submapa seleccionado no existe o coincide con el propio mapa.";

  if (!hasValidRegionImage(region, ctx?.project, ctx?.mapId)) {
    const map = ctx?.project?.maps.find((m) => m.id === ctx?.mapId);

    errors.imageAssetId ??= map?.visual.type === "composed" ? "La imagen de región seleccionada no existe." : "Solo puedes asignar imagen de región en mapas de tipo compuesto.";
  }

  if (hasRegionCollisions(region, ctx?.project, ctx?.mapId)) errors.shape ??= "La región se solapa con otra región del mismo mapa.";
}

const validators = createEntityValidators(MapRegionSchema, MapRegionDraftSchema, createMapRegionFieldErrors, applyBusinessRules);

export function validateMapRegion(input: Parameters<typeof validators.validate>[0], ctx?: { project?: Project | null; mapId?: string }) {
  return validators.validate(input, ctx);
}

export function validateMapRegionDraft(input: Parameters<typeof validators.validateDraft>[0], ctx?: { project?: Project | null; mapId?: string }) {
  return validators.validateDraft(input, ctx);
}