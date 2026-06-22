import { useCallback, useEffect, useState } from "react";
import type { ID, ItemDef, ItemInstance, Project } from "@/domain/types";
import { hasDuplicatedItemInstanceLabel } from "@/validation/itemInstanceLabels";
import { generateId } from "@/utils/id";

export type InventoryItemErrors = {
  itemId?: string;
  label?: string;
};

type UseEntityInventoryEditorArgs = {
  project: Project | null;
  initialInventory: ItemInstance[];
  itemOptions: ItemDef[];
  onPersistRemove?: (itemInstanceId: ID) => void;
  onPersistSave?: (item: ItemInstance, existedBefore: boolean) => void;
};

export type SaveInventoryItemResult = { ok: true; item: ItemInstance } | { ok: false; errors: InventoryItemErrors };

export function useEntityInventoryEditor({ project, initialInventory, itemOptions, onPersistRemove, onPersistSave }: UseEntityInventoryEditorArgs) {
  const [draftInventory, setDraftInventory] = useState<ItemInstance[]>(initialInventory);
  const [openInventoryItemId, setOpenInventoryItemId] = useState<ID | null>(null);

  /* Sincroniza el draft cuando cambia la entidad seleccionada */
  const syncFromInventory = useCallback((inventory: ItemInstance[]) => {
    setDraftInventory(inventory);
    setOpenInventoryItemId(null);
  }, []);

  useEffect(() => syncFromInventory(initialInventory), [initialInventory, syncFromInventory]);

  /* Alterna la fila abierta del inventario */
  const toggleInventoryItemOpen = useCallback((itemInstanceId: ID) => {setOpenInventoryItemId((current) => current === itemInstanceId ? null : itemInstanceId)}, []);

  /* Añade una nueva fila draft al inventario */
  const addInventoryRow = useCallback((): ID | null => {
    const item = itemOptions[0];

    if (!item) return null;

    const itemInstance: ItemInstance = { itemInstanceId: generateId.itemInstance(), itemId: item.id, label: item.name };

    setDraftInventory((prev) => [...prev, itemInstance]);
    setOpenInventoryItemId(itemInstance.itemInstanceId);

    return itemInstance.itemInstanceId;
  }, [itemOptions]);

  /* Actualiza parcialmente una fila del inventario */
  const updateInventoryRow = useCallback((itemInstanceId: ID, patch: Partial<ItemInstance>) => {
    setDraftInventory((prev) => prev.map((item) => item.itemInstanceId === itemInstanceId ? { ...item, ...patch } : item));
  }, []);

  /* Elimina una fila del inventario */
  const removeInventoryRow = useCallback(
    (itemInstanceId: ID) => {
      setDraftInventory((prev) => prev.filter((item) => item.itemInstanceId !== itemInstanceId));

      setOpenInventoryItemId((current) => current === itemInstanceId ? null : current);

      onPersistRemove?.(itemInstanceId);
    }, [onPersistRemove],
  );

  /* Valida una fila del inventario */
  const validateInventoryRow = useCallback(
    (item: ItemInstance): SaveInventoryItemResult => {
      const errors: InventoryItemErrors = {};

      if (!item.itemId)  errors.itemId = "Selecciona un tipo de item.";
      else {
        const itemExists = itemOptions.some((option) => option.id === item.itemId);

        if (!itemExists) errors.itemId = "El item seleccionado no existe.";
      }

      const label = item.label.trim();

      if (!label) errors.label = "El item necesita una etiqueta.";
      else if (label.length > 60) errors.label = "La etiqueta no puede superar 60 caracteres.";

      const duplicatedInDraft = draftInventory.some((other) => other.itemInstanceId !== item.itemInstanceId && other.label.trim().toLowerCase() === label.toLowerCase());

      if (duplicatedInDraft) errors.label = "Ya hay otro item del inventario con ese nombre.";

      if (project && !errors.label && hasDuplicatedItemInstanceLabel(project, label, item.itemInstanceId)) errors.label = "Ya existe otro item instanciado con ese nombre.";

      if (Object.keys(errors).length > 0) return { ok: false, errors };

      return { ok: true, item: { ...item, label }};
    }, [draftInventory, itemOptions, project],
  );

  /* Valida, limpia y persiste una fila del inventario */
  const saveInventoryRow = useCallback(
    (item: ItemInstance): SaveInventoryItemResult => {
      const result = validateInventoryRow(item);
      if (!result.ok) return result;

      const cleanItem = result.item;

      const existedBefore = initialInventory.some((persistedItem) => persistedItem.itemInstanceId === cleanItem.itemInstanceId);

      setDraftInventory((prev) => prev.map((current) => current.itemInstanceId === cleanItem.itemInstanceId ? cleanItem : current));

      setOpenInventoryItemId(null);
      onPersistSave?.(cleanItem, existedBefore);

      return { ok: true, item: cleanItem };
    }, [initialInventory, onPersistSave, validateInventoryRow],
  );

  return { draftInventory, openInventoryItemId, setDraftInventory, setOpenInventoryItemId, syncFromInventory, addInventoryRow, updateInventoryRow,
    removeInventoryRow, toggleInventoryItemOpen, validateInventoryRow, saveInventoryRow };
}