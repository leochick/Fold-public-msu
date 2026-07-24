"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { dashboardDateRangeLabel } from "@/lib/dashboard-date-range";
import {
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
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectSemester(id: number) {
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

  function makeDefault(id: number) {
    setPendingId(id);
    startTransition(async () => {
      await setDefaultDashboardViewAction(id);
      setPendingId(null);
      router.refresh();
    });
  }

  const label = activeView ? activeView.name : "Semesters";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="chip hover:bg-accent/10"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
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
            {views.length === 0 ? (
              <p className="px-2 py-1 text-xs text-black/50 dark:text-white/50">
                No semesters yet. Add dates on the Academic Calendar page.
              </p>
            ) : (
              views.map((semester) => {
                const isActive = activeView?.id === semester.id;
                const fromDate = new Date(`${semester.from}T00:00:00.000Z`);
                const toDate = new Date(`${semester.to}T00:00:00.000Z`);
                const rangeLabel = dashboardDateRangeLabel(fromDate, toDate);
                const busy = isPending && pendingId === semester.id;

                return (
                  <div
                    key={semester.id}
                    className={`rounded-md border p-2 ${
                      isActive
                        ? "border-accent/40 bg-accent/5"
                        : "border-black/5 dark:border-white/10"
                    }`}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full text-left"
                      onClick={() => selectSemester(semester.id)}
                      disabled={busy}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-tight">{semester.name}</span>
                        {semester.isDefault && <span className="chip shrink-0">Default</span>}
                      </div>
                      <p className="mt-1 text-xs text-black/50 dark:text-white/50">{rangeLabel}</p>
                    </button>
                    {!semester.isDefault && (
                      <div className="mt-2 flex gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost text-xs px-2 py-1"
                          disabled={busy}
                          onClick={() => makeDefault(semester.id)}
                        >
                          {busy ? "Saving…" : "Set default"}
                        </button>
                      </div>
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
