import type { AssetDef, ID, VarDef } from "@/domain/types";

/* Normaliza cualquier valor a string limpio */
export function safeTrim(value: string | undefined | null): string {
  return String(value ?? "").trim();
}

/* Inserta o actualiza un asset identificado por id + kind */
export function upsertAsset(assets: AssetDef[], input: { id: ID; kind: AssetDef["kind"]; name: string; file: string }): { assets: AssetDef[]; touched: boolean } {
  const index = assets.findIndex((asset) => asset.id === input.id && asset.kind === input.kind);

  if (index >= 0) {
    const previous = assets[index]!;

    const next: AssetDef = {
      ...previous,
      name: input.name,
      file: input.file,
    };

    const changed = previous.name !== next.name || previous.file !== next.file;

    if (!changed) return { assets, touched: false };

    const nextAssets = assets.slice();
    nextAssets[index] = next;

    return { assets: nextAssets, touched: true };
  }

  return {
    assets: [
      ...assets,
      { id: input.id, kind: input.kind, name: input.name, file: input.file },
    ], touched: true,
  };
}

/* Elimina un asset identificado por (id + kind) */
export function removeAsset(assets: AssetDef[], input: { id: ID; kind: AssetDef["kind"] }): { assets: AssetDef[]; touched: boolean } {
  const nextAssets = assets.filter((asset) => !(asset.id === input.id && asset.kind === input.kind));

  return {
    assets: nextAssets.length === assets.length ? assets : nextAssets,
    touched: nextAssets.length !== assets.length,
  };
}

/* Asocia un File a un assetId */
export function upsertAssetFile(assetFiles: Record<ID, File>, assetId: ID, file: File): { assetFiles: Record<ID, File>; touched: boolean } {
  if (assetFiles[assetId] === file) return { assetFiles, touched: false };

  return {
    assetFiles: { ...assetFiles, [assetId]: file },
    touched: true,
  };
}

/* Elimina el File asociado a un assetId */
export function removeAssetFile(assetFiles: Record<ID, File>, assetId: ID): { assetFiles: Record<ID, File>; touched: boolean } {
  if (!(assetId in assetFiles)) return { assetFiles, touched: false };

  const nextFiles = { ...assetFiles };
  delete nextFiles[assetId];

  return { assetFiles: nextFiles, touched: true };
}

/* Compara dos VarDef por su contenido relevante */
export function sameVarDef(a: VarDef, b: VarDef): boolean {
  if (a.id !== b.id) return false;
  if (a.type !== b.type) return false;
  if (safeTrim(a.name) !== safeTrim(b.name)) return false;

  if (a.type === "number" && b.type === "number") return (a.min === b.min && a.max === b.max && a.initial === b.initial);

  if (a.type === "boolean" && b.type === "boolean") return a.initial === b.initial;

  return false;
}

/* Extrae la extensión de un nombre de archivo; fallback a png */
export function fileExtFromName(name: string): string {
  const match = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "png";
}

/* Clonado profundo seguro para POJOs */
export function deepClonePojo<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);

  return JSON.parse(JSON.stringify(value)) as T;
}