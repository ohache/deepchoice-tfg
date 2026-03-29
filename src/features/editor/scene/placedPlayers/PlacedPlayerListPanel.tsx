import type { ID } from "@/domain/types";
import { InteractiveListPanel } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";

export type PlacedPlayerListEntry = {
  id: ID;
  label: string;
};

type PlacedPlayerListPanelProps = {
  placedPlayers: PlacedPlayerListEntry[];
  selectedId: ID | null;
  onEdit: (playerId: ID) => void;
  onDelete: (playerId: ID) => void;
  onDeleteAll: () => void;
};

export function PlacedPlayerListPanel({ placedPlayers, selectedId, onEdit, onDelete, onDeleteAll }: PlacedPlayerListPanelProps) {
  return (
    <InteractiveListPanel
      items={placedPlayers}
      selectedId={selectedId}
      emptyText="No hay players colocados."
      itemTitle="Editar player"
      editTitle="Editar"
      editAriaLabel="Editar player"
      deleteAriaLabel="Eliminar player"
      onEdit={onEdit}
      onDelete={onDelete}
      onDeleteAll={onDeleteAll}
    />
  );
}