import type { ID, Node, Project, SceneImageLayer, TextDock } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { evaluateCondition } from "@/engine/conditions/evaluateConditions";
import { isEmptyCondition } from "@/features/editor/core/editorGenericSlice";

export function pickNodeById(project: Project, id: ID): Node | null {
  return project.nodes.find((node) => node.id === id) ?? null;
}

export function indexOfNode(project: Project, id: ID): number {
  return project.nodes.findIndex((node) => node.id === id);
}

export function nodeIdAtIndex(project: Project, index: number): ID | null {
  return project.nodes[index]?.id ?? null;
}

export function pickActiveLayer(node: Node, gameState: GameState): SceneImageLayer | null {
  const layers = node.layers ?? [];

  if (layers.length === 0) return null;

  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i];

    if (!layer.when || isEmptyCondition(layer.when) || evaluateCondition(gameState, layer.when)) return layer;
  }

  return layers[0] ?? null;
}

export function pickActiveText(layer: SceneImageLayer | null, gameState: GameState): { text: string; dock: TextDock } {
  if (!layer) return { text: "", dock: "bottom" };

  const dock: TextDock = layer.dock ?? "bottom";
  const entries = layer.text ?? [];

  for (const entry of entries) {
    if (!entry.when || isEmptyCondition(entry.when)) continue;

    if (evaluateCondition(gameState, entry.when)) return { text: entry.content ?? "", dock };
  }

  const fallback = entries.find((entry) => !entry.when || isEmptyCondition(entry.when)) ?? entries[0];

  return { text: fallback?.content ?? "", dock };
}

export function pickActiveMusicTrackId(node: Node, gameState: GameState): ID | undefined {
  const activeLayer = pickActiveLayer(node, gameState);

  if (activeLayer?.musicTrackId) return activeLayer.musicTrackId;
  if (node.musicTrackId) return node.musicTrackId;

  const loc = node.mapLocation;
  if (!loc) return undefined;

  const map = gameState.project.maps.find((candidate) => candidate.id === loc.mapId) ?? null;
  const region = map?.regions.find((candidate) => candidate.id === loc.regionId) ?? null;

  return region?.musicTrackId;
}

export function findPlacedItemShapeByInstanceId(project: Project, instanceId: ID) {
  for (const node of project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      for (const placedItem of layer.placedItems ?? []) {
        if (placedItem.id === instanceId) {
          return placedItem.shape;
        }
      }
    }
  }

  return null;
}