import type { ID, NpcDef, Project, VarDef } from "@/domain/types";
import { conditionReferences } from "@/domain/conditionRefs";
import { effectReferencesNpc, effectReferencesNpcVar } from "@/domain/effectRefs";
import { hasDuplicateName } from "@/validation/genericValidator";
import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";
import { removeAsset, removeAssetFile, safeTrim, sameVarDef, upsertAsset, upsertAssetFile } from "@/features/editor/core/editorGenericSlice";
import {
  collectDialogueIds, effectIsStartDialogueForAnyOf, isEntityReferenced, removeConditionsInProject, removeDialogues, removeEffectsInProject,
  removePlacedNpcs, someDialogue, somePlacedNpc
} from "@/features/editor/core/editorProjectWalkers";
import { findAssetByIdAndKind, findEntityById, removeById, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { nextSelectedAfterRemoval } from "@/features/editor/history/shared/genericHelpers";

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

export function createEditorNpcSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorNpcSlice {
  return {
    selectedNpcId: null,

    setSelectedNpcId: (id) => set({ selectedNpcId: id }),

    /* Añade un NPC */
    addNpc: (input) => {
      const { project, assetFiles } = get();
      if (!project) return null;

      const nextName = safeTrim(input?.name);
      const nextDescription = safeTrim(input?.description);
      const file = input?.file;

      if (!nextName) return null;
      if (!(file instanceof File)) return null;

      if (hasDuplicateName({ list: project.npcs, incomingName: nextName })) return null;

      const id = generateId.npc();
      const filePath = buildAssetPath("npcs", file.name);

      const newNpc: NpcDef = {
        id,
        name: nextName,
        ...(nextDescription ? { description: nextDescription } : null),
        vars: input.vars ?? [],
      };

      const assetResult = upsertAsset(project.assets, { id, kind: "npcs", name: nextName, file: filePath });

      const fileResult = upsertAssetFile(assetFiles, id, file);

      set({
        project: {
          ...project,
          npcs: [...project.npcs, newNpc],
          assets: assetResult.assets,
        },
        assetFiles: fileResult.assetFiles,
        selectedNpcId: id,
      });

      return id;
    },

    /* Actualiza nombre, descripción y/o fichero */
    updateNpc: (id, changes) =>
      set((state) => {
        if (!state.project) return state;

        const project = state.project;
        const prevNpc = findEntityById(project.npcs, id);
        if (!prevNpc) return state;

        const nextName = typeof changes.name === "string" ? safeTrim(changes.name) : "";
        const nameChanged = Boolean(nextName) && nextName !== prevNpc.name;

        if (nameChanged && hasDuplicateName({ list: project.npcs, incomingName: nextName, ignoreId: id })) return state;

        const nextDescription = typeof changes.description === "string" ? safeTrim(changes.description) : "";
        const prevDescription = safeTrim(prevNpc.description);
        const descriptionChanged = typeof changes.description === "string" && nextDescription !== prevDescription;

        const nextFile = changes.file instanceof File ? changes.file : null;
        const fileChanged = Boolean(nextFile);

        if (!nameChanged && !descriptionChanged && !fileChanged) return state;

        const nextNpc: NpcDef = {
          ...prevNpc,
          ...(nameChanged ? { name: nextName } : null),
          ...(descriptionChanged ? { description: nextDescription || undefined } : null),
        };

        let nextAssets = project.assets;
        let nextAssetFiles = state.assetFiles;

        const existingAsset = findAssetByIdAndKind(nextAssets, id, "npcs");

        if (nameChanged && existingAsset) {
          const assetResult = upsertAsset(nextAssets, { id, kind: "npcs", name: nextNpc.name, file: safeTrim(existingAsset.file) });
          nextAssets = assetResult.assets;
        }

        if (fileChanged && nextFile) {
          const filePath = buildAssetPath("npcs", nextFile.name);

          const assetResult = upsertAsset(nextAssets, { id, kind: "npcs", name: nextNpc.name, file: filePath });
          nextAssets = assetResult.assets;

          const fileResult = upsertAssetFile(nextAssetFiles, id, nextFile);
          nextAssetFiles = fileResult.assetFiles;
        }

        return {
          ...state,
          project: {
            ...project,
            npcs: replaceById(project.npcs, id, nextNpc),
            assets: nextAssets,
          },
          assetFiles: nextAssetFiles,
        };
      }),

    /* Añade una variable al NPC */
    addNpcVar: (npcId, variable) =>
      set((state) => {
        if (!state.project) return state;

        const project = state.project;
        const prevNpc = findEntityById(project.npcs, npcId);
        if (!prevNpc) return state;

        const prevVars = prevNpc.vars ?? [];

        if (prevVars.some((existingVar) => existingVar.id === variable.id)) return state;

        const nextNpc: NpcDef = {
          ...prevNpc,
          vars: [...prevVars, variable],
        };

        return {
          ...state,
          project: {
            ...project,
            npcs: replaceById(project.npcs, npcId, nextNpc),
          },
        };
      }),

    /* Actualiza una variable del NPC */
    updateNpcVar: (npcId, variable) =>
      set((state) => {
        if (!state.project) return state;

        const project = state.project;
        const prevNpc = findEntityById(project.npcs, npcId);
        if (!prevNpc) return state;

        const prevVars = prevNpc.vars ?? [];
        const varIndex = prevVars.findIndex((existingVar) => existingVar.id === variable.id);
        if (varIndex < 0) return state;

        const prevVar = prevVars[varIndex]!;
        if (sameVarDef(prevVar, variable)) return state;

        const nextVars = prevVars.slice();
        nextVars[varIndex] = variable;

        const nextNpc: NpcDef = {
          ...prevNpc,
          vars: nextVars,
        };

        return {
          ...state,
          project: {
            ...project,
            npcs: replaceById(project.npcs, npcId, nextNpc),
          },
        };
      }),

    /* Elimina una variable del NPC */
    removeNpcVar: (npcId, varId) =>
      set((state) => {
        if (!state.project) return state;

        let project = state.project;
        const prevNpc = findEntityById(project.npcs, npcId);
        if (!prevNpc) return state;

        const prevVars = prevNpc.vars ?? [];
        const nextVars = prevVars.filter((variable) => variable.id !== varId);
        if (nextVars.length === prevVars.length) return state;

        const nextNpc: NpcDef = { ...prevNpc, vars: nextVars };

        project = {
          ...project,
          npcs: replaceById(project.npcs, npcId, nextNpc),
        };

        project = removeConditionsInProject(project,
          (condition) => condition.type === "npcVar" &&
            condition.npcId === npcId && condition.varId === varId,
        );

        project = removeEffectsInProject(project, (effect) => effectReferencesNpcVar(effect, { npcId, varId }));

        return { ...state, project };
      }),

    /* Elimina un NPC global */
    removeNpc: (npcId) =>
      set((state) => {
        if (!state.project) return state;

        const npc = findEntityById(state.project.npcs, npcId);
        if (!npc) return state;

        const dialogueIds = collectDialogueIds(state.project, (dialogue) => dialogue.npcId === npcId);

        let project = removeEffectsInProject(state.project, (effect) => {
          if (effectReferencesNpc(effect, npcId)) return true;
          if (effectIsStartDialogueForAnyOf(effect, dialogueIds)) return true;
          return false;
        });

        project = removeConditionsInProject(project,
          (condition) => (condition.type === "npcVar" && condition.npcId === npcId) ||
            (condition.type === "placedNpcVisible" && condition.npcId === npcId) ||
            (condition.type === "placedNpcReachable" && condition.npcId === npcId),
        );

        project = removePlacedNpcs(project, (placedNpc) => placedNpc.npcId === npcId);
        project = removeDialogues(project, (dialogue) => dialogue.npcId === npcId);

        const assetResult = removeAsset(project.assets, { id: npcId, kind: "npcs" });
        const fileResult = removeAssetFile(state.assetFiles, npcId);

        return {
          ...state,
          project: {
            ...project,
            npcs: removeById(project.npcs, npcId),
            assets: assetResult.assets,
          },
          assetFiles: fileResult.assetFiles,
          selectedNpcId: nextSelectedAfterRemoval(state.selectedNpcId, npcId),
        };
      }),

    /* Comprueba si un NPC está referenciado */
    isNpcReferenced: (npcId: ID) => {
      const { project } = get();
      if (!project) return false;

      const dialogueIds = collectDialogueIds(project, (dialogue) => dialogue.npcId === npcId);
      const npcVars = findEntityById(project.npcs, npcId)?.vars ?? [];

      return isEntityReferenced(project, {
        someSceneRef: (currentProject) =>
          somePlacedNpc(currentProject, (placedNpc) => placedNpc.npcId === npcId) ||
          someDialogue(currentProject, (dialogue) => dialogue.npcId === npcId),

        someWhenRef: (when) => conditionReferences.npc(when, npcId) ||
          npcVars.some((variable) => conditionReferences.npcVar(when, { npcId, varId: variable.id })),

        someEffectRef: (effect) => effectReferencesNpc(effect, npcId) || effectIsStartDialogueForAnyOf(effect, dialogueIds)
      });
    },
  };
}