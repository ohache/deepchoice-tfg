import type { AssetDef, ID, Node, Project, VarDef, InteractionRules, PlayerDef, SceneImageLayer,
  NodeMeta, ConditionalTextEntry } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import { buildAssetPath } from "@/store/assets/assetPath";
import type { NodeDraftDTO } from "../scene/node/nodeSchemas";
import { generateId } from "@/utils/id";

/* Trim “seguro”: siempre retorna string */
export function safeTrim(s: string | undefined | null): string {
  return String(s ?? "").trim();
}

/* Aplica patch a una VarDef sin perder la coherencia del discriminated union */
export function patchVar(prev: VarDef, patch: Partial<Omit<VarDef, "id">>): VarDef {
  if (patch.type && patch.type !== prev.type) {
    const name = typeof patch.name === "string" ? patch.name : prev.name;

    if (patch.type === "number") {
      const p = patch as Partial<Omit<Extract<VarDef, { type: "number" }>, "id">>;
      const min = p.min ?? (prev.type === "number" ? prev.min : 0);
      const max = p.max ?? (prev.type === "number" ? prev.max : 10);
      const initial = p.initial ?? (prev.type === "number" ? prev.initial : min);

      return { id: prev.id, name, type: "number", min, max, initial };
    }

    const p = patch as Partial<Omit<Extract<VarDef, { type: "boolean" }>, "id">>;
    const initial = p.initial ?? (prev.type === "boolean" ? prev.initial : false);

    return { id: prev.id, name, type: "boolean", initial };
  }

  if (prev.type === "number") {
    const p = patch as Partial<Omit<Extract<VarDef, { type: "number" }>, "id">>;
    return { ...prev, ...p };
  }

  const p = patch as Partial<Omit<Extract<VarDef, { type: "boolean" }>, "id">>;
  return { ...prev, ...p };
}

/* Upsert de AssetDef */
export function upsertAsset(
  assets: AssetDef[],
  input: { id: ID; kind: AssetDef["kind"]; name: string; file: string },
): { assets: AssetDef[]; touched: boolean } {
  const current = assets ?? [];
  const idx = current.findIndex((a) => a.id === input.id && a.kind === input.kind);

  if (idx >= 0) {
    const prev = current[idx]!;
    const next: AssetDef = {
      ...prev,
      name: input.name,
      file: input.file,
    };

    const changed = prev.name !== next.name || prev.file !== next.file;
    if (!changed) return { assets: current, touched: false };

    const nextAssets = current.slice();
    nextAssets[idx] = next;
    return { assets: nextAssets, touched: true };
  }

  return {
    assets: [...current, { id: input.id, kind: input.kind, name: input.name, file: input.file }],
    touched: true,
  };
}

/* Elimina AssetDef por (id + kind) */
export function removeAsset(assets: AssetDef[], input: { id: ID; kind: AssetDef["kind"] }): { assets: AssetDef[]; touched: boolean } {
  const current = assets ?? [];
  const next = current.filter((a) => !(a.id === input.id && a.kind === input.kind));
  return { assets: next, touched: next.length !== current.length };
}

/* Upsert de assetFiles: assetFiles[assetId] = File */
export function upsertAssetFile(assetFiles: Record<ID, File>, assetId: ID, file: File): { assetFiles: Record<ID, File>; touched: boolean } {
  const current = assetFiles ?? {};
  if (current[assetId] === file) return { assetFiles: current, touched: false };
  return { assetFiles: { ...current, [assetId]: file }, touched: true };
}

/* Remove de assetFiles */
export function removeAssetFile(assetFiles: Record<ID, File>, assetId: ID): { assetFiles: Record<ID, File>; touched: boolean } {
  const current = assetFiles ?? {};
  if (!(assetId in current)) return { assetFiles: current, touched: false };

  const next = { ...current };
  delete next[assetId];
  return { assetFiles: next, touched: true };
}

/* Devuelve true en cuanto encuentra un Effect que cumpla predicate */
export function someEffectsInProject(project: Project, predicate: (e: Effect) => boolean): boolean {
  for (const n of project.nodes ?? []) {
    if (someEffectsInNode(n, predicate)) return true;
  }
  return false;
}

function someEffectsInNode(node: Node, predicate: (e: Effect) => boolean): boolean {
  for (const layer of node.layers ?? []) {
    for (const h of layer.hotspots ?? []) {
      if (someEffectsInInteractionRules(h.rules, predicate)) return true;
    }

    for (const pi of layer.placedItems ?? []) {
      if (someEffectsInInteractionRules(pi.rules, predicate)) return true;
    }

    for (const pn of layer.placedNpcs ?? []) {
      if (someEffectsInInteractionRules(pn.rules, predicate)) return true;
    }
  }

  for (const d of node.dialogues ?? []) {
    for (const dn of d.nodes ?? []) {
      if (dn.type === "line" && someEffectsInEffects(dn.effects, predicate)) return true;
    }
  }

  return false;
}

