import type React from "react";
import type { ID, Hotspot, HotspotInteraction, Effect, FreeHotspotEffectType } from "@/domain/types";
import type { SceneValidationIssue } from "@/features/editor/validation/sceneValidator";
import { ToggleFieldBlock } from "@/features/editor/components/scene/SceneFieldBlocks";
import { PlusCircleIcon, TrashIcon, PencilSquareIcon } from "@heroicons/react/24/outline";

interface SceneHotspotFieldProps {
  label?: string;
  active: boolean;
  onToggle: () => void;

  hotspots: Hotspot[];
  canBindTargets: boolean;
  availableNodesByHotspotId: Map<ID, { id: ID; title?: string }[]>;

  onChangeAction: (hotspotId: ID, actionType: FreeHotspotEffectType) => void;
  onChangeTarget: (hotspotId: ID, targetNodeId: ID) => void;

  onStartDrawing: (hotspotId: ID) => void;
  activeDrawingHotspotId: ID | null;

  onRemoveHotspot: (hotspotId: ID) => void;
  onAddHotspot: () => void;

  hotspotErrors?: SceneValidationIssue[];

  noScenesMessage: string;
  hotspotsWithoutScenesMessage?: string;
  emptyHotspotsMessage?: string;

  resolveNodeLabel?: (nodeId: ID) => string | undefined;

  selectPlaceholderWhenActive?: string;
  selectPlaceholderWhenDisabled?: string;

  hasImage: boolean;

  focusedHotspotId: ID | null;
  onFocusHotspot: (hotspotId: ID) => void;
  onClearFocus?: () => void;
}

const ACTION_LABEL: Record<FreeHotspotEffectType, string> = {
  goToNode: "Ir a otra escena",
  setFlag: "Cambiar flag",
  showText: "Mostrar texto",
  showMessage: "Mostrar mensaje",
};

const ACTION_TYPES: FreeHotspotEffectType[] = ["goToNode", "setFlag", "showText", "showMessage"];

function getPrimaryInteraction(hs: Hotspot): HotspotInteraction | undefined {
  return hs.interactions?.[0];
}

function getPrimaryEffect(hs: Hotspot): Effect | undefined {
  return getPrimaryInteraction(hs)?.effects?.[0];
}

function isGoToNodeEffect(e?: Effect): e is Extract<Effect, { type: "goToNode" }> {
  return !!e && e.type === "goToNode";
}

