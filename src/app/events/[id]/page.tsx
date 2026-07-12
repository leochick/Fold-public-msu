import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { events, attendances, students } from "../../../../drizzle/schema";
import { eq, desc, and, lt, inArray } from "drizzle-orm";
import EventInsights from "./EventInsights";
import EventAttendeeDumper from "./EventAttendeeDumper";
import TotalStudentsCard from "./TotalStudentsCard";
import EditEventCard from "./EditEventCard";
import { requireUser } from "@/lib/auth";
import { pickEventFields } from "@/lib/changelog";
import { logEventDeleted, logEventUpdated } from "@/server/changelog";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const eventId = Number(idStr);
  if (!Number.isFinite(eventId)) notFound();
  const [e] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!e) notFound();

  const present = await db
    .select({ a: attendances, s: students })
    .from(attendances)
    .innerJoin(students, eq(students.id, attendances.studentId))
    .where(eq(attendances.eventId, eventId))
    .orderBy(desc(attendances.recordedAt));

  // --- Compute stats for insights ---
  const studentIds = present.map(({ s }) => s.id);
  let firstTimerCount = present.length;
  if (studentIds.length > 0) {
    const priorAttendees = await db
      .selectDistinct({ studentId: attendances.studentId })
      .from(attendances)
      .innerJoin(events, eq(events.id, attendances.eventId))
      .where(
        and(
          inArray(attendances.studentId, studentIds),
          lt(events.startDate, e.startDate)
        )
      );
    const priorSet = new Set(priorAttendees.map((r) => r.studentId));
    firstTimerCount = studentIds.filter((id) => !priorSet.has(id)).length;
  }

  const genderSplit = { M: 0, F: 0, unknown: 0 };
  for (const { s } of present) {
    if (s.gender === "M") genderSplit.M++;
    else if (s.gender === "F") genderSplit.F++;
    else genderSplit.unknown++;
  }

  const inviterMap = new Map<number, { name: string; invitees: string[] }>();
  for (const { s } of present) {
    if (s.invitedByStudentId) {
      const inviter = present.find(({ s: inv }) => inv.id === s.invitedByStudentId);
      const inviterName = inviter
        ? `${inviter.s.firstName} ${inviter.s.lastName ?? ""}`.trim()
        : `Student #${s.invitedByStudentId}`;
      const key = s.invitedByStudentId;
      if (!inviterMap.has(key)) {
        inviterMap.set(key, { name: inviterName, invitees: [] });
      }
      inviterMap.get(key)!.invitees.push(`${s.firstName} ${s.lastName ?? ""}`.trim());
    }
  }
  const inviteChains = Array.from(inviterMap.values()).map((v) => ({
    inviter: v.name,
    invitees: v.invitees,
  }));

  const eventStats = {
    total: present.length,
    firstTimers: firstTimerCount,
    returners: present.length - firstTimerCount,
    genderSplit,
    inviteChains,
  };

  async function removeAttendance(formData: FormData) {
    "use server";
    const aid = Number(formData.get("aid"));
    if (Number.isFinite(aid)) {
      await db.delete(attendances).where(eq(attendances.id, aid));
    }
    redirect(`/events/${eventId}`);
  }

  async function saveTotalStudents(formData: FormData) {
    "use server";
    const user = await requireUser();
    const raw = String(formData.get("totalStudents") || "").trim();
    const totalStudents = raw === "" ? null : Number(raw);
    if (raw !== "" && (!Number.isFinite(totalStudents) || totalStudents! < 0)) {
      redirect(`/events/${eventId}`);
    }
    const before = pickEventFields(e as Record<string, unknown>);
    const nextTotal = raw === "" ? null : totalStudents;
    await db
      .update(events)
      .set({ totalStudents: nextTotal })
      .where(eq(events.id, eventId));
    await logEventUpdated(
      user.id,
      eventId,
      before,
      { ...before, totalStudents: nextTotal }
    );
    redirect(`/events/${eventId}`);
  }

  async function saveEventDetails(formData: FormData) {
    "use server";
    const user = await requireUser();
    const date = String(formData.get("date") || "").trim();
    const type = String(formData.get("type") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      redirect(`/events/${eventId}`);
    }
    const [y, m, day] = date.split("-").map(Number);
    const startDate = new Date(y, m - 1, day);
    if (isNaN(startDate.getTime())) {
      redirect(`/events/${eventId}`);
    }

    const before = pickEventFields(e as Record<string, unknown>);
    const patch = {
        startDate,
        type: type || null,
        location: location || null,
        notes: notes || null,
      };
    await db
      .update(events)
      .set(patch)
      .where(eq(events.id, eventId));
    await logEventUpdated(user.id, eventId, before, { ...before, ...patch });
    redirect(`/events/${eventId}`);
  }

  async function deleteEvent() {
    "use server";
    const user = await requireUser();
    await logEventDeleted(user.id, e);
    await db.delete(events).where(eq(events.id, eventId));
    redirect("/events");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Link href="/events" className="text-sm text-black/60 hover:underline">← Events</Link>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">{e.name}</h1>
          <form action={deleteEvent}>
            <button className="btn-ghost text-red-600 text-xs">Delete event</button>
          </form>
        </div>
        <p className="text-sm text-black/60">
          {new Date(e.startDate).toLocaleDateString()}
          {e.type ? ` · ${e.type}` : ""}
          {e.location ? ` · ${e.location}` : ""}
        </p>
      </div>

      <TotalStudentsCard
        eventId={eventId}
        totalStudents={e.totalStudents}
        saveAction={saveTotalStudents}
      />

      {present.length > 0 && <EventInsights eventId={eventId} stats={eventStats} />}

      <EditEventCard
        eventId={eventId}
        startDate={e.startDate}
        type={e.type}
        location={e.location}
        notes={e.notes}
        saveAction={saveEventDetails}
      />

      <EventAttendeeDumper eventId={eventId} />

      <div className="card">
        <h2 className="font-semibold mb-3">Present ({present.length})</h2>
        {present.length === 0 ? (
          <p className="text-sm text-black/50">Nobody yet. Use the dumper above ↑</p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/5">
            {present.map(({ a, s }) => (
              <li key={a.id} className="py-2 flex items-center justify-between">
                <Link href={`/students/${s.id}`} className="hover:underline">
                  {s.firstName} {s.lastName ?? ""}
                  {s.year && <span className="ml-2 chip">{s.year}</span>}
                </Link>
                <form action={removeAttendance}>
                  <input type="hidden" name="aid" value={a.id} />
                  <button className="text-xs text-black/40 hover:text-red-600" type="submit">remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
