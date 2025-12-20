import type { Node } from "@/domain/types";

export type LayoutPos = { x: number; y: number };

export function computeNewNodeLayout(opts: {
  nodes: Node[];
  draftMeta?: any;
  grid?: number;
  gapCells?: number;
  start?: LayoutPos;
}): LayoutPos | undefined {
  const { nodes, draftMeta, grid = 80, gapCells = 2, start = { x: 80, y: 80 } } = opts;

  const snap = (v: number) => Math.round(v / grid) * grid;

  const getLayout = (n: Node): LayoutPos | null => {
    const l = (n.meta as any)?.layout;
    if (!l) return null;
    const x = typeof l.x === "number" ? snap(l.x) : null;
    const y = typeof l.y === "number" ? snap(l.y) : null;
    if (x == null || y == null) return null;
    return { x, y };
  };

  const dl = (draftMeta as any)?.layout;
  if (dl && typeof dl.x === "number" && typeof dl.y === "number") {
    return { x: snap(dl.x), y: snap(dl.y) };
  }

  const key = (p: LayoutPos) => `${p.x},${p.y}`;
  const blocked = new Set<string>();
  
  function blockCell(p: LayoutPos) {
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        blocked.add(key({ x: p.x + ox * grid, y: p.y + oy * grid }));
      }
    }
  }
  
  for (const n of nodes) {
    const pos = getLayout(n);
    if (pos) blockCell(pos);
  }
  

  const last = nodes[nodes.length - 1];
  const lastPos = last ? getLayout(last) : null;

  const preferred = lastPos
    ? { x: lastPos.x + gapCells * grid, y: lastPos.y }
    : start;

  const pref = { x: snap(preferred.x), y: snap(preferred.y) };
  if (!blocked.has(key(pref))) return pref;

  for (let dy = 0; dy <= 30; dy++) {
    for (let dx = 1; dx <= 30; dx++) {
      const c = { x: pref.x + dx * grid, y: pref.y + dy * grid };
      if (!blocked.has(key(c))) return c;
    }
  }

  let maxX = start.x;
  let maxY = start.y;
  for (const n of nodes) {
    const pos = getLayout(n);
    if (!pos) continue;
    if (pos.x > maxX) {
      maxX = pos.x;
      maxY = pos.y;
    }
  }
  return { x: maxX + gapCells * grid, y: maxY };
}