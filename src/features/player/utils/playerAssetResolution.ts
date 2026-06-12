import type { ID, Project } from "@/domain/types";

export function buildAssetIdToFile(project: Project): Map<ID, string> {
  const assetIdToFile = new Map<ID, string>();

  for (const asset of project.assets ?? []) {
    assetIdToFile.set(asset.id, asset.file);
  }

  return assetIdToFile;
}

export function resolveAssetIdToSrc(assetId: ID | undefined, assetIdToFile: Map<ID, string>, assetUrls: Record<string, string>): string | undefined {
  if (!assetId) return undefined;

  const file = assetIdToFile.get(assetId);
  if (!file) return undefined;

  return assetUrls[file] ?? file;
}

export function buildAssetIdByKind(project: Project, kind: string): Map<ID, ID> {
  const map = new Map<ID, ID>();

  for (const asset of project.assets ?? []) {
    if (asset.kind !== kind) continue;
    map.set(asset.id, asset.id);
  }

  return map;
}