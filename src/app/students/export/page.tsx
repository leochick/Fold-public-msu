import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendances, events, students } from "../../../../drizzle/schema";
import { formatDashboardDate } from "@/lib/dashboard-date-range";
import { getSemestersContext } from "@/server/dashboard-views";
import StudentsExportForm from "./StudentsExportForm";
import type {
  CampusExportAttendance,
  CampusExportSemester,
  CampusExportStudent,
} from "@/lib/students-campus-export";

export const dynamic = "force-dynamic";

export default async function StudentsExportPage() {
  const [{ semesters, active }, studentRows, attendanceRows] = await Promise.all([
    getSemestersContext(),
    db
      .select({
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
        gender: students.gender,
        year: students.year,
        newsletter: students.newsletter,
        courseMaterial: students.courseMaterial,
        salvationDecisionAt: students.salvationDecisionAt,
        ledToChristByStudentId: students.ledToChristByStudentId,
        ledToChristByStaffId: students.ledToChristByStaffId,
      })
      .from(students)
      .orderBy(students.firstName),
    db
      .select({
        studentId: attendances.studentId,
        eventType: events.type,
        startDate: events.startDate,
      })
      .from(attendances)
      .innerJoin(events, eq(attendances.eventId, events.id)),
  ]);

  const exportStudents: CampusExportStudent[] = studentRows.map((row) => ({
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    gender: row.gender,
    year: row.year,
    newsletter: row.newsletter,
    courseMaterial: row.courseMaterial,
    salvationDecisionAt: row.salvationDecisionAt
      ? formatDashboardDate(row.salvationDecisionAt)
      : null,
    ledToChristByStudentId: row.ledToChristByStudentId,
    ledToChristByStaffId: row.ledToChristByStaffId,
  }));

  const exportAttendances: CampusExportAttendance[] = attendanceRows.map((row) => ({
    studentId: row.studentId,
    eventType: row.eventType,
    eventDate: formatDashboardDate(row.startDate),
  }));

  const exportSemesters: CampusExportSemester[] = semesters.map((semester) => ({
    id: semester.id,
    name: semester.name,
    from: semester.from,
    to: semester.to,
  }));

  const defaultSemesterIds = active ? [active.id] : exportSemesters[0] ? [exportSemesters[0].id] : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <StudentsExportForm
        students={exportStudents}
        attendances={exportAttendances}
        semesters={exportSemesters}
        defaultSemesterIds={defaultSemesterIds}
        campusSheetName="MSU"
      />
    </div>
  );
}
