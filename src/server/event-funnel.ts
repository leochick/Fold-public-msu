import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendances, events, students } from "../../drizzle/schema";
import {
  parseDashboardDateEnd,
  parseDashboardDateStart,
} from "@/lib/dashboard-date-range";
import {
  buildEventFunnelPayload,
  type EventFunnelBreakdown,
  type EventFunnelFirstEvent,
  type EventFunnelPayload,
  type EventFunnelSemester,
} from "@/lib/event-funnel";
import { listDashboardViews, type DashboardViewItem } from "@/server/dashboard-views";

function toMs(value: Date | string | number): number {
  return new Date(value).getTime();
}

function eventDateLabel(startMs: number): string {
  return new Date(startMs).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

async function loadStudentFunnelContext(studentIds: number[]): Promise<{
  firstEvents: EventFunnelFirstEvent[];
  studentNames: Map<number, string>;
}> {
  if (studentIds.length === 0) {
    return { firstEvents: [], studentNames: new Map() };
  }

  const [firstRows, nameRows] = await Promise.all([
    db
      .select({
        studentId: attendances.studentId,
        eventId: events.id,
        name: events.name,
        startDate: events.startDate,
      })
      .from(attendances)
      .innerJoin(events, eq(attendances.eventId, events.id))
      .where(inArray(attendances.studentId, studentIds)),
    db
      .select({
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
      })
      .from(students)
      .where(inArray(students.id, studentIds)),
  ]);

  return {
    firstEvents: firstRows.map((row) => ({
      studentId: row.studentId,
      eventId: row.eventId,
      name: row.name,
      startMs: toMs(row.startDate),
    })),
    studentNames: new Map(
      nameRows.map((row) => [row.id, `${row.firstName} ${row.lastName ?? ""}`.trim()])
    ),
  };
}

export function semesterWindowsFromViews(views: DashboardViewItem[]): EventFunnelSemester[] {
  return views.flatMap((view) => {
    const from = parseDashboardDateStart(view.from);
    const to = parseDashboardDateEnd(view.to);
    if (!from || !to) return [];
    return [{ name: view.name, fromMs: from.getTime(), toMs: to.getTime() }];
  });
}

export async function loadEventFunnelPayload(params: {
  from: Date;
  to: Date;
  semesters: DashboardViewItem[];
}): Promise<EventFunnelPayload> {
  const eventDateRange = and(gte(events.startDate, params.from), lte(events.startDate, params.to));

  const semesterEvents = await db
    .select({
      id: events.id,
      name: events.name,
      startDate: events.startDate,
    })
    .from(events)
    .where(eventDateRange)
    .orderBy(events.startDate);

  if (semesterEvents.length === 0) {
    return { events: [], byEventId: {} };
  }

  const semesterAttendances = await db
    .select({
      studentId: attendances.studentId,
      eventId: attendances.eventId,
    })
    .from(attendances)
    .innerJoin(events, eq(attendances.eventId, events.id))
    .where(eventDateRange);

  const studentIds = [...new Set(semesterAttendances.map((row) => row.studentId))];
  const { firstEvents, studentNames } = await loadStudentFunnelContext(studentIds);

  return buildEventFunnelPayload({
    events: semesterEvents.map((event) => ({
      id: event.id,
      name: event.name,
      startMs: toMs(event.startDate),
    })),
    attendances: semesterAttendances,
    firstEvents,
    current: { fromMs: params.from.getTime(), toMs: params.to.getTime() },
    semesters: semesterWindowsFromViews(params.semesters),
    dateLabel: eventDateLabel,
    studentNames,
  });
}

export async function loadEventFunnelForEvent(event: {
  id: number;
  name: string;
  startDate: Date;
}): Promise<EventFunnelBreakdown> {
  const semesters = await listDashboardViews();
  const startMs = toMs(event.startDate);
  const windows = semesterWindowsFromViews(semesters);
  const containing = windows.find((window) => startMs >= window.fromMs && startMs <= window.toMs);
  const current = containing
    ? { fromMs: containing.fromMs, toMs: containing.toMs }
    : { fromMs: startMs, toMs: startMs };

  const attendanceRows = await db
    .select({
      studentId: attendances.studentId,
      eventId: attendances.eventId,
    })
    .from(attendances)
    .where(eq(attendances.eventId, event.id));

  const studentIds = [...new Set(attendanceRows.map((row) => row.studentId))];
  const { firstEvents, studentNames } = await loadStudentFunnelContext(studentIds);
  const payload = buildEventFunnelPayload({
    events: [{ id: event.id, name: event.name, startMs }],
    attendances: attendanceRows,
    firstEvents,
    current,
    semesters: windows,
    dateLabel: eventDateLabel,
    studentNames,
  });

  return payload.byEventId[String(event.id)] ?? { total: 0, sources: [] };
}
