"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { updateAcademicYearAction } from "../academic-calendar-actions";
import {
  emptyAcademicBreak,
  emptyAcademicSemester,
  type AcademicBreakData,
  type AcademicFootballGame,
  type AcademicFootballVenue,
  type AcademicHoliday,
  type AcademicSemesterData,
} from "../../../drizzle/schema";
import type { AcademicYearDetail } from "@/server/academic-calendar";
import {
  deriveSummerRange,
  deriveWinterBreakRange,
  type DerivedDateRange,
} from "@/lib/academic-calendar-breaks";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type SemesterKey = "fall" | "spring";
type BreakKey = "winter" | "summer";

function emptyHoliday(): AcademicHoliday {
  return { name: "", startDate: null, endDate: null };
}

function createLineKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyFootballGame(): AcademicFootballGame {
  return { name: "", date: null, startTime: null, venue: null };
}

function cloneSemester(semester: AcademicSemesterData): AcademicSemesterData {
  return {
    ...semester,
    holidays: semester.holidays.map((holiday) => ({ ...holiday })),
    footballGames: (semester.footballGames ?? []).map((game) => ({ ...game })),
  };
}

function cloneBreak(breakData: AcademicBreakData): AcademicBreakData {
  return {
    holidays: breakData.holidays.map((holiday) => ({ ...holiday })),
  };
}

