"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  DEFAULT_ROLE_COLOR,
  ROLE_COLOR_PALETTE,
  type RolePaletteColor,
} from "@/lib/role-boards";

export default function RoleColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: RolePaletteColor) => void;
  label: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const selected = ROLE_COLOR_PALETTE.includes(value as RolePaletteColor)
    ? (value as RolePaletteColor)
    : DEFAULT_ROLE_COLOR;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onReposition() {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.left });
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-md border border-black/10 dark:border-white/15 bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        title="Role color"
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className="h-5 w-5 rounded-full border border-black/15 dark:border-white/20"
          style={{ backgroundColor: selected }}
          aria-hidden
        />
      </button>

      {open && menuPos && (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="fixed z-50 grid w-[13.5rem] grid-cols-6 gap-2 rounded-md border border-black/10 dark:border-white/10 bg-paper dark:bg-ink p-2.5 shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {ROLE_COLOR_PALETTE.map((swatch) => {
            const isSelected = selected === swatch;
            return (
              <button
                key={swatch}
                type="button"
                role="option"
                aria-selected={isSelected}
                title={swatch}
                aria-label={`Select color ${swatch}`}
                className={`h-7 w-7 justify-self-center rounded-full border border-black/15 dark:border-white/20 ${
                  isSelected
                    ? "ring-2 ring-accent ring-offset-1 ring-offset-white dark:ring-offset-black"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: swatch }}
                onClick={() => {
                  onChange(swatch);
                  setOpen(false);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
