import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { staff } from "../../../../drizzle/schema";
import { asc, eq } from "drizzle-orm";
import StaffForm from "./StaffForm";
import { parseStaff } from "@/lib/parse-staff";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();
  const [s] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
  if (!s) notFound();

  const staffRows = await db
    .select({
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
    })
    .from(staff)
    .orderBy(asc(staff.firstName));
  const staffOptions = staffRows.map((r) => ({
    id: r.id,
    name: `${r.firstName}${r.lastName ? " " + r.lastName : ""}`,
  }));

  async function update(formData: FormData) {
    "use server";
    await requireUser();
    const data = parseStaff(formData);
    await db.update(staff).set({ ...data, updatedAt: new Date() }).where(eq(staff.id, id));
    redirect(`/staff/${id}`);
  }

  async function del() {
    "use server";
    await requireUser();
    await db.delete(staff).where(eq(staff.id, id));
    redirect("/staff");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/staff" className="text-sm text-black/60 hover:underline">← Staff</Link>
          <h1 className="text-2xl font-semibold">
            {s.firstName} {s.lastName ?? ""}
          </h1>
        </div>
        <form action={del}>
          <button className="btn-ghost text-red-600" type="submit">Delete</button>
        </form>
      </div>

      <StaffForm action={update} staff={s} staffOptions={staffOptions} />
    </div>
  );
}
