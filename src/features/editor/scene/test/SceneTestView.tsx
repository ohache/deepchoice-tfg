import { useEffect, useMemo, useState, useCallback } from "react";
import type { SceneTestInspectableEntry, SceneTestInspectableRef, SceneTestLayerEntry, SceneTestSceneEntry,
  SceneTestTextVariantEntry } from "@/features/editor/scene/test/sceneTestTypes";
import { useEditorStore } from "@/store/editorStore";
import { buildSceneTestViewModel } from "@/features/editor/scene/test/sceneTestViewModel";
import { SceneTestToolbar } from "@/features/editor/scene/test/SceneTestToolbar";
import { SceneTestInfoCard } from "@/features/editor/scene/test/SceneTestInfoCard";
import { SceneTest } from "@/features/editor/scene/test/SceneTest";
import type { ID } from "@/domain/types";

function findLayerByIndex(scene: SceneTestSceneEntry | null, layerIndex: number): SceneTestLayerEntry | null {
  if (!scene) return null;
  return scene.layers[layerIndex] ?? null;
}

function findTextByIndex(layer: SceneTestLayerEntry | null, textIndex: number): SceneTestTextVariantEntry | null {
  if (!layer) return null;
  return layer.textVariants[textIndex] ?? null;
}

function collectInspectableEntries(layer: SceneTestLayerEntry | null): SceneTestInspectableEntry[] {
  if (!layer) return [];
  return [...layer.hotspots, ...layer.placedItems, ...layer.placedNpcs, ...layer.placedPlayers];
}

function matchInspectableRef(entries: SceneTestInspectableEntry[], ref: SceneTestInspectableRef | null): SceneTestInspectableEntry | null {
  if (!ref) return null;
  return entries.find((entry) => entry.type === ref.type && entry.id === ref.id) ?? null;
}

function findSceneIndexById(scenes: SceneTestSceneEntry[], id: ID | null): number {
  if (!id) return 0;

  const index = scenes.findIndex((scene) => scene.id === id);
  return index >= 0 ? index : 0;
}

function findLayerIndexById(scene: SceneTestSceneEntry | null, layerId: ID | null): number {
  if (!scene || !layerId) return 0;

  const index = scene.layers.findIndex((layer) => layer.id === layerId);
  return index >= 0 ? index : 0;
}

