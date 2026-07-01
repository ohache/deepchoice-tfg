import type { DeleteImpactEntry, DeleteImpactReport } from "@/features/editor/delete/deleteTypes";

type Props = {
  report: DeleteImpactReport | null;
  onConfirm: () => void;
  onCancel: () => void;
};

function getSeverityLabel(severity: DeleteImpactEntry["severity"]): string {
  if (severity === "blocking-risk") return "Riesgo de bloqueo";
  if (severity === "logic-change") return "Cambio lógico";
  return "Información";
}

export function DeleteImpactModal({ report, onConfirm, onCancel }: Props) {
  if (!report) return null;

  const hasEntries = report.entries.length > 0;

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      data-modal
    >
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-[760px] flex-col rounded-xl border-2 border-red-800 bg-slate-950 p-5 shadow-2xl">
        <h2 className="mb-2 text-center text-[18px] font-semibold text-white">
          Confirmar borrado
        </h2>

        <p className="text-center text-sm text-slate-100">
          Vas a borrar: <span className="font-semibold text-red-300">{report.targetLabel}</span>
        </p>

        <div className="editor-scroll mt-2 min-h-0 overflow-x-hidden overflow-y-auto p-2">
          <p className="mb-3 text-center text-[13px] text-slate-100">
            {hasEntries
              ? "Este borrado afectará a los siguientes elementos:"
              : "No se han detectado referencias adicionales que actualizar."}
          </p>

          {hasEntries ? (
            <div className="space-y-2">
              {report.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md border-2 border-slate-600 bg-slate-900 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-slate-100">
                      {entry.location.label}
                    </span>

                    <span className="shrink-0 rounded-xl border border-slate-400 px-2 py-0.5 text-[10px] text-slate-200">
                      {getSeverityLabel(entry.severity)}
                    </span>
                  </div>

                  <p className="mt-1 text-[12px] text-slate-300">
                    {entry.message}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex shrink-0 justify-end gap-3">
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
            {hasEntries ? "Borrar y actualizar referencias" : "Borrar"}
          </button>
        </div>
      </div>
    </div>
  );
}