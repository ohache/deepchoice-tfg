import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEditorStore } from "@/store/editorStore";
import { TopBar } from "@/features/editor/layout/TopBar";
import { BottomBar } from "@/features/editor/layout/BottomBar";
import { EditorLayout } from "@/features/editor/layout/EditorLayout";
import { isTypingTarget, runShortcutMap } from "@/shared/keyboard";
import { DeleteImpactModal } from "@/features/editor/delete/DeleteImpactModal";
import { EditorKeyboardHelpModal } from "@/features/editor/modals/EditorKeyboardHelpModal";

export function EditorShell() {
  const location = useLocation();
  const navigate = useNavigate();

  const project = useEditorStore((s) => s.project);
  const initNewProject = useEditorStore((s) => s.initNewProject);
  const downloadProjectJson = useEditorStore((s) => s.downloadProjectJson);
  const exportProject = useEditorStore((s) => s.exportProject);

  const pendingDeleteImpact = useEditorStore((s) => s.pendingDeleteImpact);
  const confirmPendingDelete = useEditorStore((s) => s.confirmPendingDelete);
  const cancelPendingDelete = useEditorStore((s) => s.cancelPendingDelete);

  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const zoomReset = useEditorStore((s) => s.zoomReset);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => rootRef.current?.focus(), []);

  useEffect(() => {
    const state = location.state;
    const incomingTitle = state?.title?.trim();

    if (!project) {
      if (incomingTitle) initNewProject(incomingTitle);
      else navigate("/");
    }
  }, [project, location.state, initNewProject, navigate]);

  const handleEscape = useCallback(() => {
    if (pendingDeleteImpact) {
      cancelPendingDelete();
      return;
    }

    if (isHelpOpen) setIsHelpOpen(false);
  }, [pendingDeleteImpact, cancelPendingDelete, isHelpOpen]);

  const focusSearch = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const searchTarget = root.querySelector<HTMLInputElement>("[data-editor-search]");
    searchTarget?.focus();
    searchTarget?.select?.();
  }, []);

  const toggleHelp = useCallback(() => setIsHelpOpen((prev) => !prev), []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleEscape();
        return;
      }

      if (isTypingTarget(event.target)) return;

      runShortcutMap(event, [
        {
          when: { key: "S", ctrl: true },
          action: downloadProjectJson,
          preventDefault: true,
          stopPropagation: true,
        },
        {
          when: { key: "E", ctrl: true },
          action: exportProject,
          preventDefault: true,
          stopPropagation: true,
        },
        {
          when: { key: "F", ctrl: true },
          action: focusSearch,
          preventDefault: true,
          stopPropagation: true,
        },
        {
          when: { key: "=", ctrl: true },
          action: zoomIn,
          preventDefault: true,
          stopPropagation: true,
        },
        {
          when: { key: "+", ctrl: true },
          action: zoomIn,
          preventDefault: true,
          stopPropagation: true,
        },
        {
          when: { key: "-", ctrl: true },
          action: zoomOut,
          preventDefault: true,
          stopPropagation: true,
        },
        {
          when: { key: "0", ctrl: true },
          action: zoomReset,
          preventDefault: true,
          stopPropagation: true,
        },
        {
          when: { key: "?" },
          action: toggleHelp,
          preventDefault: true,
          stopPropagation: true,
        },
        {
          when: { key: "F1" },
          action: toggleHelp,
          preventDefault: true,
          stopPropagation: true,
        },
      ]);
    }, [handleEscape, downloadProjectJson, exportProject, focusSearch, zoomIn, zoomOut, zoomReset, toggleHelp],
  );

  if (!project) return null;

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="h-screen flex flex-col bg-slate-950 text-slate-100 outline-none overflow-hidden"
    >
      <TopBar />
      <BottomBar />
      <EditorLayout />

      <DeleteImpactModal
        report={pendingDeleteImpact}
        onConfirm={confirmPendingDelete}
        onCancel={cancelPendingDelete}
      />

      <EditorKeyboardHelpModal
        open={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}