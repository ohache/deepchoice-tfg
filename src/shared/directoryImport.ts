import type { ID, Project } from "@/domain/types";

function hasWebkitRelativePath(file: File): file is File & { webkitRelativePath: string } {
  const maybe = file as File & { webkitRelativePath?: unknown };
  return typeof maybe.webkitRelativePath === "string";
}

export function getPickedRelativePath(file: File): string {
  if (hasWebkitRelativePath(file) && file.webkitRelativePath.length > 0) return file.webkitRelativePath;
  
  return file.name;
}

export function normalizeAssetPath(rawPath: string): string {
  const unixPath = rawPath.replace(/\\/g, "/");
  const parts = unixPath.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : unixPath;
}

const cleanSlashes = (raw: string) => String(raw ?? "").replace(/\\/g, "/").trim();

const ensureAssetsPrefix = (p: string) => {
  const x = cleanSlashes(p).replace(/^\.\/+/, "").replace(/^\/+/, "");
  if (!x) return "";
  return /^assets\//i.test(x) ? x : `assets/${x}`;
};

function normalizePickedFilePath(raw: string): string {
  const p = cleanSlashes(raw);
  if (!p) return "";
  const parts = p.split("/").filter(Boolean);
  const withoutRoot = parts.length > 1 ? parts.slice(1).join("/") : parts.join("/");
  return ensureAssetsPrefix(withoutRoot);
}

function buildPickedFilesByPath(files: File[]): Record<string, File> {
  const map: Record<string, File> = {};
  for (const file of files) {
    const pickedPath = getPickedRelativePath(file);
    const normalizedPath = normalizePickedFilePath(pickedPath);

    if (!normalizedPath) continue;
    if (normalizedPath.toLowerCase().endsWith(".json")) continue;

    map[normalizedPath] = file;
  }
  return map;
}

export function resolveDirectoryImport(project: Project, files: File[]) {
  const pickedFilesByPath = buildPickedFilesByPath(files);

  const normalizedAssets: Project["assets"] = [];
  const assetFilesById: Record<ID, File> = {};

  for (const asset of project.assets ?? []) {
    const assetPath = ensureAssetsPrefix(String(asset.file ?? ""));
    const assetWithNormalizedPath = { ...asset, file: assetPath };
    normalizedAssets.push(assetWithNormalizedPath);

    const file = assetPath ? pickedFilesByPath[assetPath] : undefined;
    if (file) assetFilesById[assetWithNormalizedPath.id] = file;
  }

  return { normalizedAssets, assetFilesById };
}
