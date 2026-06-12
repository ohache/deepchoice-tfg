// src/features/editor/delete/DeleteImpactModal.tsx

import type { DeleteImpactEntry, DeleteImpactReport } from "@/features/editor/delete/deleteTypes";

type Props = {
  report: DeleteImpactReport | null;
  onConfirm: () => void;
  onCancel: () => void;
};

function getSeverityLabel(severity: DeleteImpactEntry["severity"]): string {
  if (severity === "blocking-risk") return "Riesgo bloqueante";
  if (severity === "logic-change") return "Cambio lógico";
  return "Información";
}

export function DeleteImpactModal({ report, onConfirm, onCancel }: Props) {
  if (!report) return null;

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      data-modal
    >
      <div className="w-full max-w-[760px] rounded-xl border border-red-700 bg-slate-900 p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-center text-white mb-2">
          Confirmar borrado
        </h2>

        <p className="text-center text-sm text-slate-300">
          Vas a borrar: <span className="font-semibold text-red-300">{report.targetLabel}</span>
        </p>

        <div className="mt-4 max-h-[420px] overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 p-3">
          <p className="mb-3 text-[12px] text-slate-300">
            Este borrado afectará a los siguientes elementos:
          </p>

          <div className="space-y-2">
            {report.entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-md border border-slate-700 bg-slate-900 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] font-semibold text-slate-100">
                    {entry.location.label}
                  </span>

                  <span className="shrink-0 rounded-full border border-slate-600 px-2 py-0.5 text-[10px] text-slate-300">
                    {getSeverityLabel(entry.severity)}
                  </span>
                </div>

                <p className="mt-1 text-[12px] text-slate-300">
                  {entry.message}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            data-editor-close
            onClick={onCancel}
            className="btn btn-cancel"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="btn btn-danger"
          >
            Borrar y actualizar referencias
          </button>
        </div>
      </div>
    </div>
  );
}