import { useCallback, useEffect, useRef, useState, useMemo, type ChangeEvent } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { SceneValidationIssue } from "@/features/editor/validation/sceneValidator";

export type SceneToggleFieldId = "title" | "text" | "image" | "hotspots" | "tags";

export const buildBackgroundPath = (fileName: string): string => `assets/backgrounds/${fileName}`;
export const buildMusicPath = (fileName: string): string => `assets/music/${fileName}`;
export const buildItemImagePath = (fileName: string): string => `assets/items/${fileName}`;

/* Parte activa de la escena */
export function useSceneFieldState(deps: any[] = []) {
  const [activeField, setActiveField] = useState<SceneToggleFieldId | null>("title");

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (activeField === "title" && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [activeField, ...deps]);

  useEffect(() => {
    if (activeField === "text" && textAreaRef.current) {
      textAreaRef.current.focus();
      textAreaRef.current.select();
    }
  }, [activeField, ...deps]);

  const toggleField = (field: SceneToggleFieldId) =>
    setActiveField((current) => (current === field ? null : field));

  return { activeField, setActiveField, toggleField, titleInputRef, textAreaRef };
}

/* Navegación hacia Historia/Vista */
export function useSceneNavigation() {
  const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);
  const enterCreateMode = useEditorStore((s) => s.enterCreateMode);

  const goToHistoriaVista = useCallback(() => {
    setPrimaryMode("historia");
    setSecondaryMode("vista");
    enterCreateMode();
  }, [setPrimaryMode, setSecondaryMode, enterCreateMode]);

  return { goToHistoriaVista };
}

/**Resuelve la URL de una imagen de escena dada su ruta lógica */
export function useResolvedSceneImage(logicalPath?: string) {
  const assetFiles = useEditorStore((s) => s.assetFiles);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!logicalPath) {
      setResolvedImageUrl(undefined);
      return;
    }

    const file = assetFiles[logicalPath];
    if (!file) {
      setResolvedImageUrl(logicalPath);
      return;
    }

    const objUrl = URL.createObjectURL(file);
    setResolvedImageUrl(objUrl);

    return () => URL.revokeObjectURL(objUrl);
  }, [logicalPath, assetFiles]);

  return resolvedImageUrl;
}

/* Errores de validación por campo */
export interface SceneFieldErrors {
  titleError?: SceneValidationIssue;
  textError?: SceneValidationIssue;
  imageError?: SceneValidationIssue;
  hotspotErrors: SceneValidationIssue[];
  musicError?: SceneValidationIssue;
  mapError?: SceneValidationIssue;
  npcErrors?: SceneValidationIssue[];
  itemError?: SceneValidationIssue;
}

export function useSceneFieldErrors(issues: SceneValidationIssue[]): SceneFieldErrors {
  return useMemo(() => {
    const titleError = issues.find((i) => i.field === "title" && i.severity === "error");
    const textError = issues.find((i) => i.field === "text" && i.severity === "error");
    const imageError = issues.find((i) => i.field === "image" && i.severity === "error");
    const hotspotErrors = issues.filter((i) => i.severity === "error" &&
      (i.field === "hotspots" || i.field.startsWith("hotspots["))
    );

    const musicError = issues.find((i) => i.field === "musicId" && i.severity === "error");
    const mapError = issues.find((i) => i.field === "mapId" && i.severity === "error");
    const npcErrors = issues.filter((i) => i.field === "npcIds" && i.severity === "error");
    const itemError = issues.find((i) => i.field === "placedItems" && i.severity === "error");


    return { titleError, textError, imageError, hotspotErrors, musicError, mapError, npcErrors, itemError };
  }, [issues]);
}

/* Handler para la imagen */
interface HandleSceneImageOptions {
  setImageLocalError: (msg: string | null) => void;
  onValidImagePath: (relativePath: string, file: File) => void;
}

/** Lógica común para procesar un File de imagen */
export function processSceneImageFile(file: File, options: HandleSceneImageOptions) {
  const lowerName = file.name.toLowerCase();
  const isValidExt = lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg");

  if (!isValidExt) {
    options.setImageLocalError("La imagen debe ser .png, .jpg o .jpeg.");
    return;
  }

  options.setImageLocalError(null);

  const relativePath = buildBackgroundPath(file.name);
  options.onValidImagePath(relativePath, file);
}

/** Versión para usar directamente como onChange del input file */
export function handleSceneImageFileChange(event: ChangeEvent<HTMLInputElement>, options: HandleSceneImageOptions) {
  const file = event.target.files?.[0];
  if (!file) return;

  processSceneImageFile(file, options);

  event.target.value = "";
}