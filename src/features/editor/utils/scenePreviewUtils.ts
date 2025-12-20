import type { ID, Project, PlacedItem, PlacedNpc } from "@/domain/types";

interface SceneLikeForPreview {
  mapId?: ID;
  musicId?: ID;
  placedItems?: PlacedItem[];
  placedNpcs?: PlacedNpc[];
}

export interface ScenePreviewMeta {
    mapLabel?: string;
    npcLabel?: string;
    itemLabel?: string;
    musicLabel?: string;
    musicFilePath?: string;
}

/*Construye las etiquetas de preview a partir del proyecto y de una escena */
export function buildScenePreviewMeta(project: Project | null | undefined, scene: SceneLikeForPreview | null | undefined): ScenePreviewMeta {
    if (!project || !scene) return {};

    const { mapId, musicId, placedItems, placedNpcs } = scene;

    let mapLabel: string | undefined;
    let npcLabel: string | undefined;
    let itemLabel: string | undefined;
    let musicLabel: string | undefined;
    let musicFilePath: string | undefined;

    if (musicId) {
        const track = project.musicTracks.find((t) => t.id === musicId);
        musicLabel = track?.name;
        musicFilePath = track?.file;
    }

    if (mapId) {
        const map = project.maps.find((m) => m.id === mapId);
        mapLabel = map?.name ?? "Mapa";
    }

    const primaryNpcId = placedNpcs?.[0]?.npcId;
    if (primaryNpcId) {
        const npc = project.npcs.find((n) => n.id === primaryNpcId);
        npcLabel = npc?.name ?? "PNJ";
    }

    const primaryItemId = placedItems?.[0]?.itemId;
    if (primaryItemId) {
        const item = project.items.find((it) => it.id === primaryItemId);
        itemLabel = item?.name ?? "Ítem";
    }

    return { mapLabel, npcLabel, itemLabel, musicLabel, musicFilePath };
}
