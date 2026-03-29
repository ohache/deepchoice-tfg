import { useEffect, useMemo, useState } from "react";
import type { ID, Project } from "@/domain/types";
import type { TextTokenKind } from "@/features/editor/scene/textTokens/tokenFormat";
import { buildNameToken, buildVarToken } from "@/features/editor/scene/textTokens/tokenFormat";
import { buildTokenCatalog } from "@/features/editor/scene/textTokens/tokenCatalog";

type Props = {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onInsert: (token: string) => void;
};

const KINDS: Array<{ id: TextTokenKind; label: string }> = [
  { id: "players", label: "Jugadores" },
  { id: "npcs", label: "PNJs" },
  { id: "items", label: "Items" },
  { id: "maps", label: "Mapas" },
  { id: "music", label: "Música" },
];

export function InsertTextTokenModal({ open, project, onClose, onInsert }: Props) {
  const catalog = useMemo(() => buildTokenCatalog(project), [project]);

  const [kind, setKind] = useState<TextTokenKind>("players");
  const [entityId, setEntityId] = useState<ID | null>(null);

  const entities = catalog[kind] ?? [];
  const selected = entityId ? entities.find((e) => e.id === entityId) ?? null : null;

  const canVars = kind === "players" || kind === "npcs";
  const vars = selected && canVars ? selected.vars ?? [] : [];

  useEffect(() => {
    if (!open) return;

    setKind("players");
    setEntityId(null);
  }, [open]);

  if (!open) return null;

  const handleInsertName = () => {
    if (!selected) return;
    onInsert(buildNameToken(kind, selected.id));
    onClose();
  };

  const handleInsertVar = (varId: ID) => {
    if (!selected) return;
    if (kind !== "players" && kind !== "npcs") return;

    onInsert(buildVarToken(kind, selected.id, varId));
    onClose();
  };

  const isPropsEnabled = Boolean(selected);
  const showVarsBlock = canVars && isPropsEnabled && vars.length > 0;

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center" role="dialog" aria-modal="true">
      {/* Overlay de cierre */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Cerrar"
      />

      {/* Contenedor del modal */}
      <div className="relative w-[92%] max-w-[760px] rounded-xl border-2 border-slate-700 bg-slate-950 p-4 shadow-xl">
        <div className="border-b border-slate-800 pb-3 text-center">
          <h3 className="text-base font-semibold text-slate-50">Insertar dato dinámico</h3>
        </div>

        {/* Tabs de tipos */}
        <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                setKind(k.id);
                setEntityId(null);
              }}
              className={ "px-3 py-1.5 rounded-md border text-[12px] transition-colors " +
                (kind === k.id
                  ? "border-fuchsia-500 bg-fuchsia-950/40 text-white"
                  : "border-slate-500 bg-slate-900/65 text-white hover:bg-slate-800")}
              aria-pressed={kind === k.id}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* Cuerpo */}
        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3 h-[420px]">
          {/* Lista de entidades */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/80 overflow-hidden flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-slate-700 text-[12px] text-slate-100 font-semibold">
              Elementos ({entities.length})
            </div>

            <div className="editor-scroll overflow-auto p-2 space-y-1 flex-1 min-h-0">
              {entities.length ? (
                entities.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setEntityId(e.id)}
                    className={ "w-full text-left px-2 py-1.5 text-[12px] rounded-lg border transition-colors " +
                      (entityId === e.id
                        ? "border-fuchsia-500 bg-fuchsia-600/15 text-white"
                        : "border-transparent bg-slate-900/40 text-slate-200 hover:bg-slate-800 hover:border-slate-600/70")}
                  >
                    <div className="font-semibold">{e.name || "(Sin nombre)"}</div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-300 px-2 py-2">
                  No hay elementos de este tipo.
                </div>
              )}
            </div>
          </div>

          {/* Propiedades disponibles */}
          <div className="rounded-lg border border-slate-700 bg-slate-900/80 overflow-hidden flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-slate-800 text-[12px] text-slate-100 font-semibold">
              Propiedades
            </div>

            <div className="p-3 flex-1 min-h-0">
              {!isPropsEnabled ? (
                <div className="h-full flex py-1 items-start justify-center text-xs text-slate-300 text-center px-6">
                  Selecciona un elemento para ver sus propiedades.
                </div>
              ) : (
                <div className="h-full flex flex-col gap-3 min-h-0">
                  {/* Nombre */}
                  <button
                    type="button"
                    onClick={handleInsertName}
                    className="w-full px-3 py-2 rounded-md border border-cyan-600 bg-cyan-900/30 hover:bg-cyan-800 text-[12px] font-semibold text-white"
                  >
                    Nombre
                  </button>

                  {/* Variables, solo para players y npcs */}
                  {showVarsBlock ? (
                    <div className="flex-1 min-h-0 flex flex-col gap-2">
                      <div className="text-[12px] text-slate-100">Variables</div>

                      <div className="editor-scroll overflow-auto space-y-2 flex-1 min-h-0">
                        {vars.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => handleInsertVar(v.id)}
                            className="w-full text-left px-2 py-1.5 rounded-md border border-emerald-800 bg-emerald-950/40 text-slate-200 hover:bg-emerald-900 text-[12px]"
                          >
                            <div className="font-semibold">{v.name || "(Sin nombre)"}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-cancel text-[12px]">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}