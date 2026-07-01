import { useEffect, useMemo, useState } from "react";
import type { ID, Project } from "@/domain/types";
import type { DiagnosticIssue } from "@/features/editor/delete/deleteTypes";
import { diagnoseProject } from "@/features/editor/delete/projectDiagnostics";
import { ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  project: Project | null;
  nodeId: ID | null | undefined;
};

type IssueTone = {
  panel: string;
  heading: string;
  badge: string;
  item: string;
};

function plural(value: number, singular: string, pluralText: string): string {
  return `${value} ${value === 1 ? singular : pluralText}`;
}

function getIssueTitle(issue: DiagnosticIssue): string {
  switch (issue.code) {
    case "RULE_WITHOUT_EFFECTS":
      return "Regla incompleta";

    case "DIALOGUE_WITH_INVALID_ROOT":
      return "Diálogo mal estructurado";

    case "DIALOGUE_WITH_BROKEN_CHILD":
      return "Diálogo con enlace roto";

    case "DIALOGUE_LINE_WITHOUT_TEXT":
      return "Línea de diálogo vacía";

    case "NODE_WITHOUT_LAYERS":
      return "Escena sin variantes";

    case "LAYER_WITHOUT_IMAGE":
      return "Variante sin imagen";

    case "PLAYER_WITHOUT_IMAGES":
      return "Jugador sin imágenes";

    case "PLACED_PLAYER_WITH_INVALID_IMAGE":
      return "Jugador colocado con imagen inválida";

    case "BROKEN_CONDITION_REFERENCE":
      return "Condición con referencia rota";

    case "BROKEN_EFFECT_REFERENCE":
      return "Efecto con referencia rota";

    case "BROKEN_MAP_REFERENCE":
      return "Referencia de mapa rota";

    case "BROKEN_ITEM_REFERENCE":
      return "Referencia de objeto roto";

    case "BROKEN_SPEAKER_REFERENCE":
      return "Emisor inexistente";
  }
}

function getPanelTone(hasErrors: boolean): Pick<IssueTone, "panel" | "heading"> {
  if (hasErrors) {
    return {
      panel: "border-red-500/55 bg-red-950/25",
      heading: "text-red-100",
    };
  }

  return {
    panel: "border-amber-400/70 bg-amber-950/30",
    heading: "text-amber-200",
  };
}

function getIssueTone(issue: DiagnosticIssue): Pick<IssueTone, "badge" | "item"> {
  if (issue.severity === "error") {
    return {
      badge: "border-red-400/50 bg-red-500/15 text-red-100",
      item: "border-red-500/25 bg-red-950/15",
    };
  }

  return {
    badge: "border-amber-300/50 bg-amber-400/15 text-amber-100",
    item: "border-amber-400/55 bg-amber-950/20",
  };
}

function getSeverityLabel(issue: DiagnosticIssue): string {
  return issue.severity === "error" ? "Error" : "Aviso";
}

function compareIssues(a: DiagnosticIssue, b: DiagnosticIssue): number {
  if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;

  return a.location.label.localeCompare(b.location.label, "es");
}

function getSummary(errorCount: number, warningCount: number): string {
  const parts: string[] = [];

  if (errorCount > 0) parts.push(plural(errorCount, "error", "errores"));
  if (warningCount > 0) parts.push(plural(warningCount, "aviso", "avisos"));

  return parts.join(" y ");
}

export function SceneDiagnosticsPanel({ project, nodeId }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const issues = useMemo(() => {
    if (!project || !nodeId) return [];

    const diagnostics = diagnoseProject(project);

    return [...diagnostics.errors, ...diagnostics.warnings].filter((issue) => issue.location.nodeId === nodeId).sort(compareIssues);
  }, [project, nodeId]);

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  useEffect(() => setCollapsed(false), [nodeId, errorCount, warningCount]);

  if (issues.length === 0) return null;

  const panelTone = getPanelTone(errorCount > 0);
  const summary = getSummary(errorCount, warningCount);

  return (
    <section className={`relative mt-3 rounded-lg border-2 px-3 py-2 ${panelTone.panel}`}>
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className="absolute right-3 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-slate-600 bg-slate-900 text-slate-200
         hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60"
        aria-label={collapsed ? "Mostrar detalles" : "Ocultar detalles"}
        title={collapsed ? "Mostrar detalles" : "Ocultar detalles"}
      >
        {collapsed ? (
          <ChevronDown aria-hidden="true" size={16} strokeWidth={2} />
        ) : (
          <ChevronUp aria-hidden="true" size={16} strokeWidth={2} />
        )}
      </button>

      <div className="px-9 text-center">
        <h5 className={`text-sm font-semibold ${panelTone.heading}`}>
          Diagnóstico de la escena
        </h5>

        <p className="mt-0.5 text-[12px] text-slate-100">
          Esta escena tiene {summary}. Revisa los puntos marcados antes de exportar o probar la aventura.
        </p>
      </div>

      {!collapsed ? (
        <div className="editor-scroll mt-2 mb-2 max-h-44 space-y-2 overflow-y-auto pr-1">
          {issues.map((issue) => {
            const issueTone = getIssueTone(issue);

            return (
              <article
                key={issue.id}
                className={`rounded-md border px-3 py-2 ${issueTone.item}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${issue.severity === "error" ? "bg-red-400" : "bg-amber-300"}`} />
                      <p className="text-[13px] font-semibold text-slate-100">
                        {getIssueTitle(issue)}
                      </p>
                    </div>

                    <p className="mt-1 text-[12px] text-slate-300 text-left ml-1">
                      {issue.location.label}
                    </p>
                  </div>

                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${issueTone.badge}`}>
                    {getSeverityLabel(issue)}
                  </span>
                </div>

                <p className="mt-1 text-[12px] text-left ml-1 leading-relaxed text-slate-200">
                  {issue.message}
                </p>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
