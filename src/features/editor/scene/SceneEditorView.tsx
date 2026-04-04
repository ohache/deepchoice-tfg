import { useMemo, useEffect, useState } from "react";
import type { ID, Node } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { SceneTitleField } from "@/features/editor/scene/fields/SceneTitleField";
import { SceneTypeField } from "@/features/editor/scene/fields/SceneTypeField";
import { useSceneFieldState, useSceneNavigation } from "@/features/editor/scene/SceneCommon";
import { SceneLayersField } from "@/features/editor/scene/fields/SceneLayersField";
import { SceneDialogueField } from "@/features/editor/scene/dialogues/SceneDialogueField";
import { validateNodeDraft, type NodeFieldErrors } from "@/features/editor/scene/node/nodeValidator";
import { SceneRenderPreview } from "@/features/editor/scene/SceneRenderPreview";
import { StartConflictModal } from "@/features/editor/modals/StartConflictModal";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal"
import { toast } from "@/shared/toast/toastStore";
import { SceneMapField } from "@/features/editor/scene/maps/SceneMapField";
import { SceneMusicField } from "@/features/editor/scene/music/SceneMusicField";

function findStartConflict(args: { nodes: Node[]; wantsStart: boolean; excludeId?: ID | null }) {
  const { nodes, wantsStart, excludeId = null } = args;

  if (!wantsStart) return null;

  const existing =
    (nodes ?? []).find((n) => Boolean(n.isStart) && (!excludeId || n.id !== excludeId)) ?? null;

  if (!existing) return null;

  const title = (existing.title ?? "").trim();
  return { id: existing.id, title: title || String(existing.id) };
}

function getRegionInfo(args: { nodes: Node[]; nodeDraft: Node | null; excludeId?: ID | null; currentNodeId?: ID | null; }) {
  const { nodes, nodeDraft, excludeId = null, currentNodeId = null } = args;

  const mapId = nodeDraft?.mapLocation?.mapId ?? null;
  const regionId = nodeDraft?.mapLocation?.regionId ?? null;
  if (!mapId || !regionId) return null;

  const regionNodes = (nodes ?? []).filter((node) => {
    if (excludeId && node.id === excludeId) return false;
    return (
      node.mapLocation?.mapId === mapId &&
      node.mapLocation?.regionId === regionId
    );
  });

  const currentEntry = regionNodes.find((node) => Boolean(node.mapLocation?.isEntry)) ?? null;

  const hasAnyOtherScene = regionNodes.some((node) => node.id !== currentNodeId);

  return { mapId, regionId, currentEntry, hasAnyOtherScene };
}

