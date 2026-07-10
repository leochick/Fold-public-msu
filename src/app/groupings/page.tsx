import { listDashboardViews } from "@/server/dashboard-views";
import {
  getEventsForView,
  getAllStaff,
  getFirstGrouping,
  getGroupingById,
  getStudentsForView,
  listGroupings,
} from "@/server/groupings";
import CreateGroupingCard from "./CreateGroupingCard";
import GroupingEditor from "./GroupingEditor";
import SavedGroupingsSidebar from "./SavedGroupingsSidebar";

export const dynamic = "force-dynamic";

export default async function GroupingsPage({
  searchParams,
}: {
  searchParams: Promise<{ grouping?: string }>;
}) {
  const sp = await searchParams;
  const [savedGroupings, savedViews] = await Promise.all([listGroupings(), listDashboardViews()]);

  const groupingId = sp.grouping ? Number(sp.grouping) : null;
  const activeGrouping =
    groupingId && Number.isFinite(groupingId)
      ? await getGroupingById(groupingId)
      : await getFirstGrouping();

  const [events, students, staffMembers] = activeGrouping
    ? await Promise.all([
        getEventsForView(activeGrouping.viewId),
        getStudentsForView(activeGrouping.viewId),
        getAllStaff(),
      ])
    : [[], [], []];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">Groupings</h1>

      <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-6 items-start">
        <div className="row-start-1 col-start-1 self-start">
          <SavedGroupingsSidebar
            groupings={savedGroupings}
            activeGroupingId={activeGrouping?.id ?? null}
          />
        </div>

        <div className="row-start-1 col-start-2 min-w-0 space-y-6">
          <CreateGroupingCard views={savedViews} />

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
                No groupings yet. Select a saved view above and create your first grouping.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
