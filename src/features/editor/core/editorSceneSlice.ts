import type {
  ID,
  Node,
  Hotspot,
  HotspotShape,
  PlacedItem,
  PlacedNpc,
  FreeHotspotEffect,
  FreeHotspotEffectType,
  HotspotInteraction,
  HotspotVerb,
  NodeMeta,
} from "@/domain/types";
import { generateHotspotInteraction, generateNodeId, generateHotspotId, generateId } from "@/utils/id";
import { computeNewNodeLayout } from "@/features/editor/utils/layoutUtils";

export type SceneMode = "creating" | "editing";

export interface NodeDraft {
  title: string;
  text: string;
  image?: string;

  hotspots: Hotspot[];

  musicId?: ID;
  mapId?: ID;

  placedItems?: PlacedItem[];
  placedNpcs?: PlacedNpc[];

  isStart?: boolean;
  isFinal?: boolean;

  meta?: NodeMeta;
}

const emptyRect = (): HotspotShape => ({ type: "rect", x: 0, y: 0, w: 0, h: 0 });

const createEmptyDraft = (): NodeDraft => ({
  title: "",
  text: "",
  image: undefined,
  hotspots: [],
  musicId: undefined,
  mapId: undefined,
  placedItems: [],
  placedNpcs: [],
  isStart: false,
  isFinal: false,
  meta: {},
});

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function defaultVerbForEffect(type: FreeHotspotEffectType): HotspotVerb {
  switch (type) {
    case "goToNode":
      return "go";
    case "showText":
    case "showMessage":
      return "look";
    case "setFlag":
      return "use";
  }
}

function buildInteractionSkeleton(effectType: FreeHotspotEffectType): HotspotInteraction[] {
  const id = generateHotspotInteraction();

  const effects: FreeHotspotEffect[] = (() => {
    switch (effectType) {
      case "goToNode":
        return [{ type: "goToNode", targetNodeId: "" as ID }];
      case "setFlag":
        return [{ type: "setFlag", flag: "", value: true }];
      case "showText":
        return [{ type: "showText", text: "" }];
      case "showMessage":
        return [{ type: "showMessage", text: "" }];
    }
  })();

  return [
    {
      id,
      verb: defaultVerbForEffect(effectType),
      label: undefined,
      cursor: undefined,
      conditions: [],
      effects,
    },
  ];
}

type PrimaryFreeEffect = FreeHotspotEffect | undefined;

function getPrimaryEffect(hs: Hotspot): PrimaryFreeEffect {
  return hs.interactions?.[0]?.effects?.[0];
}

function isGoToNodePrimary(
  effect: PrimaryFreeEffect
): effect is Extract<FreeHotspotEffect, { type: "goToNode" }> {
  return !!effect && effect.type === "goToNode";
}

function isRectShape(s: HotspotShape | undefined): s is Extract<HotspotShape, { type: "rect" }> {
  if (!s || s.type !== "rect") return false;
  const r = s as any;
  return typeof r.x === "number" && typeof r.y === "number" && typeof r.w === "number" && typeof r.h === "number";
}

function areRectShapesEqual(a?: HotspotShape, b?: HotspotShape) {
  if (!a || !b) return false;
  if (a.type !== "rect" || b.type !== "rect") return false;
  const ar = a as any,
    br = b as any;
  return ar.x === br.x && ar.y === br.y && ar.w === br.w && ar.h === br.h;
}

function isEmptyRectShape(s: HotspotShape | undefined): boolean {
  return areRectShapesEqual(s, emptyRect());
}

function isNonEmptyRect(s: HotspotShape | undefined): boolean {
  if (!isRectShape(s)) return false;
  return s.w > 0 && s.h > 0;
}

function getHotspotEffectType(hs: Hotspot): FreeHotspotEffectType | "" {
  const t = hs.interactions?.[0]?.effects?.[0]?.type;
  return (t ?? "") as FreeHotspotEffectType | "";
}

function getGoToTargetId(hs: Hotspot): ID | "" {
  const pe = getPrimaryEffect(hs);
  return isGoToNodePrimary(pe) ? (pe.targetNodeId as ID) : "";
}

type ActivePlacement =
  | { kind: "item"; resourceId: ID; instanceId: ID }
  | { kind: "npc"; resourceId: ID; instanceId: ID }
  | null;

