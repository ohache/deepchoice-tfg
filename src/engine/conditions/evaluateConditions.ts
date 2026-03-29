import type { Condition, NumberOp, BoolOp } from "@/domain/conditions";
import type { ID } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";

function cmpBool(actual: boolean, op: BoolOp, expected: boolean) {
  return op === "==" ? actual === expected : actual !== expected;
}

function cmpNum(actual: number, op: NumberOp, expected: number) {
  switch (op) {
    case "==": return actual === expected;
    case "!=": return actual !== expected;
    case ">": return actual > expected;
    case ">=": return actual >= expected;
    case "<": return actual < expected;
    case "<=": return actual <= expected;
    default: return false;
  }
}

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return false;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return 0;
}

function evalVarCondition(actualRaw: unknown, op: BoolOp | NumberOp, value: boolean | number): boolean {
  if (typeof value === "boolean") {
    return cmpBool(toBool(actualRaw), op as BoolOp, value);
  }
  return cmpNum(toNum(actualRaw), op as NumberOp, value);
}

function getHotspotRuntime(state: GameState, hotspotId: ID) {
  for (const node of Object.values(state.nodes)) {
    const hotspot = node.hotspots?.[hotspotId];
    if (hotspot) return hotspot;
  }
  return undefined;
}

function getPlacedItemRuntime(state: GameState, placedItemId: ID) {
  for (const node of Object.values(state.nodes)) {
    const placedItem = node.placedItems?.[placedItemId];
    if (placedItem) return placedItem;
  }
  return undefined;
}

function getPlacedNpcRuntime(state: GameState, npcId: string) {
  for (const node of Object.values(state.nodes)) {
    const npc = node.placedNpcs?.[npcId];
    if (npc) return npc;
  }
  return undefined;
}

function getPlacedPlayerRuntime(state: GameState, playerId: string) {
  for (const node of Object.values(state.nodes)) {
    const player = node.placedPlayers?.[playerId];
    if (player) return player;
  }
  return undefined;
}

export function evaluateCondition(state: GameState, cond?: Condition): boolean {
  if (!cond) return true;

  switch (cond.type) {
    case "and":
      return (cond.all ?? []).every((c) => evaluateCondition(state, c));

    case "or":
      return (cond.any ?? []).some((c) => evaluateCondition(state, c));

    case "not":
      return !evaluateCondition(state, cond.cond);

    case "nodeVisited": {
      const actual = state.visitedNodes[cond.nodeId] ?? false;
      return cmpBool(actual, cond.op, cond.value);
    }

    case "hasItem": {
      const actual = state.inventory.some((entry) => entry.instanceId === cond.placedItemId);
      return cmpBool(actual, cond.op, cond.value);
    }

    case "playerVar": {
      const vars = state.playerVars[cond.playerId];
      if (!vars || !(cond.varId in vars)) return false;
      return evalVarCondition(vars[cond.varId], cond.op, cond.value);
    }

    case "npcVar": {
      const vars = state.npcVars[cond.npcId];
      if (!vars || !(cond.varId in vars)) return false;
      return evalVarCondition(vars[cond.varId], cond.op, cond.value);
    }

    case "hotspotVar": {
      const vars = state.hotspotVars[cond.hotspotId];
      if (!vars || !(cond.varId in vars)) return false;
      return evalVarCondition(vars[cond.varId], cond.op, cond.value);
    }

    case "hotspotVisible": {
      const actual = getHotspotRuntime(state, cond.hotspotId)?.visible ?? false;
      return cmpBool(actual, cond.op, cond.value);
    }

    case "hotspotReachable": {
      const actual = getHotspotRuntime(state, cond.hotspotId)?.reachable ?? false;
      return cmpBool(actual, cond.op, cond.value);
    }

    case "placedItemVisible": {
      const actual = getPlacedItemRuntime(state, cond.placedItemId)?.visible ?? false;
      return cmpBool(actual, cond.op, cond.value);
    }

    case "placedItemReachable": {
      const actual = getPlacedItemRuntime(state, cond.placedItemId)?.reachable ?? false;
      return cmpBool(actual, cond.op, cond.value);
    }

    case "placedNpcVisible": {
      const actual = getPlacedNpcRuntime(state, cond.npcId)?.visible ?? false;
      return cmpBool(actual, cond.op, cond.value);
    }

    case "placedNpcReachable": {
      const actual = getPlacedNpcRuntime(state, cond.npcId)?.reachable ?? false;
      return cmpBool(actual, cond.op, cond.value);
    }

    case "placedPlayerVisible": {
      const actual = getPlacedPlayerRuntime(state, cond.playerId)?.visible ?? false;
      return cmpBool(actual, cond.op, cond.value);
    }

    case "mapRegionVisited": {
      const actual = state.project.nodes.some((node) =>
          node.mapLocation?.mapId === cond.mapId && node.mapLocation?.regionId === cond.regionId && state.visitedNodes[node.id] === true);

      return cmpBool(actual, cond.op, cond.value);
    }

    default:
      return false;
  }
}