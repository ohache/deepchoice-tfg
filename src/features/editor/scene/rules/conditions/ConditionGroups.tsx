import { useEffect, useMemo, useRef, useState } from "react";
import type { Project, ID } from "@/domain/types";
import { generateId } from "@/utils/id";
import { conditionSchema } from "@/validation/rulesSchemas";
import { createProjectIndex } from "@/features/editor/scene/rules/conditions/conditionProjectIndex";
import { createDefaultLeaf, createSiblingLeafPreservingSelection, getConditionFamilies, leafFamily, leafLabel, summarize, type ConditionFamilyId,
  type EnabledLeafType, type EnabledLeafCondition } from "@/features/editor/scene/rules/conditions/conditionLeafRegistry";
import { ensureAtLeastOneGroup, makeAtom, moveAtomBetweenGroups, pruneEmptyGroups, uiDraftToCondition,
  type UiDraft, type UiGroup } from "@/features/editor/scene/rules/conditions/conditionDraftMapper";
import { ConditionLeafEditor } from "@/features/editor/scene/rules/conditions/ConditionLeafEditor";
import { Select, type Option } from "@/components/Select";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "@/shared/toast/toastStore";

type Props = {
  project: Project | null;
  currentNodeId?: ID;
  value: UiDraft;
  onChange: (next: UiDraft) => void;
  onBusyChange?: (busy: boolean) => void;
};

type EditRef = { groupId: ID; atomId: ID };
type DragRef = { fromGroupId: ID; fromIndex: number };

/* Helpers */
function reorder<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  if (!next.length) return next;

  const from = Math.max(0, Math.min(next.length - 1, fromIndex));
  const to = Math.max(0, Math.min(next.length - 1, toIndex));
  if (from === to) return next;

  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);

  return next;
}

function groupLabel(index: number): string {
  return `Grupo ${index + 1}`;
}

/* Snapshot mínimo para detectar cambios reales en el composer cuando se está editando una condición existente */
function buildComposerSnapshot(args: {
  family: ConditionFamilyId | "";
  cond: EnabledLeafCondition | null;
  not: boolean;
  groupId: ID | "new" | "";
}): string {
  const { family, cond, not, groupId } = args;
  if (!family || !cond) return "";
  return JSON.stringify({ family, cond, not, groupId: groupId || "" });
}

/* Valida una condición leaf aislada montando un draft temporal mínimo */
function validateComposerCondition(cond: EnabledLeafCondition, not: boolean): boolean {
  const tmpGroupId: ID = "tmp";

  const tmpDraft: UiDraft = {
    groups: [{ id: tmpGroupId, atoms: [makeAtom(cond, not)] }],
    lastGroupId: tmpGroupId,
  };

  const parsed = conditionSchema.safeParse(uiDraftToCondition(pruneEmptyGroups(tmpDraft)));

  return parsed.success;
}

/* Crea las opciones del selector de grupos */
function buildGroupSelectOptions(groups: UiGroup[]): Option<string>[] {
  const existing = groups.map((group, index) => ({
    id: group.id,
    label: groupLabel(index),
  }));

  return [...existing, { id: "new", label: "Crear grupo nuevo" }];
}

/* Resuelve a qué grupo debería añadirse una nueva condición si el usuario no ha elegido ninguno explícitamente */
function resolveDefaultGroupId(draft: UiDraft): ID {
  const groups = draft.groups ?? [];
  if (!groups.length) return generateId.conditionGroup();

  const lastGroupId = draft.lastGroupId;
  if (lastGroupId && groups.some((group) => group.id === lastGroupId)) return lastGroupId;

  return groups[groups.length - 1].id;
}

