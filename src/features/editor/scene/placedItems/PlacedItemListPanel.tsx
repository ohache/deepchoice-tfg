import type { ID } from "@/domain/types";
import { InteractiveListPanel } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";

export type PlacedItemListEntry = {
  id: ID;
  label: string;
};

type PlacedItemListPanelProps = {
  placedItems: PlacedItemListEntry[];
  selectedId: ID | null;
  onEdit: (placedItemId: ID) => void;
  onDelete: (placedItemId: ID) => void;
  onDeleteAll: () => void;
};

export function PlacedItemListPanel({ placedItems, selectedId, onEdit, onDelete, onDeleteAll }: PlacedItemListPanelProps) {
  return (
    <InteractiveListPanel
      items={placedItems}
      selectedId={selectedId}
      emptyText="No hay items colocados."
      itemTitle="Editar item"
      editTitle="Editar"
      editAriaLabel="Editar item"
      deleteAriaLabel="Eliminar item"
      onEdit={onEdit}
      onDelete={onDelete}
      onDeleteAll={onDeleteAll}
    />
  );
}