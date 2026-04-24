import type { ReactNode } from "react";
import type {
  SceneTestConditionSummary, SceneTestEffectSummary, SceneTestHotspotEntry, SceneTestInspectableEntry, SceneTestPlacedItemEntry, SceneTestPlacedNpcEntry,
  SceneTestPlacedPlayerEntry, SceneTestRuleSummary, SceneTestRulesSummary, SceneTestVarEntry
} from "@/features/editor/scene/test/sceneTestTypes";

interface SceneTestInfoCardProps {
  target: SceneTestInspectableEntry | null;
  pinned?: boolean;
}

/* Helpers visuales simples */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[13px] font-semibold text-amber-800">
      {children}
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[13px] font-semibold tracking-wide text-amber-900/75">
        {label}
      </div>
      <div className="text-[12px] text-amber-950">
        {value}
      </div>
    </div>
  );
}

function InlineFieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="text-[12px] text-amber-950">
      <span className="font-semibold text-amber-900">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

function EmptyBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-amber-900/15 bg-amber-50/70 px-3 py-2 text-[12px] text-amber-900/70">
      {children}
    </div>
  );
}

/*  Render de condiciones / efectos / reglas */
function ConditionBlock({ condition }: { condition?: SceneTestConditionSummary }) {
  if (!condition) return <EmptyBlock>Sin condición.</EmptyBlock>;

  return (
    <ul className="space-y-1 list-disc pl-4">
      <li className="text-[12px] text-amber-950">
        {condition.text}
      </li>
    </ul>
  );
}

function EffectsList({ effects }: { effects: SceneTestEffectSummary[] }) {
  if (effects.length === 0) return <span className="text-amber-900/70">Sin efectos</span>;

  return (
    <ul className="space-y-1 list-disc pl-4">
      {effects.map((effect, index) => (
        <li key={`${effect.text}-${index}`} className="text-[12px] text-amber-950">
          {effect.text}
        </li>
      ))}
    </ul>
  );
}

function RuleCard({ rule }: { rule: SceneTestRuleSummary }) {
  return (
    <div className="rounded-md border border-amber-900/15 bg-amber-50/70 px-3 py-2 space-y-2">
      <div className="text-center text-[12px] font-semibold text-amber-950">
        {rule.channel === "onClick" ? "onClick" : "onUseItem"}
      </div>

      {rule.itemLabel && (
        <div className="text-center text-[11px] text-amber-900/70">
          {rule.itemLabel}
        </div>
      )}

      {rule.phrase && (
        <FieldRow label="Frase" value={rule.phrase} />
      )}

      <div className="space-y-0.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/75">
          Condición
        </div>
        <ConditionBlock condition={rule.when} />
      </div>

      <div className="space-y-0.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/75">
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
          <div className="space-y-2">
            {rules.onClick.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        </div>
      )}

      {hasOnUseItem && (
        <div className="space-y-2">
          <div className="space-y-2">
            {rules.onUseItem.map((rule) => (
              <RuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Render de variables / estado inicial= */
function VarsBlock({ vars }: { vars: SceneTestVarEntry[] }) {
  if (vars.length === 0) return <EmptyBlock>No hay variables definidas.</EmptyBlock>;

  return (
    <ul className="space-y-1 list-disc pl-4">
      {vars.map((variable) => (
        <li key={variable.id} className="text-[12px] text-amber-950">
          <span className="font-semibold">{variable.name}</span>
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

      <div className="space-y-1">
        <SectionTitle>Estado inicial</SectionTitle>
        <InitialStateBlock state={target.initialState} />
      </div>

      <div className="space-y-2">
        <SectionTitle>Variables</SectionTitle>
        <VarsBlock vars={target.vars} />
      </div>

      <div className="space-y-2">
        <SectionTitle>Reglas</SectionTitle>
        <RulesBlock rules={target.rules} />
      </div>
    </div>
  );
}

function PlacedItemCard({ target }: { target: SceneTestPlacedItemEntry }) {
  return (
    <div className="space-y-4">
      <FieldRow label="Tipo" value="Item colocado" />
      <FieldRow label="Nombre" value={target.label} />
      <FieldRow label="Item referenciado" value={target.itemName} />

      <div className="space-y-2">
        <SectionTitle>Estado inicial</SectionTitle>
        <InitialStateBlock state={target.initialState} />
      </div>

      <div className="space-y-2">
        <SectionTitle>Reglas</SectionTitle>
        <RulesBlock rules={target.rules} />
      </div>
    </div>
  );
}

function PlacedNpcCard({ target }: { target: SceneTestPlacedNpcEntry }) {
  return (
    <div className="space-y-4">
      <FieldRow label="Tipo" value="NPC colocado" />
      <FieldRow label="NPC" value={target.npcName} />

      <div className="space-y-2">
        <SectionTitle>Estado inicial</SectionTitle>
        <InitialStateBlock state={target.initialState} />
      </div>

      <div className="space-y-2">
        <SectionTitle>Variables</SectionTitle>
        <VarsBlock vars={target.vars} />
      </div>

      <div className="space-y-2">
        <SectionTitle>Reglas</SectionTitle>
        <RulesBlock rules={target.rules} />
      </div>
    </div>
  );
}

function PlacedPlayerCard({ target }: { target: SceneTestPlacedPlayerEntry }) {
  return (
    <div className="space-y-4">
      <FieldRow label="Tipo" value="Player colocado" />
      <FieldRow label="Player" value={target.playerName} />
      <FieldRow label="Imagen inicial" value={target.initialImageName} />

      <div className="space-y-2">
        <SectionTitle>Estado inicial</SectionTitle>
        <InitialStateBlock state={target.initialState} />
      </div>

      <div className="space-y-2">
        <SectionTitle>Variables</SectionTitle>
        <VarsBlock vars={target.vars} />
      </div>
    </div>
  );
}

/* Componente principal*/
export function SceneTestInfoCard({ target }: SceneTestInfoCardProps) {
  return (
    <aside className="rounded-xl border-2 border-amber-300 bg-amber-100 shadow-sm overflow-hidden">
      <div className="border-b border-amber-300/80 bg-amber-200/80 px-4 py-3">
        <div className="text-center">
          <div className="text-sm font-semibold text-amber-950">
            Detalles del componente
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {!target ? (
          <EmptyBlock>
            Pasa el cursor por un elemento interactivo o haz click para fijar su información.
          </EmptyBlock>
        ) : null}

        {target?.type === "hotspot" && <HotspotCard target={target} />}
        {target?.type === "placedItem" && <PlacedItemCard target={target} />}
        {target?.type === "placedNpc" && <PlacedNpcCard target={target} />}
        {target?.type === "placedPlayer" && <PlacedPlayerCard target={target} />}
      </div>
    </aside>
  );
}