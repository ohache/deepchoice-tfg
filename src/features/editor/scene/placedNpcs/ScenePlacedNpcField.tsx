import { useEffect, useMemo, useRef, useState } from "react";
import type { ID, SceneImageLayer, Hotspot, PlacedItem, PlacedNpc, PlacedPlayer, NpcDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import type { Effect } from "@/domain/effects";
import { toast } from "@/shared/toast/toastStore";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectFactory";
import { PlacedNpcListPanel, type PlacedNpcListEntry } from "@/features/editor/scene/placedNpcs/PlacedNpcListPanel";
import { PlacedNpcEditorPanel } from "@/features/editor/scene/placedNpcs/PlacedNpcEditorPanel";
import { useEntityRulesEditor } from "@/features/editor/scene/rules/entityRulesEditor";
import type { Condition } from "@/domain/conditions";
import { useEntityCollisionGuard } from "@/features/editor/scene/useEntityCollisionGuard";
import { buildClickableRegions, useActiveSceneLayer } from "@/features/editor/scene/interactiveComponents/fieldHelpers";

type PlacedNpcEditorError =
  | { kind: "panel"; message: string }
  | { kind: "rules" }
  | null;

type ScenePlacedNpcFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
  layerId: ID;
};

export function ScenePlacedNpcField({ label = "NPCs", active, onToggle, layerId }: ScenePlacedNpcFieldProps) {
  const project = useEditorStore((s) => s.project ?? null);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);

  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);

  const placedNpcEditor = useEditorStore((s) => s.placedNpcEditor);

  const startRedrawPlacedNpcShape = useEditorStore((s) => s.startRedrawPlacedNpcShape);
  const startPlacingPlacedNpc = useEditorStore((s) => s.startPlacingPlacedNpc);
  const editPlacedNpc = useEditorStore((s) => s.editPlacedNpc);
  const cancelPlacedNpcDraft = useEditorStore((s) => s.cancelPlacedNpcDraft);

  const setPlacedNpcDraftNpcId = useEditorStore((s) => s.setPlacedNpcDraftNpcId);
  const setPlacedNpcDraftInitialState = useEditorStore((s) => s.setPlacedNpcDraftInitialState);
  const setPlacedNpcDraftRules = useEditorStore((s) => s.setPlacedNpcDraftRules);
  const setPlacedNpcDraftShape = useEditorStore((s) => s.setPlacedNpcDraftShape);
  const validatePlacedNpcDraft = useEditorStore((s) => s.validatePlacedNpcDraft);

  const upsertPlacedNpc = useEditorStore((s) => s.upsertPlacedNpc);
  const removePlacedNpc = useEditorStore((s) => s.removePlacedNpc);
  const setActivePlacedNpcs = useEditorStore((s) => s.setActivePlacedNpcs);

  const selectedInteractionKind = useEditorStore((s) => s.selectedInteractionKind);
  const selectedInteractionId = useEditorStore((s) => s.selectedInteractionId);
  const setSelectedInteractionKind = useEditorStore((s) => s.setSelectedInteractionKind);
  const setSelectedInteractionId = useEditorStore((s) => s.setSelectedInteractionId);
  const clearInteractionSelection = useEditorStore((s) => s.clearInteractionSelection);

  const projectNpcs = useMemo<NpcDef[]>(() => project?.npcs ?? [], [project?.npcs]);

  const [selectedCatalogNpcId, setSelectedCatalogNpcId] = useState<string>("");
  const [isCreatingPlacedNpc, setIsCreatingPlacedNpc] = useState(false);

  useEffect(() => {
    if (!projectNpcs.length) {
      setSelectedCatalogNpcId("");
      return;
    }

    if (selectedCatalogNpcId === "") return;

    const exists = projectNpcs.some((npc) => npc.id === selectedCatalogNpcId);
    if (!exists) setSelectedCatalogNpcId("");
  }, [projectNpcs, selectedCatalogNpcId]);

  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const { layer } = useActiveSceneLayer({ active, layerId, activeLayerId, setActiveLayerId, layers });

  const nodeId = nodeDraft?.id ?? "";

  const hotspots = useMemo<Hotspot[]>(() => layer?.hotspots ?? [], [layer?.hotspots]);
  const placedItems = useMemo<PlacedItem[]>(() => layer?.placedItems ?? [], [layer?.placedItems]);
  const placedNpcs = useMemo<PlacedNpc[]>(() => layer?.placedNpcs ?? [], [layer?.placedNpcs]);
  const placedPlayers = useMemo<PlacedPlayer[]>(() => layer?.placedPlayers ?? [], [layer?.placedPlayers]);

  const selectedId = selectedInteractionKind === "placedNpc" ? selectedInteractionId : null;

  const draft = placedNpcEditor.draft;
  const isDrawing = placedNpcEditor.mode.type === "drawing";
  const isEditing = placedNpcEditor.mode.type !== "idle";

  const collisionResetKey = `${layerId}:${draft?.npcId ?? "none"}:${placedNpcEditor.mode.type}`;

  const useItemSourceOptions = useMemo(() => placedItems.map((p) => ({ id: p.id, label: p.label?.trim() || p.id })), [placedItems] );

  const owner = useMemo<EffectOwner | null>(() => {
    if (!draft || !draft.shape) return null;

    return {
      kind: "placedNpc",
      layerId,
      npcId: draft.npcId,
      npc: {
        npcId: draft.npcId,
        shape: draft.shape,
        initialState: draft.initialState,
        rules: draft.rules,
      },
    };
  }, [draft, layerId]);

  const isExistingPlacedNpc = useMemo(() => {
    if (!draft?.npcId) return false;
    return placedNpcs.some((p) => p.npcId === draft.npcId);
  }, [draft?.npcId, placedNpcs]);

  const clickableRegions = useMemo(
    () =>
      buildClickableRegions({
        project,
        hotspots,
        placedItems,
        placedNpcs,
        placedPlayers,
      }),
    [project, hotspots, placedItems, placedNpcs, placedPlayers],
  );

  const { hasShape, hasCollisions, collisionSummary, collisionLock, resetCollisionGuard } = useEntityCollisionGuard({
    shape: draft?.shape,
    clickableRegions,
    ignore: draft?.npcId ? { kind: "npc", id: draft.npcId } : undefined,
    enabled: true,
    isDrawing,
    minRect: 0.02,
    resetKey: collisionResetKey,
    onRejectShape: () => {
      setPlacedNpcDraftShape(null);
      startRedrawPlacedNpcShape();
    },
    onCollision: (summary) => {
      setEditorError({
        kind: "panel",
        message: `Colisión con: ${summary}. Dibuja otra región o pulsa “Cancelar”.`,
      });
    },
  });

  const [confirmNukeOpen, setConfirmNukeOpen] = useState(false);
  const [editorError, setEditorError] = useState<PlacedNpcEditorError>(null);

  const initialVisible = draft?.initialState.visible ?? true;
  const initialReachable = draft?.initialState.reachable ?? true;
  const initialNotReachableText = draft?.initialState.notReachableText ?? "";

  const disableAllEditorFields = Boolean(draft) && !hasShape;
  const disableReachable = disableAllEditorFields || !initialVisible;
  const disableNotReachableText = disableAllEditorFields || !initialVisible || initialReachable;

  const hasAnyRules =
    Boolean((draft?.rules?.onClick?.length ?? 0) > 0) ||
    Boolean((draft?.rules?.onUseItem?.length ?? 0) > 0);

  const notReachableInputRef = useRef<HTMLInputElement | null>(null);

  const { activeChannel, setActiveChannel, clickRules, useItemRulesForSelected, ruleModalOpen, currentRuleValue, openAddClickRule,
    openEditClickRule, openAddUseItemRule, openEditUseItemRule, removeClickRule, removeUseItemRule, closeRuleModal, saveRule }
    = useEntityRulesEditor({ rules: draft?.rules, onChangeRules: setPlacedNpcDraftRules });

  const placedNpcListEntries = useMemo<PlacedNpcListEntry[]>( () =>
      placedNpcs.map((p) => {
        const npcDef = projectNpcs.find((def) => def.id === p.npcId) ?? null;
        return { id: p.npcId, label: npcDef?.name?.trim() || p.npcId };
      }), [placedNpcs, projectNpcs],
  );

  const beginPlacedNpcPlacement = (npcId: string) => {
    if (!npcId) {
      toast.warning("Selecciona un NPC", "Debes seleccionar un NPC del catálogo.");
      return;
    }

    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();

    startPlacingPlacedNpc({ npcId });

    toast.info("Dibuja una región", "Arrastra sobre la imagen de la derecha para definir el NPC.");
  };

  const handleStartAddingPlacedNpc = () => {
    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();
    setSelectedCatalogNpcId("");
    setIsCreatingPlacedNpc(true);
  };

  const handleSelectedCatalogNpcIdChange = (npcId: string) => {
    setSelectedCatalogNpcId(npcId);

    if (!npcId) return;
    if (!isCreatingPlacedNpc) return;
    if (isEditing) return;

    beginPlacedNpcPlacement(npcId);
  };

  const handleCommit = () => {
    if (!draft) return;

    setEditorError(null);

    if (!hasAnyRules) {
      setEditorError({ kind: "rules" });
      return;
    }

    if (hasCollisions) {
      setEditorError({
        kind: "panel",
        message: `Colisión con: ${collisionSummary}. Ajusta la región para que no se solape.`,
      });
      return;
    }

    const validation = validatePlacedNpcDraft();
    if (!validation.ok) {
      toast.error("No se ha podido guardar", validation.error ?? "Revisa el NPC.");
      return;
    }

    if (!draft.shape) {
      toast.error("No se ha podido guardar", "Debes dibujar un área válida antes de guardar el NPC.");
      return;
    }

    const candidate: PlacedNpc = {
      npcId: draft.npcId,
      shape: draft.shape,
      initialState: draft.initialState,
      rules: draft.rules ?? {},
    };

    upsertPlacedNpc(candidate);

    setSelectedInteractionKind("placedNpc");
    setSelectedInteractionId(candidate.npcId);
    cancelPlacedNpcDraft();
    setEditorError(null);
    setIsCreatingPlacedNpc(false);
    setSelectedCatalogNpcId("");

    toast.success("NPC guardado", "El NPC ya forma parte de la escena.");
  };

  const handleDelete = (npcId: ID) => {
    removePlacedNpc(npcId);

    const isSelectedPlacedNpc =
      selectedInteractionKind === "placedNpc" && selectedInteractionId === npcId;
    if (isSelectedPlacedNpc) clearInteractionSelection();

    const isEditingThisDraft = draft?.npcId === npcId;
    if (isEditingThisDraft) {
      resetCollisionGuard();
      cancelPlacedNpcDraft();
    }

    toast.success("NPC eliminado", "Se ha eliminado correctamente.");
  };

  const handleAskNukeAll = () => {
    if (!placedNpcs.length) return;
    setConfirmNukeOpen(true);
  };

  const handleConfirmNukeAll = () => {
    setConfirmNukeOpen(false);
    setActivePlacedNpcs([]);
    clearInteractionSelection();

    if (draft) {
      resetCollisionGuard();
      cancelPlacedNpcDraft();
    }

    setIsCreatingPlacedNpc(false);
    setSelectedCatalogNpcId("");

    toast.success("NPCs borrados", "Se han eliminado todos los NPCs de esta capa.");
  };

  const handleEditPlacedNpc = (npcId: ID) => {
    setEditorError(null);
    setIsCreatingPlacedNpc(false);
    setSelectedCatalogNpcId("");
    setSelectedInteractionKind("placedNpc");
    setSelectedInteractionId(npcId);
    editPlacedNpc(npcId);
  };

  const handleDeleteDraft = () => {
    if (!draft) return;
    handleDelete(draft.npcId);
    setIsCreatingPlacedNpc(false);
    setSelectedCatalogNpcId("");
  };

  const handleCancelDraft = () => {
    setEditorError(null);
    resetCollisionGuard();
    cancelPlacedNpcDraft();
    clearInteractionSelection();
    setIsCreatingPlacedNpc(false);
    setSelectedCatalogNpcId("");
    toast.info("Cancelado", "Has salido del editor de NPC.");
  };

  const handleStartRedrawShape = () => {
    setEditorError(null);
    resetCollisionGuard();
    startRedrawPlacedNpcShape();
    toast.info("Redibuja la región", "Arrastra sobre la imagen para actualizar el área del NPC.");
  };

  const handleVisibleChange = (checked: boolean) => {
    if (!checked) {
      setPlacedNpcDraftInitialState({
        visible: false,
        reachable: false,
        notReachableText: "",
      });
      return;
    }
    setPlacedNpcDraftInitialState({ visible: true });
  };

  const handleReachableChange = (checked: boolean) => {
    if (checked) {
      setPlacedNpcDraftInitialState({
        reachable: true,
        notReachableText: "",
      });
    } else {
      setPlacedNpcDraftInitialState({ reachable: false });
    }
  };

  const panelError = editorError?.kind === "panel" ? editorError.message : null;
  const showRulesRequiredError = editorError?.kind === "rules";

  if (!layer) {
    return (
      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="mx-auto max-w-[420px] bg-slate-950/40 text-center mt-4 mb-2 text-xs text-white">
          No hay capa seleccionada.
        </div>
      </ToggleFieldBlock>
    );
  }

  return (
    <>
      <ConfirmDangerModal
        open={confirmNukeOpen}
        title="Borrar todos los NPCs"
        description="Esta acción no se puede deshacer. ¿Quieres eliminar todos los NPCs de esta capa?"
        confirmText="Sí, borrar todos"
        cancelText="Cancelar"
        onConfirm={handleConfirmNukeAll}
        onCancel={() => setConfirmNukeOpen(false)}
      />

      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="space-y-3">
                    {!isEditing && !isCreatingPlacedNpc ? (
            <div className="flex justify-center">
              <button
                type="button"
                className="btn btn-create-condition mt-2"
                onClick={handleStartAddingPlacedNpc}
                title="Añadir NPC"
              >
                + Añadir NPC
              </button>
            </div>
          ) : (
            <PlacedNpcEditorPanel
              draft={isEditing ? draft : null}
              selectedCatalogNpcId={selectedCatalogNpcId}
              projectNpcs={projectNpcs}
              onSelectedCatalogNpcIdChange={handleSelectedCatalogNpcIdChange}
              isDrawing={isDrawing}
              hasShape={hasShape}
              isExistingPlacedNpc={isExistingPlacedNpc}
              hasCollisions={hasCollisions}
              collisionSummary={collisionSummary}
              collisionLock={collisionLock}
              disableAllEditorFields={disableAllEditorFields}
              disableReachable={disableReachable}
              disableNotReachableText={disableNotReachableText}
              initialVisible={initialVisible}
              initialReachable={initialReachable}
              initialNotReachableText={initialNotReachableText}
              notReachableInputRef={notReachableInputRef}
              onNpcChange={setPlacedNpcDraftNpcId}
              onStartRedrawShape={handleStartRedrawShape}
              onVisibleChange={handleVisibleChange}
              onReachableChange={handleReachableChange}
              onNotReachableTextChange={(value) => setPlacedNpcDraftInitialState({ notReachableText: value })}
              owner={owner}
              activeChannel={activeChannel}
              setActiveChannel={setActiveChannel}
              clickRules={clickRules}
              useItemRulesForSelected={useItemRulesForSelected}
              ruleModalOpen={ruleModalOpen}
              currentRuleValue={currentRuleValue}
              nodeId={nodeId}
              project={project}
              onOpenAddClickRule={openAddClickRule}
              onOpenEditClickRule={openEditClickRule}
              onRemoveClickRule={(index) => {
                removeClickRule(index);
                toast.success("Regla eliminada", "Se ha eliminado la regla.");
              }}
              onOpenAddUseItemRule={openAddUseItemRule}
              onOpenEditUseItemRule={openEditUseItemRule}
              onRemoveUseItemRule={(itemId, index) => {
                removeUseItemRule(itemId, index);
                toast.success("Regla eliminada", "Se ha eliminado la regla.");
              }}
              onCloseRuleModal={closeRuleModal}
              onSaveRule={(rule: { id: ID; when?: Condition; effects: Effect[] }) => saveRule(rule)}
              panelError={panelError}
              showRulesRequiredError={showRulesRequiredError}
              useItemSourceOptions={useItemSourceOptions}
              onDelete={handleDeleteDraft}
              onCancel={handleCancelDraft}
              onCommit={handleCommit}
            />
          )}

          <PlacedNpcListPanel
            placedNpcs={placedNpcListEntries}
            selectedId={selectedId}
            onEdit={handleEditPlacedNpc}
            onDelete={handleDelete}
            onDeleteAll={handleAskNukeAll}
          />
        </div>
      </ToggleFieldBlock>
    </>
  );
}