function someEffectsInInteractionRules(rules: InteractionRules | undefined, predicate: (e: Effect) => boolean): boolean {
  if (!rules) return false;

  for (const r of rules.onClick ?? []) {
    if (someEffectsInEffects(r.effects, predicate)) return true;
  }
  for (const r of rules.onUseItem ?? []) {
    if (someEffectsInEffects(r.effects, predicate)) return true;
  }

  return false;
}

function someEffectsInEffects(effects: Effect[] | undefined, predicate: (e: Effect) => boolean): boolean {
  if (!effects || effects.length === 0) return false;
  for (const e of effects) if (predicate(e)) return true;
  return false;
}

/* Elimina Effects que cumplan predicate en todo el proyecto */
export function removeEffectsInProject(project: Project, predicate: (e: Effect) => boolean): Project {
  const nodes0 = project.nodes ?? [];
  let touchedNodes = false;

  const nextNodes = nodes0.map((n) => {
    const res = removeEffectsInNode(n, predicate);
    if (res.touched) touchedNodes = true;
    return res.node;
  });

  if (!touchedNodes) return project;

  return { ...project, nodes: nextNodes };
}

function removeEffectsInNode(node: Node, predicate: (e: Effect) => boolean): { node: Node; touched: boolean } {
  const layers0 = node.layers ?? [];
  const dialogues0 = node.dialogues ?? [];

  let touched = false;

  const pruneRules = (rules0: InteractionRules | undefined): { rules: InteractionRules | undefined; touched: boolean } => {
    if (!rules0) return { rules: rules0, touched: false };

    let touchedRules = false;

    const pruneRuleList = <T extends { effects: Effect[] }>(list0: T[] | undefined): T[] | undefined => {
      if (!list0 || list0.length === 0) return list0;

      let listTouched = false;
      const next = list0.map((r) => {
        const e0 = r.effects ?? [];
        if (e0.length === 0) return r;

        const e1 = e0.filter((e) => !predicate(e));
        if (e1.length === e0.length) return r;

        listTouched = true;
        return { ...r, effects: e1 };
      });

      if (listTouched) touchedRules = true;
      return listTouched ? next : list0;
    };

    const nextOnClick = pruneRuleList(rules0.onClick);
    const nextOnUseItem = pruneRuleList(rules0.onUseItem);

    if (!touchedRules) return { rules: rules0, touched: false };

    return {
      rules: {
        ...rules0,
        onClick: nextOnClick,
        onUseItem: nextOnUseItem,
      },
      touched: true,
    };
  };

  const mapRuleContainers = <T extends { rules: InteractionRules }>(list0: T[] | undefined): { list: T[] | undefined; touched: boolean } => {
    if (!list0 || list0.length === 0) return { list: list0, touched: false };

    let listTouched = false;

    const nextList = list0.map((entry) => {
      const res = pruneRules(entry.rules);
      if (!res.touched) return entry;

      listTouched = true;
      return { ...entry, rules: res.rules ?? entry.rules };
    });

    return { list: listTouched ? nextList : list0, touched: listTouched };
  };

  const nextLayers = layers0.map((layer) => {
    let layerTouched = false;

    const resHotspots = mapRuleContainers(layer.hotspots);
    if (resHotspots.touched) layerTouched = true;

    const resItems = mapRuleContainers(layer.placedItems);
    if (resItems.touched) layerTouched = true;

    const resNpcs = mapRuleContainers(layer.placedNpcs);
    if (resNpcs.touched) layerTouched = true;

    if (!layerTouched) return layer;

    touched = true;
    return {
      ...layer,
      hotspots: resHotspots.touched ? resHotspots.list : layer.hotspots,
      placedItems: resItems.touched ? resItems.list : layer.placedItems,
      placedNpcs: resNpcs.touched ? resNpcs.list : layer.placedNpcs,
    };
  });

  const nextDialogues = dialogues0.map((d) => {
    const dNodes0 = d.nodes ?? [];
    if (dNodes0.length === 0) return d;

    let touchedDialogue = false;

    const nextDNodes = dNodes0.map((dn) => {
      if (dn.type !== "line") return dn;

      const e0 = dn.effects ?? [];
      if (e0.length === 0) return dn;

      const e1 = e0.filter((e) => !predicate(e));
      if (e1.length === e0.length) return dn;

      touchedDialogue = true;
      return { ...dn, effects: e1 };
    });

    if (!touchedDialogue) return d;

    touched = true;
    return { ...d, nodes: nextDNodes };
  });

  if (!touched) return { node, touched: false };

  return {
    node: {
      ...node,
      layers: nextLayers,
      dialogues: nextDialogues,
    },
    touched: true,
  };
}

export function sameVarDef(a: VarDef, b: VarDef): boolean {
  if (a.id !== b.id) return false;
  if (a.type !== b.type) return false;

  const aName = (a.name ?? "").trim();
  const bName = (b.name ?? "").trim();
  if (aName !== bName) return false;

  if (a.type === "number" && b.type === "number") {
    return a.min === b.min && a.max === b.max && a.initial === b.initial;
  }

  if (a.type === "boolean" && b.type === "boolean") {
    return a.initial === b.initial;
  }

  return false;
}

