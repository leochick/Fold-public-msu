import {
  parseDashboardDateEnd,
  parseDashboardDateStart,
} from "@/lib/dashboard-date-range";
import {
  getWeekEnd,
  getWeekStart,
  semesterLabel,
  semesterSortYear,
  SEMESTER_WEEK_MAX,
  weekNumberForDate,
  type SemesterSeason,
} from "@/lib/semester-planning";
import type { AcademicSemesterData } from "../../drizzle/schema";

export type AttendanceTrendGender = "M" | "F";
export type AttendanceTrendYear = "freshman" | "sophomore" | "junior" | "senior";

export const ATTENDANCE_TREND_GENDERS: Array<{
  value: AttendanceTrendGender;
  label: string;
}> = [
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
];

export const ATTENDANCE_TREND_YEARS: Array<{
  value: AttendanceTrendYear;
  label: string;
}> = [
  { value: "freshman", label: "Freshman" },
  { value: "sophomore", label: "Sophomore" },
  { value: "junior", label: "Junior" },
  { value: "senior", label: "Senior" },
];

export type AttendanceTrendsFilters = {
  eventTypes: string[];
  genders: AttendanceTrendGender[];
  years: AttendanceTrendYear[];
};

export const EMPTY_ATTENDANCE_TRENDS_FILTERS: AttendanceTrendsFilters = {
  eventTypes: [],
  genders: [],
  years: [],
};

export type AttendanceTrendSemesterInput = {
  academicYearId: number;
  yearName: string;
  season: SemesterSeason;
  semester: AcademicSemesterData;
};

export type AttendanceTrendEventInput = {
  id: number;
  name: string;
  startDate: Date;
  type: string | null;
  totalStudents: number | null;
};

export type AttendanceTrendRecordInput = {
  eventId: number;
  studentId: number;
  gender: AttendanceTrendGender | null;
  year: string | null;
};

export type AttendanceTrendSeries = {
  key: string;
  label: string;
  sortYear: number;
};

export type AttendanceTrendsChartPoint = {
  week: number;
  weekLabel: string;
} & Record<string, string | number | boolean | null>;

/** Chart-point field set when a multi-event week cannot fully de-duplicate reported attendance. */
export function attendanceTrendIncompleteKey(seriesKey: string): string {
  return `${seriesKey}Incomplete`;
}

export type AttendanceTrendChartEvent = {
  id: number;
  name: string;
  type: string | null;
  startDate: string;
};

export type AttendanceTrendsChart = {
  weeks: number[];
  series: AttendanceTrendSeries[];
  points: AttendanceTrendsChartPoint[];
  /** Series key, then week index: events that contribute to that point. */
  eventsBySeries: Record<string, AttendanceTrendChartEvent[][]>;
};

/** Split tooltip blocks into two columns, keeping a year heading with the events that follow it. */
export function splitAttendanceTooltipColumns<T extends { kind: "header" | "event" }>(
  items: readonly T[]
): [T[], T[]] {
  if (items.length < 2) return [items.slice(), []];
  let split = Math.ceil(items.length / 2);
  if (items[split - 1]?.kind === "header") split -= 1;
  if (split < 1) split = 1;
  return [items.slice(0, split), items.slice(split)];
}

export function parseAttendanceTrendsSeason(value: string | undefined): SemesterSeason {
  return value === "spring" ? "spring" : "fall";
}

export function lastWeekNumberForSemester(
  classesBegin: Date,
  semester: Pick<AcademicSemesterData, "classesEnd" | "finalExamsEnd">
): number {
  const endIso = semester.finalExamsEnd ?? semester.classesEnd;
  if (!endIso) return SEMESTER_WEEK_MAX;

  const end = parseDashboardDateEnd(endIso);
  if (!end) return SEMESTER_WEEK_MAX;

  const week = weekNumberForDate(classesBegin, end);
  if (week != null) return week;

  const week0Start = getWeekStart(classesBegin, 0);
  if (end < week0Start) return 0;
  return SEMESTER_WEEK_MAX;
}

function eventMatchesType(
  event: AttendanceTrendEventInput,
  filters: AttendanceTrendsFilters
): boolean {
  if (filters.eventTypes.length === 0) return true;
  const type = event.type?.trim();
  return Boolean(type && filters.eventTypes.includes(type));
}

