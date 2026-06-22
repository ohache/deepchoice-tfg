import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";

export type SceneToggleFieldId = "title" | "layers" | "dialogues" | "map" | "music" | "type";
export type LayerToggleFieldId = "name" | "image" | "text" | "hotspots" | "placedItems" | "placedNpcs" | "placedPlayers" | "music";

/* Estado del campo activo a nivel escena */
export function useSceneFieldState () {
  const [activeField, setActiveField] = useState<SceneToggleFieldId | null>(null);

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (activeField !== "title") return;

    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [activeField]);

  const toggleField = useCallback((field: SceneToggleFieldId) => {
    setActiveField((current) => (current === field ? null : field));
  }, []);

  return { activeField, setActiveField, toggleField, titleInputRef };
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