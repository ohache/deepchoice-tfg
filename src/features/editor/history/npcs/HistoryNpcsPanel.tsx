import { useEffect, useMemo, useRef, useState } from "react";
import type { NpcDef, VarDef, ItemInstance } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { InventoryEditor } from "@/features/editor/history/shared/inventory/InventoryEditor";
import { validateNpcDraft, type NpcFieldErrors } from "@/features/editor/history/npcs/npcValidator";
import { hasDuplicateFileByLinkedAssetId } from "@/validation/genericValidator";
import { getDraftPanelTitle } from "@/features/editor/history/shared/genericHelpers";
import { useAssetDraftPanel, type DraftMode } from "@/features/editor/history/shared/useAssetDraftPanel";
import { useImageFileDraft } from "@/features/editor/history/shared/useImageFileDraft";
import { VarRowCard } from "@/shared/vars/varRowCard";
import { useEntityVarsEditor } from "@/shared/vars/useEntityVarsEditor";
import { InventoryItemRulesEditor } from "@/features/editor/history/shared/inventory/InventoryItemRulesEditor";
import { useEntityInventoryEditor } from "@/features/editor/history/shared/inventory/useEntityInventoryEditor";
import { toast } from "@/shared/toast/toastStore";

export function HistoryNpcsPanel() {
  const project = useEditorStore((s) => s.project);
  const assetFiles = useEditorStore((s) => s.assetFiles);

  const selectedNpcId = useEditorStore((s) => s.selectedNpcId);
  const setSelectedNpcId = useEditorStore((s) => s.setSelectedNpcId);

  const addNpc = useEditorStore((s) => s.addNpc);
  const updateNpc = useEditorStore((s) => s.updateNpc);
  const removeNpc = useEditorStore((s) => s.removeNpc);

  const addNpcVar = useEditorStore((s) => s.addNpcVar);
  const updateNpcVar = useEditorStore((s) => s.updateNpcVar);
  const removeNpcVar = useEditorStore((s) => s.removeNpcVar);

  const addNpcInventoryItem = useEditorStore((s) => s.addNpcInventoryItem);
  const updateNpcInventoryItem = useEditorStore((s) => s.updateNpcInventoryItem);
  const removeNpcInventoryItem = useEditorStore((s) => s.removeNpcInventoryItem);

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<NpcFieldErrors>({});

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const npcList = useMemo(() => project?.npcs ?? [], [project]);

  const selectedNpc = useMemo(() => {
    if (!selectedNpcId || !project) return null;
    return npcList.find((npc) => npc.id === selectedNpcId) ?? null;
  }, [selectedNpcId, project, npcList]);

  const selectedNpcVarIds = useMemo(() => new Set((selectedNpc?.vars ?? []).map((variable) => variable.id)), [selectedNpc]);

  const selectedNpcInitialInventory = useMemo(() => selectedNpc?.initialInventory ?? [], [selectedNpc]);

  const itemOptions = useMemo(() => project?.items ?? [], [project]);

  const inferredMode: "none" | "edit" = selectedNpcId ? "edit" : "none";

  const image = useImageFileDraft({
    mode: inferredMode,
    selectedId: selectedNpcId,
    isDuplicateFile: (file, ctx) => {
      if (!project) return false;

      return hasDuplicateFileByLinkedAssetId({
        project,
        list: project.npcs ?? [],
        assetKind: "npcs",
        incomingFileName: file.name,
        ignoreId: ctx.mode === "edit" ? ctx.selectedId ?? undefined : undefined,
      });
    },
    messages: {
      duplicateFieldError: "Ya existe un PNJ que usa esta imagen.",
      duplicateToastTitle: "Archivo duplicado",
      duplicateToastBody: "Ya hay un PNJ usando ese archivo.",
    },
  });

  /* Al desmontar el panel se limpia la selección activa */
  useEffect(() => () => setSelectedNpcId(null), [setSelectedNpcId]);

  /* Carga el draft desde el PNJ seleccionado */
  const loadDraftFromSelectedNpc = (npc: NpcDef) => {
    setDraftName(npc.name ?? "");
    setDraftDescription(npc.description ?? "");
    setFieldErrors({});
    image.resetImageDraft();

    const assetPath = (project?.assets ?? []).find((asset) => asset.kind === "npcs" && asset.id === npc.id)?.file?.trim() ?? "";

    image.setDraftFileName(assetPath ? assetPath.split("/").pop() ?? assetPath : "");
    image.loadPreviewFromExistingFile(assetFiles?.[npc.id]);
  };

  /* Limpia los campos del formulario */
  const resetDraftFields = () => {
    setDraftName("");
    setDraftDescription("");
    setFieldErrors({});
    image.resetImageDraft();
  };

  /* Comportamiento común de selección / edición / creación */
  const panel = useAssetDraftPanel<NpcDef>({
    hasProject: !!project,
    selectedId: selectedNpcId,
    setSelectedId: setSelectedNpcId,
    focusRef: nameInputRef,
    items: npcList,
    onLoadDraftFieldsFromSelected: loadDraftFromSelectedNpc,
    onResetDraftFields: resetDraftFields,
  });

  const mode: DraftMode = panel.mode;
  const rightTitle = getDraftPanelTitle(mode, {
    detail: "Detalle de PNJ",
    create: "Nuevo PNJ",
    edit: "Editar PNJ",
  });

  /* Editor de variables del PNJ */
  const { draftVars, openVarId, varNameRefs, computeRowErrors, updateVarRow, switchVarType, addVarRow, toggleVarOpen, removeVarRow, saveVarRow, syncFromVars }
    = useEntityVarsEditor({
      initialVars: selectedNpc?.vars ?? [],
      onPersistRemove: (varId) => { if (mode === "edit" && selectedNpcId && selectedNpcVarIds.has(varId)) removeNpcVar(selectedNpcId, varId) },
      onPersistSave: (variable, existedBefore) => {
        if (mode !== "edit" || !selectedNpcId) return;

        if (!existedBefore) addNpcVar(selectedNpcId, variable);
        else updateNpcVar(selectedNpcId, variable);
      },
    });

  /* Editor del inventario inicial del PNJ */
  const { draftInventory, openInventoryItemId, addInventoryRow, updateInventoryRow, removeInventoryRow, toggleInventoryItemOpen, saveInventoryRow, syncFromInventory }
    = useEntityInventoryEditor({
      project,
      initialInventory: selectedNpcInitialInventory,
      itemOptions,
      onPersistRemove: (itemInstanceId) => { if (mode === "edit" && selectedNpcId) removeNpcInventoryItem(selectedNpcId, itemInstanceId) },
      onPersistSave: (item, existedBefore) => {
        if (mode !== "edit" || !selectedNpcId) return;

        if (!existedBefore) addNpcInventoryItem(selectedNpcId, item);
        else updateNpcInventoryItem(selectedNpcId, item);
      },
    });

  /* Sincroniza variables e inventario al cambiar el PNJ seleccionado */
  useEffect(() => {
    syncFromVars(selectedNpc?.vars ?? []);
    syncFromInventory(selectedNpc?.initialInventory ?? []);
  }, [selectedNpc?.id, syncFromVars, syncFromInventory]);

  /* Valida el formulario completo del PNJ */
  const validateDraft = (input: { vars: VarDef[]; initialInventory: ItemInstance[] }): boolean => {
    if (!project) {
      toast.warning("No hay proyecto", "No se puede validar el PNJ porque no hay un proyecto cargado.");
      return false;
    }

    const descriptionTrim = draftDescription.trim();

    const { ok, errors } = validateNpcDraft(
      { name: draftName, description: descriptionTrim || undefined, file: image.draftFile ?? undefined, vars: input.vars, initialInventory: input.initialInventory },
      { mode: mode === "edit" ? "edit" : "new", project, currentNpcId: selectedNpcId ?? undefined },
    );

    setFieldErrors(errors);

    if (!ok) toast.warning("Revisa el formulario", "Hay errores en alguno de los campos");

    return ok;
  };

  /* Convierte las filas draft de variables en VarDef persistibles */
  const buildValidatedVars = (): VarDef[] | null => {
    const varsOut: VarDef[] = [];

    for (const row of draftVars) {
      const result = saveVarRow(row);

      if (!result.ok) {
        toast.warning("Variables con errores", "Corrige los errores de las variables antes de guardar el PNJ.");
        return null;
      }

      varsOut.push(result.variable);
    }

    return varsOut;
  };

  /* Convierte las filas draft de inventario en ItemInstance persistibles */
  const buildValidatedInventory = (): ItemInstance[] | null => {
    const inventoryOut: ItemInstance[] = [];

    for (const item of draftInventory) {
      const result = saveInventoryRow(item);

      if (!result.ok) {
        toast.warning("Inventario con errores", "Corrige los errores del inventario antes de guardar el PNJ.");
        return null;
      }

      inventoryOut.push(result.item);
    }

    return inventoryOut;
  };

  /* Alta de un nuevo PNJ */
  const handleCreate = (varsOut: VarDef[], inventoryOut: ItemInstance[]) => {
    if (!image.draftFile) {
      toast.error("Falta imagen", "Selecciona una imagen antes de guardar.");
      return;
    }

    const nameTrim = draftName.trim();
    const descriptionTrim = draftDescription.trim();
    const description = descriptionTrim || undefined;

    const id = addNpc({ name: nameTrim, description, file: image.draftFile, vars: varsOut, initialInventory: inventoryOut });

    if (!id) {
      toast.error("Error inesperado", "No se pudo crear el PNJ.");
      return;
    }

    toast.success("PNJ creado", `“${nameTrim || "PNJ"}”`);
    panel.reset();
  };

  /* Actualización de un PNJ existente */
  const handleUpdate = () => {
    if (!selectedNpcId) return;

    const nameTrim = draftName.trim();
    const descriptionTrim = draftDescription.trim();
    const description = descriptionTrim || undefined;
    const replacingFile = !!image.draftFile;

    updateNpc(selectedNpcId, { name: nameTrim, description, file: image.draftFile ?? undefined });

    toast.success(replacingFile ? "PNJ actualizado (imagen reemplazada)" : "PNJ actualizado", `“${nameTrim || "PNJ"}”`);

    panel.reset();
  };

  /* Punto único de guardado */
  const handleSave = () => {
    if (!project) return;

    const varsOut = buildValidatedVars();
    if (!varsOut) return;

    const inventoryOut = buildValidatedInventory();
    if (!inventoryOut) return;

    if (!validateDraft({ vars: varsOut, initialInventory: inventoryOut })) return;

    if (mode === "new") handleCreate(varsOut, inventoryOut);
    else if (mode === "edit") handleUpdate();
  };

  /* Solicita la eliminación del PNJ seleccionado */
  const handleDeleteNpc = () => {
    if (!selectedNpcId) return;
    removeNpc(selectedNpcId);
  };

  if (!project) return null;

  const disableAddVar = mode === "none" || openVarId !== null;

  return (
    <div className="max-w-[900px] mx-auto rounded-xl border-3 border-slate-700 bg-slate-900 p-4 space-y-3">
      <div className="flex gap-4 h-full">
        <aside className="w-1/3 rounded-lg border border-lime-700 bg-slate-950 flex flex-col overflow-hidden">
          <button
            type="button"
            onClick={panel.startNew}
            className="px-3 py-2 text-base font-semibold bg-lime-800 hover:bg-lime-700 text-white rounded-t-lg"
          >
            + Añadir PNJ
          </button>

          <div className="flex-1 overflow-y-auto text-[15px]">
            {npcList.length === 0 ? (
              <p className="p-4 text-xs text-slate-320 text-center">No hay PNJs en el proyecto</p>
            ) : (
              <ul>
                {npcList.map((npc, index) => {
                  const isSelected = npc.id === selectedNpcId;
                  const isFirst = index === 0;
                  const isLast = index === npcList.length - 1;

                  return (
                    <li key={npc.id}>
                      <button
                        type="button"
                        onClick={() => panel.handleListClick(npc)}
                        className={
                          "w-full text-left px-6 py-3 text-[15px] border-x border-lime-700 " +
                          (isFirst ? "border-t " : "") +
                          (!isLast ? "border-b " : "") +
                          (isLast && !isSelected ? "rounded-b-lg " : "") +
                          (isSelected
                            ? "bg-lime-900/60 text-slate-50"
                            : "hover:bg-lime-900/60 text-slate-200")
                        }
                      >
                        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                          {npc.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="relative flex-1 rounded-lg border border-lime-700 bg-slate-950 text-sm text-slate-100 flex flex-col overflow-hidden">
          {mode !== "none" && (
            <img
              src="/ui/npc-watermark.png"
              alt="Logo de PNJ"
              className="px-3 pointer-events-none absolute right-0 top-11/20 -translate-y-1/2 w-[120%] opacity-[0.06]"
              draggable="false"
            />
          )}

          <div className="relative z-10 bg-lime-800 border-b border-lime-900 rounded-t-lg px-4 py-2">
            <h4 className="text-base font-semibold text-center text-white m-0">{rightTitle}</h4>
          </div>

          <div className="p-4 flex-1 flex flex-col">
            {mode === "none" ? (
              <p className="text-[11px] text-slate-200 text-center">
                Selecciona un PNJ en la lista de la izquierda o pulsa{" "}
                <span className="font-semibold">“Añadir PNJ”</span> para crear uno nuevo
              </p>
            ) : (
              <>
                <div className="mb-2">
                  <label className="block text-[14px] text-slate-200 mb-1 text-center">Nombre</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100
                      focus:outline-none focus:border-transparent focus:ring-2 focus:ring-lime-500"
                    placeholder="Ej: Guardián"
                  />
                  {fieldErrors.name && <p className="form-field-error mt-1">{fieldErrors.name}</p>}
                </div>

                <div className="mb-2">
                  <label className="block text-[14px] text-slate-200 mb-1 text-center">
                    Descripción <span className="text-slate-400">(opcional)</span>
                  </label>

                  <textarea
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100 resize-none
                      focus:outline-none focus:border-transparent focus:ring-2 focus:ring-lime-500"
                    placeholder="Ej: Un vigilante silencioso con cicatrices antiguas"
                  />
                  {fieldErrors.description && <p className="form-field-error mt-1">{fieldErrors.description}</p>}
                </div>

                <div className="mb-2 mt-2">
                  <label className="block text-[14px] text-slate-100 mb-1 text-center">Imagen</label>

                  <div
                    className={
                      "group relative mt-1.5 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px] " +
                      "transition-colors duration-150 border-2 border-dashed cursor-pointer " +
                      (image.isDragging
                        ? "border-lime-400 bg-lime-800"
                        : "border-lime-800 bg-slate-900/40 " +
                        (image.isHoveringSelectButton ? "" : "hover:bg-lime-900/60"))
                    }
                    onDragOver={image.handleDragOver}
                    onDragLeave={image.handleDragLeave}
                    onDrop={image.handleDrop}
                    onClick={() => image.fileInputRef.current?.click()}
                  >
                    <p className="mb-2 text-slate-200 text-center">
                      Arrastra aquí una imagen
                      <span className="block text-xs text-slate-400">(o haz clic para seleccionarla)</span>
                      {mode === "edit" && (
                        <span className="block text-xs text-slate-400 mt-2">
                          En edición, sustituirá la imagen actual
                        </span>
                      )}
                    </p>

                    <button
                      type="button"
                      className="btn btn-select border-lime-800 hover:bg-lime-950"
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
                </div>

                {!!image.previewUrl && (
                  <div className="mt-3 flex justify-center">
                    <img
                      src={image.previewUrl}
                      alt="Preview"
                      className="max-h-50 rounded-md border-2 border-lime-700"
                      draggable="false"
                    />
                  </div>
                )}

                <div className="mt-4 border-t border-slate-700 pt-4">
                  <h5 className="text-[14px] text-slate-100 m-0 text-center">Variables</h5>

                  <div className="mt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={addVarRow}
                      className="btn btn-add-variant text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={disableAddVar}
                      title={openVarId
                        ? "Termina la edición de la variable abierta (guarda o elimina)."
                        : "Añadir variable"
                      }
                    >
                      + Añadir variable
                    </button>
                  </div>

                  {fieldErrors.vars && <p className="form-field-error mt-2 text-center">{fieldErrors.vars}</p>}

                  <div className="space-y-2 mt-3">
                    {draftVars.map((row, idx) => {
                      const isOpen = row.id === openVarId;
                      const errors = computeRowErrors(row);

                      return (
                        <div key={row.id}>
                          <VarRowCard
                            row={row}
                            index={idx}
                            isOpen={isOpen}
                            disabled={false}
                            nameInputRef={(el) => { varNameRefs.current[row.id] = el }}
                            onToggleOpen={() => toggleVarOpen(row.id)}
                            onChange={(patch) => updateVarRow(row.id, patch)}
                            onSwitchType={(nextType) => switchVarType(row.id, nextType)}
                            onSave={() => {
                              const result = saveVarRow(row);

                              if (!result.ok) {
                                toast.warning("Revisa la variable", "Hay campos con errores.");
                                return;
                              }

                              toast.success("Variable guardada", `“${result.variable.name}”`);
                            }}
                            onDelete={() => removeVarRow(row.id)}
                            saveTitle="Guardar"
                            deleteTitle="Eliminar"
                            saveVariant="npc"
                            errors={errors}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                  <InventoryEditor
                    project={project}
                    value={draftInventory}
                    openInventoryItemId={openInventoryItemId}
                    fieldErrors={fieldErrors}
                    addInventoryRow={addInventoryRow}
                    updateInventoryRow={updateInventoryRow}
                    removeInventoryRow={removeInventoryRow}
                    toggleInventoryItemOpen={toggleInventoryItemOpen}
                    saveInventoryRow={saveInventoryRow}
                    buttonGroupClassName="panel--npcs"
                    renderRulesEditor={({ item, onChange }) => (
                      <InventoryItemRulesEditor
                        project={project}
                        owner={{ kind: "npcInventoryItem", npcId: selectedNpcId ?? "__draft_npc__" }}
                        item={item}
                        onChange={onChange}
                      />
                    )}
                  />

                <div className="mt-auto flex justify-between pt-6">
                  <button
                    type="button"
                    onClick={handleDeleteNpc}
                    disabled={!selectedNpcId}
                    className="btn btn-danger text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Eliminar PNJ
                  </button>

                  <div className="flex gap-3 panel--npcs">
                    <button
                      type="button"
                      onClick={panel.reset}
                      className="px-4 py-2 rounded-md border border-slate-500 bg-slate-800 hover:bg-slate-700 text-[12px] text-slate-100"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={handleSave}
                      className="btn btn-save"
                    >
                      Guardar PNJ
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