export function SceneEditorView() {
  const project = useEditorStore((s) => s.project);

  const nodeMode = useEditorStore((s) => s.nodeMode);
  const editingNodeId = useEditorStore((s) => s.editingNodeId);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);

  const enterCreateNodeMode = useEditorStore((s) => s.enterCreateNodeMode);
  const cancelNodeDraft = useEditorStore((s) => s.cancelNodeDraft);
  const commitNode = useEditorStore((s) => s.commitNode);
  const deleteNode = useEditorStore((s) => s.deleteNode);

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);

  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);

  const setNodeMapLocation = useEditorStore((s) => s.setNodeMapLocation);

  const setNodeTitle = useEditorStore((s) => s.setNodeTitle);
  const setNodeIsStart = useEditorStore((s) => s.setNodeIsStart);
  const setNodeIsFinal = useEditorStore((s) => s.setNodeIsFinal);

  const hotspotEditor = useEditorStore((s) => s.hotspotEditor);
  const placedItemEditor = useEditorStore((s) => s.placedItemEditor);
  const placedNpcEditor = useEditorStore((s) => s.placedNpcEditor);
  const placedPlayerEditor = useEditorStore((s) => s.placedPlayerEditor);

  const isEditing = nodeMode === "editing" && Boolean(editingNodeId);
  const header = isEditing ? "Editar escena" : "Crear escena";

  const commitHotspotDraft = useEditorStore((s) => s.commitHotspotDraft);
  const commitPlacedItemDraft = useEditorStore((s) => s.commitPlacedItemDraft);
  const commitPlacedNpcDraft = useEditorStore((s) => s.commitPlacedNpcDraft);
  const commitPlacedPlayerDraft = useEditorStore((s) => s.commitPlacedPlayerDraft);



  const [textPreview, setTextPreview] = useState<string | null>(null);
  const clearTextPreview = () => setTextPreview(null);

  const [errors, setErrors] = useState<NodeFieldErrors>({});

  const { activeField, setActiveField, titleInputRef } = useSceneFieldState();
  const { goToHistoriaVista } = useSceneNavigation();

  const title = nodeDraft?.title ?? "";
  const isStart = Boolean(nodeDraft?.isStart);
  const isFinal = Boolean(nodeDraft?.isFinal);

  const rootIssue = useMemo(() => {
    return errors.title ?? errors.layers ?? errors.mapLocation ?? errors.musicTrackId ?? errors.meta;
  }, [errors]);

  const [isStartModalOpen, setStartModalOpen] = useState(false);
  const [existingStartTitle, setExistingStartTitle] = useState("");

  const [isMapEntryConflictModalOpen, setMapEntryConflictModalOpen] = useState(false);
  const [existingRegionEntryTitle, setExistingRegionEntryTitle] = useState("");

  const [openDeleteSceneModal, setOpenDeleteSceneModal] = useState(false);

  function commitActiveInteractiveDraftsForScene(): boolean {
    if (hotspotEditor.mode.type !== "idle") {
      const result = commitHotspotDraft();
      if (!result.ok) {
        toast.error("Hotspot incompleto", result.error ?? "Revisa el hotspot antes de continuar.");
        return false;
      }
    }

    if (placedItemEditor.mode.type !== "idle") {
      const result = commitPlacedItemDraft();
      if (!result.ok) {
        toast.error("Item incompleto", result.error ?? "Revisa el item antes de continuar.");
        return false;
      }
    }

    if (placedNpcEditor.mode.type !== "idle") {
      const result = commitPlacedNpcDraft();
      if (!result.ok) {
        toast.error("NPC incompleto", result.error ?? "Revisa el NPC antes de continuar.");
        return false;
      }
    }

    if (placedPlayerEditor.mode.type !== "idle") {
      const result = commitPlacedPlayerDraft();
      if (!result.ok) {
        toast.error("Player incompleto", result.error ?? "Revisa el player antes de continuar.");
        return false;
      }
    }

    return true;
  }

  function canLeaveSceneField(): boolean {
    if (!nodeDraft) return true;
    if (activeField === "layers") {
      if (!commitActiveInteractiveDraftsForScene()) {
        return false;
      }
    }

    return true;
  }

  function handleToggleSceneField(next: "title" | "layers" | "dialogues" | "map" | "music" | "type") {
    if (activeField === next) {
      if (!canLeaveSceneField()) return;
      setActiveField(null);
      return;
    }

    if (!canLeaveSceneField()) return;
    setActiveField(next);
  }

  useEffect(() => {
    if (!project) return;
    if (isEditing) return;
    if (nodeDraft) return;
    enterCreateNodeMode();
  }, [project, isEditing, nodeDraft, enterCreateNodeMode]);

  useEffect(() => {
    setActiveField(isEditing ? null : "title");
  }, [isEditing, setActiveField]);

  useEffect(() => {
    if (!nodeDraft) return;

    const layers = (nodeDraft.layers ?? []);
    const baseId = (layers[0]?.id ?? null);

    setActiveLayerId(baseId);

  }, [nodeDraft?.id, setActiveLayerId]);

  const navigateOut = () => goToHistoriaVista();

  const closeStartModal = () => {
    setStartModalOpen(false);
    setExistingStartTitle("");
  };

  const closeMapEntryConflictModal = () => {
    setMapEntryConflictModalOpen(false);
    setExistingRegionEntryTitle("");
  };

  const doCommitWithToastAndExit = () => {
    const res = commitNode();
    if (!res) return;

    setErrors({});
    const label = (res.title ?? "").trim() || "Escena";
    toast.success(res.mode === "creating" ? "Escena creada" : "Cambios guardados", `“${label}”`);
    cancelNodeDraft();
    navigateOut();
  };

  const doCommitSceneWithMapEntry = (forceIsEntry?: boolean) => {
    if (!nodeDraft?.mapLocation) {
      doCommitWithToastAndExit();
      return;
    }

    const nextIsEntry = typeof forceIsEntry === "boolean" ? forceIsEntry : Boolean(nodeDraft.mapLocation.isEntry);

    setNodeMapLocation({
      mapId: nodeDraft.mapLocation.mapId,
      regionId: nodeDraft.mapLocation.regionId,
      isEntry: nextIsEntry,
    });

    doCommitWithToastAndExit();
  };

  const handlePrimary = () => {
    if (!nodeDraft || !project) return;

    if (!commitActiveInteractiveDraftsForScene()) {
      return;
    }

    const res = validateNodeDraft(nodeDraft, {
      projectNodes: (project.nodes ?? []).map((n) => ({ id: n.id, title: n.title })),
      currentNodeId: isEditing ? editingNodeId : null,
    });

    setErrors(res.errors);
    if (!res.ok) {
      const first =
        res.errors.title ??
        res.errors.layers ??
        res.errors.mapLocation ??
        res.errors.musicTrackId ??
        res.errors.meta ??
        "Revisa el formulario.";

      toast.error("No se pudo guardar", first);
      return;
    }

    const excludeId: ID | null = isEditing && editingNodeId ? editingNodeId : null;

    const conflict = findStartConflict({
      nodes: project.nodes ?? [],
      wantsStart: Boolean(nodeDraft.isStart),
      excludeId,
    });

    if (conflict) {
      setExistingStartTitle(conflict.title);
      setStartModalOpen(true);
      return;
    }

    const regionInfo = getRegionInfo({
      nodes: project.nodes ?? [],
      nodeDraft,
      excludeId,
      currentNodeId: editingNodeId ?? nodeDraft.id,
    });

    if (!regionInfo) {
      doCommitWithToastAndExit();
      return;
    }

    const wantsEntry = Boolean(nodeDraft.mapLocation?.isEntry);
    const currentEntry = regionInfo.currentEntry;

    if (!regionInfo.hasAnyOtherScene) {
      doCommitSceneWithMapEntry(true);
      return;
    }

    if (wantsEntry && currentEntry && currentEntry.id !== (editingNodeId ?? nodeDraft.id)) {
      const entryTitle = (currentEntry.title ?? "").trim() || String(currentEntry.id);
      setExistingRegionEntryTitle(entryTitle);
      setMapEntryConflictModalOpen(true);
      return;
    }

    doCommitSceneWithMapEntry();
  };

  const handleSecondary = () => {
    setErrors({});
    cancelNodeDraft();
    navigateOut();
  };

  const handleDelete = () => {
    if (!editingNodeId) return;

    const res = deleteNode(editingNodeId);
    if (!res) return;

    cancelNodeDraft();
    if (selectedNodeId === editingNodeId) setSelectedNodeId(null);

    toast.success("Escena eliminada", "La escena se ha eliminado del proyecto.");
    setErrors({});
    navigateOut();
  };

  const confirmReplace = () => {
    doCommitWithToastAndExit();
    closeStartModal();
  };

  const cancelKeepExistingStart = () => {
    setNodeIsStart(false);
    doCommitWithToastAndExit();
    closeStartModal();
  };

  const confirmReplaceRegionEntry = () => {
    doCommitSceneWithMapEntry(true);
    closeMapEntryConflictModal();
  };

  const cancelKeepExistingRegionEntry = () => {
    doCommitSceneWithMapEntry(false);
    closeMapEntryConflictModal();
  };

  if (!nodeDraft) return null;

  return (
    <div className="scene-editor-layout">
      {/* Panel izquierdo: formulario */}
      <section className="scene-editor-panel-left editor-scroll">
        <h4 className="text-base font-semibold text-slate-100">{header}</h4>

        {/* Error global */}
        {rootIssue ? (
          <div className="mt-2 rounded-md border-2 border-red-500/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {rootIssue}
          </div>
        ) : null}

        <div className="space-y-2 text-sm text-slate-200 mt-2">
          {/* Título */}
          <SceneTitleField
            value={title}
            active={activeField === "title"}
            onToggle={() => handleToggleSceneField("title")}
            inputRef={titleInputRef}
            onChange={setNodeTitle}
            onEnterDone={() => setActiveField("layers")}
          />

          {/* Capas */}
          <SceneLayersField
            active={activeField === "layers"}
            onToggle={() => handleToggleSceneField("layers")}
            onTextPreview={setTextPreview}
            onClearTextPreview={clearTextPreview}
          />

          {/* Diálogos */}
          <SceneDialogueField
            active={activeField === "dialogues"}
            onToggle={() => handleToggleSceneField("dialogues")}
          />

          {/* Mapa */}
          <SceneMapField
            active={activeField === "map"}
            onToggle={() => handleToggleSceneField("map")}
          />

          {/* Música */}
          <SceneMusicField
            active={activeField === "music"}
            onToggle={() => handleToggleSceneField("music")}
          />

          {/* Flags start/final */}
          <SceneTypeField
            isStart={isStart}
            isFinal={isFinal}
            onToggleStart={() => setNodeIsStart(!isStart)}
            onToggleFinal={() => setNodeIsFinal(!isFinal)}
          />
        </div>

        {/* Barra inferior */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                onClick={() => setOpenDeleteSceneModal(true)}
                className="btn btn-danger-condition text-[12px]"
              >
                Eliminar
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSecondary}
              className="btn btn-close-condition bg-slate-800 hover:bg-slate-600 text-[12px]"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handlePrimary}
              disabled={false}
              className="btn btn-create-condition bg-emerald-800 hover:bg-emerald-600 text-white text-[12px]"
            >
              {isEditing ? "Guardar cambios" : "Crear escena"}
            </button>
          </div>
        </div>
      </section>

      {/* Panel derecho: previews */}
      <section className="scene-editor-panel-right">
        <SceneRenderPreview textPreview={textPreview} />
      </section>

      {/* Modales */}
      <StartConflictModal
        open={isStartModalOpen}
        currentStartTitle={existingStartTitle}
        editingTitle={title}
        onConfirmReplace={confirmReplace}
        onCancelKeep={cancelKeepExistingStart}
      />

      <ConfirmDangerModal
        open={openDeleteSceneModal}
        title="Eliminar escena"
        description="Vas a eliminar esta escena del proyecto. Esta acción no se puede deshacer. ¿Quieres continuar?"
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onCancel={() => setOpenDeleteSceneModal(false)}
        onConfirm={() => {
          setOpenDeleteSceneModal(false);
          handleDelete();
        }}
      />

      <ConfirmDangerModal
        open={isMapEntryConflictModalOpen}
        title="Sustituir puerta de entrada"
        description={
          existingRegionEntryTitle
            ? `La región ya tiene una escena de entrada: “${existingRegionEntryTitle}”. ¿Quieres sustituirla por la escena actual?`
            : "La región ya tiene una escena de entrada. ¿Quieres sustituirla por la escena actual?"
        }
        confirmText="Sí, sustituir"
        cancelText="No, mantener actual"
        onCancel={cancelKeepExistingRegionEntry}
        onConfirm={confirmReplaceRegionEntry}
      />
    </div>
  );
}