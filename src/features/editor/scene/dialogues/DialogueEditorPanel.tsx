import type { ID, Dialogue, DialogueLineNode, DialogueNode, PlayerDef, NpcDef } from "@/domain/types";
import { Select, type Option } from "@/components/Select";
import { Pencil, Plus, Trash2 } from "lucide-react";

type DialogueEditorPanelProps = {
  dialogueDraft: Dialogue | null;
  lineDraft: DialogueLineNode | null;

  selectedCatalogPlayerId: string;
  selectedCatalogNpcId: string;
  createTitle: string;

  projectPlayers: PlayerDef[];
  projectNpcs: NpcDef[];

  panelError?: string | null;

  onSelectedCatalogPlayerIdChange: (playerId: string) => void;
  onSelectedCatalogNpcIdChange: (npcId: string) => void;
  onCreateTitleChange: (title: string) => void;
  onStartCreating: () => void;

  onDialogueTitleChange: (value: string) => void;
  onDialogueDescriptionChange: (value: string) => void;
  onDialoguePlayerChange: (playerId: ID) => void;
  onDialogueNpcChange: (npcId: ID) => void;

  onSelectLine: (lineId: ID) => void;
  onAddLine: () => void;
  onDeleteLine: (lineId: ID) => void;
  onUpdateLine: (lineId: ID, patch: Partial<DialogueLineNode>) => void;

  onEditDialogueCondition?: () => void;
  onClearDialogueCondition?: () => void;
  onEditLineRule?: (lineId: ID) => void;
  onClearLineRule?: (lineId: ID) => void;

  onDeleteDialogue: () => void;
  onCancel: () => void;
  onCommit: () => void;
};

function isLineNode(node: DialogueNode): node is DialogueLineNode {
  return node.type === "line";
}

function hasLineRule(line: DialogueLineNode): boolean {
  return Boolean(line.when) || Boolean((line.effects?.length ?? 0) > 0);
}

