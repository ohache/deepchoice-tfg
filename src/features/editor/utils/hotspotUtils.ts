import type { Hotspot, ID, Node } from "@/domain/types";

export function getUsedTargetNodeIds(hotspots: Hotspot[]): ID[] {
  const ids: ID[] = [];

  for (const hs of hotspots) {
    for (const action of hs.actions) {
      if (action.type === "goToNode") {
        ids.push(action.targetNodeId);
      }
    }
  }

  return ids;
}

export function getAvailableTargetNodes(allNodes: Node[], currentNodeId: ID, usedTargetIds: ID[]): Node[] {
  return allNodes.filter(
    (node) => node.id !== currentNodeId && !usedTargetIds.includes(node.id)
  );
}