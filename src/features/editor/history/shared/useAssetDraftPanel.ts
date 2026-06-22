import { useEffect, useRef, useState, type RefObject } from "react";

export type DraftMode = "none" | "new" | "edit";

type UseAssetDraftPanelOptions<T extends { id: string }> = {
  hasProject: boolean;
  selectedId: string | null;
  initialMode?: DraftMode;
  focusRef?: RefObject<HTMLInputElement | null>;
  items: T[];
  setSelectedId: (id: string | null) => void;
  onResetDraftFields: () => void;
  onLoadDraftFieldsFromSelected: (selected: T) => void;
};

/* Hook genérico para paneles de edición/creación de entidades */
export function useAssetDraftPanel<T extends { id: string }>(opts: UseAssetDraftPanelOptions<T>) {
  const { hasProject, selectedId, initialMode = "none", focusRef, items, setSelectedId, onResetDraftFields, onLoadDraftFieldsFromSelected } = opts;

  const [mode, setMode] = useState<DraftMode>(initialMode);

  /* Referencias estables para evitar cierres obsoletos dentro de efectos */
  const itemsRef = useRef<T[]>(items);
  const onLoadRef = useRef(onLoadDraftFieldsFromSelected);
  const onResetRef = useRef(onResetDraftFields);

  const prevSelectedIdRef = useRef<string | null>(null);

  const selected = selectedId ? items.find((item) => item.id === selectedId) ?? null : null;

  /* Mantiene actualizada la referencia a la colección de entidades */
  useEffect(() => { itemsRef.current = items; }, [items]);

  /* Mantiene actualizada la referencia al cargador del draft */
  useEffect(() => { onLoadRef.current = onLoadDraftFieldsFromSelected; }, [onLoadDraftFieldsFromSelected]);

  /* Mantiene actualizada la referencia al reseteo del draft */
  useEffect(() => { onResetRef.current = onResetDraftFields; }, [onResetDraftFields]);

  /* Sincroniza el modo y carga el draft cuando cambia la selección */
  useEffect(() => {
    if (!hasProject) return;
    if (prevSelectedIdRef.current === selectedId) return;

    prevSelectedIdRef.current = selectedId;

    if (!selectedId) {
      setMode("none");
      return;
    }

    const entity = itemsRef.current.find((item) => item.id === selectedId);
    if (!entity) return;

    setMode("edit");
    onLoadRef.current(entity);
  }, [hasProject, selectedId]);

  /* Resetea el panel */
  const reset = () => {
    setMode("none");
    setSelectedId(null);

    onResetRef.current();
    prevSelectedIdRef.current = null;
  };

  /* Inicia creación de una nueva entidad */
  const startNew = () => {
    reset();
    setMode("new");

    if (focusRef?.current) {
      focusRef.current.focus();
      return;
    }

    setTimeout(() => focusRef?.current?.focus(), 0);
  };

   /* Selecciona/deselecciona una entidad de la lista */
  const handleListClick = (entity: T) => {
    if (entity.id === selectedId) {
      reset();
      return;
    }

    setSelectedId(entity.id);
  };

  return { mode, selected, reset, startNew, handleListClick };
}