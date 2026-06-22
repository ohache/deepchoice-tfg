import type { ID, ItemInstance, NpcDef, Project, VarDef } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import { hasDuplicateName } from "@/validation/genericValidator";
import { safeTrim, sameVarDef, upsertAsset, upsertAssetFile } from "@/features/editor/core/editorDataUtils";
import { findAssetByIdAndKind, findEntityById, isNameChanged, normalizeOptionalFile,
  normalizeOptionalName, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
  import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";

/* Contrato mínimo del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedNpcId: ID | null;
  requestDelete: (target: DeleteTarget) => void;
};

export interface EditorNpcSlice {
  selectedNpcId: ID | null;
  setSelectedNpcId: (id: ID | null) => void;
  addNpc: (input: { name: string; description?: string; file: File; vars?: VarDef[]; initialInventory?: ItemInstance[] }) => ID | null;
  updateNpc: (id: ID, changes: { name?: string; description?: string; file?: File | null }) => void;
  addNpcVar: (npcId: ID, variable: VarDef) => void;
  updateNpcVar: (npcId: ID, variable: VarDef) => void;
  removeNpcVar: (npcId: ID, varId: ID) => void;
  addNpcInventoryItem: (npcId: ID, item: ItemInstance) => void;
  updateNpcInventoryItem: (npcId: ID, item: ItemInstance) => void;
  removeNpcInventoryItem: (npcId: ID, itemInstanceId: ID) => void;
  removeNpc: (id: ID) => void;
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

      const nextName = normalizeOptionalName(input.name);
      const nextDescription = safeTrim(input.description);
      const file = input.file;

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
        initialInventory: input.initialInventory ?? [],
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

        const nextName = normalizeOptionalName(changes.name);
        const nameChanged = isNameChanged(prevNpc.name, nextName);

        if (nameChanged && hasDuplicateName({ list: project.npcs, incomingName: nextName, ignoreId: id })) return state;
        
        const nextDescription = typeof changes.description === "string" ? safeTrim(changes.description) : "";

        const prevDescription = safeTrim(prevNpc.description);

        const descriptionChanged = typeof changes.description === "string" && nextDescription !== prevDescription;

        const nextFile = normalizeOptionalFile(changes.file);
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

    /* Solicita la eliminación de una variable del NPC */
    removeNpcVar: (npcId, varId) => {
      const { project, requestDelete } = get();
      if (!project) return;

      const npc = findEntityById(project.npcs, npcId);
      if (!npc) return;

      const vars = npc.vars ?? [];
      if (!vars.some((variable) => variable.id === varId)) return;

      requestDelete({ kind: "npcVar", npcId, varId });
    },

    /* Añade un item al inventario inicial del NPC */
    addNpcInventoryItem: (npcId, item) =>
      set((state) => {
        if (!state.project) return state;

        const prevNpc = findEntityById(state.project.npcs, npcId);
        if (!prevNpc) return state;

        const prevInventory = prevNpc.initialInventory ?? [];
        if (prevInventory.some((existingItem) => existingItem.itemInstanceId === item.itemInstanceId)) return state;

        const nextNpc: NpcDef = {
          ...prevNpc,
          initialInventory: [...prevInventory, item],
        };

        return {
          ...state,
          project: {
            ...state.project,
            npcs: replaceById(state.project.npcs, npcId, nextNpc),
          },
        };
      }),

    /* Actualiza un item del inventario inicial del NPC */
    updateNpcInventoryItem: (npcId, item) =>
      set((state) => {
        if (!state.project) return state;

        const prevNpc = findEntityById(state.project.npcs, npcId);
        if (!prevNpc) return state;

        const prevInventory = prevNpc.initialInventory ?? [];
        if (!prevInventory.some((existingItem) => existingItem.itemInstanceId === item.itemInstanceId)) return state;

        const nextNpc: NpcDef = {
          ...prevNpc,
          initialInventory: prevInventory.map((existingItem) =>
            existingItem.itemInstanceId === item.itemInstanceId ? item : existingItem,
          ),
        };

        return {
          ...state,
          project: {
            ...state.project,
            npcs: replaceById(state.project.npcs, npcId, nextNpc),
          },
        };
      }),

    /* Solicita la eliminación de un item del inventario inicial del NPC */
    removeNpcInventoryItem: (npcId, itemInstanceId) => {
      const { project, requestDelete } = get();
      if (!project) return;

      const npc = findEntityById(project.npcs, npcId);
      if (!npc) return;

      const inventory = npc.initialInventory ?? [];
      if (!inventory.some((item) => item.itemInstanceId === itemInstanceId)) return;

      requestDelete({ kind: "npcInventoryItem", npcId, itemInstanceId });
    },

    /* Solicita la eliminación de un NPC global */
    removeNpc: (npcId) => {
      const { project, requestDelete } = get();
      if (!project) return;

      const npc = findEntityById(project.npcs, npcId);
      if (!npc) return;

      requestDelete({ kind: "npc", npcId });
    },
  };
}