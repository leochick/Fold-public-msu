"use client";

import { useEffect, useRef, useState } from "react";
import { updateEventDetailsAction } from "../actions";

type Fields = {
  date: string;
  type: string;
  location: string;
  notes: string;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

function readFields(form: HTMLFormElement): Fields {
  const data = new FormData(form);
  return {
    date: String(data.get("date") || "").trim(),
    type: String(data.get("type") || "").trim(),
    location: String(data.get("location") || "").trim(),
    notes: String(data.get("notes") || "").trim(),
  };
}

function sameFields(a: Fields, b: Fields) {
  return a.date === b.date && a.type === b.type && a.location === b.location && a.notes === b.notes;
}

export default function EditEventCard({
  eventId,
  dateValue,
  type,
  location,
  notes,
}: {
  eventId: number;
  dateValue: string;
  type: string | null;
  location: string | null;
  notes: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef<Fields>({
    date: dateValue,
    type: (type ?? "").trim(),
    location: (location ?? "").trim(),
    notes: (notes ?? "").trim(),
  });
  const inFlightRef = useRef(false);
  const rerunRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  async function persist(showDateError: boolean) {
    const form = formRef.current;
    if (!form) return;

    const next = readFields(form);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next.date)) {
      if (showDateError) {
        setSaveStatus("error");
        setSaveError("Enter a valid date");
      }
      return;
    }

    if (sameFields(next, savedRef.current)) {
      setSaveError(null);
      setSaveStatus((current) => (current === "saving" ? "saved" : current === "error" ? "idle" : current));
      return;
    }

    if (inFlightRef.current) {
      rerunRef.current = true;
      return;
    }

    inFlightRef.current = true;
    setSaveStatus("saving");
    setSaveError(null);
    const formData = new FormData(form);

    try {
      await updateEventDetailsAction(eventId, formData);
      savedRef.current = next;
      if (!rerunRef.current) {
        setSaveStatus("saved");
        setSaveError(null);
      }
    } catch (error) {
      if (!rerunRef.current) {
        setSaveStatus("error");
        setSaveError(error instanceof Error ? error.message : "Could not save event");
      }
    } finally {
      inFlightRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        void persist(false);
      }
    }
  }

  function scheduleAutosave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveError(null);
    saveTimerRef.current = setTimeout(() => {
      void persist(false);
    }, 450);
  }

  function flushAutosave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    void persist(true);
  }

  const statusLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? "Save failed"
          : null;

  return (
    <form
      ref={formRef}
      className="card space-y-3"
      onChange={scheduleAutosave}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        flushAutosave();
      }}
      onSubmit={(event) => {
        event.preventDefault();
        flushAutosave();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold">Edit Event</h2>
        <div className="text-right">
          <p className="text-xs text-black/60 dark:text-white/60">Changes save automatically.</p>
          {statusLabel && (
            <p
              className={`text-xs ${
                saveStatus === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-black/50 dark:text-white/50"
              }`}
            >
              {statusLabel}
            </p>
          )}
        </div>
      </div>
      {saveError && <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor={`date-${eventId}`}>
            Date
          </label>
          <input
            id={`date-${eventId}`}
            name="date"
            type="date"
            required
            className="input"
            defaultValue={dateValue}
          />
        </div>
        <div>
          <label className="label" htmlFor={`type-${eventId}`}>
            Type
          </label>
          <input
            id={`type-${eventId}`}
            name="type"
            className="input"
            placeholder="retreat / weekly / bbq"
            defaultValue={type ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor={`location-${eventId}`}>
            Location
          </label>
          <input
            id={`location-${eventId}`}
            name="location"
            className="input"
            defaultValue={location ?? ""}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`notes-${eventId}`}>
          Notes
        </label>
        <textarea
          id={`notes-${eventId}`}
          name="notes"
          rows={3}
          className="input"
          defaultValue={notes ?? ""}
        />
      </div>
    </form>
  );
}
