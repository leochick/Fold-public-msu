import { requireUser } from "@/lib/auth";
import { getActiveDashboardView, listDashboardViews } from "@/server/dashboard-views";
import {
  ensureRoleBoardForView,
  getRoleBoardDataViewId,
  getRoleBoardPersonOptions,
} from "@/server/roles";
import RolesEditor from "./RolesEditor";
import RolesHeader from "./RolesHeader";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = await requireUser();
  const activeView = await getActiveDashboardView();
  const allViews = await listDashboardViews();

  if (!activeView) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <RolesHeader snapshot={null} />
        <div className="card">
          <p className="text-sm text-black/60 dark:text-white/60">
            Create a view from the Views menu in the header first.
          </p>
        </div>
      </div>
    );
  }

  const board = await ensureRoleBoardForView(activeView.id, user.id);
  const dataViewId = getRoleBoardDataViewId(board);
  const personOptions = await getRoleBoardPersonOptions(dataViewId);
  const otherViews = allViews
    .filter((view) => view.id !== activeView.id)
    .map((view) => ({ id: view.id, name: view.name }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <RolesEditor
        key={board.id}
        board={board}
        viewName={activeView.name}
        viewFrom={activeView.from}
        viewTo={activeView.to}
        otherViews={otherViews}
        personOptions={personOptions}
      />
    </div>
  );
}
