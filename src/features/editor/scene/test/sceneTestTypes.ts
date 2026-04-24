import type { Hotspot, ID, InteractionRules, Node, PlacedItem, PlacedNpc, PlacedPlayer, Project, SceneImageLayer, TextDock } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";

/* Resumen legible de una condición */
export interface SceneTestConditionSummary {
  text: string;
}

/* Resumen legible de un efecto */
export interface SceneTestEffectSummary {
  text: string;
}

/* Resumen legible de una regla */
export interface SceneTestRuleSummary {
  id: ID;
  channel: "onClick" | "onUseItem";
  phrase?: string;
  when?: SceneTestConditionSummary;
  effects: SceneTestEffectSummary[];
  itemLabel?: string;
}

/* Resumen legible de un bloque de reglas */
export interface SceneTestRulesSummary {
  onClick: SceneTestRuleSummary[];
  onUseItem: SceneTestRuleSummary[];
}

/* Entrada navegable de escena */
export interface SceneTestSceneEntry {
  id: ID;
  title: string;
  isStart: boolean;
  isFinal: boolean;
  sceneIndex: number;
  sceneCount: number;
  layerCount: number;
  textVariantCount: number;
  dialogueCount: number;
  map?: SceneTestMapSummary;
  music?: SceneTestResolvedMusicSummary;
  layers: SceneTestLayerEntry[];
  dialogues: SceneTestDialogueEntry[];
}

/* Entrada navegable de capa */
export interface SceneTestLayerEntry {
  id: ID;
  label: string;
  layerIndex: number;
  layerCount: number;
  assetId: ID;
  imageSrcLabel?: string;
  textVariants: SceneTestTextVariantEntry[];
  hotspots: SceneTestHotspotEntry[];
  placedItems: SceneTestPlacedItemEntry[];
  placedNpcs: SceneTestPlacedNpcEntry[];
  placedPlayers: SceneTestPlacedPlayerEntry[];
  musicTrackId?: ID;
  musicTrackName?: string;
}

/* Variante de texto navegable */
export interface SceneTestTextVariantEntry {
  id: ID;
  label: string;
  textIndex: number;
  textCount: number;
  content: string;
  dock: TextDock;
  when?: SceneTestConditionSummary;
}

/* Resumen de mapa de la escena */
export interface SceneTestMapSummary {
  mapId: ID;
  mapName: string;
  regionId: ID;
  regionName: string;
  isEntry: boolean;
}

/* Música resuelta de mayor prioridad */
export interface SceneTestResolvedMusicSummary {
  trackId: ID;
  trackName: string;
  source: "variante" | "escena" | "mapa";
}

/* Resumen de diálogo de escena */
export interface SceneTestDialogueEntry {
  id: ID;
  title: string;
  playerId: ID;
  playerName: string;
  npcId: ID;
  npcName: string;
  when?: SceneTestConditionSummary;
}

/* Unión de tipos de target que se pueden inspeccionar */
export type SceneTestInspectableType = "hotspot" | "placedItem" | "placedNpc" | "placedPlayer";

/* Estado inicial resumido y uniforme */
export interface SceneTestInitialStateSummary {
  visible?: boolean;
  reachable?: boolean;
  notReachableText?: string;
}

/* Variable resumida */
export interface SceneTestVarEntry {
  id: ID;
  name: string;
  type: "number" | "boolean";
  initialText: string;
}

/* Hotspot inspeccionable */
export interface SceneTestHotspotEntry {
  type: "hotspot";
  id: ID;
  label: string;
  raw: Hotspot;
  initialState: SceneTestInitialStateSummary;
  vars: SceneTestVarEntry[];
  rules: SceneTestRulesSummary;
}

/* Item colocado inspeccionable */
export interface SceneTestPlacedItemEntry {
  type: "placedItem";
  id: ID;
  label: string;
  raw: PlacedItem;
  itemId: ID;
  itemName: string;
  initialState: SceneTestInitialStateSummary;
  rules: SceneTestRulesSummary;
}

/* NPC colocado inspeccionable */
export interface SceneTestPlacedNpcEntry {
  type: "placedNpc";
  id: ID;
  raw: PlacedNpc;
  npcId: ID;
  npcName: string;
  initialState: SceneTestInitialStateSummary;
  vars: SceneTestVarEntry[];
  rules: SceneTestRulesSummary;
}

/* Player colocado inspeccionable */
export interface SceneTestPlacedPlayerEntry {
  type: "placedPlayer";
  id: ID;
  raw: PlacedPlayer;
  playerId: ID;
  playerName: string;
  initialState: SceneTestPlacedPlayerInitialStateSummary;
  initialImageId: ID;
  initialImageName: string;
  vars: SceneTestVarEntry[];
}

/* Estado inicial específico de player colocado */
export interface SceneTestPlacedPlayerInitialStateSummary {
  visible?: boolean;
}

/* Unión de todos los elementos inspeccionables */
export type SceneTestInspectableEntry = SceneTestHotspotEntry | SceneTestPlacedItemEntry | SceneTestPlacedNpcEntry | SceneTestPlacedPlayerEntry;

/* Referencia ligera al target hovered/seleccionado */
export interface SceneTestInspectableRef {
  type: SceneTestInspectableType;
  id: ID;
}

/* Estado de tarjeta de información */
export interface SceneTestInfoCardState {
  hovered: SceneTestInspectableRef | null;
  pinned: SceneTestInspectableRef | null;
}

/* Modelo completo del SceneTestView */
export interface SceneTestViewModel {
  projectId: ID;
  projectTitle: string;
  scenes: SceneTestSceneEntry[];
}

/* Contexto de resolución de nombres/referencias */
export interface SceneTestBuildIndexes {
  itemNameById: Record<ID, string>;
  placedItemNamesById: Record<ID, string>;
  npcNameById: Record<ID, string>;
  playerNameById: Record<ID, string>;
  musicNameById: Record<ID, string>;
  assetNameById: Record<ID, string>;
  nodeNamesById: Record<ID, string>;
  hotspotNamesById: Record<ID, string>;
  mapNamesById: Record<ID, string>;
  regionNamesByScopedId: Record<string, string>;
  dialogueNamesById: Record<ID, string>;
  sfxNamesById: Record<ID, string>;
  imageNamesById: Record<ID, string>;
  playerVarNamesByScopedId: Record<string, string>;
  npcVarNamesByScopedId: Record<string, string>;
  hotspotVarNamesByScopedId: Record<string, string>;
}

/* Payload base que luego consumirá el renderer del test */
export interface SceneTestStageData {
  imageAssetId?: ID;
  imageSrcLabel?: string;
  hotspots: SceneTestHotspotEntry[];
  placedItems: SceneTestPlacedItemEntry[];
  placedNpcs: SceneTestPlacedNpcEntry[];
  placedPlayers: SceneTestPlacedPlayerEntry[];
  activeTextVariant?: SceneTestTextVariantEntry;
}

/* Estructuras raw que pueden ser útiles para formatters */
export interface SceneTestRawRuleInput {
  rules?: InteractionRules;
}

export interface SceneTestRawConditionInput {
  when?: Condition;
}

export interface SceneTestRawEffectsInput {
  effects?: Effect[];
}

/* Estructura mínima común de capa raw */
export interface SceneTestLayerBuildInput {
  project: Project;
  node: Node;
  layer: SceneImageLayer;
  layerIndex: number;
}