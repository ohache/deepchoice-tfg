import type { Condition } from "@/domain/conditions";
import type { ConditionalTextEntry, ID, Node, SceneImageLayer } from "@/domain/types";
import { safeTrim } from "@/features/editor/core/editorDataUtils";
import { generateId } from "@/utils/id";

/* Compara dos capas por referencia/campos relevantes */ // UTILIZADO POR LAYER SLICE
export function sameLayer(a: SceneImageLayer, b: SceneImageLayer): boolean {
  if (a === b) return true;

  return (a.id === b.id && a.assetId === b.assetId && a.label === b.label && a.dock === b.dock && a.when === b.when && a.text === b.text && a.hotspots === b.hotspots &&
    a.placedItems === b.placedItems && a.placedNpcs === b.placedNpcs && a.placedPlayers === b.placedPlayers && a.musicTrackId === b.musicTrackId);
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

export function sameEntry(a: ConditionalTextEntry, b: ConditionalTextEntry): boolean {
  if (a === b) return true;
  return a.id === b.id && a.label === b.label && a.when === b.when && a.content === b.content;
}

export function findLayerById(node: Node | null, layerId: ID | null): SceneImageLayer | null {
  if (!node || !layerId) return null;

  return (node.layers ?? []).find((layer) => layer.id === layerId) ?? null;
}

export function getFirstTextEntryIdFromLayer(layer: SceneImageLayer | null): ID | null {
  return layer?.text?.[0]?.id ?? null;
}

export function getFirstTextEntryIdFromLayers(layers: SceneImageLayer[]): ID | null {
  return layers[0]?.text?.[0]?.id ?? null;
}

export function getActiveLayer(nodeDraft: Node | null, activeLayerId: ID | null): SceneImageLayer | null {
  if (!nodeDraft || !activeLayerId) return null;

  return nodeDraft.layers?.find((layer) => layer.id === activeLayerId) ?? null;
}