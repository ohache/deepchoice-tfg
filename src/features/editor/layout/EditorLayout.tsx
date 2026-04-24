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
import { SceneTestView } from "../scene/test/SceneTestView";

function renderHistoryContent(secondaryMode: string) {
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

    default:
      return null;
  }
}

function renderSceneContent(secondaryMode: string) {
  switch (secondaryMode) {
    case "crear":
      return <SceneEditorView />;

    case "buscar":
      return <SceneListView />;

    case "test":
      return <SceneTestView />;

    default:
      return null;
  }
}

export function EditorLayout() {
  const primaryMode = useEditorStore((s) => s.primaryMode);
  const secondaryMode = useEditorStore((s) => s.secondaryMode);

  let content = null;

  if (primaryMode === "historia") {
    content = renderHistoryContent(secondaryMode);
  } else if (primaryMode === "escena") {
    content = renderSceneContent(secondaryMode);
  }

  return (
    <main data-editor-scroll="true" className="editor-scroll flex-1 min-h-0 p-4 overflow-auto bg-slate-950">
      {content}
    </main>
  );
}