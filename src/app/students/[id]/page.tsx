import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { students, attendances, events, staff } from "../../../../drizzle/schema";
import { eq, desc, asc, notInArray, and, gte, lte } from "drizzle-orm";
import StudentForm from "./StudentForm";
import { parseStudent } from "@/lib/parse-student";
import {
  perStudentHealth,
  type StudentLite,
  type AttendanceLite,
} from "@/lib/health-metrics";
import AddEventCardClient from "./AddEventCardClient";
import StudentMergeModal from "./StudentMergeModal";
import { requireUser } from "@/lib/auth";
import { pickStudentFields } from "@/lib/changelog";
import { logStudentDeleted, logStudentUpdated } from "@/server/changelog";
import { resolveDashboardDateRange } from "@/lib/dashboard-date-range";
import { getActiveDashboardView } from "@/server/dashboard-views";

export const dynamic = "force-dynamic";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();
  const [s] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (!s) notFound();

  const history = await db
    .select({ a: attendances, e: events })
    .from(attendances)
    .innerJoin(events, eq(events.id, attendances.eventId))
    .where(eq(attendances.studentId, id))
    .orderBy(desc(attendances.recordedAt));

  const attendedEventIds = history.map((h) => h.e.id);
  const unassignedEventsList = await db
    .select()
    .from(events)
    .where(attendedEventIds.length > 0 ? notInArray(events.id, attendedEventIds) : undefined)
    .orderBy(desc(events.startDate));

  const rosterRows = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      invitedByStudentId: students.invitedByStudentId,
    })
    .from(students)
    .orderBy(asc(students.firstName));
  const staffRows = await db
    .select({
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
    })
    .from(staff)
    .orderBy(asc(staff.firstName));

  const people = [
    ...staffRows.map((r) => ({
      entity: "staff" as const,
      id: r.id,
      name: `${r.firstName}${r.lastName ? " " + r.lastName : ""}`,
    })),
    ...rosterRows
      .filter((r) => r.id !== id)
      .map((r) => ({
        entity: "student" as const,
        id: r.id,
        name: `${r.firstName}${r.lastName ? " " + r.lastName : ""}`,
      })),
  ];

  const activeView = await getActiveDashboardView();
  const { from, to } = resolveDashboardDateRange(
    activeView ? { from: activeView.from, to: activeView.to } : {}
  );
  const viewEvents = await db
    .select({
      id: events.id,
      name: events.name,
      startDate: events.startDate,
    })
    .from(events)
    .where(and(gte(events.startDate, from), lte(events.startDate, to)))
    .orderBy(desc(events.startDate));
  const selectedEventOutsideView =
    s.eventInvitedToId != null && !viewEvents.some((e) => e.id === s.eventInvitedToId)
      ? await db
          .select({ id: events.id, name: events.name, startDate: events.startDate })
          .from(events)
          .where(eq(events.id, s.eventInvitedToId))
          .limit(1)
      : [];
  const eventOptions = [...selectedEventOutsideView, ...viewEvents].map((e) => ({
    id: e.id,
    name: e.name,
    dateLabel: new Date(e.startDate).toLocaleDateString("en-US", { timeZone: "UTC" }),
  }));

  const studentsForHealth: StudentLite[] = rosterRows.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    invitedByStudentId: r.invitedByStudentId ?? null,
  }));
  const allAttendanceRows = await db
    .select({
      studentId: attendances.studentId,
      eventId: attendances.eventId,
      recordedAt: attendances.recordedAt,
    })
    .from(attendances);
  const attendancesForHealth: AttendanceLite[] = allAttendanceRows.map((a) => ({
    studentId: a.studentId,
    eventId: a.eventId,
    recordedAt: new Date(a.recordedAt),
  }));
  const healthMap = perStudentHealth(studentsForHealth, attendancesForHealth);
  const myHealth = healthMap.get(id) ?? null;
  const inviterStudent = s.invitedByStudentId
    ? rosterRows.find((r) => r.id === s.invitedByStudentId)
    : null;
  const inviterStaff = s.invitedByStaffId
    ? staffRows.find((r) => r.id === s.invitedByStaffId)
    : null;
  const friends = (myHealth?.friendIds ?? [])
    .map((fid) => rosterRows.find((r) => r.id === fid))
    .filter((r): r is (typeof rosterRows)[number] => !!r);

  async function update(formData: FormData) {
    "use server";
    const user = await requireUser();
    const data = parseStudent(formData);
    const before = pickStudentFields(s as Record<string, unknown>);
    const after = pickStudentFields({ ...s, ...data, updatedAt: new Date() });
    await db.update(students).set({ ...data, updatedAt: new Date() }).where(eq(students.id, id));
    await logStudentUpdated(user.id, id, before, after);
    redirect(`/students/${id}`);
  }

  async function del() {
    "use server";
    const user = await requireUser();
    await logStudentDeleted(user.id, s);
    await db.delete(students).where(eq(students.id, id));
    redirect("/students");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/students" className="text-sm text-black/60 hover:underline">← Students</Link>
          <h1 className="text-2xl font-semibold">
            {s.firstName} {s.lastName ?? ""}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <StudentMergeModal
            studentId={id}
            keepStudent={{
              id: s.id,
              firstName: s.firstName,
              lastName: s.lastName,
              studentId: s.studentId,
              gender: s.gender,
              year: s.year,
              phone: s.phone,
              email: s.email,
              igHandle: s.igHandle,
              memberStatus: s.memberStatus,
              newsletter: s.newsletter,
              groupme: s.groupme,
              contactedViaIg: s.contactedViaIg,
              primaryContact: s.primaryContact,
              goals: s.goals,
              notes: s.notes,
              courseMaterial: s.courseMaterial,
            }}
          />
          <form action={del}>
            <button className="btn-ghost text-red-600" type="submit">Delete</button>
          </form>
        </div>
      </div>

      <StudentForm action={update} student={s} people={people} events={eventOptions} />

      {myHealth && (
        <section className="card space-y-2 border-accent/20">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">🪜 Health</h2>
            <span className="chip">{myHealth.inviterTier}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
              <div className="text-[10px] uppercase tracking-wide text-black/50">Friends brought</div>
              <div className="text-2xl font-semibold tabular-nums">{myHealth.friendsBrought}</div>
            </div>
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
              <div className="text-[10px] uppercase tracking-wide text-black/50">Last 30d</div>
              <div className="text-2xl font-semibold tabular-nums">{myHealth.recentAttendance}</div>
            </div>
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
              <div className="text-[10px] uppercase tracking-wide text-black/50">Last 365d</div>
              <div className="text-2xl font-semibold tabular-nums">{myHealth.yearlyAttendance}</div>
            </div>
            <div className="rounded-lg border border-black/10 dark:border-white/10 p-2">
              <div className="text-[10px] uppercase tracking-wide text-black/50">Lifetime</div>
              <div className="text-2xl font-semibold tabular-nums">{myHealth.totalAttendance}</div>
            </div>
          </div>
          {inviterStudent && (
            <p className="text-sm">
              <span className="text-black/60">Invited by:</span>{" "}
              <Link href={`/students/${inviterStudent.id}`} className="hover:underline">
                {inviterStudent.firstName}
                {inviterStudent.lastName ? " " + inviterStudent.lastName : ""}
              </Link>
            </p>
          )}
          {inviterStaff && (
            <p className="text-sm">
              <span className="text-black/60">Invited by:</span>{" "}
              {inviterStaff.firstName}
              {inviterStaff.lastName ? " " + inviterStaff.lastName : ""}{" "}
              <span className="text-black/40">(staff)</span>
            </p>
          )}
          {friends.length > 0 && (
            <div className="text-sm">
              <div className="text-black/60 mb-1">Brought ({friends.length}):</div>
              <ul className="flex flex-wrap gap-2">
                {friends.map((f) => (
                  <li key={f.id}>
                    <Link href={`/students/${f.id}`} className="chip hover:bg-black/10">
                      {f.firstName}
                      {f.lastName ? " " + f.lastName : ""}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <AddEventCardClient 
        studentId={id} 
        unassignedEvents={unassignedEventsList.map((e) => ({ id: e.id, name: e.name, date: e.startDate }))} 
      />

      <div className="card">
        <h2 className="font-semibold mb-2">Attendance history ({history.length})</h2>
        {history.length === 0 ? (
          <p className="text-sm text-black/50">No events yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {history.map(({ a, e }) => (
              <li key={a.id} className="py-2 flex justify-between border-t border-black/5 dark:divide-white/5 first:border-t-0 first:pt-0">
                <Link href={`/events/${e.id}`} className="hover:underline">{e.name}</Link>
                <span className="text-black/50">{new Date(e.startDate).toLocaleDateString("en-US", { timeZone: "UTC" })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
