"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renameGroupingAction } from "../groupings-actions";
import type { GroupingListItem } from "@/server/groupings";
import DeleteGroupingModal from "./DeleteGroupingModal";

export default function SavedGroupingsSidebar({
  groupings,
  activeGroupingId,
}: {
  groupings: GroupingListItem[];
  activeGroupingId: number | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GroupingListItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function loadGrouping(id: number) {
    router.push(`/groupings?grouping=${id}`);
  }

  function startRename(grouping: GroupingListItem) {
    setEditingId(grouping.id);
    setEditName(grouping.name);
  }

  function cancelRename() {
    setEditingId(null);
    setEditName("");
  }

  function submitRename(id: number) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await renameGroupingAction(id, trimmed);
      setEditingId(null);
      setEditName("");
      router.refresh();
    });
  }

  return (
    <>
      <aside
        className={`shrink-0 transition-all ${collapsed ? "w-10" : "w-56"}`}
        aria-label="Saved groupings"
      >
        <div className="card sticky top-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
          >
            {!collapsed && <span className="text-sm font-semibold">Groupings</span>}
            <span className="text-black/50 dark:text-white/50 text-xs" aria-hidden>
              {collapsed ? "›" : "‹"}
            </span>
          </button>

          {!collapsed && (
            <div className="mt-3 space-y-2">
              {groupings.length === 0 ? (
                <p className="text-xs text-black/50 dark:text-white/50">
                  No saved groupings yet. Select a view and create one above.
                </p>
              ) : (
                groupings.map((grouping) => {
                  const isActive = grouping.id === activeGroupingId;

                  return (
                    <div
                      key={grouping.id}
                      className={`rounded-lg border p-2 ${
                        isActive
                          ? "border-accent/40 bg-accent/5"
                          : "border-black/5 dark:border-white/10"
                      }`}
                    >
                      {editingId === grouping.id ? (
                        <form
                          className="space-y-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            submitRename(grouping.id);
                          }}
                        >
                          <input
                            className="input"
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            autoFocus
                          />
                          <div className="flex gap-1">
                            <button
                              type="submit"
                              className="btn btn-primary text-xs px-2 py-1"
                              disabled={!editName.trim() || isPending}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost text-xs px-2 py-1"
                              onClick={cancelRename}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => loadGrouping(grouping.id)}
                          >
                            <span className="text-sm font-medium leading-tight">{grouping.name}</span>
                            <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                              {grouping.viewName}
                            </p>
                            <p className="mt-0.5 text-xs text-black/40 dark:text-white/40">
                              {grouping.eventSelectionLabel}
                            </p>
                          </button>
                          <div className="mt-2 flex gap-1">
                            <button
                              type="button"
                              className="btn btn-ghost text-xs px-2 py-1"
                              onClick={() => startRename(grouping)}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost text-xs px-2 py-1 text-red-600 dark:text-red-400"
                              onClick={() => setDeleteTarget(grouping)}
                            >
                              Delete
                            </button>
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

      {deleteTarget && (
        <DeleteGroupingModal
          groupingId={deleteTarget.id}
          groupingName={deleteTarget.name}
          isActive={deleteTarget.id === activeGroupingId}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
