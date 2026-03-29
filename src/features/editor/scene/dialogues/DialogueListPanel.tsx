import type { ID } from "@/domain/types";
import { InteractiveListPanel } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";

export type DialogueListEntry = {
  id: ID;
  label: string;
};

type DialogueListPanelProps = {
  dialogues: DialogueListEntry[];
  selectedId: ID | null;
  onEdit: (dialogueId: ID) => void;
  onDelete: (dialogueId: ID) => void;
  onDeleteAll: () => void;
};

export function DialogueListPanel({
  dialogues,
  selectedId,
  onEdit,
  onDelete,
  onDeleteAll,
}: DialogueListPanelProps) {
  return (
    <InteractiveListPanel
      items={dialogues}
      selectedId={selectedId}
      emptyText="No hay diálogos en esta escena."
      itemTitle="Editar diálogo"
      editTitle="Editar"
      editAriaLabel="Editar diálogo"
      deleteAriaLabel="Eliminar diálogo"
      onEdit={onEdit}
      onDelete={onDelete}
      onDeleteAll={onDeleteAll}
    />
  );
}