import type { ReactNode } from "react";
import type { SceneTestConditionSummary, SceneTestEffectSummary, SceneTestHotspotEntry, SceneTestInspectableEntry, SceneTestPlacedItemEntry, SceneTestPlacedNpcEntry,
  SceneTestPlacedPlayerEntry, SceneTestRuleSummary, SceneTestRulesSummary, SceneTestVarEntry } from "@/features/editor/scene/test/sceneTestTypes";
import { StarIcon } from "@heroicons/react/24/solid"

type SceneTestInfoCardProps = {
  target: SceneTestInspectableEntry | null;
  pinned?: boolean;
}

/* Helpers visuales simples */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[13px] font-semibold text-slate-100">
      {children}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="text-[12px] text-slate-100">
        {value}
      </div>
    </div>
  );
}

function InlineFieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="text-[12px] text-slate-200">
      <span className="font-semibold text-slate-100">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function EmptyBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-[12px] text-slate-400">
      {children}
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

/* Render de condiciones / efectos / reglas */
function ConditionBlock({ condition }: { condition?: SceneTestConditionSummary }) {
  if (!condition) return <EmptyBlock>Sin condición.</EmptyBlock>;

  return (
    <ul className="space-y-1 list-disc pl-4">
      <li className="text-[12px] text-slate-200">
        {condition.text}
      </li>
    </ul>
  );
}

function EffectsList({ effects }: { effects: SceneTestEffectSummary[] }) {
  if (effects.length === 0) return <span className="text-slate-400">Sin efectos</span>;

  return (
    <ul className="space-y-1 list-disc pl-4">
      {effects.map((effect, index) => (
        <li key={`${effect.text}-${index}`} className="text-[12px] text-slate-200">
          {effect.text}
        </li>
      ))}
    </ul>
  );
}

function RuleCard({ rule }: { rule: SceneTestRuleSummary }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 space-y-2">
      <div className="text-center text-[12px] font-semibold text-fuchsia-200">
        {rule.channel === "onClick" ? "onClick" : "onUseItem"}
      </div>

      {rule.itemLabel && (
        <div className="text-center text-[11px] text-slate-400">
          {rule.itemLabel}
        </div>
      )}

      {rule.phrase && (
        <FieldRow label="Frase" value={rule.phrase} />
      )}

      <div className="space-y-0.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Condición
        </div>
        <ConditionBlock condition={rule.when} />
      </div>

      <div className="space-y-0.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Efectos
        </div>
        <EffectsList effects={rule.effects} />
      </div>
    </div>
  );
}

