import type { ID } from "@/domain/types";

export type DeleteTarget =
  | { kind: "player"; playerId: ID }
  | { kind: "playerImage"; playerId: ID; imageId: ID }
  | { kind: "playerVar"; playerId: ID; varId: ID }
  | { kind: "playerInventoryItem"; playerId: ID; itemInstanceId: ID }

  | { kind: "npc"; npcId: ID }
  | { kind: "npcVar"; npcId: ID; varId: ID }
  | { kind: "npcInventoryItem"; npcId: ID; itemInstanceId: ID }

  | { kind: "item"; itemId: ID }
  | { kind: "music"; trackId: ID }
  | { kind: "sfx"; sfxId: ID }

  | { kind: "map"; mapId: ID }
  | { kind: "mapRegion"; mapId: ID; regionId: ID }

  | { kind: "node"; nodeId: ID }
  | { kind: "layer"; nodeId: ID; layerId: ID }

  | { kind: "nodeMapLocation"; nodeId: ID }

  | { kind: "hotspot"; nodeId: ID; layerId: ID; hotspotId: ID }
  | { kind: "hotspotVar"; nodeId: ID; layerId: ID; hotspotId: ID; varId: ID }

  | { kind: "placedItem"; nodeId: ID; layerId: ID; placedItemId: ID }
  | { kind: "placedNpc"; nodeId: ID; layerId: ID; npcId: ID }
  | { kind: "placedPlayer"; nodeId: ID; layerId: ID; playerId: ID }

  | { kind: "dialogue"; nodeId: ID; dialogueId: ID };

export type DeleteImpactSeverity = "info" | "logic-change" | "blocking-risk";

export type DeleteImpactAction =
  | "delete-target"
  | "remove-condition"
  | "remove-effect"
  | "remove-rule"
  | "remove-phrase"
  | "remove-dialogue"
  | "remove-dialogue-line"
  | "remove-placed-entity"
  | "clear-field"
  | "replace-reference";

export type DeleteLocationKind =
  | "project"
  | "player"
  | "npc"
  | "item"
  | "music"
  | "sfx"
  | "map"
  | "map-region"
  | "node"
  | "layer"
  | "text"
  | "hotspot"
  | "placed-item"
  | "placed-npc"
  | "placed-player"
  | "rule"
  | "phrase"
  | "condition"
  | "effect"
  | "dialogue"
  | "dialogue-line";

export type DeleteLocation = {
  kind: DeleteLocationKind;

  nodeId?: ID;
  layerId?: ID;

  playerId?: ID;
  npcId?: ID;
  itemId?: ID;
  placedItemId?: ID;
  hotspotId?: ID;

  mapId?: ID;
  regionId?: ID;

  dialogueId?: ID;
  dialogueLineId?: ID;

  ruleId?: ID;
  conditionType?: string;
  effectType?: string;

  label: string;
};

export type DeleteImpactEntry = {
  id: string;
  severity: DeleteImpactSeverity;
  action: DeleteImpactAction;
  location: DeleteLocation;
  message: string;
};

export type DeleteImpactReport = {
  target: DeleteTarget;
  targetLabel: string;
  entries: DeleteImpactEntry[];
};

export type DiagnosticSeverity = "error" | "warning";

export type DiagnosticCode =
  | "RULE_WITHOUT_EFFECTS"
  | "DIALOGUE_WITH_INVALID_ROOT"
  | "DIALOGUE_WITH_BROKEN_CHILD"
  | "DIALOGUE_LINE_WITHOUT_TEXT"
  | "NODE_WITHOUT_LAYERS"
  | "LAYER_WITHOUT_IMAGE"
  | "PLAYER_WITHOUT_IMAGES"
  | "PLACED_PLAYER_WITH_INVALID_IMAGE"
  | "BROKEN_CONDITION_REFERENCE"
  | "BROKEN_EFFECT_REFERENCE"
  | "BROKEN_MAP_REFERENCE"
  | "BROKEN_ITEM_REFERENCE";

export type DiagnosticIssue = {
  id: string;
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  location: DeleteLocation;
  message: string;
};

export type ProjectDiagnostics = {
  errors: DiagnosticIssue[];
  warnings: DiagnosticIssue[];
};
