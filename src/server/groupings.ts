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
import { and, asc, eq, gte, inArray, lte, notInArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { formatDashboardDate } from "@/lib/dashboard-date-range";
import { formatGroupingEventSelection } from "@/lib/grouping-events";
import { getStudentStatuses, type GroupingStudentStatus } from "@/lib/grouping-status";
import { normalizeGroupingContainers, emptyGroupingContainers } from "@/lib/grouping-containers";

const eventAndStudentDataViews = alias(views, "event_and_student_data_views");

export type GroupingListItem = {
  id: number;
  name: string;
  viewId: number;
  viewName: string;
  eventAndStudentDataView: number | null;
  eventAndStudentDataViewName: string | null;
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
  startingDate: Date | null;
  endingDate: Date | null;
  /** True when staff dates overlap the current view (for unassigned pool filtering). */
  activeInView: boolean;
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
  /** When set, events/students come from this view instead of viewId. */
  eventAndStudentDataView: number | null;
  eventAndStudentDataViewName: string | null;
  /** null = all non-tabling events in the view; [] = none; otherwise specific event ids */
  checkedEventIds: number[] | null;
  includeNewsletterContacts: boolean;
  containers: GroupingContainerData[];
};

/** View id used for loading events and students for a grouping. */
export function getGroupingDataViewId(grouping: {
  viewId: number;
  eventAndStudentDataView: number | null;
}): number {
  return grouping.eventAndStudentDataView ?? grouping.viewId;
}

export { emptyGroupingContainers } from "@/lib/grouping-containers";

export async function listGroupings(viewId?: number): Promise<GroupingListItem[]> {
  const rows = await db
    .select({
      id: groupings.id,
      name: groupings.name,
      viewId: groupings.viewId,
      viewName: views.name,
      eventAndStudentDataView: groupings.eventAndStudentDataView,
      eventAndStudentDataViewName: eventAndStudentDataViews.name,
      checkedEventIds: groupings.checkedEventIds,
      createdAt: groupings.createdAt,
      updatedAt: groupings.updatedAt,
    })
    .from(groupings)
    .innerJoin(views, eq(groupings.viewId, views.id))
    .leftJoin(
      eventAndStudentDataViews,
      eq(groupings.eventAndStudentDataView, eventAndStudentDataViews.id)
    )
    .where(viewId != null ? eq(groupings.viewId, viewId) : undefined)
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

  return rows.map((row) => {
    const dataViewId =
      row.eventAndStudentDataView != null && row.eventAndStudentDataView !== row.viewId
        ? row.eventAndStudentDataView
        : null;
    return {
      id: row.id,
      name: row.name,
      viewId: row.viewId,
      viewName: row.viewName,
      eventAndStudentDataView: dataViewId,
      eventAndStudentDataViewName: dataViewId != null ? row.eventAndStudentDataViewName : null,
      eventSelectionLabel: formatGroupingEventSelection(
        normalizeCheckedEventIdsFromDb(row.checkedEventIds, row.createdAt, row.updatedAt),
        eventNameById
      ),
    };
  });
}

export async function getGroupingById(id: number): Promise<GroupingDetail | null> {
  const [row] = await db
    .select({
      grouping: groupings,
      viewName: views.name,
      viewStart: views.startDate,
      viewEnd: views.endDate,
      eventAndStudentDataViewName: eventAndStudentDataViews.name,
    })
    .from(groupings)
    .innerJoin(views, eq(groupings.viewId, views.id))
    .leftJoin(
      eventAndStudentDataViews,
      eq(groupings.eventAndStudentDataView, eventAndStudentDataViews.id)
    )
    .where(eq(groupings.id, id))
    .limit(1);

  if (!row) return null;

  const dataViewId =
    row.grouping.eventAndStudentDataView != null &&
    row.grouping.eventAndStudentDataView !== row.grouping.viewId
      ? row.grouping.eventAndStudentDataView
      : null;

  return {
    id: row.grouping.id,
    name: row.grouping.name,
    viewId: row.grouping.viewId,
    viewName: row.viewName,
    viewFrom: formatDashboardDate(row.viewStart),
    viewTo: formatDashboardDate(row.viewEnd),
    eventAndStudentDataView: dataViewId,
    eventAndStudentDataViewName: dataViewId != null ? row.eventAndStudentDataViewName : null,
    checkedEventIds: normalizeCheckedEventIdsFromDb(
      row.grouping.checkedEventIds,
      row.grouping.createdAt,
      row.grouping.updatedAt
    ),
    includeNewsletterContacts: row.grouping.includeNewsletterContacts,
    containers: normalizeGroupingContainers(row.grouping.containers),
  };
}

export async function getFirstGrouping(viewId?: number): Promise<GroupingDetail | null> {
  const [row] = await db
    .select({ id: groupings.id })
    .from(groupings)
    .where(viewId != null ? eq(groupings.viewId, viewId) : undefined)
    .orderBy(asc(groupings.id))
    .limit(1);
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

  const attendanceStudentIds = [...new Set(attendanceRows.map((row) => row.studentId))];

  const studentSelect = {
    id: students.id,
    firstName: students.firstName,
    lastName: students.lastName,
    gender: students.gender,
    year: students.year,
    courseMaterial: students.courseMaterial,
    newsletter: students.newsletter,
    groupme: students.groupme,
  };

  const attendedStudentRows =
    attendanceStudentIds.length > 0
      ? await db.select(studentSelect).from(students).where(inArray(students.id, attendanceStudentIds))
      : [];

  const newsletterOnlyRows = await db
    .select(studentSelect)
    .from(students)
    .where(
      and(
        eq(students.newsletter, true),
        attendanceStudentIds.length > 0
          ? notInArray(students.id, attendanceStudentIds)
          : undefined
      )
    );

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

  const mapStudent = (
    student: (typeof attendedStudentRows)[number],
    opts: { attended: boolean }
  ): GroupingStudentItem => {
    const attendedEventTypesInRange = opts.attended
      ? [...(typesByStudent.get(student.id) ?? new Set<string>())]
      : [];
    const attendanceCountInRange = opts.attended ? (countByStudent.get(student.id) ?? 0) : 0;
    const statuses = getStudentStatuses({
      courseMaterial: student.courseMaterial,
      attendanceCountInRange,
      attendedEventTypesInRange,
      newsletter: student.newsletter,
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
      attendedEventIds: opts.attended ? (eventsByStudent.get(student.id) ?? []) : [],
      attendanceCountInRange,
      attendedEventTypesInRange,
      statuses,
    };
  };

  return [
    ...attendedStudentRows.map((student) => mapStudent(student, { attended: true })),
    ...newsletterOnlyRows.map((student) => mapStudent(student, { attended: false })),
  ].sort((a, b) => {
    const aName = `${a.firstName} ${a.lastName ?? ""}`.trim();
    const bName = `${b.firstName} ${b.lastName ?? ""}`.trim();
    return aName.localeCompare(bName);
  });
}

export async function getAllStaff(): Promise<Omit<GroupingStaffItem, "activeInView">[]> {
  return db
    .select({
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      gender: staff.gender,
      startingDate: staff.startingDate,
      endingDate: staff.endingDate,
    })
    .from(staff)
    .orderBy(staff.firstName);
}
