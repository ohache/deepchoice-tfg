import type { Hotspot, ID, Node } from "@/domain/types";

/* Devuelve IDs de nodos destino usados por hotspots que tengan algún efecto goToNode */
export function getUsedTargetNodeIds(hotspots: Hotspot[]): ID[] {
  const ids: ID[] = [];

  for (const hs of hotspots) {
    for (const it of hs.interactions ?? []) {
      for (const ef of it.effects ?? []) {
        if (ef.type === "goToNode" && ef.targetNodeId) {
          ids.push(ef.targetNodeId as ID);
        }
      }
    }
  }

  return ids;
}

/* Devuelve nodos disponibles como destino (para goToNode) */
export function getAvailableTargetNodes( allNodes: Node[], contextNodeId: ID | "DRAFT_NODE",usedTargetIds: ID[]): Node[] {
  const used = new Set<ID>(usedTargetIds ?? []);

  return (allNodes ?? []).filter((node) => {
    if (contextNodeId !== "DRAFT_NODE" && node.id === contextNodeId) return false;
    if (used.has(node.id)) return false;
    return true;
  });
}
