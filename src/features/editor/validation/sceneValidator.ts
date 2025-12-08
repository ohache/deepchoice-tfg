import { DraftSceneSchema, type DraftSceneOutput } from "@/features/editor/validation/sceneSchemas";
import type { Project, ID } from "@/domain/types";
import type { ZodError } from "zod";

export type SceneValidationSeverity = "error" | "warning";

export interface SceneValidationIssue {
  field: string;
  path?: (string | number)[];
  severity: SceneValidationSeverity;
  code: string;
  message: string;
}

/** Tipo interno: una issue de Zod cualquiera */
type AnyZodIssue = ZodError<unknown>["issues"][number];

/** Mapea un issue de Zod a nuestro formato SceneValidationIssue */
function mapZodIssueToSceneIssue(issue: AnyZodIssue): SceneValidationIssue {
  const path = (issue.path ?? []).map((p) =>
    typeof p === "string" || typeof p === "number" ? p : String(p)
  );
  const field = path.length ? String(path[0]) : "scene";

  return { field, path, severity: "error", code: "schema_error", message: issue.message };
}

/** Tipos derivados del DraftScene para poder hacer type guards cómodos */
type DraftHotspot = DraftSceneOutput["hotspots"][number];
type DraftAction = DraftHotspot["actions"][number];

/** Type guard: filtra sólo acciones goToNode y permite usar targetNodeId sin error */
function isGoToNodeAction(action: DraftAction): action is Extract<DraftAction, { type: "goToNode" }> {
  return action.type === "goToNode";
}

/* Validación local: sólo contra DraftSceneSchema (shape, tipos, reglas básicas) */
export function validateDraftSceneLocal(input: unknown): { parsed?: DraftSceneOutput; issues: SceneValidationIssue[] } {
  const result = DraftSceneSchema.safeParse(input);

  if (!result.success) {
    const issues = result.error.issues.map(mapZodIssueToSceneIssue);
    return { parsed: undefined, issues };
  }

  return { parsed: result.data, issues: [] };
}

/* Validación contextual: contra el proyecto (unicidad de título, conflicto de escena inicial, destinos de hotspots válidos) */
export function validateDraftSceneAgainstProject(draft: DraftSceneOutput, project: Project, options?: { currentNodeId?: ID }): SceneValidationIssue[] {
  const issues: SceneValidationIssue[] = [];
  const currentId = options?.currentNodeId;

  const normalizedTitle = draft.title.trim().toLowerCase();

  const duplicateNode = project.nodes.find((node) => {
    if (currentId && node.id === currentId) return false;
    return node.title.trim().toLowerCase() === normalizedTitle;
  });

  if (duplicateNode) {
    issues.push({
      field: "title",
      severity: "warning",
      code: "duplicate_title",
      message: `Ya existe otra escena con el título "${duplicateNode.title}".`,
    });
  }

  if (draft.isStart) {
    const existingStart = project.nodes.find((node) => {
      if (!node.isStart) return false;
      if (currentId && node.id === currentId) return false;
      return true;
    });

    if (existingStart) {
      issues.push({
        field: "isStart",
        severity: "warning",
        code: "start_conflict",
        message: `Ya hay una escena inicial definida ("${existingStart.title}"). ¿Quieres sustituirla?`,
      });
    }
  }

  draft.hotspots.forEach((hs, index) => {
    const goAction = hs.actions.find(isGoToNodeAction);

    if (!goAction) {
      issues.push({
        field: `hotspots[${index}]`,
        path: ["hotspots", index, "actions"],
        severity: "warning",
        code: "hotspot_without_destination",
        message: `El hotspot ${index + 1} no tiene ninguna acción goToNode definida.`,
      });
      return;
    }

    const targetExists = project.nodes.some(
      (node) => node.id === goAction.targetNodeId
    );

    if (!targetExists) {
      issues.push({
        field: `hotspots[${index}]`,
        path: ["hotspots", index, "actions"],
        severity: "error",
        code: "invalid_hotspot_target",
        message: `El hotspot ${index + 1} apunta a un nodo inexistente (id: "${goAction.targetNodeId}").`,
      });
    }
  });

  return issues;
}

/* Función de alto nivel: valida contra el schema, contra el proyecto y devuelve el draft parseado y todos los issues */
export function validateDraftScene(input: unknown, ctx?: { project?: Project; currentNodeId?: ID }): { parsed?: DraftSceneOutput; issues: SceneValidationIssue[] } {
  const local = validateDraftSceneLocal(input);

  if (!local.parsed) return { parsed: undefined, issues: local.issues };

  const allIssues: SceneValidationIssue[] = [...local.issues];

  if (ctx?.project) {
    const contextualIssues = validateDraftSceneAgainstProject(local.parsed, ctx.project, { currentNodeId: ctx.currentNodeId });
    allIssues.push(...contextualIssues);
  }

  return {
    parsed: local.parsed,
    issues: allIssues,
  };
}