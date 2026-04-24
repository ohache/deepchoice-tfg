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
  return entries.find((entry) => !entry.when) ?? null;
}

function pickVariants(entries: ConditionalTextEntry[]): ConditionalTextEntry[] {
  return entries.filter((entry) => !!entry.when);
}

type Mode = "idle" | "editingBase" | "editingVariant";

type TokenTargetKind = "base" | "variant";

type TextEditorBlockProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onOpenTokenModal: () => void;
  insertTokenDisabled: boolean;
  showLabelInput?: boolean;
  labelValue?: string;
  onLabelChange?: (next: string) => void;
  labelError?: string | null;
  contentError?: string | null;
  labelInputRef?: RefObject<HTMLInputElement | null>;
  extraTopAction?: React.ReactNode;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
};

function TextEditorBlock({ value, onChange, placeholder, textareaRef, onOpenTokenModal, insertTokenDisabled, showLabelInput = false, labelValue = "", onLabelChange,
  labelError, contentError, labelInputRef, extraTopAction, footerLeft, footerRight }: TextEditorBlockProps) {
  return (
    <div className="space-y-3 bg-slate-950/40 p-3">
      {showLabelInput ? (
        <div className="space-y-1">
          <div className="text-[13px] text-white">Nombre</div>
          <input
            ref={labelInputRef}
            value={labelValue}
            onChange={(event) => onLabelChange?.(event.currentTarget.value)}
            className={"w-full rounded-md border bg-slate-900/30 px-2 py-1.5 pl-3 text-xs text-white focus:outline-none focus:ring-2 " +
              (labelError
                ? "border-rose-500 focus:ring-rose-500/50"
                : "border-slate-600 focus:ring-fuchsia-500")}
            placeholder='Ej: "Aquella noche estrellada..."'
          />
          {labelError ? <p className="form-field-error">{labelError}</p> : null}
        </div>
      ) : null}

      <div className="space-y-1">
        {showLabelInput ? <div className="text-[13px] text-white">Texto</div> : null}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className={"editor-scroll w-full h-48 resize-none overflow-auto rounded-md bg-slate-900/30 py-1.5 pr-6 text-xs text-white " +
            "focus:outline-none focus:border-transparent focus:ring-2 " +
            (contentError
              ? "border-2 border-rose-500 focus:ring-rose-500/50"
              : "border-2 border-slate-600 focus:ring-fuchsia-500")}
          placeholder={placeholder}
        />
        {contentError ? <p className="form-field-error">{contentError}</p> : null}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onMouseDown={onOpenTokenModal}
          disabled={insertTokenDisabled}
          className="btn border-2 border-yellow-700 bg-yellow-950 text-xs text-white hover:bg-yellow-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Insertar dato
        </button>

        {extraTopAction}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div>{footerLeft}</div>
        <div className="flex items-center gap-2">{footerRight}</div>
      </div>
    </div>
  );
}

