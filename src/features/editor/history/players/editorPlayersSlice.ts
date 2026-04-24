import type { ID, PlacedPlayer, PlayerDef, PlayerImage, Project, VarDef } from "@/domain/types";
import { conditionReferences } from "@/domain/conditionRefs";
import { effectReferencesPlayer, effectReferencesPlayerVar } from "@/domain/effectRefs";
import { hasDuplicateName } from "@/validation/genericValidator";
import { generateId } from "@/utils/id";
import { fileExtFromName, removeAsset, removeAssetFile, safeTrim, sameVarDef, upsertAsset, upsertAssetFile } from "@/features/editor/core/editorGenericSlice";
import { isEntityReferenced, removeConditionsInProject, removeDialogues, removeEffectsInProject, removePlacedPlayers, collectDialogueIds,
  effectIsStartDialogueForAnyOf, someDialogue, somePlacedPlayer } from "@/features/editor/core/editorProjectWalkers";
import { findAssetByIdAndKind, findEntityById, removeById, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { nextSelectedAfterRemoval, buildPlayerImageFilePath, ensureDefaultImageId } from "@/features/editor/history/shared/genericHelpers";

/* Contrato mínimo del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedPlayerId: ID | null;
};

export interface EditorPlayerSlice {
  selectedPlayerId: ID | null;
  setSelectedPlayerId: (id: ID | null) => void;
  addPlayer: (input: { name: string; description?: string; vars?: VarDef[]; images: Array<{ name: string; file: File }> }) => ID | null;
  updatePlayer: (playerId: ID, changes: { name?: string; description?: string }) => void;
  addPlayerImage: (playerId: ID, input: { name: string; file?: File | null }) => ID | null;
  updatePlayerImage: (playerId: ID, imageId: ID, patch: { name?: string; file?: File | null }) => void;
  removePlayerImage: (playerId: ID, imageId: ID) => void;
  setDefaultPlayerImage: (playerId: ID, imageId: ID) => void;
  addPlayerVar: (playerId: ID, variable: VarDef) => void;
  updatePlayerVar: (playerId: ID, variable: VarDef) => void;
  removePlayerVar: (playerId: ID, varId: ID) => void;
  removePlayer: (playerId: ID) => void;
  isPlayerReferenced: (playerId: ID) => boolean;
}

/* Slice */
export function createEditorPlayerSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorPlayerSlice {
  return {
    selectedPlayerId: null,

    setSelectedPlayerId: (id) => set({ selectedPlayerId: id }),

    /* Añade un player */
    addPlayer: (input) => {
      const { project, assetFiles } = get();
      if (!project) return null;

      const nextName = safeTrim(input?.name);
      const nextDescription = safeTrim(input?.description);

      if (!nextName) return null;
      if (hasDuplicateName({ list: project.players, incomingName: nextName })) return null;

      const imagesIn = Array.isArray(input?.images) ? input.images : [];
      if (imagesIn.length === 0) return null;

      const cleanedImages = imagesIn.map((image) =>
        ({ id: generateId.playerImage(), name: safeTrim(image?.name) || "Imagen", file: image?.file}))
        .filter((image): image is { id: ID; name: string; file: File } => image.file instanceof File);

      if (cleanedImages.length === 0) return null;
      if (cleanedImages.length === 0) return null;

      const playerId = generateId.player();

      let nextAssets = project.assets;
      let nextAssetFiles = assetFiles;
      const newImages: PlayerImage[] = [];

      for (const image of cleanedImages) {
        const ext = fileExtFromName(image.file.name);
        const filePath = buildPlayerImageFilePath(nextName, image.name, ext);

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

    /* Actualiza nombre y/o descripción del player */
    updatePlayer: (playerId, changes) =>
      set((state) => {
        if (!state.project) return state;

        const project = state.project;
        const prevPlayer = findEntityById(project.players, playerId);
        if (!prevPlayer) return state;

        const nextName = typeof changes.name === "string" ? safeTrim(changes.name) : "";
        const nameChanged = Boolean(nextName) && nextName !== prevPlayer.name;

        if (nameChanged && hasDuplicateName({ list: project.players, incomingName: nextName, ignoreId: playerId }))  return state;
        
        const nextDescription = typeof changes.description === "string" ? safeTrim(changes.description) : "";
        const prevDescription = safeTrim(prevPlayer.description);
        const descriptionChanged = typeof changes.description === "string" && nextDescription !== prevDescription;

        if (!nameChanged && !descriptionChanged) return state;

        const nextPlayer: PlayerDef = {
          ...prevPlayer,
          ...(nameChanged ? { name: nextName } : null),
          ...(descriptionChanged ? { description: nextDescription || undefined } : null),
        };

        let nextAssets = project.assets;
        let touchedAssets = false;

        if (nameChanged) {
          for (const image of prevPlayer.images) {
            const existingAsset = findAssetByIdAndKind(nextAssets, image.id, "players");
            if (!existingAsset) continue;

            const ext = fileExtFromName(safeTrim(existingAsset.file));
            const filePath = buildPlayerImageFilePath(nextPlayer.name, image.name, ext);

            const assetResult = upsertAsset(nextAssets, { id: image.id, kind: "players", name: image.name, file: filePath });

            nextAssets = assetResult.assets;
            touchedAssets = touchedAssets || assetResult.touched;
          }
        }

        return {
          ...state,
          project: {
            ...project,
            players: replaceById(project.players, playerId, nextPlayer),
            assets: touchedAssets ? nextAssets : project.assets,
          },
        };
      }),

    /* Añade una nueva imagen al player */
    addPlayerImage: (playerId, input) => {
      const { project } = get();
      if (!project) return null;

      const player = findEntityById(project.players, playerId);
      if (!player) return null;

      const nextName = safeTrim(input?.name);
      const file = input?.file;

      if (!nextName) return null;
      if (!(file instanceof File)) return null;

      const imageId = generateId.playerImage();
      const ext = fileExtFromName(file.name);
      const filePath = buildPlayerImageFilePath(player.name, nextName, ext);

      const newImage: PlayerImage = {
        id: imageId,
        name: nextName,
      };

      set((state) => {
        if (!state.project) return state;

        const prevPlayer = findEntityById(state.project.players, playerId);
        if (!prevPlayer) return state;
        if (prevPlayer.images.some((image) => image.id === imageId)) return state;

        const nextPlayer = ensureDefaultImageId({
          ...prevPlayer,
          images: [...prevPlayer.images, newImage],
        });

        const assetResult = upsertAsset(state.project.assets, { id: imageId, kind: "players", name: newImage.name, file: filePath });

        const fileResult = upsertAssetFile(state.assetFiles, imageId, file);

        return {
          ...state,
          project: {
            ...state.project,
            players: replaceById(state.project.players, playerId, nextPlayer),
            assets: assetResult.assets,
          },
          assetFiles: fileResult.assetFiles,
        };
      });

      return imageId;
    },

    /* Actualiza nombre y/o fichero de una imagen del player */
    updatePlayerImage: (playerId, imageId, patch) =>
      set((state) => {
        if (!state.project) return state;

        const project = state.project;
        const prevPlayer = findEntityById(project.players, playerId);
        if (!prevPlayer) return state;

        const prevImage = prevPlayer.images.find((image) => image.id === imageId) ?? null;
        if (!prevImage) return state;

        const nextName = typeof patch.name === "string" ? safeTrim(patch.name) : "";
        const nameChanged = Boolean(nextName) && nextName !== prevImage.name;

        const nextFile = patch.file instanceof File ? patch.file : null;
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
          const ext = fileExtFromName(safeTrim(existingAsset.file));
          const filePath = buildPlayerImageFilePath(prevPlayer.name, nextImage.name, ext);

          nextAssets = upsertAsset(nextAssets, { id: imageId, kind: "players", name: nextImage.name, file: filePath }).assets;
        }

        if (fileChanged && nextFile) {
          const ext = fileExtFromName(nextFile.name);
          const filePath = buildPlayerImageFilePath(prevPlayer.name, nextImage.name, ext);

          nextAssets = upsertAsset(nextAssets, { id: imageId, kind: "players", name: nextImage.name, file: filePath }).assets;

          nextAssetFiles = upsertAssetFile(nextAssetFiles, imageId, nextFile).assetFiles;
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

    /* Elimina una imagen del player */
    removePlayerImage: (playerId, imageId) =>
      set((state) => {
        if (!state.project) return state;

        let project = state.project;
        const prevPlayer = findEntityById(project.players, playerId);
        if (!prevPlayer) return state;

        if (!prevPlayer.images.some((image) => image.id === imageId)) return state;
        if (prevPlayer.images.length <= 1) return state;

        const nextImages = prevPlayer.images.filter((image) => image.id !== imageId);

        let nextPlayer: PlayerDef = {
          ...prevPlayer,
          images: nextImages,
        };

        if (nextPlayer.defaultImageId === imageId) nextPlayer.defaultImageId = undefined;

        nextPlayer = ensureDefaultImageId(nextPlayer);

        project = {
          ...project,
          nodes: project.nodes.map((node) => ({
            ...node,
            layers: node.layers.map((layer) => {
              const placedPlayers = layer.placedPlayers ?? [];
              if (placedPlayers.length === 0) return layer;
        
              let touchedPlacedPlayers = false;
        
              const nextPlacedPlayers = placedPlayers.map((placedPlayer) => {
                if (placedPlayer.playerId !== playerId) return placedPlayer;
                if (placedPlayer.initialImageId !== imageId) return placedPlayer;
        
                touchedPlacedPlayers = true;
        
                if (!nextPlayer.defaultImageId) {
                  const { initialImageId: _omitted, ...rest } = placedPlayer;
                  return rest as PlacedPlayer;
                }
        
                return {
                  ...placedPlayer,
                  initialImageId: nextPlayer.defaultImageId,
                };
              });
        
              if (!touchedPlacedPlayers) return layer;
        
              return {
                ...layer,
                placedPlayers: nextPlacedPlayers,
              };
            }),
          })),
        };

        project = removeEffectsInProject(project, (effect) => {
          if (effect.type !== "setPlacedPlayerImage") return false;
          return effect.playerId === playerId && effect.imageId === imageId;
        });

        const assetResult = removeAsset(project.assets, { id: imageId, kind: "players" });
        const fileResult = removeAssetFile(state.assetFiles, imageId);

        return {
          ...state,
          project: {
            ...project,
            players: replaceById(project.players, playerId, nextPlayer),
            assets: assetResult.assets,
          },
          assetFiles: fileResult.assetFiles,
        };
      }),

    /* Cambia la imagen por defecto del player */
    setDefaultPlayerImage: (playerId, imageId) =>
      set((state) => {
        if (!state.project) return state;

        const prevPlayer = findEntityById(state.project.players, playerId);
        if (!prevPlayer) return state;
        if (!prevPlayer.images.some((image) => image.id === imageId)) return state;
        if (prevPlayer.defaultImageId === imageId) return state;

        const nextPlayer: PlayerDef = {
          ...prevPlayer,
          defaultImageId: imageId,
        };

        return {
          ...state,
          project: {
            ...state.project,
            players: replaceById(state.project.players, playerId, nextPlayer),
          },
        };
      }),

    /* Añade una variable al player */
    addPlayerVar: (playerId, variable) =>
      set((state) => {
        if (!state.project) return state;

        const prevPlayer = findEntityById(state.project.players, playerId);
        if (!prevPlayer) return state;

        const prevVars = prevPlayer.vars ?? [];
        if (prevVars.some((existingVar) => existingVar.id === variable.id)) return state;

        const nextPlayer: PlayerDef = {
          ...prevPlayer,
          vars: [...prevVars, variable],
        };

        return {
          ...state,
          project: {
            ...state.project,
            players: replaceById(state.project.players, playerId, nextPlayer),
          },
        };
      }),

    /* Actualiza una variable del player */
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

        const nextPlayer: PlayerDef = {
          ...prevPlayer,
          vars: nextVars,
        };

        return {
          ...state,
          project: {
            ...state.project,
            players: replaceById(state.project.players, playerId, nextPlayer),
          },
        };
      }),

    /* Elimina una variable del player */
    removePlayerVar: (playerId, varId) =>
      set((state) => {
        if (!state.project) return state;

        let project = state.project;
        const prevPlayer = findEntityById(project.players, playerId);
        if (!prevPlayer) return state;

        const prevVars = prevPlayer.vars ?? [];
        const nextVars = prevVars.filter((variable) => variable.id !== varId);
        if (nextVars.length === prevVars.length) return state;

        const nextPlayer: PlayerDef = {
          ...prevPlayer,
          vars: nextVars,
        };

        project = {
          ...project,
          players: replaceById(project.players, playerId, nextPlayer),
        };

        project = removeConditionsInProject(project,
          (condition) => condition.type === "playerVar" &&
            condition.playerId === playerId && condition.varId === varId,
        );

        project = removeEffectsInProject(project, (effect) => effectReferencesPlayerVar(effect, { playerId, varId }));

        return { ...state, project };
      }),

    /* Elimina un player global */
    removePlayer: (playerId) =>
      set((state) => {
        if (!state.project) return state;

        const player = findEntityById(state.project.players, playerId);
        if (!player) return state;

        const dialogueIds = collectDialogueIds(state.project, (dialogue) => dialogue.playerId === playerId);

        let project = state.project;

        project = removeEffectsInProject(project, (effect) => {
          if (effectReferencesPlayer(effect, playerId)) return true;
          if (effectIsStartDialogueForAnyOf(effect, dialogueIds)) return true;
          return false;
        });

        project = removeConditionsInProject(project,
          (condition) => (condition.type === "playerVar" && condition.playerId === playerId) ||
          (condition.type === "placedPlayerVisible" && condition.playerId === playerId),
        );

        project = removePlacedPlayers(project, (placedPlayer) => placedPlayer.playerId === playerId);
        project = removeDialogues(project, (dialogue) => dialogue.playerId === playerId);

        let nextAssets = project.assets;
        let nextAssetFiles = state.assetFiles;

        for (const image of player.images) {
          nextAssets = removeAsset(nextAssets, { id: image.id, kind: "players" }).assets;
          nextAssetFiles = removeAssetFile(nextAssetFiles, image.id).assetFiles;
        }

        return {
          ...state,
          project: {
            ...project,
            players: removeById(project.players, playerId),
            assets: nextAssets,
          },
          assetFiles: nextAssetFiles,
          selectedPlayerId: nextSelectedAfterRemoval(state.selectedPlayerId, playerId),
        };
      }),

    isPlayerReferenced: (playerId: ID) => {
      const { project } = get();
      if (!project) return false;

      const playerVars = findEntityById(project.players, playerId)?.vars ?? [];
      const dialogueIds = collectDialogueIds(project, (dialogue) => dialogue.playerId === playerId);

      return isEntityReferenced(project, {
        someSceneRef: (currentProject) =>
          somePlacedPlayer(currentProject, (placedPlayer) => placedPlayer.playerId === playerId) ||
          someDialogue(currentProject, (dialogue) => dialogue.playerId === playerId),

        someWhenRef: (when) => conditionReferences.player(when, playerId) ||
          playerVars.some((variable) => conditionReferences.playerVar(when, { playerId, varId: variable.id })),

        someEffectRef: (effect) => effectReferencesPlayer(effect, playerId) || effectIsStartDialogueForAnyOf(effect, dialogueIds)});
    },
  };
}