import type { Action } from "@/domain/types";

/** Acción de navegación */
export function isGoToNodeAction(a: Action): a is Extract<Action, { type: "goToNode" }> {
  return a.type === "goToNode";
}

/** Acción: añadir item al inventario */
export function isAddItemAction(a: Action): a is Extract<Action, { type: "addItem" }> {
  return a.type === "addItem";
}

/** Acción: iniciar diálogo */
export function isStartDialogueAction(a: Action): a is Extract<Action, { type: "startDialogue" }> {
  return a.type === "startDialogue";
}

/** Acción: entregar item a un NPC */
export function isGiveItemToNpcAction(a: Action): a is Extract<Action, { type: "giveItemToNpc" }> {
  return a.type === "giveItemToNpc";
}
