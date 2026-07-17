import { redirect } from "next/navigation";
import StudentForm from "../[id]/StudentForm";
import { db } from "@/lib/db";
import { students, staff, events } from "../../../../drizzle/schema";
import { parseStudent } from "@/lib/parse-student";
import { requireUser } from "@/lib/auth";
import { logStudentCreated } from "@/server/changelog";
import { asc, desc, and, gte, lte } from "drizzle-orm";
import { resolveDashboardDateRange } from "@/lib/dashboard-date-range";
import { getActiveDashboardView } from "@/server/dashboard-views";

export default async function NewStudentPage() {
  async function create(formData: FormData) {
    "use server";
    const user = await requireUser();
    const data = parseStudent(formData);
    if (!data.firstName) redirect("/students/new");
    const [row] = await db.insert(students).values({ ...data, addedByUserId: user.id }).returning();
    await logStudentCreated(user.id, row);
    redirect(`/students/${row.id}`);
  }

  const [rosterRows, staffRows, activeView] = await Promise.all([
    db
      .select({
        id: students.id,
        firstName: students.firstName,
        lastName: students.lastName,
      })
      .from(students)
      .orderBy(asc(students.firstName)),
    db
      .select({
        id: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
      })
      .from(staff)
      .orderBy(asc(staff.firstName)),
    getActiveDashboardView(),
  ]);

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

  const people = [
    ...staffRows.map((r) => ({
      entity: "staff" as const,
      id: r.id,
      name: `${r.firstName}${r.lastName ? " " + r.lastName : ""}`,
    })),
    ...rosterRows.map((r) => ({
      entity: "student" as const,
      id: r.id,
      name: `${r.firstName}${r.lastName ? " " + r.lastName : ""}`,
    })),
  ];

  const eventOptions = viewEvents.map((e) => ({
    id: e.id,
    name: e.name,
    dateLabel: new Date(e.startDate).toLocaleDateString("en-US", { timeZone: "UTC" }),
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <h1 className="text-2xl font-semibold">New student</h1>
      <StudentForm action={create} people={people} events={eventOptions} />
    </div>
  );
}
