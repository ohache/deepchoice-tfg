import type { ID, Node, Project, SceneImageLayer, NodeMapLocation, NodeMeta } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import { generateId } from "@/utils/id";
import { deepClonePojo, safeTrim, createDefaultNodeMeta } from "@/features/editor/core/editorGenericSlice";
import type { HotspotEditorState } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import { initialHotspotEditorState } from "@/features/editor/scene/hotspots/editorHotspotsSlice";
import { computeLayoutForNewNode, ensureNodeHasLayoutPure } from "@/features/editor/history/view/nodeLayout";
import { GRID_TILE_SIZE, HISTORY_VIEW_COLUMNS, NODE_SLOT_OFFSET } from "@/features/editor/history/view/historyViewTypes";

export type NodeMode = "creating" | "editing";

export type NodeValidationIssue = {
  path: string;
  message: string;
};

type EditorStoreLike = {
  project: Project | null;
  activeLayerId: ID | null;
  hotspotEditor: HotspotEditorState;
  selectedInteractionKind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | null;
  selectedInteractionId: ID | null;
};

export interface EditorNodesSlice {
  nodeMode: NodeMode;
  selectedNodeId: ID | null;
  editingNodeId: ID | null;
  nodeDraft: Node | null;
  nodeIssues: NodeValidationIssue[];

  getActiveNode: () => Node | null;
  getNodeIssueIndex: () => Record<string, NodeValidationIssue>;
  enterCreateNodeMode: () => void;
  enterEditNodeMode: (nodeId: ID) => void;
  cancelNodeDraft: () => void;
  setSelectedNodeId: (id: ID | null) => void;

  setNodeTitle: (title: string) => void;
  setNodeIsStart: (value: boolean) => void;
  setNodeIsFinal: (value: boolean) => void;
  setNodeMusicTrackId: (musicTrackId: ID | null | undefined) => void;
  setNodeMapLocation: (loc: NodeMapLocation | null | undefined) => void;
  setNodeLayout: (nodeId: ID, layout: { x: number; y: number }) => void;

  setNodeLayers: (layers: SceneImageLayer[]) => void;
  addNodeLayer: (args?: { id?: ID; label?: string; assetId?: ID; when?: Condition; dock?: SceneImageLayer["dock"] }) => ID | null;
  updateNodeLayer: (layerId: ID, patch: Partial<SceneImageLayer>) => void;
  removeNodeLayer: (layerId: ID) => void;
  reorderNodeLayers: (fromIndex: number, toIndex: number) => void;

  validateActiveNode: () => boolean;
  commitNode: () => { id: ID; title: string; mode: NodeMode } | null;
  deleteNode: (nodeId: ID) => { deletedId: ID; deletedWasStart: boolean } | null;
  clearNodeIssues: () => void;
}

type Store = EditorStoreLike & EditorNodesSlice;

function indexIssues(issues: NodeValidationIssue[]): Record<string, NodeValidationIssue> {
  const out: Record<string, NodeValidationIssue> = {};
  for (const i of issues ?? []) {
    if (!i?.path) continue;
    if (!out[i.path]) out[i.path] = i;
  }
  return out;
}

function normalizeTitle(s: string): string {
  return safeTrim(s).toLowerCase();
}

function isDuplicateTitle(nodes: Node[], title: string, excludeId?: ID): boolean {
  const t = normalizeTitle(title);
  if (!t) return false;
  return (nodes ?? []).some((n) => n.id !== excludeId && normalizeTitle(n.title ?? "") === t);
}

function createEmptyDraftNode(): Node {
  return {
    id: generateId.node(),
    title: "",
    layers: [],
    meta: createDefaultNodeMeta(),
  };
}

function ensureDraftHasLayout(node: Node, fallback: { x: number; y: number }): Node {
  return ensureNodeHasLayoutPure(node, fallback);
}

function sameMapLocation(a?: NodeMapLocation, b?: NodeMapLocation) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    a.mapId === b.mapId &&
    a.regionId === b.regionId &&
    Boolean(a.isEntry) === Boolean(b.isEntry)
  );
}

