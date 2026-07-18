import { redirect } from "next/navigation";
import StaffForm from "../[id]/StaffForm";
import { db } from "@/lib/db";
import { staff } from "../../../../drizzle/schema";
import { parseStaff } from "@/lib/parse-staff";
import { requireUser } from "@/lib/auth";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function NewStaffPage() {
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

  async function create(formData: FormData) {
    "use server";
    await requireUser();
    const data = parseStaff(formData);
    if (!data.firstName) redirect("/staff/new");
    const [row] = await db.insert(staff).values(data).returning();
    redirect(`/staff/${row.id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      <h1 className="text-2xl font-semibold">New staff</h1>
      <StaffForm action={create} staffOptions={staffOptions} />
    </div>
  );
}
