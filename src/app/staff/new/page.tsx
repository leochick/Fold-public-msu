import { redirect } from "next/navigation";
import StaffForm from "../[id]/StaffForm";
import { db } from "@/lib/db";
import { staff } from "../../../../drizzle/schema";
import { parseStaff } from "@/lib/parse-staff";
import { requireUser } from "@/lib/auth";

export default function NewStaffPage() {
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
      <StaffForm action={create} />
    </div>
  );
}