function sameLayer(a: SceneImageLayer, b: SceneImageLayer): boolean {
  if (a === b) return true;

  return (
    a.id === b.id &&
    a.assetId === b.assetId &&
    a.label === b.label &&
    a.dock === b.dock &&
    a.when === b.when &&
    a.text === b.text &&
    a.hotspots === b.hotspots &&
    a.placedItems === b.placedItems &&
    a.placedNpcs === b.placedNpcs &&
    a.placedPlayers === b.placedPlayers &&
    a.musicTrackId === b.musicTrackId
  );
}

function hasBaseLayer(layers: SceneImageLayer[]): boolean {
  return (layers ?? []).some((l) => !l.when);
}

function hasDuplicateLayerAssets(layers: SceneImageLayer[]): boolean {
  const seen = new Set<string>();
  for (const l of layers ?? []) {
    const assetId = safeTrim(String(l?.assetId ?? ""));
    if (!assetId) continue;
    if (seen.has(assetId)) return true;
    seen.add(assetId);
  }
  return false;
}

function sameRegionRef(a?: NodeMapLocation, b?: NodeMapLocation): boolean {
  if (!a || !b) return false;
  return a.mapId === b.mapId && a.regionId === b.regionId;
}

function setNodeEntryFlag(node: Node, isEntry: boolean): Node {
  if (!node.mapLocation) return node;

  return {
    ...node,
    mapLocation: {
      ...node.mapLocation,
      isEntry: isEntry ? true : undefined,
    },
  };
}

function reconcileNodeMapEntries(
  nodes: Node[],
  nodeId: ID,
  prevLoc?: NodeMapLocation
): Node[] {
  const currentNode = nodes.find((n) => n.id === nodeId) ?? null;
  const currentLoc = currentNode?.mapLocation;

  let nextNodes = nodes;

  if (currentLoc) {
    const peersInTarget = nextNodes.filter(
      (n) =>
        n.id !== nodeId &&
        n.mapLocation?.mapId === currentLoc.mapId &&
        n.mapLocation?.regionId === currentLoc.regionId
    );

    const hasOtherEntryInTarget = peersInTarget.some((n) => Boolean(n.mapLocation?.isEntry));
    const shouldCurrentBeEntry =
      Boolean(currentLoc.isEntry) || (!hasOtherEntryInTarget && peersInTarget.length === 0);

    if (shouldCurrentBeEntry) {
      nextNodes = nextNodes.map((n) => {
        if (
          n.id !== nodeId &&
          n.mapLocation?.mapId === currentLoc.mapId &&
          n.mapLocation?.regionId === currentLoc.regionId
        ) {
          return setNodeEntryFlag(n, false);
        }

        if (n.id === nodeId) return setNodeEntryFlag(n, true);
        return n;
      });
    } else {
      nextNodes = nextNodes.map((n) => (n.id === nodeId ? setNodeEntryFlag(n, false) : n));
    }
  }

  if (prevLoc?.isEntry) {
    const currentNodeAfter = nextNodes.find((n) => n.id === nodeId) ?? null;
    const currentLocAfter = currentNodeAfter?.mapLocation;
    const currentStillOwnsOldRegionEntry =
      currentLocAfter &&
      sameRegionRef(currentLocAfter, prevLoc) &&
      Boolean(currentLocAfter.isEntry);

    if (!currentStillOwnsOldRegionEntry) {
      const oldRegionPeers = nextNodes.filter(
        (n) =>
          n.id !== nodeId &&
          n.mapLocation?.mapId === prevLoc.mapId &&
          n.mapLocation?.regionId === prevLoc.regionId
      );

      const oldRegionAlreadyHasEntry = oldRegionPeers.some((n) => Boolean(n.mapLocation?.isEntry));

      if (!oldRegionAlreadyHasEntry && oldRegionPeers.length > 0) {
        const promotedId = oldRegionPeers[0]!.id;
        nextNodes = nextNodes.map((n) => {
          if (
            n.mapLocation?.mapId === prevLoc.mapId &&
            n.mapLocation?.regionId === prevLoc.regionId
          ) {
            return setNodeEntryFlag(n, n.id === promotedId);
          }
          return n;
        });
      }
    }
  }

  return nextNodes;
}

