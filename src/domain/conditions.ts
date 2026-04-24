import type { ID } from "@/domain/types";

/* Operadores numéricos válidos */
export const NUMBER_OPS = ["==", "!=", ">", ">=", "<", "<="] as const;
export type NumberOp = typeof NUMBER_OPS[number];

/* Operadores booleanos válidos */
export const BOOL_OPS = ["==", "!="] as const;
export type BoolOp = typeof BOOL_OPS[number];

/* Predicados tipados para variables */
export type VarNumberPredicate = { op: NumberOp; value: number };
export type VarBoolPredicate = { op: BoolOp; value: boolean };
export type VarPredicate = VarNumberPredicate | VarBoolPredicate;

/* Árbol de condiciones */
export type Condition =
  | { type: "and"; all: Condition[] }
  | { type: "or"; any: Condition[] }
  | { type: "not"; cond: Condition }

  | { type: "nodeVisited"; nodeId: ID; op: BoolOp; value: boolean }
  | { type: "hasItem"; placedItemId: ID; op: BoolOp; value: boolean }

  | ({ type: "playerVar"; playerId: ID; varId: ID } & VarPredicate)
  | ({ type: "npcVar"; npcId: ID; varId: ID } & VarPredicate)
  | ({ type: "hotspotVar"; hotspotId: ID; varId: ID } & VarPredicate)

  | { type: "hotspotVisible"; hotspotId: ID; op: BoolOp; value: boolean }
  | { type: "hotspotReachable"; hotspotId: ID; op: BoolOp; value: boolean }

  | { type: "placedItemVisible"; placedItemId: ID; op: BoolOp; value: boolean }
  | { type: "placedItemReachable"; placedItemId: ID; op: BoolOp; value: boolean }

  | { type: "placedNpcVisible"; npcId: ID; op: BoolOp; value: boolean }
  | { type: "placedNpcReachable"; npcId: ID; op: BoolOp; value: boolean }

  | { type: "placedPlayerVisible"; playerId: ID; op: BoolOp; value: boolean }

  | { type: "mapRegionVisited"; mapId: ID; regionId: ID; op: BoolOp; value: boolean };

/* Builder para evitar árboles degenerados */
export const ConditionBuilder = {
  and: (...conds: Condition[]): Condition => {
    const flat = conds.flatMap(c => c.type === "and" ? c.all : [c]);
    return flat.length === 1 ? flat[0] : { type: "and", all: flat };
  },

  or: (...conds: Condition[]): Condition => {
    const flat = conds.flatMap(c => c.type === "or" ? c.any : [c]);
    return flat.length === 1 ? flat[0] : { type: "or", any: flat };
  },

  not: (cond: Condition): Condition => {
    if (cond.type === "not") return cond.cond;
    return { type: "not", cond };
  },
};