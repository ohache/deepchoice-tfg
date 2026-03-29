import { useEffect, useMemo, useRef, useState } from "react";
import type { NpcDef, VarDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { validateNpcDraft, type NpcFieldErrors } from "@/features/editor/history/npcs/npcValidator";
import { hasDuplicateFileByLinkedAssetId } from "@/validation/genericValidator";
import { useAssetDraftPanel } from "@/features/editor/history/shared/useAssetDraftPanel";
import { useImageFileDraft } from "@/features/editor/history/shared/useImageFileDraft";
import { VarRowCard } from "@/shared/vars/varRowCard";
import { DeleteProjectEntityModal } from "@/features/editor/modals/DeleteProjectEntityModal";
import { toast } from "@/shared/toast/toastStore";
import { useEntityVarsEditor } from "@/shared/vars/useEntityVarsEditor";

export function HistoryNpcsPanel() {
  const project = useEditorStore((s) => s.project);
  const assetFiles = useEditorStore((s) => s.assetFiles);

  const selectedNpcId = useEditorStore((s) => s.selectedNpcId);
  const setSelectedNpcId = useEditorStore((s) => s.setSelectedNpcId);

  const addNpc = useEditorStore((s) => s.addNpc);
  const updateNpc = useEditorStore((s) => s.updateNpc);
  const removeNpc = useEditorStore((s) => s.removeNpc);
  const isNpcReferenced = useEditorStore((s) => s.isNpcReferenced);

  const addNpcVar = useEditorStore((s) => s.addNpcVar);
  const updateNpcVar = useEditorStore((s) => s.updateNpcVar);
  const removeNpcVar = useEditorStore((s) => s.removeNpcVar);

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");

  const [fieldErrors, setFieldErrors] = useState<NpcFieldErrors>({});
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const npcList = project?.npcs ?? [];
  const selectedNpc =
    selectedNpcId && project ? project.npcs.find((n) => n.id === selectedNpcId) ?? null : null;

  const selectedNpcVarIds = useMemo(
    () => new Set((selectedNpc?.vars ?? []).map((v) => v.id)),
    [selectedNpc]
  );

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

  useEffect(() => () => setSelectedNpcId(null), [setSelectedNpcId]);

  const panel = useAssetDraftPanel<NpcDef>({
    hasProject: !!project,
    selectedId: selectedNpcId,
    setSelectedId: setSelectedNpcId,
    focusRef: nameInputRef,
    items: npcList,

    onLoadDraftFieldsFromSelected: (npc) => {
      setDraftName(npc.name ?? "");
      setDraftDescription(npc.description ?? "");
      setFieldErrors({});
      image.resetImageDraft();

      const assetPath =
        (project?.assets ?? []).find((a) => a.kind === "npcs" && a.id === npc.id)?.file?.trim() ?? "";
      image.setDraftFileName(assetPath ? assetPath.split("/").pop() ?? assetPath : "");

      image.loadPreviewFromExistingFile(assetFiles?.[npc.id]);
    },

    onResetDraftFields: () => {
      setDraftName("");
      setDraftDescription("");
      setFieldErrors({});
      image.resetImageDraft();
    },
  });

  const mode = panel.mode;
  const rightTitle = mode === "new" ? "Nuevo PNJ" : mode === "edit" ? "Editar PNJ" : "Detalle de PNJ";

  const {
    draftVars,
    openVarId,
    varNameRefs,
    computeRowErrors,
    updateVarRow,
    switchVarType,
    addVarRow,
    toggleVarOpen,
    removeVarRow,
    saveVarRow,
    syncFromVars
  } = useEntityVarsEditor({
    initialVars: selectedNpc?.vars ?? [],
    onPersistRemove: (varId) => {
      if (mode === "edit" && selectedNpcId && selectedNpcVarIds.has(varId)) {
        removeNpcVar(selectedNpcId, varId);
      }
    },
    onPersistSave: (variable, meta) => {
      if (mode !== "edit" || !selectedNpcId) return;

      if (!meta.existedBefore) addNpcVar(selectedNpcId, variable);
      else updateNpcVar(selectedNpcId, variable);
    },
  });

  // -----------------------------
  // Draft validation + save
  // -----------------------------
  const validateDraft = (): boolean => {
    if (!project) return false;

    const desc = (draftDescription ?? "").trim();

    const { ok, errors } = validateNpcDraft(
      {
        name: draftName,
        description: desc ? desc : undefined,
        file: image.draftFile ?? undefined,
        vars: draftVars as any,
      },
      { mode: mode === "edit" ? "edit" : "new", project, currentNpcId: selectedNpcId ?? undefined }
    );

    setFieldErrors(errors);
    if (!ok) toast.warning("Revisa el formulario", "Hay campos con errores.");
    return ok;
  };

  const doSaveNpc = () => {
    if (!project) return;
    if (!validateDraft()) return;

    const varsOut: VarDef[] = [];
    for (const row of draftVars) {
      const result = saveVarRow(row);
      if (!result.ok) {
        toast.warning("Variables con errores", "Corrige los errores de las variables antes de guardar el PNJ.");
        return;
      }
      varsOut.push(result.variable);
    }

    const nameTrim = draftName.trim();
    const descTrim = (draftDescription ?? "").trim();
    const desc = descTrim ? descTrim : undefined;

    if (mode === "new") {
      if (!image.draftFile) {
        toast.error("Falta imagen", "Selecciona una imagen antes de guardar.");
        return;
      }

      const id = addNpc({
        name: nameTrim,
        description: desc,
        file: image.draftFile,
        vars: varsOut,
      });

      if (!id) {
        toast.error("No se pudo crear", "Revisa si el nombre o el archivo ya están en uso.");
        return;
      }

      toast.success("PNJ creado", `“${nameTrim || "PNJ"}”`);
      panel.reset();
      return;
    }

    if (mode === "edit" && selectedNpcId) {
      const replacingFile = !!image.draftFile;

      updateNpc(selectedNpcId, {
        name: nameTrim,
        description: desc,
        file: image.draftFile ?? undefined,
      });

      toast.success(
        replacingFile ? "PNJ actualizado (imagen reemplazada)" : "PNJ actualizado",
        `“${nameTrim || "PNJ"}”`
      );
      panel.reset();
    }
  };

  const handleSave = () => doSaveNpc();

  const handleConfirmDelete = () => {
    if (!selectedNpcId) {
      panel.reset();
      return;
    }

    const deletedName = selectedNpc?.name ?? "PNJ";
    removeNpc(selectedNpcId);
    toast.success("PNJ eliminado", `“${deletedName}”`);
    panel.reset();
  };

  const handleStartNew = () => panel.startNew();
  const handleListClick = (n: NpcDef) => panel.handleListClick(n);
  const handleCancel = () => panel.reset();

  useEffect(() => {
    syncFromVars(selectedNpc?.vars ?? []);
  }, [selectedNpc?.id, syncFromVars]);

  if (!project) return null;

  const referenced = selectedNpcId ? isNpcReferenced(selectedNpcId) : false;
  const fileError = fieldErrors.file ?? image.fileError;
  const disableAddVar = mode === "none" || openVarId !== null;

  return (
    <div className="max-w-[900px] mx-auto rounded-xl border-2 border-slate-700 bg-slate-900 p-4 space-y-3">
      <div className="flex gap-4 h-full">
        <aside className="w-1/3 rounded-lg bg-slate-950 flex flex-col overflow-hidden">
          <button
            type="button"
            onClick={handleStartNew}
            className="px-3 py-2 text-base font-semibold bg-lime-800 hover:bg-lime-700 text-white rounded-t-lg"
          >
            + Añadir PNJ
          </button>

          <div className="flex-1 overflow-y-auto text-[15px]">
            {npcList.length === 0 ? (
              <p className="p-4 text-xs text-slate-320 text-center">No hay PNJs en el proyecto</p>
            ) : (
              <ul className="divide-y-2 divide-slate-700">
                {npcList.map((n) => {
                  const isSelected = n.id === selectedNpcId;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleListClick(n)}
                        className={
                          "w-full text-left px-6 py-3 text-[15px] border-t border-t-black " +
                          (isSelected ? "bg-lime-900/60 text-slate-50" : "hover:bg-lime-900/60 text-slate-200")
                        }
                      >
                        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                          {n.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="relative flex-1 rounded-lg bg-slate-950 text-sm text-slate-100 flex flex-col overflow-hidden">
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
                  <label className="block text-[13px] text-slate-200 mb-1 text-center">Nombre</label>
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
                  <label className="block text-[13px] text-slate-200 mb-1 text-center">
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
                  <label className="block text-[13px] text-slate-200 mb-1 text-center">Imagen</label>

                  <div
                    className={
                      "group relative mt-1.5 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px] " +
                      "transition-colors duration-150 border-2 border-dashed cursor-pointer " +
                      (image.isDragging
                        ? "border-lime-400 bg-lime-800"
                        : "border-lime-800 bg-slate-900/40 " + (image.isHoveringSelectButton ? "" : "hover:bg-lime-900/60"))
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
                          En edición, sustituirá la imagen actual.
                        </span>
                      )}
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
                      : mode === "edit" && selectedNpcId
                        ? `Archivo actual: ${image.draftFileName || "—"}`
                        : "No hay archivo seleccionado"}
                  </p>

                  {fileError && <p className="form-field-error mt-1">{fileError}</p>}
                </div>

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

                <div className="mt-4 border-t border-slate-700 pt-4">
                  <h5 className="text-[13px] font-semibold text-slate-200 m-0 text-center">Variables</h5>

                  <div className="mt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={addVarRow}
                      className="btn btn-select text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={disableAddVar}
                      title={openVarId ? "Termina la edición de la variable abierta (guarda o elimina)." : "Añadir variable"}
                    >
                      + Añadir variable
                    </button>
                  </div>

                  {fieldErrors.vars && <p className="form-field-error mt-2 text-center">{fieldErrors.vars}</p>}

                  {draftVars.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center mt-3">Este PNJ no tiene variables.</p>
                  ) : (
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
                              nameInputRef={(el) => {
                                varNameRefs.current[row.id] = el;
                              }}
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
                  )}
                </div>

                <div className="mt-auto flex justify-between pt-5">
                  <button
                    type="button"
                    onClick={panel.openDelete}
                    disabled={!selectedNpcId}
                    className="btn btn-danger text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Eliminar PNJ
                  </button>

                  <div className="flex gap-3 panel--npcs">
                    <button type="button" onClick={handleCancel} className="btn btn-cancel text-[12px]">
                      Cancelar
                    </button>
                    <button type="button" onClick={handleSave} className="btn btn-save">
                      Guardar PNJ
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
        title="Eliminar PNJ"
        entityName={selectedNpc?.name ?? ""}
        description={
          referenced
            ? "Este PNJ está referenciado en el proyecto. Si lo eliminas, se borrará también de escenas, condiciones, efectos y diálogos donde aparezca."
            : "El PNJ dejará de estar disponible para las escenas que lo usen."
        }
        onConfirm={handleConfirmDelete}
        onCancel={panel.cancelDelete}
      />
    </div>
  );
}