import type { ID } from "@/domain/types";

/* Operadores */
export const NUMBER_OPS = ["==", "!=", ">", ">=", "<", "<="] as const;
export type NumberOp = typeof NUMBER_OPS[number];

export const BOOL_OPS = ["==", "!="] as const;
export type BoolOp = typeof BOOL_OPS[number];

/** Predicados tipados para variables */
export type VarNumberPredicate = { op: NumberOp; value: number };
export type VarBoolPredicate = { op: BoolOp; value: boolean };
export type VarPredicate = VarNumberPredicate | VarBoolPredicate;

export type Condition =
  // Lógica
  | { type: "and"; all: Condition[] }
  | { type: "or"; any: Condition[] }
  | { type: "not"; cond: Condition }

  // Progreso
  | { type: "nodeVisited"; nodeId: ID; op: BoolOp; value: boolean }

  // Inventario
  | { type: "hasItem"; placedItemId: ID; op: BoolOp; value: boolean }

  // Variables
  | ({ type: "playerVar"; playerId: ID; varId: ID } & VarPredicate)
  | ({ type: "npcVar"; npcId: ID; varId: ID } & VarPredicate)
  | ({ type: "hotspotVar"; hotspotId: ID; varId: ID } & VarPredicate)

  // Hotspots
  | { type: "hotspotVisible"; hotspotId: ID; op: BoolOp; value: boolean }
  | { type: "hotspotReachable"; hotspotId: ID; op: BoolOp; value: boolean }

  // Items
  | { type: "placedItemVisible"; placedItemId: ID; op: BoolOp; value: boolean }
  | { type: "placedItemReachable"; placedItemId: ID; op: BoolOp; value: boolean }

  // Npc
  | { type: "placedNpcVisible"; npcId: ID; op: BoolOp; value: boolean }
  | { type: "placedNpcReachable"; npcId: ID; op: BoolOp; value: boolean }

  // Player
  | { type: "placedPlayerVisible"; playerId: ID; op: BoolOp; value: boolean }

  // Mapa
  | { type: "mapRegionVisited"; mapId: ID; regionId: ID; op: BoolOp; value: boolean }

/* Helpers para crear condiciones */
export const ConditionBuilder = {
  and: (...all: Condition[]): Condition => all.length === 1 ? all[0] : { type: "and", all },
  or: (...any: Condition[]): Condition => any.length === 1 ? any[0] : { type: "or", any },
  not: (cond: Condition): Condition => ({ type: "not", cond }),
};
