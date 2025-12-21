import { DraftSceneSchema, type DraftSceneOutput } from "@/features/editor/validation/sceneSchemas";
import type { Project, ID } from "@/domain/types";
import type { ZodError } from "zod";

export type SceneValidationSeverity = "error" | "warning";

export interface SceneValidationIssue {
  field: string;
  path?: (string | number)[];
  severity: SceneValidationSeverity;
  code: string;
  message: string;
}

type AnyZodIssue = ZodError<unknown>["issues"][number];

function mapZodIssueToSceneIssue(issue: AnyZodIssue): SceneValidationIssue {
  const path = (issue.path ?? []).map((p) => (typeof p === "string" || typeof p === "number" ? p : String(p)));
  const field = path.length ? String(path[0]) : "scene";
  const code = typeof (issue as any).code === "string" ? String((issue as any).code) : "schema_error";
  return { field, path, severity: "error", code, message: issue.message };
}

/* Helpers */
function isRectShape(shape: unknown): shape is { type: "rect"; x: number; y: number; w: number; h: number } {
  if (!shape || typeof shape !== "object") return false;
  const s = shape as any;
  return s.type === "rect" && typeof s.x === "number" && typeof s.y === "number" && typeof s.w === "number" && typeof s.h === "number";
}

function isValid01Rect(shape: { x: number; y: number; w: number; h: number }): boolean {
  const ok01 = (v: number) => v >= 0 && v <= 1;
  if (!ok01(shape.x) || !ok01(shape.y) || !ok01(shape.w) || !ok01(shape.h)) return false;
  if (shape.w <= 0 || shape.h <= 0) return false;
  if (shape.x + shape.w > 1) return false;
  if (shape.y + shape.h > 1) return false;
  return true;
}

function extractGoToTargetsFromHotspotInteractions(interactions: Array<{ effects: Array<any> }>): ID[] {
  const out: ID[] = [];
  for (const it of interactions ?? []) {
    for (const ef of it.effects ?? []) {
      if (ef?.type === "goToNode" && typeof ef.targetNodeId === "string" && ef.targetNodeId.trim()) {
        out.push(ef.targetNodeId as ID);
      }
    }
  }
  return out;
}

/* Local (Zod) */
export function validateDraftSceneLocal(input: unknown): { parsed?: DraftSceneOutput; issues: SceneValidationIssue[] } {
  const result = DraftSceneSchema.safeParse(input);
  if (!result.success) return { parsed: undefined, issues: result.error.issues.map(mapZodIssueToSceneIssue) };
  return { parsed: result.data, issues: [] };
}

