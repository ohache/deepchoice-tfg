import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ConditionalTextEntry, ID, SceneImageLayer } from "@/domain/types";
import { ConditionBuilder, type Condition } from "@/domain/conditions";
import { useEditorStore } from "@/store/editorStore";
import { isEmptyCondition } from "@/features/editor/core/editorGenericSlice";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { SceneVariantList } from "@/components/SceneVariantsSection";
import { ConditionBuilderModal } from "@/features/editor/scene/rules/conditions/ConditionBuilderModal";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import { InsertTextTokenModal } from "@/features/editor/modals/InsertTextTokenModal";
import { toast } from "@/shared/toast/toastStore";

interface SceneTextFieldProps {
  label?: string;
  active: boolean;
  onToggle: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onPreview?: (p: { text?: string | null }) => void;
  onClearPreview: () => void;
  layerId: ID;
}

function pickBaseEntry(entries: ConditionalTextEntry[]): ConditionalTextEntry | null {
  return entries.find((e) => !e.when) ?? null;
}

function pickVariants(entries: ConditionalTextEntry[]): ConditionalTextEntry[] {
  return entries.filter((e) => !!e.when);
}

type Mode = "idle" | "editingBase" | "editingVariant";

export function SceneTextField({ label = "Texto", active, onToggle, textareaRef, onPreview, onClearPreview, layerId }: SceneTextFieldProps) {
  const project = useEditorStore((s) => s.project);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);

  const addLayerTextEntry = useEditorStore((s) => s.addLayerTextEntry);
  const updateLayerTextEntry = useEditorStore((s) => s.updateLayerTextEntry);
  const removeLayerTextEntry = useEditorStore((s) => s.removeLayerTextEntry);
  const reorderLayerTextEntries = useEditorStore((s) => s.reorderLayerTextEntries);

  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);
  const layer = useMemo(() => layers.find((l) => String(l.id) === String(layerId)) ?? null, [layers, layerId]);

  const withThisLayerActive = (fn: () => void) => {
    const st = useEditorStore.getState();

    if (String(st.activeLayerId ?? "") !== String(layerId)) st.setActiveLayerId(layerId);

    fn();
  };

  const entries = useMemo<ConditionalTextEntry[]>(() => layer?.text ?? [], [layer?.text]);
  const baseEntry = useMemo(() => pickBaseEntry(entries), [entries]);
  const variants = useMemo(() => pickVariants(entries), [entries]);

  const [mode, setMode] = useState<Mode>("idle");
  const [baseDraftContent, setBaseDraftContent] = useState("");

  const [editingVariantId, setEditingVariantId] = useState<ID | null>(null);
  const [variantDraftLabel, setVariantDraftLabel] = useState("");
  const [variantDraftContent, setVariantDraftContent] = useState("");
  const [variantDraftWhen, setVariantDraftWhen] = useState<Condition>(ConditionBuilder.and());

  const [draftLabelError, setDraftLabelError] = useState<string | null>(null);
  const [draftContentError, setDraftContentError] = useState<string | null>(null);

  const [openCondModal, setOpenCondModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openTokenModal, setOpenTokenModal] = useState(false);

  const variantTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  const tokenTargetRef = useRef<HTMLTextAreaElement | null>(null);
  const tokenTargetKindRef = useRef<"base" | "variant">("base");
  const lastSelRef = useRef<{ start: number; end: number; scrollTop?: number } | null>(null);

  const resetVariantDraftErrors = () => {
    setDraftLabelError(null);
    setDraftContentError(null);
  };

  const snapshotSelection = (el: HTMLTextAreaElement | null, fallbackText: string) => {
    if (!el) {
      lastSelRef.current = { start: fallbackText.length, end: fallbackText.length };
      return;
    }

    lastSelRef.current = {
      start: el.selectionStart ?? fallbackText.length,
      end: el.selectionEnd ?? fallbackText.length,
      scrollTop: el.scrollTop,
    };
  };

  const insertTokenAtCursor = (token: string) => {
    const el = tokenTargetRef.current;
    const kind = tokenTargetKindRef.current;
    const currentText = kind === "variant" ? variantDraftContent : baseDraftContent;

    const start = el?.selectionStart ?? currentText.length;
    const end = el?.selectionEnd ?? currentText.length;
    const next = currentText.slice(0, start) + token + currentText.slice(end);

    if (kind === "variant") {
      setVariantDraftContent(next);
      onPreview?.({ text: next });
    } else {
      setBaseDraftContent(next);
      onPreview?.({ text: next });
    }

    requestAnimationFrame(() => {
      if (!el) return;

      el.focus();
      const caret = start + token.length;
      el.setSelectionRange(caret, caret);
      lastSelRef.current = { start: caret, end: caret, scrollTop: el.scrollTop };
    });
  };

  const handleCloseTokenModal = () => {
    setOpenTokenModal(false);

    requestAnimationFrame(() => {
      const el = tokenTargetRef.current;
      if (!el) return;

      el.focus();

      const saved = lastSelRef.current;
      if (!saved) return;

      el.setSelectionRange(saved.start, saved.end);

      if (typeof saved.scrollTop === "number") el.scrollTop = saved.scrollTop;
    });
  };

  useEffect(() => {
    setBaseDraftContent(baseEntry?.content ?? "");
    setMode("idle");
    onClearPreview();
  }, [layerId, baseEntry?.id]);

  useEffect(() => {
    if (!active) return;
    if (mode !== "idle") return;

    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [active, mode, textareaRef]);


  const listItems = useMemo(() => {
    const out: Array<{ id: ID; label?: string | null }> = [];

    if (baseEntry) out.push({ id: baseEntry.id, label: baseEntry.label ?? "Base" });

    for (const v of variants) out.push({ id: v.id, label: v.label });

    return out;
  }, [baseEntry, variants]);

  const baseEntryId = (baseEntry?.id ?? "");
  const isBaseItemId = (id: ID) => Boolean(baseEntryId && String(id) === String(baseEntryId));

  const openEditBaseFromList = () => {
    setMode("editingBase");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const saveBase = () => {
    if (!layer) return;

    withThisLayerActive(() => {
      if (baseEntry) {
        updateLayerTextEntry(baseEntry.id, {
          content: baseDraftContent,
          label: baseEntry.label ?? "Base",
        });
      } else {
        addLayerTextEntry({
          label: "Base",
          when: undefined,
          content: baseDraftContent,
        });
      }
    });

    toast.success("Base guardada", "El texto base se ha guardado en la capa.");
    setMode("idle");
    onClearPreview();
  };

  const cancelBase = () => {
    setBaseDraftContent(baseEntry?.content ?? "");
    toast.info("Sin cambios", "Has cancelado la edición del texto base.");
    setMode("idle");
    onClearPreview();
  };

  const openCreateVariant = () => {
    setMode("editingVariant");
    setEditingVariantId(null);
    setVariantDraftLabel("");
    setVariantDraftContent("");
    setVariantDraftWhen(ConditionBuilder.and());
    resetVariantDraftErrors();

    onPreview?.({ text: "" });

    requestAnimationFrame(() => labelInputRef.current?.focus());
  };

  const openEditVariant = (id: ID) => {
    if (!layer) return;

    const v = entries.find((e) => String(e.id) === String(id)) ?? null;
    if (!v) return;

    setMode("editingVariant");
    setEditingVariantId(id);
    setVariantDraftLabel(v.label ?? "");
    setVariantDraftContent(v.content ?? "");
    setVariantDraftWhen((v.when) ?? ConditionBuilder.and());
    resetVariantDraftErrors();

    onPreview?.({ text: v.content ?? "" });

    requestAnimationFrame(() => {
      labelInputRef.current?.focus();

      const el = variantTextareaRef.current;
      if (!el) return;

      const end = el.value.length;
      el.setSelectionRange(end, end);
      el.scrollTop = el.scrollHeight;
    });
  };


  const resetVariantDraftToIdle = () => {
    setMode("idle");
    setEditingVariantId(null);
    setVariantDraftLabel("");
    setVariantDraftContent("");
    setVariantDraftWhen(ConditionBuilder.and());
    resetVariantDraftErrors();
  };

  const cancelVariantEdit = () => {
    resetVariantDraftToIdle();
    onClearPreview();
    toast.info("Sin cambios", "Has cancelado la edición.");
  };

  const saveVariant = () => {
    if (!layer) return;

    const labelTrim = variantDraftLabel.trim();
    const contentTrim = variantDraftContent.trim();

    let ok = true;
    resetVariantDraftErrors();

    if (!labelTrim) {
      setDraftLabelError("El label es obligatorio.");
      ok = false;
    } else {
      const key = labelTrim.toLowerCase();

      const dup = variants.some((x) =>
          String(x.id) !== String(editingVariantId) &&
          (x.label ?? "").trim().toLowerCase() === key
      );

      if (dup) {
        setDraftLabelError("Ya existe una variante con este label en esta capa.");
        ok = false;
      }
    }

    if (!contentTrim) {
      setDraftContentError("El texto no puede estar vacío.");
      ok = false;
    }

    if(isEmptyCondition(variantDraftWhen)) {
      toast.error("Falta condición", "La variante debe tener al menos una condición");
      ok = false;
    }

    if (!ok) {
      toast.error("Errores en el formulario", "Revisa los campos marcados.");
      return;
    }

    withThisLayerActive(() => {
      if (editingVariantId) {
        updateLayerTextEntry(editingVariantId, {
          label: labelTrim,
          content: variantDraftContent,
          when: variantDraftWhen,
        });

        toast.success("Variante actualizada", "Los cambios se han guardado.");
      } else {
        addLayerTextEntry({
          label: labelTrim,
          when: variantDraftWhen,
          content: variantDraftContent,
        });

        toast.success("Variante guardada", "La variante se ha creado.");
      }
    });

    resetVariantDraftToIdle();
    onClearPreview();
  };

  const deleteVariant = () => {
    if (!editingVariantId) return;

    withThisLayerActive(() => {
      removeLayerTextEntry(editingVariantId);
    });

    toast.success("Variante eliminada", "Se ha eliminado del proyecto.");
    resetVariantDraftToIdle();
    onClearPreview();
  };

  const handleReorderVariants = (from: number, to: number) => {
    if (!baseEntry) return;
    if (from === 0 || to === 0) return;

    const fromV = from - 1;
    const toV = to - 1;

    if (fromV < 0 || toV < 0) return;
    if (fromV >= variants.length || toV >= variants.length) return;

    withThisLayerActive(() => {
      reorderLayerTextEntries(from, to);
    });

    toast.success("Orden actualizado", "Se ha actualizado la prioridad de las variantes.");
  };

  const showBasePanelInitial = Boolean(layer) && mode === "idle" && !baseEntry;
  const showBaseEditor = Boolean(layer) && mode === "editingBase";
  const showVariantEditor = mode === "editingVariant";
  const showList = mode === "idle" && listItems.length > 0;

  return (
    <>
      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="space-y-3">
          {/* Estado inicial */}
          {showBasePanelInitial ? (
            <div className="bg-slate-950/40 p-3 space-y-3">
              <div className="space-y-1">
                <textarea
                  ref={textareaRef}
                  value={baseDraftContent}
                  onChange={(e) => {
                    const next = e.currentTarget.value;
                    setBaseDraftContent(next);
                    onPreview?.({ text: next });
                  }}
                  className="editor-scroll w-full h-48 rounded-md bg-slate-900/30 border-2 border-slate-600 py-1.5 pr-6 text-xs text-white resize-none overflow-auto
                    focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
                  placeholder="Escribe aquí el texto de la escena…"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onMouseDown={() => {
                    tokenTargetRef.current = textareaRef.current;
                    tokenTargetKindRef.current = "base";
                    snapshotSelection(textareaRef.current, baseDraftContent);
                    setOpenTokenModal(true);
                  }}
                  disabled={!project}
                  className="btn border-2 border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  title={!project ? "Carga un proyecto para insertar datos" : "Insertar dato dinámico"}
                >
                  Insertar dato
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={cancelBase} className="btn btn-cancel text-[11px]">
                  Cancelar
                </button>
                <button type="button" onClick={saveBase} className="btn btn-json text-[11px]">
                  Guardar
                </button>
              </div>

              <div className="pt-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={openCreateVariant}
                  className="btn border-2 border-cyan-700 bg-cyan-900/60 hover:bg-cyan-800 text-xs text-white"
                >
                  + Añadir variante
                </button>
              </div>
            </div>
          ) : null}

          {/* Editor del texto base */}
          {showBaseEditor ? (
            <div className="bg-slate-950/40 p-3 space-y-3">
              <div className="space-y-1">
                <textarea
                  ref={textareaRef}
                  value={baseDraftContent}
                  onChange={(e) => {
                    const next = e.currentTarget.value;
                    setBaseDraftContent(next);
                    onPreview?.({ text: next });
                  }}
                  className="editor-scroll w-full h-48 rounded-md bg-slate-900/30 border-2 border-slate-600 py-1.5 pr-6 text-xs text-white resize-none overflow-auto
                    focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
                  placeholder="Escribe aquí el texto base…"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onMouseDown={() => {
                    tokenTargetRef.current = textareaRef.current;
                    tokenTargetKindRef.current = "base";
                    snapshotSelection(textareaRef.current, baseDraftContent);
                    setOpenTokenModal(true);
                  }}
                  disabled={!project}
                  className="btn border-2 border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Insertar dato
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={cancelBase} className="btn btn-cancel text-[11px]">
                  Cancelar
                </button>
                <button type="button" onClick={saveBase} className="btn btn-json text-[11px]">
                  Guardar
                </button>
              </div>
            </div>
          ) : null}

          {/* Editor de variante */}
          {showVariantEditor ? (
            <div className="bg-slate-950/40 p-3 space-y-3">
              <div className="space-y-1">
                <div className="text-[12px] text-white">Etiqueta</div>
                <input
                  ref={labelInputRef}
                  value={variantDraftLabel}
                  onChange={(e) => {
                    setVariantDraftLabel(e.currentTarget.value);
                    if (draftLabelError) setDraftLabelError(null);
                  }}
                  className={"w-full rounded-md bg-slate-900/30 border px-2 py-1.5 pl-3 text-xs text-white focus:outline-none focus:ring-2 " +
                    (draftLabelError
                      ? "border-rose-500 focus:ring-rose-500/50"
                      : "border-slate-700 focus:ring-fuchsia-500")}
                  placeholder='Ej: "Aquella noche estrellalda..."'
                />
                {draftLabelError ? <p className="form-field-error">{draftLabelError}</p> : null}
              </div>

              <div className="space-y-1">
                <div className="text-[12px] text-white">Texto</div>
                <textarea
                  ref={variantTextareaRef}
                  value={variantDraftContent}
                  onChange={(e) => {
                    const next = e.currentTarget.value;
                    setVariantDraftContent(next);
                    if (draftContentError) setDraftContentError(null);
                    onPreview?.({ text: next });
                  }}
                  className={"editor-scroll w-full h-48 rounded-md bg-slate-900/30 border-2 py-1.5 pr-6 text-xs text-white resize-none overflow-auto " +
                    "focus:outline-none focus:border-transparent focus:ring-2 " +
                    (draftContentError
                      ? "border-rose-500 focus:ring-rose-500/50"
                      : "border-slate-600 focus:ring-fuchsia-500")}
                  placeholder="Escribe aquí el texto de la variante…"
                />
                {draftContentError ? <p className="form-field-error">{draftContentError}</p> : null}
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onMouseDown={() => {
                    tokenTargetRef.current = variantTextareaRef.current;
                    tokenTargetKindRef.current = "variant";
                    snapshotSelection(variantTextareaRef.current, variantDraftContent);
                    setOpenTokenModal(true);
                  }}
                  disabled={!project}
                  className="btn border-2 border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Insertar dato
                </button>

                <button
                  type="button"
                  onClick={() => setOpenCondModal(true)}
                  className="btn border-2 border-cyan-700 bg-cyan-900/60 hover:bg-cyan-800 text-xs text-white"
                >
                  Añadir condición
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div>
                  {editingVariantId ? (
                    <button
                      type="button"
                      onClick={() => setOpenDeleteModal(true)}
                      className="px-2 py-1 rounded-md border border-rose-700 bg-rose-950/20 text-rose-200 hover:bg-rose-900/30 text-[11px]"
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={cancelVariantEdit}
                    className="btn btn-cancel text-[11px]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveVariant}
                    className="btn btn-json text-[11px]"
                  >
                    {editingVariantId ? "Guardar cambios" : "Guardar variante"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Crear variante cuando ya existe base */}
          {mode === "idle" && baseEntry ? (
            <div className="pt-1 flex items-center justify-center">
              <button
                type="button"
                onClick={openCreateVariant}
                className="btn border-2 border-cyan-700 bg-cyan-900/60 hover:bg-cyan-800 text-xs text-white"
              >
                + Añadir variante
              </button>
            </div>
          ) : null}

          {/* Lista de textos guardados */}
          <SceneVariantList
            title="Textos"
            variants={listItems}
            hidden={!showList}
            isItemDraggable={(id) => !isBaseItemId(id)}
            onSelectVariant={(id) => {
              const entry = entries.find((e) => String(e.id) === String(id)) ?? null;
              if (!entry) return;
              onPreview?.({ text: entry.content ?? "" });
            }}
            onEditVariant={(id) => {
              if (isBaseItemId(id)) {
                openEditBaseFromList();
                return;
              }
              openEditVariant(id);
            }}
            onReorder={handleReorderVariants}
            cardWidthClassName="w-[360px] max-w-[92%]"
          />
        </div>
      </ToggleFieldBlock>

      {/* Modal para insertar tokens dinámicos */}
      <InsertTextTokenModal
        open={openTokenModal}
        project={project}
        onClose={handleCloseTokenModal}
        onInsert={insertTokenAtCursor}
      />

      {/* Modal para editar la condición de la variante */}
      <ConditionBuilderModal
        open={openCondModal}
        project={project}
        value={variantDraftWhen}
        onClose={() => setOpenCondModal(false)}
        onSave={(next) => {
          setVariantDraftWhen(next);
          setOpenCondModal(false);
          toast.success("Condición guardada", "La condición se ha aplicado a la variante.");
        }}
      />

      {/* Confirmación de borrado */}
      <ConfirmDangerModal
        open={openDeleteModal}
        title="Eliminar variante de texto"
        description="Esta acción no se puede deshacer. ¿Quieres eliminar la variante?"
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onCancel={() => setOpenDeleteModal(false)}
        onConfirm={() => {
          setOpenDeleteModal(false);
          deleteVariant();
        }}
      />
    </>
  );
}