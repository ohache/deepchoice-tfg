import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import type { ConditionalTextEntry, ID, SceneImageLayer } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { isEmptyCondition } from "@/shared/helpers";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { SceneVariantList } from "@/components/SceneVariantsSection";
import { ConditionBuilderModal } from "@/features/editor/scene/rules/conditions/ConditionBuilderModal";
import { BASE_LABEL, buildLiveProject, buildTextListItems, createEmptyVariantDraft, createVariantDraftFromEntry, getBaseEntry, getLayerById,
  getVariantEntries, sameId, validateVariantDraft, type VariantDraft } from "@/features/editor/scene/fields/layerHelpers";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import { InsertTextTokenModal } from "@/features/editor/modals/InsertTextTokenModal";
import { toast } from "@/shared/toast/toastStore";


type SceneTextFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  layerId: ID;
  onPreview?: (p: { text?: string | null }) => void;
  onClearPreview: () => void;
};

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
  extraTopAction?: ReactNode;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
};

function TextEditorBlock({ value, onChange, placeholder, textareaRef, onOpenTokenModal, insertTokenDisabled, showLabelInput = false, labelValue = "",
  onLabelChange, labelError, contentError, labelInputRef, extraTopAction, footerLeft, footerRight }: TextEditorBlockProps) {
  return (
    <div className="space-y-3 bg-slate-950/40 p-3">
      {showLabelInput ? (
        <div className="space-y-1">
          <div className="text-[13px] text-white">Nombre</div>

          <input
            ref={labelInputRef}
            value={labelValue}
            onChange={(event) => onLabelChange?.(event.currentTarget.value)}
            className={ "w-full rounded-md border bg-slate-900/30 px-2 py-1.5 pl-3 text-xs text-white focus:outline-none focus:ring-2 " +
              (labelError
                ? "border-rose-500 focus:ring-rose-500/50"
                : "border-slate-600 focus:ring-fuchsia-500")}
            placeholder='Ej: "Aquella noche estrellada..."'
          />

          {labelError ? <p className="form-field-error">{labelError}</p> : null}
        </div>
      ) : null}

      <div className="space-y-1">
        {showLabelInput ? (
          <div className="text-[13px] text-white">Texto</div>
        ) : null}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          className={ "editor-scroll h-48 w-full resize-none overflow-auto rounded-md bg-slate-900/30 py-1.5 pr-6 text-xs text-white focus:border-transparent focus:outline-none focus:ring-2 " +
            (contentError
              ? "border-2 border-rose-500 focus:ring-rose-500/50"
              : "border-2 border-slate-600 focus:ring-fuchsia-500")}
          placeholder={placeholder}
        />

        {contentError ? (
          <p className="form-field-error">{contentError}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            onOpenTokenModal();
          }}
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

  const variantTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  const tokenTargetRef = useRef<HTMLTextAreaElement | null>(null);
  const tokenTargetKindRef = useRef<TokenTargetKind>("base");
  const lastSelectionRef = useRef<{start: number; end: number; scrollTop?: number} | null>(null);

  const [mode, setMode] = useState<Mode>("idle");
  const [baseDraftContent, setBaseDraftContent] = useState("");
  const [variantDraft, setVariantDraft] = useState<VariantDraft>(createEmptyVariantDraft);

  const [openCondModal, setOpenCondModal] = useState(false);
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [openTokenModal, setOpenTokenModal] = useState(false);

  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const layer = useMemo(() => getLayerById(layers, layerId), [layers, layerId]);

  const liveProject = useMemo(() => buildLiveProject(project, nodeDraft), [project, nodeDraft]);

  const entries = useMemo<ConditionalTextEntry[]>(() => layer?.text ?? [], [layer?.text]);

  const baseEntry = useMemo(() => getBaseEntry(entries), [entries]);
  const variants = useMemo(() => getVariantEntries(entries), [entries]);

  const listItems = useMemo(() => buildTextListItems({ baseEntry, variants }), [baseEntry, variants]);

  const baseEntryId = baseEntry?.id ?? "";

  const showBasePanelInitial = Boolean(layer) && mode === "idle" && !baseEntry;
  const showBaseEditor = Boolean(layer) && mode === "editingBase";
  const showVariantEditor = mode === "editingVariant";
  const showList = mode === "idle" && listItems.length > 0;

  const isBaseItemId = (id: ID): boolean => sameId(id, baseEntryId);

  const withThisLayerActive = (fn: () => void) => {
    const state = useEditorStore.getState();

    if (!sameId(state.activeLayerId, layerId)) state.setActiveLayerId(layerId);

    fn();
  };

  const setPreviewText = (text: string | null) => onPreview?.({ text });

  const resetVariantEditor = () => {
    setMode("idle");
    setVariantDraft(createEmptyVariantDraft());
  };

  const updateVariantDraft = (patch: Partial<VariantDraft>) => setVariantDraft((prev) => ({ ...prev, ...patch }));

  const snapshotSelection = (element: HTMLTextAreaElement | null, fallbackText: string) => {
    if (!element) {
      lastSelectionRef.current = { start: fallbackText.length, end: fallbackText.length };
      return;
    }

    lastSelectionRef.current = { start: element.selectionStart ?? fallbackText.length, end: element.selectionEnd ?? fallbackText.length, scrollTop: element.scrollTop };
  };

  const openTokenModalFor = (targetKind: TokenTargetKind, element: HTMLTextAreaElement | null, fallbackText: string) => {
    tokenTargetRef.current = element;
    tokenTargetKindRef.current = targetKind;

    snapshotSelection(element, fallbackText);
    setOpenTokenModal(true);
  };

  const insertTokenAtCursor = (token: string) => {
    const element = tokenTargetRef.current;
    const targetKind = tokenTargetKindRef.current;

    const currentText = targetKind === "variant" ? variantDraft.content : baseDraftContent;

    const start = element?.selectionStart ?? currentText.length;
    const end = element?.selectionEnd ?? currentText.length;

    const nextText = currentText.slice(0, start) + token + currentText.slice(end);

    if (targetKind === "variant") updateVariantDraft({ content: nextText, contentError: null });
    else setBaseDraftContent(nextText);

    setPreviewText(nextText);

    requestAnimationFrame(() => {
      if (!element) return;

      const caret = start + token.length;

      element.focus();
      element.setSelectionRange(caret, caret);

      lastSelectionRef.current = { start: caret, end: caret, scrollTop: element.scrollTop };
    });
  };

  const handleCloseTokenModal = () => {
    setOpenTokenModal(false);

    requestAnimationFrame(() => {
      const element = tokenTargetRef.current;
      if (!element) return;

      element.focus();

      const savedSelection = lastSelectionRef.current;
      if (!savedSelection) return;

      element.setSelectionRange(savedSelection.start, savedSelection.end);

      if (typeof savedSelection.scrollTop === "number") element.scrollTop = savedSelection.scrollTop;
    });
  };

  useEffect(() => {
    setBaseDraftContent(baseEntry?.content ?? "");
    setMode("idle");
    setVariantDraft(createEmptyVariantDraft());
    onClearPreview();
  }, [layerId, baseEntry?.id, baseEntry?.content, onClearPreview]);

  useEffect(() => {
    if (!active) return;
    if (mode !== "idle") return;

    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [active, mode, textareaRef]);

  const openEditBaseFromList = () => {
    if (baseEntry) withThisLayerActive(() => setActiveTextEntryId(baseEntry.id));

    setMode("editingBase");

    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const saveBase = () => {
    if (!layer) return;

    withThisLayerActive(() => {
      if (baseEntry) updateLayerTextEntry(baseEntry.id, { content: baseDraftContent, label: baseEntry.label ?? BASE_LABEL });
      else addLayerTextEntry({ label: BASE_LABEL, when: undefined, content: baseDraftContent });
    });

    toast.success("Base guardada", "El texto base se ha guardado en la capa.");
    setMode("idle");
    onClearPreview();
  };

  const cancelBase = () => {
    setBaseDraftContent(baseEntry?.content ?? "");
    setMode("idle");
    onClearPreview();

    toast.info("Sin cambios", "Has cancelado la edición del texto base.");
  };

  const openCreateVariant = () => {
    setMode("editingVariant");
    setVariantDraft(createEmptyVariantDraft());
    setPreviewText("");

    requestAnimationFrame(() => labelInputRef.current?.focus());
  };

  const openEditVariant = (id: ID) => {
    if (!layer) return;

    const variant = entries.find((entry) => sameId(entry.id, id)) ?? null;
    if (!variant) return;

    withThisLayerActive(() => setActiveTextEntryId(id));

    setMode("editingVariant");
    setVariantDraft(createVariantDraftFromEntry(variant));
    setPreviewText(variant.content ?? "");

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
    resetVariantEditor();
    onClearPreview();

    toast.info("Sin cambios", "Has cancelado la edición.");
  };

  const saveVariant = () => {
    if (!layer) return;

    const validation = validateVariantDraft({ draft: variantDraft, variants });

    if (!validation.ok) {
      setVariantDraft((prev) => ({ ...prev, labelError: validation.labelError, contentError: validation.contentError }));

      if (validation.conditionError) toast.error("Falta condición", validation.conditionError);

      return;
    }

    const labelTrimmed = variantDraft.label.trim();

    withThisLayerActive(() => {
      if (variantDraft.id) {
        updateLayerTextEntry(variantDraft.id, { label: labelTrimmed, content: variantDraft.content, when: variantDraft.when });

        toast.success("Variante actualizada", "Los cambios se han guardado.");
        return;
      }

      addLayerTextEntry({ label: labelTrimmed, when: variantDraft.when, content: variantDraft.content });

      toast.success("Variante guardada", "La variante se ha creado.");
    });

    resetVariantEditor();
    onClearPreview();
  };

  const deleteVariant = () => {
    if (!variantDraft.id) return;

    withThisLayerActive(() => removeLayerTextEntry(variantDraft.id!));

    toast.success("Variante eliminada", "Se ha eliminado del proyecto.");

    resetVariantEditor();
    onClearPreview();
  };

  const handleReorderVariants = (from: number, to: number) => {
    if (!baseEntry) return;
    if (from === 0 || to === 0) return;

    const fromVariantIndex = from - 1;
    const toVariantIndex = to - 1;

    if (fromVariantIndex < 0 || toVariantIndex < 0) return;
    if (fromVariantIndex >= variants.length || toVariantIndex >= variants.length) return;

    withThisLayerActive(() => reorderLayerTextEntries(from, to));

    toast.success("Orden actualizado", "Se ha actualizado la prioridad de las variantes.");
  };

  const renderBaseEditor = (placeholder: string) => (
    <TextEditorBlock
      value={baseDraftContent}
      onChange={(next) => {
        setBaseDraftContent(next);
        setPreviewText(next);
      }}
      placeholder={placeholder}
      textareaRef={textareaRef}
      onOpenTokenModal={() => openTokenModalFor("base", textareaRef.current, baseDraftContent)}
      insertTokenDisabled={!project}
      footerRight={
        <>
          <button
            type="button"
            onClick={cancelBase}
            className="btn btn-cancel text-[12px]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={saveBase}
            className="btn btn-json text-[12px]"
          >
            Guardar
          </button>
        </>
      }
    />
  );

  return (
    <>
      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="space-y-3">
          {showBasePanelInitial ? renderBaseEditor("Escribe aquí el texto de la escena…") : null}

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

          {showBaseEditor ? renderBaseEditor("Escribe aquí el texto base…") : null}

          {showVariantEditor ? (
            <TextEditorBlock
              value={variantDraft.content}
              onChange={(next) => {
                updateVariantDraft({ content: next, contentError: null });

                setPreviewText(next);
              }}
              placeholder="Escribe aquí el texto de la variante…"
              textareaRef={variantTextareaRef}
              onOpenTokenModal={() => openTokenModalFor("variant", variantTextareaRef.current, variantDraft.content)}
              insertTokenDisabled={!project}
              showLabelInput
              labelValue={variantDraft.label}
              onLabelChange={(next) => updateVariantDraft({ label: next, labelError: null })}
              labelError={variantDraft.labelError}
              contentError={variantDraft.contentError}
              labelInputRef={labelInputRef}
              extraTopAction={
                <button
                  type="button"
                  onClick={() => setOpenCondModal(true)}
                  className="btn border-2 border-cyan-700 bg-cyan-900/60 text-xs text-white hover:bg-cyan-800"
                >
                  {isEmptyCondition(variantDraft.when) ? "Añadir condición" : "Editar condición"}
                </button>
              }
              footerLeft={
                variantDraft.id ? (
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

                  <button
                    type="button"
                    onClick={saveVariant}
                    className="btn btn-json text-[12px]"
                  >
                    {variantDraft.id ? "Guardar cambios" : "Guardar variante"}
                  </button>
                </>
              }
            />
          ) : null}

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

          <SceneVariantList
            title="Textos"
            variants={listItems}
            hidden={!showList}
            isItemDraggable={(id) => !isBaseItemId(id)}
            onSelectVariant={(id) => {
              const entry = entries.find((currentEntry) => sameId(currentEntry.id, id));

              if (!entry) return;

              withThisLayerActive(() => setActiveTextEntryId(id));

              setPreviewText(entry.content ?? "");
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

      <InsertTextTokenModal
        open={openTokenModal}
        project={liveProject}
        onClose={handleCloseTokenModal}
        onInsert={insertTokenAtCursor}
      />

      <ConditionBuilderModal
        open={openCondModal}
        project={liveProject}
        value={variantDraft.when}
        onClose={() => setOpenCondModal(false)}
        onSave={(nextCondition) => {
          updateVariantDraft({ when: nextCondition });

          setOpenCondModal(false);

          toast.success("Condición guardada", "La condición se ha aplicado a la variante.");
        }}
      />

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