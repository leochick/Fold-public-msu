import {
  formatDashboardDate,
  formatDashboardDateLabel,
  parseDashboardDateEnd,
  parseDashboardDateStart,
} from "@/lib/dashboard-date-range";
import type { AcademicHoliday, AcademicSemesterData } from "../../drizzle/schema";

export const SEMESTER_WEEK_MAX = 16;

export type SemesterSeason = "fall" | "spring";

export type ParsedAcademicYearName = {
  startYear: number;
  endYear: number;
};

const DAY_MS = 86400_000;

/** Parse names like "2025-26" or "2025-2026" into start/end calendar years. */
export function parseAcademicYearName(name: string): ParsedAcademicYearName | null {
  const match = /^(\d{4})\s*[-–]\s*(\d{2}|\d{4})$/.exec(name.trim());
  if (!match) return null;

  const startYear = Number(match[1]);
  let endYear = Number(match[2]);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return null;

  if (match[2].length === 2) {
    endYear = Math.floor(startYear / 100) * 100 + endYear;
    if (endYear < startYear) endYear += 100;
  }

  return { startYear, endYear };
}

export function semesterLabel(season: SemesterSeason, yearName: string): string {
  const parsed = parseAcademicYearName(yearName);
  const seasonLabel = season === "fall" ? "Fall" : "Spring";
  if (!parsed) return `${seasonLabel} (${yearName})`;
  const year = season === "fall" ? parsed.startYear : parsed.endYear;
  return `${seasonLabel} ${year}`;
}

export function semesterSortYear(season: SemesterSeason, yearName: string): number {
  const parsed = parseAcademicYearName(yearName);
  if (!parsed) return Number.MAX_SAFE_INTEGER;
  return season === "fall" ? parsed.startYear : parsed.endYear;
}

/** Sunday 00:00 UTC of the week containing `date`. */
export function startOfWeekSunday(date: Date): Date {
  const day = date.getUTCDay(); // 0 = Sunday
  const sunday = new Date(date.getTime());
  sunday.setUTCDate(date.getUTCDate() - day);
  sunday.setUTCHours(0, 0, 0, 0);
  return sunday;
}

/** Week 1 begins on the Sunday of the week when classes begin. */
export function getWeek1Start(classesBegin: Date): Date {
  return startOfWeekSunday(classesBegin);
}

export function getWeekStart(classesBegin: Date, weekNumber: number): Date {
  const week1 = getWeek1Start(classesBegin);
  return new Date(week1.getTime() + (weekNumber - 1) * 7 * DAY_MS);
}

