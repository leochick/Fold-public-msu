"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dashboardDateRangeLabel } from "@/lib/dashboard-date-range";
import {
  renameDashboardViewAction,
  saveDashboardViewAction,
  selectDashboardViewAction,
  setDefaultDashboardViewAction,
} from "./dashboard-views-actions";
import type { DashboardViewItem } from "@/server/dashboard-views";

export default function ViewsMenu({
  views,
  activeView,
}: {
  views: DashboardViewItem[];
  activeView: DashboardViewItem | null;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createFrom, setCreateFrom] = useState("");
  const [createTo, setCreateTo] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setCreating(false);
        setEditingId(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setCreating(false);
        setEditingId(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectView(id: number) {
    if (activeView?.id === id) {
      setOpen(false);
      return;
    }
    setPendingId(id);
    startTransition(async () => {
      await selectDashboardViewAction(id);
      setPendingId(null);
      setOpen(false);
      router.refresh();
    });
  }

  function startRename(view: DashboardViewItem) {
    setCreating(false);
    setEditingId(view.id);
    setEditName(view.name);
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

  function createView() {
    if (!createName.trim() || !createFrom || !createTo || createFrom > createTo) return;
    setCreateError(null);
    startTransition(async () => {
      try {
        await saveDashboardViewAction(createFrom, createTo, createName);
        setCreating(false);
        setCreateName("");
        setCreateFrom("");
        setCreateTo("");
        setOpen(false);
        router.refresh();
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : "Could not create view");
      }
    });
  }

  const label = activeView ? `Views · ${activeView.name}` : "Views";
  const createValid = Boolean(createName.trim() && createFrom && createTo && createFrom <= createTo);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="chip hover:bg-accent/10"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((value) => !value);
          if (open) {
            setCreating(false);
            setEditingId(null);
          }
        }}
      >
        {label}
        <span className="ml-1 text-black/40 dark:text-white/40" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 z-30 rounded-lg border border-black/10 dark:border-white/10 bg-paper dark:bg-ink shadow-lg p-2"
        >
          <div className="space-y-2">
            {!creating ? (
              <button
                type="button"
                role="menuitem"
                className="w-full text-left rounded-md px-2 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => {
                  setCreating(true);
                  setEditingId(null);
                  setCreateError(null);
                }}
              >
                Create a View
              </button>
            ) : (
              <div className="rounded-md border border-black/5 dark:border-white/10 p-2 space-y-2">
                <div>
                  <label htmlFor="views-create-name" className="label block mb-1">
                    Name
                  </label>
                  <input
                    id="views-create-name"
                    type="text"
                    className="input"
                    placeholder="e.g. 2026 Spring Semester"
                    value={createName}
                    onChange={(event) => setCreateName(event.target.value)}
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="views-create-from" className="label block mb-1">
                      From
                    </label>
                    <input
                      id="views-create-from"
                      type="date"
                      className="input"
                      value={createFrom}
                      onChange={(event) => setCreateFrom(event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="views-create-to" className="label block mb-1">
                      To
                    </label>
                    <input
                      id="views-create-to"
                      type="date"
                      className="input"
                      value={createTo}
                      onChange={(event) => setCreateTo(event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="btn btn-primary text-xs px-2 py-1"
                    disabled={!createValid || isPending}
                    onClick={createView}
                  >
                    {isPending ? "Creating…" : "Create"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost text-xs px-2 py-1"
                    onClick={() => {
                      setCreating(false);
                      setCreateError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {createError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{createError}</p>
                )}
              </div>
            )}

            {views.length === 0 ? (
              <p className="px-2 py-1 text-xs text-black/50 dark:text-white/50">
                No saved views yet.
              </p>
            ) : (
              views.map((view) => {
                const isActive = activeView?.id === view.id;
                const fromDate = new Date(`${view.from}T00:00:00.000Z`);
                const toDate = new Date(`${view.to}T00:00:00.000Z`);
                const rangeLabel = dashboardDateRangeLabel(fromDate, toDate);
                const busy = isPending && pendingId === view.id;

                return (
                  <div
                    key={view.id}
                    className={`rounded-md border p-2 ${
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
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          className="w-full text-left"
                          onClick={() => selectView(view.id)}
                          disabled={busy}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium leading-tight">{view.name}</span>
                            {view.isDefault && <span className="chip shrink-0">Default</span>}
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
        </div>
      )}
    </div>
  );
}
