"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SemesterPlanningColumn, SemesterSeason } from "@/lib/semester-planning";
import { SEMESTER_WEEK_MAX } from "@/lib/semester-planning";

function weekRowCount(column: SemesterPlanningColumn, weekNumber: number): number {
  const week = column.weeks[weekNumber];
  if (!week) return 1;
  return Math.max(1, week.events.length);
}

function maxRowsForWeek(columns: SemesterPlanningColumn[], weekNumber: number): number {
  if (columns.length === 0) return 1;
  return Math.max(...columns.map((column) => weekRowCount(column, weekNumber)));
}

export default function SemesterPlanningClient({
  season,
  columns,
}: {
  season: SemesterSeason;
  columns: SemesterPlanningColumn[];
}) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="semester-season" className="label block mb-1">
          Semester
        </label>
        <select
          id="semester-season"
          className="input max-w-xs"
          value={season}
          onChange={(event) => {
            const next = event.target.value === "spring" ? "spring" : "fall";
            router.push(`/semester-planning?semester=${next}`);
          }}
        >
          <option value="fall">Fall</option>
          <option value="spring">Spring</option>
        </select>
      </div>

      {columns.length === 0 ? (
        <div className="card">
          <p className="text-sm text-black/60 dark:text-white/60">
            No {season === "fall" ? "Fall" : "Spring"} semesters with a classes-begin date yet.
            Add dates in{" "}
            <Link href="/academic-calendar" className="underline">
              Academic Calendar
            </Link>{" "}
            to populate this table.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04]">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-paper dark:bg-ink px-3 py-2 text-left font-semibold align-bottom border-r border-black/10 dark:border-white/10"
                >
                  Week
                </th>
                {columns.map((column) => (
                  <th
                    key={column.academicYearId}
                    colSpan={4}
                    className="px-3 py-2 text-center font-semibold border-l border-black/10 dark:border-white/10"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]">
                {columns.map((column) => (
                  <SubHeaders key={column.academicYearId} />
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: SEMESTER_WEEK_MAX + 1 }, (_, weekNumber) => {
                const rowCount = maxRowsForWeek(columns, weekNumber);
                return Array.from({ length: rowCount }, (_, rowIndex) => (
                  <tr
                    key={`${weekNumber}-${rowIndex}`}
                    className="border-b border-black/5 dark:border-white/10 align-top"
                  >
                    {rowIndex === 0 && (
                      <th
                        rowSpan={rowCount}
                        className="sticky left-0 z-10 bg-paper dark:bg-ink px-3 py-2 text-left font-medium whitespace-nowrap border-r border-black/10 dark:border-white/10"
                      >
                        Week {weekNumber}
                      </th>
                    )}
                    {columns.map((column) => {
                      const week = column.weeks[weekNumber]!;
                      const event = week.events[rowIndex] ?? null;
                      return (
                        <SemesterCells
                          key={column.academicYearId}
                          holidaysSpecial={week.holidaysSpecial}
                          showHolidays={rowIndex === 0}
                          holidaysRowSpan={rowCount}
                          event={event}
                        />
                      );
                    })}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubHeaders() {
  const className =
    "px-3 py-2 text-left font-medium text-xs text-black/60 dark:text-white/60 border-l border-black/5 dark:border-white/10 whitespace-nowrap";
  return (
    <>
      <th className={className}>Holidays/Special</th>
      <th className={className}>Event</th>
      <th className={className}>Date</th>
      <th className={className}>Notes</th>
    </>
  );
}

function SemesterCells({
  holidaysSpecial,
  showHolidays,
  holidaysRowSpan,
  event,
}: {
  holidaysSpecial: string[];
  showHolidays: boolean;
  holidaysRowSpan: number;
  event: { id: number; name: string; dateLabel: string; notes: string | null } | null;
}) {
  const cell =
    "px-3 py-2 border-l border-black/5 dark:border-white/10 align-top min-w-[8rem]";
  const notesCell = `${cell} min-w-[14rem] whitespace-pre-wrap`;

  return (
    <>
      {showHolidays && (
        <td rowSpan={holidaysRowSpan} className={`${cell} min-w-[11rem] bg-black/[0.015] dark:bg-white/[0.02]`}>
          {holidaysSpecial.length > 0 ? (
            <ul className="m-0 list-disc space-y-1 pl-4">
              {holidaysSpecial.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          ) : (
            <span className="text-black/30 dark:text-white/30">—</span>
          )}
        </td>
      )}
      <td className={cell}>
        {event ? (
          <Link href={`/events/${event.id}`} className="hover:underline font-medium">
            {event.name}
          </Link>
        ) : (
          <span className="text-black/30 dark:text-white/30">—</span>
        )}
      </td>
      <td className={`${cell} whitespace-nowrap`}>
        {event ? event.dateLabel : <span className="text-black/30 dark:text-white/30">—</span>}
      </td>
      <td className={notesCell}>
        {event?.notes ? (
          event.notes
        ) : (
          <span className="text-black/30 dark:text-white/30">—</span>
        )}
      </td>
    </>
  );
}
