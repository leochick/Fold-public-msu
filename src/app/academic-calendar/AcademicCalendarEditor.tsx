"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateAcademicYearAction } from "../academic-calendar-actions";
import {
  emptyAcademicSemester,
  type AcademicHoliday,
  type AcademicSemesterData,
} from "../../../drizzle/schema";
import type { AcademicYearDetail } from "@/server/academic-calendar";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type SemesterKey = "fall" | "spring";

function emptyHoliday(): AcademicHoliday {
  return { name: "", startDate: null, endDate: null };
}

function createHolidayKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `holiday-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function cloneSemester(semester: AcademicSemesterData): AcademicSemesterData {
  return {
    ...semester,
    holidays: semester.holidays.map((holiday) => ({ ...holiday })),
  };
}

function SemesterCard({
  title,
  semesterKey,
  semester,
  holidayKeys,
  onChange,
  onHolidayKeysChange,
}: {
  title: string;
  semesterKey: SemesterKey;
  semester: AcademicSemesterData;
  holidayKeys: string[];
  onChange: (next: AcademicSemesterData) => void;
  onHolidayKeysChange: (next: string[]) => void;
}) {
  const idPrefix = semesterKey;

  function updateField<K extends keyof AcademicSemesterData>(
    field: K,
    value: AcademicSemesterData[K]
  ) {
    onChange({ ...semester, [field]: value });
  }

  function updateHoliday(index: number, patch: Partial<AcademicHoliday>) {
    updateField(
      "holidays",
      semester.holidays.map((holiday, holidayIndex) =>
        holidayIndex === index ? { ...holiday, ...patch } : holiday
      )
    );
  }

  function addHoliday() {
    updateField("holidays", [...semester.holidays, emptyHoliday()]);
    onHolidayKeysChange([...holidayKeys, createHolidayKey()]);
  }

  function removeHoliday(index: number) {
    updateField(
      "holidays",
      semester.holidays.filter((_, holidayIndex) => holidayIndex !== index)
    );
    onHolidayKeysChange(holidayKeys.filter((_, holidayIndex) => holidayIndex !== index));
  }

  return (
    <div className="card space-y-6">
      <h2 className="text-lg font-semibold">{title}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-new-students-move-in`} className="label block mb-1">
            New Students Move In
          </label>
          <input
            id={`${idPrefix}-new-students-move-in`}
            type="date"
            className="input"
            value={semester.newStudentsMoveIn ?? ""}
            onChange={(event) => updateField("newStudentsMoveIn", event.target.value || null)}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-classes-begin`} className="label block mb-1">
            When Classes Begin
          </label>
          <input
            id={`${idPrefix}-classes-begin`}
            type="date"
            className="input"
            value={semester.classesBegin ?? ""}
            onChange={(event) => updateField("classesBegin", event.target.value || null)}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-classes-end`} className="label block mb-1">
            When Classes End
          </label>
          <input
            id={`${idPrefix}-classes-end`}
            type="date"
            className="input"
            value={semester.classesEnd ?? ""}
            onChange={(event) => updateField("classesEnd", event.target.value || null)}
          />
        </div>
        <div>
          <span className="label block mb-1">Final Exams</span>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id={`${idPrefix}-final-exams-start`}
              type="date"
              className="input"
              aria-label={`${title} final exams start`}
              value={semester.finalExamsStart ?? ""}
              onChange={(event) => updateField("finalExamsStart", event.target.value || null)}
            />
            <span className="hidden sm:inline self-center text-sm text-black/40 dark:text-white/40">
              to
            </span>
            <input
              id={`${idPrefix}-final-exams-end`}
              type="date"
              className="input"
              aria-label={`${title} final exams end`}
              value={semester.finalExamsEnd ?? ""}
              onChange={(event) => updateField("finalExamsEnd", event.target.value || null)}
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

        {semester.holidays.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            No holidays yet. Add a line item for each break or holiday.
          </p>
        ) : (
          <ul className="m-0 list-none space-y-3 p-0">
            {semester.holidays.map((holiday, index) => (
              <li
                key={holidayKeys[index]}
                className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end"
              >
                <div>
                  <label className="label block mb-1" htmlFor={`${idPrefix}-holiday-name-${index}`}>
                    Holiday Name
                  </label>
                  <input
                    id={`${idPrefix}-holiday-name-${index}`}
                    type="text"
                    className="input"
                    placeholder="e.g. Thanksgiving Break"
                    value={holiday.name}
                    onChange={(event) => updateHoliday(index, { name: event.target.value })}
                  />
                </div>
                <div>
                  <label className="label block mb-1" htmlFor={`${idPrefix}-holiday-start-${index}`}>
                    Date
                  </label>
                  <input
                    id={`${idPrefix}-holiday-start-${index}`}
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
                  <label className="label block mb-1" htmlFor={`${idPrefix}-holiday-end-${index}`}>
                    End (optional)
                  </label>
                  <input
                    id={`${idPrefix}-holiday-end-${index}`}
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

export default function AcademicCalendarEditor({ year }: { year: AcademicYearDetail }) {
  const [fall, setFall] = useState(() => cloneSemester(year.fall));
  const [spring, setSpring] = useState(() => cloneSemester(year.spring));
  const [fallHolidayKeys, setFallHolidayKeys] = useState(() =>
    year.fall.holidays.map(() => createHolidayKey())
  );
  const [springHolidayKeys, setSpringHolidayKeys] = useState(() =>
    year.spring.holidays.map(() => createHolidayKey())
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosaveRef = useRef(true);
  const latestRef = useRef({ fall, spring });

  latestRef.current = { fall, spring };

  useEffect(() => {
    skipNextAutosaveRef.current = true;
    const nextFall = cloneSemester(year.fall ?? emptyAcademicSemester());
    const nextSpring = cloneSemester(year.spring ?? emptyAcademicSemester());
    setFall(nextFall);
    setSpring(nextSpring);
    setFallHolidayKeys(nextFall.holidays.map(() => createHolidayKey()));
    setSpringHolidayKeys(nextSpring.holidays.map(() => createHolidayKey()));
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
  }, [year.id, fall, spring]);

  const saveLabel =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "error"
          ? "Error"
          : "";

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{year.name}</h2>
        <div className="text-xs text-black/50 dark:text-white/50 min-h-4" aria-live="polite">
          {saveStatus === "error" && saveError ? saveError : saveLabel}
        </div>
      </div>

      <SemesterCard
        title="Fall"
        semesterKey="fall"
        semester={fall}
        holidayKeys={fallHolidayKeys}
        onChange={setFall}
        onHolidayKeysChange={setFallHolidayKeys}
      />

      <SemesterCard
        title="Spring"
        semesterKey="spring"
        semester={spring}
        holidayKeys={springHolidayKeys}
        onChange={setSpring}
        onHolidayKeysChange={setSpringHolidayKeys}
      />
    </div>
  );
}
