import type { ID, Project } from "@/domain/types";

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  selectedNodeId: ID | null;
};

export type EditorTestSlice = {
  getSceneTestNodeId: () => ID | null;
  canOpenSceneTest: () => boolean;
};

export function createEditorTestSlice(get: () => EditorStoreLike): EditorTestSlice {
  function getValidSceneTestNodeId(): ID | null {
    const { project, selectedNodeId } = get();

    if (!project || !selectedNodeId) return null;

    const exists = project.nodes.some((node) => node.id === selectedNodeId);

    return exists ? selectedNodeId : null;
  }

  return {
    /* Devuelve la escena activa válida para el modo test */
    getSceneTestNodeId: () => getValidSceneTestNodeId(),

    /* Comprueba si se puede abrir el test */
    canOpenSceneTest: () => getValidSceneTestNodeId() !== null,
  };
}