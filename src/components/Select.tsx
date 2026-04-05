import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type Option<K extends string> = { id: K; label: string };

type Props<K extends string> = {
  value: K | "";
  onChange: (v: K | "") => void;
  options: Option<K>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
};

export function Select<K extends string>({ value, onChange, options, placeholder, disabled, className, buttonClassName, menuClassName, optionClassName }: Props<K>) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((o) => o.id === value) ?? null,
    [options, value]
  );

  function updateMenuPosition() {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();

    setMenuPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuPosition();
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      const clickedInsideRoot = !!rootRef.current?.contains(target);
      const clickedInsideMenu = !!menuRef.current?.contains(target);

      if (!clickedInsideRoot && !clickedInsideMenu) setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleWindowChange() {
      updateMenuPosition();
    }

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [open]);

  const menu =
    open && !disabled && menuPosition
      ? createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            zIndex: 9999,
          }}
          className={
            "max-h-60 overflow-auto rounded-md border border-slate-700 bg-slate-900 p-1 shadow-lg " +
            (menuClassName ?? "")
          }
        >
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={
              "block w-full rounded px-2 py-1 text-left text-xs text-slate-300 hover:bg-fuchsia-600 hover:text-white " +
              (optionClassName ?? "")
            }
          >
            {placeholder ?? "Selecciona…"}
          </button>

          {options.map((o) => {
            const isSelected = o.id === value;

            return (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={
                  "block w-full rounded px-2 py-1 text-left text-xs transition-colors " +
                  (isSelected
                    ? "bg-fuchsia-700 text-white "
                    : "text-slate-200 hover:bg-fuchsia-600 hover:text-white ") +
                  (optionClassName ?? "")
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>,
        document.body
      )
      : null;

  return (
    <>
      <div ref={rootRef} className={className ?? "w-full"}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className={
            "flex w-full items-center justify-between rounded-md border bg-slate-900 px-2 py-1 text-xs text-white " +
            "focus:outline-none focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50 " +
            (buttonClassName ?? "border-slate-700")
          }
        >
          <span className={selected ? "text-white" : "text-slate-400"}>
            {selected?.label ?? placeholder ?? "Selecciona…"}
          </span>

          <svg
            className={`ml-2 h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.126l3.71-3.895a.75.75 0 111.08 1.04l-4.25 4.458a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {menu}
    </>
  );
}