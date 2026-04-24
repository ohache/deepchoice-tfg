import { useMemo, useState } from "react";
import type { ID } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { buildSceneListEntries, type SceneListLayerEntry, type SceneListLayerGroup, type SceneListLeafItem,
  type SceneListSceneEntry} from "@/features/editor/scene/list/sceneListViewModel";

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={"inline-flex items-center rounded-md border px-2 py-0.5 text-[12px] " + className}>
      {children}
    </span>
  );
}

function LeafItemRow({ item }: { item: SceneListLeafItem }) {
  if (item.kind === "placedItem") {
    return (
      <li className="text-xs text-slate-300 pl-2 pt-1">
        <span className="font-medium text-slate-200">{item.label}</span>
        <span className="text-slate-400"> · {item.itemName}</span>
      </li>
    );
  }

  if (item.kind === "placedNpc") {
    return (
      <li className="text-xs text-slate-300 pl-2 pt-1">
        <span className="font-medium text-slate-200">{item.npcName}</span>
      </li>
    );
  }

  if (item.kind === "placedPlayer") {
    return (
      <li className="text-xs text-slate-300 pl-2 pt-1">
        <span className="font-medium text-slate-200">{item.playerName}</span>
      </li>
    );
  }

  return (
    <li className="text-xs text-slate-300 pl-2 pt-1">
      <span className="font-medium text-slate-200">{item.label}</span>
    </li>
  );
}

