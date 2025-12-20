import type { Effect, FreeHotspotEffect } from "@/domain/types";

/** Efecto de navegación */
export function isGoToNodeEffect(e: Effect): e is Extract<Effect, { type: "goToNode" }> {
  return e.type === "goToNode";
}

/** Efecto: añadir item al inventario */
export function isAddItemEffect(e: Effect): e is Extract<Effect, { type: "addItem" }> {
  return e.type === "addItem";
}

/** Efecto: quitar item del inventario */
export function isRemoveItemEffect(e: Effect): e is Extract<Effect, { type: "removeItem" }> {
  return e.type === "removeItem";
}

/** Efecto: iniciar diálogo */
export function isStartDialogueEffect(e: Effect): e is Extract<Effect, { type: "startDialogue" }> {
  return e.type === "startDialogue";
}

/** Efecto: entregar item a un NPC */
export function isGiveItemToNpcEffect(e: Effect): e is Extract<Effect, { type: "giveItemToNpc" }> {
  return e.type === "giveItemToNpc";
}

/** Efecto: mostrar texto */
export function isShowTextEffect(e: Effect): e is Extract<Effect, { type: "showText" }> {
  return e.type === "showText";
}

/** Efecto: mostrar mensaje */
export function isShowMessageEffect(e: Effect): e is Extract<Effect, { type: "showMessage" }> {
  return e.type === "showMessage";
}

/** Efecto: set flag */
export function isSetFlagEffect(e: Effect): e is Extract<Effect, { type: "setFlag" }> {
  return e.type === "setFlag";
}

/** Efectos de estado de ítems colocados */
export function isSetPlacedItemVisibleEffect(e: Effect): e is Extract<Effect, { type: "setPlacedItemVisible" }> {
  return e.type === "setPlacedItemVisible";
}

export function isSetPlacedItemReachableEffect(e: Effect): e is Extract<Effect, { type: "setPlacedItemReachable" }> {
  return e.type === "setPlacedItemReachable";
}

/* Guards para hotspots libres*/
export function isGoToNodeFreeEffect(e: FreeHotspotEffect): e is Extract<FreeHotspotEffect, { type: "goToNode" }> {
  return e.type === "goToNode";
}

export function isSetFlagFreeEffect(e: FreeHotspotEffect): e is Extract<FreeHotspotEffect, { type: "setFlag" }> {
  return e.type === "setFlag";
}

export function isShowTextFreeEffect(e: FreeHotspotEffect): e is Extract<FreeHotspotEffect, { type: "showText" }> {
  return e.type === "showText";
}

export function isShowMessageFreeEffect(e: FreeHotspotEffect): e is Extract<FreeHotspotEffect, { type: "showMessage" }> {
  return e.type === "showMessage";
}
