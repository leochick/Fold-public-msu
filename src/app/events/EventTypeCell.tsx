"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateEventTypeAction } from "./actions";

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11.3 2.3a1.5 1.5 0 0 1 2.1 2.1L5.5 12.3 2.5 13l.7-3 8.1-7.7Z" />
    </svg>
  );
}

export default function EventTypeCell({
  eventId,
  type,
}: {
  eventId: number;
  type: string | null;
}) {
  const saved = type ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [display, setDisplay] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const editingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (editingRef.current) return;
    setDisplay(saved);
    setDraft(saved);
  }, [saved]);

  useEffect(() => {
    if (!editing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [editing]);

  function startEditing() {
    editingRef.current = true;
    setDraft(display);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    if (!editingRef.current) return;
    editingRef.current = false;
    setDraft(display);
    setEditing(false);
  }

  function commit() {
    if (!editingRef.current) return;
    editingRef.current = false;
    setEditing(false);

    const next = draft.trim();
    if (next === display.trim()) {
      setDraft(display);
      return;
    }

    const previous = display;
    setDisplay(next);
    setDraft(next);
    setError(null);

    startTransition(async () => {
      try {
        await updateEventTypeAction(eventId, next);
      } catch (err) {
        setDisplay(previous);
        setDraft(previous);
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  if (editing) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          commit();
        }}
      >
        <input
          ref={inputRef}
          className="input py-1 px-2"
          value={draft}
          autoComplete="off"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancel();
            }
          }}
          aria-label="Event type"
        />
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span
        className={`min-w-0 truncate ${display ? "" : "text-black/30"} ${
          isPending ? "opacity-60" : ""
        }`}
      >
        {display || "—"}
      </span>
      <button
        type="button"
        onClick={startEditing}
        aria-label={display ? `Edit type ${display}` : "Edit type"}
        title="Edit type"
        className="shrink-0 rounded p-1 text-black/35 hover:text-black/70 dark:text-white/35 dark:hover:text-white/70 focus:outline-none focus:ring-2 focus:ring-accent/50"
      >
        <PencilIcon className="h-4 w-4" />
      </button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
