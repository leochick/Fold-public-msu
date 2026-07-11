import { db } from "@/lib/db";
import {
  students,
  attendances,
  contactAttempts,
} from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { httpErr } from "@/lib/http";
import type { Student } from "../../drizzle/schema";
import { findMergeSuggestions } from "@/lib/funnel/dedup";
import { buildMergePreview, type MergeEditableField } from "@/lib/student-merge";
import { logStudentMerged } from "./changelog";

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
    return { source, suggestions: [] as Array<{ candidate: (typeof suggestions)[number]; student: Student }> };
  }

  const ids = suggestions.map((s) => s.studentId);
  const matches = await db.select().from(students).where(inArray(students.id, ids));
  const byId = new Map(matches.map((row) => [row.id, row]));

  return {
    source,
    suggestions: suggestions
      .map((candidate) => {
        const student = byId.get(candidate.studentId);
        return student ? { candidate, student } : null;
      })
      .filter((row): row is { candidate: (typeof suggestions)[number]; student: Student } => row != null),
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

    await tx
      .update(contactAttempts)
      .set({ studentId: keepId })
      .where(eq(contactAttempts.studentId, mergeId));

    await tx
      .update(students)
      .set({ invitedByStudentId: keepId })
      .where(eq(students.invitedByStudentId, mergeId));

    const invitedBy = keep.invitedByStudentId ?? merge.invitedByStudentId;

    await tx
      .update(students)
      .set({
        firstName: String(values.firstName ?? keep.firstName),
        lastName: (values.lastName as string | null) ?? null,
        phone: (values.phone as string | null) ?? null,
        email: (values.email as string | null) ?? null,
        igHandle: (values.igHandle as string | null) ?? null,
        studentId: (values.studentId as string | null) ?? null,
        gender: (values.gender as Student["gender"]) ?? null,
        year: (values.year as Student["year"]) ?? null,
        memberStatus: (values.memberStatus as Student["memberStatus"]) ?? null,
        primaryContact: (values.primaryContact as string | null) ?? null,
        goals: (values.goals as string | null) ?? null,
        notes: (values.notes as string | null) ?? null,
        courseMaterial: (values.courseMaterial as string[]) ?? null,
        newsletter: Boolean(values.newsletter),
        groupme: Boolean(values.groupme),
        contactedViaIg: Boolean(values.contactedViaIg),
        invitedByStudentId: invitedBy,
        updatedAt: new Date(),
      })
      .where(eq(students.id, keepId));

    await tx.delete(students).where(eq(students.id, mergeId));
  });

  await logStudentMerged(userId, keep, merge);
  return { ok: true, keepId };
}