function reconcileRegionEntryAfterNodeDeletion(
  nodes: Node[],
  deletedLoc?: NodeMapLocation
): Node[] {
  if (!deletedLoc?.isEntry) return nodes;

  const peers = nodes.filter(
    (n) =>
      n.mapLocation?.mapId === deletedLoc.mapId &&
      n.mapLocation?.regionId === deletedLoc.regionId
  );

  const alreadyHasEntry = peers.some((n) => Boolean(n.mapLocation?.isEntry));
  if (alreadyHasEntry || peers.length === 0) return nodes;

  const promotedId = peers[0]!.id;

  return nodes.map((n) => {
    if (
      n.mapLocation?.mapId === deletedLoc.mapId &&
      n.mapLocation?.regionId === deletedLoc.regionId
    ) {
      return setNodeEntryFlag(n, n.id === promotedId);
    }
    return n;
  });
}

function rebuildMapsFromNodes(maps: Project["maps"], nodes: Node[]): Project["maps"] {
  return (maps ?? []).map((map) => ({
    ...map,
    regions: (map.regions ?? []).map((region) => {
      const regionNodes = nodes.filter(
        (node) =>
          node.mapLocation?.mapId === map.id &&
          node.mapLocation?.regionId === region.id
      );

      const entryNode =
        regionNodes.find((node) => Boolean(node.mapLocation?.isEntry)) ?? null;

      return {
        ...region,
        sceneIds: regionNodes.map((node) => node.id),
        entrySceneId: entryNode?.id ?? undefined,
      };
    }),
  }));
}

function isValidNodeMapLocation(project: Project | null, loc?: NodeMapLocation): boolean {
  if (!loc) return true;
  if (!project) return false;

  const map = (project.maps ?? []).find((m) => m.id === loc.mapId);
  if (!map) return false;

  return (map.regions ?? []).some((region) => region.id === loc.regionId);
}

