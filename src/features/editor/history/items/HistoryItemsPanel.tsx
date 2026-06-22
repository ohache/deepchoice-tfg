import { useEffect, useMemo, useRef, useState } from "react";
import type { ItemDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { validateItemDraft } from "@/features/editor/history/items/itemValidator";
import { hasDuplicateFileByLinkedAssetId } from "@/validation/genericValidator";
import { getDraftPanelTitle } from "@/features/editor/history/shared/genericHelpers";
import { type AssetDraftFieldErrors } from "@/validation/validateAssetBackedDraft";
import { useImageFileDraft } from "@/features/editor/history/shared/useImageFileDraft";
import { useAssetDraftPanel } from "@/features/editor/history/shared/useAssetDraftPanel";
import { toast } from "@/shared/toast/toastStore";
import { publicPath } from "@/shared/helpers";

export function HistoryItemsPanel() {
  const project = useEditorStore((s) => s.project);
  const assetFiles = useEditorStore((s) => s.assetFiles);

  const selectedItemId = useEditorStore((s) => s.selectedItemId);
  const setSelectedItemId = useEditorStore((s) => s.setSelectedItemId);
  const addItem = useEditorStore((s) => s.addItem);
  const updateItem = useEditorStore((s) => s.updateItem);
  const removeItem = useEditorStore((s) => s.removeItem);

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AssetDraftFieldErrors>({});
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const itemsList = useMemo(() => project?.items ?? [], [project]);

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

  /* Al entrar en el panel se limpia la selección previa */
  useEffect(() => () => setSelectedItemId(null), [setSelectedItemId]);

  /* Carga el draft desde el efecto seleccionado */
  const loadDraftFromSelectedItem = (item: ItemDef) => {
    setDraftName(item.name ?? "");
    setDraftDescription(item.description ?? "");
    setFieldErrors({});
    image.resetImageDraft();

    const assetPath = (project?.assets ?? []).find((asset) => asset.kind === "items" && asset.id === item.id)?.file?.trim() ?? "";

    image.setDraftFileName(assetPath ? assetPath.split("/").pop() ?? assetPath : "");
    image.loadPreviewFromExistingFile(assetFiles?.[item.id]);
  };

  /* Limpia el formulario */
  const resetDraftFields = () => {
    setDraftName("");
    setDraftDescription("");
    setFieldErrors({});
    image.resetImageDraft();
  };

  /* Comportamiento común de selección / edición / creación */
  const panel = useAssetDraftPanel<ItemDef>({
    hasProject: !!project,
    selectedId: selectedItemId,
    focusRef: nameInputRef,
    items: itemsList,
    setSelectedId: setSelectedItemId,
    onLoadDraftFieldsFromSelected: loadDraftFromSelectedItem,
    onResetDraftFields: resetDraftFields,
  });

  /* Estado visual actual del panel */
  const mode = panel.mode;
  const rightTitle = getDraftPanelTitle(mode, {
    detail: "Detalle de objeto",
    create: "Nuevo objeto",
    edit: "Editar objeto",
  });

  /* Validación del formulario */
  const validateDraft = (): boolean => {
    if (!project) return false;

    const descTrim = draftDescription.trim();

    const { ok, errors } = validateItemDraft(
      { name: draftName, description: descTrim || undefined, file: image.draftFile ?? undefined},
      { mode: mode === "edit" ? "edit" : "new", project, currentItemId: selectedItemId ?? undefined},
    );

    setFieldErrors(errors);

    if (!ok) toast.warning("Revisa el formulario", "Hay campos con errores.");

    return ok;
  };

  /* Alta de un nuevo objeto */
  const handleCreate = () => {
    if (!image.draftFile) {
      toast.error("Falta imagen", "Selecciona una imagen antes de guardar.");
      return;
    }

    const nameTrim = draftName.trim();
    const descTrim = draftDescription.trim();
    const description = descTrim || undefined;

    const id = addItem({ name: nameTrim, description, file: image.draftFile });

    if (!id) {
      toast.error("Error inesperado", "No se pudo crear el objeto.");
      return;
    }

    toast.success("Item creado", `“${nameTrim}”`);
    panel.reset();
  };

  /* Actualización de un efecto existente */
  const handleUpdate = () => {
    if (!selectedItemId) return;

    const nameTrim = draftName.trim();
    const descTrim = draftDescription.trim();
    const description = descTrim || undefined;
    const replacingFile = !!image.draftFile;

    updateItem(selectedItemId, { name: nameTrim, description, file: image.draftFile ?? undefined });

    toast.success(replacingFile ? "Item actualizado (imagen reemplazada)" : "Item actualizado", `“${nameTrim}”`);

    panel.reset();
  };

  /* Punto único de guardado */
  const handleSave = () => {
    if (!project) return;
    if (!validateDraft()) return;

    if (mode === "new") {
      handleCreate();
      return;
    }

    if (mode === "edit") handleUpdate();
  };

  /* Solicita la eliminación del efecto seleccionado */
  const handleDeleteItem = () => {
    if (!selectedItemId) return;
    removeItem(selectedItemId);
  };

  if (!project) return null;

  const fileError = fieldErrors.file ?? image.fileError;

  return (
    <div className="max-w-[900px] mx-auto rounded-xl border-3 border-slate-700 bg-slate-900 p-4 space-y-3">
      <div className="flex gap-4 h-full">
        <aside className="w-1/3 rounded-lg border border-red-700 bg-slate-950 flex flex-col overflow-hidden">
          <button
            type="button"
            onClick={panel.startNew}
            className="px-3 py-2 text-base font-semibold bg-red-800 hover:bg-red-700 text-white rounded-t-lg"
          >
            + Añadir item
          </button>

          <div className="flex-1 overflow-y-auto text-[15px]">
            {itemsList.length === 0 ? (
              <p className="p-4 text-xs text-slate-320 text-center">
                No hay items en el proyecto
              </p>
            ) : (
              <ul>
                {itemsList.map((item, index) => {
                  const isSelected = item.id === selectedItemId;
                  const isFirst = index === 0;
                  const isLast = index === itemsList.length - 1;

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => panel.handleListClick(item)}
                        className={
                          "w-full text-left px-6 py-3 text-[15px] border-x border-red-700 " +
                          (isFirst ? "border-t " : "") +
                          (!isLast ? "border-b " : "") +
                          (isLast && !isSelected ? "rounded-b-lg " : "") +
                          (isSelected
                            ? "bg-red-900/60 text-slate-50"
                            : "hover:bg-red-900/60 text-slate-200")
                        }
                      >
                        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                          {item.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="relative flex-1 rounded-lg border border-red-700 bg-slate-950 text-sm text-slate-100 flex flex-col overflow-hidden">
          {mode !== "none" && (
            <img
              src={publicPath("ui/item-watermark.png")}
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
                Selecciona un item en la lista de la izquierda o pulsa{" "}
                <span className="font-semibold">“Añadir item”</span> para crear uno nuevo
              </p>
            ) : (
              <>
                <div className="mb-2">
                  <label className="block text-[14px] text-slate-100 mb-1 text-center">Nombre</label>
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

                <div className="mb-2">
                  <label className="block text-[14px] text-slate-100 mb-1 text-center">
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

                  {fieldErrors.description && (
                    <p className="form-field-error mt-1">{fieldErrors.description}</p>
                  )}
                </div>

                <div className="mb-2 mt-2">
                  <label className="block text-[14px] text-slate-100 mb-1 text-center">
                    Imagen
                  </label>

                  <div
                    className={"group relative mt-1.5 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px] " +
                      "transition-colors duration-150 border-2 border-dashed cursor-pointer " +
                      (image.isDragging
                        ? "border-red-400 bg-red-800"
                        : "border-red-800 bg-slate-900/40 " +
                        (image.isHoveringSelectButton ? "" : "hover:bg-red-900/60"))}
                    onDragOver={image.handleDragOver}
                    onDragLeave={image.handleDragLeave}
                    onDrop={image.handleDrop}
                    onClick={() => image.fileInputRef.current?.click()}
                  >
                    <p className="mb-2 text-slate-200 text-center">
                      Arrastra aquí una imagen
                      <span className="block text-xs text-slate-400">
                        (o haz clic para seleccionarla)
                      </span>
                      {mode === "edit" && (
                        <span className="block text-xs text-slate-400 mt-2">
                          En edición, sustituirá la imagen actual
                        </span>
                      )}
                    </p>

                    <button
                      type="button"
                      className="btn btn-select border-red-800 hover:bg-red-950"
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

                  {fileError && <p className="form-field-error mt-1">{fileError}</p>}
                </div>

                {!!image.previewUrl && (
                  <div className="mt-3 flex justify-center">
                    <img
                      src={image.previewUrl}
                      alt="Preview"
                      className="max-h-50 rounded-md border-2 border-red-700"
                      draggable="false"
                    />
                  </div>
                )}

                <div className="mt-auto flex justify-between pt-6">
                  <button
                    type="button"
                    onClick={handleDeleteItem}
                    disabled={!selectedItemId}
                    className="btn btn-danger border-rose-500 bg-rose-800 hover:bg-rose-500 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Eliminar item
                  </button>

                  <div className="flex gap-3 panel--items">
                    <button
                      type="button"
                      onClick={panel.reset}
                      className="btn btn-cancel text-[12px]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="btn btn-save"
                    >
                      Guardar item
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}