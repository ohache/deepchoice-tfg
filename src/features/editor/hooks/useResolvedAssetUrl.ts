import { useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { ID } from "@/domain/types";

type CacheEntry = {
  url: string;
  fileRef: File;
};

/* Caché global de blob URLs por assetId */
const urlCache = new Map<ID, CacheEntry>();

/* True si la ruta ya es usable directamente por el navegador */
function isAbsoluteAssetUrl(value: string): boolean {
  return /^(https?:|data:|blob:)/.test(value);
}

/* Revoca una blob URL de forma segura */
function safeRevokeObjectUrl(url: string) {
  try { URL.revokeObjectURL(url); }
  catch { }
}

/* Resuelve la URL real de un asset */
export function useResolvedAssetUrl(assetId: ID | null | undefined) {
  const project = useEditorStore((s) => s.project);
  const assetFiles = useEditorStore((s) => s.assetFiles);

  return useMemo(() => {
    if (!assetId || !project) return undefined;

    const asset = project.assets.find((current) => current.id === assetId) ?? null;
    if (!asset) return undefined;

    const filePath = asset.file.trim();
    if (!filePath) return undefined;

    if (isAbsoluteAssetUrl(filePath)) return filePath;

    const file = assetFiles?.[asset.id];
    const cached = urlCache.get(asset.id);

    if (!file) {
      if (cached) {
        safeRevokeObjectUrl(cached.url);
        urlCache.delete(asset.id);
      }

      return filePath;
    }

    if (cached && cached.fileRef === file) return cached.url;

    if (cached) safeRevokeObjectUrl(cached.url);

    const nextUrl = URL.createObjectURL(file);
    urlCache.set(asset.id, { url: nextUrl, fileRef: file });

    return nextUrl;
  }, [assetId, project, assetFiles]);
}