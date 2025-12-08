import type { SceneValidationIssue } from "@/features/editor/validation/sceneValidator";

interface SceneValidationPanelProps {
  errors: SceneValidationIssue[];
  warnings: SceneValidationIssue[];
}

export function SceneValidationPanel({ errors, warnings }: SceneValidationPanelProps) {
  if (errors.length === 0 && warnings.length === 0) return null;
  
  return (
    <div className="mt-3 rounded-md border border-slate-800 bg-slate-950/80 p-3 space-y-2 text-xs">
      <p className="font-semibold text-slate-100">
        Estado de validación de la escena
      </p>

      {errors.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold text-red-300">Errores (bloquean):</p>
          <ul className="list-disc list-inside space-y-0.5 text-red-200">
            {errors.map((issue, idx) => (
              <li key={`err-${idx}`}>
                {issue.message}
                {issue.field !== "scene" && (
                  <span className="text-red-400/70"> ({issue.field})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-1">
          <p className="font-semibold text-amber-300">Avisos:</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-200">
            {warnings.map((issue, idx) => (
              <li key={`warn-${idx}`}>
                {issue.message}
                {issue.field !== "scene" && (
                  <span className="text-amber-400/70"> ({issue.field})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}