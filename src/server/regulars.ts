import { db } from "@/lib/db";
import type { RegularsPayload, RegularsStudent } from "@/lib/regulars";
import { studentDisplayName } from "@/lib/regulars";
import { attendances, students } from "../../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { getSemestersContext } from "./dashboard-views";
import { getEventsForView } from "./groupings";

export async function getRegularsPayload(): Promise<RegularsPayload | null> {
  const { active } = await getSemestersContext();
  if (!active) return null;

  const eventRows = await getEventsForView(active.id);
  const events = eventRows.map((event) => ({
    id: event.id,
    name: event.name,
    type: event.type,
    startDate: event.startDate.toISOString(),
  }));

  if (events.length === 0) {
    return {
      semesterId: active.id,
      semesterName: active.name,
      events,
      students: [],
      attendances: [],
    };
  }

  const rows = await db
    .select({
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      gender: students.gender,
      eventId: attendances.eventId,
    })
    .from(attendances)
    .innerJoin(students, eq(students.id, attendances.studentId))
    .where(
      inArray(
        attendances.eventId,
        events.map((event) => event.id)
      )
    );

  const studentMap = new Map<number, RegularsStudent>();
  const attendanceRows: RegularsPayload["attendances"] = [];
  for (const row of rows) {
    if (!studentMap.has(row.studentId)) {
      studentMap.set(row.studentId, {
        id: row.studentId,
        firstName: row.firstName,
        lastName: row.lastName,
        gender: row.gender,
      });
    }
    attendanceRows.push({ studentId: row.studentId, eventId: row.eventId });
  }

  const studentList = [...studentMap.values()].sort((a, b) =>
    studentDisplayName(a).localeCompare(studentDisplayName(b), undefined, { sensitivity: "base" })
  );

  return {
    semesterId: active.id,
    semesterName: active.name,
    events,
    students: studentList,
    attendances: attendanceRows,
  };
}
