import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { Node, SceneImageLayer } from "@/domain/types";
import { buildAssetPath } from "@/store/assets/assetPath";

export type FieldError = { message: string };
export type SceneToggleFieldId = "title" | "layers" | "dialogues" | "map" | "music" | "type";
export type LayerToggleFieldId = "name" | "image" | "text" | "hotspots" | "placedItems" | "placedNpcs" | "placedPlayers" | "music";

/* Estado del campo activo a nivel escena */
export function useSceneFieldState(deps: unknown[] = []) {
  const [activeField, setActiveField] = useState<SceneToggleFieldId | null>("title");

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (activeField !== "title") return;

    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [activeField, ...deps]);

  const toggleField = useCallback((field: SceneToggleFieldId) => {
    setActiveField((current) => (current === field ? null : field));
  }, []);

  return { activeField, setActiveField, toggleField, titleInputRef };
}

/* Estado del campo activo dentro de SceneLayersField */
export function useLayerFieldState(deps: unknown[] = []) {
  const activeLayerField = useEditorStore((state) => state.activeLayerField);
  const setActiveLayerField = useEditorStore((state) => state.setActiveLayerField);

  const layerLabelInputRef = useRef<HTMLInputElement | null>(null);
  const layerTextAreaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (activeLayerField !== "text") return;

    layerTextAreaRef.current?.focus();
    layerTextAreaRef.current?.select();
  }, [activeLayerField, ...deps]);

  const toggleLayerField = useCallback((field: LayerToggleFieldId) => {
    setActiveLayerField(activeLayerField === field ? null : field);
  }, [activeLayerField, setActiveLayerField]);

  return { activeLayerField, setActiveLayerField, toggleLayerField, layerLabelInputRef, layerTextAreaRef };
}

/* Navegación hacia Historia - Vista */
export function useSceneNavigation() {
  const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);

  const goToHistoriaVista = useCallback(() => {
    setPrimaryMode("historia");
    setSecondaryMode("vista");
  }, [setPrimaryMode, setSecondaryMode]);

  return { goToHistoriaVista };
}

/* Errores de validación a nivel escena */

export type SceneFieldErrors = {
  title?: FieldError;
  layers?: FieldError;
  isStart?: FieldError;
  isFinal?: FieldError;
  musicTrackId?: FieldError;
  mapLocation?: FieldError;
  meta?: FieldError;
};

/* Convierte string opcional en el formato de error usado por la UI */
export function toFieldError(message?: string | null): FieldError | undefined {
  const trimmed = typeof message === "string" ? message.trim() : "";
  return trimmed ? { message: trimmed } : undefined;
}

/* Construye el draft mínimo de escena a partir de un nodo existente */
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

/* Utilidades para procesar imágenes de escena */
interface HandleSceneImageOptions {
  setImageLocalError: (msg: string | null) => void;
  onValidImagePath: (relativePath: string, file: File) => void;
}

const VALID_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif"] as const;
const VALID_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", ""] as const;

function isValidSceneImageFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();

  const hasValidExt = VALID_IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasValidMime = VALID_IMAGE_MIME_TYPES.includes(file.type as (typeof VALID_IMAGE_MIME_TYPES)[number]);

  return hasValidExt && hasValidMime;
}

export function processSceneImageFile(file: File, options: HandleSceneImageOptions) {
  if (!isValidSceneImageFile(file)) {
    options.setImageLocalError("La imagen debe ser .png, .jpg, .jpeg o .gif.");
    return;
  }

  options.setImageLocalError(null);

  const relativePath = buildAssetPath("backgrounds", file.name);
  options.onValidImagePath(relativePath, file);
}

export function handleSceneImageFileChange(event: ChangeEvent<HTMLInputElement>, options: HandleSceneImageOptions) {
  const file = event.target.files?.[0];
  if (!file) return;

  processSceneImageFile(file, options);

  event.target.value = "";
}