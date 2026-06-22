// src/features/editor/modals/EditorKeyboardHelpModal.tsx

import { EDITOR_KEYBOARD_SHORTCUTS } from "@/shared/keyboard";

interface EditorKeyboardHelpModalProps {
  open: boolean;
  onClose: () => void;
}

export function EditorKeyboardHelpModal({ open, onClose }: EditorKeyboardHelpModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      data-modal
    >
      <div className="w-full max-w-[600px] rounded-xl border-2 border-slate-600 bg-slate-950 p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-center text-white mb-4">
          Atajos de teclado
        </h2>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-100">
          {EDITOR_KEYBOARD_SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys}>
              <strong>{shortcut.keys}:</strong> {shortcut.description}
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            data-editor-close
            onClick={onClose}
            className="btn btn-cancel"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}