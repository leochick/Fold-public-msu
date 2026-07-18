import { db } from "@/lib/db";
import {
  students,
  attendances,
  staff,
  events,
} from "../../drizzle/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { httpErr } from "@/lib/http";
import { findMergeSuggestions } from "@/lib/funnel/dedup";
import {
  buildMergePreview,
  toMergeStudentRecord,
  type MergeEditableField,
  type MergeStudentRecord,
} from "@/lib/student-merge";
import { logStudentMerged } from "./changelog";

async function loadLabelMaps() {
  const [studentRows, staffRows, eventRows] = await Promise.all([
    db
      .select({ id: students.id, firstName: students.firstName, lastName: students.lastName })
      .from(students),
    db
      .select({ id: staff.id, firstName: staff.firstName, lastName: staff.lastName })
      .from(staff),
    db
      .select({ id: events.id, name: events.name, startDate: events.startDate })
      .from(events),
  ]);

  const studentNames = new Map(
    studentRows.map((r) => [
      r.id,
      `${r.firstName}${r.lastName ? ` ${r.lastName}` : ""}`.trim(),
    ])
  );
  const staffNames = new Map(
    staffRows.map((r) => [
      r.id,
      `${r.firstName}${r.lastName ? ` ${r.lastName}` : ""} (staff)`.trim(),
    ])
  );
  const eventNames = new Map(
    eventRows.map((r) => [
      r.id,
      `${r.name} (${new Date(r.startDate).toLocaleDateString("en-US", { timeZone: "UTC" })})`,
    ])
  );

  return { studentNames, staffNames, eventNames };
}

export async function listMergeSuggestions(studentId: number) {
  const [source] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
  if (!source) throw httpErr.notFound("student not found");

  const roster = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      igHandle: students.igHandle,
      phone: students.phone,
      email: students.email,
      createdAt: students.createdAt,
    })
    .from(students);

  const suggestions = findMergeSuggestions(source, roster);
  if (suggestions.length === 0) {
    return {
      source,
      suggestions: [] as Array<{ candidate: (typeof suggestions)[number]; student: MergeStudentRecord }>,
    };
  }

  const ids = suggestions.map((s) => s.studentId);
  const matches = await db.select().from(students).where(inArray(students.id, ids));
  const { studentNames, staffNames, eventNames } = await loadLabelMaps();
  const byId = new Map(
    matches.map((row) => [row.id, toMergeStudentRecord(row, studentNames, staffNames, eventNames)])
  );

  return {
    source,
    suggestions: suggestions
      .map((candidate) => {
        const student = byId.get(candidate.studentId);
        return student ? { candidate, student } : null;
      })
      .filter(
        (row): row is { candidate: (typeof suggestions)[number]; student: MergeStudentRecord } =>
          row != null
      ),
  };
}

export async function mergeStudents(
  userId: string,
  keepId: number,
  mergeId: number,
  overrides: Partial<Record<MergeEditableField, string>> = {}
) {
  if (keepId === mergeId) throw httpErr.badRequest("cannot merge a student with itself");

  const [[keep], [merge]] = await Promise.all([
    db.select().from(students).where(eq(students.id, keepId)).limit(1),
    db.select().from(students).where(eq(students.id, mergeId)).limit(1),
  ]);
  if (!keep) throw httpErr.notFound("student to keep not found");
  if (!merge) throw httpErr.notFound("student to merge not found");

  const preview = buildMergePreview(keep, merge, overrides);
  const values = preview.values;

  await db.transaction(async (tx) => {
    const survivorAttendances = await tx
      .select({ eventId: attendances.eventId })
      .from(attendances)
      .where(eq(attendances.studentId, keepId));
    const survivorEventIds = new Set(survivorAttendances.map((row) => row.eventId));

    const mergedAttendances = await tx
      .select({ id: attendances.id, eventId: attendances.eventId })
      .from(attendances)
      .where(eq(attendances.studentId, mergeId));

    for (const row of mergedAttendances) {
      if (survivorEventIds.has(row.eventId)) {
        await tx.delete(attendances).where(eq(attendances.id, row.id));
      } else {
        await tx.update(attendances).set({ studentId: keepId }).where(eq(attendances.id, row.id));
      }
    }

    // Re-point inbound references away from the record being deleted.
    await tx
      .update(students)
      .set({ invitedByStudentId: keepId })
      .where(and(eq(students.invitedByStudentId, mergeId), ne(students.id, keepId)));
    await tx
      .update(students)
      .set({ ledToChristByStudentId: keepId })
      .where(and(eq(students.ledToChristByStudentId, mergeId), ne(students.id, keepId)));

    await tx
      .update(students)
      .set({
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        email: values.email,
        igHandle: values.igHandle,
        studentId: values.studentId,
        gender: values.gender,
        year: values.year,
        memberStatus: values.memberStatus,
        primaryContact: values.primaryContact,
        goals: values.goals,
        notes: values.notes,
        courseMaterial: values.courseMaterial,
        newsletter: values.newsletter,
        groupme: values.groupme,
        contactedViaIg: values.contactedViaIg,
        invitedByStudentId: values.invitedByStudentId,
        invitedByStaffId: values.invitedByStaffId,
        eventInvitedToId: values.eventInvitedToId,
        ledToChristByStudentId: values.ledToChristByStudentId,
        ledToChristByStaffId: values.ledToChristByStaffId,
        salvationDecisionAt: values.salvationDecisionAt,
        salvationDecisionType: values.salvationDecisionType,
        salvationDecisionNotes: values.salvationDecisionNotes,
        updatedAt: new Date(),
      })
      .where(eq(students.id, keepId));

    await tx.delete(students).where(eq(students.id, mergeId));
  });

  await logStudentMerged(userId, keep, merge);
  return { ok: true, keepId };
}