function HolidaysSection({
  idPrefix,
  holidays,
  holidayKeys,
  onChange,
  onHolidayKeysChange,
}: {
  idPrefix: string;
  holidays: AcademicHoliday[];
  holidayKeys: string[];
  onChange: (next: AcademicHoliday[]) => void;
  onHolidayKeysChange: (next: string[]) => void;
}) {
  function updateHoliday(index: number, patch: Partial<AcademicHoliday>) {
    onChange(
      holidays.map((holiday, holidayIndex) =>
        holidayIndex === index ? { ...holiday, ...patch } : holiday
      )
    );
  }

  function addHoliday() {
    onChange([...holidays, emptyHoliday()]);
    onHolidayKeysChange([...holidayKeys, createLineKey()]);
  }

  function removeHoliday(index: number) {
    onChange(holidays.filter((_, holidayIndex) => holidayIndex !== index));
    onHolidayKeysChange(holidayKeys.filter((_, holidayIndex) => holidayIndex !== index));
  }

  return (
    <section className="space-y-3 border-t border-black/5 dark:border-white/10 pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Holidays / Special Days</h3>
        <button type="button" className="btn btn-ghost text-xs px-2 py-1" onClick={addHoliday}>
          Add holiday
        </button>
      </div>

      {holidays.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          No holidays / special days yet. Add a line item for each one.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {holidays.map((holiday, index) => (
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
  );
}

function FootballScheduleSection({
  games,
  gameKeys,
  academicYearId,
  onChange,
  onGameKeysChange,
}: {
  games: AcademicFootballGame[];
  gameKeys: string[];
  academicYearId: number;
  onChange: (next: AcademicFootballGame[]) => void;
  onGameKeysChange: (next: string[]) => void;
}) {
  const [populating, setPopulating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateGame(index: number, patch: Partial<AcademicFootballGame>) {
    onChange(games.map((game, gameIndex) => (gameIndex === index ? { ...game, ...patch } : game)));
  }

  function addGame() {
    onChange([...games, emptyFootballGame()]);
    onGameKeysChange([...gameKeys, createLineKey()]);
    setStatus(null);
    setError(null);
  }

  function removeGame(index: number) {
    onChange(games.filter((_, gameIndex) => gameIndex !== index));
    onGameKeysChange(gameKeys.filter((_, gameIndex) => gameIndex !== index));
  }

  async function autoPopulate() {
    setPopulating(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/academic-calendar/football-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ academicYearId }),
      });
      const data = (await response.json()) as {
        error?: string;
        school?: string;
        games?: AcademicFootballGame[];
      };
      if (!response.ok) throw new Error(data.error ?? "Could not auto-populate the schedule");
      const nextGames = data.games ?? [];
      onChange(nextGames);
      onGameKeysChange(nextGames.map(() => createLineKey()));
      const countLabel = nextGames.length === 1 ? "1 game" : `${nextGames.length} games`;
      setStatus(data.school ? `Filled ${countLabel} for ${data.school}.` : `Filled ${countLabel}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not auto-populate the schedule");
    } finally {
      setPopulating(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-black/5 dark:border-white/10 pt-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">Football Schedule</h3>
        <div className="flex flex-col items-end gap-2">
          <button type="button" className="btn btn-ghost text-xs px-2 py-1" onClick={addGame}>
            Add Football Game
          </button>
          <button
            type="button"
            className="btn btn-primary text-xs px-2 py-1"
            onClick={autoPopulate}
            disabled={populating}
          >
            {populating ? "Populating…" : "Auto-populate"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : status ? (
        <p className="text-sm text-black/60 dark:text-white/60" aria-live="polite">
          {status}
        </p>
      ) : null}

      {games.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          No football games yet. Add a game or auto-populate the schedule.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {games.map((game, index) => (
            <li
              key={gameKeys[index]}
              className="grid grid-cols-1 lg:grid-cols-[minmax(12rem,1.4fr)_auto_auto_9rem_auto] gap-2 items-end"
            >
              <div>
                <label className="label block mb-1" htmlFor={`fall-game-name-${index}`}>
                  Game
                </label>
                <input
                  id={`fall-game-name-${index}`}
                  type="text"
                  className="input"
                  placeholder="e.g. MSU vs. Notre Dame"
                  value={game.name}
                  onChange={(event) => updateGame(index, { name: event.target.value })}
                />
              </div>
              <div>
                <label className="label block mb-1" htmlFor={`fall-game-date-${index}`}>
                  Date
                </label>
                <input
                  id={`fall-game-date-${index}`}
                  type="date"
                  className="input"
                  value={game.date ?? ""}
                  onChange={(event) => updateGame(index, { date: event.target.value || null })}
                />
              </div>
              <div>
                <label className="label block mb-1" htmlFor={`fall-game-time-${index}`}>
                  Start time
                </label>
                <input
                  id={`fall-game-time-${index}`}
                  type="time"
                  className="input"
                  value={game.startTime ?? ""}
                  onChange={(event) =>
                    updateGame(index, { startTime: event.target.value || null })
                  }
                />
              </div>
              <div>
                <label className="label block mb-1" htmlFor={`fall-game-venue-${index}`}>
                  Home or Away
                </label>
                <select
                  id={`fall-game-venue-${index}`}
                  className="input"
                  value={game.venue ?? ""}
                  onChange={(event) =>
                    updateGame(index, {
                      venue: (event.target.value || null) as AcademicFootballVenue | null,
                    })
                  }
                >
                  <option value="">Home or Away</option>
                  <option value="home">Home</option>
                  <option value="away">Away</option>
                </select>
              </div>
              <button
                type="button"
                className="btn btn-ghost text-xs px-2 py-1 text-red-600 dark:text-red-400"
                onClick={() => removeGame(index)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DerivedRangeDisplay({ range }: { range: DerivedDateRange }) {
  if (range.kind === "ready") {
    return (
      <div>
        <span className="label block mb-1">Date Range</span>
        <p className="text-sm font-medium">{range.label}</p>
      </div>
    );
  }

  return (
    <div>
      <span className="label block mb-1">Date Range</span>
      <p className="text-sm text-black/60 dark:text-white/60">
        Fill in the missing data so these dates can be generated: {range.missing.join("; ")}.
      </p>
    </div>
  );
}

function SemesterCard({
  title,
  semesterKey,
  semester,
  holidayKeys,
  academicYearId,
  footballKeys,
  onChange,
  onHolidayKeysChange,
  onFootballKeysChange,
}: {
  title: string;
  semesterKey: SemesterKey;
  semester: AcademicSemesterData;
  holidayKeys: string[];
  academicYearId?: number;
  footballKeys?: string[];
  onChange: (next: AcademicSemesterData) => void;
  onHolidayKeysChange: (next: string[]) => void;
  onFootballKeysChange?: (next: string[]) => void;
}) {
  const idPrefix = semesterKey;

  function updateField<K extends keyof AcademicSemesterData>(
    field: K,
    value: AcademicSemesterData[K]
  ) {
    onChange({ ...semester, [field]: value });
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

      <HolidaysSection
        idPrefix={idPrefix}
        holidays={semester.holidays}
        holidayKeys={holidayKeys}
        onChange={(holidays) => updateField("holidays", holidays)}
        onHolidayKeysChange={onHolidayKeysChange}
      />

      {semesterKey === "fall" && academicYearId != null && footballKeys && onFootballKeysChange && (
        <FootballScheduleSection
          academicYearId={academicYearId}
          games={semester.footballGames ?? []}
          gameKeys={footballKeys}
          onChange={(footballGames) => updateField("footballGames", footballGames)}
          onGameKeysChange={onFootballKeysChange}
        />
      )}
    </div>
  );
}

function BreakCard({
  title,
  breakKey,
  range,
  breakData,
  holidayKeys,
  onChange,
  onHolidayKeysChange,
}: {
  title: string;
  breakKey: BreakKey;
  range: DerivedDateRange;
  breakData: AcademicBreakData;
  holidayKeys: string[];
  onChange: (next: AcademicBreakData) => void;
  onHolidayKeysChange: (next: string[]) => void;
}) {
  return (
    <div className="card space-y-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <DerivedRangeDisplay range={range} />
      <HolidaysSection
        idPrefix={breakKey}
        holidays={breakData.holidays}
        holidayKeys={holidayKeys}
        onChange={(holidays) => onChange({ holidays })}
        onHolidayKeysChange={onHolidayKeysChange}
      />
    </div>
  );
}

export default function AcademicCalendarEditor({ year }: { year: AcademicYearDetail }) {
  const [fall, setFall] = useState(() => cloneSemester(year.fall));
  const [spring, setSpring] = useState(() => cloneSemester(year.spring));
  const [winter, setWinter] = useState(() => cloneBreak(year.winter));
  const [summer, setSummer] = useState(() => cloneBreak(year.summer));
  const [fallHolidayKeys, setFallHolidayKeys] = useState(() =>
    year.fall.holidays.map(() => createLineKey())
  );
  const [fallFootballKeys, setFallFootballKeys] = useState(() =>
    (year.fall.footballGames ?? []).map(() => createLineKey())
  );
  const [springHolidayKeys, setSpringHolidayKeys] = useState(() =>
    year.spring.holidays.map(() => createLineKey())
  );
  const [winterHolidayKeys, setWinterHolidayKeys] = useState(() =>
    year.winter.holidays.map(() => createLineKey())
  );
  const [summerHolidayKeys, setSummerHolidayKeys] = useState(() =>
    year.summer.holidays.map(() => createLineKey())
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAutosaveRef = useRef(true);
  const latestRef = useRef({ fall, spring, winter, summer });

  latestRef.current = { fall, spring, winter, summer };

  useEffect(() => {
    skipNextAutosaveRef.current = true;
    const nextFall = cloneSemester(year.fall ?? emptyAcademicSemester());
    const nextSpring = cloneSemester(year.spring ?? emptyAcademicSemester());
    const nextWinter = cloneBreak(year.winter ?? emptyAcademicBreak());
    const nextSummer = cloneBreak(year.summer ?? emptyAcademicBreak());
    setFall(nextFall);
    setSpring(nextSpring);
    setWinter(nextWinter);
    setSummer(nextSummer);
    setFallHolidayKeys(nextFall.holidays.map(() => createLineKey()));
    setFallFootballKeys((nextFall.footballGames ?? []).map(() => createLineKey()));
    setSpringHolidayKeys(nextSpring.holidays.map(() => createLineKey()));
    setWinterHolidayKeys(nextWinter.holidays.map(() => createLineKey()));
    setSummerHolidayKeys(nextSummer.holidays.map(() => createLineKey()));
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
  }, [year.id, fall, spring, winter, summer]);

  const winterRange = useMemo(() => deriveWinterBreakRange(fall, spring), [fall, spring]);
  const summerRange = useMemo(
    () => deriveSummerRange(spring, year.nextFall, year.nextYearName),
    [spring, year.nextFall, year.nextYearName]
  );

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
        title="Fall Semester"
        semesterKey="fall"
        semester={fall}
        holidayKeys={fallHolidayKeys}
        academicYearId={year.id}
        footballKeys={fallFootballKeys}
        onChange={setFall}
        onHolidayKeysChange={setFallHolidayKeys}
        onFootballKeysChange={setFallFootballKeys}
      />

      <BreakCard
        title="Winter Break"
        breakKey="winter"
        range={winterRange}
        breakData={winter}
        holidayKeys={winterHolidayKeys}
        onChange={setWinter}
        onHolidayKeysChange={setWinterHolidayKeys}
      />

      <SemesterCard
        title="Spring Semester"
        semesterKey="spring"
        semester={spring}
        holidayKeys={springHolidayKeys}
        onChange={setSpring}
        onHolidayKeysChange={setSpringHolidayKeys}
      />

      <BreakCard
        title="Summer"
        breakKey="summer"
        range={summerRange}
        breakData={summer}
        holidayKeys={summerHolidayKeys}
        onChange={setSummer}
        onHolidayKeysChange={setSummerHolidayKeys}
      />
    </div>
  );
}
