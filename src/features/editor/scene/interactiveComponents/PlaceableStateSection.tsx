import { useEffect, useRef, type RefObject } from "react";
import { Checkbox } from "@/components/Checkbox";

type PlaceableStateSectionProps = {
  initialVisible: boolean;
  initialReachable: boolean;
  initialNotReachableText: string;
  disableAllEditorFields: boolean;
  disableReachable: boolean;
  disableNotReachableText: boolean;
  notReachableInputRef: RefObject<HTMLInputElement | null>;
  onVisibleChange: (checked: boolean) => void;
  onReachableChange: (checked: boolean) => void;
  onNotReachableTextChange: (value: string) => void;
};

/* Bloque reutilizable para editar el estado inicial de un elemento colocable */
export function PlaceableStateSection({ initialVisible, initialReachable, initialNotReachableText, disableAllEditorFields, disableReachable,
  disableNotReachableText, notReachableInputRef, onVisibleChange, onReachableChange, onNotReachableTextChange }: PlaceableStateSectionProps) {
  const showNotReachableText = initialVisible && !initialReachable;
  const prevShowNotReachableRef = useRef(false);

  useEffect(() => {
    const wasVisible = prevShowNotReachableRef.current;
    prevShowNotReachableRef.current = showNotReachableText;

    if (wasVisible || !showNotReachableText) return;

    requestAnimationFrame(() => {
      const element = notReachableInputRef.current;
      if (!element) return;

      element.focus();

      try {
        const textLength = element.value.length;
        element.setSelectionRange(textLength, textLength);
      } catch { }
    });
  }, [showNotReachableText, notReachableInputRef]);

  return (
    <div className="bg-slate-950/30 px-2 py-2">
      <div className="mb-3 text-center text-[13px] text-slate-100">Estado inicial</div>

      <div className="flex items-center justify-center gap-6">
        <Checkbox
          checked={initialVisible}
          disabled={disableAllEditorFields}
          onChange={onVisibleChange}
          label="Visible"
          labelClassName="text-xs text-slate-200"
        />

        <Checkbox
          checked={initialVisible ? initialReachable : false}
          disabled={disableReachable}
          onChange={onReachableChange}
          label="Alcanzable"
          labelClassName="text-xs text-slate-200"
        />
      </div>

      {showNotReachableText ? (
        <div className="mt-3 space-y-1">
          <div className="mb-1.5 text-xs text-slate-100">Mensaje si no es alcanzable</div>

          <input
            ref={notReachableInputRef}
            value={initialNotReachableText}
            onChange={(event) => onNotReachableTextChange(event.target.value)}
            className="w-full rounded-md border-2 border-slate-700 bg-slate-900/30 px-2 py-1.5 text-xs text-slate-100
              focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
            placeholder='Ej: "No llego hasta ahí."'
            disabled={disableNotReachableText}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      ) : null}
    </div>
  );
}