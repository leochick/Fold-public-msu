import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendances, events, students } from "../../drizzle/schema";
import { parseDashboardDateStart } from "@/lib/dashboard-date-range";
import {
  getWeekEnd,
  getWeekStart,
  type SemesterSeason,
} from "@/lib/semester-planning";
import { lastWeekNumberForSemester } from "@/lib/attendance-trends";
import { listAcademicYearDetails } from "@/server/academic-calendar";

export type AttendanceTrendsSemesterPayload = {
  academicYearId: number;
  yearName: string;
  season: SemesterSeason;
  classesBegin: string;
  classesEnd: string | null;
  finalExamsEnd: string | null;
};

export type AttendanceTrendsEventPayload = {
  id: number;
  startDate: string;
  type: string | null;
  totalStudents: number | null;
};

export type AttendanceTrendsRecordPayload = {
  eventId: number;
  gender: "M" | "F" | null;
  year: string | null;
};

export type AttendanceTrendsPayload = {
  season: SemesterSeason;
  eventTypes: string[];
  semesters: AttendanceTrendsSemesterPayload[];
  events: AttendanceTrendsEventPayload[];
  records: AttendanceTrendsRecordPayload[];
};

export async function getAttendanceTrendsPayload(
  season: SemesterSeason
): Promise<AttendanceTrendsPayload> {
  const details = await listAcademicYearDetails();

  const semesters: AttendanceTrendsSemesterPayload[] = [];
  const rangeStarts: Date[] = [];
  const rangeEnds: Date[] = [];

  for (const year of details) {
    const semester = season === "fall" ? year.fall : year.spring;
    if (!semester.classesBegin) continue;
    const classesBegin = parseDashboardDateStart(semester.classesBegin);
    if (!classesBegin) continue;

    const lastWeek = lastWeekNumberForSemester(classesBegin, semester);
    rangeStarts.push(getWeekStart(classesBegin, 0));
    rangeEnds.push(getWeekEnd(classesBegin, lastWeek));
    semesters.push({
      academicYearId: year.id,
      yearName: year.name,
      season,
      classesBegin: semester.classesBegin,
      classesEnd: semester.classesEnd,
      finalExamsEnd: semester.finalExamsEnd,
    });
  }

  const typeRows = await db
    .select({ type: events.type })
    .from(events)
    .where(isNotNull(events.type))
    .groupBy(events.type);
  const eventTypes = typeRows
    .map((row) => row.type?.trim() ?? "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  if (semesters.length === 0) {
    return { season, eventTypes, semesters: [], events: [], records: [] };
  }

  const from = new Date(Math.min(...rangeStarts.map((d) => d.getTime())));
  const to = new Date(Math.max(...rangeEnds.map((d) => d.getTime())));

  const eventRows = await db
    .select({
      id: events.id,
      startDate: events.startDate,
      type: events.type,
      totalStudents: events.totalStudents,
    })
    .from(events)
    .where(and(gte(events.startDate, from), lte(events.startDate, to)))
    .orderBy(asc(events.startDate));

  const eventPayload: AttendanceTrendsEventPayload[] = eventRows.map((row) => ({
    id: row.id,
    startDate: new Date(row.startDate).toISOString(),
    type: row.type,
    totalStudents: row.totalStudents,
  }));

  const eventIds = eventPayload.map((row) => row.id);
  const recordRows =
    eventIds.length === 0
      ? []
      : await db
          .select({
            eventId: attendances.eventId,
            gender: students.gender,
            year: students.year,
          })
          .from(attendances)
          .innerJoin(students, eq(students.id, attendances.studentId))
          .where(inArray(attendances.eventId, eventIds));

  return {
    season,
    eventTypes,
    semesters,
    events: eventPayload,
    records: recordRows.map((row) => ({
      eventId: row.eventId,
      gender: row.gender,
      year: row.year,
    })),
  };
}