function findTextIndexById(layer: SceneTestLayerEntry | null, textEntryId: ID | null): number {
  if (!layer || !textEntryId) return 0;

  const index = layer.textVariants.findIndex((entry) => entry.id === textEntryId);
  return index >= 0 ? index : 0;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

function isSameInspectableRef(a: SceneTestInspectableRef | null, b: SceneTestInspectableRef | null): boolean {
  return Boolean(a && b && a.type === b.type && a.id === b.id);
}

export function SceneTestView() {
  const project = useEditorStore((s) => s.project);
  const testNodeId = useEditorStore((s) => s.getSceneTestNodeId());
  const activeTextEntryId = useEditorStore((s) => s.activeTextEntryId);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);

  const viewModel = useMemo(() => buildSceneTestViewModel(project), [project]);

  const [sceneIndex, setSceneIndex] = useState(0);
  const [layerIndex, setLayerIndex] = useState(0);
  const [textIndex, setTextIndex] = useState(0);

  const [hoveredRef, setHoveredRef] = useState<SceneTestInspectableRef | null>(null);
  const [pinnedRef, setPinnedRef] = useState<SceneTestInspectableRef | null>(null);

  const clearInspectableState = useCallback(() => {
    setHoveredRef(null);
    setPinnedRef(null);
  }, []);

  useEffect(() => {
    if (!viewModel) return;

    const nextSceneIndex = findSceneIndexById(viewModel.scenes, testNodeId);
    const nextScene = viewModel.scenes[nextSceneIndex] ?? null;
    const nextLayerIndex = findLayerIndexById(nextScene, activeLayerId);
    const nextLayer = findLayerByIndex(nextScene, nextLayerIndex);
    const nextTextIndex = findTextIndexById(nextLayer, activeTextEntryId);

    setSceneIndex(nextSceneIndex);
    setLayerIndex(nextLayerIndex);
    setTextIndex(nextTextIndex);
    clearInspectableState();
  }, [viewModel, testNodeId, activeLayerId, activeTextEntryId, clearInspectableState]);

  if (!viewModel || viewModel.scenes.length === 0) {
    return (
      <div className="max-w-[1100px] mx-auto rounded-xl border-2 border-slate-700 bg-slate-900 p-4 mt-4">
        <div className="text-sm text-slate-400 text-center py-8">
          No hay escenas disponibles para el modo test.
        </div>
      </div>
    );
  }

  const safeSceneIndex = clampIndex(sceneIndex, viewModel.scenes.length);
  const activeScene = viewModel.scenes[safeSceneIndex] ?? null;

  const safeLayerIndex = activeScene && layerIndex >= 0 && layerIndex < activeScene.layers.length ? layerIndex : 0;

  const activeLayer = findLayerByIndex(activeScene, safeLayerIndex);

  const safeTextIndex = activeLayer && textIndex >= 0 && textIndex < activeLayer.textVariants.length ? textIndex : 0;

  const activeText = findTextByIndex(activeLayer, safeTextIndex);

  const inspectableEntries = collectInspectableEntries(activeLayer);
  const pinnedTarget = matchInspectableRef(inspectableEntries, pinnedRef);
  const hoveredTarget = matchInspectableRef(inspectableEntries, hoveredRef);
  const infoTarget = pinnedTarget ?? hoveredTarget;

  const canGoPrevScene = safeSceneIndex > 0;
  const canGoNextScene = safeSceneIndex < viewModel.scenes.length - 1;

  const canGoPrevLayer = safeLayerIndex > 0;
  const canGoNextLayer = !!activeScene && safeLayerIndex < activeScene.layers.length - 1;

  const canGoPrevText = !!activeLayer && safeTextIndex > 0;
  const canGoNextText = !!activeLayer && safeTextIndex < activeLayer.textVariants.length - 1;

  const goPrevScene = () => {
    if (!canGoPrevScene) return;

    setSceneIndex((prev) => clampIndex(prev - 1, viewModel.scenes.length));
    setLayerIndex(0);
    setTextIndex(0);
    clearInspectableState();
  };

  const goNextScene = () => {
    if (!canGoNextScene) return;

    setSceneIndex((prev) => clampIndex(prev + 1, viewModel.scenes.length));
    setLayerIndex(0);
    setTextIndex(0);
    clearInspectableState();
  };

  const goPrevLayer = () => {
    if (!canGoPrevLayer || !activeScene) return;

    setLayerIndex((prev) => clampIndex(prev - 1, activeScene.layers.length));
    setTextIndex(0);
    clearInspectableState();
  };

  const goNextLayer = () => {
    if (!canGoNextLayer || !activeScene) return;

    setLayerIndex((prev) => clampIndex(prev + 1, activeScene.layers.length));
    setTextIndex(0);
    clearInspectableState();
  };

  const goPrevText = () => {
    if (!canGoPrevText || !activeLayer) return;

    setTextIndex((prev) => clampIndex(prev - 1, activeLayer.textVariants.length));
  };

  const goNextText = () => {
    if (!canGoNextText || !activeLayer) return;

    setTextIndex((prev) => clampIndex(prev + 1, activeLayer.textVariants.length));
  };

  const handleHoverRef = (ref: SceneTestInspectableRef) => { setHoveredRef(ref) };

  const handleLeaveRef = () => { setHoveredRef(null) };

  const handleSelectRef = (ref: SceneTestInspectableRef) => {
    setPinnedRef((current) => isSameInspectableRef(current, ref) ? null : ref);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pb-4 space-y-3">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 self-start">
          <div className="w-full flex justify-center mb-2">

            <SceneTestToolbar
              canGoPrevScene={canGoPrevScene}
              canGoNextScene={canGoNextScene}
              onPrevScene={goPrevScene}
              onNextScene={goNextScene}
            />

          </div>

          <SceneTest
            title={activeScene?.title ?? "Sin escena"}
            imageAssetId={activeLayer?.assetId ?? null}
            text={activeText?.content ?? ""}
            textLabel={activeText?.label}
            textDock={activeText?.dock ?? "bottom"}
            showTextNav={(activeLayer?.textVariants.length ?? 0) > 1}
            canGoPrevText={canGoPrevText}
            canGoNextText={canGoNextText}
            onPrevText={goPrevText}
            onNextText={goNextText}
            canGoPrevLayer={canGoPrevLayer}
            canGoNextLayer={canGoNextLayer}
            onPrevLayer={goPrevLayer}
            onNextLayer={goNextLayer}
            layerLabel={activeLayer?.label ?? "Sin capa"}
            showLayerNav={(activeScene?.layers.length ?? 0) > 1}
            hotspots={activeLayer?.hotspots ?? []}
            placedItems={activeLayer?.placedItems ?? []}
            placedNpcs={activeLayer?.placedNpcs ?? []}
            placedPlayers={activeLayer?.placedPlayers ?? []}
            hoveredRef={hoveredRef}
            pinnedRef={pinnedRef}
            onHoverTarget={handleHoverRef}
            onLeaveTarget={handleLeaveRef}
            onSelectTarget={handleSelectRef}
          />
        </div>

        <aside className="min-w-0 space-y-3 xl:sticky xl:top-0 self-start -mt-0.5">
          <div className="rounded-xl border-2 border-slate-700 bg-slate-900 px-4 py-2.5 space-y-2">
            <div className="text-center text-lg font-semibold text-white">
              {activeScene?.title ?? "Sin escena"}
            </div>

            <div className="text-center text-sm text-slate-300">
              {activeLayer?.label ?? "Sin capa"}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              {activeScene?.map && (
                <span
                  className={"rounded-md border px-2 py-1 " +
                    (activeScene.map.isEntry
                      ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
                      : "border-slate-600 bg-slate-950 text-slate-200")}
                >
                  {activeScene.map.mapName} · {activeScene.map.regionName}
                </span>
              )}

              {activeLayer?.resolvedMusic && (
                <span className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-slate-200">
                  Música: {activeLayer.resolvedMusic.trackName} ({activeLayer.resolvedMusic.source})
                </span>
              )}

              {activeScene?.isStart && (
                <span className="rounded-md border border-emerald-500/60 bg-emerald-500/10 px-2 py-1 text-white">
                  Inicio
                </span>
              )}

              {activeScene?.isFinal && (
                <span className="rounded-md border border-rose-500/60 bg-rose-500/10 px-2 py-1 text-white">
                  Final
                </span>
              )}
            </div>
          </div>

          <div className="max-h-[63vh] editor-scroll overflow-y-auto">
            <SceneTestInfoCard
              target={infoTarget}
              pinned={Boolean(pinnedTarget)}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}