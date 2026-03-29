import type { ID } from "@/domain/types";
import { InteractiveListPanel } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";

export type PlacedNpcListEntry = {
  id: ID;
  label: string;
};

type PlacedNpcListPanelProps = {
  placedNpcs: PlacedNpcListEntry[];
  selectedId: ID | null;
  onEdit: (npcId: ID) => void;
  onDelete: (npcId: ID) => void;
  onDeleteAll: () => void;
};

export function PlacedNpcListPanel({ placedNpcs, selectedId, onEdit, onDelete, onDeleteAll }: PlacedNpcListPanelProps) {
  return (
    <InteractiveListPanel
      items={placedNpcs}
      selectedId={selectedId}
      emptyText="No hay NPCs colocados."
      itemTitle="Editar NPC"
      editTitle="Editar"
      editAriaLabel="Editar NPC"
      deleteAriaLabel="Eliminar NPC"
      onEdit={onEdit}
      onDelete={onDelete}
      onDeleteAll={onDeleteAll}
    />
  );
}