function RulesBlock({ rules }: { rules: SceneTestRulesSummary }) {
  const hasOnClick = rules.onClick.length > 0;
  const hasOnUseItem = rules.onUseItem.length > 0;

  if (!hasOnClick && !hasOnUseItem) return <EmptyBlock>No hay reglas definidas.</EmptyBlock>;

  return (
    <div className="space-y-3">
      {hasOnClick && (
        <div className="space-y-2">
          {rules.onClick.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      )}

      {hasOnUseItem && (
        <div className="space-y-2">
          {rules.onUseItem.map((rule) => (
            <RuleCard key={rule.id} rule={rule} />
          ))}
        </div>
      )}
    </div>
  );
}

/* Render de variables / estado inicial */
function VarsBlock({ vars }: { vars: SceneTestVarEntry[] }) {
  if (vars.length === 0) return <EmptyBlock>No hay variables definidas.</EmptyBlock>;

  return (
    <ul className="space-y-1 list-disc pl-4">
      {vars.map((variable) => (
        <li key={variable.id} className="text-[12px] text-slate-200">
          <span className="font-semibold text-slate-100">{variable.name}</span>
          <span>: {variable.type === "boolean" ? "Booleano" : "Número"}</span>
          <span>. Inicial: {variable.initialText}</span>
        </li>
      ))}
    </ul>
  );
}

function InitialStateBlock({ state }: {
  state: SceneTestHotspotEntry["initialState"] | SceneTestPlacedItemEntry["initialState"] |
  SceneTestPlacedNpcEntry["initialState"] | SceneTestPlacedPlayerEntry["initialState"]
}) {
  const rows: Array<{ label: string; value: string }> = [];

  if ("visible" in state && typeof state.visible === "boolean") rows.push({ label: "Visible", value: state.visible ? "Sí" : "No" });
  if ("reachable" in state && typeof state.reachable === "boolean") rows.push({ label: "Alcanzable", value: state.reachable ? "Sí" : "No" });
  if ("notReachableText" in state && state.notReachableText) rows.push({ label: "Texto no alcanzable", value: state.notReachableText });
  if (rows.length === 0) return <EmptyBlock>No hay información de estado inicial.</EmptyBlock>;

  return (
    <div className="space-y-1">
      {rows.map((row) => (
        <InlineFieldRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  );
}

/* Tarjetas específicas por tipo */
function HotspotCard({ target }: { target: SceneTestHotspotEntry }) {
  return (
    <div className="space-y-4">
      <FieldRow label="Tipo" value="Hotspot" />
      <FieldRow label="Nombre" value={target.label} />

      <InfoSection title="Estado inicial">
        <InitialStateBlock state={target.initialState} />
      </InfoSection>

      <InfoSection title="Variables">
        <VarsBlock vars={target.vars} />
      </InfoSection>

      <InfoSection title="Reglas">
        <RulesBlock rules={target.rules} />
      </InfoSection>
    </div>
  );
}

function PlacedItemCard({ target }: { target: SceneTestPlacedItemEntry }) {
  return (
    <div className="space-y-4">
      <FieldRow label="Tipo" value="Item colocado" />
      <FieldRow label="Nombre" value={target.label} />
      <FieldRow label="Item referenciado" value={target.itemName} />

      <InfoSection title="Estado inicial">
        <InitialStateBlock state={target.initialState} />
      </InfoSection>

      <InfoSection title="Reglas">
        <RulesBlock rules={target.rules} />
      </InfoSection>
    </div>
  );
}

function PlacedNpcCard({ target }: { target: SceneTestPlacedNpcEntry }) {
  return (
    <div className="space-y-4">
      <FieldRow label="Tipo" value="NPC colocado" />
      <FieldRow label="NPC" value={target.npcName} />

      <InfoSection title="Estado inicial">
        <InitialStateBlock state={target.initialState} />
      </InfoSection>

      <InfoSection title="Variables">
        <VarsBlock vars={target.vars} />
      </InfoSection>

      <InfoSection title="Reglas">
        <RulesBlock rules={target.rules} />
      </InfoSection>
    </div>
  );
}

function PlacedPlayerCard({ target }: { target: SceneTestPlacedPlayerEntry }) {
  return (
    <div className="space-y-4">
      <FieldRow label="Tipo" value="Player colocado" />
      <FieldRow label="Player" value={target.playerName} />
      <FieldRow label="Imagen inicial" value={target.initialImageName} />

      <InfoSection title="Estado inicial">
        <InitialStateBlock state={target.initialState} />
      </InfoSection>

      <InfoSection title="Variables">
        <VarsBlock vars={target.vars} />
      </InfoSection>
    </div>
  );
}

function TargetDetails({ target }: { target: SceneTestInspectableEntry }) {
  switch (target.type) {
    case "hotspot":
      return <HotspotCard target={target} />;

    case "placedItem":
      return <PlacedItemCard target={target} />;

    case "placedNpc":
      return <PlacedNpcCard target={target} />;

    case "placedPlayer":
      return <PlacedPlayerCard target={target} />;

    default:
      return null;
  }
}

/* Componente principal */
export function SceneTestInfoCard({ target, pinned }: SceneTestInfoCardProps) {
  return (
    <aside className="rounded-xl border-2 border-slate-700 bg-slate-900 shadow-xl overflow-hidden">
      <div className="border-b border-slate-700 bg-slate-950/90 px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <div className="text-sm font-semibold text-slate-100">
            Detalles del componente
          </div>

          {pinned ? (
            <StarIcon
              className="h-4 w-4 text-amber-300"
              aria-label="Fijado"
              title="Fijado"
            />
          ) : null}
        </div>
      </div>

      <div className="px-4 py-4">
        {!target ? (
          <EmptyBlock>
            Pasa el cursor por un elemento interactivo o haz click para fijar su información.
          </EmptyBlock>
        ) : (
          <TargetDetails target={target} />
        )}
      </div>
    </aside>
  );
}