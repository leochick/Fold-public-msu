"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateAcademicYearAction } from "../academic-calendar-actions";
import type { AcademicHoliday } from "../../../drizzle/schema";
import type { AcademicYearDetail } from "@/server/academic-calendar";

type SaveStatus = "idle" | "saving" | "saved" | "error";

function emptyHoliday(): AcademicHoliday {
  return { name: "", startDate: null, endDate: null };
}

function createHolidayKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `holiday-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AcademicCalendarEditor({ year }: { year: AcademicYearDetail }) {
  const [newStudentsMoveIn, setNewStudentsMoveIn] = useState(year.newStudentsMoveIn);
  const [classesBegin, setClassesBegin] = useState(year.classesBegin);
  const [classesEnd, setClassesEnd] = useState(year.classesEnd);
  const [finalExamsStart, setFinalExamsStart] = useState(year.finalExamsStart);
  const [finalExamsEnd, setFinalExamsEnd] = useState(year.finalExamsEnd);
  const [holidays, setHolidays] = useState<AcademicHoliday[]>(
    year.holidays.length > 0 ? year.holidays : []
  );
  const [holidayKeys, setHolidayKeys] = useState(() =>
    (year.holidays.length > 0 ? year.holidays : []).map(() => createHolidayKey())
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosaveRef = useRef(true);
  const latestRef = useRef({
    newStudentsMoveIn,
    classesBegin,
    classesEnd,
    finalExamsStart,
    finalExamsEnd,
    holidays,
  });

  latestRef.current = {
    newStudentsMoveIn,
    classesBegin,
    classesEnd,
    finalExamsStart,
    finalExamsEnd,
    holidays,
  };

  useEffect(() => {
    skipNextAutosaveRef.current = true;
    setNewStudentsMoveIn(year.newStudentsMoveIn);
    setClassesBegin(year.classesBegin);
    setClassesEnd(year.classesEnd);
    setFinalExamsStart(year.finalExamsStart);
    setFinalExamsEnd(year.finalExamsEnd);
    const nextHolidays = year.holidays.length > 0 ? year.holidays : [];
    setHolidays(nextHolidays);
    setHolidayKeys(nextHolidays.map(() => createHolidayKey()));
    setSaveStatus("idle");
    setSaveError(null);
  }, [year.id]);

  useEffect(() => {
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    setSaveError(null);

    saveTimerRef.current = setTimeout(() => {
      const snapshot = latestRef.current;
      startTransition(async () => {
        try {
          await updateAcademicYearAction(year.id, snapshot);
          setSaveStatus("saved");
        } catch (error) {
          setSaveStatus("error");
          setSaveError(error instanceof Error ? error.message : "Could not save");
        }
      });
    }, 450);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [
    year.id,
    newStudentsMoveIn,
    classesBegin,
    classesEnd,
    finalExamsStart,
    finalExamsEnd,
    holidays,
  ]);

  function updateHoliday(index: number, patch: Partial<AcademicHoliday>) {
    setHolidays((current) =>
      current.map((holiday, holidayIndex) =>
        holidayIndex === index ? { ...holiday, ...patch } : holiday
      )
    );
  }

  function addHoliday() {
    setHolidays((current) => [...current, emptyHoliday()]);
    setHolidayKeys((current) => [...current, createHolidayKey()]);
  }

  function removeHoliday(index: number) {
    setHolidays((current) => current.filter((_, holidayIndex) => holidayIndex !== index));
    setHolidayKeys((current) => current.filter((_, holidayIndex) => holidayIndex !== index));
  }

  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? "Error"
          : "";

  return (
    <div className="card space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">{year.name}</h2>
        <div className="text-xs text-black/50 dark:text-white/50 min-h-4" aria-live="polite">
          {saveStatus === "error" && saveError ? saveError : saveLabel}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="new-students-move-in" className="label block mb-1">
            New Students Move In
          </label>
          <input
            id="new-students-move-in"
            type="date"
            className="input"
            value={newStudentsMoveIn}
            onChange={(event) => setNewStudentsMoveIn(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="classes-begin" className="label block mb-1">
            When Classes Begin
          </label>
          <input
            id="classes-begin"
            type="date"
            className="input"
            value={classesBegin}
            onChange={(event) => setClassesBegin(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="classes-end" className="label block mb-1">
            When Classes End
          </label>
          <input
            id="classes-end"
            type="date"
            className="input"
            value={classesEnd}
            onChange={(event) => setClassesEnd(event.target.value)}
          />
        </div>
        <div>
          <span className="label block mb-1">Final Exams</span>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="final-exams-start"
              type="date"
              className="input"
              aria-label="Final exams start"
              value={finalExamsStart}
              onChange={(event) => setFinalExamsStart(event.target.value)}
            />
            <span className="hidden sm:inline self-center text-sm text-black/40 dark:text-white/40">
              to
            </span>
            <input
              id="final-exams-end"
              type="date"
              className="input"
              aria-label="Final exams end"
              value={finalExamsEnd}
              onChange={(event) => setFinalExamsEnd(event.target.value)}
            />
          </div>
        </div>
      </div>

      <section className="space-y-3 border-t border-black/5 dark:border-white/10 pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Holidays</h3>
          <button type="button" className="btn btn-ghost text-xs px-2 py-1" onClick={addHoliday}>
            Add holiday
          </button>
        </div>

        {holidays.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            No holidays yet. Add a line item for each break or holiday.
          </p>
        ) : (
          <ul className="m-0 list-none space-y-3 p-0">
            {holidays.map((holiday, index) => (
              <li
                key={holidayKeys[index]}
                className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end"
              >
                <div>
                  <label className="label block mb-1" htmlFor={`holiday-name-${index}`}>
                    Holiday Name
                  </label>
                  <input
                    id={`holiday-name-${index}`}
                    type="text"
                    className="input"
                    placeholder="e.g. Thanksgiving Break"
                    value={holiday.name}
                    onChange={(event) => updateHoliday(index, { name: event.target.value })}
                  />
                </div>
                <div>
                  <label className="label block mb-1" htmlFor={`holiday-start-${index}`}>
                    Date
                  </label>
                  <input
                    id={`holiday-start-${index}`}
                    type="date"
                    className="input"
                    value={holiday.startDate ?? ""}
                    onChange={(event) =>
                      updateHoliday(index, {
                        startDate: event.target.value || null,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="label block mb-1" htmlFor={`holiday-end-${index}`}>
                    End (optional)
                  </label>
                  <input
                    id={`holiday-end-${index}`}
                    type="date"
                    className="input"
                    value={holiday.endDate ?? ""}
                    onChange={(event) =>
                      updateHoliday(index, {
                        endDate: event.target.value || null,
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost text-xs px-2 py-1 text-red-600 dark:text-red-400"
                  onClick={() => removeHoliday(index)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
