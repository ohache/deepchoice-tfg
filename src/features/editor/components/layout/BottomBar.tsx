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
  const sceneMode = useEditorStore((s) => s.sceneMode);

  if (!project) return null;

  const nodeCount = project.nodes.length;

  let tabs: SecondaryTab[] = [];

  switch (primaryMode) {
    case "historia":
      tabs = [
        { id: "vista", label: "Vista", title: `Nodos: ${nodeCount}` },
        { id: "jugador", label: "Jugador" },
        { id: "mapa", label: "Mapa" },
        { id: "pnjs", label: "PNJs" },
        { id: "items", label: "Items" },
        { id: "musica", label: "Música" },
        { id: "dialogos", label: "Diálogos" },
        { id: "etiquetas", label: "Etiquetas" },
      ];
      break;

    case "escena":
      const crearLabel = sceneMode === "editing" ? "Editar" : "Crear";
      tabs = [
        { id: "crear", label: crearLabel },
        { id: "buscar", label: "Buscar" },
        { id: "listar", label: "Listar" },
      ];
      break;

    case "test":
      tabs = [
        { id: "historia", label: "Historia" },
        { id: "nodo", label: "Nodo" },
      ];
      break;
  }

  if (tabs.length === 0) return null;

  const handleTabClick = (id: EditorSecondaryMode) => {
    if (id === secondaryMode) return;
    setSecondaryMode(id);
  };
  
  return (
    <nav className="h-12 bg-slate-900 border-t border-slate-800 flex items-center px-4">
      <div className="flex items-center gap-2 text-sm">
        {tabs.map((tab) => {
          const isActive = tab.id === secondaryMode;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              title={tab.title}
              className={[
                "px-3 py-1 rounded-md transition-colors",
                isActive
                  ? "bg-slate-700 text-white"
                  : "text-slate-300 hover:text-slate-100 hover:bg-slate-800/60",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