function recordMatchesFilters(
  record: AttendanceTrendRecordInput,
  filters: AttendanceTrendsFilters
): boolean {
  if (filters.genders.length > 0) {
    if (!record.gender || !filters.genders.includes(record.gender)) return false;
  }
  if (filters.years.length > 0) {
    if (!record.year || !filters.years.includes(record.year as AttendanceTrendYear)) {
      return false;
    }
  }
  return true;
}

function demographicFiltersActive(filters: AttendanceTrendsFilters): boolean {
  return filters.genders.length > 0 || filters.years.length > 0;
}

function eventContributesToPoint(
  records: AttendanceTrendRecordInput[],
  matching: AttendanceTrendRecordInput[],
  filters: AttendanceTrendsFilters
): boolean {
  if (matching.length > 0) return true;
  return records.length === 0 && !demographicFiltersActive(filters);
}

function chartEvent(event: AttendanceTrendEventInput): AttendanceTrendChartEvent {
  const name = event.name.trim();
  return {
    id: event.id,
    name: name || "Untitled event",
    type: event.type,
    startDate: event.startDate.toISOString(),
  };
}

type WeekEventAttendance = {
  event: AttendanceTrendEventInput;
  /** Distinct associated students that count toward this point. */
  studentIds: number[];
};

function distinctStudentIds(records: AttendanceTrendRecordInput[]): number[] {
  return [...new Set(records.map((record) => record.studentId))];
}

/** Reported headcount when the event has one. Otherwise the associated-student count. */
function reportedHeadcount(event: AttendanceTrendEventInput, studentIds: readonly number[]): number {
  if (event.totalStudents != null && Number.isFinite(event.totalStudents)) return event.totalStudents;
  return studentIds.length;
}

/**
 * True when the reported headcount agrees with the associated students.
 * Events with no reported headcount are treated as captured, because the count is those students.
 */
function reportedHeadcountMatchesAssociated(
  event: AttendanceTrendEventInput,
  studentIds: readonly number[]
): boolean {
  if (event.totalStudents == null || !Number.isFinite(event.totalStudents)) return true;
  return event.totalStudents === studentIds.length;
}

/**
 * Attendance for the events in one week.
 *
 * One event uses the reported headcount. Several events sum those headcounts and subtract
 * students known to appear at more than one of them. That point is incomplete when a
 * reported headcount does not match the students associated with that event, so the
 * overlap cannot be fully removed.
 *
 * Gender and year filters count distinct matching students instead, because reported
 * headcounts are not split by those fields.
 */
function summarizeWeek(
  events: AttendanceTrendEventInput[],
  recordsByEvent: Map<number, AttendanceTrendRecordInput[]>,
  filters: AttendanceTrendsFilters
): { count: number; events: AttendanceTrendChartEvent[]; incomplete: boolean } {
  const contributing: WeekEventAttendance[] = [];

  for (const event of events) {
    const records = recordsByEvent.get(event.id) ?? [];
    const matching = records.filter((record) => recordMatchesFilters(record, filters));
    if (!eventContributesToPoint(records, matching, filters)) continue;
    contributing.push({ event, studentIds: distinctStudentIds(matching) });
  }

  contributing.sort(
    (a, b) =>
      a.event.startDate.getTime() - b.event.startDate.getTime() ||
      a.event.name.localeCompare(b.event.name)
  );

  const chartEvents = contributing.map((row) => chartEvent(row.event));
  if (contributing.length === 0) {
    return { count: 0, events: chartEvents, incomplete: false };
  }

  if (demographicFiltersActive(filters)) {
    const studentIds = new Set<number>();
    for (const row of contributing) {
      for (const studentId of row.studentIds) studentIds.add(studentId);
    }
    return { count: studentIds.size, events: chartEvents, incomplete: false };
  }

  const only = contributing[0];
  if (contributing.length === 1 && only) {
    return {
      count: reportedHeadcount(only.event, only.studentIds),
      events: chartEvents,
      incomplete: false,
    };
  }

  let reportedSum = 0;
  let incomplete = false;
  const appearances = new Map<number, number>();
  for (const row of contributing) {
    reportedSum += reportedHeadcount(row.event, row.studentIds);
    if (!reportedHeadcountMatchesAssociated(row.event, row.studentIds)) incomplete = true;
    for (const studentId of row.studentIds) {
      appearances.set(studentId, (appearances.get(studentId) ?? 0) + 1);
    }
  }

  let duplicateAppearances = 0;
  for (const appearancesAtEvents of appearances.values()) {
    if (appearancesAtEvents > 1) duplicateAppearances += appearancesAtEvents - 1;
  }

  return {
    count: Math.max(0, reportedSum - duplicateAppearances),
    events: chartEvents,
    incomplete,
  };
}

