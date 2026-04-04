import type { ID, PlayerDef, Project } from "@/domain/types";
import { buildAssetPath } from "@/store/assets/assetPath";
import { safeTrim } from "@/features/editor/core/editorGenericSlice";
import type { MapRegionEditorState } from "@/features/editor/history/maps/mapEditorTypes";

export function setHasSome<T>(values: Set<T>, predicate: (value: T) => boolean): boolean {
  for (const value of values) {
    if (predicate(value)) return true;
  }
  return false;
}

export function toIdSet<T>(items: T[], getId: (item: T) => ID): Set<ID> {
  const ids = new Set<ID>();

  for (const item of items) {
    ids.add(getId(item));
  }

  return ids;
}

/* Alias semántico cuando lo que queremos construir es un Set de ids */
export function collectIds<T>(items: T[], getId: (item: T) => ID): Set<ID> {
  return toIdSet(items, getId);
}

/* True si algún id del set cumple la referencia contra el target */
export function someReferenceForIds<T>(ids: Set<ID>, target: T, predicate: (target: T, id: ID) => boolean): boolean {
  return setHasSome(ids, (id) => predicate(target, id));
}

/* Helper común para efectos simples del tipo effect.type === X && effect[key] === id */
export function effectMatchesTypedId<K extends string>(effect: { type: string } & Partial<Record<K, ID>>,
  effectType: string, idKey: K, id: ID,): boolean {
  return effect.type === effectType && effect[idKey] === id;
}

/* Limpia selección cuando se elimina la entidad seleccionada */
export function nextSelectedAfterRemoval(selectedId: ID | null, removedId: ID): ID | null {
  return selectedId === removedId ? null : selectedId;
}

export function hasTrackReferenceOutsideEffects(project: Project, trackId: ID): boolean {
  const referencedByNode = project.nodes.some((node) =>
      node.musicTrackId === trackId || node.layers.some((layer) => layer.musicTrackId === trackId),
  );
  if (referencedByNode) return true;

  return project.maps.some((map) => map.regions.some((region) => region.musicTrackId === trackId));
}

/* Garantiza que defaultImageId exista realmente dentro de player.images */
export function ensureDefaultImageId(player: PlayerDef): PlayerDef {
  const images = player.images;

  if (images.length === 0) {
    if (player.defaultImageId === undefined) return player;
    return { ...player, defaultImageId: undefined };
  }

  const currentDefaultId = safeTrim(player.defaultImageId);
  if (currentDefaultId && images.some((img) => img.id === currentDefaultId)) {
    return player;
  }

  return { ...player, defaultImageId: images[0]!.id };
}

/* Construye la ruta lógica de una imagen de player */
export function buildPlayerImageFilePath(playerName: string, imageName: string, ext: string): string {
  const folder = safeTrim(playerName) || "player";
  return buildAssetPath("players", `${folder}/${imageName}.${ext}`);
}

/* Estado inicial del editor de regiones */
export const initialMapRegionEditorState: MapRegionEditorState = {
  context: null,
  mode: { type: "idle" },
  selection: { regionId: null },
  draft: null,
  drawing: null,
};