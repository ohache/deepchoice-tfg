import type { Hotspot, ID, ItemInstance, PlacedNpc, PlacedPlayer, TextDock } from "@/domain/types";

export type SceneTestConditionSummary = {
  text: string;
}

export type SceneTestEffectSummary = {
  text: string;
}

export type SceneTestRuleSummary = {
  id: ID;
  channel: "onClick" | "onUseItem";
  phrase?: string;
  when?: SceneTestConditionSummary;
  effects: SceneTestEffectSummary[];
  itemLabel?: string;
}

export type SceneTestRulesSummary = {
  onClick: SceneTestRuleSummary[];
  onUseItem: SceneTestRuleSummary[];
}

export type SceneTestSceneEntry = {
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
  layers: SceneTestLayerEntry[];
  dialogues: SceneTestDialogueEntry[];
}

export type SceneTestLayerEntry = {
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
  resolvedMusic?: SceneTestResolvedMusicSummary;
}

export type SceneTestTextVariantEntry = {
  id: ID;
  label: string;
  textIndex: number;
  textCount: number;
  content: string;
  dock: TextDock;
  when?: SceneTestConditionSummary;
}

export type SceneTestMapSummary = {
  mapId: ID;
  mapName: string;
  regionId: ID;
  regionName: string;
  isEntry: boolean;
}

export type SceneTestResolvedMusicSummary = {
  trackId: ID;
  trackName: string;
  source: "capa" | "escena" | "región";
}

/* Resumen de diálogo de escena */
export type SceneTestDialogueEntry = {
  id: ID;
  title: string;
  playerId: ID;
  playerName: string;
  npcId: ID;
  npcName: string;
  when?: SceneTestConditionSummary;
}

type SceneTestInspectableType = "hotspot" | "placedItem" | "placedNpc" | "placedPlayer";

export type SceneTestInitialStateSummary = {
  visible?: boolean;
  reachable?: boolean;
  notReachableText?: string;
}

export type SceneTestVarEntry = {
  id: ID;
  name: string;
  type: "number" | "boolean";
  initialText: string;
}

export type SceneTestHotspotEntry = {
  type: "hotspot";
  id: ID;
  label: string;
  raw: Hotspot;
  initialState: SceneTestInitialStateSummary;
  vars: SceneTestVarEntry[];
  rules: SceneTestRulesSummary;
}

export type SceneTestPlacedItemEntry = {
  type: "placedItem";
  id: ID;
  label: string;
  raw: ItemInstance;
  itemId: ID;
  itemName: string;
  initialState: SceneTestInitialStateSummary;
  rules: SceneTestRulesSummary;
}

export type SceneTestPlacedNpcEntry = {
  type: "placedNpc";
  id: ID;
  raw: PlacedNpc;
  npcId: ID;
  npcName: string;
  initialState: SceneTestInitialStateSummary;
  vars: SceneTestVarEntry[];
  rules: SceneTestRulesSummary;
}

export type SceneTestPlacedPlayerEntry = {
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

type SceneTestPlacedPlayerInitialStateSummary = Pick<SceneTestInitialStateSummary, "visible">

export type SceneTestInspectableEntry = SceneTestHotspotEntry | SceneTestPlacedItemEntry | SceneTestPlacedNpcEntry | SceneTestPlacedPlayerEntry;

export type SceneTestInspectableRef = {
  type: SceneTestInspectableType;
  id: ID;
}

export type SceneTestViewModel = {
  projectId: ID;
  projectTitle: string;
  scenes: SceneTestSceneEntry[];
}

export type SceneTestBuildIndexes = {
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

export type SceneTestFormatContext = Partial<SceneTestBuildIndexes>;