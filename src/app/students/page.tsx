import Link from "next/link";
import { db } from "@/lib/db";
import { attendances, events, students } from "../../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { primaryEngagementLabel } from "@/lib/dashboard-engagement";
import QuickAddStudents from "./QuickAddStudents";
import StudentsAllList from "./StudentsAllList";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const [allRows, countRows, typeRows] = await Promise.all([
    db.select().from(students).orderBy(students.firstName),
    db
      .select({
        studentId: attendances.studentId,
        count: sql<number>`count(*)`.as("c"),
      })
      .from(attendances)
      .groupBy(attendances.studentId),
    db
      .select({
        studentId: attendances.studentId,
        eventType: events.type,
      })
      .from(attendances)
      .innerJoin(events, eq(attendances.eventId, events.id)),
  ]);

  const countByStudent = new Map(countRows.map((row) => [row.studentId, Number(row.count)]));
  const typesByStudent = new Map<number, string[]>();
  for (const row of typeRows) {
    const list = typesByStudent.get(row.studentId) ?? [];
    if (row.eventType) list.push(row.eventType);
    typesByStudent.set(row.studentId, list);
  }

  const listRows = allRows.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    gender: s.gender,
    year: s.year,
    engagement: primaryEngagementLabel({
      courseMaterial: s.courseMaterial,
      attendanceCount: countByStudent.get(s.id) ?? 0,
      eventTypes: typesByStudent.get(s.id) ?? [],
      newsletter: s.newsletter,
    }),
    igHandle: s.igHandle,
    primaryContact: s.primaryContact,
    email: s.email,
    phone: s.phone,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Students</h1>
        <Link href="/students/new" className="btn-primary">+ New student</Link>
      </div>

      <QuickAddStudents />

      <StudentsAllList students={listRows} />
    </div>
  );
}
