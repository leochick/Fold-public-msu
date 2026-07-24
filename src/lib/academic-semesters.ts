import {
  formatDashboardDate,
  parseDashboardDateEnd,
  parseDashboardDateStart,
} from "@/lib/dashboard-date-range";
import {
  deriveSummerRange,
  deriveWinterBreakRange,
  findNextAcademicYear,
} from "@/lib/academic-calendar-breaks";
import { parseAcademicYearName } from "@/lib/semester-planning";
import type { AcademicSemesterData } from "../../drizzle/schema";

export type AcademicSeason = "fall" | "winter" | "spring" | "summer";

export type ComputableAcademicSemester = {
  academicYearId: number;
  yearName: string;
  season: AcademicSeason;
  name: string;
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD */
  to: string;
  startDate: Date;
  endDate: Date;
  sortKey: string;
};

export type AcademicYearForSemesters = {
  id: number;
  name: string;
  fall: AcademicSemesterData;
  spring: AcademicSemesterData;
};

const SEASON_ORDER: Record<AcademicSeason, number> = {
  fall: 0,
  winter: 1,
  spring: 2,
  summer: 3,
};

function readyRange(
  start: string | null | undefined,
  end: string | null | undefined
): { from: string; to: string; startDate: Date; endDate: Date } | null {
  if (!start || !end) return null;
  const startDate = parseDashboardDateStart(start);
  const endDate = parseDashboardDateEnd(end);
  if (!startDate || !endDate || startDate > endDate) return null;
  return { from: start, to: end, startDate, endDate };
}

/** Fall: new students move in → last day of finals. */
export function deriveFallSemesterRange(fall: AcademicSemesterData) {
  return readyRange(fall.newStudentsMoveIn, fall.finalExamsEnd);
}

/** Spring: classes begin → last day of finals. */
export function deriveSpringSemesterRange(spring: AcademicSemesterData) {
  return readyRange(spring.classesBegin, spring.finalExamsEnd);
}

export function formatAcademicSemesterName(
  season: AcademicSeason,
  yearName: string
): string {
  const parsed = parseAcademicYearName(yearName);
  switch (season) {
    case "fall":
      return parsed ? `${parsed.startYear} Fall Semester` : `${yearName} Fall Semester`;
    case "winter": {
      if (parsed) {
        const endYY = String(parsed.endYear).slice(-2);
        return `${parsed.startYear}-${endYY} Winter Break`;
      }
      return `${yearName} Winter Break`;
    }
    case "spring":
      return parsed ? `${parsed.endYear} Spring Semester` : `${yearName} Spring Semester`;
    case "summer":
      return parsed ? `${parsed.endYear} Summer` : `${yearName} Summer`;
  }
}

function pushSemester(
  out: ComputableAcademicSemester[],
  year: AcademicYearForSemesters,
  season: AcademicSeason,
  from: string,
  to: string,
  startDate: Date,
  endDate: Date
) {
  out.push({
    academicYearId: year.id,
    yearName: year.name,
    season,
    name: formatAcademicSemesterName(season, year.name),
    from,
    to,
    startDate,
    endDate,
    sortKey: `${from}:${SEASON_ORDER[season]}`,
  });
}

/** Build dropdown-ready semesters from academic years (only those with full date ranges). */
export function listComputableAcademicSemesters(
  years: AcademicYearForSemesters[]
): ComputableAcademicSemester[] {
  const out: ComputableAcademicSemester[] = [];

  for (const year of years) {
    const next = findNextAcademicYear(years, year);
    const nextFall = next?.fall ?? null;

    const fall = deriveFallSemesterRange(year.fall);
    if (fall) {
      pushSemester(out, year, "fall", fall.from, fall.to, fall.startDate, fall.endDate);
    }

    const winter = deriveWinterBreakRange(year.fall, year.spring);
    if (winter.kind === "ready") {
      const startDate = parseDashboardDateStart(winter.start)!;
      const endDate = parseDashboardDateEnd(winter.end)!;
      pushSemester(out, year, "winter", winter.start, winter.end, startDate, endDate);
    }

    const spring = deriveSpringSemesterRange(year.spring);
    if (spring) {
      pushSemester(out, year, "spring", spring.from, spring.to, spring.startDate, spring.endDate);
    }

    const summer = deriveSummerRange(year.spring, nextFall, next?.name ?? null);
    if (summer.kind === "ready") {
      const startDate = parseDashboardDateStart(summer.start)!;
      const endDate = parseDashboardDateEnd(summer.end)!;
      pushSemester(out, year, "summer", summer.start, summer.end, startDate, endDate);
    }
  }

  return out.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function academicSemesterKey(academicYearId: number, season: AcademicSeason): string {
  return `${academicYearId}:${season}`;
}

export function parseAcademicSemesterKey(
  key: string
): { academicYearId: number; season: AcademicSeason } | null {
  const match = /^(\d+):(fall|winter|spring|summer)$/.exec(key.trim());
  if (!match) return null;
  return { academicYearId: Number(match[1]), season: match[2] as AcademicSeason };
}

/** Stable id-independent match helper for tests / debugging. */
export function formatSemesterDateRange(from: string, to: string): string {
  return `${formatDashboardDate(parseDashboardDateStart(from)!)} → ${formatDashboardDate(parseDashboardDateEnd(to)!)}`;
}