export function SceneTextField({ label = "Texto", active, onToggle, textareaRef, onPreview, onClearPreview, layerId }: SceneTextFieldProps) {
  const project = useEditorStore((state) => state.project);
  const nodeDraft = useEditorStore((state) => state.nodeDraft);

  const addLayerTextEntry = useEditorStore((state) => state.addLayerTextEntry);
  const updateLayerTextEntry = useEditorStore((state) => state.updateLayerTextEntry);
  const removeLayerTextEntry = useEditorStore((state) => state.removeLayerTextEntry);
  const reorderLayerTextEntries = useEditorStore((state) => state.reorderLayerTextEntries);
  const setActiveTextEntryId = useEditorStore((state) => state.setActiveTextEntryId);

  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const layer = useMemo(() => layers.find((currentLayer) => String(currentLayer.id) === String(layerId)) ?? null, [layers, layerId]);

  const liveProject = useMemo(() => {
    if (!project) return null;
    if (!nodeDraft) return project;

    const nodes = project.nodes ?? [];
    const index = nodes.findIndex((node) => String(node.id) === String(nodeDraft.id));

    if (index >= 0) {
      const nextNodes = [...nodes];
      nextNodes[index] = nodeDraft;

      return {
        ...project,
        nodes: nextNodes,
      };
    }

    return {
      ...project,
      nodes: [...nodes, nodeDraft],
    };
  }, [project, nodeDraft]);

  /* Fuerza que la capa actual sea la activa antes de lanzar cualquier acción de escritura sobre ella */
  const withThisLayerActive = (fn: () => void) => {
    const state = useEditorStore.getState();

    if (String(state.activeLayerId ?? "") !== String(layerId)) state.setActiveLayerId(layerId);

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
  const tokenTargetKindRef = useRef<TokenTargetKind>("base");
  const lastSelRef = useRef<{ start: number; end: number; scrollTop?: number } | null>(null);

  const resetVariantDraftErrors = () => {
    setDraftLabelError(null);
    setDraftContentError(null);
  };

  /* Resetea por completo el draft de variante */
  const resetVariantDraftToIdle = () => {
    setMode("idle");
    setEditingVariantId(null);
    setVariantDraftLabel("");
    setVariantDraftContent("");
    setVariantDraftWhen(ConditionBuilder.and());
    resetVariantDraftErrors();
  };

  /* Guarda la selección del textarea para restaurarla tras cerrar el modal de tokens */
  const snapshotSelection = (element: HTMLTextAreaElement | null, fallbackText: string) => {
    if (!element) {
      lastSelRef.current = { start: fallbackText.length, end: fallbackText.length };
      return;
    }

    lastSelRef.current = {
      start: element.selectionStart ?? fallbackText.length,
      end: element.selectionEnd ?? fallbackText.length,
      scrollTop: element.scrollTop,
    };
  };

  /* Inserta el token en el textarea activo en la posición del cursor */
  const insertTokenAtCursor = (token: string) => {
    const element = tokenTargetRef.current;
    const targetKind = tokenTargetKindRef.current;
    const currentText = targetKind === "variant" ? variantDraftContent : baseDraftContent;

    const start = element?.selectionStart ?? currentText.length;
    const end = element?.selectionEnd ?? currentText.length;
    const nextText = currentText.slice(0, start) + token + currentText.slice(end);

    if (targetKind === "variant") {
      setVariantDraftContent(nextText);
      onPreview?.({ text: nextText });
    } else {
      setBaseDraftContent(nextText);
      onPreview?.({ text: nextText });
    }

    requestAnimationFrame(() => {
      if (!element) return;

      const caret = start + token.length;
      element.focus();
      element.setSelectionRange(caret, caret);

      lastSelRef.current = { start: caret, end: caret, scrollTop: element.scrollTop };
    });
  };

  /* Cierra el modal de tokens y restaura foco/selección */
  const handleCloseTokenModal = () => {
    setOpenTokenModal(false);

    requestAnimationFrame(() => {
      const element = tokenTargetRef.current;
      if (!element) return;

      element.focus();

      const savedSelection = lastSelRef.current;
      if (!savedSelection) return;

      element.setSelectionRange(savedSelection.start, savedSelection.end);

      if (typeof savedSelection.scrollTop === "number") element.scrollTop = savedSelection.scrollTop;
    });
  };

  /* Prepara la apertura del modal de tokens para base o variante */
  const openTokenModalFor = (targetKind: TokenTargetKind, element: HTMLTextAreaElement | null, fallbackText: string) => {
    tokenTargetRef.current = element;
    tokenTargetKindRef.current = targetKind;
    snapshotSelection(element, fallbackText);
    setOpenTokenModal(true);
  };

  /* Al cambiar de capa o de entrada base, resincroniza el draft base */
  useEffect(() => {
    setBaseDraftContent(baseEntry?.content ?? "");
    setMode("idle");
    onClearPreview();
  }, [layerId, baseEntry?.id, baseEntry?.content, onClearPreview]);

  useEffect(() => {
    if (!active) return;
    if (mode !== "idle") return;

    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [active, mode, textareaRef]);

  /* Lista de elementos que se muestran en SceneVariantList */
  const listItems = useMemo(() => {
    const items: Array<{ id: ID; label?: string | null }> = [];

    if (baseEntry) items.push({ id: baseEntry.id, label: baseEntry.label ?? "Base" });

    for (const variant of variants) {
      items.push({ id: variant.id, label: variant.label });
    }

    return items;
  }, [baseEntry, variants]);

  const baseEntryId = baseEntry?.id ?? "";
  const isBaseItemId = (id: ID) => Boolean(baseEntryId && String(id) === String(baseEntryId));

const openEditBaseFromList = () => {
  if (baseEntry) {
    withThisLayerActive(() => {
      setActiveTextEntryId(baseEntry.id);
    });
  }

  setMode("editingBase");

  requestAnimationFrame(() => textareaRef.current?.focus());
};

  const saveBase = () => {
    if (!layer) return;

    withThisLayerActive(() => {
      if (baseEntry) {
        updateLayerTextEntry(baseEntry.id, { content: baseDraftContent, label: baseEntry.label ?? "Base" });
      } else {
        addLayerTextEntry({ label: "Base", when: undefined, content: baseDraftContent });
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

    const variant = entries.find((entry) => String(entry.id) === String(id)) ?? null;
    if (!variant) return;

    withThisLayerActive(() => {setActiveTextEntryId(id)});

    setMode("editingVariant");
    setEditingVariantId(id);
    setVariantDraftLabel(variant.label ?? "");
    setVariantDraftContent(variant.content ?? "");
    setVariantDraftWhen(variant.when ?? ConditionBuilder.and());
    resetVariantDraftErrors();

    onPreview?.({ text: variant.content ?? "" });

    requestAnimationFrame(() => {
      labelInputRef.current?.focus();

      const element = variantTextareaRef.current;
      if (!element) return;

      const end = element.value.length;
      element.setSelectionRange(end, end);
      element.scrollTop = element.scrollHeight;
    });
  };

  const cancelVariantEdit = () => {
    resetVariantDraftToIdle();
    onClearPreview();
    toast.info("Sin cambios", "Has cancelado la edición.");
  };

  const saveVariant = () => {
    if (!layer) return;

    const labelTrimmed = variantDraftLabel.trim();
    const contentTrimmed = variantDraftContent.trim();

    let isValid = true;
    resetVariantDraftErrors();

    if (!labelTrimmed) {
      setDraftLabelError("El label es obligatorio.");
      isValid = false;
    } else {
      const normalizedLabel = labelTrimmed.toLowerCase();

      const hasDuplicate = variants.some((variant) =>
        String(variant.id) !== String(editingVariantId) &&
        (variant.label ?? "").trim().toLowerCase() === normalizedLabel,
      );

      if (hasDuplicate) {
        setDraftLabelError("Ya existe una variante con este label en esta capa.");
        isValid = false;
      }
    }

    if (!contentTrimmed) {
      setDraftContentError("El texto no puede estar vacío.");
      isValid = false;
    }

    if (isEmptyCondition(variantDraftWhen)) {
      toast.error("Falta condición", "La variante debe tener al menos una condición.");
      isValid = false;
    }

    if (!isValid) {
      return;
    }

    withThisLayerActive(() => {
      if (editingVariantId) {
        updateLayerTextEntry(editingVariantId, { label: labelTrimmed, content: variantDraftContent, when: variantDraftWhen });

        toast.success("Variante actualizada", "Los cambios se han guardado.");
      } else {
        addLayerTextEntry({ label: labelTrimmed, when: variantDraftWhen, content: variantDraftContent });

        toast.success("Variante guardada", "La variante se ha creado.");
      }
    });

    resetVariantDraftToIdle();
    onClearPreview();
  };

  const deleteVariant = () => {
    if (!editingVariantId) return;

    withThisLayerActive(() => { removeLayerTextEntry(editingVariantId) });

    toast.success("Variante eliminada", "Se ha eliminado del proyecto.");
    resetVariantDraftToIdle();
    onClearPreview();
  };

  /* Reordena variantes manteniendo la base fija en la posición 0 */
  const handleReorderVariants = (from: number, to: number) => {
    if (!baseEntry) return;
    if (from === 0 || to === 0) return;

    const fromVariantIndex = from - 1;
    const toVariantIndex = to - 1;

    if (fromVariantIndex < 0 || toVariantIndex < 0) return;
    if (fromVariantIndex >= variants.length || toVariantIndex >= variants.length) return;

    withThisLayerActive(() => { reorderLayerTextEntries(from, to) });

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
          {/* Estado inicial: aún no existe texto base */}
          {showBasePanelInitial ? (
            <TextEditorBlock
              value={baseDraftContent}
              onChange={(next) => {
                setBaseDraftContent(next);
                onPreview?.({ text: next });
              }}
              placeholder="Escribe aquí el texto de la escena…"
              textareaRef={textareaRef}
              onOpenTokenModal={() => { openTokenModalFor("base", textareaRef.current, baseDraftContent) }}
              insertTokenDisabled={!project}
              footerRight={
                <>
                  <button type="button" onClick={cancelBase} className="btn btn-cancel text-[12px]">
                    Cancelar
                  </button>
                  <button type="button" onClick={saveBase} className="btn btn-json text-[12px]">
                    Guardar
                  </button>
                </>
              }
            />
          ) : null}

          {/* Botón extra en estado inicial */}
          {showBasePanelInitial ? (
            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                onClick={openCreateVariant}
                className="btn border-2 border-cyan-700 bg-cyan-900/60 text-[13px] text-white hover:bg-cyan-800"
              >
                + Añadir variante
              </button>
            </div>
          ) : null}

          {/* Editor explícito del texto base */}
          {showBaseEditor ? (
            <TextEditorBlock
              value={baseDraftContent}
              onChange={(next) => {
                setBaseDraftContent(next);
                onPreview?.({ text: next });
              }}
              placeholder="Escribe aquí el texto base…"
              textareaRef={textareaRef}
              onOpenTokenModal={() => { openTokenModalFor("base", textareaRef.current, baseDraftContent) }}
              insertTokenDisabled={!project}
              footerRight={
                <>
                  <button type="button" onClick={cancelBase} className="btn btn-cancel text-[12px]">
                    Cancelar
                  </button>
                  <button type="button" onClick={saveBase} className="btn btn-json text-[12px]">
                    Guardar
                  </button>
                </>
              }
            />
          ) : null}

          {/* Editor de variante */}
          {showVariantEditor ? (
            <TextEditorBlock
              value={variantDraftContent}
              onChange={(next) => {
                setVariantDraftContent(next);
                if (draftContentError) setDraftContentError(null);
                onPreview?.({ text: next });
              }}
              placeholder="Escribe aquí el texto de la variante…"
              textareaRef={variantTextareaRef}
              onOpenTokenModal={() => { openTokenModalFor("variant", variantTextareaRef.current, variantDraftContent) }}
              insertTokenDisabled={!project}
              showLabelInput
              labelValue={variantDraftLabel}
              onLabelChange={(next) => {
                setVariantDraftLabel(next);
                if (draftLabelError) setDraftLabelError(null);
              }}
              labelError={draftLabelError}
              contentError={draftContentError}
              labelInputRef={labelInputRef}
              extraTopAction={
                <button
                  type="button"
                  onClick={() => setOpenCondModal(true)}
                  className="btn border-2 border-cyan-700 bg-cyan-900/60 text-xs text-white hover:bg-cyan-800"
                >
                  Añadir condición
                </button>
              }
              footerLeft={
                editingVariantId ? (
                  <button
                    type="button"
                    onClick={() => setOpenDeleteModal(true)}
                    className="rounded-md border border-rose-700 bg-rose-950/50 px-2 py-1 text-[12px] text-white hover:bg-rose-950"
                  >
                    Eliminar
                  </button>
                ) : null
              }
              footerRight={
                <>
                  <button
                    type="button"
                    onClick={cancelVariantEdit}
                    className="btn btn-cancel text-[12px]"
                  >
                    Cancelar
                  </button>
                  <button type="button" onClick={saveVariant} className="btn btn-json text-[12px]">
                    {editingVariantId ? "Guardar cambios" : "Guardar variante"}
                  </button>
                </>
              }
            />
          ) : null}

          {/* Crear variante cuando ya existe base */}
          {mode === "idle" && baseEntry ? (
            <div className="flex items-center justify-center pt-1">
              <button
                type="button"
                onClick={openCreateVariant}
                className="btn border-2 border-cyan-700 bg-cyan-900/60 text-[13px] text-white hover:bg-cyan-800"
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
              const entry = entries.find((currentEntry) => String(currentEntry.id) === String(id)) ?? null;
              if (!entry) return;

              withThisLayerActive(() => {
                setActiveTextEntryId(id);
              });

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
        project={liveProject}
        onClose={handleCloseTokenModal}
        onInsert={insertTokenAtCursor}
      />

      {/* Modal para editar la condición de la variante */}
      <ConditionBuilderModal
        open={openCondModal}
        project={liveProject}
        value={variantDraftWhen}
        onClose={() => setOpenCondModal(false)}
        onSave={(nextCondition) => {
          setVariantDraftWhen(nextCondition);
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