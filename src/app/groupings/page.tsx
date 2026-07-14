import { redirect } from "next/navigation";
import {
  getEventsForView,
  getAllStaff,
  getFirstGrouping,
  getGroupingById,
  getStudentsForView,
  listGroupings,
} from "@/server/groupings";
import { getActiveDashboardView } from "@/server/dashboard-views";
import CreateGroupingCard from "./CreateGroupingCard";
import GroupingEditor from "./GroupingEditor";
import { GroupingExportProvider, GroupingsPageHeader } from "./GroupingExport";
import SavedGroupingsSidebar from "./SavedGroupingsSidebar";

export const dynamic = "force-dynamic";

export default async function GroupingsPage({
  searchParams,
}: {
  searchParams: Promise<{ grouping?: string }>;
}) {
  const sp = await searchParams;
  const activeView = await getActiveDashboardView();
  const savedGroupings = activeView ? await listGroupings(activeView.id) : [];

  const groupingId = sp.grouping ? Number(sp.grouping) : null;
  const requestedGrouping =
    groupingId && Number.isFinite(groupingId) ? await getGroupingById(groupingId) : null;

  if (requestedGrouping && activeView && requestedGrouping.viewId !== activeView.id) {
    redirect("/groupings");
  }

  const activeGrouping =
    requestedGrouping ?? (activeView ? await getFirstGrouping(activeView.id) : null);

  const [events, students, staffMembers] = activeGrouping
    ? await Promise.all([
        getEventsForView(activeGrouping.viewId),
        getStudentsForView(activeGrouping.viewId),
        getAllStaff(),
      ])
    : [[], [], []];

  return (
    <GroupingExportProvider>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <GroupingsPageHeader />

        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-6 items-start">
          <div className="row-start-1 col-start-1 self-start">
            <SavedGroupingsSidebar
              groupings={savedGroupings}
              activeGroupingId={activeGrouping?.id ?? null}
            />
          </div>

          <div className="row-start-1 col-start-2 min-w-0 space-y-6">
            <CreateGroupingCard
              viewId={activeView?.id ?? null}
              viewName={activeView?.name ?? null}
            />

            {activeGrouping ? (
              <GroupingEditor
                key={activeGrouping.id}
                grouping={activeGrouping}
                events={events}
                students={students}
                staff={staffMembers}
              />
            ) : (
              <div className="card">
                <p className="text-sm text-black/60 dark:text-white/60">
                  {activeView
                    ? `No groupings for ${activeView.name} yet. Create your first grouping above.`
                    : "Create a view from the Views menu in the header, then create your first grouping."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </GroupingExportProvider>
  );
}
