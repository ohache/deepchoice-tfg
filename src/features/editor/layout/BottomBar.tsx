import { useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { EditorPrimaryMode, EditorSecondaryMode } from "@/features/editor/core/editorModes";

type SecondaryTab = {
  id: EditorSecondaryMode;
  label: string;
  title?: string;
};

type BottomBarCounts = {
  nodeCount: number;
  playersCount: number;
  npcsCount: number;
  itemsCount: number;
  musicCount: number;
  sfxCount: number;
  mapCount: number;
};

function buildSecondaryTabs(primaryMode: EditorPrimaryMode, nodeMode: "creating" | "editing", counts: BottomBarCounts): SecondaryTab[] {
  switch (primaryMode) {
    case "historia":
      return [
        { id: "vista", label: "Vista", title: `Nodos: ${counts.nodeCount}` },
        { id: "jugador", label: "Jugador", title: `Jugadores: ${counts.playersCount}` },
        { id: "pnjs", label: "PNJs", title: `PNJs: ${counts.npcsCount}` },
        { id: "items", label: "Items", title: `Items: ${counts.itemsCount}` },
        { id: "musica", label: "Música", title: `Música: ${counts.musicCount}` },
        { id: "sfx", label: "Efectos de sonido", title: `Sfx: ${counts.sfxCount}` },
        { id: "mapa", label: "Mapa", title: `Mapas: ${counts.mapCount}` },
        { id: "recursos", label: "Recursos" },
      ];

    case "escena":
      return [
        { id: "crear", label: nodeMode === "editing" ? "Editar" : "Crear" },
        { id: "buscar", label: "Buscar" },
      ];

    case "test":
      return [
        { id: "historia", label: "Historia" },
        { id: "escena", label: "Escena" },
      ];

    default: {
      const exhaustive: never = primaryMode;
      return exhaustive;
    }
  }
}

export function BottomBar() {
  const project = useEditorStore((s) => s.project);

  const primaryMode = useEditorStore((s) => s.primaryMode);
  const secondaryMode = useEditorStore((s) => s.secondaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);
  const nodeMode = useEditorStore((s) => s.nodeMode);

  if (!project) return null;

  const tabs = useMemo(() =>
    buildSecondaryTabs(primaryMode, nodeMode, {
      nodeCount: project.nodes.length,
      playersCount: project.players.length,
      npcsCount: project.npcs.length,
      itemsCount: project.items.length,
      musicCount: project.musicTracks.length,
      sfxCount: project.soundEffects.length,
      mapCount: project.maps.length,
    }),
    [primaryMode, nodeMode, project],
  );

  if (tabs.length === 0) return null;

  return (
    <nav className="h-12 bg-slate-900 flex items-center px-4">
      <div className="flex items-center gap-2 text-sm">
        {tabs.map((tab) => {
          const isActive = tab.id === secondaryMode;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { if (tab.id !== secondaryMode) setSecondaryMode(tab.id) }}
              title={tab.title}
              className={"px-3 py-1 rounded-md transition-colors " +
                (isActive
                  ? "bg-slate-700 text-white"
                  : "text-slate-100 hover:text-white hover:bg-slate-800")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}