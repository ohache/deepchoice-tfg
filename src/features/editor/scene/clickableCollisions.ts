import type { ID, RegionShape } from "@/domain/types";
import { isValidRect01, rect01Intersects } from "@/features/editor/hooks/regionShape";

export type ClickableKind = "hotspot" | "item" | "npc" | "player";

export type ClickableRegion = {
  kind: ClickableKind;
  id: ID;
  label: string;      // para mensajes UX
  shape: RegionShape; // rect 0..1 (de momento)
};

export type IgnoreSelf = { kind: ClickableKind; id: ID };

export type Collision = {
  with: ClickableRegion;
};

export function isSameClickable(a: ClickableRegion, b: IgnoreSelf | null | undefined): boolean {
  if (!b) return false;
  return a.kind === b.kind && a.id === b.id;
}

export function getCollisions01Rect(draftShape: RegionShape | null | undefined, all: ClickableRegion[],  opts?: {
    ignore?: IgnoreSelf;
    minRect?: number; 
  }
): Collision[] {
  const ignore = opts?.ignore;
  const minRect = opts?.minRect ?? 0.02;

  if (!isValidRect01(draftShape, { min: minRect })) return [];

  if (!draftShape || draftShape.type !== "rect") return [];

  const out: Collision[] = [];

  for (const r of all) {
    if (!r?.shape || r.shape.type !== "rect") continue;
    if (ignore && isSameClickable(r, ignore)) continue;

    if (rect01Intersects(draftShape, r.shape)) {
      out.push({ with: r });
    }
  }

  return out;
}

export function validateNoCollisions01Rect(draftShape: RegionShape | null | undefined,  all: ClickableRegion[], opts?: { ignore?: IgnoreSelf; minRect?: number; }
): { ok: true } | { ok: false; collisions: Collision[] } {
  const collisions = getCollisions01Rect(draftShape, all, opts);
  if (collisions.length === 0) return { ok: true };
  return { ok: false, collisions };
}

/** Helper UX: “Hotspot ‘Puerta’”, “Item ‘Llave’”… */
export function formatCollisionLabel(c: ClickableRegion): string {
  const name = (c.label ?? "").trim() || "(sin nombre)";

  switch (c.kind) {
    case "hotspot":
      return `Hotspot “${name}”`;
    case "item":
      return `Item “${name}”`;
    case "npc":
      return `PNJ “${name}”`;
    case "player":
      return `Player “${name}”`;
    default:
      return name;
  }
}

/** Helper UX: “Colisiona con: …” (corta) */
export function formatCollisionSummary(collisions: Collision[], max = 2): string {
  const labels = collisions.map((c) => formatCollisionLabel(c.with));
  if (labels.length <= max) return labels.join(", ");
  return labels.slice(0, max).join(", ") + `… (+${labels.length - max})`;
}
