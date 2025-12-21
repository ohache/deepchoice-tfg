import type React from "react";
import { PlusCircleIcon, TrashIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import type { ID } from "@/domain/types";
import { ToggleFieldBlock } from "@/features/editor/components/scene/SceneFieldBlocks";
import type { SceneEntityViewModel, EntityKind } from "@/features/editor/components/scene/sceneEntityTypes";
import type { SceneValidationIssue } from "@/features/editor/validation/sceneValidator";

interface EntityTypeOption {
  value: EntityKind;
  label: string;
}

interface SceneEntityFieldProps {
  label?: string;
  active: boolean;
  onToggle: () => void;

  entityTypeOptions: EntityTypeOption[];
  entities: SceneEntityViewModel[];

  getResourcesForKind: (kind: EntityKind | "") => { id: ID; label: string }[];

  isAdding: boolean;
  newKind: EntityKind | "";
  newResourceId: ID | "";
  resourcesForNewKind: { id: ID; label: string }[];
  localError?: string | null;

  onStartAdd: () => void;
  onCancelAdd: () => void;
  onConfirmAdd: () => void;
  onNewKindChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onNewResourceChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;

  onExistingEntityResourceChange?: (entity: SceneEntityViewModel, newResourceId: ID) => void;
  onRemoveEntity: (entity: SceneEntityViewModel) => void;
  onRequestPlace: (kind: EntityKind, resourceId: ID) => void;
  onRequestEdit: (kind: EntityKind, instanceId: ID) => void;

  canPlaceOnScene?: boolean;
  placeDisabledReason?: string;

  itemErrors?: SceneValidationIssue[];
  npcErrors?: SceneValidationIssue[];
}

export function SceneEntityField({ label = "Entidades en escena", active, onToggle, entityTypeOptions, entities, getResourcesForKind, isAdding,
  newKind, newResourceId, resourcesForNewKind, localError, onStartAdd, onCancelAdd, onConfirmAdd, onNewKindChange, onNewResourceChange,
  onExistingEntityResourceChange, onRemoveEntity, onRequestPlace, onRequestEdit, canPlaceOnScene = true,
  placeDisabledReason = "Carga una imagen para poder dibujar/colocar.", itemErrors, npcErrors }: SceneEntityFieldProps) {
    
  return (
    <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
      <div className="pt-2 space-y-2 text-left text-xs text-slate-200">
        {entities.length === 0 ? (
          <p className="text-xs text-slate-400">Aún no hay ítems/PNJs colocados en esta escena.</p>
        ) : (
          <div className="space-y-2">
            {entities.map((ent, idx) => {
              const resources = getResourcesForKind(ent.kind);
              const hasCurrent = !!resources.find((r) => r.id === ent.resourceId);

              const kindLabel = entityTypeOptions.find((t) => t.value === ent.kind)?.label ?? ent.kind;
              const rowKey = `${ent.kind}-${ent.instanceId}`;

              const handlePlaceOrEdit = () => {
                if (!canPlaceOnScene) return;
                // Si ya existe instancia, siempre editamos su zona
                onRequestEdit(ent.kind, ent.instanceId);
              };

              return (
                <div
                  key={rowKey}
                  className="flex items-center gap-2 py-1 px-2 rounded-md bg-slate-900 border border-slate-700"
                >
                  <span className="text-[11px] text-slate-400 min-w-20">
                    {idx + 1}. {kindLabel}
                  </span>

                  <select
                    value={ent.resourceId}
                    onChange={(e) => onExistingEntityResourceChange?.(ent, e.target.value as ID)}
                    disabled={!onExistingEntityResourceChange}
                    className={[
                      "flex-1 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100",
                      "focus:outline-none focus:ring-1 focus:ring-fuchsia-500",
                      !onExistingEntityResourceChange ? "disabled:bg-slate-900 disabled:text-slate-500" : "",
                    ].join(" ")}
                  >
                    {!hasCurrent && (
                      <option value={ent.resourceId}>{ent.label} (ya no existe en Historia)</option>
                    )}

                    {resources.length === 0 ? (
                      <option value="">No hay recursos de este tipo</option>
                    ) : (
                      resources.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={handlePlaceOrEdit}
                    disabled={!canPlaceOnScene}
                    className={[
                      "p-1 rounded-md border text-slate-300",
                      canPlaceOnScene
                        ? "bg-slate-800 hover:bg-slate-700 border-slate-700"
                        : "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed",
                    ].join(" ")}
                    title={canPlaceOnScene ? "Editar zona (redibujar)" : placeDisabledReason}
                  >
                    <PencilSquareIcon className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onRemoveEntity(ent)}
                    className="p-1 rounded-md bg-slate-800 hover:bg-red-700/70 text-slate-300 hover:text-white"
                    title="Eliminar de la escena"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Añadir */}
        {isAdding ? (
          <div className="mt-2 space-y-2 border border-dashed border-slate-600 rounded-md p-2 bg-slate-950/70">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-300">Tipo</label>
              <select
                value={newKind}
                onChange={onNewKindChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
              >
                <option value="">Selecciona tipo…</option>
                {entityTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-300">Recurso</label>
              <select
                value={newResourceId}
                onChange={onNewResourceChange}
                disabled={!newKind || resourcesForNewKind.length === 0}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 disabled:bg-slate-900 disabled:text-slate-500"
              >
                {!newKind && <option value="">Primero elige un tipo…</option>}

                {newKind && resourcesForNewKind.length === 0 && (
                  <option value="">No hay recursos de este tipo en el proyecto</option>
                )}

                {newKind && resourcesForNewKind.length > 0 && (
                  <>
                    <option value="">Selecciona recurso…</option>
                    {resourcesForNewKind.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {itemErrors && itemErrors.length > 0 && (
              <div className="mt-1 space-y-1">
                {itemErrors.map((err, idx) => (
                  <p key={`${err.code}-${idx}`} className="form-field-error">
                    🎁 {err.message}
                  </p>
                ))}
              </div>
            )}

            {npcErrors && npcErrors.length > 0 && (
              <div className="mt-1 space-y-1">
                {npcErrors.map((err, idx) => (
                  <p key={`${err.code}-${idx}`} className="form-field-error">
                    🧍 {err.message}
                  </p>
                ))}
              </div>
            )}

            {localError && <p className="form-field-error mt-1">{localError}</p>}

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={onCancelAdd}
                className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-[11px] text-slate-100"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!newKind || !newResourceId) return;
                  if (!canPlaceOnScene) return;

                  // UX: al añadir entidad, normalmente queremos colocarla ya
                  onRequestPlace(newKind, newResourceId as ID);
                  onCancelAdd();
                }}
                disabled={!canPlaceOnScene || !newKind || !newResourceId}
                className={[
                  "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px]",
                  canPlaceOnScene
                    ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                    : "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed",
                ].join(" ")}
                title={canPlaceOnScene ? "Añadir y colocar en la escena" : placeDisabledReason}
              >
                <PencilSquareIcon className="w-3.5 h-3.5" />
                Colocar
              </button>

              <button
                type="button"
                onClick={onConfirmAdd}
                className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={onStartAdd} className="scene-hotspot-add-btn mt-1">
            <PlusCircleIcon className="w-3.5 h-3.5" />
            Añadir entidad
          </button>
        )}
      </div>
    </ToggleFieldBlock>
  );
}
