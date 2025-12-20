import { useMemo, useState } from "react";
import type React from "react";
import type { ID, Project } from "@/domain/types";
import type { SceneTagViewModel } from "@/features/editor/components/scene/sceneTagTypes";

type SceneTagKind = "music" | "map";

export interface TagTypeOption {
  value: SceneTagKind;
  label: string;
}

interface UseSceneTagsLogicOptions {
  project: Project | null | undefined;

  musicId?: ID;
  mapId?: ID;

  onUpdateTags: (update: {
    musicId?: ID | undefined;
    mapId?: ID | undefined;
  }) => void;
}

export function useSceneTagsLogic(options: UseSceneTagsLogicOptions) {
  const { project, musicId, mapId, onUpdateTags } = options;

  const tagTypeOptions: TagTypeOption[] = useMemo(
    () => [
      { value: "music", label: "Música" },
      { value: "map", label: "Mapa" },
    ],
    []
  );

  const musicTagItems =
    project?.musicTracks?.map((m) => ({ id: m.id as ID, label: m.name })) ?? [];
  const mapTagItems =
    project?.maps?.map((m) => ({ id: m.id as ID, label: m.name })) ?? [];

  const getItemsForTagType = (type: SceneTagKind | "") => {
    switch (type) {
      case "music":
        return musicTagItems;
      case "map":
        return mapTagItems;
      default:
        return [];
    }
  };

  const sceneTags: SceneTagViewModel[] = useMemo(() => {
    const tags: SceneTagViewModel[] = [];

    if (musicId) {
      const track = project?.musicTracks?.find((m) => m.id === musicId);
      tags.push({
        kind: "music",
        resourceId: musicId,
        label: track?.name ?? musicId,
      });
    }

    if (mapId) {
      const map = project?.maps?.find((m) => m.id === mapId);
      tags.push({
        kind: "map",
        resourceId: mapId,
        label: map?.name ?? mapId,
      });
    }

    return tags;
  }, [project, musicId, mapId]);

  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagType, setNewTagType] = useState<SceneTagKind | "">("");
  const [newTagId, setNewTagId] = useState<ID | "">("");
  const [tagLocalError, setTagLocalError] = useState<string | null>(null);

  const itemsForNewTagType = useMemo(
    () => getItemsForTagType(newTagType),
    [newTagType, musicTagItems, mapTagItems]
  );

  const handleStartAddTag = () => {
    setIsAddingTag(true);
    setNewTagType("");
    setNewTagId("");
    setTagLocalError(null);
  };

  const handleCancelAddTag = () => {
    setIsAddingTag(false);
    setNewTagType("");
    setNewTagId("");
    setTagLocalError(null);
  };

  const handleNewTagTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as SceneTagKind | "";
    setNewTagType(value);
    setNewTagId("");
    setTagLocalError(null);
  };

  const handleNewTagValueChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ID | "";
    setNewTagId(value);
    setTagLocalError(null);
  };

  const handleConfirmAddTag = () => {
    if (!newTagType) {
      setTagLocalError("Selecciona un tipo de etiqueta.");
      return;
    }
    if (!newTagId) {
      setTagLocalError("Selecciona un recurso para la etiqueta.");
      return;
    }

    if (newTagType === "music") {
      onUpdateTags({ musicId: newTagId });
      handleCancelAddTag();
      return;
    }

    if (newTagType === "map") {
      onUpdateTags({ mapId: newTagId });
      handleCancelAddTag();
      return;
    }
  };

  const handleExistingTagChange = (tag: SceneTagViewModel, newResourceId: ID) => {
    if (tag.kind === "music") {
      onUpdateTags({ musicId: newResourceId });
      return;
    }
    if (tag.kind === "map") {
      onUpdateTags({ mapId: newResourceId });
      return;
    }
  };

  const handleRemoveTag = (tag: SceneTagViewModel) => {
    if (tag.kind === "music") {
      onUpdateTags({ musicId: undefined });
      return;
    }
    if (tag.kind === "map") {
      onUpdateTags({ mapId: undefined });
      return;
    }
  };

  return {
    sceneTags,
    tagTypeOptions,
    getItemsForTagType,

    isAddingTag,
    newTagType,
    newTagId,
    tagLocalError,
    itemsForNewTagType,

    handleStartAddTag,
    handleCancelAddTag,
    handleNewTagTypeChange,
    handleNewTagValueChange,
    handleConfirmAddTag,
    handleExistingTagChange,
    handleRemoveTag,
  };
}
