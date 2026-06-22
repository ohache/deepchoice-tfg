import { useEffect, useMemo, useState } from "react";
import type { ID, SceneImageLayer, Hotspot, ItemInstance, PlacedNpc, PlacedPlayer, PlayerDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { PlacedPlayerEditorPanel } from "@/features/editor/scene/placedPlayers/PlacedPlayerEditorPanel";
import { InteractiveListPanel, type InteractiveListEntry } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";
import { buildClickableRegions, useActiveSceneLayer } from "@/features/editor/scene/interactiveComponents/interactiveFieldHelpers";
import { useEntityCollisionGuard } from "@/features/editor/scene/useEntityCollisionGuard";
import { DEFAULT_MIN_RECT_01 } from "@/features/editor/hooks/regionShape";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { toast } from "@/shared/toast/toastStore";

type PlacedPlayerEditorError = { kind: "panel"; message: string } | null;

type ScenePlacedPlayerFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
  layerId: ID;
};

export function ScenePlacedPlayerField({ label = "Jugadores", active, onToggle, layerId }: ScenePlacedPlayerFieldProps) {
  const project = useEditorStore((s) => s.project ?? null);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);

  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);

  const placedPlayerEditor = useEditorStore((s) => s.placedPlayerEditor);

  const startPlacingPlacedPlayer = useEditorStore((s) => s.startPlacingPlacedPlayer);
  const startRedrawPlacedPlayerShape = useEditorStore((s) => s.startRedrawPlacedPlayerShape);
  const editPlacedPlayer = useEditorStore((s) => s.editPlacedPlayer);
  const cancelPlacedPlayerDraft = useEditorStore((s) => s.cancelPlacedPlayerDraft);

  const setPlacedPlayerDraftPlayerId = useEditorStore((s) => s.setPlacedPlayerDraftPlayerId);
  const setPlacedPlayerDraftInitialImageId = useEditorStore((s) => s.setPlacedPlayerDraftInitialImageId);
  const setPlacedPlayerDraftInitialState = useEditorStore((s) => s.setPlacedPlayerDraftInitialState);
  const setPlacedPlayerDraftShape = useEditorStore((s) => s.setPlacedPlayerDraftShape);
  const commitPlacedPlayerDraft = useEditorStore((s) => s.commitPlacedPlayerDraft);

  const removePlacedPlayer = useEditorStore((s) => s.removePlacedPlayer);

  const selectedInteractionKind = useEditorStore((s) => s.selectedInteractionKind);
  const selectedInteractionId = useEditorStore((s) => s.selectedInteractionId);
  const setSelectedInteractionKind = useEditorStore((s) => s.setSelectedInteractionKind);
  const setSelectedInteractionId = useEditorStore((s) => s.setSelectedInteractionId);
  const clearInteractionSelection = useEditorStore((s) => s.clearInteractionSelection);

  const [selectedCatalogPlayerId, setSelectedCatalogPlayerId] = useState<ID | "">("");
  const [isCreatingPlacedPlayer, setIsCreatingPlacedPlayer] = useState(false);
  const [editorError, setEditorError] = useState<PlacedPlayerEditorError>(null);

  /* ----------------------------- Datos del proyecto ---------------------------- */
  const projectPlayers = useMemo<PlayerDef[]>(() => project?.players ?? [], [project?.players]);

  useEffect(() => {
    if (!projectPlayers.length) {
      setSelectedCatalogPlayerId("");
      return;
    }

    if (selectedCatalogPlayerId === "") return;

    const exists = projectPlayers.some((player) => player.id === selectedCatalogPlayerId);
    if (!exists) setSelectedCatalogPlayerId("");
  }, [projectPlayers, selectedCatalogPlayerId]);

  /* ------------------------------- Capa activa ------------------------------- */
  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const { layer } = useActiveSceneLayer({ active, layerId, activeLayerId, setActiveLayerId, layers });

  /* ---------------------------- Entidades de la capa --------------------------- */
  const hotspots = useMemo<Hotspot[]>(() => layer?.hotspots ?? [], [layer?.hotspots]);

  const placedItems = useMemo<ItemInstance[]>(() => layer?.placedItems ?? [], [layer?.placedItems]);

  const placedNpcs = useMemo<PlacedNpc[]>(() => layer?.placedNpcs ?? [], [layer?.placedNpcs]);

  const placedPlayers = useMemo<PlacedPlayer[]>(() => layer?.placedPlayers ?? [], [layer?.placedPlayers]);

  /* ------------------------------ Estado del draft ----------------------------- */
  const draft = placedPlayerEditor.draft;
  const isDrawing = placedPlayerEditor.mode.type === "drawing";
  const isDraftActive = placedPlayerEditor.mode.type !== "idle";

  /* ------------------------------- Derivados UI ------------------------------- */
  const selectedId = selectedInteractionKind === "placedPlayer" ? selectedInteractionId : null;

  const isExistingPlacedPlayer = useMemo(() => {
    if (!draft?.playerId) return false;
    return placedPlayers.some((player) => player.playerId === draft.playerId);
  }, [draft?.playerId, placedPlayers]);

  const placedPlayerListEntries = useMemo<InteractiveListEntry[]>(() => placedPlayers.map((placedPlayer) => {
        const playerDef = projectPlayers.find((def) => def.id === placedPlayer.playerId) ?? null;

        return { id: placedPlayer.playerId, label: playerDef?.name?.trim() || placedPlayer.playerId };
      }), [placedPlayers, projectPlayers],
  );

  /* -------------------------------- Colisiones -------------------------------- */
  const collisionResetKey = `${layerId}:${draft?.playerId ?? "none"}`;

  const clickableRegions = useMemo(() => buildClickableRegions({ project, hotspots, placedItems, placedNpcs, placedPlayers }),
    [project, hotspots, placedItems, placedNpcs, placedPlayers]);

  const { hasShape, hasCollisions, collisionSummary, collisionLock, resetCollisionGuard } = useEntityCollisionGuard({
    shape: draft?.shape,
    clickableRegions,
    ignore: draft?.playerId ? { kind: "player", id: draft.playerId } : undefined,
    enabled: true,
    isDrawing,
    minRect: DEFAULT_MIN_RECT_01,
    resetKey: collisionResetKey,
    onRejectShape: () => {
      setPlacedPlayerDraftShape(null);
      startRedrawPlacedPlayerShape();
    },
  });

  /* ----------------------------- Valores del panel ----------------------------- */
  const initialVisible = draft?.initialState.visible ?? true;
  const disableAllEditorFields = Boolean(draft) && !hasShape;
  const panelError = editorError?.kind === "panel" ? editorError.message : null;

  /* -------------------------------- Handlers -------------------------------- */
  const beginPlacedPlayerPlacement = (playerId: ID | "") => {
    if (!playerId) {
      toast.warning("Selecciona un jugador", "Debes seleccionar un jugador del catálogo.");
      return;
    }

    const selectedPlayer = projectPlayers.find((player) => player.id === playerId) ?? null;
    const initialImageId = selectedPlayer?.defaultImageId ?? selectedPlayer?.images[0]?.id ?? "";

    if (!initialImageId) {
      toast.warning("Jugador sin imágenes", "El jugador seleccionado no tiene imágenes disponibles.");
      return;
    }

    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();

    startPlacingPlacedPlayer({ playerId, initialImageId });

    toast.info("Dibuja una región", "Arrastra sobre la imagen de la derecha para definir el jugador.");
  };

  const handleStartAddingPlacedPlayer = () => {
    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();
    setSelectedCatalogPlayerId("");
    setIsCreatingPlacedPlayer(true);
  };

  const handleSelectedCatalogPlayerIdChange = (playerId: ID | "") => {
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
      toast.error("No se ha podido guardar", result.error ?? "Revisa el jugador.");
      return;
    }

    if (result.playerId) {
      setSelectedInteractionKind("placedPlayer");
      setSelectedInteractionId(result.playerId);
    }

    setEditorError(null);
    setIsCreatingPlacedPlayer(false);
    setSelectedCatalogPlayerId("");

    toast.success("Jugador guardado", "El jugador ya forma parte de la escena.");
  };

  const handleDelete = (playerId: ID) => {
    removePlacedPlayer(playerId, { withConfirmation: true });

    const isSelectedPlacedPlayer = selectedInteractionKind === "placedPlayer" && selectedInteractionId === playerId;

    if (isSelectedPlacedPlayer) clearInteractionSelection();

    const isEditingThisDraft = draft?.playerId === playerId;

    if (isEditingThisDraft) {
      resetCollisionGuard();
      cancelPlacedPlayerDraft();
    }

    setIsCreatingPlacedPlayer(false);
    setSelectedCatalogPlayerId("");
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

    toast.info("Cancelado", "Has salido del editor de jugador.");
  };

  const handleStartRedrawShape = () => {
    setEditorError(null);
    resetCollisionGuard();
    startRedrawPlacedPlayerShape();

    toast.info("Redibuja la región", "Arrastra sobre la imagen para actualizar el área del jugador.");
  };

  const handlePlayerChange = (playerId: ID) => {
    setPlacedPlayerDraftPlayerId(playerId);

    const selectedPlayer = projectPlayers.find((player) => player.id === playerId) ?? null;
    const nextInitialImageId = selectedPlayer?.defaultImageId ?? selectedPlayer?.images[0]?.id ?? "";

    if (nextInitialImageId) setPlacedPlayerDraftInitialImageId(nextInitialImageId);
  };

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
      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="space-y-3">
          {!isDraftActive && !isCreatingPlacedPlayer ? (
            <InteractiveListPanel
              items={placedPlayerListEntries}
              selectedId={selectedId}
              itemTitle="Editar Jugador"
              editTitle="Editar"
              editAriaLabel="Editar Jugador"
              deleteAriaLabel="Eliminar Jugador"
              createLabel="+ Añadir Jugador"
              onCreate={handleStartAddingPlacedPlayer}
              onEdit={handleEditPlacedPlayer}
              onDelete={handleDelete}
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
  );
}