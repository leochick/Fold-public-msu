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
} & Record<string, string | number | null>;

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

/** Distinct students at the week's events, plus the events that contribute to that count. */
function summarizeWeek(
  events: AttendanceTrendEventInput[],
  recordsByEvent: Map<number, AttendanceTrendRecordInput[]>,
  filters: AttendanceTrendsFilters
): { count: number; events: AttendanceTrendChartEvent[] } {
  const studentIds = new Set<number>();
  let unrecorded = 0;
  const contributing: AttendanceTrendEventInput[] = [];

  for (const event of events) {
    const records = recordsByEvent.get(event.id) ?? [];
    const matching = records.filter((record) => recordMatchesFilters(record, filters));
    if (!eventContributesToPoint(records, matching, filters)) continue;
    contributing.push(event);
    if (matching.length > 0) {
      for (const record of matching) studentIds.add(record.studentId);
    } else {
      unrecorded += event.totalStudents ?? 0;
    }
  }

  contributing.sort(
    (a, b) => a.startDate.getTime() - b.startDate.getTime() || a.name.localeCompare(b.name)
  );

  return {
    count: studentIds.size + unrecorded,
    events: contributing.map(chartEvent),
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
      summaries.map((summary) => summary?.count ?? null)
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
    }
    return point;
  });

  return { weeks, series, points, eventsBySeries };
}
