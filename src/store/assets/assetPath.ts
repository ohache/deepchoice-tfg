import type { AssetKind } from "@/domain/types";

const ASSET_PREFIX = "assets";

/* Prefijos de las rutas */
const ASSET_DIR = {
  backgrounds: `${ASSET_PREFIX}/backgrounds`,
  players: `${ASSET_PREFIX}/players`,
  npcs: `${ASSET_PREFIX}/npcs`,
  items: `${ASSET_PREFIX}/items`,
  music: `${ASSET_PREFIX}/music`,
  sfx: `${ASSET_PREFIX}/sfx`,
  maps: `${ASSET_PREFIX}/maps`,
} as const satisfies Record<AssetKind, string>;

/* Normaliza un nombre de archivo para que no pueda inyectar rutas */
function sanitizeFileName(fileName: string): string {
  const raw = fileName.trim();
  
  if (!raw) return "asset";

  const baseName = raw.replace(/\\/g, "/").split("/").pop() ?? "";

  if (baseName === "." || baseName === "..") return "asset";

  const sanitized  = baseName.replace(/\0/g, "").replace(/[<>:"|?*]/g, "").trim();

  return sanitized || "asset";
}

/* Builder principal por kind */
export function buildAssetPath(kind: AssetKind, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  return `${ASSET_DIR[kind]}/${safeName}`;
}