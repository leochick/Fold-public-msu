"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createAcademicYearAction,
  deleteAcademicYearAction,
  renameAcademicYearAction,
} from "../academic-calendar-actions";
import type { AcademicYearListItem } from "@/server/academic-calendar";

export default function AcademicYearsSidebar({
  years,
  activeYearId,
}: {
  years: AcademicYearListItem[];
  activeYearId: number | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AcademicYearListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function loadYear(id: number) {
    router.push(`/academic-calendar?year=${id}`);
  }

  function createYear() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        const id = await createAcademicYearAction(trimmed);
        setNewName("");
        router.push(`/academic-calendar?year=${id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create academic year");
      }
    });
  }

  function startRename(year: AcademicYearListItem) {
    setEditingId(year.id);
    setEditName(year.name);
    setError(null);
  }

  function cancelRename() {
    setEditingId(null);
    setEditName("");
  }

  function submitRename(id: number) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      try {
        await renameAcademicYearAction(id, trimmed);
        setEditingId(null);
        setEditName("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not rename academic year");
      }
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      await deleteAcademicYearAction(target.id);
      setDeleteTarget(null);
      if (target.id === activeYearId) {
        router.push("/academic-calendar");
      }
      router.refresh();
    });
  }

  return (
    <>
      <aside
        className={`shrink-0 transition-all ${collapsed ? "w-10" : "w-56"}`}
        aria-label="Academic years"
      >
        <div className="card sticky top-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setCollapsed((value) => !value)}
            aria-expanded={!collapsed}
          >
            {!collapsed && <span className="text-sm font-semibold">Academic Years</span>}
            <span className="text-black/50 dark:text-white/50 text-xs" aria-hidden>
              {collapsed ? "›" : "‹"}
            </span>
          </button>

          {!collapsed && (
            <div className="mt-3 space-y-3">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  createYear();
                }}
              >
                <label htmlFor="new-academic-year" className="label block">
                  Add year
                </label>
                <input
                  id="new-academic-year"
                  className="input"
                  placeholder="e.g. 2025-26"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
                <button
                  type="submit"
                  className="btn btn-primary w-full text-xs"
                  disabled={!newName.trim() || isPending}
                >
                  {isPending && !editingId && !deleteTarget ? "Adding…" : "Add"}
                </button>
              </form>

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}

              <div className="space-y-2 border-t border-black/5 dark:border-white/10 pt-3">
                {years.length === 0 ? (
                  <p className="text-xs text-black/50 dark:text-white/50">
                    No academic years yet. Add one above.
                  </p>
                ) : (
                  years.map((year) => {
                    const isActive = year.id === activeYearId;

                    return (
                      <div
                        key={year.id}
                        className={`rounded-lg border p-2 ${
                          isActive
                            ? "border-accent/40 bg-accent/5"
                            : "border-black/5 dark:border-white/10"
                        }`}
                      >
                        {editingId === year.id ? (
                          <form
                            className="space-y-2"
                            onSubmit={(event) => {
                              event.preventDefault();
                              submitRename(year.id);
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
                              onClick={() => loadYear(year.id)}
                            >
                              <span className="text-sm font-medium leading-tight">{year.name}</span>
                            </button>
                            <div className="mt-2 flex gap-1">
                              <button
                                type="button"
                                className="btn btn-ghost text-xs px-2 py-1"
                                onClick={() => startRename(year)}
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost text-xs px-2 py-1 text-red-600 dark:text-red-400"
                                onClick={() => setDeleteTarget(year)}
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
            </div>
          )}
        </div>
      </aside>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-xl">
            <h2 className="text-lg font-semibold">Delete academic year</h2>
            <p className="text-sm text-black/60 dark:text-white/60 mt-2">
              Delete <span className="font-medium text-black dark:text-white">{deleteTarget.name}</span>?
              This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-black/5 dark:border-white/10">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary bg-red-600 hover:opacity-90 text-white border-red-600"
                onClick={confirmDelete}
                disabled={isPending}
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
