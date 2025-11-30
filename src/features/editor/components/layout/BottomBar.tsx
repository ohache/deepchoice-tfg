import { useEditorStore } from "@/store/editorStore";
import type { EditorSecondaryMode } from "@/features/editor/core/editorModes";

export function BottomBar() {
  const project = useEditorStore((s) => s.project);
  const primaryMode = useEditorStore((s) => s.primaryMode);
  const secondaryMode = useEditorStore((s) => s.secondaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);

  const nodeCount = project!.nodes.length;

  let tabs: { id: EditorSecondaryMode; label: string; title?: string }[] = [];

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
      tabs = [
        { id: "crear", label: "Crear" },
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

  const handleTabClick = (id: EditorSecondaryMode) => {
    if (id === secondaryMode) return;
    setSecondaryMode(id);
  };

  if (!tabs.length) return null;

  return (
    <nav 
        className="h-12 bg-slate-900 border-t border-slate-800 flex items-center px-4"
         aria-label="Navegación secundaria del editor"
    >
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
