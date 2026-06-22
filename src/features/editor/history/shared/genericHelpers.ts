import type { ID, PlayerDef, Project } from "@/domain/types";
import { safeTrim } from "@/features/editor/core/editorDataUtils";
import type { MapRegionEditorState } from "@/features/editor/history/maps/mapRegionEditorTypes";

/* Limpia selección cuando se elimina la entidad seleccionada */
export function nextSelectedAfterRemoval(selectedId: ID | null, removedId: ID): ID | null {
  return selectedId === removedId ? null : selectedId;
}

/* Lista plana de imágenes de todos los Players para validar nombres duplicados */
export function getPlayerImageList(project: Project): Array<{ id: ID; name: string }> {
  return project.players.flatMap((player) => player.images.map((image) => ({ id: image.id, name: image.name })));
}

/* Comprueba si dentro del lote entrante hay nombres repetidos */
export function hasDuplicatedInputImageNames(images: Array<{ name: string }>): boolean {
  const names = images.map((image) => image.name.trim().toLowerCase()).filter(Boolean);
  return new Set(names).size !== names.length;
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

/* Estado inicial del editor de regiones */
export const initialMapRegionEditorState: MapRegionEditorState = {
  mapId: null,
  mode: { type: "idle" },
  selectedRegionId: null,
  draft: null,
  drawing: null,
};

/* Título del panel del componente global */
type PanelMode = "none" | "new" | "edit";

export function getDraftPanelTitle(mode: PanelMode, labels: { detail: string; create: string; edit: string }): string {
  if (mode === "new") return labels.create;
  if (mode === "edit") return labels.edit;
  return labels.detail;
}