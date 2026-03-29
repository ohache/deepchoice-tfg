import { useEffect, useMemo, useRef, useState } from "react";
import type { Project, ID } from "@/domain/types";
import { generateId } from "@/utils/id";
import { conditionSchema } from "@/validation/rulesSchemas";
import { createProjectIndex } from "@/features/editor/scene/rules/conditions/conditionProjectIndex";
import {
  createDefaultLeaf,
  createSiblingLeafPreservingSelection,
  getConditionFamilies,
  leafFamily,
  leafLabel,
  summarize,
  type ConditionFamilyId,
  type EnabledLeafType,
  type EnabledLeafCondition,
} from "@/features/editor/scene/rules/conditions/conditionLeafRegistry";
import { ensureAtLeastOneGroup, makeAtom, moveAtomBetweenGroups, pruneEmptyGroups, uiDraftToCondition, type UiDraft, type UiGroup } from "@/features/editor/scene/rules/conditions/conditionDraftMapper";
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

function reorder<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const a = [...arr];
  if (!a.length) return a;

  const from = Math.max(0, Math.min(a.length - 1, fromIndex));
  const to = Math.max(0, Math.min(a.length - 1, toIndex));
  if (from === to) return a;

  const [item] = a.splice(from, 1);
  a.splice(to, 0, item);
  return a;
}

function groupLabel(index: number): string {
  return `Grupo ${index + 1}`;
}

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

function validateComposerCondition(cond: EnabledLeafCondition, not: boolean): boolean {
  const tmpGroupId: ID = "tmp";

  const tmpDraft: UiDraft = {
    groups: [{ id: tmpGroupId, atoms: [makeAtom(cond, not)] }],
    lastGroupId: tmpGroupId,
  };

  const parsed = conditionSchema.safeParse(uiDraftToCondition(pruneEmptyGroups(tmpDraft)));
  return parsed.success;
}

