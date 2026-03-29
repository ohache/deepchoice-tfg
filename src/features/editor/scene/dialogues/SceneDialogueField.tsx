import { useMemo, useState } from "react";
import type { ID, Dialogue, PlayerDef, NpcDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { toast } from "@/shared/toast/toastStore";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import { DialogueListPanel, type DialogueListEntry } from "@/features/editor/scene/dialogues/DialogueListPanel";
import { DialogueEditorModal } from "@/features/editor/scene/dialogues/DialogueEditorModal";

type SceneDialogueFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
};

export function SceneDialogueField({
  label = "Diálogos",
  active,
  onToggle,
}: SceneDialogueFieldProps) {
  const project = useEditorStore((s) => s.project ?? null);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);

  const dialogueEditor = useEditorStore((s) => s.dialogueEditor);
  const clearDialogueEditor = useEditorStore((s) => s.clearDialogueEditor);

  const startCreatingDialogue = useEditorStore((s) => s.startCreatingDialogue);
  const editDialogue = useEditorStore((s) => s.editDialogue);
  const cancelDialogueDraft = useEditorStore((s) => s.cancelDialogueDraft);
  const commitDialogueDraft = useEditorStore((s) => s.commitDialogueDraft);
  const removeDialogue = useEditorStore((s) => s.removeDialogue);
  const setNodeDialogues = useEditorStore((s) => s.setNodeDialogues);

  const [panelError, setPanelError] = useState<string | null>(null);
  const [confirmNukeOpen, setConfirmNukeOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const projectPlayers = useMemo<PlayerDef[]>(() => project?.players ?? [], [project?.players]);
  const projectNpcs = useMemo<NpcDef[]>(() => project?.npcs ?? [], [project?.npcs]);
  const dialogues = useMemo<Dialogue[]>(() => nodeDraft?.dialogues ?? [], [nodeDraft?.dialogues]);

  const selectedDialogueId = dialogueEditor.selection.selectedDialogueId;
  const editingDialogue = dialogueEditor.dialogueDraft;

  const dialogueListEntries = useMemo<DialogueListEntry[]>(
    () =>
      dialogues.map((dialogue, index) => {
        const playerName =
          projectPlayers.find((p) => p.id === dialogue.playerId)?.name?.trim() || dialogue.playerId;
        const npcName =
          projectNpcs.find((n) => n.id === dialogue.npcId)?.name?.trim() || dialogue.npcId;

        const base = dialogue.title?.trim() || `Diálogo ${index + 1}`;

        return {
          id: dialogue.id,
          label: `${base} · ${playerName} / ${npcName}`,
        };
      }),
    [dialogues, projectPlayers, projectNpcs]
  );

  const canCreateDialogue = projectPlayers.length > 0 && projectNpcs.length > 0;

  const handleStartCreating = () => {
    if (!nodeDraft) {
      toast.error("No hay escena en edición", "Primero debes editar una escena.");
      return;
    }

    if (!canCreateDialogue) {
      toast.warning("Faltan recursos", "Debes tener al menos un player y un NPC en el proyecto.");
      return;
    }

    const defaultPlayerId = projectPlayers[0]?.id ?? "";
    const defaultNpcId = projectNpcs[0]?.id ?? "";

    if (!defaultPlayerId || !defaultNpcId) return;

    setPanelError(null);

    const id = startCreatingDialogue({
      playerId: defaultPlayerId,
      npcId: defaultNpcId,
      title: "",
      description: "",
    });

    if (!id) {
      toast.error("No se ha podido crear", "No se pudo iniciar el diálogo.");
      return;
    }

    setModalOpen(true);
    toast.success("Diálogo creado", "Se ha abierto el editor del diálogo.");
  };

  const handleEditDialogue = (dialogueId: ID) => {
    setPanelError(null);
    editDialogue(dialogueId);
    setModalOpen(true);
  };

  const handleDeleteDialogue = (dialogueId: ID) => {
    removeDialogue(dialogueId);
    setPanelError(null);
    toast.success("Diálogo eliminado", "Se ha eliminado correctamente.");

    if (editingDialogue?.id === dialogueId) {
      setModalOpen(false);
    }
  };

  const handleDeleteAll = () => {
    if (!dialogues.length) return;
    setConfirmNukeOpen(true);
  };

  const handleConfirmDeleteAll = () => {
    setConfirmNukeOpen(false);
    setNodeDialogues([]);
    clearDialogueEditor();
    setModalOpen(false);
    setPanelError(null);
    toast.success("Diálogos borrados", "Se han eliminado todos los diálogos de la escena.");
  };

  const handleCloseModal = () => {
    setPanelError(null);
    cancelDialogueDraft();
    setModalOpen(false);
  };

  const handleCommit = () => {
    setPanelError(null);

    const result = commitDialogueDraft();
    if (!result.ok) {
      setPanelError(result.error ?? "El diálogo no es válido.");
      toast.error("No se ha podido guardar", result.error ?? "Revisa el diálogo.");
      return;
    }

    toast.success("Diálogo guardado", "Los cambios se han guardado correctamente.");
    clearDialogueEditor();
    cancelDialogueDraft();
    setModalOpen(false);
  };

  if (!nodeDraft) {
    return (
      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="mx-auto max-w-[420px] bg-slate-950/40 text-center mt-4 mb-2 text-xs text-white">
          No hay escena seleccionada.
        </div>
      </ToggleFieldBlock>
    );
  }

  return (
    <>
      <ConfirmDangerModal
        open={confirmNukeOpen}
        title="Borrar todos los diálogos"
        description="Esta acción no se puede deshacer. ¿Quieres eliminar todos los diálogos de esta escena?"
        confirmText="Sí, borrar todos"
        cancelText="Cancelar"
        onConfirm={handleConfirmDeleteAll}
        onCancel={() => setConfirmNukeOpen(false)}
      />

      <DialogueEditorModal
        open={modalOpen}
        dialogueDraft={editingDialogue}
        project={project}
        nodeId={nodeDraft.id}
        panelError={panelError}
        onClose={handleCloseModal}
        onCommit={handleCommit}
        onDeleteCurrent={() => {
          if (!editingDialogue?.id) return;
          handleDeleteDialogue(editingDialogue.id);
        }}
      />

      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="space-y-3">
          <div className="bg-slate-950/20 px-3 py-3 space-y-3 border-b-2 border-slate-800">
            <div className="flex justify-center">
              <button
                type="button"
                className="btn border border-indigo-400 bg-indigo-800 hover:bg-indigo-600 text-slate-100 font-semibold text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleStartCreating}
                disabled={!canCreateDialogue}
                title={
                  !canCreateDialogue
                    ? "Necesitas al menos 1 player y 1 NPC en el proyecto"
                    : "Crear diálogo"
                }
              >
                Añadir diálogo
              </button>
            </div>

            {!canCreateDialogue ? (
              <div className="text-[11px] text-slate-400 text-center">
                Necesitas al menos un player y un NPC en el proyecto para crear diálogos.
              </div>
            ) : null}
          </div>

          <DialogueListPanel
            dialogues={dialogueListEntries}
            selectedId={selectedDialogueId}
            onEdit={handleEditDialogue}
            onDelete={handleDeleteDialogue}
            onDeleteAll={handleDeleteAll}
          />
        </div>
      </ToggleFieldBlock>
    </>
  );
}