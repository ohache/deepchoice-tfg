import { useMemo } from "react";
import type { WorldMap, MapRegion, NodeMapLocation } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";

type SceneMapFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
};

export function SceneMapField({
  label = "Mapa",
  active,
  onToggle,
}: SceneMapFieldProps) {
  const project = useEditorStore((s) => s.project ?? null);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);
  const setNodeMapLocation = useEditorStore((s) => s.setNodeMapLocation);

  const maps = useMemo<WorldMap[]>(() => project?.maps ?? [], [project?.maps]);
  const nodes = useMemo(() => project?.nodes ?? [], [project?.nodes]);

  const selectedMapId = nodeDraft?.mapLocation?.mapId ?? "";
  const selectedRegionId = nodeDraft?.mapLocation?.regionId ?? "";
  const isEntry = Boolean(nodeDraft?.mapLocation?.isEntry);
  const currentNodeId = nodeDraft?.id ?? "";

  const selectedMap = useMemo(
    () => maps.find((map) => map.id === selectedMapId) ?? null,
    [maps, selectedMapId]
  );

  const regions = useMemo<MapRegion[]>(
    () => selectedMap?.regions ?? [],
    [selectedMap]
  );

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === selectedRegionId) ?? null,
    [regions, selectedRegionId]
  );

  const currentEntrySceneId = selectedRegion?.entrySceneId ?? "";
  const currentEntryScene =
    currentEntrySceneId
      ? nodes.find((node) => node.id === currentEntrySceneId) ?? null
      : null;

  const currentEntrySceneTitle =
    currentEntryScene?.title?.trim() || currentEntrySceneId || "";

  const regionSceneIds = selectedRegion?.sceneIds ?? [];
  const regionHasAnyAssignedScene = regionSceneIds.length > 0;
  const regionHasAssignedEntry = Boolean(currentEntrySceneId);

  const handleMapChange = (nextMapId: string) => {
    if (!nextMapId) {
      setNodeMapLocation(undefined);
      return;
    }

    const map = maps.find((m) => m.id === nextMapId) ?? null;
    const firstRegion = map?.regions?.[0] ?? null;

    if (!map || !firstRegion) {
      setNodeMapLocation(undefined);
      return;
    }

    const nextLoc: NodeMapLocation = {
      mapId: map.id,
      regionId: firstRegion.id,
      isEntry: false,
    };

    setNodeMapLocation(nextLoc);
  };

  const handleRegionChange = (nextRegionId: string) => {
    if (!selectedMapId || !nextRegionId) {
      setNodeMapLocation(undefined);
      return;
    }

    const nextLoc: NodeMapLocation = {
      mapId: selectedMapId,
      regionId: nextRegionId,
      isEntry: false,
    };

    setNodeMapLocation(nextLoc);
  };

  const handleEntryChange = (checked: boolean) => {
    if (!selectedMapId || !selectedRegionId) return;

    const nextLoc: NodeMapLocation = {
      mapId: selectedMapId,
      regionId: selectedRegionId,
      isEntry: checked,
    };

    setNodeMapLocation(nextLoc);
  };

  return (
    <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
      <div className="space-y-3">
        <div className="bg-slate-950/30 px-2 py-2">
          <div className="text-xs text-slate-300 text-center mb-2">
            Mapa asociado
          </div>

          <select
            value={selectedMapId}
            onChange={(e) => handleMapChange(e.target.value)}
            className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-amber-500"
          >
            <option value="">— Sin mapa —</option>
            {maps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>

          {!maps.length ? (
            <div className="mt-2 text-[11px] text-slate-400 text-center">
              No hay mapas creados en el proyecto.
            </div>
          ) : null}
        </div>

        <div className="bg-slate-950/30 px-2 py-2">
          <div className="text-xs text-slate-300 text-center mb-2">
            Región asociada
          </div>

          <select
            value={selectedRegionId}
            onChange={(e) => handleRegionChange(e.target.value)}
            disabled={!selectedMapId || !regions.length}
            className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <option value="">— Sin región —</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.label?.trim() || "(Sin etiqueta)"}
              </option>
            ))}
          </select>

          {selectedMapId && !regions.length ? (
            <div className="mt-2 text-[11px] text-slate-400 text-center">
              Este mapa no tiene regiones.
            </div>
          ) : null}
        </div>

        <div className="bg-slate-950/30 px-2 py-2 space-y-3">
          <div className="text-xs text-slate-300 text-center">
            Puerta de entrada
          </div>

          <label className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-slate-200">
              Esta escena es la entrada de la región
            </span>
            <input
              type="checkbox"
              checked={isEntry}
              disabled={!selectedMapId || !selectedRegionId}
              onChange={(e) => handleEntryChange(e.target.checked)}
            />
          </label>

          {selectedRegion ? (
            <div className="space-y-1">
              {!regionHasAnyAssignedScene ? (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-950/20 px-2 py-1 text-[11px] text-emerald-100 text-center">
                  Si esta es la primera escena asociada a la región, al guardar se convertirá automáticamente en su entrada.
                </div>
              ) : null}

              {regionHasAssignedEntry && currentEntrySceneId !== currentNodeId ? (
                <div className="rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300 text-center">
                  Entrada actual: <span className="text-slate-100 font-medium">{currentEntrySceneTitle}</span>
                </div>
              ) : null}

              {regionHasAssignedEntry && currentEntrySceneId === currentNodeId ? (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-950/20 px-2 py-1 text-[11px] text-emerald-100 text-center">
                  Esta escena ya es la entrada actual de la región.
                </div>
              ) : null}

              {!regionHasAssignedEntry && regionHasAnyAssignedScene ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-950/20 px-2 py-1 text-[11px] text-amber-100 text-center">
                  Esta región tiene escenas asociadas, pero aún no tiene entrada definida.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 text-center">
              Selecciona una región para configurar su entrada.
            </div>
          )}
        </div>
      </div>
    </ToggleFieldBlock>
  );
}