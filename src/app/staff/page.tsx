import Link from "next/link";
import { db } from "@/lib/db";
import { staff } from "../../../drizzle/schema";
import StaffAllList from "./StaffAllList";
import { resolveDashboardDateRange } from "@/lib/dashboard-date-range";
import { partitionStaffByActiveInRange } from "@/lib/staff-active";
import { getActiveDashboardView } from "@/server/dashboard-views";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const [rows, activeView] = await Promise.all([
    db.select().from(staff).orderBy(staff.firstName),
    getActiveDashboardView(),
  ]);
  const { from, to } = resolveDashboardDateRange(
    activeView ? { from: activeView.from, to: activeView.to } : {}
  );
  const { active, inactive } = partitionStaffByActiveInRange(rows, from, to);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Staff</h1>
        <Link href="/staff/new" className="btn-primary">+ New staff</Link>
      </div>

      <StaffAllList activeStaff={active} inactiveStaff={inactive} />
    </div>
  );
}
