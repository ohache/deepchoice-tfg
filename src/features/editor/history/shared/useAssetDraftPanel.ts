import { useEffect, useRef, useState } from "react";

export type DraftMode = "none" | "new" | "edit";

type UseAssetDraftPanelOptions<T extends { id: string }> = {
  hasProject: boolean;
  selectedId: string | null;
  initialMode?: DraftMode;
  focusRef?: React.RefObject<HTMLInputElement | null>;
  items: T[];
  setSelectedId: (id: string | null) => void;
  onResetDraftFields: () => void;
  onLoadDraftFieldsFromSelected: (selected: T) => void;
};

/* Hook genérico para paneles de edición */
export function useAssetDraftPanel<T extends { id: string }>(opts: UseAssetDraftPanelOptions<T>) {
  const { hasProject, selectedId, initialMode = "none", focusRef, items, setSelectedId, onResetDraftFields, onLoadDraftFieldsFromSelected } = opts;

  const [mode, setMode] = useState<DraftMode>(initialMode);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const itemsRef = useRef<T[]>(items);
  const onLoadRef = useRef(onLoadDraftFieldsFromSelected);
  const onResetRef = useRef(onResetDraftFields);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { onLoadRef.current = onLoadDraftFieldsFromSelected; }, [onLoadDraftFieldsFromSelected]);
  useEffect(() => { onResetRef.current = onResetDraftFields; }, [onResetDraftFields]);

  const prevSelectedIdRef = useRef<string | null>(null);

  const selected = selectedId ? items.find((item) => item.id === selectedId) ?? null : null;

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
    setIsDeleteModalOpen(false);

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

  /* Gestión de click en la lista */
  const handleListClick = (entity: T) => {
    if (entity.id === selectedId) {
      reset();
      return;
    }

    setSelectedId(entity.id);
  };

  /* Abre el modal de borrado solo si hay selección */
  const openDelete = () => {
    if (!selectedId) return;
    setIsDeleteModalOpen(true);
  };

  /* Cierra el modal de borrado */
  const cancelDelete = () => {
    setIsDeleteModalOpen(false);
  };

  return { mode, selected, isDeleteModalOpen, reset, startNew, handleListClick, openDelete, cancelDelete };
}