import type { AssetDef, ID } from "@/domain/types";
import { safeTrim } from "@/features/editor/core/editorGenericSlice";

/* Tipos auxiliares */
export type AssetBackedKind = AssetDef["kind"];

export type NamedEntity = {
  id: ID;
  name: string;
};

export type DescribedEntity = NamedEntity & {
  description?: string;
};

/* Busca un asset por id + kind */
export function findAssetByIdAndKind(assets: AssetDef[], id: ID, kind: AssetBackedKind): AssetDef | null {
  return assets.find((asset) => asset.id === id && asset.kind === kind) ?? null;
}

/* Alias semántico para slices asset-backed */
export function findEntityAsset(assets: AssetDef[], input: { id: ID; kind: AssetBackedKind }): AssetDef | null {
  return findAssetByIdAndKind(assets, input.id, input.kind);
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
export function normalizeOptionalDescription(value?: string): string {
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

export function isDescriptionChanged(prevDescription: string | undefined, nextDescriptionRaw: string, hasIncomingDescription: boolean): boolean {
  if (!hasIncomingDescription) return false;
  return safeTrim(prevDescription) !== nextDescriptionRaw;
}

export function isFileChanged(file: File | null): boolean {
  return Boolean(file);
}

/* Devuelve patch para name solo si ha cambiado */
export function buildNamePatch(nextName: string, changed: boolean): Pick<NamedEntity, "name"> | {} {
  return changed ? { name: nextName } : {};
}

/* Devuelve patch para description solo si ha cambiado */
export function buildDescriptionPatch(nextDescription: string, changed: boolean): { description?: string } | {} {
  if (!changed) return {};
  return { description: nextDescription || undefined };
}

/* Reemplaza un elemento por id conservando el resto */
export function replaceById<T extends { id: ID }>(list: T[], id: ID, nextItem: T): T[] {
  return list.map((item) => (item.id === id ? nextItem : item));
}

/* Elimina un elemento por id */
export function removeById<T extends { id: ID }>(list: T[], id: ID): T[] {
  return list.filter((item) => item.id !== id);
}