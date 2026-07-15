import { getActiveDashboardView } from "@/server/dashboard-views";
import { getStaffAllocationForView } from "@/server/staff-allocation";
import StaffAllocationHeader from "./StaffAllocationHeader";
import StaffAllocationView from "./StaffAllocationView";

export const dynamic = "force-dynamic";

export default async function StaffAllocationPage() {
  const activeView = await getActiveDashboardView();

  if (!activeView) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <StaffAllocationHeader snapshot={null} />
        <div className="card">
          <p className="text-sm text-black/60 dark:text-white/60">
            Create a view from the Views menu in the header first.
          </p>
        </div>
      </div>
    );
  }

  const staff = await getStaffAllocationForView(activeView.id);
  const snapshot = {
    viewName: activeView.name,
    viewFrom: activeView.from,
    viewTo: activeView.to,
    staff,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <StaffAllocationHeader snapshot={snapshot} />
      <StaffAllocationView staff={staff} viewName={activeView.name} />
    </div>
  );
}
