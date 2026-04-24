import { useMemo, useCallback } from "react";
import type { WorldMap, MapRegion, NodeMapLocation, ID } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { Checkbox } from "@/components/Checkbox";
import { Select, type Option } from "@/components/Select";

type SceneMapFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
};

export function SceneMapField({ label = "Mapa", active, onToggle }: SceneMapFieldProps) {
  const project = useEditorStore((s) => s.project);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);
  const setNodeMapLocation = useEditorStore((s) => s.setNodeMapLocation);

  const maps = useMemo<WorldMap[]>(() => project?.maps ?? [], [project?.maps]);

  const selectedMapId = nodeDraft?.mapLocation?.mapId ?? "";
  const selectedRegionId = nodeDraft?.mapLocation?.regionId ?? "";
  const isEntry = Boolean(nodeDraft?.mapLocation?.isEntry);

  const selectedMap = useMemo(() => maps.find((map) => map.id === selectedMapId) ?? null, [maps, selectedMapId]);

  const regions = useMemo<MapRegion[]>(() => selectedMap?.regions ?? [], [selectedMap]);

  // Opciones de UI para el selector de mapas.
  const mapOptions = useMemo<Option<ID>[]>(() =>
    maps.map((map) => ({ id: map.id, label: map.name?.trim() || map.id })), [maps]
  );

  // Opciones de UI para el selector de regiones.
  const regionOptions = useMemo<Option<ID>[]>(() =>
    regions.map((region) => ({ id: region.id, label: region.label?.trim() || "(Sin etiqueta)" })), [regions]
  );

  /* Cambia el mapa asociado a la escena */
  const handleMapChange = useCallback(
    (nextMapId: string) => {
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
    }, [maps, setNodeMapLocation]
  );

  /* Cambia la región dentro del mapa actualmente seleccionado */
  const handleRegionChange = useCallback(
    (nextRegionId: string) => {
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
    }, [selectedMapId, setNodeMapLocation]
  );

  /* Marca o desmarca la escena como entrada de la región actual */
  const handleEntryChange = useCallback(
    (checked: boolean) => {
      if (!selectedMapId || !selectedRegionId) return;

      const nextLoc: NodeMapLocation = {
        mapId: selectedMapId,
        regionId: selectedRegionId,
        isEntry: checked,
      };

      setNodeMapLocation(nextLoc);
    }, [selectedMapId, selectedRegionId, setNodeMapLocation]
  );

  return (
    <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
      <div className="space-y-3">
        {/* Selector de mapa */}
        <div className="bg-slate-950/30 px-2 py-2">
          <div className="mb-2 text-center text-[13px] text-slate-200">
            Mapa asociado
          </div>

          <Select<ID>
            value={selectedMapId}
            onChange={(value) => handleMapChange(String(value ?? ""))}
            options={mapOptions}
            placeholder="— Sin mapa —"
            className="w-full"
            menuClassName="border-slate-700"
          />

          {!maps.length ? (
            <div className="mt-2 text-center text-[11px] text-slate-400">
              No hay mapas creados en el proyecto.
            </div>
          ) : null}
        </div>

        {/* Selector de región */}
        <div className="bg-slate-950/30 px-2 py-2">
          <div className="mb-2 text-center text-[13px] text-slate-200">
            Región asociada
          </div>

          <Select<ID>
            value={selectedRegionId}
            onChange={(value) => handleRegionChange(String(value ?? ""))}
            options={regionOptions}
            placeholder="— Sin región —"
            disabled={!selectedMapId || !regions.length}
            className="w-full"
            menuClassName="border-slate-700"
          />

          {selectedMapId && !regions.length ? (
            <div className="mt-2 text-center text-[11px] text-slate-400">
              Este mapa no tiene regiones.
            </div>
          ) : null}
        </div>

        {/* Checkbox de escena de entrada */}
        <div className="bg-slate-950/30 px-2 py-2">
          <label className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900 px-3 py-2">
            <span className="text-xs text-slate-100">
              Esta escena es la entrada de la región
            </span>

            <Checkbox
              checked={isEntry}
              disabled={!selectedMapId || !selectedRegionId}
              onChange={handleEntryChange}
            />
          </label>
        </div>
      </div>
    </ToggleFieldBlock>
  );
}