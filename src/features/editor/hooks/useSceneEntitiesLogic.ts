// ✅ NUEVO: useSceneEntitiesLogic.ts
// Colócalo en: src/features/editor/hooks/useSceneEntitiesLogic.ts
import { useMemo, useState } from "react";
import type React from "react";
import type { ID, Project, PlacedItem, PlacedNpc, HotspotShape } from "@/domain/types";
import type { EntityKind, SceneEntityViewModel } from "@/features/editor/components/scene/sceneEntityTypes";

export interface EntityTypeOption {
  value: EntityKind;
  label: string;
}

export interface UseSceneEntitiesLogicOptions {
  project: Project | null | undefined;

  placedItems: PlacedItem[] | undefined;
  placedNpcs: PlacedNpc[] | undefined;

  onUpdateEntities: (update: { placedItems?: PlacedItem[]; placedNpcs?: PlacedNpc[] }) => void;

  onRequestPlace: (kind: EntityKind, resourceId: ID) => void;
  onRequestEdit: (kind: EntityKind, instanceId: ID) => void;
}

const defaultRect: HotspotShape = { type: "rect", x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

function makeId(): ID {
  // browser-safe; fallback si crypto no existe (tests)
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function useSceneEntitiesLogic(options: UseSceneEntitiesLogicOptions) {
  const { project, placedItems, placedNpcs, onUpdateEntities, onRequestPlace, onRequestEdit } = options;

  const safePlacedItems = placedItems ?? [];
  const safePlacedNpcs = placedNpcs ?? [];

  const entityTypeOptions: EntityTypeOption[] = useMemo(
    () => [
      { value: "item", label: "Ítem" },
      { value: "npc", label: "PNJ" },
    ],
    []
  );

  const itemResources = useMemo(
    () => project?.items?.map((i) => ({ id: i.id as ID, label: i.name })) ?? [],
    [project]
  );

  const npcResources = useMemo(
    () => project?.npcs?.map((n) => ({ id: n.id as ID, label: n.name })) ?? [],
    [project]
  );

  const getResourcesForKind = (kind: EntityKind | "") => {
    switch (kind) {
      case "item":
        return itemResources;
      case "npc":
        return npcResources;
      default:
        return [];
    }
  };

  const entities: SceneEntityViewModel[] = useMemo(() => {
    const out: SceneEntityViewModel[] = [];

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

  const [isAdding, setIsAdding] = useState(false);
  const [newKind, setNewKind] = useState<EntityKind | "">("");
  const [newResourceId, setNewResourceId] = useState<ID | "">("");
  const [localError, setLocalError] = useState<string | null>(null);

  const resourcesForNewKind = useMemo(() => getResourcesForKind(newKind), [newKind, itemResources, npcResources]);

  const handleStartAdd = () => {
    setIsAdding(true);
    setNewKind("");
    setNewResourceId("");
    setLocalError(null);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewKind("");
    setNewResourceId("");
    setLocalError(null);
  };

  const handleNewKindChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as EntityKind | "";
    setNewKind(value);
    setNewResourceId("");
    setLocalError(null);
  };

  const handleNewResourceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ID | "";
    setNewResourceId(value);
    setLocalError(null);
  };

  const handleConfirmAdd = () => {
    if (!newKind) {
      setLocalError("Selecciona un tipo.");
      return;
    }
    if (!newResourceId) {
      setLocalError("Selecciona un recurso.");
      return;
    }

    // Añade una instancia “mínima” (con shape default) sin entrar en modo dibujar.
    if (newKind === "item") {
      const newItem: PlacedItem = {
        id: makeId(),
        itemId: newResourceId as ID,
        shape: defaultRect,
        state: { visible: true, reachable: true },
        interactions: [],
      };
      onUpdateEntities({ placedItems: [...safePlacedItems, newItem] });
      handleCancelAdd();
      return;
    }

    if (newKind === "npc") {
      const newNpc: PlacedNpc = {
        id: makeId(),
        npcId: newResourceId as ID,
        shape: defaultRect,
        interactions: [],
      };
      onUpdateEntities({ placedNpcs: [...safePlacedNpcs, newNpc] });
      handleCancelAdd();
      return;
    }
  };

  const handleExistingEntityResourceChange = (entity: SceneEntityViewModel, newResId: ID) => {
    if (entity.kind === "item") {
      const next = safePlacedItems.map((pi) => (pi.id === entity.instanceId ? { ...pi, itemId: newResId } : pi));
      onUpdateEntities({ placedItems: next });
      return;
    }
    if (entity.kind === "npc") {
      const next = safePlacedNpcs.map((pn) => (pn.id === entity.instanceId ? { ...pn, npcId: newResId } : pn));
      onUpdateEntities({ placedNpcs: next });
      return;
    }
  };

  const handleRemoveEntity = (entity: SceneEntityViewModel) => {
    if (entity.kind === "item") {
      onUpdateEntities({ placedItems: safePlacedItems.filter((pi) => pi.id !== entity.instanceId) });
      return;
    }
    if (entity.kind === "npc") {
      onUpdateEntities({ placedNpcs: safePlacedNpcs.filter((pn) => pn.id !== entity.instanceId) });
      return;
    }
  };

  const handleRequestPlace = (kind: EntityKind, resourceId: ID) => {
    // “Colocar” normalmente crea instancia y activa el modo dibujo en el store.
    onRequestPlace(kind, resourceId);
  };

  const handleRequestEdit = (kind: EntityKind, instanceId: ID) => {
    onRequestEdit(kind, instanceId);
  };

  return {
    entities,
    entityTypeOptions,
    getResourcesForKind,

    isAdding,
    newKind,
    newResourceId,
    resourcesForNewKind,
    localError,

    handleStartAdd,
    handleCancelAdd,
    handleNewKindChange,
    handleNewResourceChange,
    handleConfirmAdd,

    handleExistingEntityResourceChange,
    handleRemoveEntity,

    handleRequestPlace,
    handleRequestEdit,
  };
}
