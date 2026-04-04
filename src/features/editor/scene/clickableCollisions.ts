import type { ID, RegionShape } from "@/domain/types";
import { isValidRect01, rect01Intersects } from "@/features/editor/hooks/regionShape";

export type ClickableKind = "hotspot" | "item" | "npc" | "player";

export type ClickableRegion = {
  kind: ClickableKind;
  id: ID;
  label: string;      
  shape: RegionShape;
};

export type IgnoreSelf = {
  kind: ClickableKind;
  id: ID;
};

export type Collision = {
  with: ClickableRegion;
};

type CollisionOptions = {
  ignore?: IgnoreSelf;
  minRect?: number;
};

/*  Comprueba si una región clicable coincide con el elemento a ignorar */
export function isSameClickable(clickable: ClickableRegion, other: IgnoreSelf | null | undefined): boolean {
  if (!other) return false;
  return clickable.kind === other.kind && clickable.id === other.id;
}

/* Devuelve todas las colisiones entre un rect draft y una colección de regiones clicables */
export function getCollisions01Rect(draftShape: RegionShape | null | undefined, all: ClickableRegion[], opts?: CollisionOptions): Collision[] {
  const ignore = opts?.ignore;
  const minRect = opts?.minRect ?? 0.02;

  if (!isValidRect01(draftShape, { min: minRect })) return [];

  const collisions: Collision[] = [];

  for (const region of all) {
    if (!isValidRect01(region?.shape, { min: minRect })) continue;
    if (ignore && isSameClickable(region, ignore)) continue;

    if (rect01Intersects(draftShape, region.shape)) collisions.push({ with: region });
  }

  return collisions;
}

/* Versión booleana + detalle de colisiones */
export function validateNoCollisions01Rect(draftShape: RegionShape | null | undefined, all: ClickableRegion[], opts?: CollisionOptions):
  { ok: true } | { ok: false; collisions: Collision[] } {
  const collisions = getCollisions01Rect(draftShape, all, opts);

  if (collisions.length === 0) return { ok: true };

  return { ok: false, collisions };
}

/* Helper UX */
export function formatCollisionLabel(region: ClickableRegion): string {
  const name = region.label.trim() || "(sin nombre)";

  switch (region.kind) {
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

export function formatCollisionSummary(collisions: Collision[], max = 2): string {
  const labels = collisions.map((collision) => formatCollisionLabel(collision.with));

  if (labels.length <= max) return labels.join(", ");

  const visible = labels.slice(0, max).join(", ");
  const remaining = labels.length - max;

  return `${visible}… (+${remaining})`;
}