"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { RoleBoardPerson } from "../../../drizzle/schema";
import { personKey } from "@/lib/role-boards";
import type { RoleBoardPersonOption } from "@/server/roles";

function displayName(person: Pick<RoleBoardPersonOption, "firstName" | "lastName">) {
  return `${person.firstName} ${person.lastName ?? ""}`.trim();
}

export default function PersonPicker({
  value,
  options,
  onChange,
}: {
  value: RoleBoardPerson | null;
  options: RoleBoardPersonOption[];
  onChange: (value: RoleBoardPerson | null) => void;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo((): RoleBoardPersonOption | null => {
    if (!value) return null;
    return (
      options.find((option) => option.entity === value.entity && option.id === value.id) ?? {
        entity: value.entity,
        id: value.id,
        firstName: value.entity === "staff" ? "Staff" : "Student",
        lastName: `#${value.id}`,
      }
    );
  }, [options, value]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => displayName(option).toLowerCase().includes(normalized));
  }, [options, query]);

  const staffOptions = filtered.filter((option) => option.entity === "staff");
  const studentOptions = filtered.filter((option) => option.entity === "student");

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectPerson(option: RoleBoardPersonOption | null) {
    onChange(option ? { entity: option.entity, id: option.id } : null);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative min-w-[10rem]">
      <button
        type="button"
        className="input text-left flex items-center justify-between gap-2"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">
          {selected ? (
            <span className={selected.entity === "staff" ? "font-bold" : undefined}>
              {displayName(selected)}
            </span>
          ) : (
            <span className="text-black/40 dark:text-white/40">Select person…</span>
          )}
        </span>
        <span className="text-black/40 dark:text-white/40 shrink-0" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 mt-1 z-20 rounded-md border border-black/10 dark:border-white/10 bg-paper dark:bg-ink shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-black/5 dark:border-white/10">
            <input
              type="search"
              className="input"
              placeholder="Search…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              role="option"
              className="w-full text-left px-3 py-1.5 text-sm text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => selectPerson(null)}
            >
              Clear
            </button>
            {staffOptions.length > 0 && (
              <div>
                <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-black/40 dark:text-white/40">
                  Staff
                </p>
                {staffOptions.map((option) => (
                  <button
                    key={personKey(option)}
                    type="button"
                    role="option"
                    aria-selected={
                      selected?.entity === option.entity && selected.id === option.id
                    }
                    className="w-full text-left px-3 py-1.5 text-sm font-bold hover:bg-black/5 dark:hover:bg-white/5"
                    onClick={() => selectPerson(option)}
                  >
                    {displayName(option)}
                  </button>
                ))}
              </div>
            )}
            {studentOptions.length > 0 && (
              <div>
                <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-black/40 dark:text-white/40">
                  Students
                </p>
                {studentOptions.map((option) => (
                  <button
                    key={personKey(option)}
                    type="button"
                    role="option"
                    aria-selected={
                      selected?.entity === option.entity && selected.id === option.id
                    }
                    className="w-full text-left px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
                    onClick={() => selectPerson(option)}
                  >
                    {displayName(option)}
                  </button>
                ))}
              </div>
            )}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-black/50 dark:text-white/50">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
