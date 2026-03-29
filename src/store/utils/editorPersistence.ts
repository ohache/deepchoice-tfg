import JSZip from "jszip";
import type { Project, ID, AssetDef, ItemDef, NpcDef, PlayerDef, PlayerImage, MusicTrackDef, SoundEffectDef, VarDef, RegionShape, PlaceableState, Hotspot, PlacedItem, PlacedNpc,
  PlacedPlayer, ConditionalTextEntry, Dialogue, DialogueNode, MapVisualSource, MapRegion, WorldMap, NodeMapLocation, SceneImageLayer, Node } from "@/domain/types";
import { toast } from "@/shared/toast/toastStore";

function isAbsoluteUrl(s: string) {
  return /^(https?:|data:|blob:)/.test(s);
}

function cleanZipPath(raw: string): string {
  const p = String(raw ?? "").trim().replaceAll("\\", "/");
  if (!p) return "";

  const parts = p.replace(/^\.\/+/, "").replace(/^\/+/, "").split("/").filter(Boolean).filter((seg) => seg !== "." && seg !== "..");

  return parts.join("/");
}

/* Limpia un título para usarlo como nombre de archivo */
function cleanFileName(title: string): string {
  return (title ?? "").trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").replace(/^[_-]+|[_-]+$/g, "");
}

/* Descarga un Blob como archivo */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function toZipAssetPath(filePath: string): string {
  const trimmed = String(filePath ?? "").trim();
  if (!trimmed || isAbsoluteUrl(trimmed)) return "";
  const withPrefix = /^assets\//i.test(trimmed) ? trimmed : `assets/${trimmed}`;
  return cleanZipPath(withPrefix);
}

function serializeAsset(asset: AssetDef) {
  return {
    id: asset.id,
    kind: asset.kind,
    name: asset.name,
    file: asset.file,
  };
}

function serializeVarDef(v: VarDef) {
  if (v.type === "number") {
    return {
      id: v.id,
      name: v.name,
      type: v.type,
      min: v.min,
      max: v.max,
      initial: v.initial,
    };
  }

  return {
    id: v.id,
    name: v.name,
    type: v.type,
    initial: v.initial,
  };
}

function serializeItem(item: ItemDef) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
  };
}

function serializeNpc(npc: NpcDef) {
  return {
    id: npc.id,
    name: npc.name,
    description: npc.description,
    vars: npc.vars?.map(serializeVarDef),
  };
}

function serializePlayerImage(image: PlayerImage) {
  return {
    id: image.id,
    name: image.name,
  };
}

function serializePlayer(player: PlayerDef) {
  return {
    id: player.id,
    name: player.name,
    description: player.description,
    images: player.images.map(serializePlayerImage),
    defaultImageId: player.defaultImageId,
    vars: player.vars?.map(serializeVarDef),
  };
}

function serializeMusicTrack(track: MusicTrackDef) {
  return {
    id: track.id,
    name: track.name,
  };
}

function serializeSoundEffect(sfx: SoundEffectDef) {
  return {
    id: sfx.id,
    name: sfx.name,
  };
}

function serializeRegionShape(shape: RegionShape) {
  return {
    type: shape.type,
    x: shape.x,
    y: shape.y,
    w: shape.w,
    h: shape.h,
  };
}

function serializePlaceableState(state: PlaceableState) {
  return {
    visible: state.visible,
    reachable: state.reachable,
    notReachableText: state.notReachableText,
  };
}

function serializeInteractionRules(rules: Hotspot["rules"] | PlacedItem["rules"] | PlacedNpc["rules"]) {
  return {
    onClick: rules.onClick?.map((rule) => ({
      id: rule.id,
      when: rule.when,
      phrase: rule.phrase,
      effects: rule.effects,
    })),
    onUseItem: rules.onUseItem?.map((rule) => ({
      id: rule.id,
      when: rule.when,
      phrase: rule.phrase,
      placedItemId: rule.placedItemId,
      effects: rule.effects,
    })),
  };
}

function serializeHotspot(hotspot: Hotspot) {
  return {
    id: hotspot.id,
    label: hotspot.label,
    shape: serializeRegionShape(hotspot.shape),
    initialState: serializePlaceableState(hotspot.initialState),
    vars: hotspot.vars.map(serializeVarDef),
    rules: serializeInteractionRules(hotspot.rules),
  };
}

function serializePlacedItem(item: PlacedItem) {
  return {
    id: item.id,
    shape: serializeRegionShape(item.shape),
    initialState: serializePlaceableState(item.initialState),
    itemId: item.itemId,
    label: item.label,
    rules: serializeInteractionRules(item.rules),
  };
}

function serializePlacedNpc(npc: PlacedNpc) {
  return {
    shape: serializeRegionShape(npc.shape),
    initialState: serializePlaceableState(npc.initialState),
    npcId: npc.npcId,
    rules: serializeInteractionRules(npc.rules),
  };
}

function serializePlacedPlayer(player: PlacedPlayer) {
  return {
    shape: serializeRegionShape(player.shape),
    initialState: {
      visible: player.initialState.visible,
    },
    playerId: player.playerId,
    initialImageId: player.initialImageId,
  };
}

function serializeConditionalTextEntry(entry: ConditionalTextEntry) {
  return {
    id: entry.id,
    label: entry.label,
    when: entry.when,
    content: entry.content,
  };
}

