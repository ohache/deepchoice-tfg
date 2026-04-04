import { useMemo, useState, useEffect } from "react";
import type { ID, Dialogue, DialogueLineNode, PlayerDef, NpcDef, Project } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { Select, type Option } from "@/components/Select";
import { DialogueTreeView } from "@/features/editor/scene/dialogues/DialogueTreeView";
import { ConditionBuilderModal } from "@/features/editor/scene/rules/conditions/ConditionBuilderModal";
import { RuleBuilderModal } from "@/features/editor/scene/rules/RuleBuilderModal";
import type { Effect } from "@/domain/effects";

type DialogueEditorModalProps = {
  open: boolean;
  dialogueDraft: Dialogue | null;
  project: Project | null;
  nodeId: ID;
  panelError?: string | null;
  onClose: () => void;
  onCommit: () => void;
  onDeleteCurrent: () => void;
};

export function DialogueEditorModal({ open, dialogueDraft, project, nodeId, panelError, onClose, onCommit, onDeleteCurrent }: DialogueEditorModalProps) {
  const dialogueEditor = useEditorStore((s) => s.dialogueEditor);
  const setDialogueSelection = useEditorStore((s) => s.setDialogueSelection);
  const commitLineDraft = useEditorStore((s) => s.commitLineDraft);

  const setDialogueTitle = useEditorStore((s) => s.setDialogueTitle);
  const setDialogueDescription = useEditorStore((s) => s.setDialogueDescription);
  const setDialoguePlayerId = useEditorStore((s) => s.setDialoguePlayerId);
  const setDialogueNpcId = useEditorStore((s) => s.setDialogueNpcId);
  const setDialogueWhen = useEditorStore((s) => s.setDialogueWhen);

  const addDialogueLine = useEditorStore((s) => s.addDialogueLine);
  const updateDialogueLine = useEditorStore((s) => s.updateDialogueLine);
  const removeDialogueLine = useEditorStore((s) => s.removeDialogueLine);

  const validateDialogueDraft = useEditorStore((s) => s.validateDialogueDraft);

  const [dialogueConditionOpen, setDialogueConditionOpen] = useState(false);
  const [lineRuleOpen, setLineRuleOpen] = useState(false);
  const [lineRuleTargetId, setLineRuleTargetId] = useState<ID | null>(null);

  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  const selectedDialogueId = dialogueEditor.selection.selectedDialogueId;
  const selectedNodeId = dialogueEditor.selection.selectedNodeId;
  const lineDraft = dialogueEditor.lineDraft;

  const displayedPanelError = panelError ?? localValidationError;

  const playerOptions: Option<string>[] = (project?.players ?? []).map((player: PlayerDef) => ({
    id: player.id,
    label: player.name || player.id,
  }));

  const npcOptions: Option<string>[] = (project?.npcs ?? []).map((npc: NpcDef) => ({
    id: npc.id,
    label: npc.name || npc.id,
  }));

  const currentDialogueId = dialogueDraft?.id ?? selectedDialogueId ?? null;

  useEffect(() => {
  if (!open || !currentDialogueId) {
    setLocalValidationError(null);
    return;
  }

  const result = validateDialogueDraft(currentDialogueId);
  setLocalValidationError(result.ok ? null : (result.error ?? null));
}, [open, currentDialogueId, dialogueDraft, validateDialogueDraft]);

  const ruleLine = useMemo(() => {
    const targetId = lineRuleTargetId ?? selectedNodeId ?? null;
    if (!dialogueDraft || !targetId) return null;
    const node = dialogueDraft.nodes.find((n) => n.id === targetId);
    return node && node.type === "line" ? node : null;
  }, [dialogueDraft, lineRuleTargetId, selectedNodeId]);

  const playerName = useMemo(() => {
  if (!dialogueDraft?.playerId) return "Player";
  const player = (project?.players ?? []).find((p) => p.id === dialogueDraft.playerId);
  return player?.name?.trim() || dialogueDraft.playerId;
}, [project, dialogueDraft?.playerId]);

const npcName = useMemo(() => {
  if (!dialogueDraft?.npcId) return "NPC";
  const npc = (project?.npcs ?? []).find((n) => n.id === dialogueDraft.npcId);
  return npc?.name?.trim() || dialogueDraft.npcId;
}, [project, dialogueDraft?.npcId]);

  const lineRuleOwner = currentDialogueId && ruleLine
      ? {
        kind: "dialogueLine" as const,
        dialogueId: currentDialogueId,
        lineId: ruleLine.id,
      }
      : null;

  const lineRuleValue = ruleLine
    ? {
      id: ruleLine.id,
      when: ruleLine.when ?? null,
      effects: ruleLine.effects ?? [],
    }
    : null;

  const handleSelectLine = (lineId: ID) => {
    commitLineDraft();
    setDialogueSelection({ selectedNodeId: lineId });
  };

  const handleAddRootLine = () => {
    if (!currentDialogueId || !dialogueDraft) return;

    commitLineDraft();

    const id = addDialogueLine(currentDialogueId, {
      parentId: dialogueDraft.rootId,
      speaker: "player",
      text: "",
    });

    if (id) setDialogueSelection({ selectedNodeId: id });
  };

  const handleAddChild = (parentId: ID, speaker: DialogueLineNode["speaker"]) => {
    if (!currentDialogueId) return;

    commitLineDraft();

    const id = addDialogueLine(currentDialogueId, {
      parentId,
      speaker,
      text: "",
    });

    if (id) setDialogueSelection({ selectedNodeId: id });
  };

  const handleSaveLine = (_lineId: ID) => {
    commitLineDraft();
    setDialogueSelection({ selectedNodeId: null })
  };

  const handleOpenLineRule = (lineId: ID) => {
    commitLineDraft();
    setLineRuleTargetId(lineId);
    setLineRuleOpen(true);
  };

  const handleSaveLineRule = (rule: { id: ID; when?: import("@/domain/conditions").Condition; effects: Effect[] }) => {
    if (!currentDialogueId || !lineRuleTargetId) return;

    updateDialogueLine(currentDialogueId, lineRuleTargetId, {
      when: rule.when,
      effects: rule.effects,
    });

    setLineRuleOpen(false);
    setLineRuleTargetId(null);
  };

  if (!open) return null;
  if (!dialogueDraft || !currentDialogueId) return null;

  return (
    <>
      <div className="fixed inset-0 z-1000 flex items-center justify-center" role="dialog" aria-modal="true">
        <button
          type="button"
          className="absolute inset-0 bg-black/70"
          onClick={() => {
            if (dialogueConditionOpen) return;
            onClose();
          }}
          aria-label="Cerrar modal"
        />

        <div className="relative w-[96%] max-w-[1500px] max-h-[92vh] rounded-xl border-2 border-slate-600 bg-slate-950/90 shadow-xl overflow-hidden">
          <div className="flex items-center justify-center gap-3 border-b-2 border-slate-700 px-5 py-4">
            <div className="min-w-0">
              <div className="text-center text-base font-semibold text-slate-100 truncate">
                {dialogueDraft.title?.trim() || "Editor de diálogo"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-0 h-[calc(92vh-140px)]">
            <section className="border-r-2 border-slate-700 p-2 overflow-y-auto editor-scroll space-y-4">
              {displayedPanelError ? (
                <div className="bg-red-950/20 px-3 py-2 text-[12px] text-red-100">
                  {displayedPanelError}
                </div>
              ) : null}

              <div className="p-3 space-y-3 text-[13px] text-slate-100">
                <div className="space-y-1">
                  <div>Título</div>
                  <input
                    value={dialogueDraft.title ?? ""}
                    onChange={(e) => setDialogueTitle(currentDialogueId, e.currentTarget.value)}
                    placeholder="Título del diálogo"
                    className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>

                <div className="space-y-1">
                  <div>Descripción</div>
                  <textarea
                    value={dialogueDraft.description ?? ""}
                    onChange={(e) => setDialogueDescription(currentDialogueId, e.currentTarget.value)}
                    rows={3}
                    placeholder="Descripción opcional"
                    className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
                  />
                </div>

                <div className="space-y-1">
                  <div>Player</div>
                  <Select<string>
                    value={dialogueDraft.playerId}
                    onChange={(value) => value && setDialoguePlayerId(currentDialogueId, value as ID)}
                    options={playerOptions}
                    placeholder="Seleccionar player"
                    disabled={!playerOptions.length}
                    className="w-full rounded-md bg-slate-900/30 border-2 border-emerald-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <div>NPC</div>
                  <Select<string>
                    value={dialogueDraft.npcId}
                    onChange={(value) => value && setDialogueNpcId(currentDialogueId, value as ID)}
                    options={npcOptions}
                    placeholder="Seleccionar NPC"
                    disabled={!npcOptions.length}
                    className="w-full rounded-md bg-slate-900/30 border-2 border-sky-800 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"
                  />
                </div>

                <div className="px-2 py-4 space-y-2">
                  <div className="flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-create text-[13px]"
                        onClick={() => setDialogueConditionOpen(true)}
                      >
                        {dialogueDraft.when ? "Editar" : "Añadir condición"}
                      </button>

                      {dialogueDraft.when ? (
                        <button
                          type="button"
                          className="btn border-2 border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/50 text-rose-100 text-[11px]"
                          onClick={() => setDialogueWhen(currentDialogueId, undefined)}
                        >
                          Eliminar
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="p-4 overflow-y-auto editor-scroll space-y-4">
              <DialogueTreeView
                dialogue={dialogueDraft}
                playerName={playerName}
                npcName={npcName}
                selectedLineId={selectedNodeId}
                editingLineDraft={lineDraft}
                onSelectLine={handleSelectLine}
                onAddRootLine={handleAddRootLine}
                onAddChild={handleAddChild}
                onDeleteLine={(lineId) => removeDialogueLine(currentDialogueId, lineId)}
                onUpdateLine={(lineId, patch) => updateDialogueLine(currentDialogueId, lineId, patch)}
                onSaveLine={handleSaveLine}
                onOpenLineRule={handleOpenLineRule}
              />
            </section>
          </div>

          <div className="flex items-center justify-between gap-2 border-t-2 border-slate-700 px-5 py-4 bg-slate-950/90">
            <button
              type="button"
              className="btn btn-danger text-[12px]"
              onClick={onDeleteCurrent}
            >
              Eliminar diálogo
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-cancel text-[12px]"
                onClick={onClose}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="btn btn-create text-[12px]"
                onClick={onCommit}
              >
                Guardar diálogo
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConditionBuilderModal
        open={dialogueConditionOpen}
        project={project}
        currentNodeId={nodeId}
        value={dialogueDraft.when ?? null}
        title="Condición del diálogo"
        onClose={() => setDialogueConditionOpen(false)}
        onSave={(cond) => {
          setDialogueWhen(currentDialogueId, cond);
          setDialogueConditionOpen(false);
        }}
        onApply={(cond) => {
          setDialogueWhen(currentDialogueId, cond);
        }}
      />

      {lineRuleOpen && lineRuleOwner && lineRuleValue ? (
        <RuleBuilderModal
          open={lineRuleOpen}
          project={project}
          nodeId={nodeId}
          owner={lineRuleOwner}
          value={lineRuleValue}
          onClose={() => {
            setLineRuleOpen(false);
            setLineRuleTargetId(null);
          }}
          onSave={handleSaveLineRule}
        />
      ) : null}
    </>
  );
}