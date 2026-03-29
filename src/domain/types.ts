import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";

/* Identificador genérico */
export type ID = string;

/* Assets (catálogo global) */
export type AssetKind = "backgrounds" | "players" | "npcs" | "items" | "music" | "sfx" | "maps";

export interface AssetDef {
  id: ID;
  kind: AssetKind;
  name: string;
  file: string;
}

/* Visor de nodos (solo editor) */
export interface NodeLayout {
  x: number;
  y: number;
}

export interface NodeMeta {
  layout?: NodeLayout;
}

/* Geometría */
export type RegionShape = {
  type: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
};

/* Variables (dominio) */
export type VarType = "number" | "boolean";

export interface VarDefBase {
  id: ID;
  name: string;
  type: VarType;
}

export interface VarDefNumber extends VarDefBase {
  type: "number";
  min: number;
  max: number;
  initial: number;
}

export interface VarDefBoolean extends VarDefBase {
  type: "boolean";
  initial: boolean;
}

export type VarDef = VarDefNumber | VarDefBoolean;

/* ENTIDADES (catálogo global) */
export interface EntityBase {
  id: ID;
  name: string;
  description?: string;
}

/* Items */
export interface ItemDef extends EntityBase {}

/* Players */
export interface PlayerImage {
  id: ID;
  name: string;
}

export interface PlayerDef {
  id: ID;
  name: string;
  description?: string;
  images: PlayerImage[];
  defaultImageId?: ID;
  vars?: VarDef[];
}

/* PNJs */
export interface NpcDef extends EntityBase {
  vars?: VarDef[];
}

/* Audio (catálogo global) */
export interface AudioDefBase {
  id: ID;
  name: string;
}

/* Música */
export interface MusicTrackDef extends AudioDefBase {}

/* Sfx */
export interface SoundEffectDef extends AudioDefBase {}

type ResolvedMusicBase = {
  trackId: ID;
  sourceId: ID;
};

export type ResolvedMusic =
  | ( ResolvedMusicBase & { sourceType: "layer" })
  | ( ResolvedMusicBase & { sourceType: "scene" })
  | ( ResolvedMusicBase & { sourceType: "region" })

/* INTERACCIONES */
export type BaseInteractionRule = {
  id: ID;
  when?: Condition;
  phrase?: string;
  effects: Effect[];
};

export type ClickRule = BaseInteractionRule;

export type UseItemRule = BaseInteractionRule & {
  placedItemId: ID;
};

export type InteractionRules = {
  onClick?: ClickRule[];
  onUseItem?: UseItemRule[];
};

/* Instancias en escena */
export interface PlaceableState {
  visible: boolean;
  reachable: boolean;
  notReachableText?: string;
}

/* Player (solo necesita visible) */
export type PlacedPlayerState = Pick<PlaceableState, "visible">;

/* Items (multi-instancia) */
export interface PlacedEntityBase<S = PlaceableState> {
  id: ID;
  shape: RegionShape;
  initialState: S;
}

/* Player/Npc (singleton) */
export interface PlacedSingletonBase<S = PlaceableState> {
  shape: RegionShape;
  initialState: S;
}

/* Hotspots */
export interface Hotspot {
  id: ID;
  label: string;
  shape: RegionShape;
  initialState: PlaceableState;
  vars: VarDef[];
  rules: InteractionRules;
}

/* Item colocados */
export interface PlacedItem extends PlacedEntityBase<PlaceableState> {
  itemId: ID;
  label: string;
  rules: InteractionRules;
}

/* NPC colocados */
export interface PlacedNpc extends PlacedSingletonBase<PlaceableState> {
  npcId: ID;
  rules: InteractionRules;
}

/* Player colocado */
export interface PlacedPlayer extends PlacedSingletonBase<PlacedPlayerState> {
  playerId: ID;
  initialImageId: ID;
}

/* Posición del texto en la escena */
export type TextDock = "bottom" | "top" | "left" | "right";

/* Texto condicional */
export type ConditionalTextEntry = {
  id: ID;
  label: string;
  when?: Condition;
  content: string;
};

export type ConditionalText = ConditionalTextEntry[];

/* Diálogos */
export interface Dialogue {
  id: ID;
  playerId: ID;
  npcId: ID;
  title?: string;
  description?: string;
  when?: Condition;
  rootId: ID;
  nodes: DialogueNode[];
}

export interface DialogueRootNode {
  id: ID;
  type: "root";
  childrenIds: ID[];
}

export type DialogueSpeaker = "player" | "npc";

export interface DialogueLineNode {
  id: ID;
  type: "line";
  speaker: DialogueSpeaker;
  text: string;
  when?: Condition;
  effects?: Effect[];
  childrenIds: ID[];
}

export type DialogueNode = DialogueRootNode | DialogueLineNode;

/* MAPAS */
export interface MapSingleImageVisualSource {
  type: "singleImage";
  imageAssetId: ID;
}

export interface MapComposedVisualSource {
  type: "composed";
  backgroundAssetId: ID;
}

export type MapVisualSource =
  | MapSingleImageVisualSource
  | MapComposedVisualSource;

export interface MapRegion {
  id: ID;
  label: string;
  shape: RegionShape;
  visible: boolean;
  imageAssetId?: ID;
  musicTrackId?: ID;
  subMapId?: ID;
  entrySceneId?: ID;
  sceneIds: ID[];
}

export interface WorldMap {
  id: ID;
  name: string;
  visual: MapVisualSource;
  regions: MapRegion[];
}

export interface NodeMapLocation {
  mapId: ID;
  regionId: ID;
  isEntry?: boolean;
}

/* Capa visual de escena: imagen + textos asociados */
export type SceneImageLayer = {
  id: ID;
  assetId: ID;
  label: string;
  when?: Condition;
  dock: TextDock;
  text: ConditionalText;
  hotspots?: Hotspot[];
  placedItems?: PlacedItem[];
  placedNpcs?: PlacedNpc[];
  placedPlayers?: PlacedPlayer[];
  musicTrackId?: ID;
};

/* Core de la escena (visual) */
export type Node = {
  id: ID;
  title: string;
  layers: SceneImageLayer[];
  dialogues?: Dialogue[];
  musicTrackId?: ID;
  mapLocation?: NodeMapLocation;
  isStart?: boolean;
  isFinal?: boolean;
  meta?: NodeMeta;
};


/* Proyecto */
export interface Project {
  id: ID;
  title: string;
  assets: AssetDef[];
  items: ItemDef[];
  npcs: NpcDef[];
  players: PlayerDef[];
  musicTracks: MusicTrackDef[];
  soundEffects: SoundEffectDef[];
  maps: WorldMap[];
  nodes: Node[];
}