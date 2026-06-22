import type { ID, NodeLayout } from "@/domain/types";
import type { EditorStore } from "@/store/editorStore";
import { updateManyNodeMetaLayoutsPure } from "@/features/editor/history/view/nodeLayout";

type EditorStoreLike = Pick<EditorStore, "project">;

type NodeLayoutBatchItem = {
  id: ID;
  pos: NodeLayout;
};

export type EditorHistoryViewSlice =  {
  updateNodeLayoutsBatch: (items: NodeLayoutBatchItem[]) => void;
}

function buildPositionsById(items: NodeLayoutBatchItem[]): Map<ID, NodeLayout> {
  const positionsById = new Map<ID, NodeLayout>();

  for (const item of items) {
    const id = String(item?.id ?? "").trim() as ID;
    if (!id) continue;

    const x = item?.pos?.x;
    const y = item?.pos?.y;

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    positionsById.set(id, { x, y });
  }

  return positionsById;
}

export function createEditorHistoryViewSlice(set: (partial: Partial<EditorStoreLike> | ((s: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
 get: () => EditorStoreLike): EditorHistoryViewSlice {
  return {
    updateNodeLayoutsBatch: (items) => {
      const state = get();
      const project = state.project;
      if (!project) return;
      if (!items.length) return;

      const positionsById = buildPositionsById(items);

      if (positionsById.size === 0) return;

      const nextNodes = updateManyNodeMetaLayoutsPure({ nodes: project.nodes ?? [], positionsById });

      if (nextNodes === project.nodes) return;

      set({ project: { ...project, nodes: nextNodes }});
    }
  };
}

