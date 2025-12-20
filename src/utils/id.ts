import type { ID } from "@/domain/types";

const timestamp = () => Date.now().toString(36);
const random = (size = 4) => Math.random().toString(36).slice(2, 2 + size);

/** ID genérico */
export const generateId = (prefix: string): ID => {
  const safePrefix = prefix.trim() || "id";
  return `${safePrefix}-${timestamp()}-${random()}`;
};

export const generateNodeId = (): ID => generateId("node");
export const generateHotspotId = (): ID => generateId("hs");
export const generateHotspotInteraction = (): ID => generateId("int");
export const generateTagMusicId = (): ID => generateId("music");
export const generateTagItemId = (): ID => generateId("item");
export const generateTagMapId = (): ID => generateId("map");
export const generateTagPnjId = (): ID => generateId("pnj");

/** ID para proyectos (slug + timestamp) */
export const generateProjectId = (title: string): ID => {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  return `${slug || "project"}-${timestamp()}`;
};