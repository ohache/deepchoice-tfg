import { useEditorStore } from "@/store/editorStore";
import { SceneCreateView } from "@/features/editor/components/scene/SceneCreateView";
import { SceneEditView } from "@/features/editor/components/scene/SceneEditView";
import { SceneListView } from "@/features/editor/components/scene/SceneListView";
import { HistoryMusicPanel } from "@/features/editor/components/history/HistoryMusicPanel";
import { HistoryTagsPanel } from "@/features/editor/components/history/HistoryTagsPanel";
import { HistoryViewPanel } from "@/features/editor/components/history/HistoryViewPanel";
import { HistoryItemsPanel } from "../history/HistoryItemsPanel";

export function EditorLayout() {

  const primaryMode = useEditorStore((s) => s.primaryMode);
  const secondaryMode = useEditorStore((s) => s.secondaryMode);
  const sceneMode = useEditorStore((s) => s.sceneMode);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);

  const renderContent = () => {
    if (primaryMode === "escena") {
      switch (secondaryMode) {
        case "crear":
          if (sceneMode === "editing" && selectedNodeId) return <SceneEditView />;

          return <SceneCreateView />;

        case "listar":
          return <SceneListView />;
        default:
          return renderPendingView();
      }
    }

    if (primaryMode === "historia") {
      switch (secondaryMode) {
        case "vista":
          return <HistoryViewPanel />;

        /*case "jugador":
          return <HistoryPlayerPanel />;*/

        /*case "mapa":
          return <HistoryMapPanel />;*/

        /*case "pnjs":
          return <HistoryPNJsPanel />;*/

        case "items":
          return <HistoryItemsPanel />;
        
        case "musica":
          return <HistoryMusicPanel />;

        case "etiquetas":
          return <HistoryTagsPanel />;

        
  
          }
    }

    return renderPendingView();
  };

  const renderPendingView = () => (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center">
      <p className="text-sm text-slate-300 mb-1">
        Vista pendiente de crear.
      </p>
      <p className="text-xs text-slate-500">
        Modo actual:{" "}
        <span className="font-mono">{primaryMode}</span> /{" "}
        <span className="font-mono">{secondaryMode}</span>
      </p>
    </div>
  );

  /*
  <div className="max-w-[1380px] mx-auto rounded-xl border border-slate-800 bg-slate-800 p-5 space-y-4">
        {renderContent()}
      </div>*/

  return (
    <main className="flex-1 p-4 overflow-auto bg-slate-900/40">
      {renderContent()}
    </main>
  );
}