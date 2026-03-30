import { effectReferencesNpc, effectReferencesNpcVar } from "@/domain/effectRefs";
import { conditionReferencesNpc, conditionReferencesNpcVar } from "@/domain/conditionRefs";
import { generateId } from "@/utils/id";
import { buildAssetPath } from "@/store/assets/assetPath";
import { safeTrim, upsertAsset, upsertAssetFile, removeAsset, removeAssetFile, removeEffectsInProject, sameVarDef } from "@/features/editor/core/editorGenericSlice";
import {
  collectDialogueIds, effectIsStartDialogueForAnyOf, isEntityReferenced, mapAllWhensInProject, mapCondition, removePlacedNpcs,
  somePlacedNpc, someDialogue, removeDialogues
} from "@/features/editor/core/editorProjectWalkers";
import { hasDuplicateName } from "@/validation/genericValidator";
import type { ID, NpcDef, Project, VarDef, AssetDef } from "@/domain/types";

/* Contrato mínimo del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedNpcId: ID | null;
};

export interface EditorNpcSlice {
  selectedNpcId: ID | null;
  setSelectedNpcId: (id: ID | null) => void;
  addNpc: (input: { name: string; description?: string; file: File; vars?: VarDef[] }) => ID | null;
  updateNpc: (id: ID, changes: { name?: string; description?: string; file?: File | null }) => void;
  addNpcVar: (npcId: ID, variable: VarDef) => void;
  updateNpcVar: (npcId: ID, variable: VarDef) => void;
  removeNpcVar: (npcId: ID, varId: ID) => void;
  removeNpc: (id: ID) => void;
  isNpcReferenced: (id: ID) => boolean;
}


function removeNpcVarFromConditionsInProject(project: Project, npcId: ID, varId: ID): Project {
  return mapAllWhensInProject(project, (when) =>
    mapCondition(when, (c) => {
      if (c.type === "npcVar" && c.npcId === npcId && c.varId === varId) return undefined;
      return c;
    })
  );
}

function removeNpcFromConditionsInProject(project: Project, npcId: ID): Project {
  return mapAllWhensInProject(project, (when) =>
    mapCondition(when, (c) => {
      if (c.type === "npcVar" && c.npcId === npcId) return undefined;
      if (c.type === "placedNpcVisible" && c.npcId === npcId) return undefined;
      if (c.type === "placedNpcReachable" && c.npcId === npcId) return undefined;
      return c;
    })
  );
}

export function createEditorNpcSlice(set: (partial: Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorNpcSlice {
  return {
    selectedNpcId: null,

    setSelectedNpcId: (id) => set({ selectedNpcId: id }),

    addNpc: (input) => {
      const { project, assetFiles } = get();
      if (!project) return null;

      const safeName = safeTrim(input?.name);
      const safeDesc = safeTrim(input?.description);

      if (!safeName) return null;

      const file = input?.file;
      if (!(file instanceof File)) return null;

      const currentNpcs = project.npcs ?? [];
      if (hasDuplicateName({ list: currentNpcs, incomingName: safeName })) return null;

      const id = generateId.npc();
      const filePath = buildAssetPath("npcs", file.name);

      const newNpc: NpcDef = {
        id,
        name: safeName,
        ...(safeDesc ? { description: safeDesc } : null),
        vars: input.vars ?? [],
      };

      const assets0: AssetDef[] = project.assets ?? [];
      const resA = upsertAsset(assets0, { id, kind: "npcs", name: safeName, file: filePath });
      const resF = upsertAssetFile(assetFiles, id, file);

      set({
        project: { ...project, npcs: [...currentNpcs, newNpc], assets: resA.assets },
        assetFiles: resF.assetFiles,
        selectedNpcId: id,
      });

      return id;
    },

    updateNpc: (id, changes) =>
      set((state) => {
        if (!state.project) return state;
        const project = state.project;

        const npcList = project.npcs ?? [];
        const prev = npcList.find((x) => x.id === id);
        if (!prev) return state;

        const nextNameRaw = typeof changes.name === "string" ? changes.name.trim() : "";
        const nameChanged = Boolean(nextNameRaw) && nextNameRaw !== prev.name;

        if (nameChanged) {
          if (hasDuplicateName({ list: npcList, incomingName: nextNameRaw, ignoreId: id })) return state;
        }

        const nextDescRaw = typeof changes.description === "string" ? changes.description.trim() : "";
        const prevDescRaw = String(prev.description ?? "").trim();
        const descChanged = typeof changes.description === "string" && nextDescRaw !== prevDescRaw;

        const nextFile = changes.file instanceof File ? changes.file : null;
        const fileChanged = Boolean(nextFile);

        if (!nameChanged && !descChanged && !fileChanged) return state;

        const nextNpc: NpcDef = {
          ...prev,
          ...(nameChanged ? { name: nextNameRaw } : null),
          ...(descChanged ? { description: nextDescRaw || undefined } : null),
        };

        let nextAssets = project.assets ?? [];
        const existingAsset = nextAssets.find((a) => a.id === id && a.kind === "npcs") ?? null;

        if (nameChanged && existingAsset) {
          nextAssets = upsertAsset(nextAssets, { id, kind: "npcs", name: nextNpc.name, file: String(existingAsset.file ?? "").trim() }).assets;
        }

        let nextAssetFiles = state.assetFiles;

        if (fileChanged && nextFile) {
          const newPath = buildAssetPath("npcs", nextFile.name);

          nextAssets = upsertAsset(nextAssets, { id, kind: "npcs", name: nextNpc.name, file: newPath }).assets;

          nextAssetFiles = upsertAssetFile(nextAssetFiles, id, nextFile).assetFiles;
        }

        return {
          ...state,
          project: { ...project, npcs: npcList.map((x) => (x.id === id ? nextNpc : x)), assets: nextAssets },
          assetFiles: nextAssetFiles,
        };
      }),

    addNpcVar: (npcId, variable) =>
      set((state) => {
        if (!state.project) return state;
        const project = state.project

        const npcs0 = project.npcs ?? [];
        const idx = npcs0.findIndex((n) => n.id === npcId);
        if (idx < 0) return state;

        const prevNpc = npcs0[idx]!;
        const vars0 = prevNpc.vars ?? [];

        if (vars0.some((v) => v.id === variable.id)) return state;

        const nextNpc: NpcDef = { ...prevNpc, vars: [...vars0, variable] };
        const nextNpcs = npcs0.map((n) => (n.id === npcId ? nextNpc : n));

        return { ...state, project: { ...project, npcs: nextNpcs } };
      }),

    updateNpcVar: (npcId, variable) =>
      set((state) => {
        if (!state.project) return state;
        const project = state.project;

        const npcs0 = project.npcs ?? [];
        const idx = npcs0.findIndex((n) => n.id === npcId);
        if (idx < 0) return state;

        const prevNpc = npcs0[idx]!;
        const vars0 = prevNpc.vars ?? [];
        const vIdx = vars0.findIndex((v) => v.id === variable.id);
        if (vIdx < 0) return state;

        const prevVar = vars0[vIdx]!;
        if (sameVarDef(prevVar, variable)) return state;

        const nextVars = vars0.slice();
        nextVars[vIdx] = variable;

        const nextNpc: NpcDef = { ...prevNpc, vars: nextVars };
        const nextNpcs = npcs0.map((n) => (n.id === npcId ? nextNpc : n));

        return { ...state, project: { ...project, npcs: nextNpcs } };
      }),

    removeNpcVar: (npcId, varId) =>
      set((state) => {
        if (!state.project) return state;
        let project = state.project;

        const npcs0 = project.npcs ?? [];
        const idx = npcs0.findIndex((n) => n.id === npcId);
        if (idx < 0) return state;

        const prevNpc = npcs0[idx]!;
        const vars0 = prevNpc.vars ?? [];
        const nextVars = vars0.filter((v) => v.id !== varId);
        if (nextVars.length === vars0.length) return state;

        const nextNpc: NpcDef = { ...prevNpc, vars: nextVars };
        const nextNpcs = npcs0.map((n) => (n.id === npcId ? nextNpc : n));
        project = { ...project, npcs: nextNpcs };

        project = removeNpcVarFromConditionsInProject(project, npcId, varId);

        project = removeEffectsInProject(project, (e) => effectReferencesNpcVar(e, { npcId, varId }));

        return { ...state, project };
      }),

    removeNpc: (id) =>
      set((state) => {
        if (!state.project) return state;
        const project0 = state.project;

        const npc = (project0.npcs ?? []).find((x) => x.id === id);
        if (!npc) return state;

        const dialogueIds = collectDialogueIds(project0, (d) => d.npcId === id);

        let project = removeEffectsInProject(project0, (e) => {
          if (effectReferencesNpc(e, id)) return true;
          if (effectIsStartDialogueForAnyOf(e, dialogueIds)) return true;
          return false;
        });

        project = removeNpcFromConditionsInProject(project, id);

        project = removePlacedNpcs(project, (pn) => pn.npcId === id);
        project = removeDialogues(project, (d) => d.npcId === id);

        const remainingNpcs = (project.npcs ?? []).filter((x) => x.id !== id);
        const nextSelected = state.selectedNpcId === id ? null : state.selectedNpcId;

        const remA = removeAsset(project.assets ?? [], { id, kind: "npcs" });
        const remF = removeAssetFile(state.assetFiles, id);

        return {
          ...state,
          project: { ...project, npcs: remainingNpcs, assets: remA.assets },
          assetFiles: remF.assetFiles,
          selectedNpcId: nextSelected,
        };
      }),

    isNpcReferenced: (npcId: ID) => {
      const { project } = get();
      if (!project) return false;

      const dialogueIds = collectDialogueIds(project, (d) => d.npcId === npcId);

      return isEntityReferenced(project, {
        someSceneRef: (p) =>
          somePlacedNpc(p, (pn) => pn.npcId === npcId) ||
          someDialogue(p, (d) => d.npcId === npcId),
        someWhenRef: (when) =>
          conditionReferencesNpc(when, npcId) ||
          (project.npcs ?? [])
            .find((n) => n.id === npcId)
            ?.vars?.some((v) => conditionReferencesNpcVar(when, { npcId, varId: v.id })) === true,
        someEffectRef: (e) =>
          effectReferencesNpc(e, npcId) ||
          effectIsStartDialogueForAnyOf(e, dialogueIds),
      });
    },
  };
}