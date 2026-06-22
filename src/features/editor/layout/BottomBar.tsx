import { useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import { buildSecondaryTabs } from "@/features/editor/core/editorNavigation";

export function BottomBar() {
  const project = useEditorStore((s) => s.project);

  const primaryMode = useEditorStore((s) => s.primaryMode);
  const secondaryMode = useEditorStore((s) => s.secondaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);

  const nodeMode = useEditorStore((s) => s.nodeMode);
  const canOpenSceneTest = useEditorStore((s) => s.canOpenSceneTest());

  if (!project) return null;

  /*
 * Construye la lista de pestañas secundarias visibles */
  const tabs = useMemo(() =>
    buildSecondaryTabs(primaryMode, nodeMode, {
      nodeCount: project.nodes.length,
      playersCount: project.players.length,
      npcsCount: project.npcs.length,
      itemsCount: project.items.length,
      musicCount: project.musicTracks.length,
      sfxCount: project.soundEffects.length,
      mapCount: project.maps.length,
    }, canOpenSceneTest),
    [primaryMode, nodeMode, project, canOpenSceneTest],
  );

  if (tabs.length === 0) return null;

  return (
    <nav className="h-12 border-b-2 border-slate-700 bg-slate-900/30 flex items-center px-4">
      <div className="flex items-center gap-2 text-[14px]">
        {tabs.map((tab) => {
          const isActive = tab.id === secondaryMode;

          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              onClick={() => {
                if (tab.disabled) return;
                if (tab.id !== secondaryMode) setSecondaryMode(tab.id);
              }}
              title={tab.title}
              className={"px-3 py-1 rounded-md transition-colors " +
                (tab.disabled
                  ? "text-slate-500 bg-slate-900/40 cursor-not-allowed"
                  : isActive
                    ? "bg-slate-800 text-white"
                    : "text-slate-100 hover:text-white hover:bg-slate-800/60")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}