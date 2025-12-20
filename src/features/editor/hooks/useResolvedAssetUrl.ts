import { useEffect, useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";

const urlCache = new Map<string, string>();

export function useResolvedAssetUrl(logicalPath: string | undefined | null) {
  const assetFiles = useEditorStore((s) => s.assetFiles);

  const url = useMemo(() => {
    if (!logicalPath) return undefined;

    // Si ya es URL absoluta o data/blob, úsala tal cual
    if (/^(https?:|data:|blob:)/.test(logicalPath)) return logicalPath;

    const file = assetFiles?.[logicalPath];
    if (!file) return undefined;

    const cached = urlCache.get(logicalPath);
    if (cached) return cached;

    const next = URL.createObjectURL(file);
    urlCache.set(logicalPath, next);
    return next;
  }, [logicalPath, assetFiles]);

  // Limpieza cuando cambie el fichero (simple: limpia todo al salir)
  useEffect(() => {
    return () => {
      // opcional: si quieres agresivo, revoca todo al desmontar
      // (en apps largas quizá prefieras una cache más fina)
      for (const u of urlCache.values()) URL.revokeObjectURL(u);
      urlCache.clear();
    };
  }, []);

  return url;
}
