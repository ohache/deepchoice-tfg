import { useMemo, useState } from "react";
import type { ID, Dialogue, PlayerDef, NpcDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { InteractiveListPanel } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";
import { filterEntitiesByIds, buildDefaultDialogueTitle, buildDialogueListEntries, getPlacedPlayerIds, getPlacedNpcIds } from "@/features/editor/scene/dialogues/dialogueHelpers";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { DialogueEditorModal } from "@/features/editor/scene/dialogues/DialogueEditorModal";
import { toast } from "@/shared/toast/toastStore";

type SceneDialogueFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
};

export function SceneDialogueField({ label = "Diálogos", active, onToggle }: SceneDialogueFieldProps) {
  const project = useEditorStore((state) => state.project ?? null);
  const nodeDraft = useEditorStore((state) => state.nodeDraft);

  const dialogueEditor = useEditorStore((state) => state.dialogueEditor);
  const clearDialogueEditor = useEditorStore((state) => state.clearDialogueEditor);

  const startCreatingDialogue = useEditorStore((state) => state.startCreatingDialogue);
  const editDialogue = useEditorStore((state) => state.editDialogue);
  const cancelDialogueDraft = useEditorStore((state) => state.cancelDialogueDraft);
  const commitDialogueDraft = useEditorStore((state) => state.commitDialogueDraft);
  const removeDialogue = useEditorStore((state) => state.removeDialogue);

  const [panelError, setPanelError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const projectPlayers = useMemo<PlayerDef[]>(() => project?.players ?? [], [project?.players]);
  const projectNpcs = useMemo<NpcDef[]>(() => project?.npcs ?? [], [project?.npcs]);
  const dialogues = useMemo<Dialogue[]>(() => nodeDraft?.dialogues ?? [], [nodeDraft?.dialogues]);

  const placedPlayerIds = useMemo(() => getPlacedPlayerIds(nodeDraft), [nodeDraft]);
  const placedNpcIds = useMemo(() => getPlacedNpcIds(nodeDraft), [nodeDraft]);

  const placedPlayers = useMemo(() => filterEntitiesByIds(projectPlayers, placedPlayerIds), [projectPlayers, placedPlayerIds]);

  const placedNpcs = useMemo(() => filterEntitiesByIds(projectNpcs, placedNpcIds), [projectNpcs, placedNpcIds]);

  const canCreateDialogue = placedPlayers.length > 0 && placedNpcs.length > 0;

  const selectedDialogueId = dialogueEditor.selection.selectedDialogueId;
  const editingDialogue = dialogueEditor.dialogueDraft;

  const dialogueListEntries = useMemo(() => buildDialogueListEntries(dialogues, projectPlayers, projectNpcs), [dialogues, projectPlayers, projectNpcs]);

  /* Handlers */
  const handleStartCreating = () => {
    if (!nodeDraft) {
      toast.error("No hay escena en edición", "Primero debes editar una escena.");
      return;
    }

    if (!canCreateDialogue) {
      toast.warning("Faltan personajes en escena", "Debes emplazar al menos un Jugador y un PNJ en esta escena.");
      return;
    }

    const defaultPlayerId = placedPlayers[0]?.id ?? "";
    const defaultNpcId = placedNpcs[0]?.id ?? "";

    if (!defaultPlayerId || !defaultNpcId) return;

    setPanelError(null);

    const dialogueId = startCreatingDialogue({ playerId: defaultPlayerId, npcId: defaultNpcId, title: buildDefaultDialogueTitle(dialogues) });

    if (!dialogueId) {
      toast.error("No se ha podido crear", "No se pudo iniciar el diálogo.");
      return;
    }

    setModalOpen(true);
  };

  const handleEditDialogue = (dialogueId: ID) => {
    setPanelError(null);
    editDialogue(dialogueId);
    setModalOpen(true);
  };

  const handleDeleteDialogue = (dialogueId: ID) => {
    removeDialogue(dialogueId);
    setPanelError(null);
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

    clearDialogueEditor();
    setModalOpen(false);

    toast.success("Diálogo guardado", "Los cambios se han guardado correctamente.");
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
      <DialogueEditorModal
        open={modalOpen}
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
          {/* Cabecera de acciones */}
          <div className="bg-slate-950/20 px-3 py-3 space-y-3 border-b-2 border-slate-800">
            <div className="flex justify-center">
              <button
                type="button"
                className="btn border border-indigo-600 bg-indigo-900/60 hover:bg-indigo-800 text-white text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleStartCreating}
                disabled={!canCreateDialogue}
                title={!canCreateDialogue ? "Necesitas al menos 1 Jugador y 1 PNJ en el proyecto" : "Crear diálogo"}
              >
                + Añadir diálogo
              </button>
            </div>

            {!canCreateDialogue ? (
              <div className="text-[12px] text-slate-300 text-center">
                Necesitas al menos un Jugador y un PNJ en la escena para crear diálogos.
              </div>
            ) : null}
          </div>

          {/* Lista de diálogos */}
          <InteractiveListPanel
            items={dialogueListEntries}
            selectedId={selectedDialogueId}
            itemTitle="Editar diálogo"
            editTitle="Editar"
            editAriaLabel="Editar diálogo"
            deleteAriaLabel="Eliminar diálogo"
            onEdit={handleEditDialogue}
            onDelete={handleDeleteDialogue}
          />
        </div>
      </ToggleFieldBlock>
    </>
  );
}