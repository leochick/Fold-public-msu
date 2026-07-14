"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createGroupingAction } from "../groupings-actions";

type ViewOption = {
  id: number;
  name: string;
};

export default function CreateGroupingCard({
  viewId,
  viewName,
  otherViews,
}: {
  viewId: number | null;
  viewName: string | null;
  otherViews: ViewOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [eventAndStudentDataView, setEventAndStudentDataView] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function createGrouping() {
    if (viewId == null || !name.trim()) return;
    setSaveError(null);
    startTransition(async () => {
      try {
        const dataViewId = eventAndStudentDataView
          ? Number(eventAndStudentDataView)
          : null;
        const id = await createGroupingAction(
          viewId,
          name,
          dataViewId != null && Number.isFinite(dataViewId) ? dataViewId : null
        );
        setName("");
        setEventAndStudentDataView("");
        router.push(`/groupings?grouping=${id}`);
        router.refresh();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Could not create grouping");
      }
    });
  }

  return (
    <div className="card">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label htmlFor="grouping-name" className="label block mb-1">
              Grouping name
            </label>
            <input
              id="grouping-name"
              type="text"
              className="input"
              placeholder="e.g. Small groups"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={viewId == null}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={createGrouping}
            disabled={viewId == null || !name.trim() || isPending}
          >
            {isPending ? "Creating…" : "Create New Grouping"}
          </button>
        </div>
        <div>
          <label htmlFor="event-student-data-view" className="label block mb-1">
            Event and student data from:
          </label>
          <select
            id="event-student-data-view"
            className="input"
            value={eventAndStudentDataView}
            onChange={(event) => setEventAndStudentDataView(event.target.value)}
            disabled={viewId == null || otherViews.length === 0}
          >
            <option value="">
              {viewName ? `${viewName} (current view)` : "Current view"}
            </option>
            {otherViews.map((view) => (
              <option key={view.id} value={view.id}>
                {view.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {saveError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{saveError}</p>}
      {viewId == null ? (
        <p className="text-xs text-black/60 dark:text-white/60 mt-2">
          Create a view from the Views menu in the header first.
        </p>
      ) : (
        <p className="text-xs text-black/60 dark:text-white/60 mt-2">
          A new grouping for {viewName}.
        </p>
      )}
    </div>
  );
}