function serializeDialogueNode(node: DialogueNode) {
  if (node.type === "root") {
    return {
      id: node.id,
      type: node.type,
      childrenIds: [...node.childrenIds],
    };
  }

  return {
    id: node.id,
    type: node.type,
    speaker: node.speaker,
    text: node.text,
    when: node.when,
    effects: node.effects,
    childrenIds: [...node.childrenIds],
  };
}

function serializeDialogue(dialogue: Dialogue) {
  return {
    id: dialogue.id,
    playerId: dialogue.playerId,
    npcId: dialogue.npcId,
    title: dialogue.title,
    description: dialogue.description,
    when: dialogue.when,
    rootId: dialogue.rootId,
    nodes: dialogue.nodes.map(serializeDialogueNode),
  };
}

function serializeMapVisualSource(visual: MapVisualSource) {
  if (visual.type === "singleImage") {
    return {
      type: visual.type,
      imageAssetId: visual.imageAssetId,
    };
  }

  return {
    type: visual.type,
    backgroundAssetId: visual.backgroundAssetId,
  };
}

function serializeMapRegion(region: MapRegion) {
  return {
    id: region.id,
    label: region.label,
    shape: serializeRegionShape(region.shape),
    visible: region.visible,
    imageAssetId: region.imageAssetId,
    musicTrackId: region.musicTrackId,
    subMapId: region.subMapId,
    entrySceneId: region.entrySceneId,
    sceneIds: [...region.sceneIds],
  };
}

function serializeWorldMap(map: WorldMap) {
  return {
    id: map.id,
    name: map.name,
    visual: serializeMapVisualSource(map.visual),
    regions: map.regions.map(serializeMapRegion),
  };
}

function serializeNodeMapLocation(mapLocation: NodeMapLocation) {
  return {
    mapId: mapLocation.mapId,
    regionId: mapLocation.regionId,
    isEntry: mapLocation.isEntry,
  };
}

function serializeSceneImageLayer(layer: SceneImageLayer) {
  return {
    id: layer.id,
    assetId: layer.assetId,
    label: layer.label,
    when: layer.when,
    dock: layer.dock,
    text: layer.text.map(serializeConditionalTextEntry),
    hotspots: layer.hotspots?.map(serializeHotspot),
    placedItems: layer.placedItems?.map(serializePlacedItem),
    placedNpcs: layer.placedNpcs?.map(serializePlacedNpc),
    placedPlayers: layer.placedPlayers?.map(serializePlacedPlayer),
    musicTrackId: layer.musicTrackId,
  };
}

function serializeNode(node: Node) {
  return {
    id: node.id,
    title: node.title,
    layers: node.layers.map(serializeSceneImageLayer),
    dialogues: node.dialogues?.map(serializeDialogue),
    musicTrackId: node.musicTrackId,
    mapLocation: node.mapLocation ? serializeNodeMapLocation(node.mapLocation) : undefined,
    isStart: node.isStart,
    isFinal: node.isFinal,
    meta: node.meta ? { layout: node.meta.layout ? { x: node.meta.layout.x, y: node.meta.layout.y } : undefined } : undefined };
}

function serializeProject(project: Project) {
  return {
    id: project.id,
    title: project.title,
    assets: (project.assets ?? []).map(serializeAsset),
    items: (project.items ?? []).map(serializeItem),
    npcs: (project.npcs ?? []).map(serializeNpc),
    players: (project.players ?? []).map(serializePlayer),
    musicTracks: (project.musicTracks ?? []).map(serializeMusicTrack),
    soundEffects: (project.soundEffects ?? []).map(serializeSoundEffect),
    maps: (project.maps ?? []).map(serializeWorldMap),
    nodes: (project.nodes ?? []).map(serializeNode),
  };
}

/*Descarga únicamente el JSON actualizado del proyecto */
export function downloadProjectJsonFile(project: Project): void {
  try {
    const baseName = cleanFileName(project?.title ?? "") || "project";
    const serializedProject = serializeProject(project);
    const data = JSON.stringify(serializedProject, null, 2);
    const blob = new Blob([data], { type: "application/json" });

    downloadBlob(blob, `${baseName}.json`);
  } catch {
    toast.error("No se pudo exportar el JSON", "Ha ocurrido un error al generar/descargar el archivo del proyecto.");
  }
}

/* Exporta un proyecto como ZIP (JSON + assets) */
export async function exportProjectAsZip(project: Project, assetFiles: Record<ID, File>): Promise<void> {
  try {
    const zip = new JSZip();
    const baseName = cleanFileName(project?.title ?? "") || "project";
    const serializedProject = serializeProject(project);

    zip.file(`${baseName}.json`, JSON.stringify(serializedProject, null, 2));

    let missingCount = 0;

    for (const asset of project.assets ?? []) {
      const zipPath = toZipAssetPath(asset.file as string);
      if (!zipPath) continue;

      const file = assetFiles?.[asset.id];
      if (!file) {
        missingCount++;
        continue;
      }

      zip.file(zipPath, file);
    }

    if (missingCount > 0) {
      toast.warning("Exportación incompleta", `Faltan ${missingCount} archivos de assets en memoria (se exportó el JSON igualmente).`);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `${baseName}.zip`);
  } catch {
    toast.error("No se pudo exportar el ZIP", "Ha ocurrido un error al empaquetar el proyecto y sus assets.");
  }
}