/* Contextual */
export function validateDraftSceneAgainstProject(
  draft: DraftSceneOutput,
  project: Project,
  options?: { currentNodeId?: ID }
): SceneValidationIssue[] {
  const issues: SceneValidationIssue[] = [];
  const currentId = options?.currentNodeId;

  // Título duplicado (warning)
  const normalizedTitle = draft.title.trim().toLowerCase();
  const duplicateNode = project.nodes.find((node) => {
    if (currentId && node.id === currentId) return false;
    return node.title.trim().toLowerCase() === normalizedTitle;
  });
  if (duplicateNode) {
    issues.push({
      field: "title",
      severity: "warning",
      code: "duplicate_title",
      message: `Ya existe otra escena con el título "${duplicateNode.title}".`,
    });
  }

  // Conflicto start (warning)
  if (draft.isStart) {
    const existingStart = project.nodes.find((node) => {
      if (!node.isStart) return false;
      if (currentId && node.id === currentId) return false;
      return true;
    });

    if (existingStart) {
      issues.push({
        field: "isStart",
        severity: "warning",
        code: "start_conflict",
        message: `Ya hay una escena inicial definida ("${existingStart.title}"). ¿Quieres sustituirla?`,
      });
    }
  }

  // Imagen obligatoria si hay zonas dibujadas
  const hasAnyHotspots = (draft.hotspots?.length ?? 0) > 0;
  const hasPlaced = (draft.placedItems?.length ?? 0) > 0 || (draft.placedNpcs?.length ?? 0) > 0;

  if ((hasAnyHotspots || hasPlaced) && !draft.image) {
    issues.push({
      field: "image",
      severity: "error",
      code: "image_required_for_drawn_zones",
      message: "Para usar zonas dibujadas (hotspots/ítems/PNJs) debes cargar una imagen.",
    });
  }

  // Hotspots: shape válida + targets existentes
  (draft.hotspots ?? []).forEach((hs, hsIndex) => {
    if (draft.image) {
      if (!isRectShape(hs.shape) || !isValid01Rect(hs.shape)) {
        issues.push({
          field: `hotspots[${hsIndex}]`,
          path: ["hotspots", hsIndex, "shape"],
          severity: "error",
          code: "hotspot_shape_invalid",
          message: `El área dibujada del hotspot ${hsIndex + 1} no es válida. Vuelve a dibujarla.`,
        });
      }
    }

    const targets = extractGoToTargetsFromHotspotInteractions(hs.interactions ?? []);
    for (const targetId of targets) {
      const targetExists = project.nodes.some((n) => n.id === targetId);
      if (!targetExists) {
        issues.push({
          field: `hotspots[${hsIndex}]`,
          path: ["hotspots", hsIndex, "interactions"],
          severity: "error",
          code: "invalid_hotspot_target",
          message: `El hotspot ${hsIndex + 1} apunta a un nodo inexistente (id: "${targetId}").`,
        });
      }
      if (currentId && targetId === currentId) {
        issues.push({
          field: `hotspots[${hsIndex}]`,
          path: ["hotspots", hsIndex, "interactions"],
          severity: "error",
          code: "hotspot_target_self",
          message: `El hotspot ${hsIndex + 1} no puede apuntar a la misma escena.`,
        });
      }
    }
  });

  // Referencias music/map
  if (draft.musicId) {
    const musicExists = project.musicTracks.some((t) => t.id === draft.musicId);
    if (!musicExists) {
      issues.push({
        field: "musicId",
        severity: "error",
        code: "invalid_music_id",
        message: "La escena hace referencia a una pista de música inexistente.",
      });
    }
  }

  if (draft.mapId) {
    const mapExists = project.maps.some((m) => m.id === draft.mapId);
    if (!mapExists) {
      issues.push({
        field: "mapId",
        severity: "error",
        code: "invalid_map_id",
        message: "La escena hace referencia a un mapa inexistente.",
      });
    }
  }

  // Placed items: itemId existe + shape válida (si hay imagen)
  (draft.placedItems ?? []).forEach((pi, index) => {
    const defExists = project.items.some((d) => d.id === pi.itemId);
    if (!defExists) {
      issues.push({
        field: "placedItems",
        path: ["placedItems", index, "itemId"],
        severity: "error",
        code: "invalid_item_id",
        message: `La escena hace referencia a un ítem inexistente (id: "${pi.itemId}").`,
      });
    }

    if (draft.image) {
      if (!isRectShape(pi.shape) || !isValid01Rect(pi.shape)) {
        issues.push({
          field: "placedItems",
          path: ["placedItems", index, "shape"],
          severity: "error",
          code: "placed_item_shape_invalid",
          message: `El área dibujada del ítem ${index + 1} no es válida. Vuelve a dibujarla.`,
        });
      }
    }
  });

  // Placed npcs: npcId existe + no duplicar + shape válida
  const seenNpcResourceIds = new Set<string>();
  (draft.placedNpcs ?? []).forEach((pn, index) => {
    const defExists = project.npcs.some((d) => d.id === pn.npcId);
    if (!defExists) {
      issues.push({
        field: "placedNpcs",
        path: ["placedNpcs", index, "npcId"],
        severity: "error",
        code: "invalid_npc_id",
        message: `La escena hace referencia a un PNJ inexistente (id: "${pn.npcId}").`,
      });
    }

    if (seenNpcResourceIds.has(pn.npcId)) {
      issues.push({
        field: "placedNpcs",
        path: ["placedNpcs", index, "npcId"],
        severity: "warning",
        code: "duplicate_npc_in_scene",
        message: `El PNJ "${pn.npcId}" está repetido en la escena.`,
      });
    } else {
      seenNpcResourceIds.add(pn.npcId);
    }

    if (draft.image) {
      if (!isRectShape(pn.shape) || !isValid01Rect(pn.shape)) {
        issues.push({
          field: "placedNpcs",
          path: ["placedNpcs", index, "shape"],
          severity: "error",
          code: "placed_npc_shape_invalid",
          message: `El área dibujada del PNJ ${index + 1} no es válida. Vuelve a dibujarla.`,
        });
      }
    }
  });

  return issues;
}

/* High level */
export function validateDraftScene(
  input: unknown,
  ctx?: { project?: Project; currentNodeId?: ID }
): { parsed?: DraftSceneOutput; issues: SceneValidationIssue[] } {
  const local = validateDraftSceneLocal(input);
  if (!local.parsed) return { parsed: undefined, issues: local.issues };

  const allIssues: SceneValidationIssue[] = [...local.issues];
  if (ctx?.project) {
    allIssues.push(...validateDraftSceneAgainstProject(local.parsed, ctx.project, { currentNodeId: ctx.currentNodeId }));
  }
  return { parsed: local.parsed, issues: allIssues };
}
