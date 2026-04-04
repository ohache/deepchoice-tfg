import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TopBar } from "@/features/editor/layout/TopBar";
import { BottomBar } from "@/features/editor/layout/BottomBar";
import { EditorLayout } from "@/features/editor/layout/EditorLayout";
import { useEditorStore } from "@/store/editorStore";
import { runShortcutMap } from "@/shared/keyboard";

function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;

  const tag = element.tagName?.toLowerCase();

  return tag === "input" || tag === "textarea" || element.isContentEditable === true;
}

function isVisibleElement(element: HTMLElement | null): boolean {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

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
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => { rootRef.current?.focus(); }, []);

  useEffect(() => {
    const state = location.state;
    const incomingTitle = state?.title?.trim();

    if (!project) {
      if (incomingTitle) { initNewProject(incomingTitle); }
      else { navigate("/"); }
    }
  }, [project, location.state, initNewProject, navigate]);

  const closeModalOrCancel = useCallback(() => {
    if (isHelpOpen) {
      setIsHelpOpen(false);
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const dialogSelectors = [
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[data-dialog]',
      '[data-modal]',
    ].join(",");

    const visibleDialogs = Array.from(root.querySelectorAll<HTMLElement>(dialogSelectors)).filter(isVisibleElement);

    for (const dialog of visibleDialogs.reverse()) {
      const closeButton = dialog.querySelector<HTMLElement>(
        [
          '[data-editor-close]',
          '[data-close]',
          '[aria-label="Cerrar"]',
          '[aria-label="Close"]',
          'button[type="button"]',
        ].join(","),
      );

      if (closeButton && isVisibleElement(closeButton)) {
        closeButton.click();
        return;
      }
    }

    const cancelButton = root.querySelector<HTMLElement>(
      [
        '[data-editor-cancel]',
        'button.btn-cancel',
        'button[data-cancel]',
      ].join(","),
    );

    if (cancelButton && isVisibleElement(cancelButton)) {
      cancelButton.click();
    }
  }, [isHelpOpen]);

  const focusSearch = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const searchTarget = root.querySelector<HTMLInputElement>('[data-editor-search]');
    searchTarget?.focus();
    searchTarget?.select?.();
  }, []);

  const toggleHelp = useCallback(() => { setIsHelpOpen((prev) => !prev) }, []);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      const typing = isTypingTarget(event.target);

      if (event.key === "Escape") {
        closeModalOrCancel();
        return;
      }

      if (typing) return;

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
    },
    [ closeModalOrCancel, downloadProjectJson, exportProject, focusSearch, toggleHelp, zoomIn, zoomOut, zoomReset ],
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

      {isHelpOpen ? (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-black/60"
          role="dialog"
          aria-modal="true"
          data-modal
        >
          <div className="w-full max-w-[680px] rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-center text-white mb-4">
              Atajos de teclado
            </h2>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-200">
              <div><strong>Ctrl + S:</strong> Guardar JSON</div>
              <div><strong>Ctrl + E:</strong> Exportar proyecto</div>
              <div><strong>Ctrl + F:</strong> Buscar</div>
              <div><strong>Ctrl + +:</strong> Zoom in</div>
              <div><strong>Ctrl + -:</strong> Zoom out</div>
              <div><strong>Ctrl + 0:</strong> Reset zoom</div>
              <div><strong>F1 / ?:</strong> Mostrar ayuda</div>
              <div><strong>Esc:</strong> Cerrar / cancelar</div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                data-editor-close
                onClick={() => setIsHelpOpen(false)}
                className="btn btn-cancel"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}