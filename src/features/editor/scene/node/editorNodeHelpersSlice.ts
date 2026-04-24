import type { ID, Node, Project, SceneImageLayer, NodeMapLocation } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import { generateId } from "@/utils/id";
import { safeTrim, createDefaultNodeMeta, removeAsset, removeAssetFile } from "@/features/editor/core/editorGenericSlice";
import { computeLayoutForNewNode, ensureNodeHasLayoutPure } from "@/features/editor/history/view/nodeLayout";
import { GRID_TILE_SIZE, HISTORY_VIEW_COLUMNS, NODE_SLOT_OFFSET } from "@/features/editor/history/view/historyViewTypes";

export type NodeValidationIssue = {
  path: string;
  message: string;
};

/* Indexa errores por path, conservando el primero encontrado */
export function indexNodeIssues(issues: NodeValidationIssue[]): Record<string, NodeValidationIssue> {
  const out: Record<string, NodeValidationIssue> = {};

  for (const issue of issues ?? []) {
    if (!issue?.path) continue;
    if (!out[issue.path]) out[issue.path] = issue;
  }

  return out;
}

export function normalizeNodeTitle(value: string): string {
  return safeTrim(value).toLowerCase();
}

/* Comprueba si ya existe otro nodo con el mismo título */
export function isDuplicateNodeTitle(nodes: Node[], title: string, excludeId?: ID): boolean {
  const normalizedTitle = normalizeNodeTitle(title);
  if (!normalizedTitle) return false;

  return (nodes ?? []).some((node) =>
      node.id !== excludeId && normalizeNodeTitle(node.title ?? "") === normalizedTitle
  );
}

/* Crea un draft de nodo vacío */
export function createEmptyDraftNode(): Node {
  return {
    id: generateId.node(),
    title: "",
    layers: [],
    meta: createDefaultNodeMeta(),
  };
}

export function ensureDraftHasLayout(node: Node, fallback: { x: number; y: number }): Node {
  return ensureNodeHasLayoutPure(node, fallback);
}

/* Calcula el fallback de layout para un nuevo nodo */
export function computeNewNodeFallbackLayout(nodes: Node[]): { x: number; y: number } {
  return computeLayoutForNewNode({
    nodes,
    tileSize: GRID_TILE_SIZE,
    offset: NODE_SLOT_OFFSET,
    start: { x: NODE_SLOT_OFFSET, y: NODE_SLOT_OFFSET },
    rowScan: HISTORY_VIEW_COLUMNS,
  });
}

/* Compara dos localizaciones de mapa */
export function sameMapLocation(a?: NodeMapLocation, b?: NodeMapLocation): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (a.mapId === b.mapId && a.regionId === b.regionId && Boolean(a.isEntry) === Boolean(b.isEntry));
}

/* Compara dos capas por referencia/campos relevantes */
export function sameLayer(a: SceneImageLayer, b: SceneImageLayer): boolean {
  if (a === b) return true;

  return (a.id === b.id && a.assetId === b.assetId && a.label === b.label && a.dock === b.dock && a.when === b.when && a.text === b.text && a.hotspots === b.hotspots &&
    a.placedItems === b.placedItems && a.placedNpcs === b.placedNpcs && a.placedPlayers === b.placedPlayers && a.musicTrackId === b.musicTrackId);
}

export function hasBaseLayer(layers: SceneImageLayer[]): boolean {
  return (layers ?? []).some((layer) => !layer.when);
}

/* Detecta si una misma imagen se usa más de una vez en las capas */
export function hasDuplicateLayerAssets(layers: SceneImageLayer[]): boolean {
  const seen = new Set<string>();

  for (const layer of layers ?? []) {
    const assetId = safeTrim(String(layer?.assetId ?? ""));
    if (!assetId) continue;

    if (seen.has(assetId)) return true;
    seen.add(assetId);
  }

  return false;
}

export function sameRegionRef(a?: NodeMapLocation, b?: NodeMapLocation): boolean {
  if (!a || !b) return false;
  return a.mapId === b.mapId && a.regionId === b.regionId;
}

