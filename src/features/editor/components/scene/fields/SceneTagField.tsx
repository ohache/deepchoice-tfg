import type React from "react";
import { PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { ID } from "@/domain/types";
import type { SceneValidationIssue } from "@/features/editor/validation/sceneValidator";
import type { TagKind, SceneTagViewModel } from "@/features/editor/components/scene/sceneTagTypes";
import { ToggleFieldBlock } from "@/features/editor/components/scene/SceneFieldBlocks";

interface TagTypeOption {
  value: TagKind;
  label: string;
}

interface SceneTagFieldProps {
  label?: string;
  active: boolean;
  onToggle: () => void;

  tagTypeOptions: TagTypeOption[];
  sceneTags: SceneTagViewModel[];

  getItemsForTagType: (type: TagKind | "") => { id: ID; label: string }[];

  isAddingTag: boolean;
  newTagType: TagKind | "";
  newTagId: ID | "";
  itemsForNewTagType: { id: ID; label: string }[];
  tagLocalError?: string | null;

  onStartAddTag: () => void;
  onCancelAddTag: () => void;
  onConfirmAddTag: () => void;
  onNewTagTypeChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onNewTagValueChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;

  onExistingTagChange: (tag: SceneTagViewModel, newResourceId: ID) => void;
  onRemoveTag: (tag: SceneTagViewModel) => void;

  musicError?: SceneValidationIssue;
  mapError?: SceneValidationIssue;
}

export function SceneTagField({ label = "Etiquetas", active, onToggle, tagTypeOptions, sceneTags, getItemsForTagType,
  isAddingTag, newTagType, newTagId, itemsForNewTagType, tagLocalError, onStartAddTag, onCancelAddTag, onConfirmAddTag,
  onNewTagTypeChange, onNewTagValueChange, onExistingTagChange, onRemoveTag, musicError, mapError }: SceneTagFieldProps) {
    
  return (
    <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
      <div className="pt-2 space-y-2 text-left text-xs text-slate-200">
        {sceneTags.length === 0 ? (
          <p className="text-xs text-slate-400">Aún no hay etiquetas asociadas a esta escena.</p>
        ) : (
          <div className="space-y-2">
            {sceneTags.map((tag, idx) => {
              const itemsForKind = getItemsForTagType(tag.kind);

              const currentResourceId = tag.resourceId;
              const hasCurrent = !!itemsForKind.find((it) => it.id === currentResourceId);

              const kindLabel = tagTypeOptions.find((t) => t.value === tag.kind)?.label ?? tag.kind;
              const rowKey = `${tag.kind}-${tag.resourceId}`;

              return (
                <div
                  key={rowKey}
                  className="flex items-center gap-2 py-1 px-2 rounded-md bg-slate-900 border border-slate-700"
                >
                  <span className="text-[11px] text-slate-400 min-w-20">
                    {idx + 1}. {kindLabel}
                  </span>

                  <select
                    value={currentResourceId}
                    onChange={(e) => onExistingTagChange(tag, e.target.value as ID)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                  >
                    {!hasCurrent && (
                      <option value={currentResourceId}>{tag.label} (ya no existe en Historia)</option>
                    )}

                    {itemsForKind.length === 0 ? (
                      <option value="">No hay recursos de este tipo</option>
                    ) : (
                      itemsForKind.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    className="p-1 rounded-md bg-slate-800 hover:bg-red-700/70 text-slate-300 hover:text-white"
                    title="Eliminar etiqueta"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Añadir */}
        {isAddingTag ? (
          <div className="mt-2 space-y-2 border border-dashed border-slate-600 rounded-md p-2 bg-slate-950/70">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-300">Tipo de etiqueta</label>
              <select
                value={newTagType}
                onChange={onNewTagTypeChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
              >
                <option value="">Selecciona tipo…</option>
                {tagTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-300">Recurso</label>
              <select
                value={newTagId}
                onChange={onNewTagValueChange}
                disabled={!newTagType || itemsForNewTagType.length === 0}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 disabled:bg-slate-900 disabled:text-slate-500"
              >
                {!newTagType && <option value="">Primero elige un tipo de etiqueta…</option>}

                {newTagType && itemsForNewTagType.length === 0 && (
                  <option value="">No hay recursos de este tipo en el proyecto</option>
                )}

                {newTagType && itemsForNewTagType.length > 0 && (
                  <>
                    <option value="">Selecciona recurso…</option>
                    {itemsForNewTagType.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {musicError && <p className="form-field-error mt-1">🎵 {musicError.message}</p>}
            {mapError && <p className="form-field-error mt-1">🗺️ {mapError.message}</p>}
            {tagLocalError && <p className="form-field-error mt-1">{tagLocalError}</p>}

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={onCancelAddTag}
                className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-[11px] text-slate-100"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={onConfirmAddTag}
                className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={onStartAddTag} className="scene-hotspot-add-btn mt-1">
            <PlusCircleIcon className="w-3.5 h-3.5" />
            Añadir etiqueta
          </button>
        )}
      </div>
    </ToggleFieldBlock>
  );
}
