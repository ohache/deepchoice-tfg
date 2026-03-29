import { useEditorStore } from "@/store/editorStore";
import type { EditorSecondaryMode } from "@/features/editor/core/editorModes";

type SecondaryTab = {
  id: EditorSecondaryMode;
  label: string;
  title?: string;
};

export function BottomBar() {
  const project = useEditorStore((s) => s.project);

  const primaryMode = useEditorStore((s) => s.primaryMode);
  const secondaryMode = useEditorStore((s) => s.secondaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);
  const nodeMode = useEditorStore((s) => s.nodeMode);

  if (!project) return null;

  const nodeCount = project.nodes.length;
  const playersCount = project.players.length;
  const npcsCount = project.npcs.length;
  const itemsCount = project.items.length;
  const musicCount = project.musicTracks.length;
  const mapCount = project.maps.length;

  let tabs: SecondaryTab[] = [];

  switch (primaryMode) {
    case "historia":
      tabs = [
        { id: "vista", label: "Vista", title: `Nodos: ${nodeCount}` },
        { id: "jugador", label: "Jugador", title: `Jugadores: ${playersCount}` },
        { id: "pnjs", label: "PNJs", title: `PNJs: ${npcsCount}` },
        { id: "items", label: "Items", title: `Items: ${itemsCount}` },
        { id: "musica", label: "Música", title: `Música: ${musicCount}` },
        { id: "sfx", label: "Efectos de sonido" },
        { id: "mapa", label: "Mapa", title: `Mapas: ${mapCount}` },
        { id: "recursos", label: "Recursos" },
      ];
      break;

    case "escena": {
      const crearLabel = nodeMode === "editing" ? "Editar" : "Crear";

      tabs = [
        { id: "crear", label: crearLabel },
        { id: "buscar", label: "Buscar" },
      ];
      break;
    }

    case "test":
      tabs = [
        { id: "historia", label: "Historia" },
        { id: "escena", label: "Escena" },
      ];
      break;

    default: {
      const _exhaustive: never = primaryMode;
      return _exhaustive;
    }
  }

  if (tabs.length === 0) return null;

  const handleTabClick = (id: EditorSecondaryMode) => {
    if (id === secondaryMode) return;
    setSecondaryMode(id);
  };

  return (
    <nav className="h-12 bg-slate-900 flex items-center px-4">
      <div className="flex items-center gap-2 text-sm">
        {tabs.map((tab) => {
          const isActive = tab.id === secondaryMode;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              title={tab.title}
              className={ "px-3 py-1 rounded-md transition-colors " +
                (isActive ? "bg-slate-700 text-white" : "text-slate-100 hover:text-white hover:bg-slate-800")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}