export interface EditorSceneSlice {
  selectedNodeId: ID | null;
  sceneMode: SceneMode;
  draftScene: NodeDraft;

  activeHotspotDrawingId: ID | null;
  setActiveHotspotDrawingId: (hotspotId: ID | null) => void;

  focusedHotspotId: ID | null;
  setFocusedHotspotId: (id: ID | null) => void;

  activePlacement: ActivePlacement;
  beginPlaceItemForActiveScene: (itemId: ID) => void;
  beginPlaceNpcForActiveScene: (npcId: ID) => void;

  beginEditPlacedItemForActiveScene: (placedItemId: ID) => void;
  beginEditPlacedNpcForActiveScene: (placedNpcId: ID) => void;

  setPlacedItemShapeForActiveScene: (placedItemId: ID, shape: HotspotShape) => void;
  setPlacedNpcShapeForActiveScene: (placedNpcId: ID, shape: HotspotShape) => void;
  cancelPlacement: () => void;

  enterCreateMode: () => void;
  selectNode: (id: ID) => void;
  updateDraftFields: (patch: Partial<NodeDraft>) => void;
  commitDraftAsNode: () => void;
  updateSelectedNodeFields: (patch: Partial<Node>) => void;

  addHotspotToActiveScene: () => void;
  updateHotspotTargetForActiveScene: (hotspotId: ID, targetNodeId: ID) => void;
  removeHotspotFromActiveScene: (hotspotId: ID) => void;

  setHotspotActionForActiveScene: (hotspotId: ID, effectType: FreeHotspotEffectType) => void;
  setHotspotShapeForActiveScene: (hotspotId: ID, shape: HotspotShape) => void;
  clearHotspotShapeForActiveScene: (hotspotId: ID) => void;

  deleteSelectedNode: () => void;
  updateNodeLayout: (id: ID, pos: { x: number; y: number }) => void;
}