export function buildAttendanceTrendsChart(args: {
  semesters: AttendanceTrendSemesterInput[];
  events: AttendanceTrendEventInput[];
  records: AttendanceTrendRecordInput[];
  filters?: AttendanceTrendsFilters;
}): AttendanceTrendsChart {
  const filters = args.filters ?? EMPTY_ATTENDANCE_TRENDS_FILTERS;
  const recordsByEvent = new Map<number, AttendanceTrendRecordInput[]>();
  for (const record of args.records) {
    const list = recordsByEvent.get(record.eventId) ?? [];
    list.push(record);
    recordsByEvent.set(record.eventId, list);
  }

  const prepared = args.semesters
    .map((entry) => {
      if (!entry.semester.classesBegin) return null;
      const classesBegin = parseDashboardDateStart(entry.semester.classesBegin);
      if (!classesBegin) return null;
      const lastWeek = lastWeekNumberForSemester(classesBegin, entry.semester);
      const week0Start = getWeekStart(classesBegin, 0);
      const lastWeekEnd = getWeekEnd(classesBegin, lastWeek);
      const events = args.events.filter(
        (event) => event.startDate >= week0Start && event.startDate <= lastWeekEnd
      );
      if (events.length === 0) return null;
      return {
        key: `year-${entry.academicYearId}`,
        label: semesterLabel(entry.season, entry.yearName),
        sortYear: semesterSortYear(entry.season, entry.yearName),
        classesBegin,
        lastWeek,
        events,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((a, b) => a.sortYear - b.sortYear || a.label.localeCompare(b.label));

  if (prepared.length === 0) {
    return { weeks: [], series: [], points: [], eventsBySeries: {} };
  }

  const maxWeek = Math.max(...prepared.map((entry) => entry.lastWeek));
  const weeks = Array.from({ length: maxWeek + 1 }, (_, week) => week);
  const series: AttendanceTrendSeries[] = prepared.map((entry) => ({
    key: entry.key,
    label: entry.label,
    sortYear: entry.sortYear,
  }));

  const valuesBySeries = new Map<string, Array<number | null>>();
  const incompleteBySeries = new Map<string, boolean[]>();
  const eventsBySeries: Record<string, AttendanceTrendChartEvent[][]> = {};
  for (const entry of prepared) {
    const eventsByWeek = new Map<number, AttendanceTrendEventInput[]>();
    for (const event of entry.events) {
      if (!eventMatchesType(event, filters)) continue;
      const week = weekNumberForDate(entry.classesBegin, event.startDate);
      if (week == null || week > entry.lastWeek) continue;
      const list = eventsByWeek.get(week) ?? [];
      list.push(event);
      eventsByWeek.set(week, list);
    }
    const summaries = weeks.map((week) => {
      if (week > entry.lastWeek) return null;
      return summarizeWeek(eventsByWeek.get(week) ?? [], recordsByEvent, filters);
    });
    valuesBySeries.set(
      entry.key,
      summaries.map((summary) => (summary == null ? null : summary.count))
    );
    incompleteBySeries.set(
      entry.key,
      summaries.map((summary) => summary?.incomplete ?? false)
    );
    eventsBySeries[entry.key] = summaries.map((summary) => summary?.events ?? []);
  }

  const points: AttendanceTrendsChartPoint[] = weeks.map((week) => {
    const point: AttendanceTrendsChartPoint = {
      week,
      weekLabel: `Week ${week}`,
    };
    for (const entry of prepared) {
      point[entry.key] = valuesBySeries.get(entry.key)?.[week] ?? null;
      point[attendanceTrendIncompleteKey(entry.key)] =
        incompleteBySeries.get(entry.key)?.[week] ?? false;
    }
    return point;
  });

  return { weeks, series, points, eventsBySeries };
}
