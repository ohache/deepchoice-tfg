import { useEffect, useRef, useState } from "react";
import type { ItemDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { validateItemDraft } from "@/features/editor/history/items/itemValidator";
import { hasDuplicateFileByLinkedAssetId } from "@/validation/genericValidator";
import { type AssetDraftFieldErrors } from "@/validation/validateAssetBackedDraft";
import { useImageFileDraft } from "@/features/editor/history/shared/useImageFileDraft";
import { useAssetDraftPanel } from "@/features/editor/history/shared/useAssetDraftPanel";
import { DeleteProjectEntityModal } from "@/features/editor/modals/DeleteProjectEntityModal";
import { toast } from "@/shared/toast/toastStore";

export function HistoryItemsPanel() {
  const project = useEditorStore((s) => s.project);
  const assetFiles = useEditorStore((s) => s.assetFiles);

  const selectedItemId = useEditorStore((s) => s.selectedItemId);
  const setSelectedItemId = useEditorStore((s) => s.setSelectedItemId);
  const addItem = useEditorStore((s) => s.addItem);
  const updateItem = useEditorStore((s) => s.updateItem);
  const removeItem = useEditorStore((s) => s.removeItem);
  const isItemReferenced = useEditorStore((s) => s.isItemReferenced);

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AssetDraftFieldErrors>({});
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const itemsList = project?.items ?? [];
  const selectedItem = selectedItemId && project ? itemsList.find((it) => it.id === selectedItemId) ?? null : null;

  const inferredMode: "none" | "edit" = selectedItemId ? "edit" : "none";

  const image = useImageFileDraft({
    mode: inferredMode,
    selectedId: selectedItemId,
    isDuplicateFile: (file, ctx) => {
      if (!project) return false;

      return hasDuplicateFileByLinkedAssetId({
        project,
        list: project.items ?? [],
        assetKind: "items",
        incomingFileName: file.name,
        ignoreId: ctx.mode === "edit" ? ctx.selectedId ?? undefined : undefined,
      });
    },
    messages: {
      duplicateFieldError: "Ya existe un ítem que usa esta imagen.",
      duplicateToastTitle: "Archivo duplicado",
      duplicateToastBody: "Ya hay un ítem usando ese archivo.",
    },
  });

  useEffect(() => () => { setSelectedItemId(null); }, [setSelectedItemId]);

  /* Hook común de panel “draft” */
  const panel = useAssetDraftPanel<ItemDef>({
    hasProject: !!project,
    selectedId: selectedItemId,
    focusRef: nameInputRef,
    items: itemsList,
    setSelectedId: setSelectedItemId,

    onLoadDraftFieldsFromSelected: (item) => {
      setDraftName(item.name ?? "");
      setDraftDescription(item.description ?? "");
      setFieldErrors({});
      image.resetImageDraft();

      const assetPath = (project?.assets ?? []).find((a) => a.kind === "items" && a.id === item.id)?.file?.trim() ?? "";

      image.setDraftFileName(assetPath ? assetPath.split("/").pop() ?? assetPath : "");

      image.loadPreviewFromExistingFile(assetFiles?.[item.id]);
    },

    onResetDraftFields: () => {
      setDraftName("");
      setDraftDescription("");
      setFieldErrors({});
      image.resetImageDraft();
    },
  });

  const mode = panel.mode;
  const modeTitle = (m: "none" | "new" | "edit") => (m === "new" ? "Nuevo item" : m === "edit" ? "Editar item" : "Detalle de item");
  const rightTitle = modeTitle(mode);

  /* Validación - Guardado */
  const validateDraft = (): boolean => {
    if (!project) return false;

    const desc = (draftDescription ?? "").trim();

    const { ok, errors } = validateItemDraft(
      {
        name: draftName,
        description: desc ? desc : undefined,
        file: image.draftFile ?? undefined,
      },
      { mode: mode === "edit" ? "edit" : "new", project, currentItemId: selectedItemId ?? undefined }
    );

    setFieldErrors(errors);

    if (!ok) toast.warning("Revisa el formulario", "Hay campos con errores.");
    return ok;
  };

  const handleSave = () => {
    if (!project) return;
    if (!validateDraft()) return;

    const nameTrim = draftName.trim();
    const descTrim = (draftDescription ?? "").trim();
    const desc = descTrim ? descTrim : undefined;

    if (mode === "new") {
      if (!image.draftFile) {
        toast.error("Falta imagen", "Selecciona una imagen antes de guardar.");
        return;
      }

      const id = addItem({ name: nameTrim, description: desc, file: image.draftFile });
      if (!id) {
        toast.error("No se pudo crear", "Revisa si el nombre o el archivo ya están en uso.");
        return;
      }

      toast.success("Item creado", `“${nameTrim}”`);
      panel.reset();
      return;
    }

    if (mode === "edit" && selectedItemId) {
      const replacingFile = !!image.draftFile;

      updateItem(selectedItemId, {
        name: nameTrim,
        description: desc,
        file: image.draftFile ?? undefined,
      });

      toast.success(replacingFile ? "Item actualizado (imagen reemplazada)" : "Item actualizado", `“${nameTrim}”`);
      panel.reset();
    }
  };

  const handleConfirmDelete = () => {
    if (!selectedItemId) {
      panel.reset();
      return;
    }

    const deletedName = selectedItem?.name ?? "Item";
    removeItem(selectedItemId);
    toast.success("Item eliminado", `“${deletedName}”`);
    panel.reset();
  };

  if (!project) return null;

  const referenced = selectedItemId ? isItemReferenced(selectedItemId) : false;
  const fileError = fieldErrors.file ?? image.fileError;

  return (
    <div className="max-w-[900px] mx-auto rounded-xl border-2 border-slate-700 bg-slate-900 p-4 space-y-3">
      <div className="flex gap-4 h-full">
        {/* Columna izquierda: lista + botón añadir */}
        <aside className="w-1/3 rounded-lg bg-slate-950 flex flex-col overflow-hidden">
          <button
            type="button"
            onClick={panel.startNew}
            className="px-3 py-2 text-base font-semibold bg-red-800 hover:bg-red-700 text-white rounded-t-lg"
          >
            + Añadir item
          </button>

          <div className="flex-1 overflow-y-auto text-[15px]">
            {itemsList.length === 0 ? (
              <p className="p-4 text-xs text-slate-320 text-center">No hay items en el proyecto</p>
            ) : (
              <ul className="divide-y-2 divide-slate-700">
                {itemsList.map((it) => {
                  const isSelected = it.id === selectedItemId;
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => panel.handleListClick(it)}
                        className={
                          "w-full text-left px-6 py-3 text-[15px] border-t border-t-black " +
                          (isSelected ? "bg-red-900/60 text-slate-50" : "hover:bg-red-900/60 text-slate-200")
                        }
                      >
                        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">{it.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Columna derecha: formulario */}
        <section className="relative flex-1 rounded-lg bg-slate-950 text-sm text-slate-100 flex flex-col overflow-hidden">
          {mode !== "none" && (
            <img
              src="/ui/item-watermark.png"
              alt="Logo de items"
              className="px-3 pointer-events-none absolute right-0 top-46/100 -translate-y-1/2 w-3/4 opacity-[0.06]"
              draggable="false"
            />
          )}

          <div className="relative z-10 bg-red-800 border-b border-red-900 rounded-t-lg px-4 py-2">
            <h4 className="text-base font-semibold text-center text-white m-0">{rightTitle}</h4>
          </div>

          <div className="p-4 flex-1 flex flex-col">
            {mode === "none" ? (
              <p className="text-[11px] text-slate-200 text-center">
                Selecciona un item en la lista de la izquierda o pulsa <span className="font-semibold">“Añadir item”</span>{" "}
                para crear uno nuevo
              </p>
            ) : (
              <>
                {/* Nombre */}
                <div className="mb-2">
                  <label className="block text-[13px] text-slate-200 mb-1 text-center">Nombre</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100
                      focus:outline-none focus:border-transparent focus:ring-2 focus:ring-red-500"
                    placeholder="Ej: Llave"
                  />
                  {fieldErrors.name && <p className="form-field-error mt-1">{fieldErrors.name}</p>}
                </div>

                {/* Descripción */}
                <div className="mb-2">
                  <label className="block text-[13px] text-slate-200 mb-1 text-center">
                    Descripción <span className="text-slate-400">(opcional)</span>
                  </label>

                    <textarea
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100 resize-none
                      focus:outline-none focus:border-transparent focus:ring-2 focus:ring-red-500"
                      placeholder="Ej: Una llave oxidada que abre la puerta del sótano"
                    />

                    {fieldErrors.description && <p className="form-field-error mt-1">{fieldErrors.description}</p>}
                  </div>

                  {/* Imagen */}
                  <div className="mb-2 mt-2">
                    <label className="block text-[13px] text-slate-200 mb-1 text-center">Imagen</label>

                    <div
                      className={
                        "group relative mt-1.5 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px] " +
                        "transition-colors duration-150 border-2 border-dashed cursor-pointer " +
                        (image.isDragging
                          ? "border-red-400 bg-red-800"
                          : "border-red-800 bg-slate-900/40 " + (image.isHoveringSelectButton ? "" : "hover:bg-red-900/60"))
                      }
                    onDragOver={image.handleDragOver}
                    onDragLeave={image.handleDragLeave}
                    onDrop={image.handleDrop}
                    onClick={() => image.fileInputRef.current?.click()}
                  >
                    <p className="mb-2 text-slate-200 text-center">
                      Arrastra aquí una imagen
                      <span className="block text-xs text-slate-400">(o haz clic para seleccionarla)</span>
                      {mode === "edit" && <span className="block text-xs text-slate-400 mt-2">En edición, sustituirá la imagen actual.</span>}
                    </p>

                    <button
                      type="button"
                      className="btn btn-select"
                      onMouseEnter={() => image.setIsHoveringSelectButton(true)}
                      onMouseLeave={() => image.setIsHoveringSelectButton(false)}
                      onClick={(e) => {
                        e.stopPropagation();
                        image.fileInputRef.current?.click();
                      }}
                    >
                      Seleccionar…
                    </button>
                  </div>

                  <input
                    ref={image.fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={image.handleFileChange}
                  />

                  <p className="mt-2 text-[11px] text-slate-400 break-all text-center">
                    {image.draftFile
                      ? `Archivo seleccionado: ${image.draftFile.name}`
                      : mode === "edit" && selectedItemId
                        ? `Archivo actual: ${image.draftFileName || "—"}`
                        : "No hay archivo seleccionado"}
                  </p>

                  {fileError && <p className="form-field-error mt-1">{fileError}</p>}
                </div>

                {/* Preview */}
                {!!image.previewUrl && (
                  <div className="mt-3 flex justify-center">
                    <img
                      src={image.previewUrl ?? undefined}
                      alt="Preview"
                      className="max-h-40 rounded-md border border-slate-700"
                      draggable="false"
                    />
                  </div>
                )}

                {image.isReady && (
                  <div className="mt-3 text-[11px] text-slate-400 flex justify-center mb-1">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
                      <span>Archivo listo</span>
                    </span>
                  </div>
                )}

                {/* Botones */}
                <div className="mt-auto flex justify-between pt-5">
                  <button
                    type="button"
                    onClick={panel.openDelete}
                    disabled={!selectedItemId}
                    className="btn btn-danger border-rose-500 bg-rose-800 hover:bg-rose-500 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Eliminar item
                  </button>

                  <div className="flex gap-3 panel--items">
                    <button type="button" onClick={panel.reset} className="btn btn-cancel text-[12px]">
                      Cancelar
                    </button>
                    <button type="button" onClick={handleSave} className="btn btn-save">
                      Guardar item
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <DeleteProjectEntityModal
        open={panel.isDeleteModalOpen}
        title="Eliminar item"
        entityName={selectedItem?.name ?? ""}
        description={
          referenced
            ? "Este item está referenciado en el proyecto. Si lo eliminas, se borrará también de las escenas, condiciones y efectos donde aparezca."
            : "El item dejará de estar disponible para las escenas que lo usen."
        }
        onConfirm={handleConfirmDelete}
        onCancel={panel.cancelDelete}
      />
    </div>
  );
}