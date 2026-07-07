"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createGroupingAction } from "../groupings-actions";
import type { DashboardViewItem } from "@/server/dashboard-views";

export default function CreateGroupingCard({ views }: { views: DashboardViewItem[] }) {
  const router = useRouter();
  const [viewId, setViewId] = useState(views[0]?.id?.toString() ?? "");
  const [name, setName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveGrouping() {
    const parsedViewId = Number(viewId);
    if (!Number.isFinite(parsedViewId) || !name.trim()) return;
    setSaveError(null);
    startTransition(async () => {
      try {
        const id = await createGroupingAction(parsedViewId, name);
        setName("");
        router.push(`/groupings?grouping=${id}`);
        router.refresh();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Could not save grouping");
      }
    });
  }

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label htmlFor="grouping-view" className="label block mb-1">
            View
          </label>
          <select
            id="grouping-view"
            className="input"
            value={viewId}
            onChange={(event) => setViewId(event.target.value)}
            disabled={views.length === 0}
          >
            {views.length === 0 ? (
              <option value="">No saved views</option>
            ) : (
              views.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))
            )}
          </select>
        </div>
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
          />
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={saveGrouping}
          disabled={!viewId || !name.trim() || isPending}
        >
          {isPending ? "Saving…" : "Save Grouping"}
        </button>
      </div>
      {saveError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{saveError}</p>}
      {views.length === 0 && (
        <p className="text-xs text-black/60 dark:text-white/60 mt-2">
          Create a saved view on the Dashboard first.
        </p>
      )}
    </div>
  );
}
