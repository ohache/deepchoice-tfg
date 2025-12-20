import type { GameState } from "@/engine/gameState";
import type { Hotspot, HotspotInteraction, ItemInteraction, Condition, Effect,
  ID, ItemVerb, Node, PlacedItem } from "@/domain/types";

/* Condiciones */
function checkCondition(state: GameState, cond: Condition): boolean {
  switch (cond.type) {
    case "hasItem":
      return state.inventory.includes(cond.itemId);
    case "flagIsTrue":
      return state.flags[cond.flag] === true;
    case "flagIsFalse":
      return state.flags[cond.flag] !== true;
    default: {
      const _exhaustive: never = cond;
      return _exhaustive;
    }
  }
}

function conditionsPass(state: GameState, conditions?: Condition[]): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((c) => checkCondition(state, c));
}

/* Helpers de actualización */
function updateNodeById(project: GameState["project"], nodeId: ID, updater: (n: Node) => Node): GameState["project"] {
  const idx = project.nodes.findIndex((n) => n.id === nodeId);
  if (idx < 0) return project;

  const nextNodes = project.nodes.slice();
  nextNodes[idx] = updater(project.nodes[idx]!);

  return { ...project, nodes: nextNodes };
}

function updatePlacedItemById(project: GameState["project"], placedItemId: ID, updater: (pi: PlacedItem) => PlacedItem): GameState["project"] {
  const node = project.nodes.find((n) => (n.placedItems ?? []).some((pi) => pi.id === placedItemId));
  if (!node) return project;

  return updateNodeById(project, node.id, (n) => {
    const placedItems = n.placedItems ?? [];
    const nextPlacedItems = placedItems.map((pi) => (pi.id === placedItemId ? updater(pi) : pi));
    return { ...n, placedItems: nextPlacedItems };
  });
}

function getPlacedItemById(project: GameState["project"], placedItemId: ID): PlacedItem | null {
  for (const n of project.nodes) {
    const found = (n.placedItems ?? []).find((pi) => pi.id === placedItemId);
    if (found) return found;
  }
  return null;
}

/* Efectos */
function applyEffect(state: GameState, eff: Effect): GameState {
  switch (eff.type) {
    case "goToNode": {
      const targetId = eff.targetNodeId;
      const exists = state.project.nodes.some((n) => n.id === targetId);
      if (!exists) throw new Error(`goToNode apunta a un nodo inexistente: "${targetId}".`);

      return { ...state, currentNodeId: targetId };
    }

    case "addItem": {
      const itemId = eff.itemId;
      if (state.inventory.includes(itemId)) return state;
      return { ...state, inventory: [...state.inventory, itemId] };
    }

    case "removeItem": {
      const itemId = eff.itemId;
      return { ...state, inventory: state.inventory.filter((id) => id !== itemId) };
    }

    case "setFlag": {
      return { ...state, flags: { ...state.flags, [eff.flag]: eff.value } };
    }

    case "showText":
    case "showMessage": {
      console.log(eff.text);
      return state;
    }

    case "setPlacedItemVisible": {
      const { placedItemId, value } = eff;
      const nextProject = updatePlacedItemById(state.project, placedItemId, (pi) => ({
        ...pi,
        state: { ...(pi.state ?? { visible: true, reachable: true }), visible: value },
      }));
      return { ...state, project: nextProject };
    }

    case "setPlacedItemReachable": {
      const { placedItemId, value } = eff;
      const nextProject = updatePlacedItemById(state.project, placedItemId, (pi) => ({
        ...pi,
        state: { ...(pi.state ?? { visible: true, reachable: true }), reachable: value },
      }));
      return { ...state, project: nextProject };
    }

    case "startDialogue":
    case "giveItemToNpc": {
      throw new Error(`Efecto "${eff.type}" aún no soportado en el motor.`);
    }

    default: {
      const _exhaustive: never = eff;
      return _exhaustive;
    }
  }
}

function applyEffects(state: GameState, effects: Effect[]): GameState {
  let s = state;
  for (const eff of effects) s = applyEffect(s, eff);
  return s;
}

/* Hotspots (free) */

/* MVP: aplica la primera interacción cuyas condiciones pasen. (Más adelante: aplicar por verb / selector de acción) */
function pickHotspotInteraction(state: GameState, interactions: HotspotInteraction[]): HotspotInteraction | null {
  for (const it of interactions) {
    if (conditionsPass(state, it.conditions)) return it;
  }
  return null;
}

export function applyHotspot(state: GameState, hotspot: Hotspot): GameState {
  const interactions = hotspot.interactions ?? [];
  if (interactions.length === 0) return state;

  const chosen = pickHotspotInteraction(state, interactions);
  if (!chosen) return state;

  return applyEffects(state, chosen.effects ?? []);
}

/* Placed Items */
function pickItemInteraction(state: GameState, interactions: ItemInteraction[], verb: ItemVerb): ItemInteraction | null {
  const candidates = interactions.filter((it) => it.verb === verb);
  for (const it of candidates) {
    if (conditionsPass(state, it.conditions)) return it;
  }
  return null;
}

export function applyPlacedItemInteraction(state: GameState, placedItemId: ID, verb: ItemVerb): GameState {
  const pi = getPlacedItemById(state.project, placedItemId);
  if (!pi) throw new Error(`No existe placedItemId="${placedItemId}" en el proyecto.`);

  const visible = pi.state?.visible !== false;
  const reachable = pi.state?.reachable !== false;

  if (!visible) return state;

  if (verb !== "look" && !reachable) {
    const msg = pi.state?.notReachableText?.trim() || "No puedes alcanzarlo.";
    return applyEffect(state, { type: "showMessage", text: msg });
  }

  const interactions = pi.interactions ?? [];
  if (interactions.length === 0) {
    if (verb === "take") {
      let s = applyEffect(state, { type: "addItem", itemId: pi.itemId });
      s = applyEffect(s, { type: "setPlacedItemVisible", placedItemId: pi.id, value: false });
      return s;
    }
    if (verb === "look") {
      return state;
    }
    return state;
  }

  const chosen = pickItemInteraction(state, interactions, verb);
  if (!chosen) return state;

  return applyEffects(state, chosen.effects ?? []);
}
