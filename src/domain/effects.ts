import type { ID, EndGameContent, Speaker, InteractionRules } from "@/domain/types";

type RuntimeValue = boolean | number;
type MusicStartMode = "resume" | "restart";

export type Effect =
  // Navegación
  | { type: "goToNode"; targetNodeId: ID }

  // Inventario
  | { type: "addItem"; itemInstanceId: ID }
  | { type: "removeItem"; itemInstanceId: ID }
  | { type: "transformItem"; itemInstanceId: ID; resultItemId: ID; resultItemInstanceId: ID; resultItemLabel: string, resultItemRules?: InteractionRules }
  | { type: "combineItems"; itemAInstanceId: ID; itemBInstanceId: ID; resultItemId: ID; resultItemInstanceId: ID; resultItemLabel: string, resultItemRules?: InteractionRules; }

  // Diálogo / PNJ
  | { type: "startDialogue"; nodeDialogueId: ID }
  | { type: "endDialogue" }
  | { type: "giveItemToNpc"; npcId: ID; itemInstanceId: ID }
  | { type: "receiveItemFromNpc"; npcId: ID; itemInstanceId: ID }

  // Feedback
  | { type: "showMessage"; text: string; speaker?: Speaker }

  // Estado de objetos instanciados
  | { type: "setPlacedItemVisible"; itemInstanceId: ID; value: boolean }
  | { type: "setPlacedItemReachable"; itemInstanceId: ID; value: boolean }

  // Estado del hotspot
  | { type: "setHotspotVisible"; hotspotId: ID; value: boolean }
  | { type: "setHotspotReachable"; hotspotId: ID; value: boolean }

  // Variables del hotspot
  | { type: "setHotspotVar"; hotspotId: ID; varId: ID; value: RuntimeValue }
  | { type: "toggleHotspotVar"; hotspotId: ID; varId: ID }
  | { type: "incHotspotVar"; hotspotId: ID; varId: ID; amount?: number }
  | { type: "decHotspotVar"; hotspotId: ID; varId: ID; amount?: number }

  // Estado del player colocado
  | { type: "setPlacedPlayerVisible"; nodeId: ID; layerId: ID; playerId: ID; value: boolean }
  | { type: "setPlacedPlayerImage"; nodeId: ID; layerId: ID; playerId: ID; imageId: ID }

  // Estado del PNJ colocado
  | { type: "setPlacedNpcVisible"; nodeId: ID; layerId: ID; npcId: ID; value: boolean }
  | { type: "setPlacedNpcReachable"; nodeId: ID; layerId: ID; npcId: ID; value: boolean }

  // Variables del player
  | { type: "setPlayerVar"; playerId: ID; varId: ID; value: RuntimeValue }
  | { type: "togglePlayerVar"; playerId: ID; varId: ID }
  | { type: "incPlayerVar"; playerId: ID; varId: ID; amount?: number }
  | { type: "decPlayerVar"; playerId: ID; varId: ID; amount?: number }

  // Variables del PNJ
  | { type: "setNpcVar"; npcId: ID; varId: ID; value: RuntimeValue }
  | { type: "toggleNpcVar"; npcId: ID; varId: ID }
  | { type: "incNpcVar"; npcId: ID; varId: ID; amount?: number }
  | { type: "decNpcVar"; npcId: ID; varId: ID; amount?: number }

  // Audio
  | { type: "playSfx"; sfxId: ID }
  | { type: "playMusic"; trackId: ID; startAt?: MusicStartMode }
  | { type: "stopMusic"; trackId: ID }

  // Mapa
  | { type: "setMapRegionAvailable"; mapId: ID; regionId: ID; value: boolean }

  // Finalizar juego
  | { type: "endGame"; ending?: EndGameContent };

export type EffectType = Effect["type"];