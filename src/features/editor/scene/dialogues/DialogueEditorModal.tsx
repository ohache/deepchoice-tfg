import { useMemo, useState } from "react";
import type { ID, Dialogue, DialogueLineNode, PlayerDef, NpcDef, Project } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import type { Condition } from "@/domain/conditions";
import { useEditorStore } from "@/store/editorStore";
import { buildLiveProjectWithDialogueDraft } from "@/features/editor/scene/dialogues/dialogueHelpersSlice";
import { Select, type Option } from "@/components/Select";
import { DialogueTreeView } from "@/features/editor/scene/dialogues/DialogueTreeView";
import { ConditionBuilderModal } from "@/features/editor/scene/rules/conditions/ConditionBuilderModal";
import { RuleBuilderModal } from "@/features/editor/scene/rules/RuleBuilderModal";

/* Helpers */
function buildCharacterOptions<T extends PlayerDef | NpcDef>(items: T[]): Option<string>[] {
  return items.map((item) => ({ id: item.id, label: item.name?.trim() || item.id }));
}

function findCharacterName<T extends { id: ID; name?: string }>(items: T[] | undefined, id: ID | null | undefined, fallback: string): string {
  if (!id) return fallback;
  const item = (items ?? []).find((entry) => entry.id === id);
  return item?.name?.trim() || id;
}

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
  const dialogueEditor = useEditorStore((state) => state.dialogueEditor);
  const nodeDraft = useEditorStore((state) => state.nodeDraft);

  const setDialogueSelection = useEditorStore((state) => state.setDialogueSelection);
  const commitLineDraft = useEditorStore((state) => state.commitLineDraft);

  const setDialogueTitle = useEditorStore((state) => state.setDialogueTitle);
  const setDialogueDescription = useEditorStore((state) => state.setDialogueDescription);
  const setDialoguePlayerId = useEditorStore((state) => state.setDialoguePlayerId);
  const setDialogueNpcId = useEditorStore((state) => state.setDialogueNpcId);
  const setDialogueWhen = useEditorStore((state) => state.setDialogueWhen);

  const addDialogueLine = useEditorStore((state) => state.addDialogueLine);
  const updateDialogueLine = useEditorStore((state) => state.updateDialogueLine);
  const removeDialogueLine = useEditorStore((state) => state.removeDialogueLine);
  const reorderDialogueLines = useEditorStore((state) => state.reorderDialogueLines);

  const [dialogueConditionOpen, setDialogueConditionOpen] = useState(false);
  const [lineRuleOpen, setLineRuleOpen] = useState(false);
  const [lineRuleTargetId, setLineRuleTargetId] = useState<ID | null>(null);

  const selectedDialogueId = dialogueEditor.selection.selectedDialogueId;
  const selectedNodeId = dialogueEditor.selection.selectedNodeId;
  const lineDraft = dialogueEditor.lineDraft;

  const currentDialogueId = dialogueDraft?.id ?? selectedDialogueId ?? null;
  const displayedPanelError = panelError ?? null;

  /* Proyecto “vivo” con el diálogo draft embebido */
  const liveProject = useMemo(() =>
      buildLiveProjectWithDialogueDraft({ project, nodeDraft, nodeId, dialogueDraft }),
    [project, nodeDraft, nodeId, dialogueDraft]
  );

  const players = useMemo<PlayerDef[]>(() => liveProject?.players ?? [], [liveProject]);
  const npcs = useMemo<NpcDef[]>(() => liveProject?.npcs ?? [], [liveProject]);

  const playerOptions = useMemo<Option<string>[]>(() => buildCharacterOptions(players), [players]);
  const npcOptions = useMemo<Option<string>[]>(() => buildCharacterOptions(npcs), [npcs]);

  const playerName = useMemo(() => findCharacterName(players, dialogueDraft?.playerId, "Player"), [players, dialogueDraft?.playerId]);

  const npcName = useMemo(() => findCharacterName(npcs, dialogueDraft?.npcId, "NPC"), [npcs, dialogueDraft?.npcId]);

  const ruleLine = useMemo(() => {
    const targetId = lineRuleTargetId ?? selectedNodeId ?? null;
    if (!dialogueDraft || !targetId) return null;

    const node = dialogueDraft.nodes.find((entry) => entry.id === targetId);
    return node && node.type === "line" ? node : null;
  }, [dialogueDraft, lineRuleTargetId, selectedNodeId]);

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

  /* Handlers */
  const handleSelectLine = (lineId: ID | null) => {
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

  const handleSaveLine = () => {
    commitLineDraft();
    setDialogueSelection({ selectedNodeId: null });
  };

  const handleOpenLineRule = (lineId: ID) => {
    commitLineDraft();
    setLineRuleTargetId(lineId);
    setLineRuleOpen(true);
  };

  const handleSaveLineRule = (rule: {id: ID; when?: Condition; phrase?: string; effects: Effect[] }) => {
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
    <div
      className="fixed inset-0 z-1000 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={() => {
          if (dialogueConditionOpen || lineRuleOpen) return;
          onClose();
        }}
        aria-label="Cerrar modal"
      />

      <div className="relative w-[96%] max-w-[1500px] max-h-[92vh] rounded-xl border-2 border-slate-600 bg-slate-950/90 shadow-xl overflow-hidden">
        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-0 h-[calc(92vh-76px)]">
          {/* Panel lateral */}
          <section className="border-r-2 border-slate-700 p-2 overflow-y-auto editor-scroll flex flex-col justify-center">
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
                  onChange={(event) => setDialogueTitle(currentDialogueId, event.currentTarget.value)}
                  placeholder="Título del diálogo"
                  className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>

              <div className="space-y-1">
                <div>Descripción</div>
                <textarea
                  value={dialogueDraft.description ?? ""}
                  onChange={(event) =>
                    setDialogueDescription(currentDialogueId, event.currentTarget.value)
                  }
                  rows={3}
                  placeholder="Descripción opcional"
                  className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>

              <div className="space-y-1">
                <div>Player</div>
                <Select<string>
                  value={dialogueDraft.playerId}
                  onChange={(value) =>
                    value && setDialoguePlayerId(currentDialogueId, value as ID)
                  }
                  options={playerOptions}
                  placeholder="Seleccionar player"
                  disabled={!playerOptions.length}
                  className="w-full"
                  buttonClassName="border-2 border-emerald-800 bg-slate-900/30"
                  menuClassName="border-emerald-800/60"
                />
              </div>

              <div className="space-y-1">
                <div>NPC</div>
                <Select<string>
                  value={dialogueDraft.npcId}
                  onChange={(value) =>
                    value && setDialogueNpcId(currentDialogueId, value as ID)
                  }
                  options={npcOptions}
                  placeholder="Seleccionar NPC"
                  disabled={!npcOptions.length}
                  className="w-full"
                  buttonClassName="border-2 border-sky-800 bg-slate-900/30"
                  menuClassName="border-sky-800/60"
                />
              </div>

              <div className="px-2 py-4 space-y-2">
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-add-condition text-[13px]"
                      onClick={() => setDialogueConditionOpen(true)}
                    >
                      {dialogueDraft.when ? "Editar condición" : "+ Añadir condición"}
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

          {/* Columna derecha */}
          <section className="min-h-0 flex flex-col">
            <div className="flex items-center justify-center gap-3 border-b-2 border-slate-700 px-5 py-4 shrink-0">
              <div className="min-w-0">
                <div className="text-center text-base font-semibold text-slate-100 truncate">
                  {dialogueDraft.title?.trim() || "Editor de diálogo"}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 p-4 overflow-y-auto editor-scroll space-y-4">
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
                onReorderSiblings={(parentId, fromIndex, toIndex) => reorderDialogueLines(currentDialogueId, parentId, fromIndex, toIndex)}
              />
            </div>
          </section>
        </div>

        {/* Footer */}
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
              className="btn btn-create border-fuchsia-600 bg-fuchsia-900 hover:bg-fuchsia-700 font-normal text-[12px]"
              onClick={onCommit}
            >
              Guardar diálogo
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Modal de condición del diálogo */}
      <ConditionBuilderModal
        open={dialogueConditionOpen}
        project={liveProject}
        currentNodeId={nodeId}
        value={dialogueDraft.when ?? null}
        title="Condición del diálogo"
        onClose={() => setDialogueConditionOpen(false)}
        onSave={(cond) => {
          setDialogueWhen(currentDialogueId, cond);
          setDialogueConditionOpen(false);
        }}
        onApply={(cond) => {setDialogueWhen(currentDialogueId, cond);}}
      />

      {/* Modal de regla de línea */}
      {lineRuleOpen && lineRuleOwner && lineRuleValue ? (
        <RuleBuilderModal
          open={lineRuleOpen}
          project={liveProject}
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