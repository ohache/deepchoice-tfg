import { useCallback, useMemo } from "react";
import type { ID, Project, PlacedItem, PlacedNpc } from "@/domain/types";
import type { SceneTagViewModel, TagKind } from "@/features/editor/components/scene/sceneTagTypes";

type EntityKind = Extract<TagKind, "item" | "npc">;

interface UseSceneEntitiesLogicOptions {
  project: Project | null | undefined;

  placedItems?: PlacedItem[] | undefined;
  placedNpcs?: PlacedNpc[] | undefined;

  onUpdateEntities: (update: {
    placedItems?: PlacedItem[] | undefined;
    placedNpcs?: PlacedNpc[] | undefined;
  }) => void;

  onRequestPlace: (kind: EntityKind, resourceId: ID) => void;
}

export function useSceneEntitiesLogic(options: UseSceneEntitiesLogicOptions) {
  const { project, placedItems, placedNpcs, onUpdateEntities, onRequestPlace } = options;

  const safePlacedItems: PlacedItem[] = Array.isArray(placedItems) ? placedItems : [];
  const safePlacedNpcs: PlacedNpc[] = Array.isArray(placedNpcs) ? placedNpcs : [];

  const itemOptions =
    project?.items?.map((i) => ({ id: i.id as ID, label: i.name })) ?? [];
  const npcOptions =
    project?.npcs?.map((n) => ({ id: n.id as ID, label: n.name })) ?? [];

  const getOptionsForKind = (kind: EntityKind) => {
    return kind === "item" ? itemOptions : npcOptions;
  };

  const sceneEntities: SceneTagViewModel[] = useMemo(() => {
    const out: SceneTagViewModel[] = [];

    for (const pi of safePlacedItems) {
      const def = project?.items?.find((d) => d.id === pi.itemId);
      out.push({
        kind: "item",
        instanceId: pi.id,
        resourceId: pi.itemId,
        label: def?.name ?? pi.itemId,
      });
    }

    for (const pn of safePlacedNpcs) {
      const def = project?.npcs?.find((d) => d.id === pn.npcId);
      out.push({
        kind: "npc",
        instanceId: pn.id,
        resourceId: pn.npcId,
        label: def?.name ?? pn.npcId,
      });
    }

    return out;
  }, [project, safePlacedItems, safePlacedNpcs]);

  const canRequestPlaceEntity = true;

  const handleRequestPlaceEntity = useCallback(
    (kind: EntityKind, resourceId: ID) => {
      onRequestPlace(kind, resourceId);
    },
    [onRequestPlace]
  );

  const handleExistingEntityChange = (entity: SceneTagViewModel, newResourceId: ID) => {
    if (entity.kind === "item") {
      const next = safePlacedItems.map((pi) =>
        pi.id === entity.instanceId ? { ...pi, itemId: newResourceId } : pi
      );
      onUpdateEntities({ placedItems: next });
      return;
    }

    if (entity.kind === "npc") {
      const next = safePlacedNpcs.map((pn) =>
        pn.id === entity.instanceId ? { ...pn, npcId: newResourceId } : pn
      );
      onUpdateEntities({ placedNpcs: next });
      return;
    }
  };

  const handleRemoveEntity = (entity: SceneTagViewModel) => {
    if (entity.kind === "item") {
      const next = safePlacedItems.filter((pi) => pi.id !== entity.instanceId);
      onUpdateEntities({ placedItems: next });
      return;
    }

    if (entity.kind === "npc") {
      const next = safePlacedNpcs.filter((pn) => pn.id !== entity.instanceId);
      onUpdateEntities({ placedNpcs: next });
      return;
    }
  };

  return {
    sceneEntities,

    getOptionsForKind,

    canRequestPlaceEntity,
    handleRequestPlaceEntity,

    handleExistingEntityChange,
    handleRemoveEntity,
  };
}