export function DialogueEditorPanel({ dialogueDraft, lineDraft, selectedCatalogPlayerId, selectedCatalogNpcId, createTitle, projectPlayers, projectNpcs, panelError,
  onSelectedCatalogPlayerIdChange, onSelectedCatalogNpcIdChange, onCreateTitleChange, onStartCreating, onDialogueTitleChange, onDialogueDescriptionChange,
  onDialoguePlayerChange, onDialogueNpcChange, onSelectLine, onAddLine, onDeleteLine, onUpdateLine, onEditDialogueCondition, onClearDialogueCondition,
  onEditLineRule, onClearLineRule, onDeleteDialogue, onCancel, onCommit }: DialogueEditorPanelProps) {
  const playerOptions: Option<string>[] = projectPlayers.map((player) => ({
    id: player.id,
    label: player.name || player.id,
  }));

  const npcOptions: Option<string>[] = projectNpcs.map((npc) => ({
    id: npc.id,
    label: npc.name || npc.id,
  }));

  const lineNodes = (dialogueDraft?.nodes ?? []).filter(isLineNode);

  const lineOptions: Option<string>[] = lineNodes.map((line, index) => ({
    id: line.id,
    label: `${index + 1}. ${line.text.trim() || "(sin texto)"}`,
  }));

  if (!dialogueDraft) {
    return (
      <div className="bg-slate-950/40 p-1 space-y-3">
        <div className="rounded-md border border-slate-700 bg-slate-950/20 px-3 py-3 space-y-3">
          <div className="text-xs text-slate-200 text-center">
            Selecciona un player y un NPC para crear un diálogo
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-100">Player</div>
            <Select<string>
              value={selectedCatalogPlayerId}
              onChange={onSelectedCatalogPlayerIdChange}
              options={playerOptions}
              placeholder="Seleccionar player"
              disabled={!projectPlayers.length}
              className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-100">NPC</div>
            <Select<string>
              value={selectedCatalogNpcId}
              onChange={onSelectedCatalogNpcIdChange}
              options={npcOptions}
              placeholder="Seleccionar NPC"
              disabled={!projectNpcs.length}
              className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-100">Título</div>
            <input
              value={createTitle}
              onChange={(e) => onCreateTitleChange(e.currentTarget.value)}
              placeholder="Título del diálogo"
              className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
            />
          </div>

          <div className="flex justify-center">
            <button
              type="button"
              className="btn btn-create text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={onStartCreating}
              disabled={!selectedCatalogPlayerId || !selectedCatalogNpcId}
            >
              Crear diálogo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/40 p-1 space-y-3">
      {panelError ? (
        <div className="rounded-md border border-red-500/40 bg-red-950/20 px-2 py-1 text-[11px] text-red-100">
          {panelError}
        </div>
      ) : null}

      <div className="rounded-md border border-slate-700 bg-slate-950/20 px-3 py-3 space-y-3">
        <div className="text-xs font-semibold text-slate-100">Diálogo</div>

        <div className="space-y-1">
          <div className="text-xs text-slate-100">Título</div>
          <input
            value={dialogueDraft.title ?? ""}
            onChange={(e) => onDialogueTitleChange(e.currentTarget.value)}
            placeholder="Título del diálogo"
            className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
          />
        </div>

        <div className="space-y-1">
          <div className="text-xs text-slate-100">Descripción</div>
          <textarea
            value={dialogueDraft.description ?? ""}
            onChange={(e) => onDialogueDescriptionChange(e.currentTarget.value)}
            placeholder="Descripción opcional"
            rows={3}
            className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="space-y-1">
            <div className="text-xs text-slate-100">Player</div>
            <Select<string>
              value={dialogueDraft.playerId}
              onChange={(value) => value && onDialoguePlayerChange(value as ID)}
              options={playerOptions}
              placeholder="Seleccionar player"
              disabled={!projectPlayers.length}
              className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-100">NPC</div>
            <Select<string>
              value={dialogueDraft.npcId}
              onChange={(value) => value && onDialogueNpcChange(value as ID)}
              options={npcOptions}
              placeholder="Seleccionar NPC"
              disabled={!projectNpcs.length}
              className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="rounded-md border border-slate-800 bg-slate-950/20 px-2 py-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-slate-300">Condición del diálogo</div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn border-2 border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-[11px]"
                onClick={onEditDialogueCondition}
              >
                {dialogueDraft.when ? "Editar condición" : "Añadir condición"}
              </button>

              {dialogueDraft.when ? (
                <button
                  type="button"
                  className="btn border-2 border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/50 text-rose-100 text-[11px]"
                  onClick={onClearDialogueCondition}
                >
                  Quitar
                </button>
              ) : null}
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            {dialogueDraft.when
              ? "El diálogo tiene una condición configurada."
              : "El diálogo no tiene condición."}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-slate-700 bg-slate-950/20 px-3 py-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-100">Líneas</div>

          <button
            type="button"
            className="btn btn-select text-[11px]"
            onClick={onAddLine}
          >
            <Plus className="w-4 h-4" />
            Añadir línea
          </button>
        </div>

        {!lineNodes.length ? (
          <div className="text-[11px] text-slate-400 text-center">Aún no hay líneas.</div>
        ) : (
          <div className="space-y-2">
            {lineNodes.map((line, index) => {
              const isSelected = lineDraft?.id === line.id;

              return (
                <div
                  key={line.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectLine(line.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectLine(line.id);
                    }
                  }}
                  className={`rounded-md border px-3 py-2 cursor-pointer select-none ${
                    isSelected
                      ? "border-fuchsia-500/50 bg-slate-950/60"
                      : "border-slate-700 bg-slate-950/30"
                  } hover:bg-fuchsia-900/20`}
                  title="Editar línea"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-100 truncate">
                        {line.text.trim() || `Línea ${index + 1}`}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {line.speaker.toUpperCase()}
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn border-2 border-slate-700 bg-slate-800 hover:bg-slate-700 text-white p-1"
                        onClick={() => onSelectLine(line.id)}
                        title="Editar"
                        aria-label="Editar línea"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        className="btn border-2 border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/50 text-rose-100 p-1"
                        onClick={() => onDeleteLine(line.id)}
                        title="Eliminar línea"
                        aria-label="Eliminar línea"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lineDraft ? (
        <div className="space-y-3">
          <div className="rounded-md border border-slate-700 bg-slate-950/20 px-3 py-3 space-y-3">
            <div className="text-xs font-semibold text-slate-100">Línea activa</div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <div className="space-y-1">
                <div className="text-[11px] text-slate-300">Speaker</div>
                <Select<string>
                  value={lineDraft.speaker}
                  onChange={(value) =>
                    value &&
                    onUpdateLine(lineDraft.id, {
                      speaker: value as DialogueLineNode["speaker"],
                    })
                  }
                  options={[
                    { id: "npc", label: "NPC" },
                    { id: "player", label: "Player" },
                  ]}
                  placeholder="Speaker"
                  className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>

              <div className="space-y-1 md:col-span-3">
                <div className="text-[11px] text-slate-300">Texto</div>
                <input
                  value={lineDraft.text}
                  onChange={(e) =>
                    onUpdateLine(lineDraft.id, { text: e.currentTarget.value })
                  }
                  placeholder="Texto de la línea"
                  className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] text-slate-300">Hijos</div>
              <Select<string>
                value=""
                onChange={() => {}}
                options={lineOptions.filter((line) => line.id !== lineDraft.id)}
                placeholder="La edición del árbol se redefinirá en el siguiente paso"
                disabled
                className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-500 focus:outline-none"
              />
              <div className="text-[11px] text-slate-500">
                La edición de childrenIds la simplificamos en el siguiente paso.
              </div>
            </div>

            <div className="rounded-md border border-slate-800 bg-slate-950/20 px-2 py-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] text-slate-300">Regla de la línea</div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn border-2 border-slate-700 bg-slate-800 hover:bg-slate-700 text-white text-[11px]"
                    onClick={() => onEditLineRule?.(lineDraft.id)}
                  >
                    {hasLineRule(lineDraft) ? "Editar regla" : "Añadir regla"}
                  </button>

                  {hasLineRule(lineDraft) ? (
                    <button
                      type="button"
                      className="btn border-2 border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/50 text-rose-100 text-[11px]"
                      onClick={() => onClearLineRule?.(lineDraft.id)}
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="text-[11px] text-slate-400">
                {hasLineRule(lineDraft)
                  ? `Condición: ${lineDraft.when ? "sí" : "no"} · Efectos: ${lineDraft.effects?.length ?? 0}`
                  : "La línea no tiene condición ni efectos."}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-slate-700 bg-slate-950/20 px-3 py-3 text-[11px] text-slate-400 text-center">
          Selecciona o crea una línea para editarla.
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-danger text-[11px]"
            onClick={onDeleteDialogue}
            title="Eliminar diálogo"
          >
            Eliminar
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-cancel text-[11px]"
            onClick={onCancel}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="btn btn-create text-[11px]"
            onClick={onCommit}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}