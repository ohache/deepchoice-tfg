import { useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { ID } from "@/domain/types";

type CacheEntry = {
  url: string;
  fileRef: File;
};

const urlCache = new Map<ID, CacheEntry>();

function isAbsoluteAssetUrl(value: string): boolean {
  return /^(https?:|data:|blob:)/.test(value);
}

function safeRevokeObjectUrl(url: string) {
  try { URL.revokeObjectURL(url); }
  catch { }
}

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