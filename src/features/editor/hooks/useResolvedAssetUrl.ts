import { useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { ID } from "@/domain/types";

type CacheEntry = { url: string; fileRef: File };

const urlCache = new Map<ID, CacheEntry>();

function isAbsoluteUrl(s: string) {
  return /^(https?:|data:|blob:)/.test(s);
}

export function useResolvedAssetUrl(assetId: ID | null | undefined) {
  const project = useEditorStore((s) => s.project);
  const assetFiles = useEditorStore((s) => s.assetFiles);

  return useMemo(() => {
    if (!assetId) return undefined;
    if (!project) return undefined;

    const asset = (project.assets ?? []).find((a) => a.id === assetId) ?? null;
    if (!asset) return undefined;

    const filePath = (asset.file ?? "").trim();
    if (!filePath) return undefined;

    if (isAbsoluteUrl(filePath)) return filePath;

    const file = assetFiles?.[asset.id];


    if (!file) {
      const cached = urlCache.get(asset.id);
      if (cached) {
        try { URL.revokeObjectURL(cached.url);}
        catch {}
        urlCache.delete(asset.id);
      }
      return filePath;
    }

    const cached = urlCache.get(asset.id);
    if (cached && cached.fileRef === file) return cached.url;

    if (cached) {
      try {URL.revokeObjectURL(cached.url);}
      catch {}
    }

    const nextUrl = URL.createObjectURL(file);
    urlCache.set(asset.id, { url: nextUrl, fileRef: file });
    return nextUrl;
  }, [assetId, project, assetFiles]);
}