import { useEffect, useMemo, useState } from "react";
import type { ID, Project } from "@/domain/types";
import type { TextTokenKind } from "@/features/editor/scene/textTokens/tokenFormat";
import { buildMapRegionToken, buildNameToken, buildVarToken } from "@/features/editor/scene/textTokens/tokenFormat";
import { buildTokenCatalog } from "@/features/editor/scene/textTokens/tokenCatalog";

type Props = {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onInsert: (token: string) => void;
};

const KINDS: Array<{ id: TextTokenKind; label: string }> = [
  { id: "players", label: "Jugadores" },
  { id: "npcs", label: "NPCs" },
  { id: "items", label: "Items" },
  { id: "maps", label: "Mapas" },
  { id: "music", label: "Música" },
];

export function InsertTextTokenModal({ open, project, onClose, onInsert }: Props) {
  const catalog = useMemo(() => buildTokenCatalog(project), [project]);

  const [kind, setKind] = useState<TextTokenKind>("players");
  const [entityId, setEntityId] = useState<ID | null>(null);

  const entities = catalog[kind] ?? [];

  const selected = useMemo(() => (entityId ? entities.find((entity) => entity.id === entityId) ?? null : null), [entities, entityId]);

  const canUseVars = kind === "players" || kind === "npcs";
  const vars = selected && canUseVars ? selected.vars ?? [] : [];

  const canUseRegions = kind === "maps";
  const regions = selected && canUseRegions ? selected.regions ?? [] : [];

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

  const handleInsertRegion = (regionId: ID) => {
    if (!selected) return;
    if (kind !== "maps") return;

    onInsert(buildMapRegionToken(selected.id, regionId));
    onClose();
  };

  const hasSelectedEntity = Boolean(selected);
  const showVarsBlock = canUseVars && hasSelectedEntity && vars.length > 0;
  const showRegionsBlock = canUseRegions && hasSelectedEntity && regions.length > 0;

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center" role="dialog" aria-modal="true">
      {/* Fondo oscurecido que también cierra el modal */}
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Cerrar"
      />

      {/* Caja principal del modal */}
      <div className="relative w-[92%] max-w-[760px] rounded-xl border-2 border-slate-700 bg-slate-950 p-4 shadow-xl">
        <div className="border-b-2 border-slate-800 pb-3 text-center">
          <h3 className="text-base font-semibold text-slate-50">Insertar dato dinámico</h3>
        </div>

        {/* Selector de tipo */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
          {KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setKind(item.id);
                setEntityId(null);
              }}
              className={"rounded-md border px-3 py-1.5 text-[12px] transition-colors " +
                (kind === item.id
                  ? "border-fuchsia-500 bg-fuchsia-950/40 text-white"
                  : "border-slate-500 bg-slate-900/65 text-white hover:bg-fuchsia-950 hover:border-fuchsia-700")}
              aria-pressed={kind === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Contenido principal */}
        <div className="grid h-[420px] grid-cols-1 gap-3 pt-4 md:grid-cols-2">
          {/* Columna izquierda: entidades */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900/80">
            <div className="border-b border-slate-700 px-3 py-2 text-[13px] font-semibold text-slate-100">
              Elementos ({entities.length})
            </div>

            <div className="editor-scroll flex-1 min-h-0 overflow-auto space-y-1 p-3">
              {entities.length ? (
                entities.map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={() => setEntityId(entity.id)}
                    className={"w-full rounded-lg border py-1.5 text-center text-[13px] transition-colors mb-2 " +
                      (entityId === entity.id
                        ? "border-fuchsia-500 bg-fuchsia-600/15 text-white"
                        : "border-slate-600 bg-slate-900 text-slate-200 hover:border-slate-600/70 hover:bg-slate-800")}
                  >
                    <div className="font-semibold">{entity.name || "(Sin nombre)"}</div>
                  </button>
                ))
              ) : (
                <div className="px-2 py-2 text-xs text-slate-300">
                  No hay elementos de este tipo.
                </div>
              )}
            </div>
          </div>

          {/* Columna derecha: propiedades disponibles */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900/80">
            <div className="border-b border-slate-700 px-3 py-2 text-[13px] font-semibold text-slate-100">
              Propiedades
            </div>

            <div className="flex-1 min-h-0 p-3">
              {!hasSelectedEntity ? (
                <div className="flex h-full items-start justify-center px-6 py-1 text-center text-xs text-slate-300">
                  Selecciona un elemento para ver sus propiedades.
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col gap-3">
                  {/* Nombre de la entidad */}
                  <button
                    type="button"
                    onClick={handleInsertName}
                    className="w-full rounded-md border border-cyan-600 bg-cyan-900/30 px-3 py-2 text-[13px] text-white hover:bg-cyan-900"
                  >
                    Nombre
                  </button>

                  {/* Variables: solo players y npcs */}
                  {showVarsBlock ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-2">
                      <div className="text-[13px] font-semibold text-whtite">Variables</div>

                      <div className="editor-scroll flex-1 min-h-0 space-y-2 overflow-auto">
                        {vars.map((variable) => (
                          <button
                            key={variable.id}
                            type="button"
                            onClick={() => handleInsertVar(variable.id)}
                            className="w-full rounded-md border border-emerald-800 bg-emerald-950/40 py-1.5 text-center text-[12px] text-slate-200 hover:bg-emerald-900"
                          >
                            <div>{variable.name || "(Sin nombre)"}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Regiones: solo mapas */}
                  {showRegionsBlock ? (
                    <div className="flex min-h-0 flex-1 flex-col gap-2">
                      <div className="text-[12px] text-white font-semibold">Regiones</div>

                      <div className="editor-scroll flex-1 min-h-0 space-y-2 overflow-auto">
                        {regions.map((region) => (
                          <button
                            key={region.id}
                            type="button"
                            onClick={() => handleInsertRegion(region.id)}
                            className="w-full rounded-md border border-amber-800 bg-amber-950/40 px-2 py-1.5 text-center text-[12px] text-slate-200 hover:bg-amber-900"
                          >
                            <div>{region.name || "(Sin nombre)"}</div>
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

        {/* Pie */}
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="btn btn-cancel text-[12px]">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}