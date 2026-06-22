"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dashboardDateRangeLabel } from "@/lib/dashboard-date-range";
import { saveDashboardViewAction } from "./dashboard-views-actions";

export default function DashboardDateFilter({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [saving, setSaving] = useState(false);
  const [viewName, setViewName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function apply() {
    if (!fromDate || !toDate || fromDate > toDate) return;
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    router.push(`/?${params.toString()}`);
  }

  function saveView() {
    if (!fromDate || !toDate || fromDate > toDate) return;
    setSaveError(null);
    startTransition(async () => {
      try {
        await saveDashboardViewAction(fromDate, toDate, viewName);
        setSaving(false);
        setViewName("");
        router.refresh();
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Could not save view");
      }
    });
  }

  const fromParsed = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null;
  const toParsed = toDate ? new Date(`${toDate}T00:00:00.000Z`) : null;
  const rangeLabel =
    fromParsed && toParsed && !Number.isNaN(fromParsed.getTime()) && !Number.isNaN(toParsed.getTime())
      ? dashboardDateRangeLabel(fromParsed, toParsed)
      : null;
  const datesValid = Boolean(fromDate && toDate && fromDate <= toDate);

  return (
    <div className="card">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <label htmlFor="dashboard-from" className="label block mb-1">
            From
          </label>
          <input
            id="dashboard-from"
            type="date"
            className="input"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="dashboard-to" className="label block mb-1">
            To
          </label>
          <input
            id="dashboard-to"
            type="date"
            className="input"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={apply} disabled={!datesValid}>
          Apply
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setSaving((value) => !value);
            setSaveError(null);
          }}
          disabled={!datesValid}
        >
          Save View
        </button>
      </div>

      {saving && (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2">
          <div className="flex-1">
            <label htmlFor="dashboard-view-name" className="label block mb-1">
              View name
            </label>
            <input
              id="dashboard-view-name"
              type="text"
              className="input"
              placeholder="e.g. Fall semester"
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={saveView}
            disabled={!viewName.trim() || isPending}
          >
            {isPending ? "Saving…" : "Confirm save"}
          </button>
        </div>
      )}

      {saveError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{saveError}</p>}

      {rangeLabel && (
        <p className="text-xs text-black/60 mt-2">
          Showing data for {rangeLabel}
        </p>
      )}
    </div>
  );
}
