import type { Hotspot, ID } from "@/domain/types";
import { InteractiveListPanel, type InteractiveListEntry } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";

type HotspotListPanelProps = {
  hotspots: Hotspot[];
  selectedId: ID | null;
  onCreate: () => void;
  onEdit: (hotspotId: ID) => void;
  onDelete: (hotspotId: ID) => void;
  onDeleteAll: () => void;
};

export function HotspotListPanel({ hotspots, selectedId, onCreate, onEdit, onDelete, onDeleteAll }: HotspotListPanelProps) {
  const items: InteractiveListEntry[] = hotspots.map((hotspot) => ({ id: hotspot.id, label: hotspot.label }));

  return (
    <InteractiveListPanel
      items={items}
      selectedId={selectedId}
      emptyText="No hay hotspots dibujados."
      itemTitle="Editar hotspot"
      editTitle="Editar"
      editAriaLabel="Editar hotspot"
      deleteAriaLabel="Eliminar hotspot"
      createLabel="+ Añadir hotspot"
      onCreate={onCreate}
      onEdit={onEdit}
      onDelete={onDelete}
      onDeleteAll={onDeleteAll}
    />
  );
}