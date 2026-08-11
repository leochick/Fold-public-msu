"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export default function CheckboxDropdown({
  label,
  summary,
  children,
}: {
  label: string;
  summary: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
    <div ref={rootRef} className="relative min-w-[12rem]">
      <button
        type="button"
        className="input w-full text-left flex items-center justify-between gap-2"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">
          <span className="text-black/50 dark:text-white/50">{label}: </span>
          {summary}
        </span>
        <span className="text-black/40 dark:text-white/40 shrink-0" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="listbox"
          className="absolute z-20 mt-1 w-full min-w-[14rem] max-h-64 overflow-y-auto rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-lg p-2 space-y-1"
        >
          {children}
        </div>
      )}
    </div>
  );
}
