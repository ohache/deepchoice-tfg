import type { ID, Node, Project, NodeMapLocation, NodeMeta } from "@/domain/types";
import { safeTrim, removeAsset, removeAssetFile, deepClonePojo } from "@/features/editor/core/editorDataUtils";
import { generateId } from "@/utils/id";
import { initialHotspotEditorState } from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";
import { ensureNodeHasLayoutPure, resolveDraftMetaWithFallback } from "@/features/editor/history/view/nodeLayout";

/* Crea un draft de nodo vacío */
export function createEmptyDraftNode(): Node {
  return {
    id: generateId.node(),
    title: "",
    layers: [],
    meta: {},
  };
}

export function buildNodeFromDraft(args: { draft: Node; id: ID; fallbackLayout: { x: number; y: number }; autoStart?: boolean }): Node {
  const { draft, id, fallbackLayout, autoStart = false } = args;

  const title = safeTrim(draft.title);
  const willBeFinal = Boolean(draft.isFinal);

  return ensureNodeHasLayoutPure(
    {
      ...draft,
      id,
      title,
      layers: deepClonePojo(draft.layers ?? []),
      dialogues: deepClonePojo(draft.dialogues ?? []),
      meta: resolveDraftMetaWithFallback(draft, fallbackLayout),
      musicTrackId: normalizeOptionalId(draft.musicTrackId),
      mapLocation: draft.mapLocation || undefined,
      isFinal: willBeFinal ? true : undefined,
      isStart: willBeFinal ? undefined : draft.isStart ? true : autoStart ? true : undefined,
    },
    fallbackLayout,
  );
}

export function buildNodeFromEditDraft(args: { prev: Node; draft: Node; nextMeta: NodeMeta}): Node {
  const { prev, draft, nextMeta } = args;

  return {
    ...prev,
    title: safeTrim(draft.title),

    layers: deepClonePojo(draft.layers ?? prev.layers ?? []),
    dialogues: deepClonePojo(draft.dialogues ?? prev.dialogues ?? []),

    musicTrackId: normalizeOptionalId(draft.musicTrackId),
    mapLocation: draft.mapLocation ?? undefined,

    isStart: draft.isStart || undefined,
    isFinal: draft.isFinal || undefined,

    meta: nextMeta,
  };
}

/* Resetea el estado de la interacción */
export function resetInteractionState() {
  return {
    activeLayerId: null,
    hotspotEditor: initialHotspotEditorState,
    selectedInteractionKind: null,
    selectedInteractionId: null,
  };
}

export function normalizeOptionalId(value: ID | null | undefined): ID | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}


/* Compara dos localizaciones de mapa */
export function sameMapLocation(a?: NodeMapLocation, b?: NodeMapLocation): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (a.mapId === b.mapId && a.regionId === b.regionId && Boolean(a.isEntry) === Boolean(b.isEntry));
}

function sameRegionRef(a?: NodeMapLocation, b?: NodeMapLocation): boolean {
  if (!a || !b) return false;
  return a.mapId === b.mapId && a.regionId === b.regionId;
}

/* Fuerza o elimina la marca de entrada en mapLocation */
function setNodeEntryFlag(node: Node, isEntry: boolean): Node {
  if (!node.mapLocation) return node;

  return {
    ...node,
    mapLocation: { ...node.mapLocation, isEntry: isEntry ? true : undefined },
  };
}

/* Garantiza consistencia de escenas de entrada por región */
export function reconcileNodeMapEntries(nodes: Node[], nodeId: ID, prevLoc?: NodeMapLocation): Node[] {
  const currentNode = nodes.find((node) => node.id === nodeId) ?? null;
  const currentLoc = currentNode?.mapLocation;

  let nextNodes = nodes;

  if (currentLoc) {
    const peersInTarget = nextNodes.filter((node) => node.id !== nodeId && node.mapLocation?.mapId === currentLoc.mapId && node.mapLocation?.regionId === currentLoc.regionId);

    const hasOtherEntryInTarget = peersInTarget.some((node) => Boolean(node.mapLocation?.isEntry));

    const shouldCurrentBeEntry = Boolean(currentLoc.isEntry) || (!hasOtherEntryInTarget && peersInTarget.length === 0);

    if (shouldCurrentBeEntry) {
      nextNodes = nextNodes.map((node) => {
        if (node.id !== nodeId && node.mapLocation?.mapId === currentLoc.mapId && node.mapLocation?.regionId === currentLoc.regionId) return setNodeEntryFlag(node, false);

        if (node.id === nodeId) return setNodeEntryFlag(node, true);
        return node;
      });
    } else {
      nextNodes = nextNodes.map((node) => node.id === nodeId ? setNodeEntryFlag(node, false) : node);
    }
  }

  if (prevLoc?.isEntry) {
    const currentNodeAfter = nextNodes.find((node) => node.id === nodeId) ?? null;
    const currentLocAfter = currentNodeAfter?.mapLocation;

    const currentStillOwnsOldRegionEntry = currentLocAfter && sameRegionRef(currentLocAfter, prevLoc) && Boolean(currentLocAfter.isEntry);

    if (!currentStillOwnsOldRegionEntry) {
      const oldRegionPeers = nextNodes.filter((node) => node.id !== nodeId && node.mapLocation?.mapId === prevLoc.mapId && node.mapLocation?.regionId === prevLoc.regionId);

      const oldRegionAlreadyHasEntry = oldRegionPeers.some((node) => Boolean(node.mapLocation?.isEntry));

      if (!oldRegionAlreadyHasEntry && oldRegionPeers.length > 0) {
        const promotedId = oldRegionPeers[0]!.id;

        nextNodes = nextNodes.map((node) => {
          if (node.mapLocation?.mapId === prevLoc.mapId && node.mapLocation?.regionId === prevLoc.regionId) return setNodeEntryFlag(node, node.id === promotedId);

          return node;
        });
      }
    }
  }

  return nextNodes;
}

