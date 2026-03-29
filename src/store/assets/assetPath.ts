import type { AssetKind } from "@/domain/types";

export const ASSET_PREFIX = "assets";

/* Prefijos de las rutas */
export const ASSET_DIR = {
  backgrounds: `${ASSET_PREFIX}/backgrounds`,
  players: `${ASSET_PREFIX}/players`,
  npcs: `${ASSET_PREFIX}/npcs`,
  items: `${ASSET_PREFIX}/items`,
  music: `${ASSET_PREFIX}/music`,
  sfx: `${ASSET_PREFIX}/sfx`,
  maps: `${ASSET_PREFIX}/maps`,
} as const satisfies Record<AssetKind, string>;

/* Normaliza un nombre de archivo para que no pueda inyectar rutas */
export function safeFileName(originalFileName: string): string {
  const raw = String(originalFileName ?? "").trim();
  
  if (!raw) return "asset";

  const normalized = raw.replace(/\\/g, "/");
  const base = normalized.split("/").pop() ?? "";

  if (base === "." || base === "..") return "asset";

  const clean = base.replace(/\0/g, "").replace(/[<>:"|?*]/g, "").trim();

  return clean || "asset";
}

/* Builder principal por kind */
export function buildAssetPath(kind: AssetKind, fileName: string): string {
  const safeName = safeFileName(fileName);
  return `${ASSET_DIR[kind].replace(/\/+$/, "")}/${safeName.replace(/^\/+/, "")}`;
}