export function createEditorNodesSlice(set: (partial: Partial<Store> | ((state: Store) => Partial<Store> | Store)) => void, get: () => Store): EditorNodesSlice {
  const validateDraft = (draft: Node, project: Project | null, editingId: ID | null): NodeValidationIssue[] => {
    const issues: NodeValidationIssue[] = [];

    const title = safeTrim(draft.title);
    if (!title) issues.push({ path: "title", message: "El título no puede estar vacío." });

    const nodes = project?.nodes ?? [];
    if (title && isDuplicateTitle(nodes, title, editingId ?? undefined)) {
      issues.push({ path: "title", message: "Ya existe una escena con ese título." });
    }

    if (Boolean(draft.isStart) && Boolean(draft.isFinal)) {
      issues.push({ path: "flags", message: "Una escena no puede ser inicial y final a la vez." });
    }

    const hasLayout = Boolean(draft.meta?.layout) && Number.isFinite(draft.meta?.layout?.x) && Number.isFinite(draft.meta?.layout?.y);
    if (!hasLayout) issues.push({ path: "meta.layout", message: "La escena debe tener layout." });

    if (!isValidNodeMapLocation(project, draft.mapLocation)) issues.push({ path: "mapLocation", message: "La localización del mapa no es válida." });

    const layers0 = draft.layers ?? [];
    if (layers0.length === 0) issues.push({ path: "layers", message: "La escena necesita al menos una capa." });
    if (layers0.length > 0 && !hasBaseLayer(layers0)) {
      issues.push({ path: "layers", message: "La escena necesita una capa base (sin condición)." });
    }
    if (hasDuplicateLayerAssets(layers0)) {
      issues.push({ path: "layers", message: "Hay capas duplicadas (misma imagen usada más de una vez)." });
    }
    for (const [i, l] of layers0.entries()) {
      const layerId = safeTrim(String(l?.id ?? ""));
      const assetId = safeTrim(String(l?.assetId ?? ""));

      if (!layerId) {
        issues.push({ path: `layers.${i}.id`, message: "La capa debe tener un identificador válido." });
      }

      if (!assetId) {
        issues.push({ path: `layers.${i}.assetId`, message: "La capa necesita una imagen válida." });
      }
    }
    return issues;
  };

  const commitCreate = (): { id: ID; title: string; mode: NodeMode } | null => {
    const s = get();
    const project = s.project;
    const draft0 = s.nodeDraft;
    if (!project || !draft0) return null;

    const nodes0 = project.nodes ?? [];
    const fallbackLayout = computeLayoutForNewNode({
      nodes: nodes0,
      tileSize: GRID_TILE_SIZE,
      offset: NODE_SLOT_OFFSET,
      start: { x: NODE_SLOT_OFFSET, y: NODE_SLOT_OFFSET },
      rowScan: HISTORY_VIEW_COLUMNS,
    });

    const draft = ensureDraftHasLayout(draft0, fallbackLayout);

    const issues = validateDraft(draft, project, null);
    if (issues.length) {
      set({ nodeIssues: issues });
      return null;
    }

    const id = draft.id;
    const title = safeTrim(draft.title);

    const hasStartAlready = (nodes0 ?? []).some((n) => Boolean(n.isStart));
    const willBeFinal = Boolean(draft.isFinal);
    const autoStart = !hasStartAlready && !willBeFinal;

    const newNodeBase: Node = {
      ...draft,
      id,
      title,
      layers: deepClonePojo(draft.layers ?? []),
      dialogues: deepClonePojo(draft.dialogues ?? []),
      meta: draft.meta ?? createDefaultNodeMeta(),
      musicTrackId: draft.musicTrackId || undefined,
      mapLocation: draft.mapLocation || undefined,
      isFinal: willBeFinal ? true : undefined,
      isStart: willBeFinal ? undefined : (draft.isStart ? true : autoStart ? true : undefined),
    };

    const newNode = ensureNodeHasLayoutPure(newNodeBase, fallbackLayout);

    let nextNodes = [...nodes0, newNode];
    if (newNode.isStart) nextNodes = nextNodes.map((n) => (n.id === newNode.id ? { ...n, isStart: true } : { ...n, isStart: false }));
    if (newNode.isFinal) nextNodes = nextNodes.map((n) => (n.id === newNode.id ? { ...n, isFinal: true } : { ...n, isFinal: false }));

    nextNodes = reconcileNodeMapEntries(nextNodes, newNode.id);
    const nextMaps = rebuildMapsFromNodes(project.maps ?? [], nextNodes);

    set((st) => ({
      ...st,
      project: { ...project, nodes: nextNodes, maps: nextMaps },
      selectedNodeId: id,
      nodeMode: "editing",
      editingNodeId: id,
      nodeDraft: deepClonePojo(newNode),
      nodeIssues: [],
    }));

    return { id, title, mode: "creating" };
  };

  const commitEdit = (): { id: ID; title: string; mode: NodeMode } | null => {
    const s = get();
    const project = s.project;
    const draft0 = s.nodeDraft;
    const editingId = s.editingNodeId;
    if (!project || !draft0 || !editingId) return null;

    const nodes0 = project.nodes ?? [];
    const prev = nodes0.find((n) => n.id === editingId);
    if (!prev) return null;

    const prevLayout = prev.meta?.layout;
    const draftMeta = draft0.meta ?? prev.meta ?? createDefaultNodeMeta();
    const nextMeta = prevLayout && (!draftMeta?.layout || !Number.isFinite(draftMeta.layout.x) || !Number.isFinite(draftMeta.layout.y))
      ? { ...draftMeta, layout: prevLayout }
      : draftMeta;


    const draft: Node = {
      ...draft0,
      id: editingId,
      meta: nextMeta,
    };

    const issues = validateDraft(draft, project, editingId);
    if (issues.length) {
      set({ nodeIssues: issues });
      return null;
    }

    const title = safeTrim(draft.title);

    const nextNode: Node = {
      ...prev,
      title,
      layers: deepClonePojo(draft.layers ?? prev.layers ?? []),
      dialogues: deepClonePojo(draft.dialogues ?? prev.dialogues ?? []),
      musicTrackId: draft.musicTrackId || undefined,
      mapLocation: draft.mapLocation || undefined,
      isStart: draft.isStart || undefined,
      isFinal: draft.isFinal || undefined,
      meta: nextMeta,
    };

    let nextNodes = nodes0.map((n) => (n.id === editingId ? nextNode : n));
    if (nextNode.isStart) nextNodes = nextNodes.map((n) => (n.id === editingId ? n : { ...n, isStart: false }));
    if (nextNode.isFinal) nextNodes = nextNodes.map((n) => (n.id === editingId ? n : { ...n, isFinal: false }));

    nextNodes = reconcileNodeMapEntries(nextNodes, nextNode.id, prev.mapLocation);
    const nextMaps = rebuildMapsFromNodes(project.maps ?? [], nextNodes);

    set((st) => ({
      ...st,
      project: { ...project, nodes: nextNodes, maps: nextMaps },
      selectedNodeId: editingId,
      nodeDraft: deepClonePojo(nextNode),
      nodeIssues: [],
      nodeMode: "editing",
      editingNodeId: editingId,
    }));

    return { id: editingId, title, mode: "editing" };
  };

  return {
    nodeMode: "creating",

    selectedNodeId: null,

    editingNodeId: null,

    nodeDraft: null,

    nodeIssues: [],

    getActiveNode: () => {
      const s = get();
      if (s.nodeDraft) return s.nodeDraft;

      const project = s.project;
      if (!project) return null;

      const id = s.selectedNodeId;
      if (!id) return null;

      return (project.nodes ?? []).find((n) => n.id === id) ?? null;
    },

    getNodeIssueIndex: () => indexIssues(get().nodeIssues),

    enterCreateNodeMode: () => {
      const draft = createEmptyDraftNode();

      const project = get().project;
      const nodes0 = project?.nodes ?? [];
      const fallbackLayout = computeLayoutForNewNode({
        nodes: nodes0,
        tileSize: GRID_TILE_SIZE,
        offset: NODE_SLOT_OFFSET,
        start: { x: NODE_SLOT_OFFSET, y: NODE_SLOT_OFFSET },
        rowScan: HISTORY_VIEW_COLUMNS,
      });

      const nextDraft = ensureDraftHasLayout(draft, fallbackLayout);

      set((s) => ({
        ...s,
        nodeMode: "creating",
        selectedNodeId: null,
        editingNodeId: null,
        nodeDraft: nextDraft,
        nodeIssues: [],
        activeLayerId: null,
        hotspotEditor: initialHotspotEditorState,
        selectedInteractionKind: null,
        selectedInteractionId: null,
      }));
    },

    enterEditNodeMode: (nodeId) => {
      set((state) => {
        const project = state.project;
        if (!project) return state;

        const node = (project.nodes ?? []).find((n) => n.id === nodeId);
        if (!node) return state;

        return {
          ...state,
          nodeMode: "editing",
          selectedNodeId: nodeId,
          editingNodeId: nodeId,
          nodeDraft: deepClonePojo(node),
          nodeIssues: [],
          activeLayerId: null,
          hotspotEditor: initialHotspotEditorState,
          selectedInteractionKind: null,
          selectedInteractionId: null,
        };
      });
    },

    cancelNodeDraft: () =>
      set((s) => ({
        ...s,
        nodeMode: "creating",
        selectedNodeId: null,
        editingNodeId: null,
        nodeDraft: null,
        nodeIssues: [],
        activeLayerId: null,
        hotspotEditor: initialHotspotEditorState,
        selectedInteractionKind: null,
        selectedInteractionId: null,
      })),

    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

    setNodeTitle: (title) =>
      set((s) => {
        if (!s.nodeDraft) return s;
        const next = typeof title === "string" ? title : "";
        if (s.nodeDraft.title === next) return s;
        return { ...s, nodeDraft: { ...s.nodeDraft, title: next } };
      }),

    setNodeIsStart: (value) =>
      set((s) => {
        if (!s.nodeDraft) return s;
        const nextIsStart = Boolean(value) ? true : undefined;
        if (Boolean(s.nodeDraft.isStart) === Boolean(nextIsStart)) return s;
        const nextIsFinal = nextIsStart ? undefined : s.nodeDraft.isFinal;
        return { ...s, nodeDraft: { ...s.nodeDraft, isStart: nextIsStart, isFinal: nextIsFinal } };
      }),

    setNodeIsFinal: (value) =>
      set((s) => {
        if (!s.nodeDraft) return s;
        const nextIsFinal = Boolean(value) ? true : undefined;
        if (Boolean(s.nodeDraft.isFinal) === Boolean(nextIsFinal)) return s;
        const nextIsStart = nextIsFinal ? undefined : s.nodeDraft.isStart;
        return { ...s, nodeDraft: { ...s.nodeDraft, isFinal: nextIsFinal, isStart: nextIsStart } };
      }),

    setNodeMusicTrackId: (musicTrackId) =>
      set((s) => {
        if (!s.nodeDraft) return s;
        const next = typeof musicTrackId === "string" && musicTrackId.trim() ? musicTrackId : undefined;
        if (s.nodeDraft.musicTrackId === next) return s;
        return { ...s, nodeDraft: { ...s.nodeDraft, musicTrackId: next } };
      }),

    setNodeMapLocation: (loc) =>
      set((s) => {
        if (!s.nodeDraft) return s;
        const next = loc ?? undefined;
        const same = sameMapLocation(s.nodeDraft.mapLocation, next);
        if (same) return s;
        return { ...s, nodeDraft: { ...s.nodeDraft, mapLocation: next } };
      }),

    setNodeLayout: (nodeId, layout) =>
      set((s) => {
        const project = s.project;
        if (!project) return s;

        const nodes0 = project.nodes ?? [];
        const idx = nodes0.findIndex((n) => n.id === nodeId);
        if (idx < 0) return s;

        const prev = nodes0[idx]!;
        const meta0 = prev.meta ?? createDefaultNodeMeta();
        const nextMeta: NodeMeta = { ...meta0, layout: { x: layout.x, y: layout.y } };

        const nextNodes = nodes0.slice();
        nextNodes[idx] = { ...prev, meta: nextMeta };

        const nextDraft = s.nodeDraft && s.editingNodeId === nodeId ? { ...s.nodeDraft, meta: nextMeta } : s.nodeDraft;

        return { ...s, project: { ...project, nodes: nextNodes }, nodeDraft: nextDraft };
      }),

    setNodeLayers: (layers) =>
      set((s) => {
        if (!s.nodeDraft) return s;
        const next = Array.isArray(layers) ? layers : [];
        if (s.nodeDraft.layers === next) return s;
        return { ...s, nodeDraft: { ...s.nodeDraft, layers: next }, nodeIssues: [] };
      }),

    addNodeLayer: (args) => {
      const s = get();
      const draft = s.nodeDraft;
      if (!draft) return null;

      const assetId = safeTrim(String(args?.assetId ?? ""));
      if (!assetId) return null;

      const layers0 = draft.layers ?? [];

      if (layers0.some((l) => safeTrim(String(l.assetId ?? "")) === assetId)) {
        set({ nodeIssues: [{ path: "layers", message: "Esa imagen ya está usada en esta escena." }], });
        return null;
      }

      const label = safeTrim(args?.label ?? "") || "Capa";
      const when = args?.when;
      const dock = (args?.dock ?? "bottom");

      const nextLayerId = safeTrim(String(args?.id ?? "")) || generateId.layer();

      const layer: SceneImageLayer = {
        id: nextLayerId,
        assetId,
        dock,
        label,
        when: when ?? undefined,
        text: [],
      };

      set({
        nodeDraft: { ...draft, layers: [...layers0, layer] },
        nodeIssues: [],
      });

      return layer.id;
    },

    updateNodeLayer: (layerId, patch) =>
      set((s) => {
        if (!s.nodeDraft) return s;

        const layers0 = s.nodeDraft.layers ?? [];
        const idx = layers0.findIndex((l) => l.id === layerId);
        if (idx < 0) return s;

        const prev = layers0[idx]!;

        const { id: _ignoredId, ...rest } = patch;

        const next = { ...prev, ...rest };
        if (sameLayer(prev, next)) return s;

        const layers1 = layers0.slice();
        layers1[idx] = next;

        return { ...s, nodeDraft: { ...s.nodeDraft, layers: layers1 }, nodeIssues: [] };
      }),

    removeNodeLayer: (layerId) =>
      set((s) => {
        if (!s.nodeDraft) return s;

        const layers0 = s.nodeDraft.layers ?? [];
        const next = layers0.filter((l) => l.id !== layerId);
        if (next.length === layers0.length) return s;

        const removedActiveLayer = s.activeLayerId === layerId;
        const removedHotspotLayer = s.hotspotEditor.context?.layerId === layerId;
        const shouldResetContext = removedActiveLayer || removedHotspotLayer;

        return {
          ...s,
          nodeDraft: { ...s.nodeDraft, layers: next },
          nodeIssues: [],
          activeLayerId: removedActiveLayer ? null : s.activeLayerId,
          hotspotEditor: shouldResetContext ? initialHotspotEditorState : s.hotspotEditor,
          selectedInteractionKind: shouldResetContext ? null : s.selectedInteractionKind,
          selectedInteractionId: shouldResetContext ? null : s.selectedInteractionId,
        };
      }),

    reorderNodeLayers: (fromIndex, toIndex) =>
      set((s) => {
        if (!s.nodeDraft) return s;
        const layers0 = s.nodeDraft.layers ?? [];
        if (fromIndex === toIndex) return s;
        if (fromIndex < 0 || fromIndex >= layers0.length) return s;
        if (toIndex < 0 || toIndex >= layers0.length) return s;

        const next = layers0.slice();
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);

        return { ...s, nodeDraft: { ...s.nodeDraft, layers: next }, nodeIssues: [] };
      }),

    validateActiveNode: () => {
      const s = get();
      const project = s.project;
      const draft = s.nodeDraft;
      if (!draft) {
        set({ nodeIssues: [] });
        return true;
      }

      const issues = validateDraft(draft, project, s.editingNodeId);
      if (issues.length === 0) {
        set({ nodeIssues: [] });
        return true;
      }

      set({ nodeIssues: issues });
      return false;
    },

    commitNode: () => {
      const s = get();
      if (!s.project || !s.nodeDraft) return null;

      if (s.nodeMode === "editing" && s.editingNodeId) return commitEdit();
      return commitCreate();
    },

    deleteNode: (nodeId) => {
      const s = get();
      const project = s.project;
      if (!project) return null;

      const nodes0 = project.nodes ?? [];
      const node = nodes0.find((n) => n.id === nodeId) ?? null;
      if (!node) return null;

      const deletedWasStart = Boolean(node.isStart);

      let nextNodes = nodes0.filter((n) => n.id !== nodeId);

      if (deletedWasStart && nextNodes.length > 0) {
        const firstId = nextNodes[0]!.id;
        nextNodes = nextNodes.map((n) => (n.id === firstId ? { ...n, isStart: true } : { ...n, isStart: false }));
      }

      nextNodes = reconcileRegionEntryAfterNodeDeletion(nextNodes, node.mapLocation);
      const nextMaps = rebuildMapsFromNodes(project.maps ?? [], nextNodes);

      set((st) => {
        const draftKilled = st.editingNodeId === nodeId;
        const selectedKilled = st.selectedNodeId === nodeId;

        return {
          ...st,
          project: { ...project, nodes: nextNodes, maps: nextMaps },
          selectedNodeId: selectedKilled ? null : st.selectedNodeId,
          nodeMode: draftKilled ? "creating" : st.nodeMode,
          editingNodeId: draftKilled ? null : st.editingNodeId,
          nodeDraft: draftKilled ? null : st.nodeDraft,
          nodeIssues: [],
          activeLayerId: draftKilled || selectedKilled ? null : st.activeLayerId,
          hotspotEditor: draftKilled || selectedKilled ? initialHotspotEditorState : st.hotspotEditor,
          selectedInteractionKind: draftKilled || selectedKilled ? null : st.selectedInteractionKind,
          selectedInteractionId: draftKilled || selectedKilled ? null : st.selectedInteractionId,
        };
      });

      return { deletedId: nodeId, deletedWasStart };
    },

    clearNodeIssues: () => set({ nodeIssues: [] }),
  };
}