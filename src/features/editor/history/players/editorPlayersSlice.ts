import type { ID, ItemInstance, PlayerDef, PlayerImage, Project, VarDef } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import { hasDuplicateName } from "@/validation/genericValidator";
import { safeTrim, sameVarDef, upsertAsset, upsertAssetFile } from "@/features/editor/core/editorDataUtils";
import { findAssetByIdAndKind, findEntityById, isNameChanged, normalizeOptionalFile,
  normalizeOptionalName, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { ensureDefaultImageId, getPlayerImageList, hasDuplicatedInputImageNames } from "@/features/editor/history/shared/genericHelpers";
import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";

/* Contrato mínimo del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedPlayerId: ID | null;
  requestDelete: (target: DeleteTarget) => void;
};

export interface EditorPlayerSlice {
  selectedPlayerId: ID | null;
  setSelectedPlayerId: (id: ID | null) => void;

  addPlayer: (input: { name: string; description?: string; vars?: VarDef[]; images: Array<{ name: string; file: File }>; initialInventory?: ItemInstance[] }) => ID | null;
  updatePlayer: (playerId: ID, changes: { name?: string; description?: string }) => void;

  addPlayerImage: (playerId: ID, input: { name: string; file?: File | null }) => ID | null;
  updatePlayerImage: (playerId: ID, imageId: ID, patch: { name?: string; file?: File | null }) => void;
  removePlayerImage: (playerId: ID, imageId: ID) => void;
  setDefaultPlayerImage: (playerId: ID, imageId: ID) => void;

  addPlayerVar: (playerId: ID, variable: VarDef) => void;
  updatePlayerVar: (playerId: ID, variable: VarDef) => void;
  removePlayerVar: (playerId: ID, varId: ID) => void;

  addPlayerInventoryItem: (playerId: ID, item: ItemInstance) => void;
  updatePlayerInventoryItem: (playerId: ID, item: ItemInstance) => void;
  removePlayerInventoryItem: (playerId: ID, itemInstanceId: ID) => void;

  removePlayer: (playerId: ID) => void;
}



/* Slice */
export function createEditorPlayerSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorPlayerSlice {
  return {
    selectedPlayerId: null,

    setSelectedPlayerId: (id) => set({ selectedPlayerId: id }),

    /* Añade un Player */
    addPlayer: (input) => {
      const { project, assetFiles } = get();
      if (!project) return null;

      const nextName = normalizeOptionalName(input.name);
      const nextDescription = safeTrim(input.description);

      if (!nextName) return null;
      if (hasDuplicateName({ list: project.players, incomingName: nextName })) return null;

      const imagesIn = Array.isArray(input.images) ? input.images : [];
      if (imagesIn.length === 0) return null;

      const cleanedImages = imagesIn.map((image) => ({ id: generateId.playerImage(), name: normalizeOptionalName(image.name) || "Imagen", file: image.file }))
        .filter((image): image is { id: ID; name: string; file: File } => image.file instanceof File);

      if (cleanedImages.length === 0) return null;
      if (hasDuplicatedInputImageNames(cleanedImages)) return null;

      const existingImages = getPlayerImageList(project);

      for (const image of cleanedImages) if (hasDuplicateName({ list: existingImages, incomingName: image.name })) return null;

      const playerId = generateId.player();

      let nextAssets = project.assets;
      let nextAssetFiles = assetFiles;

      const newImages: PlayerImage[] = [];

      for (const image of cleanedImages) {
        const filePath = buildAssetPath("players", image.file.name);

        newImages.push({ id: image.id, name: image.name });

        nextAssets = upsertAsset(nextAssets, { id: image.id, kind: "players", name: image.name, file: filePath }).assets;

        nextAssetFiles = upsertAssetFile(nextAssetFiles, image.id, image.file).assetFiles;
      }

      const newPlayer: PlayerDef = {
        id: playerId,
        name: nextName,
        ...(nextDescription ? { description: nextDescription } : null),
        images: newImages,
        defaultImageId: newImages[0]!.id,
        vars: input.vars ?? [],
        initialInventory: input.initialInventory ?? [],
      };

      set({
        project: {
          ...project,
          players: [...project.players, newPlayer],
          assets: nextAssets,
        },
        assetFiles: nextAssetFiles,
        selectedPlayerId: playerId,
      });

      return playerId;
    },

    /* Actualiza nombre y/o descripción del Player */
    updatePlayer: (playerId, changes) =>
      set((state) => {
        if (!state.project) return state;

        const project = state.project;
        const prevPlayer = findEntityById(project.players, playerId);
        if (!prevPlayer) return state;

        const nextName = normalizeOptionalName(changes.name);
        const nameChanged = isNameChanged(prevPlayer.name, nextName);

        if (nameChanged && hasDuplicateName({ list: project.players, incomingName: nextName, ignoreId: playerId })) return state;

        const nextDescription = typeof changes.description === "string" ? safeTrim(changes.description) : "";

        const prevDescription = safeTrim(prevPlayer.description);

        const descriptionChanged = typeof changes.description === "string" && nextDescription !== prevDescription;

        if (!nameChanged && !descriptionChanged) return state;

        const nextPlayer: PlayerDef = {
          ...prevPlayer,
          ...(nameChanged ? { name: nextName } : null),
          ...(descriptionChanged ? { description: nextDescription || undefined } : null),
        };

        return {
          ...state,
          project: {
            ...project,
            players: replaceById(project.players, playerId, nextPlayer),
          },
        };
      }),

    /* Añade una imagen al Player */
    addPlayerImage: (playerId, input) => {
      const { project, assetFiles } = get();
      if (!project) return null;

      const player = findEntityById(project.players, playerId);
      if (!player) return null;

      const nextName = normalizeOptionalName(input.name);
      const file = normalizeOptionalFile(input.file);

      if (!nextName) return null;
      if (!file) return null;

      const imageList = getPlayerImageList(project);

      if (hasDuplicateName({ list: imageList, incomingName: nextName })) return null;

      const imageId = generateId.playerImage();
      const filePath = buildAssetPath("players", file.name);

      const newImage: PlayerImage = { id: imageId, name: nextName };

      const nextPlayer = ensureDefaultImageId({
        ...player,
        images: [...player.images, newImage],
      });

      const assetResult = upsertAsset(project.assets, { id: imageId, kind: "players", name: newImage.name, file: filePath });

      const fileResult = upsertAssetFile(assetFiles, imageId, file);

      set({
        project: {
          ...project,
          players: replaceById(project.players, playerId, nextPlayer),
          assets: assetResult.assets,
        },
        assetFiles: fileResult.assetFiles,
      });

      return imageId;
    },

    /* Actualiza nombre y/o fichero de una imagen del Player */
    updatePlayerImage: (playerId, imageId, patch) =>
      set((state) => {
        if (!state.project) return state;

        const project = state.project;
        const prevPlayer = findEntityById(project.players, playerId);
        if (!prevPlayer) return state;

        const prevImage = prevPlayer.images.find((image) => image.id === imageId);
        if (!prevImage) return state;

        const nextName = normalizeOptionalName(patch.name);
        const nameChanged = isNameChanged(prevImage.name, nextName);

        const imageList = getPlayerImageList(project);

        if (nameChanged && hasDuplicateName({ list: imageList, incomingName: nextName, ignoreId: imageId })) return state;

        const nextFile = normalizeOptionalFile(patch.file);
        const fileChanged = Boolean(nextFile);

        if (!nameChanged && !fileChanged) return state;

        const nextImage: PlayerImage = {
          ...prevImage,
          ...(nameChanged ? { name: nextName } : null),
        };

        const nextPlayer: PlayerDef = {
          ...prevPlayer,
          images: prevPlayer.images.map((image) => (image.id === imageId ? nextImage : image)),
        };

        let nextAssets = project.assets;
        let nextAssetFiles = state.assetFiles;

        const existingAsset = findAssetByIdAndKind(nextAssets, imageId, "players");

        if (nameChanged && existingAsset) {
          const assetResult = upsertAsset(nextAssets, { id: imageId, kind: "players", name: nextImage.name, file: safeTrim(existingAsset.file) });

          nextAssets = assetResult.assets;
        }

        if (fileChanged && nextFile) {
          const filePath = buildAssetPath("players", nextFile.name);

          const assetResult = upsertAsset(nextAssets, { id: imageId, kind: "players", name: nextImage.name, file: filePath });

          nextAssets = assetResult.assets;

          const fileResult = upsertAssetFile(nextAssetFiles, imageId, nextFile);
          nextAssetFiles = fileResult.assetFiles;
        }

        return {
          ...state,
          project: {
            ...project,
            players: replaceById(project.players, playerId, nextPlayer),
            assets: nextAssets,
          },
          assetFiles: nextAssetFiles,
        };
      }),

    /* Solicita la eliminación de una imagen del Player */
    removePlayerImage: (playerId, imageId) => {
      const { project, requestDelete } = get();
      if (!project) return;

      const player = findEntityById(project.players, playerId);
      if (!player) return;
      if (!player.images.some((image) => image.id === imageId)) return;

      requestDelete({ kind: "playerImage", playerId, imageId });
    },

    /* Cambia la imagen por defecto del Player */
    setDefaultPlayerImage: (playerId, imageId) =>
      set((state) => {
        if (!state.project) return state;

        const prevPlayer = findEntityById(state.project.players, playerId);
        if (!prevPlayer) return state;
        if (!prevPlayer.images.some((image) => image.id === imageId)) return state;
        if (prevPlayer.defaultImageId === imageId) return state;

        const nextPlayer: PlayerDef = { ...prevPlayer, defaultImageId: imageId };

        return {
          ...state,
          project: {
            ...state.project,
            players: replaceById(state.project.players, playerId, nextPlayer),
          },
        };
      }),

    /* Añade una variable al Player */
    addPlayerVar: (playerId, variable) =>
      set((state) => {
        if (!state.project) return state;

        const prevPlayer = findEntityById(state.project.players, playerId);
        if (!prevPlayer) return state;

        const prevVars = prevPlayer.vars ?? [];
        if (prevVars.some((existingVar) => existingVar.id === variable.id)) return state;

        const nextPlayer: PlayerDef = { ...prevPlayer, vars: [...prevVars, variable] };

        return {
          ...state,
          project: {
            ...state.project,
            players: replaceById(state.project.players, playerId, nextPlayer),
          },
        };
      }),

    /* Actualiza una variable del Player */
    updatePlayerVar: (playerId, variable) =>
      set((state) => {
        if (!state.project) return state;

        const prevPlayer = findEntityById(state.project.players, playerId);
        if (!prevPlayer) return state;

        const prevVars = prevPlayer.vars ?? [];
        const varIndex = prevVars.findIndex((existingVar) => existingVar.id === variable.id);
        if (varIndex < 0) return state;

        const prevVar = prevVars[varIndex]!;
        if (sameVarDef(prevVar, variable)) return state;

        const nextVars = prevVars.slice();
        nextVars[varIndex] = variable;

        const nextPlayer: PlayerDef = { ...prevPlayer, vars: nextVars };

        return {
          ...state,
          project: {
            ...state.project,
            players: replaceById(state.project.players, playerId, nextPlayer),
          },
        };
      }),

    /* Solicita la eliminación de una variable del Player */
    removePlayerVar: (playerId, varId) => {
      const { project, requestDelete } = get();
      if (!project) return;

      const player = findEntityById(project.players, playerId);
      if (!player) return;

      const vars = player.vars ?? [];
      if (!vars.some((variable) => variable.id === varId)) return;

      requestDelete({ kind: "playerVar", playerId, varId });
    },

    /* Añade un item al inventario inicial del Player */
    addPlayerInventoryItem: (playerId, item) =>
      set((state) => {
        if (!state.project) return state;

        const prevPlayer = findEntityById(state.project.players, playerId);
        if (!prevPlayer) return state;

        const prevInventory = prevPlayer.initialInventory ?? [];
        if (prevInventory.some((existingItem) => existingItem.itemInstanceId === item.itemInstanceId)) return state;

        const nextPlayer: PlayerDef = { ...prevPlayer, initialInventory: [...prevInventory, item] };

        return {
          ...state,
          project: {
            ...state.project,
            players: replaceById(state.project.players, playerId, nextPlayer),
          },
        };
      }),

    /* Actualiza un item del inventario inicial del Player */
    updatePlayerInventoryItem: (playerId, item) =>
      set((state) => {
        if (!state.project) return state;

        const prevPlayer = findEntityById(state.project.players, playerId);
        if (!prevPlayer) return state;

        const prevInventory = prevPlayer.initialInventory ?? [];
        if (!prevInventory.some((existingItem) => existingItem.itemInstanceId === item.itemInstanceId)) return state;

        const nextPlayer: PlayerDef = {
          ...prevPlayer,
          initialInventory: prevInventory.map((existingItem) => existingItem.itemInstanceId === item.itemInstanceId ? item : existingItem),
        };

        return {
          ...state,
          project: {
            ...state.project,
            players: replaceById(state.project.players, playerId, nextPlayer),
          },
        };
      }),

    /* Solicita la eliminación de un item del inventario inicial del Player */
    removePlayerInventoryItem: (playerId, itemInstanceId) => {
      const { project, requestDelete } = get();
      if (!project) return;

      const player = findEntityById(project.players, playerId);
      if (!player) return;

      const inventory = player.initialInventory ?? [];
      if (!inventory.some((item) => item.itemInstanceId === itemInstanceId)) return;

      requestDelete({ kind: "playerInventoryItem", playerId, itemInstanceId });
    },

    /* Solicita la eliminación de un Player global */
    removePlayer: (playerId) => {
      const { project, requestDelete } = get();
      if (!project) return;

      const player = findEntityById(project.players, playerId);
      if (!player) return;

      requestDelete({ kind: "player", playerId });
    },
  };
}