export function createEditorSceneSlice(set: any, get: any): EditorSceneSlice {
  const getProject = () => {
    const state = get();
    return (state.project as { nodes: Node[] } | null) ?? null;
  };

  const getProjectAndSelectedNode = () => {
    const state = get();
    const project = getProject();
    const selectedNodeId = state.selectedNodeId as ID | null;
    return { project, selectedNodeId, state };
  };

  const updateNodeHotspots = (nodes: Node[], nodeId: ID, updater: (hotspots: Hotspot[]) => Hotspot[]): Node[] =>
    nodes.map((node) => (node.id === nodeId ? { ...node, hotspots: updater(node.hotspots ?? []) } : node));

  const updateDraftHotspots = (draft: NodeDraft, updater: (hotspots: Hotspot[]) => Hotspot[]): NodeDraft => ({
    ...draft,
    hotspots: updater(draft.hotspots ?? []),
  });

  const applyHotspotUpdate = (updater: (hsList: Hotspot[]) => Hotspot[]) => {
    const state = get();
    const project = getProject();

    if (state.sceneMode === "creating") {
      const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
      const nextDraft = updateDraftHotspots(draft, updater);
      set({ draftScene: nextDraft, isDirty: true });
      return;
    }

    const selectedNodeId = state.selectedNodeId as ID | null;
    if (!project || !selectedNodeId) return;

    const updatedNodes = updateNodeHotspots(project.nodes, selectedNodeId, updater);
    set({ project: { ...project, nodes: updatedNodes }, isDirty: true });
  };

  const isHotspotCompleteForAdding = (hs: Hotspot | undefined, hasImage: boolean): boolean => {
    if (!hs) return true;

    const effectType = getHotspotEffectType(hs);
    if (!effectType) return false;

    if (!hasImage) return false;
    if (!isNonEmptyRect(hs.shape)) return false;

    if (effectType === "goToNode") {
      const target = getGoToTargetId(hs);
      return typeof target === "string" && target.trim().length > 0;
    }

    return true;
  };

  return {
    selectedNodeId: null,
    sceneMode: "creating",
    draftScene: createEmptyDraft(),

    activeHotspotDrawingId: null,
    setActiveHotspotDrawingId: (hotspotId) => set({ activeHotspotDrawingId: hotspotId }),

    focusedHotspotId: null,
    setFocusedHotspotId: (id) => set({ focusedHotspotId: id }),

    activePlacement: null,

    beginPlaceItemForActiveScene: (itemId: ID) => {
      const instanceId = generateId("pi");

      set((state: any) => {
        if (state.sceneMode === "creating") {
          const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
          if (!draft.image) return state;

          const placed: PlacedItem[] = [
            ...asArray<PlacedItem>(draft.placedItems),
            {
              id: instanceId,
              itemId,
              shape: emptyRect(),
              state: { visible: true, reachable: true },
              interactions: [],
            },
          ];

          return {
            ...state,
            draftScene: { ...draft, placedItems: placed },
            activePlacement: { kind: "item", resourceId: itemId, instanceId },
            isDirty: true,
          };
        }

        const project = state.project as { nodes: Node[] } | null;
        const nodeId = state.selectedNodeId as ID | null;
        if (!project || !nodeId) return state;

        const nextNodes = project.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          if (!n.image) return n;

          const nextPlaced: PlacedItem[] = [
            ...asArray<PlacedItem>(n.placedItems),
            {
              id: instanceId,
              itemId,
              shape: emptyRect(),
              state: { visible: true, reachable: true },
              interactions: [],
            },
          ];

          return { ...n, placedItems: nextPlaced };
        });

        return {
          ...state,
          project: { ...project, nodes: nextNodes },
          activePlacement: { kind: "item", resourceId: itemId, instanceId },
          isDirty: true,
        };
      });
    },

    beginPlaceNpcForActiveScene: (npcId: ID) => {
      const instanceId = generateId("pn");

      set((state: any) => {
        if (state.sceneMode === "creating") {
          const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
          if (!draft.image) return state;

          const nextPlaced: PlacedNpc[] = [
            ...(draft.placedNpcs ?? []),
            {
              id: instanceId,
              npcId,
              shape: emptyRect(),
              interactions: [],
            },
          ];

          return {
            ...state,
            draftScene: { ...draft, placedNpcs: nextPlaced },
            activePlacement: { kind: "npc", resourceId: npcId, instanceId },
            isDirty: true,
          };
        }

        const project = state.project as { nodes: Node[] } | null;
        const nodeId = state.selectedNodeId as ID | null;
        if (!project || !nodeId) return state;

        const nextNodes = project.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          if (!n.image) return n;

          const nextPlaced: PlacedNpc[] = [
            ...(n.placedNpcs ?? []),
            {
              id: instanceId,
              npcId,
              shape: emptyRect(),
              interactions: [],
            },
          ];

          return { ...n, placedNpcs: nextPlaced };
        });

        return {
          ...state,
          project: { ...project, nodes: nextNodes },
          activePlacement: { kind: "npc", resourceId: npcId, instanceId },
          isDirty: true,
        };
      });
    },

    beginEditPlacedItemForActiveScene: (placedItemId: ID) => {
      set((state: any) => {
        if (state.sceneMode === "creating") {
          const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
          const pi = (draft.placedItems ?? []).find((x: any) => x.id === placedItemId);
          if (!draft.image || !pi) return state;
          return {
            ...state,
            activePlacement: { kind: "item", resourceId: pi.itemId as ID, instanceId: placedItemId },
          };
        }

        const project = state.project as { nodes: Node[] } | null;
        const nodeId = state.selectedNodeId as ID | null;
        if (!project || !nodeId) return state;

        const node = project.nodes.find((n) => n.id === nodeId);
        const pi = (node?.placedItems ?? []).find((x: any) => x.id === placedItemId);
        if (!node?.image || !pi) return state;

        return {
          ...state,
          activePlacement: { kind: "item", resourceId: pi.itemId as ID, instanceId: placedItemId },
        };
      });
    },

    beginEditPlacedNpcForActiveScene: (placedNpcId: ID) => {
      set((state: any) => {
        if (state.sceneMode === "creating") {
          const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
          const pn = (draft.placedNpcs ?? []).find((x: any) => x.id === placedNpcId);
          if (!draft.image || !pn) return state;
          return {
            ...state,
            activePlacement: { kind: "npc", resourceId: pn.npcId as ID, instanceId: placedNpcId },
          };
        }

        const project = state.project as { nodes: Node[] } | null;
        const nodeId = state.selectedNodeId as ID | null;
        if (!project || !nodeId) return state;

        const node = project.nodes.find((n) => n.id === nodeId);
        const pn = (node?.placedNpcs ?? []).find((x: any) => x.id === placedNpcId);
        if (!node?.image || !pn) return state;

        return {
          ...state,
          activePlacement: { kind: "npc", resourceId: pn.npcId as ID, instanceId: placedNpcId },
        };
      });
    },

    setPlacedItemShapeForActiveScene: (placedItemId: ID, shape: HotspotShape) => {
      set((state: any) => {
        if (state.sceneMode === "creating") {
          const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
          const nextPlaced = asArray<PlacedItem>(draft.placedItems ?? []).map((pi: any) =>
            pi.id === placedItemId ? { ...pi, shape } : pi
          );

          return {
            ...state,
            draftScene: { ...draft, placedItems: nextPlaced },
            activePlacement: null,
            isDirty: true,
          };
        }

        const project = state.project as { nodes: Node[] } | null;
        const nodeId = state.selectedNodeId as ID | null;
        if (!project || !nodeId) return state;

        const nextNodes = project.nodes.map((n) => {
          if (n.id !== nodeId) return n;

          const nextPlaced = asArray<PlacedItem>(n.placedItems ?? []).map((pi: any) =>
            pi.id === placedItemId ? { ...pi, shape } : pi
          );

          return { ...n, placedItems: nextPlaced };
        });

        return {
          ...state,
          project: { ...project, nodes: nextNodes },
          activePlacement: null,
          isDirty: true,
        };
      });
    },

    setPlacedNpcShapeForActiveScene: (placedNpcId: ID, shape: HotspotShape) => {
      set((state: any) => {
        if (state.sceneMode === "creating") {
          const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
          const nextPlaced = (draft.placedNpcs ?? []).map((pn: any) =>
            pn.id === placedNpcId ? { ...pn, shape } : pn
          );

          return {
            ...state,
            draftScene: { ...draft, placedNpcs: nextPlaced },
            activePlacement: null,
            isDirty: true,
          };
        }

        const project = state.project as { nodes: Node[] } | null;
        const nodeId = state.selectedNodeId as ID | null;
        if (!project || !nodeId) return state;

        const nextNodes = project.nodes.map((n) => {
          if (n.id !== nodeId) return n;

          const nextPlaced = (n.placedNpcs ?? []).map((pn: any) =>
            pn.id === placedNpcId ? { ...pn, shape } : pn
          );

          return { ...n, placedNpcs: nextPlaced };
        });

        return {
          ...state,
          project: { ...project, nodes: nextNodes },
          activePlacement: null,
          isDirty: true,
        };
      });
    },

    cancelPlacement: () => {
      set((state: any) => {
        const ap = state.activePlacement as ActivePlacement;
        if (!ap) return state;

        const shouldRemove = (draftOrNode: any) => {
          if (ap.kind === "item") {
            const pi = (draftOrNode.placedItems ?? []).find((x: any) => x.id === ap.instanceId);
            return !pi || isEmptyRectShape(pi.shape);
          }
          const pn = (draftOrNode.placedNpcs ?? []).find((x: any) => x.id === ap.instanceId);
          return !pn || isEmptyRectShape(pn.shape);
        };

        const removePlaced = (draftOrNode: any) => {
          if (ap.kind === "item") {
            return {
              ...draftOrNode,
              placedItems: (draftOrNode.placedItems ?? []).filter((x: any) => x.id !== ap.instanceId),
            };
          }
          return {
            ...draftOrNode,
            placedNpcs: (draftOrNode.placedNpcs ?? []).filter((x: any) => x.id !== ap.instanceId),
          };
        };

        if (state.sceneMode === "creating") {
          const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
          const nextDraft = shouldRemove(draft) ? removePlaced(draft) : draft;
          return { ...state, draftScene: nextDraft, activePlacement: null, isDirty: true };
        }

        const project = state.project as { nodes: Node[] } | null;
        const nodeId = state.selectedNodeId as ID | null;
        if (!project || !nodeId) return { ...state, activePlacement: null };

        const nextNodes = project.nodes.map((n: any) => {
          if (n.id !== nodeId) return n;
          return shouldRemove(n) ? removePlaced(n) : n;
        });

        return { ...state, project: { ...project, nodes: nextNodes }, activePlacement: null, isDirty: true };
      });
    },

    enterCreateMode: () => {
      set((state: any) => ({
        ...state,
        sceneMode: "creating",
        selectedNodeId: null,
        draftScene: createEmptyDraft(),
        activeHotspotDrawingId: null,
        focusedHotspotId: null,
        activePlacement: null,
      }));
    },

    selectNode: (id: ID) => {
      const project = getProject();
      if (!project) return;

      const exists = project.nodes.some((n) => n.id === id);
      if (!exists) return;

      set((state: any) => ({
        ...state,
        selectedNodeId: id,
        sceneMode: "editing",
        draftScene: state.draftScene ?? createEmptyDraft(),
        activeHotspotDrawingId: null,
        focusedHotspotId: null,
        activePlacement: null,
      }));
    },

    updateDraftFields: (patch: Partial<NodeDraft>) => {
      set((state: any) => {
        const prevDraft: NodeDraft = state.draftScene ?? createEmptyDraft();

        let nextDraft: NodeDraft = { ...prevDraft, ...patch };

        if (patch.isStart === true) nextDraft = { ...nextDraft, isFinal: false };
        if (patch.isFinal === true) nextDraft = { ...nextDraft, isStart: false };

        return { ...state, draftScene: nextDraft, isDirty: true };
      });
    },

    commitDraftAsNode: () => {
      const project = getProject();
      if (!project) return;

      const state = get();
      const draft: NodeDraft = state.draftScene ?? createEmptyDraft();

      const trimmedTitle = draft.title.trim();
      if (!trimmedTitle) return;

      const newId = generateNodeId();

      // layout garantizado (si no venía)
      const prevMeta: NodeMeta = (draft.meta ?? {}) as NodeMeta;
      let nextMeta: NodeMeta = prevMeta;

      if (!nextMeta.layout) {
        nextMeta = {
          ...prevMeta,
          layout: computeNewNodeLayout({
            nodes: project.nodes,
            draftMeta: draft.meta,
            grid: 80,
            gapCells: 2,
            start: { x: 80, y: 80 },
          }),
        };
      }

      const newNode: Node = {
        id: newId,
        title: trimmedTitle,
        text: draft.text ?? "",
        image: draft.image ?? "",
        hotspots: draft.hotspots ?? [],
        musicId: draft.musicId,
        mapId: draft.mapId,
        placedItems: asArray<PlacedItem>(draft.placedItems),
        placedNpcs: asArray<PlacedNpc>(draft.placedNpcs),
        isStart: !!draft.isStart,
        isFinal: !!draft.isFinal,
        meta: nextMeta,
      };

      if (project.nodes.length === 0 || draft.isStart) newNode.isStart = true;

      set({
        project: { ...project, nodes: [...project.nodes, newNode] },
        selectedNodeId: newId,
        sceneMode: "editing",
        draftScene: createEmptyDraft(),
        isDirty: true,
        activeHotspotDrawingId: null,
        focusedHotspotId: null,
        activePlacement: null,
      });
    },

    updateSelectedNodeFields: (patch: Partial<Node>) => {
      const { project, selectedNodeId } = getProjectAndSelectedNode();
      if (!project || !selectedNodeId) return;

      const updatedNodes = project.nodes.map((node) => (node.id === selectedNodeId ? { ...node, ...patch } : node));
      set({ project: { ...project, nodes: updatedNodes }, isDirty: true });
    },

    addHotspotToActiveScene: () => {
      const state = get();
      const project = getProject();

      const makeNewHotspot = (): Hotspot => ({
        id: generateHotspotId(),
        shape: emptyRect(),
        label: undefined,
        interactions: [],
      });

      if (state.sceneMode === "creating") {
        const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
        const hsList = draft.hotspots ?? [];
        const last = hsList.length > 0 ? hsList[hsList.length - 1] : undefined;

        const hasImage = !!draft.image;
        if (!isHotspotCompleteForAdding(last, hasImage)) return;

        const newHotspot = makeNewHotspot();
        const nextDraft = updateDraftHotspots(draft, (hs) => [...hs, newHotspot]);

        set({ draftScene: nextDraft, isDirty: true, focusedHotspotId: newHotspot.id });
        return;
      }

      const selectedNodeId = state.selectedNodeId as ID | null;
      if (!project || !selectedNodeId) return;

      const node = project.nodes.find((n) => n.id === selectedNodeId);
      const hsList = node?.hotspots ?? [];
      const last = hsList.length > 0 ? hsList[hsList.length - 1] : undefined;

      const hasImage = !!node?.image;
      if (!isHotspotCompleteForAdding(last, hasImage)) return;

      const newHotspot = makeNewHotspot();
      const updatedNodes = updateNodeHotspots(project.nodes, selectedNodeId, (hs) => [...hs, newHotspot]);

      set({ project: { ...project, nodes: updatedNodes }, isDirty: true, focusedHotspotId: newHotspot.id });
    },

    setHotspotActionForActiveScene: (hotspotId: ID, effectType: FreeHotspotEffectType) => {
      applyHotspotUpdate((hsList) =>
        hsList.map((hs) => {
          if (hs.id !== hotspotId) return hs;

          const nextShape = areRectShapesEqual(hs.shape, emptyRect()) ? hs.shape : emptyRect();

          return {
            ...hs,
            shape: nextShape,
            interactions: buildInteractionSkeleton(effectType),
          };
        })
      );
    },

    setHotspotShapeForActiveScene: (hotspotId: ID, shape: HotspotShape) => {
      const state = get();
      const project = getProject();

      if (state.sceneMode === "creating") {
        const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
        const current = (draft.hotspots ?? []).find((hs) => hs.id === hotspotId);
        const currentShape = current?.shape as HotspotShape | undefined;
        if (areRectShapesEqual(currentShape, shape)) return;

        applyHotspotUpdate((hsList) => hsList.map((hs) => (hs.id === hotspotId ? { ...hs, shape } : hs)));
        return;
      }

      const selectedNodeId = state.selectedNodeId as ID | null;
      if (!project || !selectedNodeId) return;

      const node = project.nodes.find((n) => n.id === selectedNodeId);
      const current = node?.hotspots?.find((hs) => hs.id === hotspotId);
      const currentShape = current?.shape as HotspotShape | undefined;
      if (areRectShapesEqual(currentShape, shape)) return;

      applyHotspotUpdate((hsList) => hsList.map((hs) => (hs.id === hotspotId ? { ...hs, shape } : hs)));
    },

    clearHotspotShapeForActiveScene: (hotspotId: ID) => {
      applyHotspotUpdate((hsList) => hsList.map((hs) => (hs.id === hotspotId ? { ...hs, shape: emptyRect() } : hs)));
    },

    updateHotspotTargetForActiveScene: (hotspotId: ID, targetNodeId: ID) => {
      applyHotspotUpdate((hsList) =>
        hsList.map((hs) => {
          if (hs.id !== hotspotId) return hs;

          const i0 = hs.interactions?.[0];
          const e0 = i0?.effects?.[0];
          if (!i0 || !isGoToNodePrimary(e0)) return hs;

          const nextI0 = { ...i0, effects: [{ ...e0, targetNodeId }, ...(i0.effects ?? []).slice(1)] };
          return { ...hs, interactions: [nextI0, ...(hs.interactions ?? []).slice(1)] };
        })
      );
    },

    removeHotspotFromActiveScene: (hotspotId: ID) => {
      const state = get();

      if (state.activeHotspotDrawingId === hotspotId) set({ activeHotspotDrawingId: null });
      if (state.focusedHotspotId === hotspotId) set({ focusedHotspotId: null });

      applyHotspotUpdate((hsList) => hsList.filter((hs) => hs.id !== hotspotId));
    },

    deleteSelectedNode: () => {
      const { project, selectedNodeId } = getProjectAndSelectedNode();
      if (!project || !selectedNodeId) return;

      const remainingNodes = project.nodes.filter((node) => node.id !== selectedNodeId);

      set({
        project: { ...project, nodes: remainingNodes },
        selectedNodeId: null,
        isDirty: true,
        activeHotspotDrawingId: null,
        focusedHotspotId: null,
        activePlacement: null,
      });
    },

    updateNodeLayout: (id, pos) => {
      const project = getProject();
      if (!project) return;

      set((state: any) => ({
        ...state,
        project: {
          ...project,
          nodes: project.nodes.map((n) => {
            if (n.id !== id) return n;

            const prevMeta: NodeMeta = (n.meta ?? {}) as NodeMeta;
            return { ...n, meta: { ...prevMeta, layout: { x: pos.x, y: pos.y } } };
          }),
        },
        isDirty: true,
      }));
    },
  };
}
