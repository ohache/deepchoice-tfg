import type { ComponentType, SVGProps } from "react";
import type { ConditionalTextEntry, ID, Project, SceneImageLayer, TextDock } from "@/domain/types";
import { ConditionBuilder, type Condition } from "@/domain/conditions";
import type { InteractionKind } from "@/features/editor/scene/layer/editorLayerSlice";
import { isEmptyCondition } from "@/shared/helpers";
import type { LayerToggleFieldId } from "@/features/editor/scene/SceneCommon";
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react";

type PendingInteractiveOpen = {
  kind: InteractionKind;
  id: ID;
};

type LayerSnapshotPatch = Pick<SceneImageLayer, | "assetId" | "label" | "when" | "dock" | "text" | "hotspots" | "placedItems" | "placedNpcs" | "placedPlayers" | "musicTrackId">;

export function emptyCondition(): Condition {
  return ConditionBuilder.and();
}

export function sameId(a: ID | null | undefined, b: ID | null | undefined): boolean {
  return Boolean(a && b && String(a) === String(b));
}

/* Clonado seguro del snapshot de una capa para restaurarla al cancelar */
export function cloneLayer(layer: SceneImageLayer): SceneImageLayer {
  if (typeof structuredClone === "function") return structuredClone(layer);
  return JSON.parse(JSON.stringify(layer)) as SceneImageLayer;
}

/* Extrae únicamente las propiedades editables de una capa para restaurarlas posteriormente. */
export function layerSnapshotPatch(snapshot: SceneImageLayer): LayerSnapshotPatch {
  return { assetId: snapshot.assetId, label: snapshot.label,  when: snapshot.when, dock: snapshot.dock, text: snapshot.text, hotspots: snapshot.hotspots,
    placedItems: snapshot.placedItems, placedNpcs: snapshot.placedNpcs, placedPlayers: snapshot.placedPlayers, musicTrackId: snapshot.musicTrackId };
}

export function findLayerById(layers: SceneImageLayer[], layerId: ID | null): SceneImageLayer | null {
  if (!layerId) return null;
  return layers.find((layer) => sameId(layer.id, layerId)) ?? null;
}

