import { useEffect, useRef } from "react";

type PlaceableStateSectionProps = {
  initialVisible: boolean;
  initialReachable: boolean;
  initialNotReachableText: string;
  disableAllEditorFields: boolean;
  disableReachable: boolean;
  disableNotReachableText: boolean;
  notReachableInputRef: React.RefObject<HTMLInputElement | null>;
  onVisibleChange: (checked: boolean) => void;
  onReachableChange: (checked: boolean) => void;
  onNotReachableTextChange: (value: string) => void;
};

export function PlaceableStateSection({ initialVisible, initialReachable, initialNotReachableText, disableAllEditorFields, disableReachable, disableNotReachableText,
  notReachableInputRef, onVisibleChange, onReachableChange, onNotReachableTextChange }: PlaceableStateSectionProps) {
  const prevShowNotReachableRef = useRef(false);
  const showNotReachableText = initialVisible && !initialReachable;

  useEffect(() => {
    const prev = prevShowNotReachableRef.current;
    prevShowNotReachableRef.current = showNotReachableText;

    if (!prev && showNotReachableText) {
      requestAnimationFrame(() => {
        const el = notReachableInputRef.current;
        if (!el) return;
        el.focus();

        try {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        } catch {}
      });
    }
  }, [showNotReachableText, notReachableInputRef]);

  return (
    <div className="bg-slate-950/30 px-2 py-2">
      <div className="text-xs text-slate-200 mb-2 text-center">Estado inicial</div>

      <div className="flex items-center justify-center gap-6">
        <label className="inline-flex items-center gap-2 text-xs text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={initialVisible}
            disabled={disableAllEditorFields}
            onChange={(e) => onVisibleChange(e.target.checked)}
          />
          Visible
        </label>

        <label className="inline-flex items-center gap-2 text-xs text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={initialVisible ? initialReachable : false}
            disabled={disableReachable}
            onChange={(e) => onReachableChange(e.target.checked)}
          />
          Alcanzable
        </label>
      </div>

      {showNotReachableText ? (
        <div className="mt-3 space-y-1">
          <div className="text-xs text-slate-100 mb-1.5">Frase si no es alcanzable</div>

          <input
            ref={notReachableInputRef}
            value={initialNotReachableText}
            onChange={(e) => onNotReachableTextChange(e.target.value)}
            className="w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100
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