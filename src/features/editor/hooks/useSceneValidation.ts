import { useState, useCallback, useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { ID } from "@/domain/types";
import { validateDraftScene, type SceneValidationIssue } from "@/features/editor/validation/sceneValidator";

export type SceneValidationMode = "create" | "edit";

interface UseSceneValidationOptions {
  mode: SceneValidationMode;
  currentNodeId?: ID;
}

interface UseSceneValidationResult {
  issues: SceneValidationIssue[];
  errors: SceneValidationIssue[];
  warnings: SceneValidationIssue[];
  hasBlockingErrors: boolean;
  validateNow: (draft: unknown) => { ok: boolean; issues: SceneValidationIssue[] };
  clearIssues: () => void;
}

/* Hook común para validar una escena (borrador o nodo editado) */
export function useSceneValidation(options: UseSceneValidationOptions): UseSceneValidationResult {
  const project = useEditorStore((s) => s.project);
  const [issues, setIssues] = useState<SceneValidationIssue[]>([]);

  const validateNow = useCallback((draft: unknown) => {
      const ctx = project ? { project, currentNodeId: options.currentNodeId }: undefined;
      const { parsed, issues } = validateDraftScene(draft, ctx);

      setIssues(issues);

      const hasBlockingErrors = issues.some((i) => i.severity === "error");

      return { ok: !!parsed && !hasBlockingErrors, issues };
    }, [project, options.currentNodeId]
  );

  const clearIssues = useCallback(() => {
    setIssues([]);
  }, []);

  const { errors, warnings, hasBlockingErrors } = useMemo(() => {
    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");
    const hasBlockingErrors = errors.length > 0;
    return { errors, warnings, hasBlockingErrors };
  }, [issues]);

  return { issues, errors, warnings, hasBlockingErrors, validateNow, clearIssues };
}
