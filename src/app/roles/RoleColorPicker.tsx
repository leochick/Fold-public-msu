"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const selected = ROLE_COLOR_PALETTE.includes(value as RolePaletteColor)
    ? (value as RolePaletteColor)
    : DEFAULT_ROLE_COLOR;

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
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
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

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute left-0 top-full z-20 mt-1 flex gap-1.5 rounded-md border border-black/10 dark:border-white/10 bg-paper dark:bg-ink p-2 shadow-lg"
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
                className={`h-6 w-6 rounded-full border border-black/15 dark:border-white/20 ${
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
