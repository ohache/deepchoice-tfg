import { useEditorStore } from "@/store/editorStore";
import { SceneCreateView } from "@/features/editor/components/scene/SceneCreateView";

export function EditorLayout() {
  const primaryMode = useEditorStore((s) => s.primaryMode);
  const secondaryMode = useEditorStore((s) => s.secondaryMode);

  let content: React.ReactNode;

  if (primaryMode === "escena" && secondaryMode === "crear") {
    content = <SceneCreateView />;
  } else {
    content = (
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
  }

  return (
    <div className="flex-1 p-4 overflow-auto bg-slate-900/40">
      <div className="max-w-[1380px] mx-auto rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        {content}
      </div>
    </div>
  );
}