export function ConditionGroups({ project, currentNodeId, value, onChange, onBusyChange }: Props) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerFamily, setComposerFamily] = useState<ConditionFamilyId | "">("");
  const [composerCond, setComposerCond] = useState<EnabledLeafCondition | null>(null);
  const [composerNot, setComposerNot] = useState(false);
  const [targetGroup, setTargetGroup] = useState<ID | "new" | "">("");
  const [initialSnapshot, setInitialSnapshot] = useState<string>("");

  const [collapsedGroups, setCollapsedGroups] = useState<Record<ID, boolean>>({});
  const [editRef, setEditRef] = useState<EditRef | null>(null);

  const dragRef = useRef<DragRef | null>(null);

  const isEditing = editRef != null;
  const groups = value.groups ?? [];

  const idx = useMemo(() => createProjectIndex(project), [project]);
  const ctx = useMemo(() => ({ idx, currentNodeId }), [idx, currentNodeId]);

  const availableFamilies = useMemo(() => getConditionFamilies(ctx), [ctx]);

  const familyOptions: Option<ConditionFamilyId>[] = useMemo(
    () => availableFamilies.map((f) => ({ id: f.id, label: f.label })),
    [availableFamilies]
  );

  const hasAnyCondition = useMemo(
    () => groups.some((g) => (g.atoms?.length ?? 0) > 0),
    [groups]
  );
  const currentSnapshot = useMemo(
    () =>
      buildComposerSnapshot({
        family: composerFamily,
        cond: composerCond,
        not: composerNot,
        groupId: targetGroup,
      }),
    [composerFamily, composerCond, composerNot, targetGroup]
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

  const groupSelectOptions: Option<string>[] = useMemo(() => {
    const existing = groups.map((g, idx2) => ({ id: g.id, label: groupLabel(idx2) }));
    return [...existing, { id: "new", label: "Crear grupo nuevo" }];
  }, [groups]);

  useEffect(() => {
    onBusyChange?.(composerOpen || isEditing);
  }, [composerOpen, isEditing, onBusyChange]);

  const isGroupCollapsed = (groupId: ID) => Boolean(collapsedGroups[groupId]);

  const toggleGroupCollapsed = (groupId: ID) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

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

  const resolveDefaultGroupId = (d: UiDraft): ID => {
    const gs = d.groups ?? [];
    if (!gs.length) return generateId.conditionGroup();

    const last = d.lastGroupId;
    if (last && gs.some((g) => g.id === last)) return last;

    return gs[gs.length - 1].id;
  };

  const openComposerForEdit = (groupId: ID, atomId: ID) => {
    const g = groups.find((x) => x.id === groupId);
    const a = g?.atoms?.find((x) => x.id === atomId);
    if (!a) return;

    const family = leafFamily(a.cond.type);

    const snap = buildComposerSnapshot({
      family,
      cond: a.cond,
      not: Boolean(a.not),
      groupId,
    });

    setEditRef({ groupId, atomId });
    setComposerOpen(true);
    setComposerFamily(family);
    setComposerCond(a.cond);
    setComposerNot(Boolean(a.not));
    setTargetGroup(groupId);
    setInitialSnapshot(snap);
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

    const familySpec = availableFamilies.find((f) => f.id === family);
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
    const fromG = draft.groups.find((x) => x.id === fromGroupId);
    const atom = fromG?.atoms?.find((x) => x.id === atomId);
    if (!atom) return;

    const newGroupId = generateId.conditionGroup();
    const newAtom = { ...atom, not, cond };

    const nextGroups = draft.groups
      .map((g) => (g.id === fromGroupId ? { ...g, atoms: g.atoms.filter((a) => a.id !== atomId) } : g))
      .concat([{ id: newGroupId, atoms: [newAtom] }]);

    const pruned = pruneEmptyGroups({ ...draft, groups: nextGroups });
    onChange({ ...pruned, lastGroupId: newGroupId });

    toast.success("Condición guardada", "Actualizada y movida a un grupo nuevo.");
    closeComposer();
  };

  const saveEditedAtomToExistingGroup = (draft: UiDraft, fromGroupId: ID, toGroupId: ID, atomId: ID, cond: EnabledLeafCondition, not: boolean) => {
    const fromG = draft.groups.find((x) => x.id === fromGroupId);
    const atom = fromG?.atoms?.find((x) => x.id === atomId);
    if (!atom) return;

    const nextGroups = draft.groups.map((g) => {
      if (g.id === fromGroupId && fromGroupId !== toGroupId) {
        return { ...g, atoms: g.atoms.filter((a) => a.id !== atomId) };
      }

      if (g.id === toGroupId) {
        const without = g.atoms.filter((a) => a.id !== atomId);
        const updatedAtom = { ...atom, not, cond };
        return { ...g, atoms: [...without, updatedAtom] };
      }

      if (g.id === fromGroupId && fromGroupId === toGroupId) {
        return {
          ...g,
          atoms: g.atoms.map((a) => (a.id === atomId ? { ...a, not, cond } : a)),
        };
      }

      return g;
    });

    const pruned = pruneEmptyGroups({ ...draft, groups: nextGroups });
    onChange({ ...pruned, lastGroupId: toGroupId });

    toast.success("Condición guardada", "Actualizada correctamente.");
    closeComposer();
  };

  const createAtomInNewGroup = (draft: UiDraft, atom: ReturnType<typeof makeAtom>) => {
    const newGroup: UiGroup = { id: generateId.conditionGroup(), atoms: [atom] };
    onChange({ ...draft, groups: [...draft.groups, newGroup], lastGroupId: newGroup.id });

    toast.success("Condición creada", "Añadida como nuevo grupo.");
    closeComposer();
  };

  const createAtomInExistingGroup = (draft: UiDraft, atom: ReturnType<typeof makeAtom>, targetId: ID) => {
    const nextGroups = draft.groups.map((g) =>
      g.id === targetId ? { ...g, atoms: [...g.atoms, atom] } : g
    );

    onChange({ ...draft, groups: nextGroups, lastGroupId: targetId });

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
    const nextGroups = groups.map((g) =>
      g.id === groupId ? { ...g, atoms: g.atoms.filter((a) => a.id !== atomId) } : g
    );

    const pruned = pruneEmptyGroups({ ...value, groups: nextGroups });
    onChange(ensureAtLeastOneGroup(pruned));

    toast.success("Condición eliminada", "Se ha eliminado correctamente.");
  };

  const reorderInGroup = (groupId: ID, from: number, to: number) => {
    const nextGroups = groups.map((g) =>
      g.id === groupId ? { ...g, atoms: reorder(g.atoms, from, to) } : g
    );

    onChange({ ...value, groups: nextGroups, lastGroupId: groupId });
  };

  const consumeDraggedAtom = (): DragRef | null => {
    const d = dragRef.current;
    dragRef.current = null;
    return d;
  };

  const onDragStartAtom = (groupId: ID, index: number) => {
    dragRef.current = { fromGroupId: groupId, fromIndex: index };
  };

  const onDropOnAtom = (toGroupId: ID, toIndex: number) => {
    const d = consumeDraggedAtom();
    if (!d) return;

    if (d.fromGroupId === toGroupId) {
      reorderInGroup(toGroupId, d.fromIndex, toIndex);
      return;
    }

    onChange(
      moveAtomBetweenGroups({
        draft: value,
        fromGroupId: d.fromGroupId,
        fromIndex: d.fromIndex,
        toGroupId,
        toIndex,
      })
    );
  };

  const onDropOnGroupEnd = (toGroupId: ID) => {
    const d = consumeDraggedAtom();
    if (!d) return;

    if (d.fromGroupId === toGroupId) {
      const len = groups.find((g) => g.id === toGroupId)?.atoms.length ?? 0;
      reorderInGroup(toGroupId, d.fromIndex, len);
      return;
    }

    onChange(
      moveAtomBetweenGroups({
        draft: value,
        fromGroupId: d.fromGroupId,
        fromIndex: d.fromIndex,
        toGroupId,
        toIndex: null,
      })
    );
  };

  const familyLeafTypeOptions = useMemo<Option<EnabledLeafType>[]>(() => {
    if (!composerFamily) return [];
    const family = availableFamilies.find((f) => f.id === composerFamily);
    return (family?.leafTypes ?? []).map((type) => ({
      id: type,
      label: leafLabel(type),
    }));
  }, [availableFamilies, composerFamily]);

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-800/70 py-2 flex justify-center">
        {!composerOpen && (
          <button type="button" className="btn btn-add-condition" onClick={openComposer}>
            + Añadir condición
          </button>
        )}
      </div>

      <div className="bg-slate-950/35 p-3 space-y-3">
        {composerOpen ? (
          <div className="h-full overflow-y-auto editor-scroll p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-8 ml-1.5 min-w-62">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Select<ConditionFamilyId>
                      value={composerFamily}
                      onChange={(v) => handleChangeFamily(v as ConditionFamilyId | "")}
                      options={familyOptions}
                      placeholder="Selecciona la familia de la condición"
                    />
                  </div>

                  <div
                    className={"btn " + (composerNot ? "btn-add-condition text-[11px]" : "btn-close-condition")}
                    onClick={() => setComposerNot((p) => !p)}
                    title="Negar esta condición"
                  >
                    NOT
                  </div>
                </div>
              </div>

              <div className="md:col-span-4">
                <Select<string>
                  value={targetGroup ? String(targetGroup) : ""}
                  onChange={(v) => setTargetGroup(v)}
                  options={groupSelectOptions}
                  disabled={!hasAnyCondition}
                  placeholder="Selecciona grupo"
                />
              </div>
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <div className="md:col-span-6 ml-1.5 flex items-center">
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
                  {isEditing ? "Guardar condición" : "Crear condición"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto editor-scroll p-2">
            {!hasAnyCondition ? null : (
              <div className="space-y-3">
                {groups.map((g, gIndex) => (
                  <div key={g.id} className="rounded-lg border-2 border-slate-600 bg-slate-950/30 p-2">
                    <div className="flex items-center justify-between">
                      <div
                        className="mx-auto inline-flex px-2 py-1 btn btn-add-condition text-[12px] hover:bg-fuchsia-950/30 cursor-pointer select-none"
                        onClick={() => toggleGroupCollapsed(g.id)}
                        title={isGroupCollapsed(g.id) ? "Expandir grupo" : "Colapsar grupo"}
                      >
                        {groupLabel(gIndex)}
                        <span className="ml-2 opacity-80">{isGroupCollapsed(g.id) ? "▸" : "▾"}</span>
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      {!isGroupCollapsed(g.id) && (
                        <div className="editor-scroll space-y-2 max-h-72 overflow-y-auto pr-1">
                          {g.atoms.map((a, idx2) => {
                            const summaryText = summarize(ctx, a.cond);
                            const notPrefix = a.not ? "¬ " : "";

                            return (
                              <div
                                key={a.id}
                                draggable
                                onDragStart={() => onDragStartAtom(g.id, idx2)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => onDropOnAtom(g.id, idx2)}
                                className={
                                  "rounded-md border px-2 py-2 select-none " +
                                  (a.collapsed
                                    ? "border-slate-700 bg-slate-950/60"
                                    : "border-fuchsia-500/60")
                                }
                                title="Arrastra para mover · Click para editar"
                                onClick={() => openComposerForEdit(g.id, a.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center min-w-0 text-white">
                                    <span className="w-5 shrink-0 text-center text-[12px] font-semibold">
                                      {idx2 + 1}.
                                    </span>
                                    <span className="min-w-0 truncate text-[13px]">
                                      {notPrefix}
                                      {summaryText}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      type="button"
                                      className="btn btn-close-condition text-[12px] px-2"
                                      onClick={() => openComposerForEdit(g.id, a.id)}
                                      title="Editar condición"
                                    >
                                      <Pencil size={14} />
                                    </button>

                                    <button
                                      type="button"
                                      className="btn btn-danger-condition text-[12px] px-2"
                                      onClick={() => deleteAtom(g.id, a.id)}
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

                      {g.atoms.length === 0 ? (
                        <div className="bg-slate-950/20 px-2 py-2 text-[11px] text-slate-500 text-center">
                          Pulsa <span className="text-slate-200 font-semibold">+ Añadir condición</span>{" "}
                          para empezar
                        </div>
                      ) : (
                        <div
                          className="bg-slate-950/20 px-2 py-2 text-[11px] text-slate-500 text-center"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => onDropOnGroupEnd(g.id)}
                        >
                          Arrastra aquí para añadir la condición al {groupLabel(gIndex)}
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