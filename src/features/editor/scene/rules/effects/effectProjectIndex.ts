import type { Option } from "@/components/Select";
import type { Hotspot, ID, Node, PlacedItem, PlacedNpc, PlacedPlayer, Project, VarDef } from "@/domain/types";

export type OwnerVarKind = "boolean" | "number" | "unknown";

export type ProjectIndex = {
  project: Project | null;

  getNode: (id: ID) => Node | null;
  getNodeLabel: (id: ID) => string;
  getNodeOptions: (opts?: { excludeNodeId?: ID }) => Option<ID>[];

  getNodeHotspots: (nodeId: ID) => Hotspot[];
  getHotspot: (nodeId: ID, hotspotId: ID) => Hotspot | null;
  getHotspotLabel: (nodeId: ID, hotspotId: ID) => string;
  getHotspotOptions: (nodeId: ID) => Option<ID>[];
  getHotspotVarDef: (nodeId: ID, hotspotId: ID, varId: ID) => VarDef | null;
  getHotspotVarLabel: (nodeId: ID, hotspotId: ID, varId: ID) => string;
  getHotspotVarOptions: (nodeId: ID, hotspotId: ID) => Option<ID>[];
  getHotspotVarKind: (nodeId: ID, hotspotId: ID, varId: ID) => OwnerVarKind;

  getPlacedItems: () => PlacedItem[];
  getPlacedItemLabel: (placedItemId: ID) => string;
  getPlacedItemOptions: () => Option<ID>[];

  getPlacedNpcs: () => PlacedNpc[];
  getPlacedNpcLabel: (npcId: ID) => string;
  getPlacedNpcOptions: () => Option<ID>[];

  getPlacedPlayers: () => PlacedPlayer[];
  getPlacedPlayerLabel: (playerId: ID) => string;
  getPlacedPlayerOptions: () => Option<ID>[];
  getPlayerImageOptions: (playerId: ID) => Option<ID>[];
  getPlayerImageLabel: (playerId: ID, imageId: ID) => string;

  getPlayerLabel: (playerId: ID) => string;
  getPlayerOptions: () => Option<ID>[];
  getPlayerVarDef: (playerId: ID, varId: ID) => VarDef | null;
  getPlayerVarLabel: (playerId: ID, varId: ID) => string;
  getPlayerVarOptions: (playerId: ID) => Option<ID>[];
  getPlayerVarKind: (playerId: ID, varId: ID) => OwnerVarKind;

  getNpcLabel: (npcId: ID) => string;
  getNpcOptions: () => Option<ID>[];
  getNpcVarDef: (npcId: ID, varId: ID) => VarDef | null;
  getNpcVarLabel: (npcId: ID, varId: ID) => string;
  getNpcVarOptions: (npcId: ID) => Option<ID>[];
  getNpcVarKind: (npcId: ID, varId: ID) => OwnerVarKind;

  getDialogueOptions: (nodeId: ID) => Option<ID>[];
  getDialogueLabel: (nodeId: ID, dialogueId: ID) => string;

  getSfxOptions: () => Option<ID>[];
  getSfxLabel: (sfxId: ID) => string;

  getMusicOptions: () => Option<ID>[];
  getMusicLabel: (trackId: ID) => string;

  getMapOptions: () => Option<ID>[];
  getMapLabel: (mapId: ID) => string;
  getMapRegionOptions: (mapId: ID) => Option<ID>[];
  getMapRegionLabel: (mapId: ID, regionId: ID) => string;
};