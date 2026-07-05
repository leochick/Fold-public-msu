import { db } from "@/lib/db";
import { changelogEntries, users } from "../../drizzle/schema";
import {
  describeFieldChanges,
  EVENT_CHANGE_FIELDS,
  EVENT_FIELD_LABELS,
  formatEventLabel,
  formatStudentLabel,
  STUDENT_CHANGE_FIELDS,
  STUDENT_FIELD_LABELS,
} from "@/lib/changelog";
import { desc, eq } from "drizzle-orm";
import type { Event, Student } from "../../drizzle/schema";

export type ChangelogEntryRow = {
  id: number;
  createdAt: string;
  userName: string | null;
  entityType: "student" | "event";
  entityId: number | null;
  action: "create" | "update" | "delete" | "merge";
  entityLabel: string;
  summary: string;
};

async function insertEntry(input: {
  userId?: string | null;
  entityType: "student" | "event";
  entityId?: number | null;
  action: "create" | "update" | "delete" | "merge";
  entityLabel: string;
  summary: string;
}) {
  await db.insert(changelogEntries).values({
    userId: input.userId ?? null,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    action: input.action,
    entityLabel: input.entityLabel,
    summary: input.summary,
  });
}

export async function logStudentCreated(
  userId: string | null | undefined,
  student: Pick<Student, "id" | "firstName" | "lastName">,
  detail?: string
) {
  const label = formatStudentLabel(student);
  await insertEntry({
    userId,
    entityType: "student",
    entityId: student.id,
    action: "create",
    entityLabel: label,
    summary: detail ?? "",
  });
}

export async function logStudentUpdated(
  userId: string | null | undefined,
  studentId: number,
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  const changes = describeFieldChanges(before, after, STUDENT_CHANGE_FIELDS, STUDENT_FIELD_LABELS);
  if (!changes) return;

  const label = formatStudentLabel({
    firstName: String(after.firstName ?? before.firstName ?? "Student"),
    lastName: (after.lastName ?? before.lastName) as string | null | undefined,
  });
  await insertEntry({
    userId,
    entityType: "student",
    entityId: studentId,
    action: "update",
    entityLabel: label,
    summary: changes,
  });
}

export async function logStudentDeleted(
  userId: string | null | undefined,
  student: Pick<Student, "id" | "firstName" | "lastName">
) {
  const label = formatStudentLabel(student);
  await insertEntry({
    userId,
    entityType: "student",
    entityId: student.id,
    action: "delete",
    entityLabel: label,
    summary: "",
  });
}

export async function logStudentMerged(
  userId: string | null | undefined,
  keep: Pick<Student, "id" | "firstName" | "lastName">,
  merged: Pick<Student, "id" | "firstName" | "lastName">
) {
  const keepLabel = formatStudentLabel(keep);
  const mergedLabel = formatStudentLabel(merged);
  await insertEntry({
    userId,
    entityType: "student",
    entityId: keep.id,
    action: "merge",
    entityLabel: keepLabel,
    summary: `Merged ${mergedLabel} into ${keepLabel}.`,
  });
}

export async function logEventCreated(
  userId: string | null | undefined,
  event: Pick<Event, "id" | "name" | "startDate">
) {
  const label = formatEventLabel(event);
  await insertEntry({
    userId,
    entityType: "event",
    entityId: event.id,
    action: "create",
    entityLabel: label,
    summary: "",
  });
}

export async function logEventUpdated(
  userId: string | null | undefined,
  eventId: number,
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  const changes = describeFieldChanges(before, after, EVENT_CHANGE_FIELDS, EVENT_FIELD_LABELS);
  if (!changes) return;

  const label = formatEventLabel({
    name: String(after.name ?? before.name ?? "Event"),
    startDate: (after.startDate ?? before.startDate) as Date | string | null | undefined,
  });
  await insertEntry({
    userId,
    entityType: "event",
    entityId: eventId,
    action: "update",
    entityLabel: label,
    summary: changes,
  });
}

export async function logEventDeleted(
  userId: string | null | undefined,
  event: Pick<Event, "id" | "name" | "startDate">
) {
  const label = formatEventLabel(event);
  await insertEntry({
    userId,
    entityType: "event",
    entityId: event.id,
    action: "delete",
    entityLabel: label,
    summary: "",
  });
}

export async function listChangelog(offset: number, limit: number) {
  const rows = await db
    .select({
      id: changelogEntries.id,
      createdAt: changelogEntries.createdAt,
      entityType: changelogEntries.entityType,
      entityId: changelogEntries.entityId,
      action: changelogEntries.action,
      entityLabel: changelogEntries.entityLabel,
      summary: changelogEntries.summary,
      userName: users.name,
    })
    .from(changelogEntries)
    .leftJoin(users, eq(users.id, changelogEntries.userId))
    .orderBy(desc(changelogEntries.createdAt), desc(changelogEntries.id))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const entries: ChangelogEntryRow[] = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    userName: row.userName ?? null,
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    entityLabel: row.entityLabel,
    summary: row.summary,
  }));

  return {
    entries,
    hasMore,
    nextOffset: offset + entries.length,
  };
}