/* Repara la entrada de región cuando se elimina una escena */  // MOVER A DELETE REFERENCE CLEANER
export function reconcileRegionEntryAfterNodeMapRemoval(nodes: Node[], removedLoc?: NodeMapLocation): Node[] {
  if (!removedLoc?.isEntry) return nodes;

  const peers = nodes.filter((node) => node.mapLocation?.mapId === removedLoc.mapId && node.mapLocation?.regionId === removedLoc.regionId);

  const alreadyHasEntry = peers.some((node) => Boolean(node.mapLocation?.isEntry));
  if (alreadyHasEntry || peers.length === 0) return nodes;

  const promotedId = peers[0]!.id;

  return nodes.map((node) => {
    if (node.mapLocation?.mapId === removedLoc.mapId && node.mapLocation?.regionId === removedLoc.regionId) return setNodeEntryFlag(node, node.id === promotedId);

    return node;
  });
}

/* Reconstruye los sceneIds y entrySceneId de cada región a partir de los nodos */
export function rebuildMapsFromNodes(maps: Project["maps"], nodes: Node[]): Project["maps"] {
  return (maps ?? []).map((map) => ({
    ...map,
    regions: (map.regions ?? []).map((region) => {
      const regionNodes = nodes.filter((node) => node.mapLocation?.mapId === map.id && node.mapLocation?.regionId === region.id);

      const entryNode = regionNodes.find((node) => Boolean(node.mapLocation?.isEntry)) ?? null;

      return {
        ...region,
        sceneIds: regionNodes.map((node) => node.id),
        entrySceneId: entryNode?.id ?? undefined,
      };
    }),
  }));
}

/* Recolecta assets de background realmente usados por los nodos */
function collectUsedBackgroundAssetIds(nodes: Node[]): Set<ID> {
  const used = new Set<ID>();

  for (const node of nodes ?? []) {
    for (const layer of node.layers ?? []) {
      const assetId = safeTrim(String(layer.assetId ?? ""));
      if (assetId) used.add(assetId);
    }
  }

  return used;
}

/* Limpia assets de background no usados y sus files asociados */
export function cleanupUnusedBackgroundAssets(args: { project: Project; assetFiles: Record<ID, File>; nodes: Node[] }): { project: Project; assetFiles: Record<ID, File> } {
  const { project, assetFiles, nodes } = args;
  const usedBackgroundIds = collectUsedBackgroundAssetIds(nodes);

  let nextAssets = project.assets;
  let nextAssetFiles = assetFiles;

  for (const asset of project.assets ?? []) {
    if (asset.kind !== "backgrounds") continue;
    if (usedBackgroundIds.has(asset.id)) continue;

    const assetResult = removeAsset(nextAssets, { id: asset.id, kind: "backgrounds" });
    nextAssets = assetResult.assets;

    const fileResult = removeAssetFile(nextAssetFiles, asset.id);
    nextAssetFiles = fileResult.assetFiles;
  }

  return {
    project: { ...project, assets: nextAssets },
    assetFiles: nextAssetFiles,
  };
}

/* Busca conflicto si la escena actual quiere ser la escena inicial */
export function findStartConflict(args: { nodes: Node[]; wantsStart: boolean; excludeId?: ID | null }) {
  const { nodes, wantsStart, excludeId = null } = args;

  if (!wantsStart) return null;

  const existing = (nodes ?? []).find((n) => Boolean(n.isStart) && (!excludeId || n.id !== excludeId)) ?? null;

  if (!existing) return null;

  const title = (existing.title ?? "").trim();
  return { id: existing.id, title: title || String(existing.id) };
}

/* Obtiene información de la región de mapa asociada al borrador actual */
export function getRegionInfo(args: { nodes: Node[]; nodeDraft: Node | null; excludeId?: ID | null; currentNodeId?: ID | null }) {
  const { nodes, nodeDraft, excludeId = null, currentNodeId = null } = args;

  const mapId = nodeDraft?.mapLocation?.mapId ?? null;
  const regionId = nodeDraft?.mapLocation?.regionId ?? null;
  if (!mapId || !regionId) return null;

  const regionNodes = (nodes ?? []).filter((node) => {
    if (excludeId && node.id === excludeId) return false;

    return node.mapLocation?.mapId === mapId && node.mapLocation?.regionId === regionId;
  });

  const currentEntry = regionNodes.find((node) => Boolean(node.mapLocation?.isEntry)) ?? null;
  const hasAnyOtherScene = regionNodes.some((node) => node.id !== currentNodeId);

  return { mapId, regionId, currentEntry, hasAnyOtherScene };
}