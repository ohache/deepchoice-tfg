import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { Node, SceneImageLayer } from "@/domain/types";
import { buildAssetPath } from "@/store/assets/assetPath";

export type FieldError = { message: string };

export type SceneToggleFieldId = "title" | "layers" | "dialogues" | "map" | "music" | "type";

export type LayerToggleFieldId = | "image" | "text" | "hotspots" | "placedItems" | "placedNpcs" | "placedPlayers" | "music";

/* Parte activa de la escena */
export function useSceneFieldState(deps: unknown[] = []) {
  const [activeField, setActiveField] = useState<SceneToggleFieldId | null>("title");

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (activeField !== "title") return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [activeField, ...deps]);

  const toggleField = (field: SceneToggleFieldId) =>
    setActiveField((current) => (current === field ? null : field));

  return { activeField, setActiveField, toggleField, titleInputRef };
}

/* Parte activa de la layer (para SceneLayersField) */
export function useLayerFieldState(deps: unknown[] = []) {
  const [activeLayerField, setActiveLayerField] = useState<LayerToggleFieldId | null>(null);

  const layerLabelInputRef = useRef<HTMLInputElement | null>(null);
  const layerTextAreaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (activeLayerField !== "text") return;
    layerTextAreaRef.current?.focus();
    layerTextAreaRef.current?.select();
  }, [activeLayerField, ...deps]);

  const toggleLayerField = (field: LayerToggleFieldId) =>
    setActiveLayerField((current) => (current === field ? null : field));

  return { activeLayerField, setActiveLayerField, toggleLayerField, layerLabelInputRef, layerTextAreaRef };
}

/* Navegación hacia Historia/Vista */
export function useSceneNavigation() {
  const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);

  const goToHistoriaVista = useCallback(() => {
    setPrimaryMode("historia");
    setSecondaryMode("vista");
  }, [setPrimaryMode, setSecondaryMode]);

  return { goToHistoriaVista };
}

/* ✅ Errores por campo (nivel escena) en formato UI mínimo */
export type SceneFieldErrors = {
  title?: FieldError;
  layers?: FieldError;
  isStart?: FieldError;
  isFinal?: FieldError;
  musicTrackId?: FieldError;
  mapLocation?: FieldError;
  meta?: FieldError;
};

export function toFieldError(message?: string | null): FieldError | undefined {
  const m = typeof message === "string" ? message.trim() : "";
  return m ? { message: m } : undefined;
}

export function buildDraftSceneInputFromNode(node: Node) {
  return {
    title: node.title ?? "",
    layers: (node.layers ?? []) as SceneImageLayer[],
    musicTrackId: node.musicTrackId ?? undefined,
    mapLocation: node.mapLocation ?? undefined,
    isStart: node.isStart ?? undefined,
    isFinal: node.isFinal ?? undefined,
    meta: node.meta,
  };
}

/* Handler para la imagen */
interface HandleSceneImageOptions {
  setImageLocalError: (msg: string | null) => void;
  onValidImagePath: (relativePath: string, file: File) => void;
}

/** Lógica común para procesar un File de imagen (png/jpg/jpeg/gif) */
export function processSceneImageFile(file: File, options: HandleSceneImageOptions) {
  const lowerName = file.name.toLowerCase();

  const hasValidExt =
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".gif");

  const hasValidMime =
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/gif" ||
    file.type === "";

  if (!hasValidExt || !hasValidMime) {
    options.setImageLocalError("La imagen debe ser .png, .jpg, .jpeg o .gif.");
    return;
  }

  options.setImageLocalError(null);

  const relativePath = buildAssetPath("backgrounds", file.name);
  options.onValidImagePath(relativePath, file);
}

/** Versión para usar directamente como onChange del input file */
export function handleSceneImageFileChange(event: ChangeEvent<HTMLInputElement>, options: HandleSceneImageOptions) {
  const file = event.target.files?.[0];
  if (!file) return;

  processSceneImageFile(file, options);

  event.target.value = "";
}