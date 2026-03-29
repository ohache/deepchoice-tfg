import type { AssetDef, ID, Project } from "@/domain/types";

/* Normaliza strings para comparaciones */
function normalizeName(s: string): string {
  return (s ?? "").trim().toLowerCase();
}

/* Devuelve un "basename" comparable, a partir de AssetDef.file */
export function getAssetFileBasename(asset: AssetDef): string {
  const raw = asset.file ?? "";
  const parts = raw.split(/[/\\]/);
  return (parts[parts.length - 1] ?? raw).trim();
}

/* Comprueba si un nombre ya existe en una lista */
export function hasDuplicateName<T extends { id: ID; name: string }>(args: {
  list: T[]; incomingName: string; ignoreId?: ID }): boolean {
  const incoming = normalizeName(args.incomingName);
  if (!incoming) return false;

  return args.list.some((t) => {
    if (args.ignoreId && t.id === args.ignoreId) return false;
    return normalizeName(t.name) === incoming;
  });
}

/* Duplicidad por fichero cuando el asset está ligado por id (item.id === asset.id) */
export function hasDuplicateFileByLinkedAssetId<T extends { id: ID }>(args: {
  project: Project; list: T[]; assetKind: AssetDef["kind"]; incomingFileName: string; ignoreId?: ID }): boolean {
  const incomingBasename = normalizeName(args.incomingFileName);
  if (!incomingBasename) return false;

  return args.list.some((t) => {
    if (args.ignoreId && t.id === args.ignoreId) return false;

    const asset = args.project.assets.find((a) => a.id === t.id && a.kind === args.assetKind);
    if (!asset) return false;

    const existingBasename = normalizeName(getAssetFileBasename(asset));
    return existingBasename !== "" && existingBasename === incomingBasename;
  });
}