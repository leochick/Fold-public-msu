"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dashboardDateRangeLabel } from "@/lib/dashboard-date-range";
import {
  renameDashboardViewAction,
  setDefaultDashboardViewAction,
} from "./dashboard-views-actions";
import type { DashboardViewItem } from "@/server/dashboard-views";

export default function SavedViewsSidebar({
  views,
  activeFrom,
  activeTo,
}: {
  views: DashboardViewItem[];
  activeFrom: string;
  activeTo: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function loadView(from: string, to: string) {
    const params = new URLSearchParams({ from, to });
    router.push(`/?${params.toString()}`);
  }

  function startRename(view: DashboardViewItem) {
    setEditingId(view.id);
    setEditName(view.name);
  }

  function cancelRename() {
    setEditingId(null);
    setEditName("");
  }

  function submitRename(id: number) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await renameDashboardViewAction(id, trimmed);
      setEditingId(null);
      setEditName("");
      router.refresh();
    });
  }

  function makeDefault(id: number) {
    setPendingId(id);
    startTransition(async () => {
      await setDefaultDashboardViewAction(id);
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <aside
      className={`shrink-0 transition-all ${collapsed ? "w-10" : "w-56"}`}
      aria-label="Saved views"
    >
      <div className="card sticky top-4 p-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
        >
          {!collapsed && <span className="text-sm font-semibold">Saved Views</span>}
          <span className="text-black/50 dark:text-white/50 text-xs" aria-hidden>
            {collapsed ? "›" : "‹"}
          </span>
        </button>

        {!collapsed && (
          <div className="mt-3 space-y-2">
            {views.length === 0 ? (
              <p className="text-xs text-black/50 dark:text-white/50">
                No saved views yet. Pick a date range and click Save View.
              </p>
            ) : (
              views.map((view) => {
                const isActive = view.from === activeFrom && view.to === activeTo;
                const fromDate = new Date(`${view.from}T00:00:00.000Z`);
                const toDate = new Date(`${view.to}T00:00:00.000Z`);
                const rangeLabel = dashboardDateRangeLabel(fromDate, toDate);
                const busy = isPending && pendingId === view.id;

                return (
                  <div
                    key={view.id}
                    className={`rounded-lg border p-2 ${
                      isActive
                        ? "border-accent/40 bg-accent/5"
                        : "border-black/5 dark:border-white/10"
                    }`}
                  >
                    {editingId === view.id ? (
                      <form
                        className="space-y-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          submitRename(view.id);
                        }}
                      >
                        <input
                          className="input"
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <button type="submit" className="btn btn-primary text-xs px-2 py-1" disabled={!editName.trim()}>
                            Save
                          </button>
                          <button type="button" className="btn btn-ghost text-xs px-2 py-1" onClick={cancelRename}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => loadView(view.from, view.to)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium leading-tight">{view.name}</span>
                            {view.isDefault && (
                              <span className="chip shrink-0">Default</span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-black/50 dark:text-white/50">{rangeLabel}</p>
                        </button>
                        <div className="mt-2 flex gap-1">
                          <button
                            type="button"
                            className="btn btn-ghost text-xs px-2 py-1"
                            onClick={() => startRename(view)}
                          >
                            Rename
                          </button>
                          {!view.isDefault && (
                            <button
                              type="button"
                              className="btn btn-ghost text-xs px-2 py-1"
                              disabled={busy}
                              onClick={() => makeDefault(view.id)}
                            >
                              {busy ? "Saving…" : "Set default"}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