function LayerGroupBlock({ nodeId, layerId, group, expandedGroupKeys, toggleGroup }: {
  nodeId: ID;
  layerId: ID;
  group: SceneListLayerGroup;
  expandedGroupKeys: Set<string>;
  toggleGroup: (key: string) => void;
}) {
  if (group.kind === "single") {
    return (
      <div className="px-3 py-2">
        <div className="text-xs font-medium text-slate-200">{group.label}</div>
        <div className="text-xs text-slate-400 mt-1">{group.trackName}</div>
      </div>
    );
  }

  const groupKey = `${nodeId}:${layerId}:${group.key}`;
  const isExpanded = expandedGroupKeys.has(groupKey);

  return (
    <div className="border-t border-slate-800 first:border-t-0">
      <button
        type="button"
        onClick={() => toggleGroup(groupKey)}
        className="w-full text-left px-3 py-2 hover:bg-slate-900/50 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-200">
            {group.label} ({group.count})
          </span>
        </div>
      </button>

      {isExpanded && (
        <ul className="px-3 pb-3 space-y-2">
          {group.items.map((item) => (
            <LeafItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LayerBlock({ nodeId, layer, expandedLayerKeys, expandedGroupKeys, toggleLayer, toggleGroup }: {
  nodeId: ID;
  layer: SceneListLayerEntry;
  expandedLayerKeys: Set<string>;
  expandedGroupKeys: Set<string>;
  toggleLayer: (key: string) => void;
  toggleGroup: (key: string) => void;
}) {
  const layerKey = `${nodeId}:${layer.id}`;
  const isExpanded = expandedLayerKeys.has(layerKey);

  return (
    <div className="rounded-md border border-slate-700 bg-slate-950/40 overflow-hidden">
      <button
        type="button"
        onClick={() => toggleLayer(layerKey)}
        className="w-full text-left px-3 py-2 hover:bg-slate-900/60 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-slate-100">{layer.label}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-800/80">
          {layer.groups.map((group) => (
            <LayerGroupBlock
              key={group.key}
              nodeId={nodeId}
              layerId={layer.id}
              group={group}
              expandedGroupKeys={expandedGroupKeys}
              toggleGroup={toggleGroup}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SceneListView() {
  const project = useEditorStore((s) => s.project);
  const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);
  const enterEditNodeMode = useEditorStore((s) => s.enterEditNodeMode);

  const [search, setSearch] = useState("");
  const [expandedSceneIds, setExpandedSceneIds] = useState<Set<ID>>(new Set());
  const [expandedLayerKeys, setExpandedLayerKeys] = useState<Set<string>>(new Set());
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set());

  const sceneEntries = useMemo(() => buildSceneListEntries(project), [project]);

  const filteredScenes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return sceneEntries;

    return sceneEntries.filter((scene) => scene.title.toLowerCase().includes(query));
  }, [sceneEntries, search]);

  if (!project || project.nodes.length === 0) {
    return (
      <div className="text-sm text-slate-400 text-center py-8">
        Todavía no hay ninguna escena en este proyecto.
        <br />
        Crea una escena desde la pestaña <span className="font-semibold">Crear</span>.
      </div>
    );
  }

  const handleEditScene = (id: ID) => {
    setPrimaryMode("escena");
    setSecondaryMode("crear");
    enterEditNodeMode(id);
  };

  const toggleScene = (id: ID) => {
    const isCurrentlyExpanded = expandedSceneIds.has(id);

    setExpandedSceneIds(isCurrentlyExpanded ? new Set() : new Set([id]));

    if (isCurrentlyExpanded) {
      setExpandedLayerKeys(new Set());
      setExpandedGroupKeys(new Set());
      return;
    }

    const nextLayerKeys = new Set(
      Array.from(expandedLayerKeys).filter((key) => key.startsWith(`${id}:`)),
    );
    const nextGroupKeys = new Set(
      Array.from(expandedGroupKeys).filter((key) => key.startsWith(`${id}:`)),
    );

    setExpandedLayerKeys(nextLayerKeys);
    setExpandedGroupKeys(nextGroupKeys);
  };

  const toggleLayer = (key: string) => {
    setExpandedLayerKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="max-w-[700px] mx-auto rounded-xl border-3 border-slate-700 bg-slate-900 p-4 space-y-3 mt-4">
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white text-center">
          {project.title}
        </h2>

        <input
          data-editor-search
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar escena..."
          className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100
            focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-600"
        />

        <ul className="space-y-2">
          {filteredScenes.length === 0 ? (
            <li className="text-sm text-slate-400 text-center py-6">
              No hay escenas que coincidan con la búsqueda.
            </li>
          ) : (
            filteredScenes.map((scene: SceneListSceneEntry) => {
              const isExpanded = expandedSceneIds.has(scene.id);

              return (
                <li key={scene.id}>
                  <div
                    className={
                      "rounded-md border-2 overflow-hidden transition-colors " +
                      (isExpanded
                        ? "border-fuchsia-700 bg-slate-950"
                        : "border-slate-700 bg-slate-950 hover:bg-slate-900 hover:border-fuchsia-800")
                    }
                  >
                    <button
                      type="button"
                      onClick={() => toggleScene(scene.id)}
                      onDoubleClick={() => handleEditScene(scene.id)}
                      className="w-full text-left px-3 py-3 text-xs md:text-sm transition-colors"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-center">
                          <span className="font-semibold text-sm md:text-base text-slate-100 text-center">
                            {scene.title}
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 ml-1">
                              <Badge className="border-slate-600 bg-slate-90 text-slate-200">
                                {scene.layerCount} {scene.layerCount === 1 ? "capa" : "capas"}
                              </Badge>

                              {scene.dialogueCount > 0 && (
                                <Badge className="border-slate-600 bg-slate-90 text-slate-200">
                                  {scene.dialogueCount} {scene.dialogueCount === 1 ? "diálogo" : "diálogos"}
                                </Badge>
                              )}

                              {scene.map && (
                                <Badge className={scene.map.isEntry
                                  ? "border-amber-500/60 bg-amber-500/10 text-slate-20"
                                  : "border-slate-600 bg-slate-90 text-slate-200"}
                                >
                                  Mapa: {scene.map.mapName} · {scene.map.regionName}
                                </Badge>
                              )}

                              {scene.music && (
                                <Badge className="border-slate-600 bg-slate-90 text-slate-200">
                                  Música: {scene.music.trackName}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-start gap-2">
                            {scene.isStart && (
                              <Badge className="border-emerald-500/60 bg-emerald-500/10 text-white">
                                Inicio
                              </Badge>
                            )}

                            {scene.isFinal && (
                              <Badge className="border-rose-500/60 bg-rose-500/10 text-white">
                                Final
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-800 px-3 py-3 space-y-4">
                        <div className="space-y-2">
                          <div className="text-sm text-center font-semibold text-slate-100">
                            Capas
                          </div>

                          <div className="space-y-2">
                            {scene.layers.map((layer) => (
                              <LayerBlock
                                key={layer.id}
                                nodeId={scene.id}
                                layer={layer}
                                expandedLayerKeys={expandedLayerKeys}
                                expandedGroupKeys={expandedGroupKeys}
                                toggleLayer={toggleLayer}
                                toggleGroup={toggleGroup}
                              />
                            ))}
                          </div>
                        </div>

                        {scene.dialogues.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm font-semibold text-center text-slate-100">
                              {scene.dialogueCount == 1 ? "Diálogo" : "Diálogos"}
                            </div>

                            <ul className="space-y-2">
                              {scene.dialogues.map((dialogue) => (
                                <li
                                  key={dialogue.id}
                                  className="rounded-md border border-slate-700/80 bg-slate-950/40 px-3 py-2"
                                >
                                  <div className="text-sm font-medium text-slate-200">{dialogue.title}</div>
                                  <div className="text-xs text-slate-400 mt-1">
                                    Player: {dialogue.playerName}
                                  </div>
                                  <div className="text-xs text-slate-400 mt-1">
                                    NPC: {dialogue.npcName}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}