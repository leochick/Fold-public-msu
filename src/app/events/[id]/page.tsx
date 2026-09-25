import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { events, attendances, students } from "../../../../drizzle/schema";
import { and, eq, inArray, lt } from "drizzle-orm";
import EventAttendeeDumper from "./EventAttendeeDumper";
import TotalStudentsCard from "./TotalStudentsCard";
import EditEventCard from "./EditEventCard";
import { requireUser } from "@/lib/auth";
import { pickEventFields } from "@/lib/changelog";
import { logEventDeleted, logEventUpdated } from "@/server/changelog";

export const dynamic = "force-dynamic";

function formatDateForInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function attendeeName(student: { firstName: string; lastName: string | null }) {
  return `${student.firstName} ${student.lastName ?? ""}`.trim();
}

function genderPill(gender: "M" | "F" | null) {
  if (gender === "M") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200 px-2 py-0.5 text-xs">
        Male
      </span>
    );
  }
  if (gender === "F") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200 px-2 py-0.5 text-xs">
        Female
      </span>
    );
  }
  return null;
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const eventId = Number(idStr);
  if (!Number.isFinite(eventId)) notFound();
  const [e] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!e) notFound();

  const presentRows = await db
    .select({ a: attendances, s: students })
    .from(attendances)
    .innerJoin(students, eq(students.id, attendances.studentId))
    .where(eq(attendances.eventId, eventId));

  const present = [...presentRows].sort((left, right) =>
    attendeeName(left.s).localeCompare(attendeeName(right.s), undefined, { sensitivity: "base" })
  );

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
        ? attendeeName(inviter.s)
        : `Student #${s.invitedByStudentId}`;
      const key = s.invitedByStudentId;
      if (!inviterMap.has(key)) {
        inviterMap.set(key, { name: inviterName, invitees: [] });
      }
      inviterMap.get(key)!.invitees.push(attendeeName(s));
    }
  }
  const inviteChains = Array.from(inviterMap.entries()).map(([id, chain]) => ({
    id,
    inviter: chain.name,
    invitees: chain.invitees,
  }));

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

      {present.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="card text-center">
              <div className="text-2xl font-semibold">{firstTimerCount}</div>
              <div className="text-xs text-black/60">First-timers</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-semibold">{present.length - firstTimerCount}</div>
              <div className="text-xs text-black/60">Returners</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-semibold">
                {genderSplit.M}M / {genderSplit.F}F
                {genderSplit.unknown > 0 && (
                  <span className="text-sm text-black/40"> +{genderSplit.unknown}</span>
                )}
              </div>
              <div className="text-xs text-black/60">Gender split</div>
            </div>
          </div>

          {inviteChains.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-medium mb-2">Invite chains</h3>
              <ul className="space-y-1">
                {inviteChains.map((chain) => (
                  <li key={chain.id} className="text-sm">
                    <span className="font-medium">{chain.inviter}</span>
                    <span className="text-black/60"> brought </span>
                    {chain.invitees.map((name, j) => (
                      <span key={`${chain.id}-${j}`}>
                        {j > 0 && ", "}
                        <span className="chip">{name}</span>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <EditEventCard
        eventId={eventId}
        dateValue={formatDateForInput(new Date(e.startDate))}
        type={e.type}
        location={e.location}
        notes={e.notes}
      />

      <EventAttendeeDumper eventId={eventId} />

      <div className="card">
        <h2 className="font-semibold mb-3">Present ({present.length})</h2>
        {present.length === 0 ? (
          <p className="text-sm text-black/50">Nobody yet. Use the dumper above ↑</p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/5">
            {present.map(({ a, s }) => (
              <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                <Link href={`/students/${s.id}`} className="inline-flex items-center gap-2 flex-wrap min-w-0">
                  <span className="hover:underline">
                    {s.firstName} {s.lastName ?? ""}
                  </span>
                  {s.year && <span className="chip">{s.year}</span>}
                  {genderPill(s.gender)}
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