export function ConditionGroups({ project, currentNodeId, value, onChange, onBusyChange }: Props) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerFamily, setComposerFamily] = useState<ConditionFamilyId | "">("");
  const [composerCond, setComposerCond] = useState<EnabledLeafCondition | null>(null);
  const [composerNot, setComposerNot] = useState(false);
  const [targetGroup, setTargetGroup] = useState<ID | "new" | "">("");
  const [initialSnapshot, setInitialSnapshot] = useState("");

  const [collapsedGroups, setCollapsedGroups] = useState<Record<ID, boolean>>({});
  const [editRef, setEditRef] = useState<EditRef | null>(null);

  const dragRef = useRef<DragRef | null>(null);

  const isEditing = editRef != null;
  const groups = value.groups ?? [];

  const idx = useMemo(() => createProjectIndex(project), [project]);
  const ctx = useMemo(() => ({ idx, currentNodeId }), [idx, currentNodeId]);

  const availableFamilies = useMemo(() => getConditionFamilies(ctx), [ctx]);

  const familyOptions = useMemo<Option<ConditionFamilyId>[]>(() => availableFamilies.map((family) => ({ id: family.id, label: family.label })), [availableFamilies]);

  const hasAnyCondition = useMemo(() => groups.some((group) => (group.atoms?.length ?? 0) > 0), [groups]);

  const currentSnapshot = useMemo(() =>
      buildComposerSnapshot({
        family: composerFamily,
        cond: composerCond,
        not: composerNot,
        groupId: targetGroup,
      }), [composerFamily, composerCond, composerNot, targetGroup]
  );

  const composerValidation = useMemo(() => {
    if (!composerFamily || !composerCond) return { ok: false };
    return { ok: validateComposerCondition(composerCond, composerNot) };
  }, [composerFamily, composerCond, composerNot]);

  const canSave = useMemo(() => {
    if (!composerValidation.ok) return false;
    if (!isEditing) return true;
    return currentSnapshot !== initialSnapshot;
  }, [composerValidation.ok, isEditing, currentSnapshot, initialSnapshot]);

  const groupSelectOptions = useMemo(() => buildGroupSelectOptions(groups), [groups]);

  const familyLeafTypeOptions = useMemo<Option<EnabledLeafType>[]>(() => {
    if (!composerFamily) return [];
    const family = availableFamilies.find((item) => item.id === composerFamily);

    return (family?.leafTypes ?? []).map((type) => ({
      id: type,
      label: leafLabel(type),
    }));
  }, [availableFamilies, composerFamily]);

  useEffect(() => { onBusyChange?.(composerOpen || isEditing);}, [composerOpen, isEditing, onBusyChange]);

  const isGroupCollapsed = (groupId: ID) => Boolean(collapsedGroups[groupId]);

  const toggleGroupCollapsed = (groupId: ID) => { setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))};

  const resetComposerState = () => {
    setComposerFamily("");
    setComposerCond(null);
    setComposerNot(false);
    setTargetGroup("");
    setEditRef(null);
    setInitialSnapshot("");
  };

  const closeComposer = () => {
    setComposerOpen(false);
    resetComposerState();
  };

  const openComposer = () => {
    resetComposerState();
    setComposerOpen(true);
  };

  const openComposerForEdit = (groupId: ID, atomId: ID) => {
    const group = groups.find((item) => item.id === groupId);
    const atom = group?.atoms?.find((item) => item.id === atomId);
    if (!atom) return;

    const family = leafFamily(atom.cond.type);

    const snapshot = buildComposerSnapshot({
      family,
      cond: atom.cond,
      not: Boolean(atom.not),
      groupId,
    });

    setEditRef({ groupId, atomId });
    setComposerOpen(true);
    setComposerFamily(family);
    setComposerCond(atom.cond);
    setComposerNot(Boolean(atom.not));
    setTargetGroup(groupId);
    setInitialSnapshot(snapshot);
  };

  const handleChangeFamily = (family: ConditionFamilyId | "") => {
    setComposerFamily(family);

    if (!family) {
      setComposerCond(null);
      return;
    }

    if (family === "progress") {
      setComposerCond(null);
      return;
    }

    const familySpec = availableFamilies.find((item) => item.id === family);
    const firstType = familySpec?.leafTypes[0];

    setComposerCond(firstType ? createDefaultLeaf(firstType) : null);
  };

  const handleChangeLeafType = (type: EnabledLeafType) => {
    setComposerCond((prev) => {
      if (!prev) return createDefaultLeaf(type);
      return createSiblingLeafPreservingSelection(ctx, prev, type);
    });
  };


  const saveEditedAtomToNewGroup = (draft: UiDraft, fromGroupId: ID, atomId: ID, cond: EnabledLeafCondition, not: boolean) => {
    const fromGroup = draft.groups.find((group) => group.id === fromGroupId);
    const atom = fromGroup?.atoms?.find((item) => item.id === atomId);
    if (!atom) return;

    const newGroupId = generateId.conditionGroup();
    const newAtom = { ...atom, not, cond };

    const nextGroups = draft.groups.map((group) =>
        group.id === fromGroupId
          ? { ...group, atoms: group.atoms.filter((item) => item.id !== atomId) }
          : group
      ).concat([{ id: newGroupId, atoms: [newAtom] }]);

    const pruned = pruneEmptyGroups({ ...draft, groups: nextGroups });

    onChange({
      ...pruned,
      lastGroupId: newGroupId,
    });

    toast.success("Condición guardada", "Actualizada y movida a un grupo nuevo.");
    closeComposer();
  };

  const saveEditedAtomToExistingGroup = (draft: UiDraft, fromGroupId: ID, toGroupId: ID, atomId: ID, cond: EnabledLeafCondition, not: boolean) => {
    const fromGroup = draft.groups.find((group) => group.id === fromGroupId);
    const atom = fromGroup?.atoms?.find((item) => item.id === atomId);
    if (!atom) return;

    const nextGroups = draft.groups.map((group) => {
      if (group.id === fromGroupId && fromGroupId !== toGroupId) {
        return {
          ...group,
          atoms: group.atoms.filter((item) => item.id !== atomId),
        };
      }

      if (group.id === fromGroupId && fromGroupId === toGroupId) {
        return {
          ...group,
          atoms: group.atoms.map((item) =>
            item.id === atomId ? { ...item, not, cond } : item
          ),
        };
      }

      if (group.id === toGroupId) {
        const withoutOriginal = group.atoms.filter((item) => item.id !== atomId);
        const updatedAtom = { ...atom, not, cond };

        return {
          ...group,
          atoms: [...withoutOriginal, updatedAtom],
        };
      }

      return group;
    });

    const pruned = pruneEmptyGroups({ ...draft, groups: nextGroups });

    onChange({
      ...pruned,
      lastGroupId: toGroupId,
    });

    toast.success("Condición guardada", "Actualizada correctamente.");
    closeComposer();
  };

  const createAtomInNewGroup = (draft: UiDraft, atom: ReturnType<typeof makeAtom>) => {
    const newGroup: UiGroup = {
      id: generateId.conditionGroup(),
      atoms: [atom],
    };

    onChange({
      ...draft,
      groups: [...draft.groups, newGroup],
      lastGroupId: newGroup.id,
    });

    toast.success("Condición creada", "Añadida como nuevo grupo.");
    closeComposer();
  };

  const createAtomInExistingGroup = (draft: UiDraft, atom: ReturnType<typeof makeAtom>, targetId: ID) => {
    const nextGroups = draft.groups.map((group) =>
      group.id === targetId
        ? { ...group, atoms: [...group.atoms, atom] }
        : group
    );

    onChange({
      ...draft,
      groups: nextGroups,
      lastGroupId: targetId,
    });

    toast.success("Condición creada", "Añadida al grupo seleccionado.");
    closeComposer();
  };

  const saveFromComposer = () => {
    if (!composerCond || !composerFamily) {
      toast.error("Falta tipo", "Selecciona el tipo de condición.");
      return;
    }

    if (!composerValidation.ok) {
      toast.error("Condición incompleta", "Completa los campos obligatorios antes de guardar.");
      return;
    }

    const draft = ensureAtLeastOneGroup(value);

    if (editRef) {
      const { groupId: fromGroupId, atomId } = editRef;

      if (targetGroup === "new") {
        saveEditedAtomToNewGroup(draft, fromGroupId, atomId, composerCond, composerNot);
        return;
      }

      const toGroupId = targetGroup && targetGroup !== "new" ? targetGroup : fromGroupId;

      saveEditedAtomToExistingGroup(draft, fromGroupId, toGroupId, atomId, composerCond, composerNot);
      return;
    }

    const atom = makeAtom(composerCond, composerNot);

    if (targetGroup === "new") {
      createAtomInNewGroup(draft, atom);
      return;
    }

    const targetId = targetGroup ? (targetGroup as ID) : resolveDefaultGroupId(draft);
    createAtomInExistingGroup(draft, atom, targetId);
  };

  const deleteAtom = (groupId: ID, atomId: ID) => {
    const nextGroups = groups.map((group) =>
      group.id === groupId
        ? { ...group, atoms: group.atoms.filter((atom) => atom.id !== atomId) }
        : group
    );

    const pruned = pruneEmptyGroups({ ...value, groups: nextGroups });
    onChange(ensureAtLeastOneGroup(pruned));

    toast.success("Condición eliminada", "Se ha eliminado correctamente.");
  };

  /*  Drag & drop */
  const reorderInGroup = (groupId: ID, from: number, to: number) => {
    const nextGroups = groups.map((group) =>
      group.id === groupId
        ? { ...group, atoms: reorder(group.atoms, from, to) }
        : group
    );

    onChange({
      ...value,
      groups: nextGroups,
      lastGroupId: groupId,
    });
  };

  const consumeDraggedAtom = (): DragRef | null => {
    const drag = dragRef.current;
    dragRef.current = null;
    return drag;
  };

  const onDragStartAtom = (groupId: ID, index: number) => {
    dragRef.current = { fromGroupId: groupId, fromIndex: index };
  };

  const onDropOnAtom = (toGroupId: ID, toIndex: number) => {
    const drag = consumeDraggedAtom();
    if (!drag) return;

    if (drag.fromGroupId === toGroupId) {
      reorderInGroup(toGroupId, drag.fromIndex, toIndex);
      return;
    }

    onChange(moveAtomBetweenGroups({ draft: value, fromGroupId: drag.fromGroupId, fromIndex: drag.fromIndex, toGroupId, toIndex }));
  };

  const onDropOnGroupEnd = (toGroupId: ID) => {
    const drag = consumeDraggedAtom();
    if (!drag) return;

    if (drag.fromGroupId === toGroupId) {
      const length = groups.find((group) => group.id === toGroupId)?.atoms.length ?? 0;
      reorderInGroup(toGroupId, drag.fromIndex, length);
      return;
    }

    onChange(moveAtomBetweenGroups({ draft: value, fromGroupId: drag.fromGroupId, fromIndex: drag.fromIndex, toGroupId, toIndex: null}));
  };

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b-2 border-slate-800 py-2 flex justify-center">
        {!composerOpen && (
          <button type="button" className="btn btn-add-condition" onClick={openComposer}>
            + Añadir condición
          </button>
        )}
      </div>

      <div className="bg-slate-950/35 p-3 space-y-3">
        {composerOpen ? (
          <div className="h-full overflow-y-auto editor-scroll p-3 space-y-3">
            {/* Header del composer: familia + NOT + grupo */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-8 ml-1.5 min-w-62">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Select<ConditionFamilyId>
                      value={composerFamily}
                      onChange={(value) => handleChangeFamily(value as ConditionFamilyId | "")}
                      options={familyOptions}
                      placeholder="Selecciona la familia de la condición"
                    />
                  </div>

                  <div
                    className={"btn " + (composerNot ? "btn-add-condition text-[11px]" : "btn-close-condition")}
                    onClick={() => setComposerNot((prev) => !prev)}
                    title="Negar esta condición"
                  >
                    NOT
                  </div>
                </div>
              </div>

              <div className="md:col-span-4">
                <Select<string>
                  value={targetGroup ? String(targetGroup) : ""}
                  onChange={(value) => setTargetGroup(value)}
                  options={groupSelectOptions}
                  disabled={!hasAnyCondition}
                  placeholder="Selecciona grupo"
                />
              </div>
            </div>

            {/* Editor leaf */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <div className="md:col-span-12 ml-1.5">
                <div className="bg-slate-950/25 p-2">
                  <ConditionLeafEditor
                    ctx={ctx}
                    cond={composerCond}
                    selectedFamily={composerFamily}
                    familyTypeOptions={familyLeafTypeOptions}
                    onChangeType={handleChangeLeafType}
                    onChange={(next) => setComposerCond(next)}
                  />
                </div>
              </div>
            </div>

            {/* Footer del composer */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center mt-4">
              <div className="md:col-span-6 flex items-center">
                <div
                  className={"btn btn-danger-condition " + (!isEditing ? "opacity-40 pointer-events-none" : "")}
                  onClick={() => {
                    if (!editRef) return;
                    deleteAtom(editRef.groupId, editRef.atomId);
                    closeComposer();
                  }}
                  title={isEditing ? "Eliminar condición" : "Solo disponible al editar"}
                >
                  Eliminar
                </div>
              </div>

              <div className="md:col-span-6 flex items-center justify-end gap-2">
                <div className="btn btn-close-condition" onClick={closeComposer}>
                  Cerrar
                </div>

                <div
                  className={"btn btn-create-condition " + (!canSave ? "opacity-40 pointer-events-none" : "")}
                  onClick={saveFromComposer}
                  title={!canSave ? "No hay cambios que guardar" : "Guardar"}
                >
                  {isEditing ? "Guardar" : "Crear"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto editor-scroll p-2">
            {!hasAnyCondition ? null : (
              <div className="space-y-3">
                {groups.map((group, groupIndex) => (
                  <div
                    key={group.id}
                    className="rounded-lg border-2 border-slate-600 bg-slate-900/75  p-2"
                  >
                    {/* Header de grupo */}
                    <div className="flex items-center justify-between mt-1 mb-1">
                      <div
                        className="mx-auto inline-flex px-2 py-1 btn btn-add-condition text-[13px] hover:bg-fuchsia-950/30 cursor-pointer select-none"
                        onClick={() => toggleGroupCollapsed(group.id)}
                        title={isGroupCollapsed(group.id) ? "Expandir grupo" : "Colapsar grupo"}
                      >
                        {groupLabel(groupIndex)}
                        <span className="ml-2 opacity-80">
                          {isGroupCollapsed(group.id) ? "▸" : "▾"}
                        </span>
                      </div>
                    </div>

                    {/* Contenido de grupo */}
                    <div className="pt-2 space-y-2">
                      {!isGroupCollapsed(group.id) && (
                        <div className="editor-scroll space-y-2 max-h-72 overflow-y-auto pr-1">
                          {group.atoms.map((atom, atomIndex) => {
                            const summaryText = summarize(ctx, atom.cond);
                            const notPrefix = atom.not ? "¬ " : "";

                            return (
                              <div
                                key={atom.id}
                                draggable
                                onDragStart={() => onDragStartAtom(group.id, atomIndex)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => onDropOnAtom(group.id, atomIndex)}
                                className={
                                  "rounded-md border-2 px-2 py-2 select-none " +
                                  (atom.collapsed
                                    ? "border-slate-700 bg-slate-950/60 hover:bg-fuchsia-950/30 hover:border-fuchsia-900"
                                    : "border-fuchsia-500/60")
                                }
                                title="Arrastra para mover · Click para editar"
                                onClick={() => openComposerForEdit(group.id, atom.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center min-w-0 text-white">
                                    <span className="w-5 shrink-0 text-center text-[12px] font-semibold">
                                      {atomIndex + 1}.
                                    </span>

                                    <span className="min-w-0 truncate text-[13px]">
                                      {notPrefix}
                                      {summaryText}
                                    </span>
                                  </div>

                                  <div
                                    className="flex items-center gap-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      className="btn btn-close-condition text-[12px] px-2"
                                      onClick={() => openComposerForEdit(group.id, atom.id)}
                                      title="Editar condición"
                                    >
                                      <Pencil size={14} />
                                    </button>

                                    <button
                                      type="button"
                                      className="btn btn-danger-condition text-[12px] px-2"
                                      onClick={() => deleteAtom(group.id, atom.id)}
                                      title="Eliminar condición"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {group.atoms.length === 0 ? (
                        <div className="bg-slate-950/20 px-2 py-2 text-[11px] text-slate-500 text-center">
                          Pulsa <span className="text-slate-200 font-semibold">+ Añadir condición</span>{" "}
                          para empezar
                        </div>
                      ) : (
                        <div
                          className="bg-slate-950/20 px-2 py-2 text-[12px] text-slate-400 text-center"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => onDropOnGroupEnd(group.id)}
                        >
                          Arrastra aquí para añadir la condición al {groupLabel(groupIndex)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}