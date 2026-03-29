import type { ID, PlayerDef } from "@/domain/types";
import type { PlacedPlayerDraft } from "@/features/editor/scene/placedPlayers/placedPlayerEditorTypes";
import { Select, type Option } from "@/components/Select";
import { Pencil } from "lucide-react";
import { RegionStatusNotice } from "@/features/editor/scene/interactiveComponents/RegionStatusNotice";

type PlacedPlayerEditorPanelProps = {
  draft: PlacedPlayerDraft | null;
  selectedCatalogPlayerId: string;
  projectPlayers: PlayerDef[];
  onSelectedCatalogPlayerIdChange: (playerId: string) => void;

  isDrawing: boolean;
  hasShape: boolean;
  isExistingPlacedPlayer: boolean;
  hasCollisions: boolean;
  collisionSummary: string;
  collisionLock: { active: boolean; summary: string };
  disableAllEditorFields: boolean;

  initialVisible: boolean;

  onPlayerChange: (playerId: ID) => void;
  onInitialImageChange: (imageId: ID) => void;
  onStartRedrawShape: () => void;
  onVisibleChange: (checked: boolean) => void;

  panelError: string | null;

  onDelete: () => void;
  onCancel: () => void;
  onCommit: () => void;
};

export function PlacedPlayerEditorPanel({
  draft,
  selectedCatalogPlayerId,
  projectPlayers,
  onSelectedCatalogPlayerIdChange,
  isDrawing,
  hasShape,
  isExistingPlacedPlayer,
  hasCollisions,
  collisionSummary,
  collisionLock,
  disableAllEditorFields,
  initialVisible,
  onPlayerChange,
  onInitialImageChange,
  onStartRedrawShape,
  onVisibleChange,
  panelError,
  onDelete,
  onCancel,
  onCommit,
}: PlacedPlayerEditorPanelProps) {
  const playerOptions: Option<string>[] = projectPlayers.map((player) => ({
    id: player.id,
    label: player.name || player.id,
  }));

  const selectedPlayer =
    draft
      ? projectPlayers.find((player) => player.id === draft.playerId) ?? null
      : projectPlayers.find((player) => player.id === selectedCatalogPlayerId) ?? null;

  const imageOptions: Option<string>[] = (selectedPlayer?.images ?? []).map((img) => ({
    id: img.id,
    label: img.name || img.id,
  }));

  if (!draft) {
    return (
      <div className="bg-slate-950/40 p-1 space-y-3">
        <div className="rounded-md border border-slate-700 bg-slate-950/20 px-3 py-3 space-y-3">
          <div className="text-xs text-slate-200 text-center">
            Selecciona un player del catálogo para dibujarlo directamente en la escena
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-100">Player</div>

            <Select<string>
              value={selectedCatalogPlayerId}
              onChange={onSelectedCatalogPlayerIdChange}
              options={playerOptions}
              placeholder="Seleccionar player"
              disabled={!projectPlayers.length}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/40 p-1 space-y-2">
      {panelError ? (
        <div className="rounded-md border border-red-500/40 bg-red-950/20 px-2 py-1 text-[11px] text-red-100">
          {panelError}
        </div>
      ) : (
        <RegionStatusNotice
          isDrawing={isDrawing}
          hasShape={hasShape}
          hasCollisions={hasCollisions}
          collisionSummary={collisionSummary}
          collisionLock={collisionLock}
          drawingText="Dibuja una región en la imagen (arrastra con el ratón). Pulsa “Cancelar” para salir."
          missingShapeText="Falta una región válida. Dibuja un rectángulo dentro de la imagen para definir el player."
        />
      )}

      <div className="space-y-1">
        <div className="text-xs text-slate-100 mb-1.5">Player</div>

        <Select<string>
          value={draft.playerId}
          onChange={(value) => {
            if (!value) return;
            onPlayerChange(value as ID);
          }}
          options={playerOptions}
          placeholder="Seleccionar player"
          disabled={!projectPlayers.length || disableAllEditorFields || isExistingPlacedPlayer}
          className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"
        />
      </div>

      <div className="space-y-1">
        <div className="text-xs text-slate-100 mb-1.5">Imagen inicial</div>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <Select<string>
              value={draft.initialImageId}
              onChange={(value) => {
                if (!value) return;
                onInitialImageChange(value as ID);
              }}
              options={imageOptions}
              placeholder="Seleccionar imagen"
              disabled={!selectedPlayer || imageOptions.length === 0 || disableAllEditorFields}
              className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            className="btn border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-white"
            onClick={onStartRedrawShape}
            title={isDrawing ? "Termina o cancela el dibujo actual antes de editar la región" : "Editar región del player"}
            disabled={isDrawing}
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        {selectedPlayer && imageOptions.length === 0 ? (
          <div className="mt-2 rounded-md border border-rose-500/40 bg-rose-950/20 px-2 py-1 text-[11px] text-rose-100">
            Este player no tiene imágenes disponibles.
          </div>
        ) : null}
      </div>

      <div className="h-px bg-slate-700 my-2" />

      <div className="bg-slate-950/30 px-2 py-2">
        <div className="text-xs text-slate-200 mb-2 text-center">Estado inicial</div>

        <div className="flex items-center justify-center gap-6">
          <label className="inline-flex items-center gap-2 text-xs text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={initialVisible}
              disabled={disableAllEditorFields}
              onChange={(e) => onVisibleChange(e.target.checked)}
            />
            Visible
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-4">
        <div className="flex items-center gap-2">
          {isExistingPlacedPlayer ? (
            <button
              type="button"
              className="btn btn-danger text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={onDelete}
              title="Eliminar player"
              disabled={isDrawing}
            >
              Eliminar
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-cancel text-[11px]" onClick={onCancel}>
            Cancelar
          </button>

          <button
            type="button"
            className="btn btn-create text-[11px]"
            onClick={onCommit}
            title={
              isDrawing
                ? "Termina o cancela el dibujo actual antes de guardar"
                : !hasShape
                  ? "Dibuja una región válida antes de guardar"
                  : !draft.playerId
                    ? "Debes seleccionar un player"
                    : !draft.initialImageId
                      ? "Debes seleccionar una imagen inicial"
                      : hasCollisions
                        ? "Colisión con otro clicable"
                        : undefined
            }
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}