export function buildPlayerImageAssetName(playerName: string, imageName: string) {
  const p = (playerName ?? "").trim();
  const i = (imageName ?? "").trim();
  if (p && i) return `${p} - ${i}`;
  return i || p || "Player image";
}

export function ensureDefaultImageId(player: PlayerDef): PlayerDef {
  const imgs = player.images ?? [];
  if (imgs.length === 0) return { ...player, defaultImageId: undefined };

  const current = (player.defaultImageId ?? "").trim();
  if (current && imgs.some((x) => x.id === current)) return player;

  return { ...player, defaultImageId: imgs[0]!.id };
}

export function fileExtFromName(name: string) {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? "png";
}

export function fileExtFromAssetPath(assetFilePath: string) {
  return fileExtFromName(assetFilePath);
}

export function buildPlayerImageFilePath(playerName: string, imageName: string, ext: string) {
  const folder = safeTrim(playerName) || "player";
  return buildAssetPath("players", `${folder}/${imageName}.${ext}`);
}

/** Deep clone seguro para POJOs (Node/Layer) */
export function deepClonePojo<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDefaultNodeMeta(): NodeMeta {
  return {};
}

/** Crea un draft vacío (sin id) listo para el formulario */
export function createEmptyNodeDraft(): NodeDraftDTO {
  return {
    title: "",
    layers: [],
    dialogues: [],
    musicTrackId: undefined,
    mapLocation: undefined,
    isStart: undefined,
    isFinal: undefined,
    meta: createDefaultNodeMeta(),
  };
}

/** Crea un draft (sin id) a partir de un Node existente */
export function createNodeDraftFromNode(node: Node): NodeDraftDTO {
  const cloned = deepClonePojo(node);

  return {
    title: String(cloned.title ?? ""),
    layers: cloned.layers ?? [],
    dialogues: cloned.dialogues ?? [],
    musicTrackId: cloned.musicTrackId,
    mapLocation: cloned.mapLocation,
    isStart: cloned.isStart,
    isFinal: cloned.isFinal,
    meta: cloned.meta ?? createDefaultNodeMeta(),
  };
}

/** (Opcional) Si quieres un helper de layer “vacío” para el editor */
export function createEmptySceneImageLayer(): SceneImageLayer {
  return {
    id: generateId.background(),
    label: "Nueva capa",
    assetId: "" as ID,
    when: undefined,
    dock: "bottom",
    text: [],
    hotspots: [],
    placedItems: [],
    placedNpcs: [],
    placedPlayers: [],
    musicTrackId: undefined,
  };
}

export function createEmptyLayer(): SceneImageLayer {
  return {
    id: generateId.background(),
    label: "Nueva capa",
    assetId: "",
    when: undefined,
    dock: "bottom",
    text: [],
    hotspots: [],
    placedItems: [],
    placedNpcs: [],
    placedPlayers: [],
    musicTrackId: undefined,
  };
}

export function createEmptyTextEntry(): ConditionalTextEntry {
  return {
    id: generateId.text(),
    label: "Texto",
    content: "",
  };
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return arr;
  next.splice(to, 0, moved);
  return next;
}

export function reorderArray<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return arr;
  if (fromIndex < 0 || fromIndex >= arr.length) return arr;
  if (toIndex < 0 || toIndex >= arr.length) return arr;

  const next = arr.slice();
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return arr;
  next.splice(toIndex, 0, moved);
  return next;
}

export function ensureLayerArrays(layer: SceneImageLayer): SceneImageLayer {
  const hasHotspots = Array.isArray(layer.hotspots);
  const hasPlacedItems = Array.isArray(layer.placedItems);
  const hasPlacedNpcs = Array.isArray(layer.placedNpcs);
  const hasPlacedPlayers = Array.isArray(layer.placedPlayers);

  if (hasHotspots && hasPlacedItems && hasPlacedNpcs && hasPlacedPlayers) return layer;

  return {
    ...layer,
    hotspots: hasHotspots ? layer.hotspots : [],
    placedItems: hasPlacedItems ? layer.placedItems : [],
    placedNpcs: hasPlacedNpcs ? layer.placedNpcs : [],
    placedPlayers: hasPlacedPlayers ? layer.placedPlayers : [],
  };
}

export function isEmptyCondition(cond: unknown): boolean {
  if (!cond) return true;
  const c = cond as any;
  const type = String(c.type ?? c.op ?? "").toLowerCase();
  if ((type === "and" || type === "or") && Array.isArray(c.all) && c.all.length === 0) return true;
  const items = c.items ?? c.terms ?? c.children ?? c.rules;
  if ((type === "and" || type === "or") && Array.isArray(items) && items.length === 0) return true;
  return false;
}