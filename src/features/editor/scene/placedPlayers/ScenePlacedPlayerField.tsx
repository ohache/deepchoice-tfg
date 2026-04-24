import { useEffect, useMemo, useState } from "react";
import type { ID, SceneImageLayer, Hotspot, PlacedItem, PlacedNpc, PlacedPlayer, PlayerDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { InteractiveListPanel, type InteractiveListEntry } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";
import { PlacedPlayerEditorPanel } from "@/features/editor/scene/placedPlayers/PlacedPlayerEditorPanel";
import { useEntityCollisionGuard } from "@/features/editor/scene/useEntityCollisionGuard";
import { buildClickableRegions, useActiveSceneLayer } from "@/features/editor/scene/interactiveComponents/fieldHelpers";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import { toast } from "@/shared/toast/toastStore";

type PlacedPlayerEditorError =
  | { kind: "panel"; message: string }
  | null;

type ScenePlacedPlayerFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
  layerId: ID;
};

export function ScenePlacedPlayerField({ label = "Players", active, onToggle, layerId }: ScenePlacedPlayerFieldProps) {
  const project = useEditorStore((s) => s.project ?? null);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);

  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);

  const placedPlayerEditor = useEditorStore((s) => s.placedPlayerEditor);

  const startRedrawPlacedPlayerShape = useEditorStore((s) => s.startRedrawPlacedPlayerShape);
  const startPlacingPlacedPlayer = useEditorStore((s) => s.startPlacingPlacedPlayer);
  const editPlacedPlayer = useEditorStore((s) => s.editPlacedPlayer);
  const cancelPlacedPlayerDraft = useEditorStore((s) => s.cancelPlacedPlayerDraft);

  const setPlacedPlayerDraftPlayerId = useEditorStore((s) => s.setPlacedPlayerDraftPlayerId);
  const setPlacedPlayerDraftInitialImageId = useEditorStore((s) => s.setPlacedPlayerDraftInitialImageId);
  const setPlacedPlayerDraftInitialState = useEditorStore((s) => s.setPlacedPlayerDraftInitialState);
  const setPlacedPlayerDraftShape = useEditorStore((s) => s.setPlacedPlayerDraftShape);
  const commitPlacedPlayerDraft = useEditorStore((s) => s.commitPlacedPlayerDraft);

  const removePlacedPlayer = useEditorStore((s) => s.removePlacedPlayer);
  const setActivePlacedPlayers = useEditorStore((s) => s.setActivePlacedPlayers);

  const selectedInteractionKind = useEditorStore((s) => s.selectedInteractionKind);
  const selectedInteractionId = useEditorStore((s) => s.selectedInteractionId);
  const setSelectedInteractionKind = useEditorStore((s) => s.setSelectedInteractionKind);
  const setSelectedInteractionId = useEditorStore((s) => s.setSelectedInteractionId);
  const clearInteractionSelection = useEditorStore((s) => s.clearInteractionSelection);

  const projectPlayers = useMemo<PlayerDef[]>(() => project?.players ?? [], [project?.players]);

  const [selectedCatalogPlayerId, setSelectedCatalogPlayerId] = useState<string>("");
  const [isCreatingPlacedPlayer, setIsCreatingPlacedPlayer] = useState(false);

  useEffect(() => {
    if (!projectPlayers.length) {
      setSelectedCatalogPlayerId("");
      return;
    }

    if (selectedCatalogPlayerId === "") return;

    const exists = projectPlayers.some((player) => player.id === selectedCatalogPlayerId);
    if (!exists) setSelectedCatalogPlayerId("");
  }, [projectPlayers, selectedCatalogPlayerId]);

  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const { layer } = useActiveSceneLayer({ active, layerId, activeLayerId, setActiveLayerId, layers });

  const hotspots = useMemo<Hotspot[]>(() => layer?.hotspots ?? [], [layer?.hotspots]);
  const placedItems = useMemo<PlacedItem[]>(() => layer?.placedItems ?? [], [layer?.placedItems]);
  const placedNpcs = useMemo<PlacedNpc[]>(() => layer?.placedNpcs ?? [], [layer?.placedNpcs]);
  const placedPlayers = useMemo<PlacedPlayer[]>(() => layer?.placedPlayers ?? [], [layer?.placedPlayers]);

  const selectedId = selectedInteractionKind === "placedPlayer" ? selectedInteractionId : null;

  const draft = placedPlayerEditor.draft;
  const isDrawing = placedPlayerEditor.mode.type === "drawing";
  const isDraftActive = placedPlayerEditor.mode.type !== "idle";

  const collisionResetKey = `${layerId}:${draft?.playerId ?? "none"}:${placedPlayerEditor.mode.type}`;

  const isExistingPlacedPlayer = useMemo(() => {
    if (!draft?.playerId) return false;
    return placedPlayers.some((p) => p.playerId === draft.playerId);
  }, [draft?.playerId, placedPlayers]);

  const clickableRegions = useMemo(() => 
    buildClickableRegions({ project, hotspots, placedItems, placedNpcs, placedPlayers  }),
    [project, hotspots, placedItems, placedNpcs, placedPlayers],
  );

  const { hasShape, hasCollisions, collisionSummary, collisionLock, resetCollisionGuard } = useEntityCollisionGuard({
    shape: draft?.shape,
    clickableRegions,
    ignore: draft?.playerId ? { kind: "player", id: draft.playerId } : undefined,
    enabled: true,
    isDrawing,
    minRect: 0.02,
    resetKey: collisionResetKey,
    onRejectShape: () => {
      setPlacedPlayerDraftShape(null);
      startRedrawPlacedPlayerShape();
    },
    onCollision: (summary) => {
      setEditorError({ kind: "panel", message: `Colisión con: ${summary}. Dibuja otra región o pulsa “Cancelar”.` });
    },
  });

  const [confirmNukeOpen, setConfirmNukeOpen] = useState(false);
  const [editorError, setEditorError] = useState<PlacedPlayerEditorError>(null);

  const placedPlayerListEntries = useMemo<InteractiveListEntry[]>(() =>
      placedPlayers.map((p) => {
        const playerDef = projectPlayers.find((def) => def.id === p.playerId) ?? null;
        return { id: p.playerId, label: playerDef?.name?.trim() || p.playerId };
      }), [placedPlayers, projectPlayers],
  );

  const beginPlacedPlayerPlacement = (playerId: string) => {
    if (!playerId) {
      toast.warning("Selecciona un player", "Debes seleccionar un player del catálogo.");
      return;
    }

    const selectedPlayer = projectPlayers.find((player) => player.id === playerId) ?? null;
    const initialImageId = selectedPlayer?.defaultImageId ?? selectedPlayer?.images[0]?.id ?? "";

    if (!initialImageId) {
      toast.warning("Player sin imágenes", "El player seleccionado no tiene imágenes disponibles.");
      return;
    }

    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();

    startPlacingPlacedPlayer({ playerId, initialImageId });

    toast.info("Dibuja una región", "Arrastra sobre la imagen de la derecha para definir el player.");
  };

  const handleStartAddingPlacedPlayer = () => {
    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();
    setSelectedCatalogPlayerId("");
    setIsCreatingPlacedPlayer(true);
  };

  const handleSelectedCatalogPlayerIdChange = (playerId: string) => {
    setSelectedCatalogPlayerId(playerId);

    if (!playerId) return;
    if (!isCreatingPlacedPlayer) return;
    if (isDraftActive) return;

    beginPlacedPlayerPlacement(playerId);
  };

  const handleCommit = () => {
    if (!draft) return;

    setEditorError(null);

    if (hasCollisions) {
      setEditorError({ kind: "panel", message: `Colisión con: ${collisionSummary}. Ajusta la región para que no se solape.` });
      return;
    }

    const result = commitPlacedPlayerDraft();
    if (!result.ok) {
      toast.error("No se ha podido guardar", result.error ?? "Revisa el player.");
      return;
    }

    if (result.playerId) {
      setSelectedInteractionKind("placedPlayer");
      setSelectedInteractionId(result.playerId);
    }

    setEditorError(null);
    setIsCreatingPlacedPlayer(false);
    setSelectedCatalogPlayerId("");

    toast.success("Player guardado", "El player ya forma parte de la escena.");
  };

  const handleDelete = (playerId: ID) => {
    removePlacedPlayer(playerId);

    const isSelectedPlacedPlayer =
      selectedInteractionKind === "placedPlayer" && selectedInteractionId === playerId;
    if (isSelectedPlacedPlayer) clearInteractionSelection();

    const isEditingThisDraft = draft?.playerId === playerId;
    if (isEditingThisDraft) {
      resetCollisionGuard();
      cancelPlacedPlayerDraft();
    }

    toast.success("Player eliminado", "Se ha eliminado correctamente.");
  };

  const handleAskNukeAll = () => {
    if (!placedPlayers.length) return;
    setConfirmNukeOpen(true);
  };

  const handleConfirmNukeAll = () => {
    setConfirmNukeOpen(false);
    setActivePlacedPlayers([]);
    clearInteractionSelection();

    if (draft) {
      resetCollisionGuard();
      cancelPlacedPlayerDraft();
    }

    setIsCreatingPlacedPlayer(false);
    setSelectedCatalogPlayerId("");

    toast.success("Players borrados", "Se han eliminado todos los players de esta capa.");
  };

  const handleEditPlacedPlayer = (playerId: ID) => {
    setEditorError(null);
    setIsCreatingPlacedPlayer(false);
    setSelectedCatalogPlayerId("");
    setSelectedInteractionKind("placedPlayer");
    setSelectedInteractionId(playerId);
    editPlacedPlayer(playerId);
  };

  const handleDeleteDraft = () => {
    if (!draft) return;
    handleDelete(draft.playerId);
    setIsCreatingPlacedPlayer(false);
    setSelectedCatalogPlayerId("");
  };

  const handleCancelDraft = () => {
    setEditorError(null);
    resetCollisionGuard();
    cancelPlacedPlayerDraft();
    clearInteractionSelection();
    setIsCreatingPlacedPlayer(false);
    setSelectedCatalogPlayerId("");
    toast.info("Cancelado", "Has salido del editor de player.");
  };

  const handleStartRedrawShape = () => {
    setEditorError(null);
    resetCollisionGuard();
    startRedrawPlacedPlayerShape();
    toast.info("Redibuja la región", "Arrastra sobre la imagen para actualizar el área del player.");
  };

  const handlePlayerChange = (playerId: ID) => {
    setPlacedPlayerDraftPlayerId(playerId);

    const selectedPlayer = projectPlayers.find((player) => player.id === playerId) ?? null;
    const nextInitialImageId = selectedPlayer?.defaultImageId ?? selectedPlayer?.images[0]?.id ?? "";

    if (nextInitialImageId) setPlacedPlayerDraftInitialImageId(nextInitialImageId);
  };

  const initialVisible = draft?.initialState.visible ?? true;
  const disableAllEditorFields = Boolean(draft) && !hasShape;
  const panelError = editorError?.kind === "panel" ? editorError.message : null;

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
        title="Borrar todos los players"
        description="Esta acción no se puede deshacer. ¿Quieres eliminar todos los players de esta capa?"
        confirmText="Sí, borrar todos"
        cancelText="Cancelar"
        onConfirm={handleConfirmNukeAll}
        onCancel={() => setConfirmNukeOpen(false)}
      />

      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="space-y-3">
          {!isDraftActive && !isCreatingPlacedPlayer ? (
              <InteractiveListPanel
                items={placedPlayerListEntries}
                selectedId={selectedId}
                itemTitle="Editar Player"
                editTitle="Editar"
                editAriaLabel="Editar Player"
                deleteAriaLabel="Eliminar Player"
                createLabel="+ Añadir Player"
                onCreate={handleStartAddingPlacedPlayer}
                onEdit={handleEditPlacedPlayer}
                onDelete={handleDelete}
                onDeleteAll={handleAskNukeAll}
              />
          ) : (
            <PlacedPlayerEditorPanel
              draft={draft ?? null}
              selectedCatalogPlayerId={selectedCatalogPlayerId}
              projectPlayers={projectPlayers}
              onSelectedCatalogPlayerIdChange={handleSelectedCatalogPlayerIdChange}
              isDrawing={isDrawing}
              hasShape={hasShape}
              isExistingPlacedPlayer={isExistingPlacedPlayer}
              hasCollisions={hasCollisions}
              collisionSummary={collisionSummary}
              collisionLock={collisionLock}
              disableAllEditorFields={disableAllEditorFields}
              initialVisible={initialVisible}
              onPlayerChange={handlePlayerChange}
              onInitialImageChange={setPlacedPlayerDraftInitialImageId}
              onStartRedrawShape={handleStartRedrawShape}
              onVisibleChange={(checked) => setPlacedPlayerDraftInitialState({ visible: checked })}
              panelError={panelError}
              onDelete={handleDeleteDraft}
              onCancel={handleCancelDraft}
              onCommit={handleCommit}
            />
          )}
        </div>
      </ToggleFieldBlock>
    </>
  );
}