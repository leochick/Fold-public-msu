"use client";

import { useEffect, useId, useRef, useState } from "react";

export type CheckboxDropdownOption = {
  value: string;
  label: string;
};

export default function CheckboxDropdown({
  label,
  options,
  selected,
  onChange,
  required = false,
  multiple = true,
  emptyLabel = "All",
}: {
  label: string;
  options: CheckboxDropdownOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  required?: boolean;
  multiple?: boolean;
  emptyLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const menuId = useId();

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

  const selectedLabels = options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label);
  const summary =
    selectedLabels.length === 0
      ? emptyLabel
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.length} selected`;

  function toggle(value: string) {
    if (!multiple) {
      onChange([value]);
      return;
    }
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    onChange([...selected, value]);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label className="label block mb-1">{label}</label>
      <button
        type="button"
        className="input flex items-center justify-between gap-2 text-left"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{summary}</span>
        <span className="text-black/40 dark:text-white/40 shrink-0" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          role="listbox"
          aria-multiselectable={multiple}
          className="absolute left-0 right-0 mt-1 z-30 rounded-lg border border-black/10 dark:border-white/10 bg-paper dark:bg-ink shadow-lg p-1"
        >
          {!required && selected.length > 0 && (
            <button
              type="button"
              className="w-full text-left rounded-md px-3 py-2 text-xs text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          )}
          <div className="max-h-64 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-black/40 dark:text-white/40">No options yet</p>
            ) : (
              options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      disabled={required && checked && selected.length === 1}
                      onChange={() => toggle(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
