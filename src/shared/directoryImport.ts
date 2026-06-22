import type { ID, Project } from "@/domain/types";

/* Type guard para comprobar si un File viene de un input con webkitdirectory */
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

function ensureAssetsPrefix(path: string): string {
    const normalizedPath = cleanSlashes(path).replace(/^\.\/+/, "").replace(/^\/+/, "");

  if (!normalizedPath) return "";

  return /^assets\//i.test(normalizedPath) ? normalizedPath : `assets/${normalizedPath}`;
}

function normalizeImportedFilePath(rawPath: string): string {
  const normalizedPath = cleanSlashes(rawPath);

  if (!normalizedPath) return "";

  const pathSegments = normalizedPath.split("/").filter(Boolean);

  const pathWithoutRootFolder =  pathSegments.length > 1 ? pathSegments.slice(1).join("/") : pathSegments.join("/");

  return ensureAssetsPrefix(pathWithoutRootFolder);
}

function buildPickedFilesByPath(files: File[]): Record<string, File> {
  const map: Record<string, File> = {};
  for (const file of files) {
    const pickedPath = getPickedRelativePath(file);
    const normalizedPath = normalizeImportedFilePath(pickedPath);

    if (!normalizedPath) continue;
    if (normalizedPath.toLowerCase().endsWith(".json")) continue;

    map[normalizedPath] = file;
  }
  return map;
}

/* Relaciona los assets declarados en el proyecto con los archivos reales seleccionados por el usuario al importar una carpeta */
export function resolveDirectoryImport(project: Project, files: File[]) : { normalizedAssets: Project["assets"]; assetFilesById: Record<ID, File> } {
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