export function SceneHotspotField({ label = "Hotspots", active, onToggle, hotspots, canBindTargets, availableNodesByHotspotId,
  onChangeAction, onChangeTarget, onStartDrawing, activeDrawingHotspotId, onRemoveHotspot, onAddHotspot, hotspotErrors, noScenesMessage,
  hotspotsWithoutScenesMessage, emptyHotspotsMessage, resolveNodeLabel, selectPlaceholderWhenActive = "Selecciona destino…",
  selectPlaceholderWhenDisabled = "No hay escenas disponibles", hasImage, focusedHotspotId, onFocusHotspot, onClearFocus }: SceneHotspotFieldProps) {

  const hasAnyGoToNode = hotspots.some((hs) => isGoToNodeEffect(getPrimaryEffect(hs)));
  const showImageRequiredWarning = hasAnyGoToNode && !hasImage;

  const lastHotspot = hotspots.length > 0 ? hotspots[hotspots.length - 1] : null;

  const lastPrimaryEffect = lastHotspot ? getPrimaryEffect(lastHotspot) : undefined;
  const lastActionType = (lastPrimaryEffect?.type ?? "") as FreeHotspotEffectType | "";

  const lastGo = lastHotspot && isGoToNodeEffect(lastPrimaryEffect) ? lastPrimaryEffect : undefined;
  const lastTargetOk = !!(lastGo?.targetNodeId && String(lastGo.targetNodeId).trim().length > 0);

  const lastShapeOk = !!lastHotspot?.shape;

  const isLastValid = !lastHotspot
    ? true
    : lastActionType === "goToNode"
      ? hasImage && (!canBindTargets || lastTargetOk) && lastShapeOk
      : !!lastActionType;

  const canAddHotspot = isLastValid;
  const addDisabledReason = !isLastValid
    ? "Completa el hotspot anterior (acción, destino si aplica, y zona si procede) antes de añadir otro."
    : "";

  return (
    <>
      <ToggleFieldBlock
        label={label}
        active={active}
        onToggle={() => {
          if (active) onClearFocus?.();
          onToggle();
        }}
      >
        <div className="pt-2 space-y-2 text-left" onClick={() => onClearFocus?.()}>
          {!canBindTargets && (
            <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
              <p className="text-[11px] text-slate-400">
                {hotspots.length === 0 ? noScenesMessage : (hotspotsWithoutScenesMessage ?? noScenesMessage)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Puedes crear hotspots igualmente; cuando existan escenas destino podrás asignarlas aquí.
              </p>
            </div>
          )}

          {showImageRequiredWarning && (
            <div className="rounded-md border border-amber-700/40 bg-amber-900/10 px-3 py-2">
              <p className="text-[11px] text-amber-200">
                Para dibujar hotspots debes <span className="font-semibold">cargar una imagen</span>.
              </p>
            </div>
          )}

          {hotspots.length === 0 && emptyHotspotsMessage && (
            <p className="text-xs text-slate-400">{emptyHotspotsMessage}</p>
          )}

          {hotspots.length > 0 && (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              {hotspots.map((hs, index) => {
                const primaryEffect = getPrimaryEffect(hs);
                const firstActionType = (primaryEffect?.type ?? "") as FreeHotspotEffectType | "";

                const isGoTo = isGoToNodeEffect(primaryEffect);
                const currentTargetId: ID | "" = isGoTo ? (primaryEffect.targetNodeId as ID) : "";

                const availableNodes = availableNodesByHotspotId.get(hs.id) ?? [];
                const hasCurrentInAvailable = !!currentTargetId && availableNodes.some((n) => n.id === currentTargetId);

                const resolvedLabel = (currentTargetId && resolveNodeLabel?.(currentTargetId)) ?? currentTargetId;

                const isDrawingThis = activeDrawingHotspotId === hs.id;
                const showTargetSelect = firstActionType === "goToNode";

                const canEditZone = showTargetSelect && !!currentTargetId && hasImage;

                const disabledReason = !showTargetSelect
                  ? "Selecciona primero la acción"
                  : !currentTargetId
                    ? "Selecciona un destino"
                    : !hasImage
                      ? "Carga una imagen para poder dibujar"
                      : "No hay escenas disponibles";

                const isExpanded = focusedHotspotId === hs.id;

                return (
                  <div
                    key={hs.id}
                    className={[
                      "rounded-md border border-slate-800 bg-slate-950/40 p-2 select-none",
                      isDrawingThis ? "ring-1 ring-fuchsia-600/60" : "",
                      !isDrawingThis && isExpanded ? "ring-1 ring-sky-500/40" : "",
                    ].join(" ")}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFocusHotspot(hs.id);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onFocusHotspot(hs.id);
                      }
                      if (e.key === "Escape") onClearFocus?.();
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">Hotspot {index + 1}</span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartDrawing(hs.id);
                          }}
                          disabled={!canEditZone}
                          className={[
                            "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px]",
                            canEditZone
                              ? isDrawingThis
                                ? "bg-fuchsia-700/30 border-fuchsia-500 text-slate-100"
                                : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200"
                              : "bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed",
                          ].join(" ")}
                          title={canEditZone ? (isDrawingThis ? "Dibujando…" : "Editar zona (redibujar)") : disabledReason}
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveHotspot(hs.id);
                            if (focusedHotspotId === hs.id) onClearFocus?.();
                          }}
                          className="p-1 rounded-md bg-slate-800 hover:bg-red-700/70 text-slate-300 hover:text-white"
                          title="Eliminar hotspot"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {!isExpanded ? (
                      <div className="mt-2 text-[11px] text-slate-400">
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            {firstActionType ? `Acción: ${ACTION_LABEL[firstActionType]}` : "Acción: (sin seleccionar)"}
                          </span>

                          <span className="text-slate-500">
                            {showTargetSelect
                              ? currentTargetId
                                ? `Destino: ${resolvedLabel || currentTargetId}`
                                : "Destino: (sin seleccionar)"
                              : ""}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1">
                          <div className="text-[10px] text-slate-400">Acción</div>
                          <select
                            value={firstActionType}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                              onChangeAction(hs.id, e.target.value as FreeHotspotEffectType)
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                          >
                            <option value="">Selecciona acción…</option>
                            {ACTION_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {ACTION_LABEL[t]}
                              </option>
                            ))}
                          </select>
                        </div>

                        {showTargetSelect && (
                          <div className="space-y-1">
                            <div className="text-[10px] text-slate-400">Destino</div>
                            <select
                              value={currentTargetId}
                              disabled={!canBindTargets}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                onChangeTarget(hs.id, e.target.value as ID)
                              }
                              className="w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 disabled:bg-slate-900 disabled:text-slate-500"
                            >
                              <option value="">
                                {canBindTargets ? selectPlaceholderWhenActive : selectPlaceholderWhenDisabled}
                              </option>

                              {currentTargetId && !hasCurrentInAvailable && (
                                <option value={currentTargetId}>{resolvedLabel || currentTargetId}</option>
                              )}

                              {availableNodes.map((node) => (
                                <option key={node.id} value={node.id}>
                                  {node.title || node.id}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!canAddHotspot) return;
              onAddHotspot();
            }}
            disabled={!canAddHotspot}
            title={!canAddHotspot ? addDisabledReason : "Añadir hotspot"}
            className={["scene-hotspot-add-btn", !canAddHotspot ? "opacity-50 cursor-not-allowed" : ""].join(" ")}
          >
            <PlusCircleIcon className="w-3.5 h-3.5" />
            Añadir hotspot
          </button>
        </div>
      </ToggleFieldBlock>

      {hotspotErrors && hotspotErrors.length > 0 && (
        <div className="mt-1 space-y-1">
          {hotspotErrors.map((err, index) => (
            <p key={`${err.code}-${index}`} className="form-field-error">
              {err.message}
            </p>
          ))}
        </div>
      )}
    </>
  );
}