export function getWeekEnd(classesBegin: Date, weekNumber: number): Date {
  const start = getWeekStart(classesBegin, weekNumber);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/** Week index 0–16 for a date, or null if outside the semester week grid. */
export function weekNumberForDate(classesBegin: Date, date: Date): number | null {
  const week0Start = getWeekStart(classesBegin, 0);
  const week16End = getWeekEnd(classesBegin, SEMESTER_WEEK_MAX);
  if (date < week0Start || date > week16End) return null;

  const week1Start = getWeek1Start(classesBegin);
  const diffDays = Math.floor((startOfWeekSunday(date).getTime() - week1Start.getTime()) / DAY_MS);
  const weekNumber = Math.floor(diffDays / 7) + 1;
  if (weekNumber < 0 || weekNumber > SEMESTER_WEEK_MAX) return null;
  return weekNumber;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && aEnd >= bStart;
}

function holidayRange(holiday: AcademicHoliday): { start: Date; end: Date } | null {
  if (!holiday.startDate) return null;
  const start = parseDashboardDateStart(holiday.startDate);
  if (!start) return null;
  const end =
    (holiday.endDate ? parseDashboardDateEnd(holiday.endDate) : null) ??
    parseDashboardDateEnd(holiday.startDate);
  if (!end) return null;
  return { start, end };
}

export function formatSpecialLabel(name: string, startIso: string | null, endIso: string | null): string {
  const trimmed = name.trim() || "Special";
  if (!startIso) return trimmed;
  const start = parseDashboardDateStart(startIso);
  if (!start) return trimmed;
  const startLabel = formatDashboardDateLabel(start);
  if (!endIso || endIso === startIso) return `${trimmed} (${startLabel})`;
  const end = parseDashboardDateStart(endIso) ?? parseDashboardDateEnd(endIso);
  if (!end) return `${trimmed} (${startLabel})`;
  return `${trimmed} (${startLabel} – ${formatDashboardDateLabel(end)})`;
}

/** Holidays and finals that overlap a given week. */
export function specialsForWeek(
  semester: AcademicSemesterData,
  classesBegin: Date,
  weekNumber: number
): string[] {
  const weekStart = getWeekStart(classesBegin, weekNumber);
  const weekEnd = getWeekEnd(classesBegin, weekNumber);
  const labels: string[] = [];

  for (const holiday of semester.holidays ?? []) {
    const range = holidayRange(holiday);
    if (!range) continue;
    if (!rangesOverlap(range.start, range.end, weekStart, weekEnd)) continue;
    labels.push(formatSpecialLabel(holiday.name, holiday.startDate, holiday.endDate));
  }

  if (semester.finalExamsStart) {
    const finalsStart = parseDashboardDateStart(semester.finalExamsStart);
    const finalsEnd =
      (semester.finalExamsEnd ? parseDashboardDateEnd(semester.finalExamsEnd) : null) ??
      (semester.finalExamsStart ? parseDashboardDateEnd(semester.finalExamsStart) : null);
    if (
      finalsStart &&
      finalsEnd &&
      rangesOverlap(finalsStart, finalsEnd, weekStart, weekEnd)
    ) {
      labels.push(
        formatSpecialLabel("Final Exams", semester.finalExamsStart, semester.finalExamsEnd)
      );
    }
  }

  return labels;
}

export type SemesterPlanningEvent = {
  id: number;
  name: string;
  startDate: Date;
  notes: string | null;
};

export type SemesterWeekCell = {
  weekNumber: number;
  holidaysSpecial: string[];
  events: Array<{
    id: number;
    name: string;
    date: string;
    dateLabel: string;
    notes: string | null;
  }>;
};

export type SemesterPlanningColumn = {
  academicYearId: number;
  yearName: string;
  label: string;
  sortYear: number;
  classesBegin: string;
  weeks: SemesterWeekCell[];
};

export function buildSemesterColumn(args: {
  academicYearId: number;
  yearName: string;
  season: SemesterSeason;
  semester: AcademicSemesterData;
  events: SemesterPlanningEvent[];
}): SemesterPlanningColumn | null {
  if (!args.semester.classesBegin) return null;
  const classesBegin = parseDashboardDateStart(args.semester.classesBegin);
  if (!classesBegin) return null;

  const weeks: SemesterWeekCell[] = [];
  for (let weekNumber = 0; weekNumber <= SEMESTER_WEEK_MAX; weekNumber++) {
    const weekStart = getWeekStart(classesBegin, weekNumber);
    const weekEnd = getWeekEnd(classesBegin, weekNumber);
    const weekEvents = args.events
      .filter((event) => event.startDate >= weekStart && event.startDate <= weekEnd)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      .map((event) => ({
        id: event.id,
        name: event.name,
        date: formatDashboardDate(event.startDate),
        dateLabel: formatDashboardDateLabel(event.startDate),
        notes: event.notes,
      }));

    weeks.push({
      weekNumber,
      holidaysSpecial: specialsForWeek(args.semester, classesBegin, weekNumber),
      events: weekEvents,
    });
  }

  return {
    academicYearId: args.academicYearId,
    yearName: args.yearName,
    label: semesterLabel(args.season, args.yearName),
    sortYear: semesterSortYear(args.season, args.yearName),
    classesBegin: args.semester.classesBegin,
    weeks,
  };
}
