import type { BoolOp, Condition, NumberOp } from "@/domain/conditions";
import type { ID } from "@/domain/types";
import type { GameState, NodeRuntimeState } from "@/engine/state/runtimeState";

function compareBool(actual: boolean, op: BoolOp, expected: boolean): boolean {
  return op === "==" ? actual === expected : actual !== expected;
}

function compareNumber(actual: number, op: NumberOp, expected: number): boolean {
  switch (op) {
    case "==":
      return actual === expected;
    case "!=":
      return actual !== expected;
    case ">":
      return actual > expected;
    case ">=":
      return actual >= expected;
    case "<":
      return actual < expected;
    case "<=":
      return actual <= expected;
    default:
      return false;
  }
}

function toBooleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return false;
}

function toNumberValue(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return 0;
}

function evaluateVarCondition(actualRaw: unknown, op: BoolOp | NumberOp, expected: boolean | number): boolean {
  if (typeof expected === "boolean") return compareBool(toBooleanValue(actualRaw), op as BoolOp, expected);

  return compareNumber(toNumberValue(actualRaw), op as NumberOp, expected);
}

function findInMaterializedNodes<T>(state: GameState, selector: (nodeRuntime: NodeRuntimeState) => T | undefined): T | undefined {
  for (const nodeRuntime of Object.values(state.nodes)) {
    const result = selector(nodeRuntime);
    if (result) return result;
  }

  return undefined;
}

function getNodeRuntime(state: GameState, nodeId: ID): NodeRuntimeState | undefined {
  return state.nodes[nodeId];
}

function getHotspotRuntime(state: GameState, hotspotId: ID) {
  return findInMaterializedNodes(state, (nodeRuntime) => nodeRuntime.hotspots?.[hotspotId]);
}

function getPlacedItemRuntime(state: GameState, placedItemId: ID) {
  return findInMaterializedNodes(state, (nodeRuntime) => nodeRuntime.placedItems?.[placedItemId]);
}

export function evaluateCondition(state: GameState, condition?: Condition): boolean {
  if (!condition) return true;

  switch (condition.type) {
    case "and":
      return condition.all.every((child) => evaluateCondition(state, child));

    case "or":
      return condition.any.some((child) => evaluateCondition(state, child));

    case "not":
      return !evaluateCondition(state, condition.cond);

    case "nodeVisited": {
      const actual = state.visitedNodes[condition.nodeId] ?? false;
      return compareBool(actual, condition.op, condition.value);
    }

    case "hasItem": {
      // Actualmente el motor mantiene un único inventario global del jugador.
      // condition.playerId se conserva para coherencia con el editor, pero no se usa
      // hasta que el runtime soporte inventarios separados por player.
      const actual = state.inventory.some((entry) => entry.itemInstanceId === condition.itemInstanceId);

      return compareBool(actual, condition.op, condition.value);
    }

    case "npcHasItem": {
      const actual = (state.npcInventory[condition.npcId] ?? []).some(
        (entry) => entry.itemInstanceId === condition.itemInstanceId
      );

      return compareBool(actual, condition.op, condition.value);
    }

    case "playerVar": {
      const vars = state.playerVars[condition.playerId];
      if (!vars || !(condition.varId in vars)) return false;

      return evaluateVarCondition(vars[condition.varId], condition.op, condition.value);
    }

    case "npcVar": {
      const vars = state.npcVars[condition.npcId];
      if (!vars || !(condition.varId in vars)) return false;

      return evaluateVarCondition(vars[condition.varId], condition.op, condition.value);
    }

    case "hotspotVar": {
      const vars = state.hotspotVars[condition.hotspotId];
      if (!vars || !(condition.varId in vars)) return false;

      return evaluateVarCondition(vars[condition.varId], condition.op, condition.value);
    }

    case "hotspotVisible": {
      const actual = getHotspotRuntime(state, condition.hotspotId)?.visible ?? false;
      return compareBool(actual, condition.op, condition.value);
    }

    case "hotspotReachable": {
      const actual = getHotspotRuntime(state, condition.hotspotId)?.reachable ?? false;
      return compareBool(actual, condition.op, condition.value);
    }

    case "placedItemVisible": {
      const actual = getPlacedItemRuntime(state, condition.placedItemId)?.visible ?? false;
      return compareBool(actual, condition.op, condition.value);
    }

    case "placedItemReachable": {
      const actual = getPlacedItemRuntime(state, condition.placedItemId)?.reachable ?? false;
      return compareBool(actual, condition.op, condition.value);
    }

    case "placedNpcVisible": {
      const actual = getNodeRuntime(state, condition.nodeId)?.placedNpcs?.[condition.npcId]?.visible ?? false;
      return compareBool(actual, condition.op, condition.value);
    }

    case "placedNpcReachable": {
      const actual = getNodeRuntime(state, condition.nodeId)?.placedNpcs?.[condition.npcId]?.reachable ?? false;
      return compareBool(actual, condition.op, condition.value);
    }

    case "placedPlayerVisible": {
      const actual = getNodeRuntime(state, condition.nodeId)?.placedPlayers?.[condition.playerId]?.visible ?? false;
      return compareBool(actual, condition.op, condition.value);
    }

    case "placedPlayerImage": {
      const actualImageId = getNodeRuntime(state, condition.nodeId)?.placedPlayerImageId?.[condition.playerId];
      const actual = actualImageId === condition.imageId;

      return compareBool(actual, condition.op, condition.value);
    }

    case "mapRegionVisited": {
      const actual = state.project.nodes.some((node) => {
        return (node.mapLocation?.mapId === condition.mapId && node.mapLocation?.regionId === condition.regionId && state.visitedNodes[node.id] === true);
      });

      return compareBool(actual, condition.op, condition.value);
    }

    default:
      return false;
  }
}