import type { ID, EndGameContent } from "@/domain/types";

export type Effect =
  // Navegación
  | { type: "goToNode"; targetNodeId: ID }

  // Inventario
  | { type: "addItem"; itemInstanceId: ID }
  | { type: "removeItem"; itemInstanceId: ID }
  | { type: "transformItem"; sourceItemInstanceId: ID; resultItemId: ID; resultItemInstanceId: ID; resultItemLabel: string }
  | { type: "combineItems"; sourceItemInstanceId: ID; targetItemInstanceId: ID; resultItemId: ID; resultItemInstanceId: ID; resultItemLabel: string }

  // Diálogo / PNJ
  | { type: "startDialogue"; nodeDialogueId: ID }
  | { type: "endDialogue" }
  | { type: "giveItemToNpc"; npcId: ID; itemInstanceId: ID }
  | { type: "receiveItemFromNpc"; npcId: ID; itemInstanceId: ID }

  // Feedback
  | { type: "showMessage"; text: string; speakerKind: "narrator" | "player" | "npc"; speakerId?: ID }

  // Estado de placed items (runtime)
  | { type: "setPlacedItemVisible"; nodeId: ID; itemInstanceId: ID; value: boolean }
  | { type: "setPlacedItemReachable"; nodeId: ID; itemInstanceId: ID; value: boolean }

  // Estado del hotspot (runtime)
  | { type: "setHotspotVisible"; hotspotId: ID; value: boolean }
  | { type: "setHotspotReachable"; hotspotId: ID; value: boolean }

  // Variables del hotspot
  | { type: "setHotspotVar"; hotspotId: ID; varId: ID; value: boolean | number }
  | { type: "toggleHotspotVar"; hotspotId: ID; varId: ID }
  | { type: "incHotspotVar"; hotspotId: ID; varId: ID; amount?: number }
  | { type: "decHotspotVar"; hotspotId: ID; varId: ID; amount?: number }

  // Estado del player colocado
  | { type: "setPlacedPlayerVisible"; nodeId: ID; layerId: ID; playerId: ID; value: boolean }
  | { type: "setPlacedPlayerImage"; nodeId: ID; layerId: ID; playerId: ID; imageId: ID }

  // Estado del npc colocado
  | { type: "setPlacedNpcVisible"; nodeId: ID; layerId: ID; npcId: ID; value: boolean }
  | { type: "setPlacedNpcReachable"; nodeId: ID; layerId: ID; npcId: ID; value: boolean }

  // Variables del player
  | { type: "setPlayerVar"; playerId: ID; varId: ID; value: boolean | number }
  | { type: "togglePlayerVar"; playerId: ID; varId: ID }
  | { type: "incPlayerVar"; playerId: ID; varId: ID; amount?: number }
  | { type: "decPlayerVar"; playerId: ID; varId: ID; amount?: number }

  // Variables del NPC
  | { type: "setNpcVar"; npcId: ID; varId: ID; value: boolean | number }
  | { type: "toggleNpcVar"; npcId: ID; varId: ID }
  | { type: "incNpcVar"; npcId: ID; varId: ID; amount?: number }
  | { type: "decNpcVar"; npcId: ID; varId: ID; amount?: number }

  // Audio
  | { type: "playSfx"; sfxId: ID }
  | { type: "playMusic"; trackId: ID; startAt?: "resume" | "restart" }
  | { type: "stopMusic" }

  // Mapa
  | { type: "setMapRegionAvailable"; mapId: ID; regionId: ID; value: boolean }

  // Finalizar juego
  | { type: "endGame"; ending?: EndGameContent };

export type EffectType = Effect["type"];