/* Fuerza o elimina la marca de entrada en mapLocation */
export function setNodeEntryFlag(node: Node, isEntry: boolean): Node {
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
    const peersInTarget = nextNodes.filter((node) =>
        node.id !== nodeId && node.mapLocation?.mapId === currentLoc.mapId && node.mapLocation?.regionId === currentLoc.regionId
    );

    const hasOtherEntryInTarget = peersInTarget.some((node) => Boolean(node.mapLocation?.isEntry));

    const shouldCurrentBeEntry = Boolean(currentLoc.isEntry) || (!hasOtherEntryInTarget && peersInTarget.length === 0);

    if (shouldCurrentBeEntry) {
      nextNodes = nextNodes.map((node) => {
        if (node.id !== nodeId && node.mapLocation?.mapId === currentLoc.mapId && node.mapLocation?.regionId === currentLoc.regionId) {
          return setNodeEntryFlag(node, false);
        }

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
      const oldRegionPeers = nextNodes.filter((node) =>
          node.id !== nodeId && node.mapLocation?.mapId === prevLoc.mapId && node.mapLocation?.regionId === prevLoc.regionId
      );

      const oldRegionAlreadyHasEntry = oldRegionPeers.some((node) => Boolean(node.mapLocation?.isEntry));

      if (!oldRegionAlreadyHasEntry && oldRegionPeers.length > 0) {
        const promotedId = oldRegionPeers[0]!.id;

        nextNodes = nextNodes.map((node) => {
          if (node.mapLocation?.mapId === prevLoc.mapId && node.mapLocation?.regionId === prevLoc.regionId) {
            return setNodeEntryFlag(node, node.id === promotedId);
          }

          return node;
        });
      }
    }
  }

  return nextNodes;
}

/* Repara la entrada de región cuando se elimina una escena */
export function reconcileRegionEntryAfterNodeDeletion(nodes: Node[], deletedLoc?: NodeMapLocation): Node[] {
  if (!deletedLoc?.isEntry) return nodes;

  const peers = nodes.filter((node) => node.mapLocation?.mapId === deletedLoc.mapId && node.mapLocation?.regionId === deletedLoc.regionId);

  const alreadyHasEntry = peers.some((node) => Boolean(node.mapLocation?.isEntry));
  if (alreadyHasEntry || peers.length === 0) return nodes;

  const promotedId = peers[0]!.id;

  return nodes.map((node) => {
    if (node.mapLocation?.mapId === deletedLoc.mapId && node.mapLocation?.regionId === deletedLoc.regionId) {
      return setNodeEntryFlag(node, node.id === promotedId);
    }

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

/* Comprueba que la localización de mapa exista realmente en el proyecto */
export function isValidNodeMapLocation(project: Project | null, loc?: NodeMapLocation): boolean {
  if (!loc) return true;
  if (!project) return false;

  const map = (project.maps ?? []).find((entry) => entry.id === loc.mapId);
  if (!map) return false;

  return (map.regions ?? []).some((region) => region.id === loc.regionId);
}

/* Recolecta assets de background realmente usados por los nodos */
export function collectUsedBackgroundAssetIds(nodes: Node[]): Set<ID> {
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

/* Valida el draft activo del nodo */
export function validateNodeDraft(args: { draft: Node; project: Project | null; editingId: ID | null }): NodeValidationIssue[] {
  const { draft, project, editingId } = args;
  const issues: NodeValidationIssue[] = [];

  const title = safeTrim(draft.title);
  if (!title) issues.push({ path: "title", message: "El título no puede estar vacío." });

  const nodes = project?.nodes ?? [];
  if (title && isDuplicateNodeTitle(nodes, title, editingId ?? undefined)) {
    issues.push({ path: "title", message: "Ya existe una escena con ese título." });
  }

  if (Boolean(draft.isStart) && Boolean(draft.isFinal)) {
    issues.push({ path: "flags", message: "Una escena no puede ser inicial y final a la vez." });
  }

  const hasLayout = Boolean(draft.meta?.layout) && Number.isFinite(draft.meta?.layout?.x) && Number.isFinite(draft.meta?.layout?.y);

  if (!hasLayout) {
    issues.push({ path: "meta.layout", message: "La escena debe tener layout." });
  }

  if (!isValidNodeMapLocation(project, draft.mapLocation)) {
    issues.push({ path: "mapLocation", message: "La localización del mapa no es válida." });
  }

  const layers = draft.layers ?? [];

  if (layers.length === 0) {
    issues.push({ path: "layers", message: "La escena necesita al menos una capa." });
  }

  if (layers.length > 0 && !hasBaseLayer(layers)) {
    issues.push({ path: "layers", message: "La escena necesita una capa base (sin condición)." });
  }

  if (hasDuplicateLayerAssets(layers)) {
    issues.push({ path: "layers", message: "Hay capas duplicadas (misma imagen usada más de una vez)." });
  }

  for (const [index, layer] of layers.entries()) {
    const layerId = safeTrim(String(layer?.id ?? ""));
    const assetId = safeTrim(String(layer?.assetId ?? ""));

    if (!layerId) {
      issues.push({ path: `layers.${index}.id`, message: "La capa debe tener un identificador válido." });
    }

    if (!assetId) {
      issues.push({ path: `layers.${index}.assetId`, message: "La capa necesita una imagen válida." });
    }
  }

  return issues;
}

/* Construye una nueva capa de escena */
export function createNodeLayer(args: { assetId: ID; id?: ID; label?: string; when?: Condition; dock?: SceneImageLayer["dock"] }): SceneImageLayer {
  return {
    id: safeTrim(String(args.id ?? "")) || generateId.layer(),
    assetId: safeTrim(String(args.assetId ?? "")),
    dock: args.dock ?? "bottom",
    label: safeTrim(args.label ?? "") || "Capa",
    when: args.when ?? undefined,
    text: [],
  };
}

/* Aplica patch a una capa existente, ignorando id */
export function patchNodeLayer(prev: SceneImageLayer, patch: Partial<SceneImageLayer>): SceneImageLayer {
  const { id: _ignoredId, ...rest } = patch;
  return { ...prev, ...rest };
}

/* Reordena capas de forma segura */
export function reorderNodeLayersList(layers: SceneImageLayer[], fromIndex: number, toIndex: number): SceneImageLayer[] {
  if (fromIndex === toIndex) return layers;
  if (fromIndex < 0 || fromIndex >= layers.length) return layers;
  if (toIndex < 0 || toIndex >= layers.length) return layers;

  const next = layers.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}