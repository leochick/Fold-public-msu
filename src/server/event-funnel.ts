import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendances, events } from "../../drizzle/schema";
import {
  parseDashboardDateEnd,
  parseDashboardDateStart,
} from "@/lib/dashboard-date-range";
import {
  buildEventFunnelPayload,
  type EventFunnelFirstEvent,
  type EventFunnelPayload,
  type EventFunnelSemester,
} from "@/lib/event-funnel";
import type { DashboardViewItem } from "@/server/dashboard-views";

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

  const firstEventRows: EventFunnelFirstEvent[] =
    studentIds.length === 0
      ? []
      : (
          await db
            .select({
              studentId: attendances.studentId,
              eventId: events.id,
              name: events.name,
              startDate: events.startDate,
            })
            .from(attendances)
            .innerJoin(events, eq(attendances.eventId, events.id))
            .where(inArray(attendances.studentId, studentIds))
        ).map((row) => ({
          studentId: row.studentId,
          eventId: row.eventId,
          name: row.name,
          startMs: toMs(row.startDate),
        }));

  return buildEventFunnelPayload({
    events: semesterEvents.map((event) => ({
      id: event.id,
      name: event.name,
      startMs: toMs(event.startDate),
    })),
    attendances: semesterAttendances,
    firstEvents: firstEventRows,
    current: { fromMs: params.from.getTime(), toMs: params.to.getTime() },
    semesters: semesterWindowsFromViews(params.semesters),
    dateLabel: eventDateLabel,
  });
}
