import { db } from "@/lib/db";
import {
  attendances,
  events,
  groupings,
  staff,
  students,
  views,
  type GroupingContainerData,
} from "../../drizzle/schema";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { formatDashboardDate } from "@/lib/dashboard-date-range";
import { formatGroupingEventSelection } from "@/lib/grouping-events";
import { getStudentStatuses, type GroupingStudentStatus } from "@/lib/grouping-status";
import { normalizeGroupingContainers, emptyGroupingContainers } from "@/lib/grouping-containers";

export type GroupingListItem = {
  id: number;
  name: string;
  viewId: number;
  viewName: string;
  eventSelectionLabel: string;
};

function normalizeCheckedEventIdsFromDb(
  raw: number[] | null | undefined,
  createdAt: Date,
  updatedAt: Date
): number[] | null {
  if (raw === null || raw === undefined) return null;
  if (Array.isArray(raw) && raw.length === 0 && createdAt.getTime() === updatedAt.getTime()) {
    // Legacy rows stored [] on create before null meant "all events"
    return null;
  }
  return raw;
}

export type GroupingEventItem = {
  id: number;
  name: string;
  type: string | null;
  startDate: Date;
};

export type GroupingStaffItem = {
  id: number;
  firstName: string;
  lastName: string | null;
  gender: "M" | "F" | null;
};

export type GroupingStudentItem = {
  id: number;
  firstName: string;
  lastName: string | null;
  gender: "M" | "F" | null;
  year: "freshman" | "sophomore" | "junior" | "senior" | "grad" | "other" | null;
  courseMaterial: string[] | null;
  newsletter: boolean;
  groupme: boolean;
  attendedEventIds: number[];
  attendanceCountInRange: number;
  attendedEventTypesInRange: string[];
  statuses: GroupingStudentStatus[];
};

export type GroupingDetail = {
  id: number;
  name: string;
  viewId: number;
  viewName: string;
  viewFrom: string;
  viewTo: string;
  /** null = all events in the view; [] = none; otherwise specific event ids */
  checkedEventIds: number[] | null;
  containers: GroupingContainerData[];
};

export { emptyGroupingContainers } from "@/lib/grouping-containers";

export async function listGroupings(): Promise<GroupingListItem[]> {
  const rows = await db
    .select({
      id: groupings.id,
      name: groupings.name,
      viewId: groupings.viewId,
      viewName: views.name,
      checkedEventIds: groupings.checkedEventIds,
      createdAt: groupings.createdAt,
      updatedAt: groupings.updatedAt,
    })
    .from(groupings)
    .innerJoin(views, eq(groupings.viewId, views.id))
    .orderBy(asc(groupings.name));

  const singleEventIds = [
    ...new Set(
      rows
        .map((row) =>
          normalizeCheckedEventIdsFromDb(row.checkedEventIds, row.createdAt, row.updatedAt)
        )
        .filter((ids): ids is number[] => Array.isArray(ids) && ids.length === 1)
        .map((ids) => ids[0])
    ),
  ];

  const eventNameRows =
    singleEventIds.length > 0
      ? await db
          .select({ id: events.id, name: events.name })
          .from(events)
          .where(inArray(events.id, singleEventIds))
      : [];

  const eventNameById = new Map(eventNameRows.map((event) => [event.id, event.name]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    viewId: row.viewId,
    viewName: row.viewName,
    eventSelectionLabel: formatGroupingEventSelection(
      normalizeCheckedEventIdsFromDb(row.checkedEventIds, row.createdAt, row.updatedAt),
      eventNameById
    ),
  }));
}

export async function getGroupingById(id: number): Promise<GroupingDetail | null> {
  const [row] = await db
    .select({
      grouping: groupings,
      viewName: views.name,
      viewStart: views.startDate,
      viewEnd: views.endDate,
    })
    .from(groupings)
    .innerJoin(views, eq(groupings.viewId, views.id))
    .where(eq(groupings.id, id))
    .limit(1);

  if (!row) return null;

  return {
    id: row.grouping.id,
    name: row.grouping.name,
    viewId: row.grouping.viewId,
    viewName: row.viewName,
    viewFrom: formatDashboardDate(row.viewStart),
    viewTo: formatDashboardDate(row.viewEnd),
    checkedEventIds: normalizeCheckedEventIdsFromDb(
      row.grouping.checkedEventIds,
      row.grouping.createdAt,
      row.grouping.updatedAt
    ),
    containers: normalizeGroupingContainers(row.grouping.containers),
  };
}

