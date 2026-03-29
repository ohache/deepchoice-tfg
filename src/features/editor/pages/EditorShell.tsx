import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TopBar } from "@/features/editor/layout/TopBar";
import { BottomBar } from "@/features/editor/layout/BottomBar";
import { EditorLayout } from "@/features/editor/layout/EditorLayout";
import { useEditorStore } from "@/store/editorStore";
import { createEditorKeyHandler } from "@/features/editor/utils/editorKeyboard";

export function EditorShell() {
  const location = useLocation();
  const navigate = useNavigate();

  const project = useEditorStore((s) => s.project);
  const initNewProject = useEditorStore((s) => s.initNewProject);
  const downloadProjectJson = useEditorStore((s) => s.downloadProjectJson);
  const exportProject = useEditorStore((s) => s.exportProject);

  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const zoomReset = useEditorStore((s) => s.zoomReset);

  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  useEffect(() => {
    const state = location.state;
    const incomingTitle = state?.title?.trim();

    if (!project) {
      if (incomingTitle) { initNewProject(incomingTitle); }
      else { navigate("/"); }
    }
  }, [project, location.state, initNewProject, navigate]);

  const onKeyDown = useMemo(() =>
    createEditorKeyHandler({
      saveProject: () => downloadProjectJson(),
      exportProject: () => exportProject(),
      closeModalOrCancel: () => { },
      focusSearch: () => { },
      toggleHelp: () => { },
      deleteSelection: () => { },
      duplicateSelection: () => { },
      selectAll: () => { },
      zoomIn: () => zoomIn(),
      zoomOut: () => zoomOut(),
      zoomReset: () => zoomReset(),
      fitToView: () => { },
    }),
    [downloadProjectJson, exportProject, zoomIn, zoomOut, zoomReset]
  );

  if (!project) return null;

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="h-screen flex flex-col bg-slate-950 text-slate-100 outline-none overflow-hidden"
    >
      <TopBar/>
      <BottomBar />
      <EditorLayout />
    </div>
  );
}
