import { useEditorStore } from "@/store/editorStore";
import type { ID } from "@/domain/types";

export function SceneListView() {
  const project = useEditorStore((s) => s.project);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);
  const enterEditNodeMode = useEditorStore((s) => s.enterEditNodeMode);

  if (!project || project.nodes.length === 0) {
    return (
      <div className="text-sm text-slate-400 text-center py-8">
        Todavía no hay ninguna escena en este proyecto.
        <br />
        Crea una escena desde la pestaña <span className="font-semibold">Crear</span>.
      </div>
    );
  }

const handleSelect = (id: ID) => {
  setPrimaryMode("escena");
  setSecondaryMode("crear");
  enterEditNodeMode(id);
};

  return (
    <div className="max-w-[900px] mx-auto rounded-xl border-2 border-slate-800 bg-slate-900 p-4 space-y-3 mt-4">
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-100 text-center">
          Escenas: {project.title}
        </h2>

        <ul className="space-y-2">
          {project.nodes.map((node, index) => {
            const isActive = node.id === selectedNodeId;
            const title = node.title || `Escena ${index + 1}`;

            return (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(node.id)}
                  className={ "w-full text-left px-3 py-2 rounded-md border text-xs md:text-sm transition-colors " +
                    (isActive
                      ? "border-fuchsia-500 bg-sky-950 text-slate-100"
                      : "border-slate-700 bg-slate-950/70 text-slate-200 hover:bg-sky-950") }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{title}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}