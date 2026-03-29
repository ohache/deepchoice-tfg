import { useEffect, useRef, useState } from "react";

export type DraftMode = "none" | "new" | "edit";

export function useAssetDraftPanel<T extends { id: string }>(opts: {
  hasProject: boolean;
  selectedId: string | null;
  initialMode?: DraftMode;
  focusRef?: React.RefObject<HTMLInputElement | null>;
  items: T[];
  setSelectedId: (id: string | null) => void;
  onResetDraftFields: () => void;
  onLoadDraftFieldsFromSelected: (selected: T) => void;
}) {
  const { hasProject, selectedId, initialMode = "none", focusRef, items, setSelectedId,  onResetDraftFields, onLoadDraftFieldsFromSelected } = opts;

  const [mode, setMode] = useState<DraftMode>(initialMode);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const itemsRef = useRef<T[]>(items);
  const onLoadRef = useRef(onLoadDraftFieldsFromSelected);
  const onResetRef = useRef(onResetDraftFields);

  useEffect(() => {itemsRef.current = items}, [items]);
  useEffect(() => {onLoadRef.current = onLoadDraftFieldsFromSelected}, [onLoadDraftFieldsFromSelected]);
  useEffect(() => {onResetRef.current = onResetDraftFields}, [onResetDraftFields]);

  const prevSelectedIdRef = useRef<string | null>(null);

  const selected = selectedId ? items.find((x) => x.id === selectedId) ?? null : null;

  useEffect(() => {
    if (!hasProject) return;

    if (prevSelectedIdRef.current === selectedId) return;
    prevSelectedIdRef.current = selectedId;

    if (!selectedId) {
      setMode("none");
      return;
    }

    const entity = itemsRef.current.find((x) => x.id === selectedId);
    if (!entity) return;

    setMode("edit");
    onLoadRef.current(entity);
  }, [hasProject, selectedId]);

  const reset = () => {
    setMode("none");
    setSelectedId(null);
    setIsDeleteModalOpen(false);

    onResetRef.current();
    prevSelectedIdRef.current = null;
  };

  const startNew = () => {
    reset();
    setMode("new");

    if (focusRef?.current) focusRef.current.focus();
    else setTimeout(() => focusRef?.current?.focus(), 0);
  };

  const handleListClick = (entity: T) => {
    if (entity.id === selectedId) {
      reset();
      return;
    }
    setSelectedId(entity.id);
  };

  const openDelete = () => {
    if (!selectedId) return;
    setIsDeleteModalOpen(true);
  };

  const cancelDelete = () => setIsDeleteModalOpen(false);

  return { mode, selected, isDeleteModalOpen, reset, startNew, handleListClick, openDelete, cancelDelete };
}
