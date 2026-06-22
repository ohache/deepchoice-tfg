import type { AssetDef, ID } from "@/domain/types";
import { safeTrim } from "@/features/editor/core/editorDataUtils";

/* Tipos auxiliares */
type AssetBackedKind = AssetDef["kind"];

/* Busca un asset por id + kind */
export function findAssetByIdAndKind(assets: AssetDef[], id: ID, kind: AssetBackedKind): AssetDef | null {
  return assets.find((asset) => asset.id === id && asset.kind === kind) ?? null;
}

/* Busca una entidad por id dentro de una lista */
export function findEntityById<T extends { id: ID }>(list: T[], id: ID): T | null {
  return list.find((item) => item.id === id) ?? null;
}

/* Normaliza un posible cambio de nombre */
export function normalizeOptionalName(value?: string): string {
  return typeof value === "string" ? safeTrim(value) : "";
}

/* Normaliza un posible cambio de descripción */
export function normalizeOptionalDescription(value?: string | null): string {
  return typeof value === "string" ? safeTrim(value) : "";
}

/* Convierte un possible file patch en File | null */
export function normalizeOptionalFile(value?: File | null): File | null {
  return value instanceof File ? value : null;
}

/* Detección de cambios*/
export function isNameChanged(prevName: string, nextName: string): boolean {
  return Boolean(nextName) && nextName !== prevName;
}

export function isDescriptionChanged(current?: string, next?: string, hasIncomingValue = true): boolean {
  if (!hasIncomingValue) return false;

  const currentNormalized = normalizeOptionalDescription(current);
  const nextNormalized = normalizeOptionalDescription(next);

  return currentNormalized !== nextNormalized;
}

/* Reemplaza un elemento por id conservando el resto */
export function replaceById<T extends { id: ID }>(list: T[], id: ID, nextItem: T): T[] {
  return list.map((item) => (item.id === id ? nextItem : item));
}

/* Elimina un elemento por id */
export function removeById<T extends { id: ID }>(list: T[], id: ID): T[] {
  return list.filter((item) => item.id !== id);
}