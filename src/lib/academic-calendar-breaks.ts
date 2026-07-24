import {
  formatDashboardDate,
  formatDashboardDateLabel,
  parseDashboardDateStart,
} from "@/lib/dashboard-date-range";
import { parseAcademicYearName } from "@/lib/semester-planning";
import type { AcademicSemesterData } from "../../drizzle/schema";

const DAY_MS = 86400_000;

export type DerivedDateRange =
  | { kind: "ready"; start: string; end: string; label: string }
  | { kind: "missing"; missing: string[] };

export function shiftIsoDate(iso: string, days: number): string | null {
  const start = parseDashboardDateStart(iso);
  if (!start) return null;
  const shifted = new Date(start.getTime() + days * DAY_MS);
  return formatDashboardDate(shifted);
}

function formatRangeLabel(start: string, end: string): string {
  const startDate = parseDashboardDateStart(start);
  const endDate = parseDashboardDateStart(end);
  if (!startDate || !endDate) return `${start} – ${end}`;
  return `${formatDashboardDateLabel(startDate)} – ${formatDashboardDateLabel(endDate)}`;
}

function buildDerivedRange(
  start: string | null,
  end: string | null,
  missing: string[]
): DerivedDateRange {
  if (missing.length > 0 || !start || !end) {
    return { kind: "missing", missing };
  }
  if (start > end) {
    return {
      kind: "missing",
      missing: [
        "The derived start date is after the end date. Check the related semester dates.",
      ],
    };
  }
  return { kind: "ready", start, end, label: formatRangeLabel(start, end) };
}

/** Day after Fall finals end → day before Spring classes begin. */
export function deriveWinterBreakRange(
  fall: AcademicSemesterData,
  spring: AcademicSemesterData
): DerivedDateRange {
  const missing: string[] = [];
  if (!fall.finalExamsEnd) {
    missing.push("Fall Semester final exams end date");
  }
  if (!spring.classesBegin) {
    missing.push("Spring Semester when classes begin");
  }

  const start = fall.finalExamsEnd ? shiftIsoDate(fall.finalExamsEnd, 1) : null;
  const end = spring.classesBegin ? shiftIsoDate(spring.classesBegin, -1) : null;
  if (fall.finalExamsEnd && !start) missing.push("a valid Fall Semester final exams end date");
  if (spring.classesBegin && !end) missing.push("a valid Spring Semester classes begin date");

  return buildDerivedRange(start, end, missing);
}

/**
 * Day after Spring finals end → day before next Fall new-students move-in.
 * `nextFall` is the Fall semester of the following academic year.
 */
export function deriveSummerRange(
  spring: AcademicSemesterData,
  nextFall: AcademicSemesterData | null,
  nextYearName: string | null
): DerivedDateRange {
  const missing: string[] = [];
  if (!spring.finalExamsEnd) {
    missing.push("Spring Semester final exams end date");
  }
  if (!nextFall) {
    missing.push(
      nextYearName
        ? `academic year ${nextYearName}`
        : "the next academic year (so Fall new-students move-in can be read)"
    );
  } else if (!nextFall.newStudentsMoveIn) {
    missing.push(
      nextYearName
        ? `${nextYearName} Fall Semester new students move-in date`
        : "next Fall Semester new students move-in date"
    );
  }

  const start = spring.finalExamsEnd ? shiftIsoDate(spring.finalExamsEnd, 1) : null;
  const end =
    nextFall?.newStudentsMoveIn != null
      ? shiftIsoDate(nextFall.newStudentsMoveIn, -1)
      : null;
  if (spring.finalExamsEnd && !start) {
    missing.push("a valid Spring Semester final exams end date");
  }
  if (nextFall?.newStudentsMoveIn && !end) {
    missing.push("a valid next Fall new students move-in date");
  }

  return buildDerivedRange(start, end, missing);
}

export type YearNameId = { id: number; name: string };

/** Prefer year whose start matches this year's end (e.g. 2025-26 → 2026-27). */
export function findNextAcademicYear<T extends YearNameId>(
  years: T[],
  current: YearNameId
): T | null {
  const parsed = parseAcademicYearName(current.name);
  if (parsed) {
    const byParsed = years.find((year) => {
      if (year.id === current.id) return false;
      const other = parseAcademicYearName(year.name);
      return other != null && other.startYear === parsed.endYear;
    });
    if (byParsed) return byParsed;
  }

  const sorted = [...years].sort((a, b) => a.name.localeCompare(b.name));
  const index = sorted.findIndex((year) => year.id === current.id);
  if (index < 0 || index >= sorted.length - 1) return null;
  return sorted[index + 1] ?? null;
}
