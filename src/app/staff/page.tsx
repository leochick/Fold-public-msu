import Link from "next/link";
import { db } from "@/lib/db";
import { staff } from "../../../drizzle/schema";
import StaffAllList from "./StaffAllList";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const rows = await db.select().from(staff).orderBy(staff.firstName);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Staff</h1>
        <Link href="/staff/new" className="btn-primary">+ New staff</Link>
      </div>

      <StaffAllList staff={rows} />
    </div>
  );
}
