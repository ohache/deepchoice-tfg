import { useEffect, useState, type ReactNode } from "react";
import type { ID, ItemInstance, Project } from "@/domain/types";
import type { SaveInventoryItemResult } from "@/features/editor/history/shared/inventory/useEntityInventoryEditor";
import { Select } from "@/components/Select";
import { toast } from "@/shared/toast/toastStore";

export type InventoryEditorFieldErrors = {
  initialInventory?: string;
  inventoryItemById?: Record<ID, string>;
};

type InventoryEditorProps = {
  project: Project;
  value: ItemInstance[];
  openInventoryItemId: ID | null;
  fieldErrors: InventoryEditorFieldErrors;
  savedInventoryItems?: readonly ItemInstance[];

  addInventoryRow: () => ID | null;
  updateInventoryRow: (itemInstanceId: ID, patch: Partial<ItemInstance>) => void;
  removeInventoryRow: (itemInstanceId: ID) => void;
  toggleInventoryItemOpen: (itemInstanceId: ID) => void;
  saveInventoryRow: (item: ItemInstance) => SaveInventoryItemResult;

  title?: string;
  addButtonLabel?: string;
  buttonGroupClassName?: string;

  renderRulesEditor?: (input: {
    item: ItemInstance;
    onChange: (patch: Partial<ItemInstance>) => void;
  }) => ReactNode;
};

export function InventoryEditor({ project, value, openInventoryItemId, fieldErrors, addInventoryRow, updateInventoryRow, removeInventoryRow,
  toggleInventoryItemOpen, saveInventoryRow, title = "Inventario inicial", addButtonLabel = "+ Añadir item",
  buttonGroupClassName = "panel--inventory", savedInventoryItems = [], renderRulesEditor }: InventoryEditorProps) {
  const itemOptions = project.items ?? [];

  const [savedItemById, setSavedItemById] = useState<Record<ID, ItemInstance>>({});

  useEffect(() => {
    const next: Record<ID, ItemInstance> = {};

    for (const item of savedInventoryItems) next[item.itemInstanceId] = item;

    setSavedItemById(next);
  }, [savedInventoryItems]);

  /* Añade una fila de inventario o avisa si no hay items globales */
  const handleAddInventoryRow = () => {
    const id = addInventoryRow();

    if (!id) toast.warning("No hay objetos", "Crea primero un objeto global.");
  };

  /* Guarda una fila concreta del inventario */
  const handleSaveInventoryRow = (item: ItemInstance) => {
    const result = saveInventoryRow(item);

    if (!result.ok) {
      const message = result.errors.label ?? result.errors.itemId ?? "Corrige los errores del objeto.";
      toast.warning("Objeto con errores", message);
      return;
    }

    setSavedItemById((prev) => ({
      ...prev,
      [result.item.itemInstanceId]: result.item,
    }));

    toast.success("Objeto guardado", `“${result.item.label}”`);
  };

  const handleCancelInventoryRow = (item: ItemInstance) => {
    const savedItem = savedItemById[item.itemInstanceId];

    if (savedItem) {
      updateInventoryRow(item.itemInstanceId, savedItem);
      toggleInventoryItemOpen(item.itemInstanceId);
      return;
    }

    removeInventoryRow(item.itemInstanceId);
  };

  return (
    <div className="mt-4 border-t border-slate-700 pt-4">
      <h5 className="text-[14px] text-slate-100 m-0 text-center">{title}</h5>

      <div className="mt-2 flex justify-center">
        <button
          type="button"
          onClick={handleAddInventoryRow}
          className="btn btn-add-variant bg-rose-800 border-rose-600 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed mt-1 mb-1"
          disabled={openInventoryItemId !== null}
          title={openInventoryItemId ? "Termina la edición del objeto abierto." : "Añadir objeto"}
        >
          {addButtonLabel}
        </button>
      </div>

      {fieldErrors.initialInventory ? (
        <p className="form-field-error mt-2 text-center">
          {fieldErrors.initialInventory}
        </p>
      ) : null}

      <div className="space-y-2 mt-3">
        {value.map((item) => {
          const isOpen = item.itemInstanceId === openInventoryItemId;
          const itemDef = itemOptions.find((option) => option.id === item.itemId);
          const isSavedItem = Boolean(savedItemById[item.itemInstanceId]);

          return (
            <div
              key={item.itemInstanceId}
              className={"rounded-md border-2 border-slate-700 bg-slate-950 p-2 " +
                (!isOpen ? "hover:bg-slate-900" : "")
              }
            >
              <button
                type="button"
                onClick={() => toggleInventoryItemOpen(item.itemInstanceId)}
                className="w-full text-left text-[13px] text-slate-100"
              >
                <span className="ml-1 font-semibold">
                  {item.label || "Objeto sin nombre"}
                </span>
                <span className="text-slate-300">
                  {" · "}
                  {itemDef?.name ?? "Objeto desconocido"}
                </span>
              </button>

              {isOpen ? (
                <div className="-mx-2 mt-3 border-t border-slate-600 px-2 pt-3 space-y-2">
                  <div>
                    <label className="block text-[12px] text-center text-slate-100 mt-2 mb-2">
                      Tipo de objeto
                    </label>

                    <Select<ID>
                      value={item.itemId}
                      placeholder="Selecciona objeto…"
                      options={itemOptions.map((option) => ({
                        id: option.id,
                        label: option.name,
                      }))}
                      onChange={(nextItemId) => {
                        if (!nextItemId) return;

                        updateInventoryRow(item.itemInstanceId, { itemId: nextItemId });
                      }}
                      buttonClassName="border-2 border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:ring-rose-500"
                      menuClassName="border-slate-700 bg-slate-900"
                      optionClassName="hover:bg-rose-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] text-center text-slate-100 mt-3 mb-2">
                      Nombre
                    </label>

                    <input
                      type="text"
                      value={item.label}
                      onChange={(event) => {
                        updateInventoryRow(item.itemInstanceId, { label: event.target.value });
                      }}
                      className="w-full rounded-md bg-slate-950 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100
                        focus:outline-none focus:border-transparent focus:ring-2 focus:ring-lime-500 disabled:opacity-50"
                      placeholder="Ej: Objeto oxidado"
                    />
                  </div>

                  {fieldErrors.inventoryItemById?.[item.itemInstanceId] ? (
                    <p className="form-field-error mt-1">
                      {fieldErrors.inventoryItemById[item.itemInstanceId]}
                    </p>
                  ) : null}

                  {renderRulesEditor
                    ? renderRulesEditor({ item, onChange: (patch) => updateInventoryRow(item.itemInstanceId, patch) })
                    : null}

                  <div className={`flex items-center justify-between gap-2 ${buttonGroupClassName}`}>
                    <div>
                      {isSavedItem ? (
                        <button
                          type="button"
                          onClick={() => removeInventoryRow(item.itemInstanceId)}
                          className="btn btn-danger text-[11px]"
                        >
                          Eliminar
                        </button>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCancelInventoryRow(item)}
                        className="btn btn-cancel text-[11px]"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveInventoryRow(item)}
                        className="btn btn-save text-[11px]"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}