import { useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import { SceneListView } from "@/features/editor/scene/SceneListView";
import { HistoryMusicPanel } from "@/features/editor/history/music/HistoryMusicPanel";
import { HistoryTagsPanel } from "@/features/editor/history/HistoryTagsPanel";
import { HistoryViewPanel } from "@/features/editor/history/view/HistoryViewPanel";
import { HistoryItemsPanel } from "@/features/editor/history/items/HistoryItemsPanel";
import { HistoryMapsPanel } from "@/features/editor/history/maps/HistoryMapsPanel";
import { HistoryPlayersPanel } from "@/features/editor/history/players/HistoryPlayersPanel";
import { HistorySfxPanel } from "@/features/editor/history/sfx/HistorySfxPanel";
import { HistoryNpcsPanel } from "@/features/editor/history/npcs/HistoryNpcsPanel";
import { SceneEditorView } from "@/features/editor/scene/SceneEditorView";

export function EditorLayout() {
  const primaryMode = useEditorStore((s) => s.primaryMode);
  const secondaryMode = useEditorStore((s) => s.secondaryMode);
  const nodeMode = useEditorStore((s) => s.nodeMode);
  const selectedNodeId = useEditorStore((s: any) => s.selectedNodeId ?? null);

  /* Selección del contenido principal */
  const content = useMemo(() => {
    if (primaryMode === "historia") {
      switch (secondaryMode) {
        case "vista":
          return <HistoryViewPanel />;

        case "jugador":
          return <HistoryPlayersPanel />;

        case "pnjs":
          return <HistoryNpcsPanel />;

        case "items":
          return <HistoryItemsPanel />;

        case "musica":
          return <HistoryMusicPanel />;

        case "sfx":
          return <HistorySfxPanel />;

        case "mapa":
          return <HistoryMapsPanel />;

        case "recursos":
          return <HistoryTagsPanel />;

      }
    }

    if (primaryMode === "escena") {
      switch (secondaryMode) {
        case "crear":
          return <SceneEditorView />;

        case "buscar":
          return <SceneListView />;
      }
    }
  }, [primaryMode, secondaryMode, nodeMode, selectedNodeId]);

  return (
    <main
      data-editor-scroll="true"
      className="editor-scroll flex-1 min-h-0 p-4 overflow-auto bg-slate-900/40"
    >
      {content}
    </main>
  );
}
