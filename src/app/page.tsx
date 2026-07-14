import Link from "next/link";
import { db } from "@/lib/db";
import { students, events, attendances } from "../../drizzle/schema";
import { sql, eq, and, gte, lte, isNotNull, inArray, or, isNull, notInArray } from "drizzle-orm";
import { dashboardDateRangeLabel, resolveDashboardDateRange } from "@/lib/dashboard-date-range";
import {
  classifyEngagementInRange,
  isActiveOrEngagedInRange,
  buildEngagementFunnelData,
  type RangeEngagementStage,
} from "@/lib/dashboard-engagement";
import { getActiveDashboardView } from "@/server/dashboard-views";
import DashboardCharts from "./DashboardCharts";
import QuickAdd from "./events/QuickAdd";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const activeView = await getActiveDashboardView();
  const { from, to } = resolveDashboardDateRange(
    activeView ? { from: activeView.from, to: activeView.to } : {}
  );
  const rangeLabel = activeView
    ? `${activeView.name} (${dashboardDateRangeLabel(from, to)})`
    : dashboardDateRangeLabel(from, to);
  const eventDateRange = and(gte(events.startDate, from), lte(events.startDate, to));

  const [
    overTime,
    repeatRows,
    attendanceTypeRows,
    byYear,
    byGender,
    byType,
    eventsInRange,
    attendsInRange,
    newStudentsInRange,
    uniqueAttendeesInRange,
    hotRows,
  ] = await Promise.all([
    db
      .select({
        eventId: events.id,
        name: events.name,
        date: events.startDate,
        count: sql<number>`coalesce(${events.totalStudents}, count(${attendances.id}))`.as("c"),
      })
      .from(events)
      .leftJoin(attendances, eq(attendances.eventId, events.id))
      .where(eventDateRange)
      .groupBy(events.id)
      .orderBy(events.startDate),
    db
      .select({ sid: attendances.studentId, c: sql<number>`count(*)`.as("c") })
      .from(attendances)
      .innerJoin(events, eq(attendances.eventId, events.id))
      .where(eventDateRange)
      .groupBy(attendances.studentId),
    db
      .select({
        studentId: attendances.studentId,
        eventType: events.type,
      })
      .from(attendances)
      .innerJoin(events, eq(attendances.eventId, events.id))
      .where(eventDateRange),
    db
      .select({ year: students.year, c: sql<number>`count(distinct ${students.id})`.as("c") })
      .from(students)
      .innerJoin(attendances, eq(attendances.studentId, students.id))
      .innerJoin(events, eq(attendances.eventId, events.id))
      .where(and(eventDateRange, isNotNull(students.year)))
      .groupBy(students.year),
    db
      .select({ gender: students.gender, c: sql<number>`count(distinct ${students.id})`.as("c") })
      .from(students)
      .innerJoin(attendances, eq(attendances.studentId, students.id))
      .innerJoin(events, eq(attendances.eventId, events.id))
      .where(and(eventDateRange, isNotNull(students.gender)))
      .groupBy(students.gender),
    db
      .select({ type: events.type, c: sql<number>`count(*)`.as("c") })
      .from(events)
      .where(and(eventDateRange, isNotNull(events.type)))
      .groupBy(events.type),
    db.select({ c: sql<number>`count(*)` }).from(events).where(eventDateRange),
    db
      .select({ c: sql<number>`count(*)` })
      .from(attendances)
      .innerJoin(events, eq(attendances.eventId, events.id))
      .where(eventDateRange),
    db
      .select({ c: sql<number>`count(*)` })
      .from(students)
      .where(and(gte(students.createdAt, from), lte(students.createdAt, to))),
    db
      .select({ c: sql<number>`count(distinct ${attendances.studentId})` })
      .from(attendances)
      .innerJoin(events, eq(attendances.eventId, events.id))
      .where(eventDateRange),
    db
      .select({
        sid: attendances.studentId,
        visits: sql<number>`count(*)`.as("v"),
        lastSeen: sql<number>`max(${events.startDate})`.as("ls"),
      })
      .from(attendances)
      .innerJoin(events, eq(attendances.eventId, events.id))
      .where(eventDateRange)
      .groupBy(attendances.studentId),
  ]);

  const overTimeData = overTime.map((r) => ({
    name: r.name,
    date: new Date(r.date).toLocaleDateString("en-US", { timeZone: "UTC" }),
    count: Number(r.count),
    eventId: r.eventId,
  }));

  const eventTypesByStudent = new Map<number, string[]>();
  for (const row of attendanceTypeRows) {
    const list = eventTypesByStudent.get(row.studentId) ?? [];
    if (row.eventType) list.push(row.eventType);
    eventTypesByStudent.set(row.studentId, list);
  }

  const attendanceInRangeIds = repeatRows.map((r) => r.sid);

  const [newsletterOnlyRows, leaderCandidateRows] = await Promise.all([
    db
      .select({ id: students.id })
      .from(students)
      .where(
        and(
          eq(students.newsletter, true),
          attendanceInRangeIds.length > 0
            ? notInArray(students.id, attendanceInRangeIds)
            : undefined
        )
      ),
    attendanceInRangeIds.length > 0
      ? db
          .select({
            id: students.id,
            courseMaterial: students.courseMaterial,
          })
          .from(students)
          .where(inArray(students.id, attendanceInRangeIds))
      : Promise.resolve([] as { id: number; courseMaterial: string[] | null }[]),
  ]);

  const funnelData = buildEngagementFunnelData({
    attendances: repeatRows.map((r) => ({
      studentId: r.sid,
      attendanceCount: Number(r.c),
      eventTypes: eventTypesByStudent.get(r.sid) ?? [],
    })),
    newsletterOnlyStudentIds: newsletterOnlyRows.map((r) => r.id),
    studentLeaderIds: leaderCandidateRows
      .filter((row) => {
        const materials = row.courseMaterial as string[] | null;
        return Array.isArray(materials) && materials.includes("Student Leader");
      })
      .map((row) => row.id),
  });

  const breakdowns = {
    year: byYear.map((r) => ({ name: r.year ?? "—", value: Number(r.c) })),
    gender: byGender.map((r) => ({
      name: r.gender === "M" ? "Male" : r.gender === "F" ? "Female" : "—",
      value: Number(r.c),
    })),
    eventType: byType.map((r) => ({ name: r.type ?? "—", value: Number(r.c) })),
  };

  const studentsActiveOrEngaged = repeatRows.filter((r) => isActiveOrEngagedInRange(Number(r.c)));
  const engagementByStudent = new Map<number, RangeEngagementStage>(
    studentsActiveOrEngaged.map((r) => [r.sid, classifyEngagementInRange(Number(r.c))!])
  );
  const activeOrEngagedIds = studentsActiveOrEngaged.map((r) => r.sid);

  const [completedRaw, pendingRaw, notOnNewsletter, notOnGroupme] = await Promise.all([
    attendanceInRangeIds.length > 0
      ? db
          .select({
            id: students.id,
            firstName: students.firstName,
            lastName: students.lastName,
            email: students.email,
            courseMaterial: students.courseMaterial,
          })
          .from(students)
          .where(inArray(students.id, attendanceInRangeIds))
      : [],
    activeOrEngagedIds.length > 0
      ? db
          .select({
            id: students.id,
            firstName: students.firstName,
            lastName: students.lastName,
            email: students.email,
            courseMaterial: students.courseMaterial,
          })
          .from(students)
          .where(inArray(students.id, activeOrEngagedIds))
      : [],
    attendanceInRangeIds.length > 0
      ? db
          .select({
            id: students.id,
            firstName: students.firstName,
            lastName: students.lastName,
            email: students.email,
          })
          .from(students)
          .where(and(inArray(students.id, attendanceInRangeIds), eq(students.newsletter, false)))
          .orderBy(students.firstName)
      : [],
    attendanceInRangeIds.length > 0
      ? db
          .select({
            id: students.id,
            firstName: students.firstName,
            lastName: students.lastName,
            email: students.email,
          })
          .from(students)
          .where(and(inArray(students.id, attendanceInRangeIds), eq(students.groupme, false)))
          .orderBy(students.firstName)
      : [],
  ]);

  const hasC101 = (courseMaterial: unknown) => {
    const materials = courseMaterial as string[] | null;
    return Array.isArray(materials) && materials.includes("Course 101");
  };

  const completedStudents = completedRaw.filter((student) => hasC101(student.courseMaterial));

  const pendingStudents = pendingRaw
    .filter((student) => !hasC101(student.courseMaterial))
    .map((student) => ({
      ...student,
      engagementStage: engagementByStudent.get(student.id)!,
    }));

  const snapshot = {
    events: Number(eventsInRange[0]?.c ?? 0),
    attendances: Number(attendsInRange[0]?.c ?? 0),
    uniquePeople: Number(uniqueAttendeesInRange[0]?.c ?? 0),
    newStudents: Number(newStudentsInRange[0]?.c ?? 0),
  };

  const sortedHot = hotRows
    .map((r) => ({ sid: r.sid, visits: Number(r.visits), lastSeen: Number(r.lastSeen) }))
    .sort((a, b) => b.visits - a.visits);
  const hotIds = sortedHot.map((r) => r.sid);
  const hotStudents = hotIds.length
    ? await db
        .select()
        .from(students)
        .where(
          and(
            inArray(students.id, hotIds),
            or(
              eq(students.memberStatus, "prospect"),
              eq(students.memberStatus, "member"),
              isNull(students.memberStatus)
            )
          )
        )
    : [];
  const hotById = new Map(hotStudents.map((s) => [s.id, s]));
  const hotProspects = sortedHot
    .filter((r) => hotById.has(r.sid))
    .slice(0, 10)
    .map((r) => {
      const s = hotById.get(r.sid)!;
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName ?? ""}`.trim(),
        year: s.year,
        gender: s.gender,
        status: s.memberStatus,
        primaryContact: s.primaryContact,
        visits: r.visits,
        lastSeen: new Date(Number(r.lastSeen) * 1000).toLocaleDateString("en-US", { timeZone: "UTC" }),
      };
    });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <QuickAdd />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Events" value={snapshot.events} />
        <Stat label="Total check-ins" value={snapshot.attendances} />
        <Stat label="Unique people" value={snapshot.uniquePeople} />
        <Stat label="New students" value={snapshot.newStudents} />
      </section>

      <DashboardCharts
        overTime={overTimeData}
        funnel={funnelData}
        breakdowns={breakdowns}
        completedC101={completedStudents}
        pendingC101={pendingStudents}
        notOnNewsletter={notOnNewsletter}
        notOnGroupme={notOnGroupme}
        rangeLabel={rangeLabel}
      />

      <section className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">Active prospects</h2>
            <p className="text-xs text-black/60">
              Non-core members ranked by attendance from {rangeLabel}. Highest priority for follow-up.
            </p>
          </div>
          <Link href="/students" className="text-xs text-black/60 hover:underline">all students →</Link>
        </div>
        {hotProspects.length === 0 ? (
          <p className="text-sm text-black/50">No attendance in this date range yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Year</th><th>Status</th><th>Visits</th><th>Primary contact</th><th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {hotProspects.map((s) => (
                <tr key={s.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                  <td>
                    <Link href={`/students/${s.id}`} className="font-medium hover:underline">{s.name}</Link>
                    <span className="ml-1 text-xs text-black/40">{s.gender === "M" ? "♂" : s.gender === "F" ? "♀" : ""}</span>
                  </td>
                  <td>{s.year ?? "—"}</td>
                  <td>{s.status ? <span className="chip">{s.status}</span> : <span className="text-black/30">—</span>}</td>
                  <td className="font-medium">{s.visits}</td>
                  <td className="text-sm">{s.primaryContact ?? <span className="text-black/30">—</span>}</td>
                  <td className="text-sm text-black/60">{s.lastSeen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="text-3xl font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}
