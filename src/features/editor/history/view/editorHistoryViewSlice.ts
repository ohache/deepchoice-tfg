import type { ID, NodeLayout } from "@/domain/types";
import type { EditorStore } from "@/store/editorStore";
import { updateManyNodeMetaLayoutsPure } from "@/features/editor/history/view/nodeLayout";

type EditorStoreLike = Pick<EditorStore, "project">;

export interface EditorHistoryViewSlice {
  updateNodeLayoutsBatch: (items: Array<{ id: ID; pos: NodeLayout }>) => void;
}

export function createEditorHistoryViewSlice(set: (partial: Partial<EditorStoreLike> | ((s: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
 get: () => EditorStoreLike): EditorHistoryViewSlice {
  return {
    updateNodeLayoutsBatch: (items) => {
      const state = get();
      const project = state.project;
      if (!project) return;
      if (!items.length) return;

      const positionsById = new Map<ID, NodeLayout>();

      for (const it of items) {
        const id = String(it?.id ?? "").trim() as ID;
        if (!id) continue;

        const x = it?.pos?.x;
        const y = it?.pos?.y;
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

        positionsById.set(id, { x, y });
      }

      if (positionsById.size === 0) return;

      const nextNodes = updateManyNodeMetaLayoutsPure({
        nodes: project.nodes ?? [],
        positionsById,
      });

      if (nextNodes === project.nodes) return;

      set({project: { ...project, nodes: nextNodes }});
    }
  };
}