function normalizeLabel(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isBaseLayer(layerId: ID | null, baseLayerId: ID | null): boolean {
  return sameId(layerId, baseLayerId);
}

export function hasRealLayerCondition(layer: SceneImageLayer | null): boolean {
  return Boolean(layer?.when && !isEmptyCondition(layer.when));
}

export function buildVariantItems(layers: SceneImageLayer[]) {
  return layers.map((layer) => ({ id: layer.id, label: layer.label ?? "" }));
}

export function hasDuplicateLayerLabel(layers: SceneImageLayer[], currentLabel: string, editingLayerId: ID | null): boolean {
  const normalizedCurrentLabel = normalizeLabel(currentLabel);
  if (!normalizedCurrentLabel) return false;

  return layers.some((layer) => {
    if (editingLayerId && sameId(layer.id, editingLayerId)) return false;
    return normalizeLabel(layer.label) === normalizedCurrentLabel;
  });
}

/* Obtiene el panel visual asociado a un tipo de interacción pendiente. */
export function getPendingField(kind: InteractionKind): LayerToggleFieldId {
  switch (kind) {
    case "hotspot": return "hotspots";
    case "placedItem": return "placedItems";
    case "placedNpc": return "placedNpcs";
    case "placedPlayer": return "placedPlayers";
  }
}

/* Comprueba si el elemento interactivo pendiente sigue existiendo dentro de la capa. */
export function pendingTargetExists(layer: SceneImageLayer, pending: PendingInteractiveOpen): boolean {
  switch (pending.kind) {
    case "hotspot":
      return (layer.hotspots ?? []).some((item) => sameId(item.id, pending.id));
    case "placedItem":
      return (layer.placedItems ?? []).some((item) => sameId(item.itemInstanceId, pending.id));
    case "placedNpc":
      return (layer.placedNpcs ?? []).some((item) => sameId(item.npcId, pending.id));
    case "placedPlayer":
      return (layer.placedPlayers ?? []).some((item) => sameId(item.playerId, pending.id));
  }
}

 /* ------------------ HELPERS PARA SCENEIMAGEFIELD ------------------- */

 export type DockOption = {
   id: TextDock;
   label: string;
   Icon: ComponentType<SVGProps<SVGSVGElement>>;
 };
 
 export const IMG_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp";
 
 export const VALID_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
 
 export const VALID_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", ""];
 
 export const DOCKS: DockOption[] = [
   { id: "top", label: "Arriba", Icon: ArrowUpIcon },
   { id: "left", label: "Izquierda", Icon: ArrowLeftIcon },
   { id: "right", label: "Derecha", Icon: ArrowRightIcon },
   { id: "bottom", label: "Abajo", Icon: ArrowDownIcon },
 ];
 
 export function cx(...classes: Array<string | false | null | undefined>): string {
   return classes.filter(Boolean).join(" ");
 }
 
 /* Valida extensión y MIME del fichero seleccionado como imagen de fondo. */
 export function isValidImageFile(file: File): boolean {
   const fileName = file.name.toLowerCase();
 
   const hasValidExtension = VALID_IMAGE_EXTENSIONS.some((extension) => fileName.endsWith(extension));
 
   const hasValidMime = VALID_IMAGE_MIME_TYPES.includes(file.type);
 
   return hasValidExtension && hasValidMime;
 }
 
 /* Obtiene el nombre visible de un asset de fondo, usando primero File y después la ruta guardada. */
 export function getBackgroundFileName(args: { assetId: ID; assetFiles: Record<ID, File>; assets: Array<{ id: ID; kind: string; file: string }> }): string {
   const { assetId, assetFiles, assets } = args;
 
   const file = assetFiles[assetId];
   if (file?.name) return file.name;
 
   const asset = assets.find((entry) => entry.kind === "backgrounds" && entry.id === assetId);
 
   const path = asset?.file?.trim() ?? "";
   if (!path) return "";
 
   return path.split("/").pop() ?? path;
 }
 
 export function getFileLabel(assetId: ID, fileName: string): string {
   if (fileName) return `Imagen seleccionada: ${fileName}`;
   if (assetId) return "Imagen seleccionada";
   return "No hay imagen seleccionada";
 }

  /* ------------------ HELPERS PARA SCENETEXTFIELD ------------------- */
  export const BASE_LABEL = "Base";

  export type VariantDraft = {
    id: ID | null;
    label: string;
    content: string;
    when: Condition;
    labelError: string | null;
    contentError: string | null;
  };
  
  export function getLayerById(layers: SceneImageLayer[], layerId: ID): SceneImageLayer | null {
    return layers.find((layer) => sameId(layer.id, layerId)) ?? null;
  }
  
  export function getBaseEntry(entries: ConditionalTextEntry[]): ConditionalTextEntry | null {
    return entries.find((entry) => !entry.when) ?? null;
  }
  
  export function getVariantEntries(entries: ConditionalTextEntry[]): ConditionalTextEntry[] {
    return entries.filter((entry) => Boolean(entry.when));
  }
  
  export function createEmptyVariantDraft(): VariantDraft {
    return { id: null, label: "", content: "", when: emptyCondition(), labelError: null, contentError: null };
  }
  
  export function createVariantDraftFromEntry(entry: ConditionalTextEntry): VariantDraft {
    return { id: entry.id, label: entry.label ?? "", content: entry.content ?? "", when: entry.when ?? emptyCondition(), labelError: null, contentError: null };
  }
  
  export function buildLiveProject(project: Project | null, nodeDraft: Project["nodes"][number] | null | undefined): Project | null {
    if (!project) return null;
    if (!nodeDraft) return project;
  
    const nodes = project.nodes ?? [];
    const nodeIndex = nodes.findIndex((node) => sameId(node.id, nodeDraft.id));
  
    if (nodeIndex < 0) return { ...project, nodes: [...nodes, nodeDraft] };
  
    const nextNodes = [...nodes];
    nextNodes[nodeIndex] = nodeDraft;
  
    return { ...project, nodes: nextNodes };
  }
  
  function hasDuplicateVariantLabel(args: { variants: ConditionalTextEntry[]; label: string; editingVariantId: ID | null }): boolean {
    const { variants, label, editingVariantId } = args;
    const normalizedLabel = normalizeLabel(label);
  
    if (!normalizedLabel) return false;
  
    return variants.some((variant) => {
      if (sameId(variant.id, editingVariantId)) return false;
      return normalizeLabel(variant.label) === normalizedLabel;
    });
  }
  
  export function validateVariantDraft(args: { draft: VariantDraft; variants: ConditionalTextEntry[] }):
    { ok: boolean; labelError: string | null; contentError: string | null; conditionError: string | null } {
    const { draft, variants } = args;
  
    const labelTrimmed = draft.label.trim();
    const contentTrimmed = draft.content.trim();
  
    let labelError: string | null = null;
    let contentError: string | null = null;
    let conditionError: string | null = null;
  
    if (!labelTrimmed) labelError = "El label es obligatorio.";
    else if (hasDuplicateVariantLabel({ variants, label: labelTrimmed, editingVariantId: draft.id })) labelError = "Ya existe una variante con este label en esta capa.";
  
    if (!contentTrimmed) contentError = "El texto no puede estar vacío.";
  
    if (isEmptyCondition(draft.when)) conditionError = "La variante debe tener al menos una condición.";
  
    return { ok: !labelError && !contentError && !conditionError, labelError, contentError, conditionError };
  }
  
  export function buildTextListItems(args: { baseEntry: ConditionalTextEntry | null; variants: ConditionalTextEntry[] }): Array<{ id: ID; label?: string | null }> {
    const { baseEntry, variants } = args;
  
    const items: Array<{ id: ID; label?: string | null }> = [];
  
    if (baseEntry) items.push({ id: baseEntry.id, label: baseEntry.label ?? BASE_LABEL });
  
    for (const variant of variants) items.push({ id: variant.id, label: variant.label });
  
    return items;
  }