export async function getFirstGrouping(): Promise<GroupingDetail | null> {
  const [row] = await db.select({ id: groupings.id }).from(groupings).orderBy(asc(groupings.id)).limit(1);
  return row ? getGroupingById(row.id) : null;
}

export async function getEventsForView(viewId: number): Promise<GroupingEventItem[]> {
  const [view] = await db.select().from(views).where(eq(views.id, viewId)).limit(1);
  if (!view) return [];

  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      type: events.type,
      startDate: events.startDate,
    })
    .from(events)
    .where(and(gte(events.startDate, view.startDate), lte(events.startDate, view.endDate)))
    .orderBy(events.startDate);

  return rows;
}

export async function getStudentsForView(viewId: number): Promise<GroupingStudentItem[]> {
  const [view] = await db.select().from(views).where(eq(views.id, viewId)).limit(1);
  if (!view) return [];

  const eventDateRange = and(gte(events.startDate, view.startDate), lte(events.startDate, view.endDate));

  const attendanceRows = await db
    .select({
      studentId: attendances.studentId,
      eventId: events.id,
      eventType: events.type,
    })
    .from(attendances)
    .innerJoin(events, eq(attendances.eventId, events.id))
    .where(eventDateRange);

  const countRows = await db
    .select({
      studentId: attendances.studentId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(attendances)
    .innerJoin(events, eq(attendances.eventId, events.id))
    .where(eventDateRange)
    .groupBy(attendances.studentId);

  const studentIds = [...new Set(attendanceRows.map((row) => row.studentId))];
  if (studentIds.length === 0) return [];

  const studentRows = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      gender: students.gender,
      year: students.year,
      courseMaterial: students.courseMaterial,
      newsletter: students.newsletter,
      groupme: students.groupme,
    })
    .from(students)
    .where(inArray(students.id, studentIds));

  const eventsByStudent = new Map<number, number[]>();
  const typesByStudent = new Map<number, Set<string>>();
  for (const row of attendanceRows) {
    const eventIds = eventsByStudent.get(row.studentId) ?? [];
    if (!eventIds.includes(row.eventId)) eventIds.push(row.eventId);
    eventsByStudent.set(row.studentId, eventIds);

    const types = typesByStudent.get(row.studentId) ?? new Set<string>();
    if (row.eventType) types.add(row.eventType);
    typesByStudent.set(row.studentId, types);
  }

  const countByStudent = new Map(countRows.map((row) => [row.studentId, Number(row.count)]));

  return studentRows
    .map((student) => {
      const attendedEventTypesInRange = [...(typesByStudent.get(student.id) ?? new Set<string>())];
      const attendanceCountInRange = countByStudent.get(student.id) ?? 0;
      const statuses = getStudentStatuses({
        courseMaterial: student.courseMaterial,
        attendanceCountInRange,
        attendedEventTypesInRange,
      });

      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.gender,
        year: student.year,
        courseMaterial: student.courseMaterial,
        newsletter: student.newsletter,
        groupme: student.groupme,
        attendedEventIds: eventsByStudent.get(student.id) ?? [],
        attendanceCountInRange,
        attendedEventTypesInRange,
        statuses,
      };
    })
    .sort((a, b) => {
      const aName = `${a.firstName} ${a.lastName ?? ""}`.trim();
      const bName = `${b.firstName} ${b.lastName ?? ""}`.trim();
      return aName.localeCompare(bName);
    });
}

export async function getAllStaff(): Promise<GroupingStaffItem[]> {
  const rows = await db
    .select({
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      gender: staff.gender,
    })
    .from(staff)
    .orderBy(staff.firstName);

  return rows;
}
