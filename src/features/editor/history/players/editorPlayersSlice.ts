import type { ID, PlayerDef, PlayerImage, Project, SceneImageLayer, VarDef, Node as StoryNode, PlacedPlayer } from "@/domain/types";
import { conditionReferencesPlayer, conditionReferencesPlayerVar } from "@/domain/conditionRefs";
import { effectReferencesPlayer, effectReferencesPlayerVar } from "@/domain/effectRefs";
import { generateId } from "@/utils/id";
import {
  safeTrim, upsertAsset, upsertAssetFile, removeAsset, removeAssetFile, removeEffectsInProject, ensureDefaultImageId, sameVarDef,
  fileExtFromName, buildPlayerImageFilePath, fileExtFromAssetPath
} from "@/features/editor/core/editorGenericSlice";
import { isEntityReferenced, mapAllWhensInProject, mapCondition, removePlacedPlayers, removeDialogues } from "@/features/editor/core/editorProjectWalkers";
import { hasDuplicateName } from "@/validation/genericValidator";

/* Contrato mínimo del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedPlayerId: ID | null;
};

export interface EditorPlayerSlice {
  selectedPlayerId: ID | null;
  setSelectedPlayerId: (id: ID | null) => void;
  addPlayer: (input: { name: string; description?: string; vars?: VarDef[]; images: Array<{ name: string; file: File }>; }) => ID | null;
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

function removePlayerVarFromConditionsInProject(project: Project, playerId: ID, varId: ID): Project {
  return mapAllWhensInProject(project, (when) =>
    mapCondition(when, (c) => {
      if (c.type === "playerVar" && c.playerId === playerId && c.varId === varId) return undefined;
      return c;
    })
  );
}

function removePlayerFromConditionsInProject(project: Project, playerId: ID): Project {
  return mapAllWhensInProject(project, (when) =>
    mapCondition(when, (c) => {
      if (c.type === "playerVar" && c.playerId === playerId) return undefined;
      if (c.type === "placedPlayerVisible" && c.playerId === playerId) return undefined;
      return c;
    })
  );
}

export function createEditorPlayerSlice(set: (partial: Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorPlayerSlice {
  return {
    selectedPlayerId: null,

    setSelectedPlayerId: (id) => set({ selectedPlayerId: id }),

    addPlayer: (input) => {
      const { project, assetFiles } = get();
      if (!project) return null;

      const safeName = safeTrim(input?.name);
      const safeDesc = safeTrim(input?.description);

      if (!safeName) return null;

      const currentPlayers = project.players ?? [];
      if (hasDuplicateName({ list: currentPlayers, incomingName: safeName })) return null;

      const imagesIn = Array.isArray(input?.images) ? input.images : [];
      if (imagesIn.length === 0) return null;

      const cleaned = imagesIn.map((im) => ({
        id: generateId.playerImage(),
        name: safeTrim(im?.name) || "Imagen",
        file: im?.file,
      })).filter((im) => im.file instanceof File);

      if (cleaned.length === 0) return null;

      const playerId = generateId.player();

      let nextAssets = project.assets ?? [];
      let nextAssetFiles = assetFiles;

      const newImages: PlayerImage[] = [];

      for (const im of cleaned) {
        const imageId = im.id;
        const ext = fileExtFromName(im.file.name);
        const filePath = buildPlayerImageFilePath(safeName, im.name, ext);

        newImages.push({ id: imageId, name: im.name });

        const resA = upsertAsset(nextAssets, {
          id: imageId,
          kind: "players",
          name: im.name,
          file: filePath,
        });
        nextAssets = resA.assets;

        const resF = upsertAssetFile(nextAssetFiles, imageId, im.file);
        nextAssetFiles = resF.assetFiles;
      }

      const newPlayer: PlayerDef = {
        id: playerId,
        name: safeName,
        ...(safeDesc ? { description: safeDesc } : null),
        images: newImages,
        defaultImageId: newImages[0]!.id,
        vars: input.vars ?? [],
      };

      set({
        project: { ...project, players: [...currentPlayers, newPlayer], assets: nextAssets },
        assetFiles: nextAssetFiles,
        selectedPlayerId: playerId,
      });

      return playerId;
    },

    updatePlayer: (playerId, changes) =>
      set((state) => {
        if (!state.project) return state;
        const project = state.project;

        const players0 = project.players ?? [];
        const prev = players0.find((p) => p.id === playerId);
        if (!prev) return state;

        const nextNameRaw = typeof changes.name === "string" ? changes.name.trim() : "";
        const nameChanged = Boolean(nextNameRaw) && nextNameRaw !== prev.name;

        if (nameChanged) {
          if (hasDuplicateName({ list: players0, incomingName: nextNameRaw, ignoreId: playerId })) return state;
        }

        const nextDescRaw = typeof changes.description === "string" ? changes.description.trim() : "";
        const prevDescRaw = String(prev.description ?? "").trim();
        const descChanged = typeof changes.description === "string" && nextDescRaw !== prevDescRaw;

        if (!nameChanged && !descChanged) return state;

        const nextPlayer: PlayerDef = {
          ...prev,
          ...(nameChanged ? { name: nextNameRaw } : null),
          ...(descChanged ? { description: nextDescRaw || undefined } : null),
        };

        let nextAssets = project.assets ?? [];
        let touchedAssets = false;

        if (nameChanged) {
          for (const img of prev.images) {
            const assetId = img.id;
            const existing = nextAssets.find((a) => a.id === assetId && a.kind === "players") ?? null;
            if (!existing) continue;

            const ext = fileExtFromAssetPath(String(existing.file ?? ""));
            const newPath = buildPlayerImageFilePath(nextPlayer.name, img.name, ext);

            const resA = upsertAsset(nextAssets, {
              id: assetId,
              kind: "players",
              name: img.name,
              file: newPath,
            });

            nextAssets = resA.assets;
            touchedAssets = touchedAssets || resA.touched;
          }
        }

        return {
          ...state,
          project: { ...project, players: players0.map((p) => (p.id === playerId ? nextPlayer : p)), assets: touchedAssets ? nextAssets : project.assets },
        };
      }),

    addPlayerImage: (playerId, input) => {
      const { project } = get();
      if (!project) return null;

      const player = (project.players ?? []).find((p) => p.id === playerId);
      if (!player) return null;

      const name = safeTrim(input?.name);
      if (!name) return null;

      const file = input?.file;
      if (!(file instanceof File)) return null;

      const imageId = generateId.playerImage();
      const ext = fileExtFromName(file.name);
      const filePath = buildPlayerImageFilePath(player.name, name, ext);

      const newImage: PlayerImage = { id: imageId, name };

      set((state) => {
        if (!state.project) return state;

        const p = state.project;
        const players0 = p.players ?? [];
        const idx = players0.findIndex((x) => x.id === playerId);
        if (idx < 0) return state;

        const prevPlayer = players0[idx]!;
        if (prevPlayer.images.some((x) => x.id === imageId)) return state;

        const nextPlayer = ensureDefaultImageId({
          ...prevPlayer,
          images: [...prevPlayer.images, newImage],
        });

        const nextPlayers = players0.map((x) => (x.id === playerId ? nextPlayer : x));

        const assets0 = p.assets ?? [];
        const resA = upsertAsset(assets0, {
          id: imageId,
          kind: "players",
          name: nextPlayer.name,
          file: filePath,
        });

        const resF = upsertAssetFile(state.assetFiles, imageId, file);

        return {
          ...state,
          project: { ...p, players: nextPlayers, assets: resA.assets },
          assetFiles: resF.assetFiles,
        };
      });

      return imageId;
    },

    updatePlayerImage: (playerId, imageId, patch) =>
      set((state) => {
        if (!state.project) return state;
        const p = state.project;

        const players0 = p.players ?? [];
        const pIdx = players0.findIndex((x) => x.id === playerId);
        if (pIdx < 0) return state;

        const prevPlayer = players0[pIdx]!;
        const images0 = prevPlayer.images;
        const iIdx = images0.findIndex((img) => img.id === imageId);
        if (iIdx < 0) return state;

        const prevImg = images0[iIdx]!;
        const nextNameRaw = typeof patch.name === "string" ? patch.name.trim() : "";
        const nameChanged = Boolean(nextNameRaw) && nextNameRaw !== prevImg.name;

        const nextFile = patch.file instanceof File ? patch.file : null;
        const fileChanged = Boolean(nextFile);

        if (!nameChanged && !fileChanged) return state;

        const nextImg: PlayerImage = {
          ...prevImg,
          ...(nameChanged ? { name: nextNameRaw } : null),
        };

        const nextImages = images0.slice();
        nextImages[iIdx] = nextImg;

        const nextPlayer: PlayerDef = {
          ...prevPlayer,
          images: nextImages,
        };

        let nextAssets = p.assets ?? [];
        let nextAssetFiles = state.assetFiles;

        const assetId = imageId;
        const existingAsset = nextAssets.find((a) => a.id === assetId && a.kind === "players") ?? null;

        if (nameChanged && existingAsset) {
          const ext = fileExtFromAssetPath(String(existingAsset.file ?? ""));
          const newPath = buildPlayerImageFilePath(prevPlayer.name, nextImg.name, ext);

          nextAssets = upsertAsset(nextAssets, {
            id: assetId,
            kind: "players",
            name: nextImg.name,
            file: newPath,
          }).assets;
        }

        if (fileChanged && nextFile) {
          const ext = fileExtFromName(nextFile.name);
          const newPath = buildPlayerImageFilePath(prevPlayer.name, nextImg.name, ext);

          nextAssets = upsertAsset(nextAssets, {
            id: assetId,
            kind: "players",
            name: nextImg.name,
            file: newPath,
          }).assets;

          nextAssetFiles = upsertAssetFile(nextAssetFiles, assetId, nextFile).assetFiles;
        }

        return {
          ...state,
          project: { ...p, players: players0.map((x) => (x.id === playerId ? nextPlayer : x)), assets: nextAssets },
          assetFiles: nextAssetFiles,
        };
      }),

    removePlayerImage: (playerId, imageId) =>
      set((state) => {
        if (!state.project) return state;

        let project: Project = state.project;

        const players0 = project.players ?? [];
        const pIdx = players0.findIndex((x) => x.id === playerId);
        if (pIdx < 0) return state;

        const prevPlayer = players0[pIdx]!;
        const images0 = prevPlayer.images;

        if (!images0.some((x) => x.id === imageId)) return state;

        // no borrar última imagen (tu schema exige >= 1)
        if (images0.length <= 1) return state;

        const nextImages = images0.filter((x) => x.id !== imageId);

        let nextPlayer: PlayerDef = { ...prevPlayer, images: nextImages };
        if (nextPlayer.defaultImageId === imageId) nextPlayer.defaultImageId = undefined;
        nextPlayer = ensureDefaultImageId(nextPlayer);

        {
          const nodes0: StoryNode[] = project.nodes ?? [];
          let touchedNodes = false;

          const nextNodes = nodes0.map((node) => {
            const layers0: SceneImageLayer[] = node.layers ?? [];
            if (layers0.length === 0) return node;

            let touchedLayers = false;

            const nextLayers = layers0.map((layer) => {
              const placed0: PlacedPlayer[] = layer.placedPlayers ?? [];
              if (placed0.length === 0) return layer;

              let touchedPlaced = false;

              const placed1 = placed0.map((pp) => {
                if (pp.playerId !== playerId) return pp;
                if (pp.initialImageId !== imageId) return pp;

                const fallback = nextPlayer.defaultImageId;

                // si no hay fallback, quitamos initialImageId
                if (!fallback) {
                  const { initialImageId: _omit, ...rest } = pp;
                  touchedPlaced = true;
                  return rest as PlacedPlayer;
                }

                touchedPlaced = true;
                return { ...pp, initialImageId: fallback };
              });

              if (!touchedPlaced) return layer;

              touchedLayers = true;
              return { ...layer, placedPlayers: placed1 };
            });

            if (!touchedLayers) return node;

            touchedNodes = true;
            return { ...node, layers: nextLayers };
          });

          if (touchedNodes) project = { ...project, nodes: nextNodes };
        }

        project = removeEffectsInProject(project, (e) => {
          if (e.type !== "setPlacedPlayerImage") return false;
          return e.playerId === playerId && e.imageId === imageId;
        });

        const assetId: ID = imageId;
        const remA = removeAsset(project.assets ?? [], { id: assetId, kind: "players" });
        const remF = removeAssetFile(state.assetFiles, assetId);

        const nextPlayers = players0.map((x) => (x.id === playerId ? nextPlayer : x));

        return {
          ...state,
          project: { ...project, players: nextPlayers, assets: remA.assets },
          assetFiles: remF.assetFiles,
        };
      }),

    setDefaultPlayerImage: (playerId, imageId) =>
      set((state) => {
        const project = state.project;
        if (!project) return state;

        const players0 = project.players ?? [];
        const idx = players0.findIndex((x) => x.id === playerId);
        if (idx < 0) return state;

        const prevPlayer = players0[idx]!;
        if (!prevPlayer.images.some((img) => img.id === imageId)) return state;
        if (prevPlayer.defaultImageId === imageId) return state;

        const nextPlayer = { ...prevPlayer, defaultImageId: imageId };
        const nextPlayers = players0.map((x) => (x.id === playerId ? nextPlayer : x));

        return { ...state, project: { ...project, players: nextPlayers } };
      }),

    addPlayerVar: (playerId, variable) =>
      set((state) => {
        if (!state.project) return state;
        const project = state.project;

        const players0 = project.players ?? [];
        const idx = players0.findIndex((pl) => pl.id === playerId);
        if (idx < 0) return state;

        const prevPlayer = players0[idx]!;
        const vars0 = prevPlayer.vars ?? [];

        if (vars0.some((v) => v.id === variable.id)) return state;

        const nextPlayer: PlayerDef = { ...prevPlayer, vars: [...vars0, variable] };
        const nextPlayers = players0.map((pl) => (pl.id === playerId ? nextPlayer : pl));

        return { ...state, project: { ...project, players: nextPlayers } };
      }),

    updatePlayerVar: (playerId, variable) =>
      set((state) => {
        if (!state.project) return state;
        const project = state.project;

        const players0 = project.players ?? [];
        const idx = players0.findIndex((pl) => pl.id === playerId);
        if (idx < 0) return state;

        const prevPlayer = players0[idx]!;
        const vars0 = prevPlayer.vars ?? [];
        const vIdx = vars0.findIndex((v) => v.id === variable.id);
        if (vIdx < 0) return state;

        const prevVar = vars0[vIdx]!;
        if (sameVarDef(prevVar, variable)) return state;

        const nextVars = vars0.slice();
        nextVars[vIdx] = variable;

        const nextPlayer: PlayerDef = { ...prevPlayer, vars: nextVars };
        const nextPlayers = players0.map((pl) => (pl.id === playerId ? nextPlayer : pl));

        return { ...state, project: { ...project, players: nextPlayers } };
      }),

    removePlayerVar: (playerId, varId) =>
      set((state) => {
        if (!state.project) return state;
        let project = state.project;

        const players0 = project.players ?? [];
        const idx = players0.findIndex((pl) => pl.id === playerId);
        if (idx < 0) return state;

        const prevPlayer = players0[idx]!;
        const vars0 = prevPlayer.vars ?? [];
        const nextVars = vars0.filter((v) => v.id !== varId);
        if (nextVars.length === vars0.length) return state;

        const nextPlayer: PlayerDef = { ...prevPlayer, vars: nextVars };
        const nextPlayers = players0.map((pl) => (pl.id === playerId ? nextPlayer : pl));
        project = { ...project, players: nextPlayers };

        project = removePlayerVarFromConditionsInProject(project, playerId, varId);

        project = removeEffectsInProject(project, (e) => effectReferencesPlayerVar(e, { playerId, varId }));

        return { ...state, project };
      }),

    removePlayer: (playerId) =>
      set((state) => {
        if (!state.project) return state;
        const project0 = state.project;

        const player = (project0.players ?? []).find((x) => x.id === playerId);
        if (!player) return state;

        let project = project0;

        // effects: todo lo que referencia playerId (incluye vars/memoria/relaciones/placed player)
        project = removeEffectsInProject(project, (e) => effectReferencesPlayer(e, playerId));

        // conditions: players / playerMemory / relations
        project = removePlayerFromConditionsInProject(project, playerId);

        // escenas: placedPlayers (modelo nuevo: layers[].placedPlayers)
        project = removePlacedPlayers(project, (pp) => pp.playerId === playerId);

        // diálogos
        project = removeDialogues(project, (d) => d.playerId === playerId);

        // catálogo
        const remainingPlayers = (project.players ?? []).filter((x) => x.id !== playerId);

        // assets + assetFiles de TODAS sus imágenes (id imagen = id asset)
        let nextAssets = project.assets ?? [];
        let nextAssetFiles = state.assetFiles;

        for (const img of player.images) {
          const assetId = img.id;
          nextAssets = removeAsset(nextAssets, { id: assetId, kind: "players" }).assets;
          nextAssetFiles = removeAssetFile(nextAssetFiles, assetId).assetFiles;
        }

        // selección
        const nextSelected = state.selectedPlayerId === playerId ? null : state.selectedPlayerId;

        return {
          ...state,
          project: { ...project, players: remainingPlayers, assets: nextAssets },
          assetFiles: nextAssetFiles,
          selectedPlayerId: nextSelected,
        };
      }),

    isPlayerReferenced: (playerId: ID) => {
      const { project } = get();
      if (!project) return false;

      return isEntityReferenced(project, {
        someSceneRef: (p) =>
          (p.nodes ?? []).some((n) =>
            (n.layers ?? []).some((layer) => (layer.placedPlayers ?? []).some((pp) => pp.playerId === playerId))
          ) ||
          (p.nodes ?? []).some((n) => (n.dialogues ?? []).some((d) => d.playerId === playerId)),

        someWhenRef: (when) => conditionReferencesPlayer(when, playerId) ||
          (project.players ?? []).find((p) => p.id === playerId)?.vars?.some((v) => conditionReferencesPlayerVar(when, { playerId, varId: v.id })) === true,

        someEffectRef: (e) => effectReferencesPlayer(e, playerId),
      });
    },
  };
}
